/* ---------- Seiten-Warenkorb (rechts als weißes Glas, auf dem Handy von unten) ----------
   Zeilen, „Passt dazu“ mit 1-Tipp-Hinzufügen, Summe zählt mit, Expresszahlung direkt im Fuß. */
let drX=null,drFrom=null;
const drTax=()=>[VATR()?`inkl. ${String(VATR()).replace(".",",")} % MwSt.`:"",feeAmt()?`inkl. ${feeTxt()} Servicegebühr pro Bestellung`:""].filter(Boolean).join(" · ")||"Endpreis";
function drawerHTML(){
  const n=cartCount();
  return `<div class="dr-h"><h2 class="dr-t">Warenkorb${n?` <span id="drN">${n} Artikel</span>`:""}</h2><button class="x" data-a="cartClose" aria-label="Warenkorb schließen">${ic("i-x")}</button></div>
  ${n?`<div class="dr-b"><div class="dr-lines" id="drLines">${S.cart.map(lineHTML).join("")}</div>${recoHTML("dr")}</div>
  <div class="dr-f"><div class="dr-tot"><span>Gesamt</span><b id="drTot">${money(grandTotal())}</b></div><p class="dr-tax">${drTax()}</p>
   ${xpBox("drX",{compact:true})}
   <a class="btn btn-primary btn-ink btn-lg btn-block" href="/kasse">${ic("i-lock")}Zur Kasse</a><a class="btn btn-ghost btn-block" href="/warenkorb">Warenkorb ansehen</a></div>`
  :`<div class="dr-b dr-empty"><div class="ck-fan sm" aria-hidden="true">${POP.map(byId).filter(Boolean).slice(0,3).map((b,i)=>`<span class="ck-fc" style="--i:${i}"><i>${gc(b,{tilt:false,badge:false,plat:false})}</i></span>`).join("")}</div><p>Dein Warenkorb ist leer.</p><button class="btn btn-primary" data-a="browse">Jetzt stöbern</button></div>`}`;
}
/* Offener Seiten-Warenkorb: nur Zeilen, Summe und Empfehlungen neu – Zustimmung und Wallet-Knöpfe bleiben stehen */
function drUpdate(){
  const d=$("#drawer");if(!d||!d.classList.contains("open"))return;
  const L=$("#drLines");if(!L||!cartCount())return A.cartOpen(true);
  const old=parseFloat(($("#drTot")||{}).dataset&&$("#drTot").dataset.v)||null;
  L.innerHTML=S.cart.map(lineHTML).join("");
  const n=$("#drN");if(n)n.textContent=cartCount()+" Artikel";
  const t=$("#drTot");if(t){countUp(t,old!=null?old:grandTotal(),grandTotal());t.dataset.v=grandTotal()}
  const tx=$(".dr-tax",d);if(tx)tx.textContent=drTax();
  recoSync(d);drX&&drX.refresh();
}
A.cartOpen=(full)=>{const d=$("#drawer"),was=d.classList.contains("open");
  if(was&&full!==true&&$("#drLines")&&cartCount())return drUpdate();
  if(!was)drFrom=document.activeElement;d.innerHTML=drawerHTML();d.classList.add("open");$("#drawerScrim").classList.add("open");document.body.classList.add("lock");
  const t=$("#drTot");if(t)t.dataset.v=grandTotal();
  drX&&drX.destroy();drX=cartCount()?xpayMount($("#drX"),cartItems,{ctx:"cart",doneIn:d}):null;rails(d);
  if(!was){const x=$("#drawer .x");x&&x.focus({preventScroll:true})}};
A.cartClose=()=>{const d=$("#drawer");if(!d||!d.classList.contains("open"))return;const inside=d.contains(document.activeElement);d.classList.remove("open");$("#drawerScrim").classList.remove("open");drX&&drX.destroy();drX=null;if(!$("#scrim").classList.contains("open")&&!$("#menu").classList.contains("open")&&!$("#pal").classList.contains("open"))document.body.classList.remove("lock");
  /* Fokus zurück zum Auslöser (meist der Warenkorb-Knopf in der Kopfzeile) */
  if(inside){const t=drFrom&&drFrom.isConnected&&drFrom.getClientRects().length?drFrom:$("#hcart");t&&t.focus({preventScroll:true})}drFrom=null};
/* Tab bleibt im offenen Seiten-Warenkorb */
document.addEventListener("keydown",e=>{
  if(e.key!=="Tab")return;const d=$("#drawer");if(!d||!d.classList.contains("open")||$("#pal").classList.contains("open")||$(".xsim"))return;
  const f=focusables(d);if(!f.length)return;const a=document.activeElement,i=f.indexOf(a);
  if(!d.contains(a)){e.preventDefault();f[0].focus();return}
  if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}
});

