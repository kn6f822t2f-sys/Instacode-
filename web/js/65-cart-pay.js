/* ---------- Seiten-Warenkorb (rechts als schwebendes Glas, auf dem Handy von unten) ---------- */
let drX=null;
function drawerHTML(){
  const n=cartCount();
  return `<div class="dr-h"><h2 class="dr-t">Warenkorb${n?` <span>${n} Artikel</span>`:""}</h2><button class="x" data-a="cartClose" aria-label="Warenkorb schließen">${ic("i-x")}</button></div>
  ${n?`<div class="dr-b">${S.cart.map(lineHTML).join("")}</div>
  <div class="dr-f"><div class="dr-tot"><span>Gesamt</span><b>${money(grandTotal())}</b></div><p class="dr-tax">${[VATR()?`inkl. ${String(VATR()).replace(".",",")} % MwSt.`:"",feeAmt()?`inkl. ${feeTxt()} Servicegebühr pro Bestellung`:""].filter(Boolean).join(" · ")||"Endpreis"}</p>${xpayBox("drX","")}<a class="btn btn-primary btn-lg btn-block" href="/kasse">Zur Kasse</a><a class="btn btn-ghost btn-block" href="/warenkorb">Warenkorb ansehen</a></div>`
  :`<div class="dr-b dr-empty"><div class="ghostfan" aria-hidden="true"><span class="gc ghost"></span><span class="gc ghost"></span><span class="gc" style="--b:var(--foil)"></span></div><p>Dein Warenkorb ist leer.</p><button class="btn btn-primary" data-a="browse">Jetzt stöbern</button></div>`}`;
}
A.cartOpen=()=>{const d=$("#drawer"),was=d.classList.contains("open");d.innerHTML=drawerHTML();d.classList.add("open");$("#drawerScrim").classList.add("open");document.body.classList.add("lock");drX&&drX.destroy();drX=cartCount()?xpayMount($("#drX"),cartItems,{ctx:"cart"}):null;if(!was){const x=$("#drawer .x");x&&x.focus({preventScroll:true})}};
A.cartClose=()=>{const d=$("#drawer");if(!d||!d.classList.contains("open"))return;d.classList.remove("open");$("#drawerScrim").classList.remove("open");drX&&drX.destroy();drX=null;if(!$("#scrim").classList.contains("open")&&!$("#menu").classList.contains("open")&&!$("#pal").classList.contains("open"))document.body.classList.remove("lock")};

