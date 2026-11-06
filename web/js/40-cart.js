/* ---------- Warenkorb und Kasse (Chrome & Glas) ----------
   Aufbau: Kopf mit Fortschritt (Warenkorb › E-Mail › Bezahlen als feine Chrom-Linie) ·
   links die Artikel als Glaszeilen, Aktionscode, darunter die Schritte E-Mail und Bezahlen ·
   rechts die Übersicht als Glas-Säule (Desktop: mitlaufend) mit der Summe groß in Chrom.
   Auf dem Handy: Artikel › Aktionscode › Übersicht › E-Mail › Bezahlen. */
const lineHref=b=>b.cat==="topup"?`/aufladen?op=${b.id}`:`/marke/${b.id}`;
const lineHTML=i=>{const b=byId(i.id),h=lineHref(b),sub=[optLabel(b,i.a),i.phone,i.gift&&"Geschenk an "+i.gift.to].filter(Boolean).map(esc).join(" · ");
  return `<div class="line" data-k="${esc(i.k)}"><a class="line-card" href="${h}" tabindex="-1" aria-hidden="true">${mini(b)}</a>
  <div class="line-info"><a class="line-name" href="${h}">${esc(b.name)}</a><small>${sub}</small></div>
  <b class="line-sum">${money(lineTotal(i))}</b>
  <div class="line-ctl"><div class="qty" role="group" aria-label="Menge"><button data-a="cq" data-v="${i.k}|-1" aria-label="Weniger"${i.q<=1?" disabled":""}>−</button><span>${i.q}</span><button data-a="cq" data-v="${i.k}|1" aria-label="Mehr"${i.q>=10?" disabled":""}>+</button></div>
  <button class="line-rm" data-a="crm" data-v="${i.k}" aria-label="${esc(b.name)} entfernen">${ic("i-trash")}</button></div></div>`};
/* Fortschritt: Warenkorb › E-Mail › Bezahlen. --p füllt die Chrom-Linie bis zum aktuellen Schritt */
const ckProg=st=>{const s=(n,t)=>{const c=n<st?"done":n===st?"now":"";return `<li class="${c}"${n===st?' aria-current="step"':""}><span class="ck-pd" aria-hidden="true">${n<st?ic("i-check"):""}</span><span class="ck-pl">${t}</span></li>`};
  return `<ol class="ck-prog" style="--p:${st>=3?1:.5}" aria-label="Fortschritt der Bestellung">${s(1,"Warenkorb")}${s(2,"E-Mail")}${s(3,"Bezahlen")}</ol>`};