/* ---------- Bewegung: Karte fliegt in den Warenkorb, Summe zählt mit ----------
   Nur transform/opacity (Web Animations), bei reduzierter Bewegung sofort. */
function flyTo(src,dst,o={}){
  if(!src||!dst||reduce)return Promise.resolve();
  const a=src.getBoundingClientRect(),b=dst.getBoundingClientRect();
  if(!a.width||!b.width||a.bottom<0||a.top>innerHeight)return Promise.resolve();
  const c=src.cloneNode(true);c.removeAttribute("id");$$("[id]",c).forEach(x=>x.removeAttribute("id"));c.classList.add("fly");c.setAttribute("aria-hidden","true");
  Object.assign(c.style,{position:"fixed",left:a.left+"px",top:a.top+"px",width:a.width+"px",height:a.height+"px",margin:"0",zIndex:"400",pointerEvents:"none",transformOrigin:"0 0"});
  document.body.appendChild(c);
  const s=Math.max(.08,Math.min(b.width/a.width,b.height/a.height)),dx=b.left+(b.width-a.width*s)/2-a.left,dy=b.top+(b.height-a.height*s)/2-a.top,lift=Math.min(150,Math.abs(dx)*.22+70);
  const an=c.animate([{transform:"translate(0,0) scale(1) rotate(0deg)",opacity:1},
    {transform:`translate(${dx*.42}px,${dy*.42-lift}px) scale(${Math.min(1.08,(1+s)/2+.12)}) rotate(-7deg)`,opacity:1,offset:.42},
    {transform:`translate(${dx}px,${dy}px) scale(${s}) rotate(-3deg)`,opacity:o.fade?0:1}],{duration:o.ms||680,easing:"cubic-bezier(.32,.72,.2,1)"});
  return an.finished.catch(()=>{}).then(()=>c.remove());
}
const countUp=(el,from,to,ms=620)=>{if(!el)return;cancelAnimationFrame(el._cu);if(reduce||!isFinite(from)||Math.abs(from-to)<.005){el.textContent=money(to);return}
  const t0=performance.now(),st=now=>{const k=Math.min(1,(now-t0)/ms),e=1-Math.pow(1-k,3);el.textContent=money(from+(to-from)*e);if(k<1)el._cu=requestAnimationFrame(st)};el._cu=requestAnimationFrame(st)};
const bumpEl=el=>{if(!el||reduce)return;el.classList.remove("ck-pop");void el.offsetWidth;el.classList.add("ck-pop")};

/* ---------- Schnellkauf-Fenster ----------
   Betrag wählen → Expresszahlung direkt im Fenster (E-Mail kommt aus der Wallet) → Bestellseite.
   Darunter „oder mit Karte bezahlen“: „Mit Karte zahlen“ (normale Kasse) und „In den Warenkorb“. */