/* ---------- Schnellkauf-Fenster ---------- */
A.qb=(id,a0)=>{
  let b=byId(id);if(!b)return;
  if(b.cat==="topup"){go("/aufladen?op="+id);return}
  const Q={a:0,q:1};let X=null;
  const pick=()=>{const avail=b.amts.filter(a=>!soldOut(b.id,a)),def=b.amts[Math.min(1,b.amts.length-1)];Q.a=a0&&avail.includes(+a0)?+a0:avail.includes(def)?def:(avail[0]||0);a0=null};
  const tagTxt=()=>Q.a?(b.type==="card"?money(Q.a):esc(optLabel(b,Q.a))):"ausverkauft";
  const draw=()=>{
    const K=isKey(b),vars=variants(b),card=b.type==="card",dis=Q.a?"":" disabled";
    $("#sheet").firstElementChild.innerHTML=`<div class="sheet-h"><h3>Schnellkauf</h3><button class="x" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button></div>
    <div class="qb"><div class="qb-stage" style="--g:${glowOf(b)}">${gc(b,{cover:K,cls:"flash",amt:K?null:tagTxt(),amtId:"qbTag"})}</div>
    <div class="qb-info"><h3 class="qb-name">${esc(b.name)}</h3><p class="qb-meta">${K?esc(PLAT[b.plat])+"-Key · ":""}Gültig in ${REGION[b.region]||regDE(b.region)||"Deutschland"} · Code per E-Mail</p>
      ${vars.length>1?`<span class="lbl" id="qbVL">${K?"Plattform":"Variante"}</span><div class="qb-vars" role="group" aria-labelledby="qbVL">${vars.map(v=>`<button class="chip" data-a="qbVar" data-v="${v.id}" aria-pressed="${v.id===b.id}">${esc(varName(b,v))}</button>`).join("")}</div>`:""}
      ${b.amts.length>1?`<span class="lbl" id="qbAL">${card?"Betrag":"Option"}</span><div class="${card?"amounts":"qb-opts"}" role="group" aria-labelledby="qbAL">${b.amts.map(a=>`<button class="amt" data-a="qbAmt" data-v="${a}" aria-pressed="${a===Q.a}"${soldOut(b.id,a)?" disabled":""}>${card&&!b.labels?money(a):esc(optLabel(b,a))}${soldOut(b.id,a)?"<small>ausverkauft</small>":(!card||b.disc||b.px)?`<small>${money(price(b,a))}</small>`:""}</button>`).join("")}</div>`:""}
      <div class="qb-qty"><span class="lbl">Menge</span><div class="qty" role="group" aria-label="Menge"><button data-a="qbQty" data-v="-1" aria-label="Weniger">−</button><span id="qbQ">${Q.q}</span><button data-a="qbQty" data-v="1" aria-label="Mehr">+</button></div></div>
      <div class="qb-tot"><span>Gesamt</span><b id="qbTot">${money(price(b,Q.a)*Q.q)}</b></div>${feeTxt()?`<p class="qb-fee">zzgl. ${feeTxt()} Servicegebühr pro Bestellung</p>`:""}
      ${xpayBox("qbX","")}
      <div class="qb-acts"><button class="btn btn-primary btn-lg" data-a="qbBuy"${dis}>Zur Kasse</button><button class="btn btn-soft btn-lg" data-a="qbAdd"${dis}>In den Warenkorb</button></div>
      <a class="qb-more" href="/marke/${b.id}">${K?"Details und Aktivierung":"Details und Geschenkoption"}</a></div></div>`;
    X&&X.destroy();X=xpayMount($("#qbX"),()=>[{id:b.id,a:Q.a,q:Q.q}],{ctx:"quick"});
  };
  const upd=()=>{$("#qbQ").textContent=Q.q;$("#qbTot").textContent=money(price(b,Q.a)*Q.q);const t=$("#qbTag");if(t){t.textContent=tagTxt();t.classList.remove("tick");void t.offsetWidth;t.classList.add("tick")}X&&X.refresh()};
  A.qbVar=v=>{b=byId(v);pick();draw()};
  A.qbAmt=(v,el)=>{Q.a=+v;$$("#sheet [data-a=qbAmt]").forEach(x=>x.setAttribute("aria-pressed",x===el));upd()};
  A.qbQty=v=>{Q.q=Math.max(1,Math.min(10,Q.q+ +v));upd()};
  A.qbAdd=()=>{if(!Q.a)return;addCart({id:b.id,a:Q.a,q:Q.q,type:"code"},true);closeSheet(true);toast(`${b.name} im Warenkorb`,["/warenkorb","Ansehen"]);if(matchMedia("(min-width:768px)").matches)A.cartOpen()};
  A.qbBuy=()=>{if(!Q.a)return;addCart({id:b.id,a:Q.a,q:Q.q,type:"code"},true);closeSheet(true);go("/kasse")};
  pick();openSheet("",{wide:true});draw();
};