const ckStepH=(n,st,t)=>`<h2 class="ck-step-h"><span class="ck-n${n<st?" done":n===st?" now":""}" aria-hidden="true">${n<st?ic("i-check"):n}</span><span>${t}</span></h2>`;
/* Leerer Warenkorb: schwebender Kartenfächer und Wege zurück ins Sortiment */
function ckEmpty(){
  const pop=POP.map(byId).filter(Boolean),fan=pop.slice(0,3),recent=S.recent.map(byId).filter(Boolean).filter(isRep).slice(0,10);
  const cats=["gaming","entertainment","keys"].filter(id=>VIS().some(b=>b.cat===id)).map(catById);
  const last=Object.keys(S.keys||{}).filter(id=>/^IC-/.test(id)).pop();
  return `<div class="ck-void">
 <section class="ck-empty">
  <div class="ck-fan" data-off aria-hidden="true">${fan.map((b,i)=>`<span class="ck-fc" style="--i:${i}"><i>${gc(b,{tilt:false,badge:false,plat:false})}</i></span>`).join("")}</div>
  <h1 class="ck-empty-h">Dein Warenkorb ist leer</h1>
  <p class="ck-empty-p">Entdecke Gutscheine, Spielguthaben und Handy-Guthaben. Nach der Zahlung kommt dein Code meist in Sekunden per E-Mail.</p>
  <div class="ck-empty-a"><button class="btn btn-primary btn-lg" data-a="browse">Jetzt stöbern</button><a class="btn btn-soft btn-lg" href="/aufladen">${ic("i-phone-f")}Handy aufladen</a></div>
  <nav class="ck-empty-c" aria-label="Kategorien">${cats.map(c=>`<a class="chip" href="/kategorie/${c.id}">${esc(c.name)}</a>`).join("")}<a class="chip" href="/angebote">Angebote</a></nav>
  ${last?`<a class="ck-last" href="/bestellung/${esc(last)}?k=${encodeURIComponent(S.keys[last])}">${ic("i-receipt")}Letzte Bestellung ansehen</a>`:""}
 </section>
 ${recent.length?`<section class="sec">${secHead("Zuletzt angesehen","",railNav("cartRecent"))}${rail("cartRecent",recent)}</section>`:""}
 <section class="sec">${secHead("Beliebt","",railNav("cartRail"))}${rail("cartRail",pop)}</section></div>`;
}
function cartPage(_,qs){
  if(qs&&qs.get&&qs.get("abgebrochen"))setTimeout(()=>toast("Zahlung abgebrochen – es wurde nichts abgebucht. Dein Warenkorb ist noch da."),350);
  if(!S.cart.length)return {title:"Warenkorb",html:ckEmpty()};
  const t=cur.path==="/kasse"?"Kasse":"Warenkorb",m=evMail(),x=CFG.express&&m,st=m?3:2;
  return {title:t,html:`<div class="ck sec" data-step="${st}">
 <header class="ck-head"><div class="ck-head-t"><h1 class="ck-title">${t}</h1><p class="ck-sub"><span id="cartN">${cartCount()}</span> Artikel. Deine Codes kommen per E-Mail.</p></div>${ckProg(st)}</header>
 <div class="ck-grid">
  <section class="ck-items" aria-labelledby="ckItH"><h2 class="sr" id="ckItH">Artikel im Warenkorb</h2>
   <div class="ck-lines" id="cartLines">${S.cart.map(lineHTML).join("")}</div>
   <div class="ck-promo" id="promoBox" data-on="${!!S.promo}">${promoHTML()}</div>
  </section>
  <aside class="ck-side" aria-labelledby="ckSumH"><div class="ck-col chrome-rim" id="ckSum">
   <h2 class="ck-col-h" id="ckSumH">Übersicht</h2>
   <div class="pb-sum" id="sumBox">${paySum()}</div>
   <ul class="ck-assure"><li>${ic("i-zap")}<span>Code meist in Sekunden per E-Mail und auf der Bestellseite</span></li><li>${ic("i-lock")}<span>Sichere Zahlung über Stripe</span></li><li>${ic("i-mail")}<span>Persönlicher Support per E-Mail</span></li></ul>
   ${payLogos()}
  </div></aside>
  <section class="ck-pay" id="payBox" aria-label="E-Mail und Bezahlen">
   <div class="ck-step" id="ckMail">${ckStepH(2,st,"E-Mail für deine Codes")}${evBox()}</div>
   <div class="ck-step" id="ckPay">${ckStepH(3,st,"Bezahlen")}
    <label class="chk pb-ok" id="payOkL"><input type="checkbox" id="payOk"><span>Ich akzeptiere die <a href="/agb">AGB</a> und habe die <a href="/datenschutz">Datenschutzerklärung</a> gelesen. Ich stimme der sofortigen Lieferung zu und weiß, dass mein <a href="/widerruf">Widerrufsrecht</a> damit erlischt.</span></label>
    ${x?`${xpayBox("cX","",{noConsent:true})}<div class="xpay-or pay-or" id="payOr">oder</div>`:""}
    <div class="pb-more" id="payMoreW"${x?"":" hidden"}><button type="button" class="paymore" data-a="payMore" aria-controls="payElW" aria-expanded="false"><span class="si-ic">${ic("i-card-f")}</span><span class="pm-t"><b>Andere Zahlungsart</b><small>${klarnaCart()?"Karte, Klarna und mehr":"Karte, Link und mehr"}</small></span>${ic("i-down")}</button></div>
    <div class="pb-el" id="payElW"${x?" hidden":""}>
     <div id="payEl" class="payel"><div class="payel-load"><span class="spin"></span>Zahlungsfeld wird geladen …</div></div>
     <div class="pb-due"><span>Gesamt</span><b id="payDue">${money(grandTotal())}</b></div>
     <div class="err" id="payErr" role="alert"></div>
     <button class="btn btn-primary btn-lg btn-block" id="payBtn" data-a="payNow" data-off>${ic("i-lock")}<span>Zahlungspflichtig bestellen</span></button>
    </div>
    <p class="pb-fine">${ic("i-shield")}<span>Bezahlt wird sicher über Stripe. Deine Kartendaten landen nie bei uns.${CFG.payments&&!CFG.devpay?` <button class="more" data-a="payRedirect">Lieber auf der Stripe-Seite bezahlen</button>`:""}</span></p>
   </div>
  </section>
 </div></div>`,after:payAfter};
}
/* Aktionscode: einklappbar, aktiver Code mit Entfernen */
const promoHTML=()=>S.promo?`<div class="ck-promo-on">${ic("i-tag")}<span><b>WILLKOMMEN10</b><small>10 % Rabatt ist aktiv</small></span><button class="btn btn-ghost" data-a="promoRm">Entfernen</button></div>`
  :`<details class="ck-promo-d"><summary>${ic("i-tag")}<span>Aktionscode einlösen</span>${ic("i-down")}</summary><div class="ck-promo-f"><input class="inp" id="promo" placeholder="z. B. WILLKOMMEN10" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Aktionscode" aria-describedby="promoErr"><button class="btn btn-soft" data-a="promo">Einlösen</button></div><div class="err" id="promoErr" role="alert"></div></details>`;