let qbX=null;
A.qb=(id,a0)=>{
  let b=byId(id);if(!b)return;
  if(b.cat==="topup"){go("/aufladen?op="+id);return}
  const Q={a:0,q:1};
  const pick=()=>{const avail=b.amts.filter(a=>!soldOut(b.id,a)),def=b.amts[Math.min(1,b.amts.length-1)];Q.a=a0&&avail.includes(+a0)?+a0:avail.includes(def)?def:(avail[0]||0);a0=null};
  const tagTxt=()=>Q.a?(b.type==="card"?money(Q.a):esc(optLabel(b,Q.a))):"ausverkauft";
  const tot=()=>Q.a?price(b,Q.a)*Q.q:0,fee=()=>Q.a?FEEC()/100:0;
  const sumHTML=()=>`<div class="sumrow"><span>${esc(optLabel(b,Q.a||b.amts[0]))}${Q.q>1?` × ${Q.q}`:""}</span><span>${money(tot())}</span></div>${fee()?`<div class="sumrow"><span>Servicegebühr <small>pro Bestellung</small></span><span>${money(fee())}</span></div>`:""}<div class="sumrow tot"><span>Gesamt</span><span id="qbTot">${money(tot()+fee())}</span></div><div class="sumrow vatrow"><span>${VATR()?`inkl. ${String(VATR()).replace(".",",")} % MwSt.`:"Endpreis"}</span><span></span></div>`;
  const draw=()=>{
    const K=isKey(b),vars=variants(b),card=b.type==="card",dis=Q.a?"":" disabled";
    $("#sheet").firstElementChild.innerHTML=`<div class="sheet-h"><h3>Schnellkauf</h3><button class="x" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button></div>
    <div class="qb"><div class="qb-stage" style="--g:${glowOf(b)}"><div class="qb-float">${gc(b,{cover:K,cls:"flash",amt:K?null:tagTxt(),amtId:"qbTag"})}</div></div>
    <div class="qb-info"><div class="qb-title"><h3 class="qb-name">${esc(b.name)}</h3><p class="qb-meta">${K?esc(PLAT[b.plat])+"-Key · ":""}Gültig in ${REGION[b.region]||regDE(b.region)||"Deutschland"} · Code per E-Mail</p></div>
      ${vars.length>1?`<span class="lbl" id="qbVL">${K?"Plattform":"Variante"}</span><div class="qb-vars" role="group" aria-labelledby="qbVL">${vars.map(v=>`<button class="chip" data-a="qbVar" data-v="${v.id}" aria-pressed="${v.id===b.id}">${esc(varName(b,v))}</button>`).join("")}</div>`:""}
      ${b.amts.length>1?`<span class="lbl" id="qbAL">${card?"Betrag":"Option"}</span><div class="${card?"amounts":"qb-opts"}" role="group" aria-labelledby="qbAL">${b.amts.map(a=>`<button class="amt" data-a="qbAmt" data-v="${a}" aria-pressed="${a===Q.a}"${soldOut(b.id,a)?" disabled":""}>${card&&!b.labels?money(a):esc(optLabel(b,a))}${soldOut(b.id,a)?"<small>ausverkauft</small>":(!card||Math.abs(price(b,a)-a)>.004)?`<small>${money(price(b,a))}</small>`:""}</button>`).join("")}</div>`:""}
      <div class="qb-qty"><span class="lbl" id="qbQL">Menge</span><div class="qty" role="group" aria-labelledby="qbQL"><button data-a="qbQty" data-v="-1" aria-label="Weniger">−</button><span id="qbQ" aria-live="polite">${Q.q}</span><button data-a="qbQty" data-v="1" aria-label="Mehr">+</button></div></div>
      ${ckBrand()}<div class="pb-sum qb-sum" id="qbSum">${sumHTML()}</div>
      ${Q.a?xpBox("qbX",{fallback:true}):""}
      <div class="qb-acts"><button class="btn btn-soft btn-lg" data-a="qbBuy" id="qbBuyB"${dis}>${ic("i-card-f")}<span>Mit Karte zahlen</span></button><button class="btn btn-soft btn-lg" data-a="qbAdd"${dis}>${ic("i-cart")}<span>In den Warenkorb</span></button></div>
      ${trustBadges(b)}
      <a class="qb-more" href="/marke/${b.id}">${K?"Details und Aktivierung":"Details und Geschenkoption"}</a></div></div>`;
    qbX&&qbX.destroy();
    qbX=Q.a?xpayMount($("#qbX"),()=>Q.a?[{id:b.id,a:Q.a,q:Q.q}]:[],{ctx:"quick",fallback:true,doneIn:$("#sheet").firstElementChild,toKasse:()=>A.qbBuy(),
      onState:st=>{const p=$("#qbBuyB");if(p){p.classList.toggle("btn-primary",st==="none");p.classList.toggle("btn-soft",st!=="none")}}}):null;
    if(!qbX){const p=$("#qbBuyB");if(p){p.classList.add("btn-primary");p.classList.remove("btn-soft")}}
  };
  const upd=()=>{const q=$("#qbQ");if(q)q.textContent=Q.q;const sm=$("#qbSum"),t0=$("#qbTot"),old=t0?parseFloat(t0.dataset.v||"NaN"):NaN;
    if(sm){sm.innerHTML=sumHTML();const t=$("#qbTot");countUp(t,isFinite(old)?old:tot()+fee(),tot()+fee());t.dataset.v=tot()+fee();bumpEl(t)}
    const tg=$("#qbTag");if(tg){tg.textContent=tagTxt();tg.classList.remove("tick");void tg.offsetWidth;tg.classList.add("tick")}qbX&&qbX.refresh()};
  A.qbVar=v=>{b=byId(v);pick();draw()};
  A.qbAmt=(v,el)=>{const t=$("#qbTot");if(t)t.dataset.v=tot()+fee();Q.a=+v;$$("#sheet [data-a=qbAmt]").forEach(x=>x.setAttribute("aria-pressed",x===el));upd()};
  A.qbQty=v=>{const t=$("#qbTot");if(t)t.dataset.v=tot()+fee();Q.q=Math.max(1,Math.min(10,Q.q+ +v));upd()};
  /* In den Warenkorb: die Karte fliegt zum Warenkorb in der Kopfzeile */
  A.qbAdd=()=>{if(!Q.a)return;const src=$("#sheet .qb-float .gc"),it={id:b.id,a:Q.a,q:Q.q,type:"code"};
    const done=()=>{addCart(it,true);toast(`${b.name} im Warenkorb`,["/warenkorb","Ansehen"]);if(matchMedia("(min-width:768px)").matches)A.cartOpen()};
    closeSheet(true);qbX&&qbX.destroy();qbX=null;flyTo(src,$("#hcart"),{fade:true,ms:620}).then(done)};
  A.qbBuy=()=>{if(!Q.a)return;addCart({id:b.id,a:Q.a,q:Q.q,type:"code"},true);closeSheet(true);qbX&&qbX.destroy();qbX=null;go("/kasse")};
  pick();openSheet("",{wide:true,cls:"sh qbs"});draw();
  const t=$("#qbTot");if(t)t.dataset.v=tot()+fee();
};

