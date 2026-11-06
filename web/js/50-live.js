/* ---------- LIVE: echte Server-Anbindung ---------- */
const STL={awaiting_payment:"Warte auf Zahlung",payment_pending:"Zahlung in Bearbeitung",processing:"In Bearbeitung",delivered:"Geliefert",canceled:"Storniert",refunded:"Erstattet"};
let CFG=Object.assign({payments:false,google:null,support:"support@instacode.store"},BOOT.config||{}),pollT=null,lastResend=0;const ordCache={};
async function API(p,o={}){
  const r=await fetch("/api"+p,{method:o.method||"GET",headers:{"Content-Type":"application/json","X-IC":"1"},body:o.body?JSON.stringify(o.body):undefined,credentials:"same-origin"});
  let j={};try{j=await r.json()}catch(e){}
  if(!r.ok)throw new Error(j.error||"Verbindung fehlgeschlagen. Bitte versuch es erneut.");
  return j;
}
const eurc=c=>money((c||0)/100);
const mask=c=>"•••• •••• •••• "+String(c).slice(-4);
const stBadge=s=>`<span class="ostat" data-s="${esc(s)}">${esc(STL[s]||s)}</span>`;
const brandOr=id=>byId(id)||{bg:"#0B0D1C",fg:"#fff",ini:"?",name:id};
function setUser(u){S.user=u?{name:u.name||u.email.split("@")[0],email:u.email,provider:u.google?"google":"email",loginAlerts:!!u.loginAlerts}:null;save();renderAcc()}
function busy(el,on,label){if(!el)return;if(on){el.dataset.t=el.innerHTML;el.innerHTML=`<span class="spin" style="display:inline-block;width:18px;height:18px;border-width:2.5px;margin:0"></span>${label||""}`;el.disabled=true}else if(el.dataset.t){el.innerHTML=el.dataset.t;el.disabled=false}}
function boot(){
  $("#testbar").hidden=!(CFG.testmode&&CFG.payments);
  $$("[data-paytext]").forEach(e=>e.textContent=payNames());
  const kb=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent)?"⌘ K":"Strg K";$$(".kbdk").forEach(k=>k.textContent=kb);
  const start=()=>{route();API("/me").then(m=>{const had=!!S.user;setUser(m.user);if(had!==!!m.user||/^\/(konto|kasse|login)/.test(cur.path))route(true)}).catch(()=>{})};
  if(BRANDS.length){API("/checkout/email").then(ev=>{const e=ev&&ev.email||null;if(e!==(CFG.ev||null)){CFG.ev=e;if(/^\/(kasse|warenkorb)/.test(cur.path))route(true)}}).catch(()=>{});return start()}
  Promise.all([API("/catalog"),API("/config"),API("/stock"),API("/checkout/email").catch(()=>({}))]).then(([c,f,st,ev])=>{setCatalog(c.products);cleanCart();CFG=Object.assign(CFG,f);CFG.ev=ev&&ev.email||null;STOCK=st;start()}).catch(()=>start());
}
/* Anmelde-Karte: ruhiges Glas, zwei Karten schweben dahinter */
const authCard=(title,text,inner)=>`<section class="au"><div class="au-wrap">${stage(["apple","spotify"],"au-stage")}<div class="card au-card rv">${LOGO(48)}<h1 class="au-h">${title}</h1>${text?`<p class="au-p">${text}</p>`:""}${inner}</div></div></section>`;

/* Login + Registrierung */
function apiLogin(_,qs){
  if(S.user)return apiAccount();
  const reg=qs.get("m")==="reg",r=qs.get("r")||"/konto",rq=encodeURIComponent(r),a=CFG.auth||{};
  return {title:reg?"Konto erstellen":"Anmelden",html:authCard(reg?"Konto erstellen":"Willkommen zurück",reg?"Bestellungen, Codes und Favoriten an einem Ort.":"Melde dich an, um deine Bestellungen und Codes zu sehen.",`
   <nav class="au-seg" aria-label="Anmelden oder registrieren"><a href="/login?r=${rq}"${reg?"":' aria-current="page"'}>Anmelden</a><a href="/login?m=reg&r=${rq}"${reg?' aria-current="page"':""}>Konto erstellen</a></nav>
   ${quickAuth(r)}
   <form class="au-form" novalidate>
   ${reg?`<label class="lbl" for="aName">Name</label><input class="inp" id="aName" autocomplete="name" placeholder="Vor- und Nachname">`:""}
   <label class="lbl" for="aMail">E-Mail</label><input class="inp" id="aMail" type="email" autocomplete="email" inputmode="email" placeholder="name@beispiel.de" value="${esc(S.pendingEmail||"")}">
   <label class="lbl" for="aPw">Passwort</label><div class="au-pw"><input id="aPw" type="password" autocomplete="${reg?"new-password":"current-password"}" placeholder="${reg?"Mindestens 8 Zeichen":"Dein Passwort"}"><button type="button" class="au-eye" data-a="pwToggle" aria-label="Passwort anzeigen" aria-pressed="false">${ic("i-eye")}</button></div>
   <div class="err" id="aErr" role="alert"></div>
   <button type="submit" class="btn btn-primary btn-lg btn-block" data-a="emailAuth" data-v="${reg?"reg":"login"}|${esc(r)}" data-off>${reg?"Konto erstellen":"Anmelden"}</button>
   </form>
   ${a.code?`<div class="au-or">oder</div><button class="btn btn-soft btn-block" data-a="codeLogin" data-v="${esc(r)}">${ic("i-mail")}Ohne Passwort: Code per E-Mail</button>`:""}
   ${reg?"":`<button class="btn btn-ghost btn-block au-forgot" data-a="forgot">Passwort vergessen?</button>`}
   <p class="au-legal">Es gelten unsere <a href="/agb">AGB</a>. Wie wir mit deinen Daten umgehen, steht in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>`),
   after(){if(CFG.google)gsi(r)}};
}
/* Schnell-Login: nur eingerichtete Anbieter als Logo-Knöpfe */
function quickAuth(r){const a=CFG.auth||{},rq=encodeURIComponent(r),L=k=>`<img src="/img/mark/logos/${k}.svg" alt="" onerror="this.remove()">`;
  const o=[CFG.google&&`<div id="gbtn" class="au-g"></div>`,
    a.apple&&`<a class="qa-btn qa-apple" href="/auth/apple?r=${rq}">${L("apple")}<span>Mit Apple fortfahren</span></a>`,
    a.discord&&`<a class="qa-btn" href="/auth/discord?r=${rq}">${L("discord-icon")}<span>Mit Discord fortfahren</span></a>`,
    a.twitch&&`<a class="qa-btn" href="/auth/twitch?r=${rq}">${L("twitch")}<span>Mit Twitch fortfahren</span></a>`,
    a.sms&&`<button class="qa-btn" data-a="smsOpen" aria-expanded="false" aria-controls="smsBox">${ic("i-phone-f")}<span>Mit SMS-Code anmelden</span></button>`].filter(Boolean).join("");
  const err=new URLSearchParams(location.search).get("fehler");
  return `${o?`<div class="au-q">${o}
   ${a.sms?`<div class="au-sms" id="smsBox" hidden><label class="lbl" for="smsTel">Handynummer</label><div class="row"><input class="inp" id="smsTel" inputmode="tel" autocomplete="tel" placeholder="0151 2345678"><button class="btn btn-soft" data-a="smsSend">Code senden</button></div>
   <div id="smsCodeW" hidden><div class="row"><input class="inp" id="smsCode" inputmode="numeric" autocomplete="one-time-code" maxlength="40" placeholder="Code aus der SMS" aria-label="Code aus der SMS"><button class="btn btn-primary" data-a="smsCheck" data-v="${esc(r)}">Anmelden</button></div></div><div class="err" id="smsErr" role="alert"></div></div>`:""}
   </div><div class="au-or">oder mit E-Mail</div>`:""}${err?`<div class="err au-ferr" role="alert">${esc(err)}</div>`:""}`}