/* ---------- Expresszahlung: Apple Pay, Google Pay, PayPal, Link … (Stripe Express Checkout) ---------- */
let stripeP=null;
const loadStripe=()=>stripeP||(stripeP=new Promise((ok,no)=>{if(window.Stripe)return ok(window.Stripe(CFG.pk));const s=document.createElement("script");s.src="https://js.stripe.com/v3/";s.async=true;s.onload=()=>window.Stripe?ok(window.Stripe(CFG.pk)):no(new Error("Stripe nicht verfügbar"));s.onerror=()=>{stripeP=null;no(new Error("Stripe.js konnte nicht geladen werden"))};document.head.appendChild(s)}));
/* Das Design ist nur hell; Stripe-Felder und Widgets folgen dem */
const isDark=()=>false;
function xpayMount(box,getItems,o={}){
  if(!box||!CFG.express||!evMail()){if(box)box.hidden=true;if(o.onHide)o.onHide();return null}
  const btns=$(".xpay-btns",box),err=$(".xpay-err",box);
  let dead=false,elements=null,ece=null,quote=null,seq=0,avail=false;
  const say=m=>{err.textContent=m||""};
  const ok=o.okEl||$(".xok",box),okL=ok&&ok.closest("label");
  const lock=()=>box.classList.toggle("locked",!!ok&&!ok.checked);
  const nudge=()=>{say("Bitte bestätige zuerst die AGB und die sofortige Lieferung.");if(okL){okL.classList.remove("shake");void okL.offsetWidth;okL.classList.add("shake")}ok&&ok.focus()};
  if(ok){ok.addEventListener("change",()=>{lock();if(ok.checked)say("")});$(".xpay-lock",box).addEventListener("click",nudge);lock()}
  const items=()=>getItems().filter(i=>i&&i.a);
  const ready=()=>!o.ready||o.ready();
  const vis=()=>{box.hidden=!(avail&&ready()&&items().length)};
  const getQuote=async()=>{const it=items();if(!it.length)return null;const my=++seq;const q=await API("/quote",{method:"POST",body:{items:it}});return my===seq?q:quote};
  const remember=r=>{S.keys=Object.assign(S.keys||{},{[r.id]:r.key});if(o.ctx==="cart")S.cartOrder=r.id;save()};
  const intent=async email=>{const r=await API("/express/intent",{method:"POST",body:{items:items(),email,expect:quote&&quote.total,consent:!!(ok&&ok.checked)}});remember(r);return r};
  if(CFG.devpay){
    const XW={apple_pay:["xa","Apple Pay"],google_pay:["xg","Google Pay"],paypal:["xp","PayPal"],amazon_pay:["xz","Amazon Pay"],link:["xl","Link"]};
    const ws=(WALLETS().length?WALLETS():["apple_pay"]).slice(0,3);
    btns.innerHTML=`<div class="xdev">${ws.map(k=>`<button class="${XW[k][0]}" data-w="${XW[k][1]}">${XW[k][1]}</button>`).join("")}</div>`;
    avail=true;vis();
    btns.onclick=async e=>{const w=e.target.closest("[data-w]");if(!w)return;if(ok&&!ok.checked)return nudge();say("");try{quote=await getQuote();const email=(S.user&&S.user.email)||S.lastEmail||prompt("E-Mail für deine Codes (simuliertes Wallet):","");if(!email)return;S.lastEmail=email;const r=await intent(email);location.href=`/__devpay/pi/${encodeURIComponent(r.client_secret.split("_secret_")[0])}?r=${encodeURIComponent(`/r/${r.id}?k=${r.key}`)}`}catch(x){say(x.message)}};
    return {refresh:vis,destroy(){dead=true}};
  }
  (async()=>{try{
    quote=await getQuote();if(dead||!quote)return;
    const stripe=await loadStripe();if(dead)return;
    elements=stripe.elements({mode:"payment",amount:quote.total,currency:"eur",locale:"de",appearance:{theme:"stripe",variables:{borderRadius:"25px"}}});
    ece=elements.create("expressCheckout",{emailRequired:true,buttonHeight:50,paymentMethods:{klarna:CFG.klarna&&CFG.klarna.length?"auto":"never"},buttonType:{applePay:"buy",googlePay:"buy",paypal:"buynow"}});
    ece.on("availablepaymentmethodschange",({paymentMethods})=>{avail=!!paymentMethods;vis();if(!avail&&o.onHide)o.onHide()});
    ece.on("click",ev=>{if(ok&&!ok.checked)return nudge();ev.resolve({lineItems:(quote?quote.lines:[]).map(l=>({name:l.label,amount:l.amount}))})});
    ece.on("confirm",async ev=>{say("");try{
      const {error:se}=await elements.submit();if(se){say(se.message);return}
      const r=await intent(ev.billingDetails&&ev.billingDetails.email);
      const {error}=await stripe.confirmPayment({elements,clientSecret:r.client_secret,confirmParams:{return_url:`${location.origin}/r/${r.id}?k=${encodeURIComponent(r.key)}`},redirect:"if_required"});
      if(error){say(error.message);return}
      closeSheet(true);A.cartClose();go(`/bestellung/${r.id}?k=${encodeURIComponent(r.key)}`);
    }catch(x){say(x.message);try{ev.paymentFailed&&ev.paymentFailed({reason:"fail"})}catch(e){}}});
    ece.mount(btns);
  }catch(x){box.hidden=true;if(o.onHide)o.onHide()}})();
  return {async refresh(){vis();if(!elements||dead)return;try{quote=await getQuote();if(quote)elements.update({amount:quote.total})}catch(x){}},destroy(){dead=true;try{ece&&ece.destroy()}catch(e){}}};
}