/* E-Mail-Bestätigung vor der Zahlung (Pflicht). Der Code wird in sechs Feldern angezeigt;
   darüber liegt unsichtbar ein echtes Eingabefeld (Einfügen, Autofill „one-time-code“, Screenreader). */
const evMail=()=>(S.user&&S.user.verified!==false&&S.user.email)||CFG.ev||null;
function evBox(){
  const m=evMail();
  if(m)return `<div class="ck-evok" id="evBox"><span class="ck-evok-i">${ic("i-mail")}</span><div><small>Codes gehen an</small><b>${esc(m)}</b></div>${S.user?"":`<button class="btn btn-ghost" data-a="evChange">Ändern</button>`}</div>`;
  return `<div class="ck-ev" id="evBox"><p class="ck-ev-t">Wir schicken dir einen 6-stelligen Code. An diese Adresse kommen auch deine Codes. Gelegentlich empfehlen wir dir dort ähnliche Produkte – dem kannst du jederzeit widersprechen.</p>
   <div class="ck-ev-row"><input class="inp" id="payMail" type="email" autocomplete="email" inputmode="email" aria-label="E-Mail für deine Codes" placeholder="deine@email.de" value="${esc(S.lastEmail||"")}"><button class="btn btn-soft" data-a="evSend" id="evSendB">Code senden</button></div>
   <div class="ck-ev-code" id="evCodeW" hidden><label class="ck-ev-l" for="evCode">Code aus der E-Mail</label>
    <div class="ck-otp"><span class="ck-cells" aria-hidden="true">${"<i></i>".repeat(6)}</span><input class="inp evcode" id="evCode" aria-describedby="evErr" inputmode="numeric" autocomplete="one-time-code" maxlength="40"></div>
    <button class="btn btn-primary btn-block ck-ev-go" data-a="evCheck">Bestätigen</button>
    <p class="ck-ev-hint">Keine E-Mail? Schau im Spam-Ordner oder <button class="more" data-a="evSend">sende den Code erneut</button>.</p></div>
   <div class="err" id="evErr" role="alert"></div></div>`;
}
/* Sechs Felder spiegeln das unsichtbare Eingabefeld; das nächste freie Feld zeigt den Cursor */
const otpSync=inp=>{const w=inp&&inp.closest(".ck-otp");if(!w)return;const v=inp.value,cur=document.activeElement===inp?Math.min(v.length,5):-1;
  $$(".ck-cells i",w).forEach((c,i)=>{const d=v[i]||"";if(c.textContent!==d){c.textContent=d;c.classList.toggle("on",!!d)}c.classList.toggle("cur",i===cur)})};
