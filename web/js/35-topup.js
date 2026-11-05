/* ---------- Handy aufladen ---------- */
/* Nummer lesbar gruppieren: Vorwahl (3 Ziffern) und Rest */
const telFmt=n=>n.length>3?n.slice(0,3)+" "+n.slice(3):n;
function topup(_,qs){
  const ops=BRANDS.filter(b=>b.cat==="topup"), c=ctry(), saved=S.numbers.filter(x=>x.c===S.country);
  const q0=ops.some(o=>o.id===qs.get("op"))?qs.get("op"):"";
  const T={n:(qs.get("n")||"").replace(/\D/g,"").replace(/^0+/,"").slice(0,12),op:q0,a:0};
  const detect=n=>{const m=OPS[S.country];if(!m||n.length<3)return "";const p=n.slice(0,3);for(const k in m)if(m[k].split(" ").includes(p)&&byId(k))return k;return ""};
  const amt0=o=>o.amts[Math.min(1,o.amts.length-1)];
  if(!T.op)T.op=detect(T.n);
  T.auto=!!T.op&&!q0;
  if(T.op)T.a=amt0(byId(T.op));
  return {tab:"topup",title:"Handy aufladen",html:`${crumb([["Handy aufladen"]])}
<div class="tu">
  <div class="tu-head"><h1 class="h1 page-h1">Handy aufladen</h1><p class="lead">Guthaben für ${ops.length} Anbieter. Nummer eingeben, Betrag wählen, bezahlen – das Guthaben wird direkt nach der Zahlung gebucht.</p></div>
  <div class="tu-steps">
    <section class="tu-step spot" aria-labelledby="tuS1"><h2 class="tu-sh" id="tuS1"><span class="tu-n" aria-hidden="true">1</span>Land und Nummer</h2>
      <button class="sel" data-a="country" aria-label="Land: ${esc(c.n)}. Ändern">${flag(c.c,24)}<span>${esc(c.n)}</span>${ic("i-down")}</button>
      <label class="lbl" for="tNum">Handynummer</label>
      <div class="phone"><span>${c.dial}</span><input id="tNum" type="tel" inputmode="tel" placeholder="151 2345678" value="${esc(T.n)}" autocomplete="tel-national" aria-describedby="tErr"></div>
      <div class="err" id="tErr" role="alert"></div>
      ${saved.length?`<span class="lbl tu-sl">Gespeicherte Nummern</span><div class="tu-saved">${saved.map(x=>`<button class="chip" data-a="tSaved" data-v="${esc(x.n)}|${esc(x.op)}">${ic("i-user")}${esc(telFmt(x.n))}</button>`).join("")}</div>`:""}
    </section>
    <section class="tu-step spot" aria-labelledby="tuS2"><h2 class="tu-sh" id="tuS2"><span class="tu-n" aria-hidden="true">2</span>Anbieter</h2>
      <p class="tu-det" id="tDet"></p>
      <div class="tu-ops" id="tOps" role="group" aria-labelledby="tuS2">${ops.map(x=>`<button class="chip" data-a="tOp" data-v="${x.id}" aria-pressed="false"><i class="tu-dot" style="background:${x.bg}" aria-hidden="true"></i>${esc(x.name)}</button>`).join("")}</div>
    </section>
    <section class="tu-step spot" aria-labelledby="tuS3"><h2 class="tu-sh" id="tuS3"><span class="tu-n" aria-hidden="true">3</span>Betrag</h2>
      <div class="amounts" id="tAmts" role="group" aria-labelledby="tuS3" data-off></div>
    </section>
  </div>
  <aside class="tu-aside" aria-label="Zusammenfassung">
    <div class="tu-prev" id="tuPrev">
      <div class="phone-mock" id="pMock" aria-hidden="true"><span class="lm" aria-hidden="true"></span><div class="pm-screen"><div class="pm-card" id="pmCard"><span class="gc ghost"></span></div><div class="pm-op"><i id="pmOpC"></i><span id="pmOp">Anbieter wählen</span></div><div class="pm-num" id="pmNum">${c.dial} …</div><div class="pm-amt" id="pmAmt"><small>Aufladung</small><span>–</span></div><div class="pm-bar"><i></i></div><div class="pm-ok">Wird nach der Zahlung gebucht</div></div></div>
    </div>
    <div class="tu-sum spot">
      <h2 class="h3">Zusammenfassung</h2>
      <dl class="tu-rows"><div><dt>Nummer</dt><dd id="sNum">–</dd></div><div><dt>Anbieter</dt><dd id="sOp">–</dd></div><div><dt>Guthaben</dt><dd id="sAmt">–</dd></div></dl>
      <div class="tu-tot"><span>Gesamt</span><b id="sTot" aria-live="polite">–</b></div>
      <p class="tu-fee">${taxHint()}</p>
      <label class="chk"><input type="checkbox" id="tSave"${S.user?" checked":""}><span>Nummer für später speichern</span></label>
      <div class="tu-buy" data-off><button class="btn btn-primary btn-lg btn-block" data-a="tBuy">Zur Kasse</button><button class="btn btn-outline btn-block" data-a="tAdd">In den Warenkorb</button></div>
      <div class="trust"><span>${ic("i-zap")}Gutschrift nach der Zahlung</span><span>${ic("i-lock")}Sichere Zahlung über Stripe</span></div>
      ${payLogos({cat:"topup"})}
    </div>
  </aside>
</div>`,
  after(){
    const num=$("#tNum"),pm=$("#pMock"),prev=$("#tuPrev");
    stick($(".tu-aside"));
    let amtOp=null;
    const draw=()=>{
      const o=byId(T.op), ok=!!(o&&T.a), dial=ctry().dial;
      $$("#tOps .chip").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===T.op));
      if(amtOp!==T.op){amtOp=T.op;$("#tAmts").innerHTML=o?o.amts.map(a=>`<button class="amt" data-a="tAmt" data-v="${a}" aria-pressed="false">${money(a)}${Math.abs(price(o,a)-a)>.004?`<small>${money(price(o,a))}</small>`:""}</button>`).join(""):`<p class="tu-hint">Wähle zuerst einen Anbieter.</p>`}
      $$("#tAmts .amt").forEach(x=>x.setAttribute("aria-pressed",+x.dataset.v===T.a));
      $("#tDet").textContent=T.auto&&o?`Automatisch erkannt: ${o.name}. Stimmt das nicht? Wähle einen anderen Anbieter.`:o?"Wähle einen anderen Anbieter, falls die Nummer woanders ist.":"Wähle den Mobilfunkanbieter der Nummer.";
      $("#sNum").textContent=T.n?`${dial} ${telFmt(T.n)}`:"–";
      $("#sOp").textContent=o?o.name:"–";
      $("#sAmt").textContent=ok?money(T.a):"–";
      $("#sTot").textContent=ok?money(price(o,T.a)):"–";
      /* Vorschau auf dem iPhone */
      prev.style.setProperty("--pc",o?glowOf(o):"#5B4BF0");
      $("#pmOp").textContent=o?o.name:"Anbieter wählen";$("#pmOpC").style.background=o?o.bg:"";
      if(pm.dataset.op!==(o?o.id:"")){pm.dataset.op=o?o.id:"";$("#pmCard").innerHTML=o?gc(o,{tilt:false,badge:false,cls:"flash"}):'<span class="gc ghost"></span>'}
      $("#pmNum").textContent=`${dial} ${T.n?telFmt(T.n):"…"}`;
      const key=(o?o.id:"")+"|"+T.a, amt=$("#pmAmt span");
      if(pm.dataset.k!==key){pm.dataset.k=key;amt.textContent=ok?"+ "+money(T.a):"–";pm.classList.remove("charged");const a=$("#pmAmt");a.classList.remove("tick");void pm.offsetWidth;if(ok){pm.classList.add("charged");a.classList.add("tick")}}
    };
    const pick=id=>{T.op=id;const o=byId(id);if(o&&!o.amts.includes(T.a))T.a=amt0(o)};
    num.addEventListener("input",()=>{T.n=num.value.replace(/\D/g,"").replace(/^0+/,"");$("#tErr").textContent="";const d=detect(T.n);if(d&&d!==T.op){pick(d);T.auto=true}draw()});
    num.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();num.blur()}});
    A.tOp=v=>{pick(v);T.auto=false;draw()};
    A.tAmt=v=>{T.a=+v;draw()};
    A.tSaved=v=>{const p=v.split("|");T.n=p[0];num.value=p[0];$("#tErr").textContent="";if(byId(p[1]))pick(p[1]);T.auto=false;draw()};
    const item=()=>{
      if(T.n.length<6||T.n.length>12){$("#tErr").textContent="Bitte gib eine gültige Handynummer ein.";num.focus();return null}
      if(!T.op||!T.a){toast("Bitte Anbieter und Betrag wählen");return null}
      if($("#tSave").checked&&!S.numbers.some(x=>x.n===T.n&&x.c===S.country)){S.numbers.push({n:T.n,c:S.country,op:T.op});save()}
      return {id:T.op,a:T.a,q:1,type:"topup",phone:`${ctry().dial} ${T.n}`};
    };
    A.tAdd=()=>{const it=item();if(it)addCart(it)};
    A.tBuy=()=>{const it=item();if(it){addCart(it,true);go("/kasse")}};
    draw();
  }};
}