A.smsOpen=(_,el)=>{const b=$("#smsBox");b.hidden=!b.hidden;el.setAttribute("aria-expanded",String(!b.hidden));if(!b.hidden)$("#smsTel").focus()};
A.smsSend=async(_,el)=>{const e=$("#smsErr");e.textContent="";busy(el,true);try{const j=await API("/auth/sms/send",{method:"POST",body:{phone:$("#smsTel").value}});S.smsTel=j.phone;$("#smsCodeW").hidden=false;$("#smsCode").focus();toast("SMS-Code gesendet")}catch(x){e.textContent=x.message}busy(el,false)};
A.smsCheck=async(r,el)=>{const e=$("#smsErr");e.textContent="";busy(el,true);try{const j=await API("/auth/sms/verify",{method:"POST",body:{phone:S.smsTel||$("#smsTel").value,code:$("#smsCode").value}});setUser(j.user);toast("Angemeldet");go(r||"/konto")}catch(x){e.textContent=x.message;busy(el,false)}};
A.codeLogin=async(r,el)=>{const i=$("#aMail"),m=i.value.trim(),e=$("#aErr");e.textContent="";i.classList.remove("bad");if(!/^\S+@\S+\.\S+$/.test(m)){e.textContent="Gib deine E-Mail-Adresse ein – wir schicken dir einen Code.";i.classList.add("bad");i.focus();return}busy(el,true);
  try{await API("/auth/code",{method:"POST",body:{email:m}});S.pendingEmail=m;save();toast(`Code an ${m} geschickt`);go("/verifizieren?r="+encodeURIComponent(r||"/konto"))}catch(x){e.textContent=x.message;busy(el,false)}};