const otpBad=on=>{const w=$(".ck-otp");if(!w)return;w.classList.remove("bad");if(on){void w.offsetWidth;w.classList.add("bad")}};
A.evSend=async(_,el)=>{
  const m=(($("#payMail")||{}).value||"").trim().toLowerCase(),err=$("#evErr");err.textContent="";
  if(!/^\S+@\S+\.\S+$/.test(m)){err.textContent="Bitte gib eine gültige E-Mail-Adresse ein.";$("#payMail").focus();return}
  busy(el,true," Senden …");
  let ok=false;try{await API("/checkout/email/send",{method:"POST",body:{email:m}});ok=true}catch(x){err.textContent=x.message}
  busy(el,false);
  if(ok){S.lastEmail=m;save();$("#evCodeW").hidden=false;$("#evSendB").textContent="Neu senden";toast(`Code an ${m} geschickt`);setTimeout(()=>{const c=$("#evCode");c&&c.focus()},50)}
};
A.evCheck=async(_,el)=>{
  const m=(($("#payMail")||{}).value||"").trim().toLowerCase(),code=(($("#evCode")||{}).value||"").replace(/\D/g,""),err=$("#evErr");err.textContent="";
  if(code.length!==6){err.textContent="Bitte gib den 6-stelligen Code ein.";otpBad(true);return}
  if(el.disabled)return;busy(el,true," Prüfe …");
  try{const r=await API("/checkout/email/verify",{method:"POST",body:{email:m,code}});CFG.ev=r.email;toast("E-Mail bestätigt");route(true)}
  catch(x){err.textContent=x.message;otpBad(true);busy(el,false)}
};
A.evChange=()=>{CFG.ev=null;route(true)};
document.addEventListener("input",e=>{if(e.target.id==="evCode"){e.target.value=e.target.value.replace(/\D/g,"").slice(0,6);otpBad(false);otpSync(e.target);if(e.target.value.length===6){const b=document.querySelector('[data-a="evCheck"]');b&&!b.disabled&&b.click()}}});
["focusin","focusout"].forEach(t=>document.addEventListener(t,e=>{if(e.target&&e.target.id==="evCode")setTimeout(()=>otpSync(e.target))}));
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target&&e.target.id==="promo"){e.preventDefault();A.promo()}});
const paySum=()=>`<div class="sumrow"><span>Zwischensumme</span><span>${money(subTotal())}</span></div>${S.promo?`<div class="sumrow ok"><span>Rabatt (10 %)</span><span>−${money(promoAmt())}</span></div>`:""}${feeAmt()?`<div class="sumrow"><span>Servicegebühr <small>pro Bestellung</small></span><span>${money(feeAmt())}</span></div>`:""}<div class="sumrow tot"><span>Gesamt</span><span>${money(grandTotal())}</span></div>${vatRow()}`;
/* Warenkorb ohne Neuladen aktualisieren, damit eingegebene Kartendaten erhalten bleiben */
function payRefresh(){
  if(!S.cart.length)return route(true);
  const set=(sel,h)=>{const e=$(sel);if(e)e.innerHTML=h};
  set("#cartLines",S.cart.map(lineHTML).join(""));set("#sumBox",paySum());
  const pb=$("#promoBox");if(pb&&pb.dataset.on!==String(!!S.promo)){pb.innerHTML=promoHTML();pb.dataset.on=String(!!S.promo)}
  const n=$("#cartN");if(n)n.textContent=cartCount();const d=$("#payDue");if(d)d.textContent=money(grandTotal());
  /* Summe glänzt kurz auf, damit die Änderung sichtbar wird */
  const tot=$("#sumBox .sumrow.tot");if(tot&&!reduce){tot.classList.remove("ck-tick");void tot.offsetWidth;tot.classList.add("ck-tick")}
  if(PAY&&PAY.elements)try{PAY.elements.update({amount:Math.round(grandTotal()*100)})}catch(e){}
  if(PAY&&PAY.x)PAY.x.refresh();
}
/* Eingebettetes Stripe-Zahlungsfeld (Payment Element) – in der Vorschau ein Test-Kartenfeld */
let PAY=null;
/* Stripe-Erscheinungsbild „Chrome & Glas“ – eine Quelle für Zahlungsfeld und Expresszahlung (o ersetzt einzelne Variablen, z. B. den Radius).
   Felder sind dunkle Mulden, der gewählte Reiter ist hell wie Chrom. Geist kann Stripe nicht laden; dann greift die Systemschrift. */