/* ---------- Expresszahlung: Apple Pay, Google Pay, PayPal, Revolut Pay, Klarna, Amazon Pay, Link ----------
   Eine Box (xpBox) für Produktseite, Schnellkauf, Seiten-Warenkorb, Warenkorb und Kasse – überall gleich:
   Zustimmungszeile · Express-Knöpfe · Hinweis zur E-Mail · „oder mit Karte bezahlen“.
   Stripe Express Checkout Element: Apple Pay, Google Pay, PayPal, Klarna, Amazon Pay, Link (Reihenfolge XORD, nur in Stripe aktive).
   Revolut Pay kann das Element nicht: eigener Knopf direkt darunter, Weiterleitung zu Revolut (App oder QR-Code) und zurück.
   Ablauf Wallet: Zustimmung → Knopf → Wallet-Fenster liefert die E-Mail → /api/express/intent → Zahlung → Häkchen → Bestellseite.
   Klarna und Revolut Pay liefern keine geprüfte E-Mail: Klarna erscheint nur mit bestätigter E-Mail (und freigegebenen Kategorien),
   Revolut Pay führt Gäste zuerst zur E-Mail-Bestätigung in der Kasse.
   Zustände an data-st: load (Platzhalter glänzt) · ready · none (keine Expresszahlung: Hinweis oder ausblenden) · busy · done. */
let stripeP=null;
const loadStripe=()=>stripeP||(stripeP=new Promise((ok,no)=>{if(window.Stripe)return ok(window.Stripe(CFG.pk));const s=document.createElement("script");s.src="https://js.stripe.com/v3/";s.async=true;s.onload=()=>window.Stripe?ok(window.Stripe(CFG.pk)):no(new Error("Stripe nicht verfügbar"));s.onerror=()=>{stripeP=null;no(new Error("Stripe.js konnte nicht geladen werden"))};document.head.appendChild(s)}));
/* Heller Shop: Apple Pay und Google Pay in Schwarz (Richtlinien für hellen Grund) */
const isDark=()=>false;
/* Zustimmung (Pflicht, nie vorausgewählt): ausdrücklich sofort liefern + Kenntnis vom Erlöschen des Widerrufsrechts (§ 356 Abs. 5 BGB).
   Kompakt, die ganze Zeile ist tippbar. Ohne Haken öffnet kein Wallet-Knopf die Zahlung (Stripe: click ohne resolve). */
const XOK_TXT=`Ich stimme der <b>sofortigen Lieferung</b> zu und weiß, dass mein <a href="/widerruf">Widerrufsrecht</a> damit erlischt. Es gelten die <a href="/agb">AGB</a>.`;
const XOK_HINT="Bitte kurz bestätigen";
const walletNames=()=>{const n=WALLETS().filter(k=>PM[k]).map(k=>PM[k][0]);if(n.length>3)return n.slice(0,3).join(", ")+" und mehr";return n.length?(n.length>1?n.slice(0,-1).join(", ")+" oder "+n[n.length-1]:n[0]):"Apple Pay oder Google Pay"};
const XSKEL=`<div class="xpay-skel" aria-hidden="true"><i></i><i></i></div>`;
const xpMailTxt=()=>evMail()?`Codes gehen an <b>${esc(evMail())}</b>.`:`Codes gehen an die E-Mail aus deiner Wallet.`;
/* „oder mit Karte bezahlen“ unter den Express-Knöpfen; in der Kasse ein Knopf, der zum Kartenfeld springt */
const XCARD=o=>o&&o.cardBtn?`<button type="button" class="xpay-or xpay-cardor" data-a="ckToCard">oder mit Karte bezahlen</button>`:`<p class="xpay-or xpay-cardor">oder mit Karte bezahlen</p>`;
/* Gerüst für Produktseite, Schnellkauf, Seiten-Warenkorb und Kasse */
const xpBox=(id,o={})=>`<div class="xpay${o.compact?" xpay-c":""} locked" id="${id}" data-st="load">
  <label class="chk xpay-ok" data-c="1"><input type="checkbox" class="xok"><span>${XOK_TXT}</span></label><p class="xok-hint" aria-live="polite"></p>
  <div class="xpay-w">${XSKEL}<div class="xpay-btns"></div><div class="xpay-rv" hidden></div><button type="button" class="xpay-lock" aria-label="Bitte zuerst die Zustimmung bestätigen"></button></div>
  <p class="xpay-mail">${ic("i-mail")}<span>${xpMailTxt()} Der Wallet-Knopf bestellt zahlungspflichtig.</span></p>
  <p class="xpay-kl" hidden>${ic("i-receipt")}<span></span></p>
  <p class="xpay-none" hidden>${ic("i-wallet")}<span>Auf diesem Gerät ist gerade keine Expresszahlung eingerichtet. Zahl einfach mit Karte oder einer anderen Zahlungsart.</span></p>
  <div class="xpay-err" role="alert"></div>${o.noCard?"":XCARD(o)}</div>`;