function gsi(r){
  const init=()=>{try{const g=window.google.accounts.id;g.initialize({client_id:CFG.google,callback:async x=>{try{const j=await API("/auth/google",{method:"POST",body:{credential:x.credential}});setUser(j.user);toast(`Angemeldet als ${j.user.name}`);go(r)}catch(e){const el=$("#aErr");if(el)el.textContent=e.message}}});g.renderButton($("#gbtn"),{theme:"outline",size:"large",shape:"pill",text:"continue_with",locale:"de",width:300})}catch(e){}};
  if(window.google&&window.google.accounts)return init();
  const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;s.onload=init;document.head.appendChild(s);
}
A.emailAuth=async(v,el)=>{
  const p=v.split("|"),email=$("#aMail").value.trim(),pw=$("#aPw").value,err=$("#aErr");err.textContent="";busy(el,true);
  try{
    if(p[0]==="reg"){await API("/auth/register",{method:"POST",body:{name:$("#aName").value.trim(),email,password:pw}});S.pendingEmail=email;save();go("/verifizieren?r="+encodeURIComponent(p[1]))}
    else{const j=await API("/auth/login",{method:"POST",body:{email,password:pw}});
      if(j.verify){S.pendingEmail=email;save();toast("Bitte bestätige zuerst deine E-Mail-Adresse");go("/verifizieren?r="+encodeURIComponent(p[1]))}
      else{setUser(j.user);toast(`Angemeldet als ${j.user.name}`);go(p[1])}}
  }catch(e){err.textContent=e.message;busy(el,false)}
};
A.forgot=async(v,el)=>{const i=$("#aMail"),m=i.value.trim();i.classList.remove("bad");if(!/^\S+@\S+\.\S+$/.test(m)){$("#aErr").textContent="Gib zuerst deine E-Mail-Adresse ein, dann schicken wir dir einen Link.";i.classList.add("bad");i.focus();return}busy(el,true);try{await API("/auth/forgot",{method:"POST",body:{email:m}});toast("Falls ein Konto existiert, ist ein Link unterwegs.")}catch(e){$("#aErr").textContent=e.message}busy(el,false)};
A.pwToggle=(v,el)=>{const i=el.parentNode.querySelector("input"),show=i.type==="password";i.type=show?"text":"password";el.setAttribute("aria-pressed",String(show));el.setAttribute("aria-label",show?"Passwort verbergen":"Passwort anzeigen")};
function apiVerify(_,qs){
  const e=S.pendingEmail,r=qs.get("r")||"/konto";
  if(!e)return {title:"E-Mail bestätigen",html:`<section class="au"><div class="card au-card au-none">${empty("Kein Code offen","Melde dich an oder erstelle ein Konto, dann schicken wir dir einen Code.",["/login","Zur Anmeldung"])}</div></section>`};
  return {title:"E-Mail bestätigen",html:authCard("E-Mail bestätigen",`Wir haben einen 6-stelligen Code an <b>${esc(e)}</b> geschickt. Schau auch im Spam-Ordner nach.`,`
   <label class="lbl au-otp-l" for="otp">Bestätigungscode</label><input class="inp otp au-otp" id="otp" inputmode="numeric" maxlength="40" autocomplete="one-time-code" placeholder="000000" aria-describedby="otpErr">
   <div class="err" id="otpErr" role="alert"></div>
   <button class="btn btn-primary btn-lg btn-block" data-a="otpGo" data-v="${esc(r)}" data-off>Bestätigen</button>
   <button class="btn btn-ghost btn-block au-forgot" data-a="otpResend" id="otpRe">Code erneut senden</button>
   <p class="au-alt">Falsche Adresse? <a href="/login?m=reg">Neu registrieren</a></p>`),
   after(){const o=$("#otp");o.addEventListener("input",()=>{o.value=o.value.replace(/\D/g,"").slice(0,6);o.classList.remove("bad");if(o.value.length===6)A.otpGo(r,$("[data-a=otpGo]"))});setTimeout(()=>o.focus(),100);auWait($("#otpRe"))}};
}
A.otpGo=async(r,el)=>{const o=$("#otp");if(!o||o.value.length!==6){$("#otpErr").textContent="Bitte gib den 6-stelligen Code ein.";o&&o.classList.add("bad");return}if(el.disabled)return;busy(el,true);try{const j=await API("/auth/verify",{method:"POST",body:{email:S.pendingEmail,code:o.value}});S.pendingEmail=null;setUser(j.user);toast("E-Mail bestätigt. Willkommen!");go(r||"/konto")}catch(e){$("#otpErr").textContent=e.message;o.classList.add("bad");busy(el,false)}};
/* Neuer Code frühestens nach 30 Sekunden; der Knopf zählt sichtbar herunter */
const auWait=el=>{if(!el)return;const t=()=>{if(!el.isConnected)return;const w=30-Math.floor((Date.now()-lastResend)/1000);if(w>0){el.disabled=true;el.textContent=`Neuer Code in ${w} s`;setTimeout(t,1000)}else{el.disabled=false;el.textContent="Code erneut senden"}};t()};
A.otpResend=async(_,el)=>{if(Date.now()-lastResend<30000)return;lastResend=Date.now();auWait(el);try{await API("/auth/resend",{method:"POST",body:{email:S.pendingEmail}});toast("Neuer Code ist unterwegs")}catch(e){toast(e.message)}};
function apiReset(_,qs){
  const t=qs.get("t")||"";
  if(!t)return {title:"Neues Passwort",html:authCard("Link unvollständig","Diesem Link fehlt der Sicherheitsschlüssel. Fordere auf der Anmeldeseite unter „Passwort vergessen?“ einen neuen Link an.",`<a class="btn btn-primary btn-lg btn-block au-go" href="/login">Zur Anmeldung</a>`)};
  return {title:"Neues Passwort",html:authCard("Neues Passwort","Lege ein neues Passwort für dein Konto fest.",`<form class="au-form" novalidate>
   <label class="lbl" for="np1">Neues Passwort</label><div class="au-pw"><input id="np1" type="password" autocomplete="new-password" placeholder="Mindestens 8 Zeichen"><button type="button" class="au-eye" data-a="pwToggle" aria-label="Passwort anzeigen" aria-pressed="false">${ic("i-eye")}</button></div>
   <label class="lbl" for="np2">Passwort wiederholen</label><input class="inp" id="np2" type="password" autocomplete="new-password">
   <div class="err" id="npErr" role="alert"></div><button type="submit" class="btn btn-primary btn-lg btn-block" data-a="npGo" data-v="${esc(t)}" data-off>Passwort speichern</button></form>`)};
}
A.npGo=async(t,el)=>{const a=$("#np1").value,b=$("#np2").value,e=$("#npErr");e.textContent="";if(a.length<8){e.textContent="Das Passwort braucht mindestens 8 Zeichen.";return}if(a!==b){e.textContent="Die Passwörter stimmen nicht überein.";return}busy(el,true);try{await API("/auth/reset",{method:"POST",body:{token:t,password:a}});setUser(null);toast("Passwort gespeichert. Bitte melde dich an.");go("/login")}catch(x){e.textContent=x.message;busy(el,false)}};

/* Ausweichweg: Bezahlen auf der Stripe-Seite (Weiterleitung) */
A.payRedirect=async(v,el)=>{
  if($("#payElW")&&$("#payElW").hidden)A.payMore();
  const err=$("#payErr");err.textContent="";
  const email=payMail();
  if(!email){err.textContent="Bitte bestätige zuerst deine E-Mail-Adresse mit dem Code.";return}
  if(!$("#payOk").checked){err.textContent="Bitte bestätige die AGB und die sofortige Lieferung.";ckNudge($("#payOkL"));return}
  if(!CFG.payments){err.textContent="Zahlungen sind noch nicht eingerichtet. Bitte versuch es später erneut.";return}
  if(!S.user){S.lastEmail=email;save()}
  el=el&&el.id==="payBtn"?el:$("#payBtn");busy(el,true," Weiterleitung zu Stripe …");
  try{
    const j=await API("/checkout",{method:"POST",body:{email,consent:true,promo:S.promo?"WILLKOMMEN10":"",items:cartItems()}});
    S.keys=Object.assign(S.keys||{},{[j.id]:j.key});S.cartOrder=j.id;save();location.href=j.url;
  }catch(x){err.textContent=x.message;busy(el,false)}
};