const APPEAR=(o={})=>({theme:"night",variables:Object.assign({colorPrimary:"#DCCBFF",colorBackground:"#17181C",colorText:"#F2F3F5",colorTextSecondary:"#AAAEB8",colorTextPlaceholder:"#7E7E86",colorDanger:"#FF7A86",colorSuccess:"#9FF0D2",colorWarning:"#FFCB7A",colorIcon:"#AAAEB8",
    borderRadius:"15px",spacingUnit:"4px",fontFamily:"Geist,-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,Helvetica,Arial,sans-serif",fontSizeBase:"16px",fontWeightNormal:"450",fontWeightMedium:"550",focusOutline:"none",focusBoxShadow:"0 0 0 4px rgba(220,203,255,.18)"},o),
  rules:{".Input":{border:"none",backgroundColor:"#16171B",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.1),inset 0 2px 6px rgba(0,0,0,.35)",padding:"14px 16px"},".Input:hover":{boxShadow:"inset 0 0 0 1px rgba(255,255,255,.16),inset 0 2px 6px rgba(0,0,0,.35)"},
    ".Input:focus":{backgroundColor:"#1B1D22",boxShadow:"inset 0 0 0 1.5px #C9AAFF,0 0 0 4px rgba(201,170,255,.16)"},".Input--invalid":{boxShadow:"inset 0 0 0 1.5px #FF7A86,0 0 0 4px rgba(255,122,134,.15)"},
    ".Tab":{border:"none",backgroundColor:"#1B1D22",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.1)"},".Tab:hover":{color:"#F2F3F5",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.18)"},
    ".Tab--selected":{backgroundColor:"#ECEEF1",color:"#0D0E11",boxShadow:"inset 0 1px 0 #FFFFFF,0 0 0 1px rgba(255,255,255,.5)"},".TabLabel--selected":{color:"#0D0E11"},".TabIcon--selected":{fill:"#0D0E11"},
    ".AccordionItem":{border:"none",backgroundColor:"#1B1D22",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.1)"},".Block":{backgroundColor:"#1B1D22",boxShadow:"inset 0 0 0 1px rgba(255,255,255,.1)"},".Label":{fontWeight:"550",color:"#AAAEB8"},".Error":{color:"#FF7A86"}}});
async function payAfter(){
  PAY={};
  if(CFG.express)PAY.x=xpayMount($("#cX"),cartItems,{ctx:"cart",okEl:$("#payOk"),onHide:()=>{const o=$("#payOr");if(o)o.hidden=true;if(evMail())A.payMore()}});
  const ok=$("#payOk");ok&&ok.addEventListener("change",()=>{if(ok.checked){const e=$("#payErr");if(e)e.textContent="";$("#payOkL").classList.remove("shake")}});
  PAY.mount=()=>{if(PAY.mounted)return;PAY.mounted=1;payMount()};
  if(!$("#payElW")||!$("#payElW").hidden)PAY.mount();
  /* Von „Zur Kasse“ kommend: auf dem Handy direkt zur Übersicht, darunter E-Mail und Bezahlen */
  if(cur.path==="/kasse"&&scrollY<10&&innerWidth<980)setTimeout(()=>{const b=$("#ckSum");if(b&&b.getBoundingClientRect().top>innerHeight*.5)b.scrollIntoView({block:"start",behavior:reduce?"auto":"smooth"})},140);
}
A.payMore=()=>{const w=$("#payElW"),m=$("#payMoreW");if(!w)return;w.hidden=false;if(m)m.hidden=true;w.classList.add("open");PAY&&PAY.mount&&PAY.mount();setTimeout(()=>w.scrollIntoView({block:"nearest",behavior:reduce?"auto":"smooth"}),60)};
async function payMount(){
  const box=$("#payEl");if(!box)return;
  if(!CFG.payments){box.innerHTML=`<p>Zahlungen sind noch nicht eingerichtet.</p>`;return}
  if(CFG.devpay){PAY.dev=true;box.innerHTML=`<div class="devcard"><label class="lbl" for="dcNum">Kartennummer</label><div class="dc-num">${ic("i-card-f")}<input class="inp" id="dcNum" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242"></div>
    <div class="row2"><div><label class="lbl" for="dcExp">Ablaufdatum</label><input class="inp" id="dcExp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM / JJ"></div><div><label class="lbl" for="dcCvc">Prüfnummer</label><input class="inp" id="dcCvc" inputmode="numeric" autocomplete="cc-csc" placeholder="CVC"></div></div></div>`;
    const n=$("#dcNum");n.addEventListener("input",()=>{n.value=n.value.replace(/\D/g,"").slice(0,16).replace(/(\d{4})(?=\d)/g,"$1 ")});const x=$("#dcExp");x.addEventListener("input",()=>{const v=x.value.replace(/\D/g,"").slice(0,4);x.value=v.length>2?v.slice(0,2)+" / "+v.slice(2):v});return}
  try{
    const stripe=await loadStripe();if(!box.isConnected)return;
    const elements=stripe.elements({mode:"payment",amount:Math.round(grandTotal()*100),currency:"eur",paymentMethodTypes:(CFG.inline||["card"]).concat(klarnaCart()?["klarna"]:[]),locale:"de",appearance:APPEAR()});
    const pe=elements.create("payment",{layout:{type:"tabs",defaultCollapsed:false},wallets:{applePay:"never",googlePay:"never"},fields:{billingDetails:{email:"never"}},terms:{card:"never"}});
    box.innerHTML="";pe.mount(box);Object.assign(PAY,{stripe,elements,pe});
  }catch(x){box.innerHTML=`<p>Das Zahlungsfeld konnte nicht geladen werden. Du kannst auf der sicheren Stripe-Seite bezahlen.</p>`;PAY.fail=true}
}
const klarnaCart=()=>!!CFG.klarna&&S.cart.length>0&&S.cart.every(i=>{const b=byId(i.id);return b&&CFG.klarna.includes(b.cat)});
const payMail=()=>evMail()||"";
/* Hinweis sichtbar machen: kurz schütteln und in den Blick holen */
const ckNudge=el=>{if(!el)return;el.classList.remove("shake");void el.offsetWidth;el.classList.add("shake");el.scrollIntoView({block:"center",behavior:reduce?"auto":"smooth"})};
A.payNow=async(_,el)=>{
  const err=$("#payErr");err.textContent="";
  if($("#payElW")&&$("#payElW").hidden){A.payMore();return}
  const email=payMail();
  if(!email){err.textContent="Bitte bestätige zuerst deine E-Mail-Adresse mit dem Code.";ckNudge($("#evBox"));const m=$("#payMail");m&&m.focus({preventScroll:true});return}
  if(!$("#payOk").checked){err.textContent="Bitte bestätige die AGB und die sofortige Lieferung.";ckNudge($("#payOkL"));return}
  if(!CFG.payments){err.textContent="Zahlungen sind noch nicht eingerichtet.";return}
  if(!PAY||PAY.fail)return A.payRedirect(_,el);
  if(!S.user){S.lastEmail=email;save()}
  const body={items:cartItems(),email,promo:S.promo?"WILLKOMMEN10":"",consent:true,expect:Math.round(grandTotal()*100)};
  busy(el,true," Zahlung läuft …");
  const fail=m=>{err.textContent=m;busy(el,false)};
  try{
    if(PAY.dev){
      if($("#dcNum").value.replace(/\D/g,"").length<16)return fail("Bitte gib eine Kartennummer ein (Vorschau: 4242 4242 4242 4242).");
    }else{const {error}=await PAY.elements.submit();if(error)return fail(error.message)}
    let r;try{r=await API("/pay/intent",{method:"POST",body})}catch(x){if(/Rabattcode/.test(x.message)){S.promo=0;save();payRefresh()}return fail(x.message)}
    S.keys=Object.assign(S.keys||{},{[r.id]:r.key});S.cartOrder=r.id;save();
    if(PAY.dev){const risky=$("#dcNum").value.replace(/\D/g,"")==="4000000000009235";/* wie Stripes Testkarte für erhöhtes Risiko */
      await fetch(`/__devpay/pi/${encodeURIComponent(r.client_secret.split("_secret_")[0])}/confirm${risky?"?risk=elevated":""}`,{method:"POST"});go(`/bestellung/${r.id}?k=${encodeURIComponent(r.key)}`);return}
    const {error}=await PAY.stripe.confirmPayment({elements:PAY.elements,clientSecret:r.client_secret,confirmParams:{return_url:r.return_url,payment_method_data:{billing_details:{email}}},redirect:"if_required"});
    if(error)return fail(error.type==="card_error"||error.type==="validation_error"?error.message:"Die Zahlung hat nicht geklappt. Bitte versuch es noch einmal oder nimm eine andere Zahlungsart.");
    go(`/bestellung/${r.id}?k=${encodeURIComponent(r.key)}`);
  }catch(x){fail(x.message)}
};
const cartItems=()=>S.cart.map(i=>({id:i.id,a:i.a,q:i.q,phone:i.phone,gift:i.gift}));
/* Nach dem Neuzeichnen den Fokus auf denselben Knopf zurücksetzen (Tastatur, Screenreader) */
const cartChanged=()=>{const f=document.activeElement,fa=f&&f.dataset&&f.dataset.a,fv=f&&f.dataset&&f.dataset.v,inDr=!!(f&&f.closest&&f.closest("#drawer"));
  save();updBadges();if($("#drawer").classList.contains("open"))A.cartOpen();if(/^\/(warenkorb|kasse)$/.test(cur.path)){if($("#payBox"))payRefresh();else route(true)}
  if(fa==="cq"){const n=$(`${inDr?"#drawer":"#cartLines"} [data-a="cq"][data-v="${fv}"]`);if(n&&!n.disabled)n.focus({preventScroll:true});else{const q=n&&n.parentNode.querySelector("button:not([disabled])");q&&q.focus({preventScroll:true})}}};
A.cq=v=>{const p=v.split("|"),i=S.cart.find(x=>x.k===p[0]);if(!i)return;i.q=Math.max(1,Math.min(10,i.q+ +p[1]));cartChanged()};
/* Entfernen: die Glaszeile gleitet kurz weg, dann wird neu gezeichnet; der Fokus landet auf der nächsten Zeile */
A.crm=(k,el)=>{const ln=el&&el.closest(".line");if(ln&&ln.classList.contains("out"))return;
  const idx=S.cart.findIndex(x=>x.k===k),box=ln&&ln.closest("#cartLines,#drawer");
  const done=()=>{S.cart=S.cart.filter(x=>x.k!==k);cartChanged();toast("Artikel entfernt");
    if(box&&box.isConnected){const rm=$$("[data-a=crm]",box),n=rm[Math.min(idx,rm.length-1)];n&&n.focus({preventScroll:true})}};
  if(ln&&!reduce&&S.cart.length>1){ln.classList.add("out");setTimeout(done,260)}else done()};
A.promo=()=>{const i=$("#promo"),e=$("#promoErr"),v=((i||{}).value||"").trim().toUpperCase();if(!i)return;e.textContent="";i.classList.remove("bad");
  if(v==="WILLKOMMEN10"){S.promo=.1;save();if($("#payBox"))payRefresh();else route(true);toast("Rabatt angewendet: 10 %")}
  else{e.textContent=v?"Dieser Code ist nicht gültig. Probiere WILLKOMMEN10.":"Bitte gib einen Aktionscode ein.";i.classList.add("bad");i.focus()}};
A.promoRm=()=>{S.promo=0;save();if($("#payBox"))payRefresh();else route(true);toast("Aktionscode entfernt")};