/* Revolut Pay (eigener Knopf, Stripe leitet weiter): Zeichen plus Name, Name nie übersetzt, nicht fett (Revolut-Richtlinien) */
const rvBtn=()=>`<button type="button" class="xdb xrv" data-w="revolut_pay" aria-label="Bezahlen mit Revolut Pay"><img src="${markSrc("revolut")}" alt=""><em>Revolut Pay</em></button>`;
/* Erfolg: Häkchen erscheint über dem Bereich, dann geht es zur Bestellseite */
function paidFx(host,r){
  const url=`/bestellung/${r.id}?k=${encodeURIComponent(r.key)}`;
  if(host&&!reduce){host.classList.add("xpay-host");host.insertAdjacentHTML("beforeend",`<div class="xpay-done" role="status"><span class="okm" aria-hidden="true"><i class="okm-r"></i><i class="okm-r"></i>${ic("i-check")}</span><b>Bezahlt</b><small>Deine Codes werden vorbereitet …</small></div>`);
    /* im scrollenden Fenster: Häkchen genau im sichtbaren Ausschnitt */
    const sc=host.closest("#sheet"),d=host.lastElementChild;if(sc&&d){d.style.bottom="auto";d.style.top=Math.max(0,sc.scrollTop-host.offsetTop)+"px";d.style.height=Math.min(sc.clientHeight,host.offsetHeight)+"px"}}
  /* Der Seitenwechsel schließt Fenster und Seiten-Warenkorb selbst; mit View Transitions blendet „Bezahlt“ in die Bestellseite über */
  setTimeout(()=>go(url),host&&!reduce?1000:0);
}
function xpayMount(box,getItems,o={}){
  if(!box)return null;
  if(!CFG.express||!CFG.payments){box.hidden=true;if(o.onHide)o.onHide();return null}
  const btns=$(".xpay-btns",box),err=$(".xpay-err",box),w=$(".xpay-w",box);
  if(w&&!$(".xpay-skel",w))w.insertAdjacentHTML("afterbegin",XSKEL);
  if(btns&&!$(".xpay-rv",box))btns.insertAdjacentHTML("afterend",`<div class="xpay-rv" hidden></div>`);
  if(!$(".xpay-mail",box))err.insertAdjacentHTML("beforebegin",`<p class="xpay-mail">${ic("i-mail")}<span>${xpMailTxt()} Der Wallet-Knopf bestellt zahlungspflichtig.</span></p>`);
  if(!$(".xpay-cardor",box)&&!o.noCard)err.insertAdjacentHTML("afterend",XCARD(o));
  /* Noch nicht bereit (Produktseite: Geschenk ohne gültige Empfänger-Adresse): Knöpfe gesperrt, kurzer Hinweis */
  if(o.ready&&!$(".xpay-wait",box))err.insertAdjacentHTML("beforebegin",`<p class="xpay-wait">${ic("i-gift")}<span>${esc(o.readyMsg||"Gib zuerst die E-Mail-Adresse der beschenkten Person ein, dann kannst du mit der Wallet bezahlen.")}</span></p>`);
  let dead=false,elements=null,ece=null,quote=null,seq=0,st="load",stripe=null;
  const set=s=>{st=s;box.dataset.st=s;const nb=$(".xpay-none",box);if(nb)nb.hidden=s!=="none";
    if(s==="none"&&!o.fallback){box.hidden=true;if(o.onHide)o.onHide()}else vis();if(o.onState)o.onState(s)};
  const say=m=>{err.textContent=m||""};
  const ok=o.okEl||$(".xok",box),okL=ok&&ok.closest("label");
  /* Zeile vereinheitlichen (auch ältere Gerüste): kurzer Text, Hinweisfläche darunter */
  if(okL&&!okL.dataset.c){okL.dataset.c="1";const sp=$("span",okL);if(sp)sp.innerHTML=XOK_TXT;if(!$(".xok-hint",box))okL.insertAdjacentHTML("afterend",`<p class="xok-hint" aria-live="polite"></p>`)}
  const hint=$(".xok-hint",box);
  const lock=()=>box.classList.toggle("locked",!!ok&&!ok.checked);
  /* Tipp auf einen Wallet-Knopf ohne Haken: Zeile pulsiert kurz, bekommt den Fokus, leiser Hinweis – keine Zahlung */
  const nudge=()=>{say("");if(!okL)return;okL.classList.remove("ask");void okL.offsetWidth;okL.classList.add("ask");if(hint)hint.textContent=XOK_HINT;
    try{ok.focus({preventScroll:true})}catch(e){}const r=okL.getBoundingClientRect();if(r.top<72||r.bottom>innerHeight-8)okL.scrollIntoView({block:"center",behavior:reduce?"auto":"smooth"})};
  const ready=()=>!o.ready||o.ready();
  const waitNudge=()=>{const h=$(".xpay-wait",box);if(h){h.classList.remove("shake");void h.offsetWidth;h.classList.add("shake")}};
  if(ok){ok.addEventListener("change",()=>{lock();if(ok.checked){say("");if(okL)okL.classList.remove("ask");if(hint)hint.textContent=""}});lock()}
  const lk=$(".xpay-lock",box);lk&&lk.addEventListener("click",()=>ready()?nudge():waitNudge());
  const items=()=>getItems().filter(i=>i&&i.a);
  /* Klarna aktiv und alle Artikel freigegeben, aber E-Mail noch nicht bestätigt: kurzer Hinweis, wo es Klarna gibt */
  const klHint=()=>{const h=$(".xpay-kl",box);if(!h)return;const on=!!CFG.klarna&&!evMail()&&st!=="none"&&items().length>0&&items().every(i=>{const b=byId(i.id);return b&&CFG.klarna.includes(b.cat)});
    h.hidden=!on;if(on)$("span",h).textContent=o.ctx==="cart"&&/^\/(kasse|warenkorb)$/.test(cur.path)?"Klarna (Rechnung, Raten) erscheint hier, sobald deine E-Mail bestätigt ist. "+KL_WARN:"Klarna (Rechnung, Raten) gibt es nach der E-Mail-Bestätigung in der Kasse. "+KL_WARN};
  const vis=()=>{box.hidden=(st==="none"&&!o.fallback)||!items().length;box.classList.toggle("wait",!ready());klHint()};
  /* Preis ohne Geschenkdaten abfragen, solange die Empfänger-Adresse fehlt (der Betrag hängt nicht davon ab) */
  const getQuote=async()=>{const it=items().map(i=>ready()||!i.gift?i:Object.assign({},i,{gift:undefined}));if(!it.length)return null;const my=++seq;const q=await API("/quote",{method:"POST",body:{items:it}});return my===seq?q:quote};
  const remember=r=>{S.keys=Object.assign(S.keys||{},{[r.id]:r.key});if(o.ctx==="cart")S.cartOrder=r.id;save()};
  /* Bestellung anlegen: E-Mail aus der Wallet; der Server nimmt eine bestätigte E-Mail vorrangig. pm = gewählte Express-Zahlungsart */
  const intent=async(email,pm)=>{const r=await API("/express/intent",{method:"POST",body:{items:items(),email,pm,wallet:true,expect:quote&&quote.total,consent:!!(ok?ok.checked:o.consent)}});remember(r);if(email&&!S.user){S.lastEmail=email;save()}return r};
  const paid=r=>{set("done");if(o.onPaid)o.onPaid(r);else paidFx(o.doneIn||box,r)};
  /* Aktive Express-Zahlungsarten: Stripe-Einstellung (CFG.methods), Klarna nur mit bestätigter E-Mail und freigegebenen Kategorien */
  const has=k=>pmKeys().includes(k);
  const klOn=()=>!!evMail()&&!!CFG.klarna&&items().length>0&&items().every(i=>{const b=byId(i.id);return b&&CFG.klarna.includes(b.cat)});
  const rvOn=has("revolut_pay");
  /* Bestätigte E-Mail kommt beim Seitenstart nachgeladen; für Klarna vor dem Aufbau der Knöpfe abwarten */
  const evReady=!S.user&&!CFG.ev&&CFG.klarna?API("/checkout/email").then(j=>{if(j&&j.email&&!CFG.ev)CFG.ev=j.email}).catch(()=>{}):Promise.resolve();
  /* Revolut Pay: Zustimmung → (Gast: erst E-Mail bestätigen) → Bestellung → Weiterleitung zu Revolut → zurück zur Bestellseite */
  const rvBox=$(".xpay-rv",box);
  const rvGo=async()=>{
    if(!ready())return waitNudge();if(ok&&!ok.checked)return nudge();say("");
    if(!evMail()){toast("Für Revolut Pay bestätigst du kurz deine E-Mail – danach geht es direkt weiter.");return o.toKasse?o.toKasse():go("/kasse")}
    try{quote=await getQuote();if(!quote)return;set("busy");
      const r=await API("/express/intent",{method:"POST",body:{items:items(),pm:"revolut_pay",expect:quote.total,consent:!!(ok?ok.checked:o.consent)}});
      remember(r);if(r.redirect)return location.assign(r.redirect);
      const sp=await loadStripe(),{error}=await sp.handleNextAction({clientSecret:r.client_secret});if(error)throw error;go(`/bestellung/${r.id}?k=${encodeURIComponent(r.key)}`)}
    catch(x){set("ready");say(x.message)}};
  if(rvBox&&rvOn){rvBox.innerHTML=rvBtn();rvBox.hidden=false;rvBox.onclick=e=>{if(e.target.closest("[data-w]"))rvGo()}}
  vis();
  /* Vorschau ohne echtes Stripe: Express-Knöpfe und Wallet-Fenster werden simuliert (gleicher Server-Weg) */
  if(CFG.devpay){
    const XW={apple_pay:"Apple Pay",google_pay:"Google Pay",link:"Link",paypal:"PayPal",amazon_pay:"Amazon Pay",klarna:"Klarna"};
    const wl=WALLETS().length?WALLETS():["apple_pay","google_pay"];
    let painted="";
    const paint=()=>{const ws=XORD.filter(k=>XW[k]&&(k==="klarna"?klOn():wl.includes(k)));if(ws.join()===painted)return;painted=ws.join();
      btns.innerHTML=`<div class="xdev">${ws.map(k=>`<button type="button" class="xdb" data-w="${k}" aria-label="${k==="klarna"?"Bezahlen":"Kaufen"} mit ${XW[k]}">${k==="link"?`<b>link</b>`:`<span>${k==="klarna"?"Bezahlen":"Kaufen"} mit</span>${MARK[k]?`<img src="${markSrc(k)}" alt="">`:`<b>${XW[k]}</b>`}`}</button>`).join("")}</div>`};
    paint();evReady.then(()=>{if(!dead)paint()});
    setTimeout(()=>{if(!dead)set("ready")},reduce?0:380);
    btns.onclick=async e=>{const b=e.target.closest("[data-w]");if(!b)return;if(!ready())return waitNudge();if(ok&&!ok.checked)return nudge();say("");
      try{quote=await getQuote();if(!quote)return;const k=b.dataset.w,res=await xsim(XW[k],quote,(k==="klarna"&&evMail())||(S.user&&S.user.email)||S.lastEmail||"");if(!res)return;
        set("busy");const r=await intent(res.email,k);
        await fetch(`/__devpay/pi/${encodeURIComponent(r.client_secret.split("_secret_")[0])}/confirm?w=${k}&e=${encodeURIComponent(res.email)}${res.risky?"&risk=elevated":""}`,{method:"POST"});
        paid(r)}catch(x){set("ready");say(x.message)}};
    return {refresh:async()=>{vis();paint();try{quote=await getQuote()}catch(x){}},destroy(){dead=true}};
  }
  /* Keine Wallet im Element: mit Revolut Pay bleibt die Box nutzbar (nur dieser Knopf), sonst Hinweis bzw. ausblenden */
  const show=a=>{if(dead)return;box.classList.toggle("xpay-rvonly",!a&&rvOn);set(a||rvOn?"ready":"none")},none=()=>show(false);
  (async()=>{try{
    quote=await getQuote();await evReady;if(dead)return;if(!quote){set("none");return}
    if(!["apple_pay","google_pay","paypal","amazon_pay","link"].some(has)&&!klOn())return none();
    stripe=await loadStripe();if(dead)return;
    const kl=klOn(),auto=k=>has(k)?"auto":"never";
    elements=stripe.elements({mode:"payment",amount:quote.total,currency:"eur",locale:"de",appearance:APPEAR({borderRadius:"24px"})});
    const cmp=box.classList.contains("xpay-c");
    ece=elements.create("expressCheckout",{emailRequired:true,buttonHeight:44,layout:cmp?{maxColumns:3,maxRows:1,overflow:"auto"}:{maxColumns:2,maxRows:2,overflow:"auto"},
      paymentMethodOrder:XORD.filter(k=>k!=="revolut_pay"),
      paymentMethods:{applePay:auto("apple_pay"),googlePay:auto("google_pay"),paypal:auto("paypal"),amazonPay:auto("amazon_pay"),link:auto("link"),klarna:kl?"auto":"never"},
      buttonType:{applePay:"buy",googlePay:"buy",paypal:"buynow",klarna:"pay"},buttonTheme:{applePay:"black",googlePay:"black",paypal:"gold"}});
    const avail=m=>!!m&&Object.values(m).some(Boolean);
    ece.on("ready",e=>show(avail(e&&e.availablePaymentMethods)));
    /* je nach Stripe.js-Version gibt es diese Ereignisse; unbekannte dürfen das Einbinden nicht abbrechen */
    try{ece.on("availablepaymentmethodschange",e=>show(avail(e&&e.paymentMethods)))}catch(e){}
    try{ece.on("loaderror",none)}catch(e){}
    ece.on("click",ev=>{if(!ready())return waitNudge();if(ok&&!ok.checked)return nudge();say("");ev.resolve({emailRequired:true,lineItems:(quote?quote.lines:[]).map(l=>({name:l.label,amount:l.amount}))})});
    ece.on("confirm",async ev=>{say("");const fail=m=>{say(m);set("ready");try{ev.paymentFailed&&ev.paymentFailed({reason:"fail"})}catch(e){}};
      try{
        const {error:se}=await elements.submit();if(se)return fail(se.message);
        set("busy");
        const r=await intent(ev.billingDetails&&ev.billingDetails.email,ev.expressPaymentType);
        const {error}=await stripe.confirmPayment({elements,clientSecret:r.client_secret,confirmParams:{return_url:`${location.origin}/r/${r.id}?k=${encodeURIComponent(r.key)}`},redirect:"if_required"});
        if(error)return fail(error.message);
        paid(r);
      }catch(x){fail(x.message)}});
    ece.mount(btns);
    setTimeout(()=>{if(!dead&&st==="load")none()},12000);
  }catch(x){none()}})();
  return {async refresh(){vis();if(!elements||dead)return;try{quote=await getQuote();if(quote)elements.update({amount:quote.total})}catch(x){}},destroy(){dead=true;try{ece&&ece.destroy()}catch(e){}}};
}
/* Simuliertes Wallet-Fenster (nur Vorschau): zeigt Händler, Positionen, Summe und die E-Mail, die die Wallet übermittelt */
function xsim(name,q,mail){return new Promise(res=>{
  const prev=document.activeElement,el=document.createElement("div");el.className="xsim";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-labelledby","xsimH");
  el.innerHTML=`<div class="xsim-c"><span class="xsim-tag">Vorschau · simuliertes Wallet</span><h2 id="xsimH">${esc(name)}</h2>
   <ul class="xsim-l">${q.lines.map(l=>`<li><span>${esc(l.label)}</span><b>${eurc(l.amount)}</b></li>`).join("")}<li class="t"><span>instantcodes</span><b>${eurc(q.total)}</b></li></ul>
   <label class="lbl" for="xsimMail">E-Mail (gibt die Wallet frei)</label><input class="inp" id="xsimMail" type="email" autocomplete="email" value="${esc(mail)}" placeholder="name@beispiel.de"><div class="err" id="xsimErr" role="alert"></div>
   <button class="btn btn-primary btn-ink btn-lg btn-block" id="xsimPay">Bezahlen bestätigen</button>
   <div class="xsim-2"><button class="btn btn-soft" id="xsimNo">Abbrechen</button><button class="btn btn-ghost" id="xsimRisk">Mit erhöhtem Risiko</button></div></div>`;
  document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add("open"));
  const inp=$("#xsimMail",el);setTimeout(()=>(inp.value?$("#xsimPay",el):inp).focus(),60);
  const end=v=>{el.classList.remove("open");setTimeout(()=>el.remove(),reduce?0:260);prev&&prev.focus&&prev.focus({preventScroll:true});res(v)};
  const go2=risky=>{const m=inp.value.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(m)){$("#xsimErr",el).textContent="Bitte gib eine gültige E-Mail-Adresse ein.";inp.focus();return}end({email:m,risky})};
  $("#xsimPay",el).onclick=()=>go2(false);$("#xsimRisk",el).onclick=()=>go2(true);$("#xsimNo",el).onclick=()=>end(null);
  el.addEventListener("click",e=>{if(e.target===el)end(null)});el.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();end(null)}if(e.key==="Enter"&&e.target===inp)go2(false);
    if(e.key==="Tab"){e.stopPropagation();const f=focusables(el),i=f.indexOf(document.activeElement);if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}}});
})}