/* Bestellstatus: wartet live auf Zahlung und Lieferung */
function apiOrder(id,qs){
  const k=qs.get("k")||(S.keys&&S.keys[id])||"";
  if(qs.get("k")){S.keys=Object.assign(S.keys||{},{[id]:k});save()}
  return {title:"Bestellung "+id,html:`<div id="ord"><div class="od-load"><div class="spin"></div><p>Bestellung wird geladen …</p></div></div>`,
  after(){
    clearTimeout(pollT);const path=cur.path;let n=0,seen=null;
    const tick=async()=>{
      if(cur.path!==path)return;n++;let o;
      try{o=(await API(`/orders/${encodeURIComponent(id)}?k=${encodeURIComponent(k)}`)).order}
      catch(e){const el=$("#ord");if(el)el.innerHTML=`<section class="sec"><div class="card od-miss">${empty("Bestellung nicht gefunden",esc(e.message),["/","Zur Startseite"])}</div></section>`;return}
      if(cur.path!==path)return;
      ordCache[id]=o;
      if(["processing","delivered"].includes(o.status)&&S.cartOrder===id){S.cart=[];S.promo=0;S.cartOrder=null;save();updBadges()}
      if(o.status!==seen){const el=$("#ord");el.innerHTML=orderView(o);$$(".rv",el).forEach(x=>x.classList.add("in"));fx(el);
        if(o.status==="delivered"&&qs.get("bewerten")){const f=$("#rForm"),sv=+qs.get("s");if(f&&sv>=1&&sv<=5)A.rStar(sv);f&&setTimeout(()=>f.scrollIntoView({behavior:reduce?"auto":"smooth",block:"center"}),300)}seen=o.status}
      const wait={awaiting_payment:2500,payment_pending:20000,processing:n<20?3000:15000}[o.status];
      if(wait&&n<500)pollT=setTimeout(tick,wait);
    };
    tick();
  }};
}
function orderView(o){
  const d=t=>t?new Date(t).toLocaleString("de-DE",{dateStyle:"medium",timeStyle:"short"}):"";
  const H={awaiting_payment:["Zahlung wird bestätigt …","Das dauert meist nur wenige Sekunden. Bitte lass diese Seite kurz offen."],
    payment_pending:["Zahlung in Bearbeitung","Deine Zahlungsart braucht etwas länger. Wir melden uns per E-Mail, sobald sie bestätigt ist."],
    processing:["Wir bereiten deine Codes vor",`Deine Zahlung ist eingegangen. Meist dauert das nur Sekunden. Falls wir die Bestellung noch kurz prüfen, schicken wir die Codes an ${esc(o.email)}, sobald sie fertig sind. Du kannst diese Seite schließen.`],
    delivered:["Deine Codes sind da",`Sie stehen unten zum Kopieren bereit und wurden auch an ${esc(o.email)} gesendet.`],
    canceled:["Bestellung storniert","Die Zahlung wurde nicht abgeschlossen. Es wurde nichts abgebucht."],
    refunded:["Bestellung erstattet","Wir konnten leider nicht liefern und haben den Betrag erstattet."]}[o.status]||[esc(o.status),""];
  const done=o.status==="delivered",end=["canceled","refunded"].includes(o.status);
  const dealtB=[...new Set(o.items.map(i=>i.brand))].slice(0,3).map(brandOr);
  /* Belohnung: Karten werden einmal ausgeteilt, darunter die Medaille mit Chromrand */
  const icon=done?`<div class="od-deal n${dealtB.length}" aria-hidden="true">${dealtB.map((b,i)=>gc(b.art||b.img?b:{bg:b.bg,fg:b.fg,art:`<span class="wm" style="font-size:.3em;font-weight:800">${esc(b.name)}</span>`},{tilt:false,badge:false,cls:"flash",style:"--i:"+i})).join("")}<span class="od-medal metal" data-off>${ic("i-check")}</span></div>`
    :end?`<div class="od-x" aria-hidden="true">${ic("i-x")}</div>`
    :`<div class="od-mint" data-off aria-hidden="true"><span class="gc"><span class="art">${LOGO(34)}<span class="lines"><i></i><i></i></span></span><i class="gc-glare"></i></span></div>`;
  const steps=[["Bestellung aufgegeben",d(o.created_at),1],["Zahlung bestätigt",d(o.paid_at),o.paid_at?1:0],["Codes werden vorbereitet",o.status==="processing"?"läuft gerade":"",o.status==="processing"?2:done?1:0],["Geliefert",d(o.delivered_at),done?1:0]];
  const tl=end?"":`<div class="card od-tl rv"><h2 class="od-h2">Verlauf</h2><ol class="tl">${steps.map(s=>`<li class="tl-s${s[2]===2?" now":s[2]?" done":""}"><span class="tl-d">${s[2]===1?ic("i-check"):""}</span><div><b>${s[0]}</b>${s[1]?`<small>${s[1]}</small>`:""}</div></li>`).join("")}</ol></div>`;
  let cn=0;
  const items=o.items.map(i=>{const b=brandOr(i.brand),many=i.codes&&i.codes.length>1;return `<article class="card od-item rv"><div class="od-ih">${mini(b)}<div><b>${esc(i.name)}</b><small>${b.amts?esc(optLabel(b,i.face/100)):eurc(i.face)} × ${i.qty}${i.phone?" · "+esc(i.phone):""}${i.gift_to?" · Geschenk an "+esc(i.gift_to):""}</small></div></div>
  ${!done?"":i.type==="topup"?`<p class="od-note">${ic("i-check")}Guthaben wurde auf ${esc(i.phone)} gebucht.</p>`:i.gift_to?`<p class="od-note">${ic("i-check")}Der Code wurde an ${esc(i.gift_to)} gesendet.</p>`:i.codes.map((c,j)=>{const k="oc"+(++cn);return `<div class="od-code"><span class="od-code-l" id="${k}l">${many?`Code ${j+1} von ${i.codes.length}`:"Dein Code"}</span><code class="od-code-v" id="${k}" data-code="${esc(c)}" aria-labelledby="${k}l ${k}">${esc(mask(c))}</code><div class="od-code-a"><button class="btn btn-soft" data-a="codeShow" data-v="${esc(c)}" aria-controls="${k}" aria-pressed="false">${ic("i-eye")}<span>Zeigen</span></button><button class="btn btn-primary" data-a="codeCopy" data-v="${esc(c)}">${ic("i-copy")}<span>Code kopieren</span></button></div></div>`}).join("")}</article>`}).join("");
  const sum=`<div class="card od-sum pb-sum"><div class="sumrow"><span>Zwischensumme</span><span>${eurc(o.subtotal)}</span></div>${o.discount?`<div class="sumrow ok"><span>Rabatt</span><span>−${eurc(o.discount)}</span></div>`:""}${o.fee?`<div class="sumrow"><span>Servicegebühr</span><span>${eurc(o.fee)}</span></div>`:""}<div class="sumrow tot"><span>Gesamt</span><span>${eurc(o.total)}</span></div>${o.vat?`<div class="sumrow vatrow"><span>darin ${String(VATR()||19).replace(".",",")} % MwSt.</span><span>${eurc(o.vat)}</span></div>`:""}</div>`;
  const sup=`mailto:${SUP()}?subject=${encodeURIComponent("Bestellung "+o.id)}`;
  return `<div class="od" data-st="${esc(o.status)}"><header class="od-hero">${icon}<h1 class="od-h">${H[0]}</h1>${H[1]?`<p class="od-lead">${H[1]}</p>`:""}<p class="od-meta">${stBadge(o.status)}<span>Bestellnummer ${esc(o.id)}</span></p></header>
<div class="od-body">
 ${done?items+tl:tl+items}
 ${sum}
 ${reviewBox(o)}
 ${!S.user&&!end?`<div class="card od-cta rv"><h2 class="od-h2">Alles an einem Ort</h2><p>Erstelle ein Konto mit ${esc(o.email)}, dann erscheint diese Bestellung automatisch darin.</p><a class="btn btn-soft btn-block" href="/login?m=reg&r=/konto">Konto erstellen</a></div>`:""}
 <div class="od-acts">${done?`<button class="btn btn-soft" data-a="reorderLive" data-v="${esc(o.id)}">${ic("i-repeat")}Erneut kaufen</button>`:`<a class="btn btn-soft" href="/hilfe">${ic("i-help")}Hilfe</a>`}<a class="btn btn-primary" href="/">Weiter einkaufen</a></div>
 <p class="od-sup">${done?"Problem mit einem Code?":"Fragen zur Bestellung?"} <a href="${sup}">Schreib uns</a> – mit Bestellnummer geht es am schnellsten.</p>
</div></div>`;
}
A.codeShow=(c,el)=>{const s=document.getElementById(el.getAttribute("aria-controls")),shown=el.getAttribute("aria-pressed")==="true";s.textContent=shown?mask(c):c;el.setAttribute("aria-pressed",String(!shown));el.lastElementChild.textContent=shown?"Zeigen":"Verbergen"};
/* Kopieren mit Rückmeldung am Knopf; Ausweichweg für ältere Browser */
const odClip=async t=>{try{await navigator.clipboard.writeText(t);return true}catch(e){const a=document.createElement("textarea");a.value=t;a.setAttribute("readonly","");a.style.cssText="position:fixed;top:0;left:0;opacity:0";document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand("copy")}catch(x){}a.remove();return ok}};
A.codeCopy=async(c,el)=>{const ok=await odClip(c);if(!ok){toast("Kopieren nicht möglich. Tippe auf „Zeigen“ und markiere den Code.");return}toast("Code kopiert");
  if(el&&el.lastElementChild){clearTimeout(el._t);el.classList.add("done");el.lastElementChild.textContent="Kopiert";el._t=setTimeout(()=>{el.classList.remove("done");el.lastElementChild.textContent="Code kopieren"},2200)}};
/* Bewertung nach der Lieferung (erscheint als verifizierter Kauf) */
const reviewBox=o=>o.status!=="delivered"?"":o.reviewed?`<div class="card rform rform-done rv"><b>Danke für deine Bewertung!</b><p>Sie erscheint im Shop als verifizierter Kauf.</p></div>`
  :`<div class="card rform rv" id="rForm"><h2 class="od-h2">Wie zufrieden bist du?</h2><p>Deine Bewertung erscheint im Shop als verifizierter Kauf.</p><div class="starpick" role="group" aria-label="Sterne vergeben">${[1,2,3,4,5].map(i=>`<button data-a="rStar" data-v="${i}" aria-pressed="false" aria-label="${i} ${i>1?"Sterne":"Stern"}">${ic("i-star")}</button>`).join("")}</div><label class="lbl" for="rText">Deine Erfahrung (optional)</label><textarea class="inp" id="rText" maxlength="600" placeholder="Was hat dir gefallen?"></textarea><label class="lbl" for="rName">Name (wird abgekürzt angezeigt)</label><input class="inp" id="rName" maxlength="40" autocomplete="name" placeholder="z. B. Lena Hoffmann" value="${esc(S.user?S.user.name:"")}"><div class="err" id="rErr" role="alert"></div><button class="btn btn-primary btn-block" data-a="rSend" data-v="${esc(o.id)}">Bewertung senden</button></div>`;
let rStars=0;
A.rStar=v=>{rStars=+v;$$(".starpick button").forEach(b=>{b.classList.toggle("on",+b.dataset.v<=rStars);b.setAttribute("aria-pressed",String(+b.dataset.v===rStars))});const e=$("#rErr");if(e)e.textContent=""};
A.rSend=async(id,el)=>{if(!rStars){$("#rErr").textContent="Bitte wähle 1 bis 5 Sterne.";return}busy(el,true);try{await API("/reviews",{method:"POST",body:{order:id,k:(S.keys&&S.keys[id])||"",rating:rStars,text:$("#rText").value,name:$("#rName").value}});REV=null;const f=$("#rForm");if(f)f.outerHTML=reviewBox({status:"delivered",reviewed:true}).replace(" rv","");toast("Danke für deine Bewertung!")}catch(x){$("#rErr").textContent=x.message;busy(el,false)}};
A.reorderLive=id=>{const o=ordCache[id];if(!o)return;let n=0;o.items.forEach(i=>{const b=byId(i.brand);if(b&&b.amts.includes(i.face/100)){addCart({id:i.brand,a:i.face/100,q:i.qty,type:i.type,phone:i.phone||undefined},true);n++}});toast(n?"Wieder im Warenkorb":"Diese Artikel gibt es nicht mehr",n?["/warenkorb","Ansehen"]:null)};

/* Konto */
A.numDel=i=>{S.numbers.splice(+i,1);save();route(true);toast("Nummer gelöscht")};
function apiAccount(tab){
  if(!S.user)return apiLogin(null,new URLSearchParams("r=/konto"+(tab?"/"+tab:"")));
  const u=S.user,T=[["bestellungen","Bestellungen","i-receipt"],["favoriten","Favoriten","i-heart"],["nummern","Nummern","i-phone-f"],["einstellungen","Einstellungen","i-gear"]];
  if(!T.some(t=>t[0]===tab))tab="bestellungen";
  let body=`<div id="accBody" class="acc-wait"><div class="spin"></div></div>`;
  if(tab==="favoriten"){const f=S.favs.map(byId).filter(Boolean);body=f.length?`<div class="tiles">${f.map(tile).join("")}</div>`:`<div class="card acc-none">${empty("Noch keine Favoriten","Tippe auf einer Produktseite auf das Herz, um eine Marke hier zu speichern.",["/kategorien","Marken entdecken"])}</div>`}
  if(tab==="nummern")body=S.numbers.length?`<div class="card acc-set">${S.numbers.map((x,i)=>{const o=byId(x.op),cc=COUNTRIES.find(c=>c.c===x.c)||COUNTRIES[0];return `<div class="setrow"><span class="si-ic">${flag(cc.c,22)}</span><div class="mid"><b>${cc.dial} ${esc(x.n)}</b><small>${o?esc(o.name):"Anbieter unbekannt"}</small></div><a class="btn btn-soft btn-sm" href="/aufladen?n=${encodeURIComponent(x.n)}&op=${encodeURIComponent(x.op||"")}">Aufladen</a><button class="acc-rm" data-a="numDel" data-v="${i}" aria-label="Nummer ${esc(x.n)} löschen">${ic("i-trash")}</button></div>`}).join("")}</div><p class="acc-fine">Gespeicherte Nummern liegen nur auf diesem Gerät.</p>`
    :`<div class="card acc-none">${empty("Noch keine Nummern","Nach einer Aufladung kannst du die Nummer hier speichern. Sie liegt nur auf diesem Gerät.",["/aufladen","Handy aufladen"])}</div>`;
  if(tab==="einstellungen")body=`<div class="card acc-set">
   <div class="setrow"><span class="si-ic">${ic("i-mail")}</span><div class="mid"><b>E-Mail</b><small>${esc(u.email)}</small></div></div>
   <div class="setrow"><span class="si-ic">${ic("i-bell")}</span><div class="mid"><b id="alL">Anmelde-Hinweise per E-Mail</b><small>Wir schreiben dir bei jeder neuen Anmeldung.</small></div><button class="switch" role="switch" aria-checked="${!!u.loginAlerts}" data-a="alerts" aria-labelledby="alL"></button></div>
   <button class="setrow" data-a="country"><span class="si-ic">${flag(ctry().c,22)}</span><div class="mid"><b>Land für Aufladungen</b><small>${esc(ctry().n)}</small></div>${ic("i-chev")}</button></div>
   <div class="acc-out"><button class="btn btn-soft btn-block btn-lg" data-a="logout">${ic("i-logout")}Abmelden</button><button class="btn btn-ghost btn-block acc-del" data-a="delAcc">Konto löschen</button></div>`;
  return {title:"Mein Konto",html:`<div class="acc sec">
<header class="acc-head rv"><span class="gc ink tilt acc-card" aria-hidden="true"><span class="art"><span class="mc-top">${LOGO(30)}instacode</span><span class="mc-name">${esc(u.name)}</span><span class="mc-mail">${esc(u.email)}</span></span><i class="gc-glare"></i><i class="rim"></i></span><div><h1 class="acc-h">Hallo, ${esc(u.name.split(" ")[0])}</h1><p class="acc-p">Deine Bestellungen, Favoriten und Einstellungen.</p></div></header>
<nav class="acc-tabs" aria-label="Kontobereiche">${T.map(t=>`<a href="/konto/${t[0]}"${t[0]===tab?' aria-current="page"':""}>${ic(t[2])}<span>${t[1]}</span></a>`).join("")}</nav>
<div class="acc-body">${body}</div></div>`,
  after(){
    if(tab!=="bestellungen")return;
    API("/orders").then(j=>{const el=$("#accBody");if(!el)return;j.orders.forEach(o=>ordCache[o.id]=o);el.classList.remove("acc-wait");
      el.innerHTML=j.orders.length?`<div class="acc-list">${j.orders.map(o=>{const n=o.items.reduce((s,i)=>s+(i.qty||1),0);return `<a class="card acc-ord" href="/bestellung/${o.id}"><span class="acc-fan" aria-hidden="true">${o.items.slice(0,3).map(i=>mini(brandOr(i.brand))).join("")}</span><span class="acc-om"><b>${new Date(o.created_at).toLocaleDateString("de-DE",{dateStyle:"medium"})}</b><small>${n} Artikel · ${esc(o.id)}</small>${stBadge(o.status)}</span><b class="acc-or">${eurc(o.total)}</b>${ic("i-chev")}</a>`}).join("")}</div>`
        :`<div class="card acc-none">${empty("Noch keine Bestellungen","Deine Bestellungen und Codes erscheinen hier.",["/","Jetzt stöbern"])}</div>`;
    }).catch(e=>{const el=$("#accBody");if(el){el.classList.remove("acc-wait");el.innerHTML=`<p class="err">${esc(e.message)}</p>`}});
  }};
}
A.alerts=async(v,el)=>{const on=el.getAttribute("aria-checked")!=="true";el.setAttribute("aria-checked",on);try{setUser((await API("/me",{method:"PATCH",body:{loginAlerts:on}})).user)}catch(e){toast(e.message);el.setAttribute("aria-checked",!on)}};
A.logout=async()=>{try{await API("/auth/logout",{method:"POST"})}catch(e){}setUser(null);toast("Abgemeldet");go("/")};
A.delAcc=()=>openSheet(`<div class="sheet-h"><h3>Konto löschen?</h3><button class="x" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button></div><p class="acc-sheet-p">Dein Konto wird gelöscht. Bestell- und Rechnungsdaten bewahren wir nur so lange auf, wie es gesetzlich vorgeschrieben ist.</p><div class="acc-sheet-a"><button class="btn btn-soft" data-a="closeSheet">Abbrechen</button><button class="btn acc-danger" data-a="delAccGo">Konto löschen</button></div>`);
A.delAccGo=async(_,el)=>{busy(el,true);try{await API("/me",{method:"DELETE"});setUser(null);closeSheet(true);toast("Konto gelöscht");go("/")}catch(e){busy(el,false);toast(e.message)}};

/* Rechtstexte – bei inhaltlichen Änderungen auch LEGAL_STAND anpassen */
const LEGAL_STAND="Oktober 2026";
const IMP="https://mein.online-impressum.de/instacode/";
const SUP=()=>(CFG.support)||"support@instacode.store";
const LEGAL={
 agb:["Allgemeine Geschäftsbedingungen",()=>`
<h2>1. Geltungsbereich und Anbieter</h2>
<p>Diese AGB gelten für alle Bestellungen über den Onlineshop ${esc(CFG.site||"instacode")}. Anbieter und Vertragspartner ist der im <a href="${IMP}" target="_blank" rel="noopener">Impressum</a> genannte Betreiber. Abweichende Bedingungen des Kunden gelten nicht.</p>
<h2>2. Angebot</h2>
<p>Wir verkaufen digitale Produkte: Guthaben- und Geschenkkarten-Codes, Spiele-Keys sowie Handy-Guthaben (Aufladungen). Die Codes stammen von autorisierten Distributoren. Die Einlösung erfolgt ausschließlich beim jeweiligen Herausgeber (z.&nbsp;B. Apple, Google, Sony, Valve, Netzbetreiber) nach dessen Bedingungen. Regionale Beschränkungen sind in der Produktbeschreibung angegeben.</p>
<h2>3. Vertragsschluss</h2>
<p>Die Darstellung im Shop ist kein bindendes Angebot. Mit Klick auf den Bezahl-Button gibst du ein verbindliches Angebot ab. Der Vertrag kommt zustande, wenn wir die Bestellung per E-Mail bestätigen oder den Code ausliefern. Vertragssprache ist Deutsch.</p>
<h2>4. Preise und Zahlung</h2>
<p>Alle Preise sind Endpreise in Euro inklusive der gesetzlichen Mehrwertsteuer. Pro Bestellung fällt zusätzlich eine Servicegebühr an (derzeit ${feeTxt()||"keine"}), die im Warenkorb und vor Abschluss der Bestellung ausgewiesen und im Gesamtpreis enthalten ist. Versandkosten fallen nicht an. Die Zahlung erfolgt über unseren Zahlungsdienstleister Stripe mit den im Bestellvorgang angezeigten Zahlungsarten (z.&nbsp;B. Kreditkarte, Apple Pay, Google Pay). Der Betrag wird bei der Bestellung belastet.</p>
<h2>5. Lieferung</h2>
<p>Codes werden nach Zahlungseingang per E-Mail und in deinem Kundenkonto bereitgestellt, in der Regel innerhalb weniger Minuten. Aufladungen werden direkt auf die angegebene Rufnummer gebucht. Zum Schutz vor Betrug können einzelne Bestellungen manuell geprüft werden. Das kann bis zu 24 Stunden dauern. Ist eine Lieferung nicht möglich, erstatten wir den vollen Betrag.</p>
<h2>6. Pflichten des Kunden</h2>
<p>Du bist für die Richtigkeit der E-Mail-Adresse und Rufnummer verantwortlich. Für Aufladungen auf eine falsch angegebene Nummer können wir keinen Ersatz leisten, wenn die Buchung bereits erfolgt ist. Codes sind wie Bargeld zu behandeln und nicht an Dritte weiterzugeben, die du nicht kennst.</p>
<h2>7. Widerrufsrecht</h2>
<p>Verbrauchern steht ein Widerrufsrecht nach Maßgabe der <a href="/widerruf">Widerrufsbelehrung</a> zu. Bei digitalen Inhalten erlischt es, wenn du der sofortigen Ausführung ausdrücklich zugestimmt und deine Kenntnis vom Verlust des Widerrufsrechts bestätigt hast.</p>
<h2>8. Gewährleistung</h2>
<p>Es gilt das gesetzliche Mängelhaftungsrecht. Ist ein gelieferter Code nicht einlösbar, melde dich bitte unter <a href="mailto:${SUP()}">${SUP()}</a> mit Bestellnummer und, wenn möglich, einem Screenshot der Fehlermeldung. Wir prüfen den Fall beim Distributor und liefern Ersatz oder erstatten den Kaufpreis.</p>
<h2>9. Haftung</h2>
<p>Wir haften unbeschränkt bei Vorsatz, grober Fahrlässigkeit und bei Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vorhersehbaren, vertragstypischen Schaden begrenzt. Im Übrigen ist die Haftung ausgeschlossen.</p>
<h2>10. Streitbeilegung</h2>
<p>Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
<h2>11. Schlussbestimmungen</h2>
<p>Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Bei Verbrauchern gilt diese Rechtswahl nur, soweit dadurch nicht der Schutz zwingender Bestimmungen des Staates entzogen wird, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat.</p>`],
 widerruf:["Widerrufsbelehrung",()=>`
<h2>Widerrufsrecht</h2>
<p>Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.</p>
<p>Um dein Widerrufsrecht auszuüben, musst du uns (Kontaktdaten siehe <a href="${IMP}" target="_blank" rel="noopener">Impressum</a>, E-Mail: <a href="mailto:${SUP()}">${SUP()}</a>) mittels einer eindeutigen Erklärung (z.&nbsp;B. per E-Mail) über deinen Entschluss, diesen Vertrag zu widerrufen, informieren. Du kannst dafür das unten stehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Zur Wahrung der Frist reicht es aus, dass du die Mitteilung vor Ablauf der Widerrufsfrist absendest.</p>
<h2>Folgen des Widerrufs</h2>
<p>Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir von dir erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über deinen Widerruf bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen Transaktion eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes vereinbart. In keinem Fall werden dir wegen dieser Rückzahlung Entgelte berechnet.</p>
<h2>Vorzeitiges Erlöschen des Widerrufsrechts</h2>
<p>Das Widerrufsrecht erlischt bei Verträgen über die Bereitstellung von nicht auf einem körperlichen Datenträger befindlichen digitalen Inhalten (z.&nbsp;B. Codes und Keys), wenn wir mit der Ausführung des Vertrags begonnen haben, nachdem du ausdrücklich zugestimmt hast, dass wir vor Ablauf der Widerrufsfrist mit der Ausführung beginnen, du deine Kenntnis davon bestätigt hast, dass du durch deine Zustimmung mit Beginn der Ausführung dein Widerrufsrecht verlierst, und wir dir eine Bestätigung des Vertrags zur Verfügung gestellt haben (§ 356 Abs. 5 BGB). Bei Dienstleistungen wie Handy-Aufladungen erlischt das Widerrufsrecht, wenn die Leistung vollständig erbracht wurde und du vorher ausdrücklich zugestimmt hast (§ 356 Abs. 4 BGB).</p>
<h2>Muster-Widerrufsformular</h2>
<p class="muted">(Wenn du den Vertrag widerrufen willst, fülle bitte dieses Formular aus und sende es zurück.)</p>
<p class="lgl-form">An: Betreiber laut Impressum, E-Mail: ${SUP()}<br>Hiermit widerrufe(n) ich/wir den von mir/uns abgeschlossenen Vertrag über den Kauf der folgenden Waren / die Erbringung der folgenden Dienstleistung:<br>Bestellnummer: ____________<br>Bestellt am: ____________<br>Name des/der Verbraucher(s): ____________<br>Anschrift des/der Verbraucher(s): ____________<br>Unterschrift (nur bei Mitteilung auf Papier)<br>Datum</p>`],
 datenschutz:["Datenschutzerklärung",()=>`
<h2>1. Verantwortlicher</h2>
<p>Verantwortlich für die Datenverarbeitung auf dieser Website ist der im <a href="${IMP}" target="_blank" rel="noopener">Impressum</a> genannte Betreiber. Fragen zum Datenschutz: <a href="mailto:${SUP()}">${SUP()}</a>.</p>
<h2>2. Welche Daten wir verarbeiten</h2>
<ul>
<li><b>Bestellungen:</b> E-Mail-Adresse, bestellte Produkte, Beträge, Zeitpunkte, bei Aufladungen die Rufnummer, bei Geschenken Name und E-Mail des Empfängers sowie die Nachricht. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).</li>
<li><b>Kundenkonto:</b> Name, E-Mail, verschlüsseltes Passwort, gespeicherte Rufnummern. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</li>
<li><b>Server-Logs:</b> IP-Adresse, Zeitpunkt, aufgerufene Seite, Browser. Zur Sicherheit und Fehlersuche, Speicherung höchstens 30 Tage. Rechtsgrundlage: berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO).</li>
<li><b>Betrugsprüfung:</b> Zahlungs- und Risikodaten von Stripe, um Missbrauch zu verhindern. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.</li>
<li><b>Produktempfehlungen:</b> Nach einem Kauf schicken wir dir in der Liefer-E-Mail Empfehlungen zu ähnlichen Produkten (§ 7 Abs. 3 UWG). Du kannst dem jederzeit über den Link in jeder E-Mail oder per Nachricht an uns widersprechen. Rechtsgrundlage: berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO).</li>
<li><b>Bewertungen:</b> Name, Sterne und Text, die du freiwillig nach einer Bestellung abgibst. Rechtsgrundlage: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).</li>
</ul>
<h2>3. Dienstleister</h2>
<ul>
<li><b>Hosting:</b> Railway Corporation, USA. Die Server und die Datenbank stehen in der EU (Niederlande). Grundlage für etwaige Übermittlungen in die USA: EU-Standardvertragsklauseln.</li>
<li><b>Zahlung:</b> Stripe Payments Europe Ltd., Irland. Stripe verarbeitet deine Zahlungsdaten (z.&nbsp;B. Karte, Apple Pay, Google Pay) selbst; wir erhalten keine vollständigen Kartendaten. Stripe kann zur Betrugsprävention Daten an Stripe Inc., USA übermitteln (EU-U.S. Data Privacy Framework). Datenschutz: stripe.com/de/privacy.</li>
<li><b>E-Mail-Versand:</b> Resend (Plus Five Five, Inc.), USA, für Bestellbestätigungen, Codes und Konto-E-Mails. Grundlage: EU-Standardvertragsklauseln.</li>
<li><b>Bezug von Codes und Aufladungen:</b> Reloadly Inc., USA. Für Handy-Aufladungen übermitteln wir die Rufnummer und den Betrag, für Codes nur Produkt und Menge, keine Kundendaten. Grundlage: Art. 6 Abs. 1 lit. b DSGVO und EU-Standardvertragsklauseln.</li>
<li><b>Domain und E-Mail-Postfach:</b> STRATO GmbH, Deutschland.</li>
${CFG.google?`<li><b>Anmeldung mit Google:</b> Google Ireland Ltd. Nur wenn du diese Anmeldung wählst, erhalten wir Name und E-Mail von Google.</li>`:""}
${CFG.trustpilot?`<li><b>Trustpilot:</b> Trustpilot A/S, Dänemark. Das Bewertungs-Widget lädt nur nach deiner Einwilligung im Cookie-Banner.</li>`:""}
</ul>
<h2>4. Cookies und lokaler Speicher</h2>
<p>Wir verwenden nur technisch notwendige Cookies und lokalen Speicher für Anmeldung, Warenkorb, Spracheinstellungen und die sichere Zahlung (§ 25 Abs. 2 TDDDG). Es gibt kein Tracking und keine Werbung. Die Stripe-Zahlungsfelder setzen eigene, für die Betrugsprävention notwendige Cookies.</p>
<h2>5. Speicherdauer</h2>
<p>Bestell- und Rechnungsdaten bewahren wir wegen gesetzlicher Aufbewahrungspflichten bis zu 10 Jahre auf (§ 147 AO, § 257 HGB). Kontodaten löschen wir, wenn du dein Konto löschst, soweit keine Aufbewahrungspflicht besteht.</p>
<h2>6. Deine Rechte</h2>
<p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 15–21 DSGVO). Eine Einwilligung kannst du jederzeit widerrufen. Schreib uns dazu an <a href="mailto:${SUP()}">${SUP()}</a>. Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren.</p>
<h2>7. Sicherheit</h2>
<p>Alle Verbindungen sind per TLS verschlüsselt. Gekaufte Codes speichern wir verschlüsselt. Passwörter werden nur als sicherer Hash gespeichert.</p>`]
};
/* Lesbare Langform: Inhaltsverzeichnis (ab Tablet quer) und Textspalte mit höchstens 68 Zeichen */
function legalPage(id){const x=LEGAL[id],toc=[];let n=0;
  const body=x[1]().replace(/<h2>([\s\S]*?)<\/h2>/g,(m,t)=>{const a=`${id}-${++n}`;toc.push([a,t.replace(/<[^>]+>/g,"")]);return `<h2 id="${a}">${t}</h2>`});
  return {title:x[0],html:`${crumb([[x[0]]])}<div class="lgl sec"><header class="lgl-head"><h1 class="lgl-h">${x[0]}</h1><p class="lgl-meta">Stand: ${LEGAL_STAND}</p></header>
  <div class="lgl-grid"><nav class="lgl-toc" aria-label="Inhalt"><b>Inhalt</b><ul>${toc.map(([a,t])=>`<li><a href="#${a}">${esc(t)}</a></li>`).join("")}</ul></nav><article class="card lgl-doc prose">${body}</article></div></div>`,
  /* Sprung im Inhaltsverzeichnis ohne Navigation (sonst baut popstate die Seite neu auf und springt nach oben) */
  after(){const t=$(".lgl-toc");t&&t.addEventListener("click",e=>{const a=e.target.closest("a[href^='#']"),h=a&&document.getElementById(a.hash.slice(1));if(!h)return;e.preventDefault();try{history.replaceState(null,"",a.hash)}catch(x){}
    $$(".lgl-doc h2.on").forEach(x=>x.classList.remove("on"));h.classList.add("on");h.setAttribute("tabindex","-1");h.focus({preventScroll:true});h.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"})})}}}
