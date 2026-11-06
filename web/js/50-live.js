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
function setUser(u){S.user=u?{name:u.name||u.email.split("@")[0],email:u.email,provider:u.google?"google":"email",loginAlerts:!!u.loginAlerts}:null;if(u)S.acct=1;/* Gerät kennt ein Konto (Bestellseite: kein „Konto anlegen“) */save();renderAcc()}
function busy(el,on,label){if(!el)return;if(on){el.dataset.t=el.innerHTML;el.innerHTML=`<span class="spin" style="display:inline-block;width:18px;height:18px;border-width:2.5px;margin:0"></span>${label||""}`;el.disabled=true}else if(el.dataset.t){el.innerHTML=el.dataset.t;el.disabled=false}}
function boot(){
  $("#testbar").hidden=!(CFG.testmode&&CFG.payments);
  $$("[data-paytext]").forEach(e=>e.textContent=payNames());
  const kb=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent)?"⌘ K":"Strg K";$$(".kbdk").forEach(k=>k.textContent=kb);
  const start=()=>{route();API("/me").then(m=>{const had=!!S.user;setUser(m.user);if(had!==!!m.user||/^\/(konto|kasse|login)/.test(cur.path))route(true)}).catch(()=>{})};
  if(BRANDS.length){API("/checkout/email").then(ev=>{const e=ev&&ev.email||null;if(e!==(CFG.ev||null)){CFG.ev=e;if(/^\/(kasse|warenkorb)/.test(cur.path))route(true)}}).catch(()=>{});return start()}
  Promise.all([API("/catalog"),API("/config"),API("/stock"),API("/checkout/email").catch(()=>({}))]).then(([c,f,st,ev])=>{setCatalog(c.products);cleanCart();CFG=Object.assign(CFG,f);CFG.ev=ev&&ev.email||null;STOCK=st;start()}).catch(()=>start());
}
/* Anmelde-Karte: Glas mit Chromkante vor einem Kartenfächer (öffnet sich einmal, folgt mit der Maus dem Zeiger) */
const AU_FAN=["spotify","psn","netflix","apple","steam"];
const authCard=(title,text,inner)=>`<section class="au" data-mouse><div class="au-wrap"><div class="au-fan" data-off aria-hidden="true">${AU_FAN.map((id,i)=>`<span class="au-fc">${gc(pk(id,i+3),{tilt:false,badge:false,plat:false})}</span>`).join("")}</div><div class="au-card rv">${LOGO(48)}<h1 class="au-h">${title}</h1>${text?`<p class="au-p">${text}</p>`:""}${inner}</div></div></section>`;

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
   <button type="submit" class="btn btn-primary btn-ink btn-lg btn-block" data-a="emailAuth" data-v="${reg?"reg":"login"}|${esc(r)}" data-off>${reg?"Konto erstellen":"Anmelden"}</button>
   </form>
   ${a.code?`<div class="au-or">oder</div><button class="btn btn-soft btn-block" data-a="codeLogin" data-v="${esc(r)}">${ic("i-mail")}Ohne Passwort: Code per E-Mail</button>`:""}
   ${reg?"":`<button class="btn btn-ghost btn-block au-forgot" data-a="forgot">Passwort vergessen?</button>`}
   <p class="au-legal">Es gelten unsere <a href="/agb">AGB</a>. Wie wir mit deinen Daten umgehen, steht in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>`),
   after(){if(CFG.google)gsi(r)}};
}
/* Schnell-Login: Passkey (wenn der Browser es kann) und nur eingerichtete Anbieter als Logo-Knöpfe; im Anmelde-Fenster (q.sheet) ist der Passkey der Hauptknopf */
function quickAuth(r,q={}){const a=CFG.auth||{},rq=encodeURIComponent(r),L=k=>`<img src="/img/mark/logos/${k}.svg" alt="" onerror="this.remove()">`;
  const o=[pkCan()&&`<button class="${q.sheet?"btn btn-primary btn-ink btn-lg btn-block ql-pk":"qa-btn qa-pk"}" data-a="pkLogin" data-v="${esc(r)}">${ic("i-face")}<span>Mit Passkey anmelden</span></button>`,
    CFG.google&&`<div id="gbtn" class="au-g"></div>`,
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
/* Google-Knopf (Google Identity Services). el/opt: anderer Platz und Größe (Kasse, Bestellseite); Fehler landen im nächsten Fehlerfeld */
function gsi(r,done,el,opt){
  const init=()=>{try{const g=window.google.accounts.id,t=el||$("#gbtn");if(!t||!t.isConnected)return;g.initialize({client_id:CFG.google,callback:async x=>{try{const j=await API("/auth/google",{method:"POST",body:{credential:x.credential}});if(done)return done(j.user);setUser(j.user);toast(`Angemeldet als ${j.user.name}`);go(r)}catch(e){const er=(el&&el.closest(".ck-ev")&&$("#evErr"))||(el&&el.closest(".od-acct")&&$("#odaErr"))||$("#sheet #qlErr")||$("#aErr");if(er)er.textContent=e.message}}});g.renderButton(t,Object.assign({theme:"outline",size:"large",shape:"pill",text:"continue_with",locale:"de",width:300},opt||{}))}catch(e){}};
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
   <label class="lbl au-otp-l" for="otp">Bestätigungscode</label><div class="au-otpw"><span class="au-cells" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span><input class="inp otp au-otp" id="otp" inputmode="numeric" maxlength="40" autocomplete="one-time-code" placeholder="000000" aria-describedby="otpErr"></div>
   <div class="err" id="otpErr" role="alert"></div>
   <button class="btn btn-primary btn-ink btn-lg btn-block" data-a="otpGo" data-v="${esc(r)}" data-off>Bestätigen</button>
   <button class="btn btn-ghost btn-block au-forgot" data-a="otpResend" id="otpRe">Code erneut senden</button>
   <p class="au-alt">Falsche Adresse? <a href="/login?m=reg">Neu registrieren</a></p>`),
   after(){const o=$("#otp");o.addEventListener("input",()=>{o.value=o.value.replace(/\D/g,"").slice(0,6);o.classList.remove("bad");if(o.value.length===6)A.otpGo(r,$("[data-a=otpGo]"))});setTimeout(()=>o.focus(),100);auWait($("#otpRe"));otpPaint(o)}};
}
A.otpGo=async(r,el)=>{const o=$("#otp");if(!o||o.value.length!==6){$("#otpErr").textContent="Bitte gib den 6-stelligen Code ein.";o&&o.classList.add("bad");return}if(el.disabled)return;busy(el,true);try{const j=await API("/auth/verify",{method:"POST",body:{email:S.pendingEmail,code:o.value}});S.pendingEmail=null;setUser(j.user);toast("E-Mail bestätigt. Willkommen!");go(r||"/konto")}catch(e){$("#otpErr").textContent=e.message;o.classList.add("bad");busy(el,false)}};
/* Sechs Felder zeigen die Ziffern des (unsichtbar darüberliegenden) Eingabefelds; das nächste Feld trägt den Cursor */
const otpPaint=o=>{const cells=$$(".au-cells i",o.parentNode);if(!cells.length)return;
  const p=()=>{const v=o.value.replace(/\D/g,"").slice(0,6),f=document.activeElement===o;cells.forEach((c,i)=>{const d=v[i]||"";if(c.textContent!==d)c.textContent=d;c.classList.toggle("on",!!d);c.classList.toggle("cur",f&&i===Math.min(v.length,5))})};
  ["input","focus","blur"].forEach(t=>o.addEventListener(t,p));p()};
/* Neuer Code frühestens nach 30 Sekunden; der Knopf zählt sichtbar herunter */
const auWait=el=>{if(!el)return;const t=()=>{if(!el.isConnected)return;const w=30-Math.floor((Date.now()-lastResend)/1000);if(w>0){el.disabled=true;el.textContent=`Neuer Code in ${w} s`;setTimeout(t,1000)}else{el.disabled=false;el.textContent="Code erneut senden"}};t()};
A.otpResend=async(_,el)=>{if(Date.now()-lastResend<30000)return;lastResend=Date.now();auWait(el);try{await API("/auth/resend",{method:"POST",body:{email:S.pendingEmail}});toast("Neuer Code ist unterwegs")}catch(e){toast(e.message)}};
function apiReset(_,qs){
  const t=qs.get("t")||"";
  if(!t)return {title:"Neues Passwort",html:authCard("Link unvollständig","Diesem Link fehlt der Sicherheitsschlüssel. Fordere auf der Anmeldeseite unter „Passwort vergessen?“ einen neuen Link an.",`<a class="btn btn-primary btn-ink btn-lg btn-block au-go" href="/login">Zur Anmeldung</a>`)};
  return {title:"Neues Passwort",html:authCard("Neues Passwort","Lege ein neues Passwort für dein Konto fest.",`<form class="au-form" novalidate>
   <label class="lbl" for="np1">Neues Passwort</label><div class="au-pw"><input id="np1" type="password" autocomplete="new-password" placeholder="Mindestens 8 Zeichen"><button type="button" class="au-eye" data-a="pwToggle" aria-label="Passwort anzeigen" aria-pressed="false">${ic("i-eye")}</button></div>
   <label class="lbl" for="np2">Passwort wiederholen</label><input class="inp" id="np2" type="password" autocomplete="new-password">
   <div class="err" id="npErr" role="alert"></div><button type="submit" class="btn btn-primary btn-ink btn-lg btn-block" data-a="npGo" data-v="${esc(t)}" data-off>Passwort speichern</button></form>`)};
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
  return {title:"Bestellung "+id,html:`<div id="ord"><div class="od-load" role="status"><span class="od-ring od-spin" aria-hidden="true"></span><p>Bestellung wird geladen …</p></div></div>`,
  after(){
    clearTimeout(pollT);const path=cur.path;let n=0,seen=null;
    const tick=async()=>{
      if(cur.path!==path)return;n++;let o;
      try{o=(await API(`/orders/${encodeURIComponent(id)}?k=${encodeURIComponent(k)}`)).order}
      catch(e){const el=$("#ord");if(el){el.innerHTML=`<section class="sec od-nf"><div class="card od-miss">${empty("Bestellung nicht gefunden",/nicht gefunden/i.test(e.message)?"Der Link ist unvollständig oder die Bestellung gehört zu einem Konto. Wenn du mit Konto bestellt hast, melde dich an.":esc(e.message),["/","Zur Startseite"])}<p class="od-sup">Den Link zu deiner Bestellung findest du in unserer E-Mail zur Zahlung. Fragen? <a href="mailto:${SUP()}">Schreib uns</a>.</p></div></section>`;$$(".rv",el).forEach(x=>x.classList.add("in"))}return}
      if(cur.path!==path)return;
      ordCache[id]=o;
      if(["processing","delivered"].includes(o.status)&&S.cartOrder===id){S.cart=[];S.promo=0;S.cartOrder=null;save();updBadges()}
      if(o.status!==seen){const el=$("#ord");el.innerHTML=orderView(o);$$(".rv",el).forEach(x=>x.classList.add("in"));fx(el);odHow(el);
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
  const done=o.status==="delivered",end=["canceled","refunded"].includes(o.status),wait=!done&&!end,paid=!!o.paid_at;
  const dealtB=[...new Set(o.items.map(i=>i.brand))].slice(0,3).map(brandOr);
  const card=(b,i)=>gc(b.art||b.img?b:{bg:b.bg,fg:b.fg,art:`<span class="wm" style="font-size:.3em;font-weight:800">${esc(b.name)}</span>`},{tilt:false,badge:false,plat:false,cls:"flash",style:"--i:"+i});
  /* Status-Bühne: Chrom-Ring läuft, solange wir arbeiten (Puls, leere Karte mit Lichtstreifen);
     bei Lieferung steht er still, die Karten werden einmal ausgeteilt, die Medaille trägt den Haken */
  const vis=`<div class="od-vis ${done?"is-done":end?"is-end":"is-wait"}" data-off aria-hidden="true"><span class="od-glow"></span><span class="od-ring"></span>${wait?`<span class="od-pulse"></span><span class="od-blank"><span class="gc"><span class="art">${LOGO(30)}<span class="lines"><i></i><i></i></span></span><i class="gc-glare"></i></span></span>`
    :done?`<span class="od-deal n${dealtB.length}">${dealtB.map(card).join("")}</span><span class="od-burst"><i></i><i></i></span><span class="od-medal">${ic("i-check")}</span>`:`<span class="od-x">${ic("i-x")}</span>`}</div>`;
  const payNow=["awaiting_payment","payment_pending"].includes(o.status);
  const steps=[["Bestellung aufgegeben",d(o.created_at),1],["Zahlung bestätigt",payNow?"wird bestätigt":d(o.paid_at),paid?1:payNow?2:0],["Codes werden vorbereitet",o.status==="processing"?"läuft gerade":"",o.status==="processing"?2:done?1:0],["Geliefert",d(o.delivered_at),done?1:0]];
  const tl=wait?`<ol class="tl" aria-label="Verlauf">${steps.map(s=>`<li class="tl-s${s[2]===2?" now":s[2]?" done":""}"${s[2]===2?' aria-current="step"':""}><span class="tl-d">${s[2]===1?ic("i-check"):""}</span><div><b>${s[0]}</b>${s[1]?`<small>${s[1]}</small>`:""}</div></li>`).join("")}</ol>`:"";
  /* Codes als Chrom-Karten; darunter die Einlöse-Schritte der Marke */
  let cn=0,how=0;
  const items=o.items.map(i=>{const b=brandOr(i.brand),many=i.codes&&i.codes.length>1,coded=done&&i.type!=="topup"&&!i.gift_to&&i.codes&&i.codes.length;
    const note=done?(i.type==="topup"?`Guthaben wurde auf ${esc(i.phone)} gebucht.`:i.gift_to?`Der Code wurde an ${esc(i.gift_to)} gesendet.`:"")
      :wait?(i.type==="topup"?`Das Guthaben wird auf ${esc(i.phone)} gebucht, sobald die Bestellung fertig ist.`:i.gift_to?`Der Code geht an ${esc(i.gift_to)}, sobald er fertig ist.`:"Dein Code erscheint hier, sobald er fertig ist."):"";
    return `<article class="card od-item"><div class="od-ih">${mini(b)}<div><b>${esc(i.name)}</b><small>${b.amts?esc(optLabel(b,i.face/100)):eurc(i.face)} × ${i.qty}${i.phone?" · "+esc(i.phone):""}${i.gift_to?" · Geschenk an "+esc(i.gift_to):""}</small></div></div>
  ${note?`<p class="od-note${done?" ok":""}">${done?ic("i-check"):`<span class="od-dot" aria-hidden="true"></span>`}<span>${note}</span></p>`:""}
  ${coded?i.codes.map((c,j)=>{const k="oc"+(++cn);return `<div class="od-code" style="--g:${glowOf(b)};--j:${cn-1}"><div class="od-code-t"><span class="od-code-l" id="${k}l">${many?`Code ${j+1} von ${i.codes.length}`:"Dein Code"}</span>${LOGO(24)}</div><code class="od-code-v" id="${k}" data-code="${esc(c)}" aria-labelledby="${k}l ${k}">${esc(mask(c))}</code><div class="od-code-a"><button class="btn btn-soft" data-a="codeShow" data-v="${esc(c)}" aria-controls="${k}" aria-pressed="false">${ic("i-eye")}<span>Zeigen</span></button><button class="btn btn-primary" data-a="codeCopy" data-v="${esc(c)}">${ic("i-copy")}<span>Code kopieren</span></button>${ruBtn(b,{cls:"btn-soft od-go",text:"Jetzt einlösen",sr:`auf ${esc(ruDom(b.ru&&b.ru.url))}, der Code wird dabei kopiert `,attrs:` data-a="codeGo" data-v="${esc(c)}"`})}</div><i class="od-code-gl" aria-hidden="true"></i></div>`}).join("")
    +`<details class="od-how" data-b="${esc(i.brand)}"${how++?"":" open"}><summary><span>So löst du den Code ein</span>${ic("i-down")}</summary><ol>${redeemSteps(b).map(x=>`<li>${esc(x)}</li>`).join("")}</ol></details>`:""}</article>`}).join("");
  /* Beleg: Daten, Positionen, Summe; drucken oder Rechnung anfordern */
  const sumRows=`<div class="sumrow"><span>Zwischensumme</span><span>${eurc(o.subtotal)}</span></div>${o.discount?`<div class="sumrow ok"><span>Rabatt</span><span>−${eurc(o.discount)}</span></div>`:""}${o.fee?`<div class="sumrow"><span>Servicegebühr</span><span>${eurc(o.fee)}</span></div>`:""}<div class="sumrow tot"><span>Gesamt</span><span>${eurc(o.total)}</span></div>${o.vat?`<div class="sumrow vatrow"><span>darin ${String(VATR()||19).replace(".",",")} % MwSt.</span><span>${eurc(o.vat)}</span></div>`:""}`;
  const meta=[["Bestellnummer",esc(o.id)],["Bestellt am",d(o.created_at)],paid&&["Bezahlt am",d(o.paid_at)],o.delivered_at&&["Geliefert am",d(o.delivered_at)],["E-Mail",esc(o.email)]].filter(Boolean);
  const sup=`mailto:${SUP()}?subject=${encodeURIComponent("Bestellung "+o.id)}`,inv=`mailto:${SUP()}?subject=${encodeURIComponent("Rechnung zu Bestellung "+o.id)}`;
  const rc=`<section class="card od-rc" aria-labelledby="odRcH"><h2 class="od-h2" id="odRcH">${paid?"Beleg":"Übersicht"}</h2><p class="od-rc-pr">instantcodes – Beleg zur Bestellung ${esc(o.id)}</p>
   <dl class="od-rc-m">${meta.map(r=>`<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join("")}</dl>
   <ul class="od-rc-l">${o.items.map(i=>{const b=brandOr(i.brand);return `<li><span>${esc(i.name)}<small>${b.amts?esc(optLabel(b,i.face/100)):eurc(i.face)} × ${i.qty}</small></span><span>${eurc((i.unit!=null?i.unit:i.face)*i.qty)}</span></li>`}).join("")}</ul>
   <div class="pb-sum">${sumRows}</div>
   ${paid?`<div class="od-rc-a"><button class="btn btn-soft btn-sm" data-a="odPrint">${ic("i-receipt")}Beleg drucken</button><a class="btn btn-ghost btn-sm" href="${inv}">Rechnung anfordern</a></div>`:""}</section>`;
  const hasCodes=done&&o.items.some(i=>i.type!=="topup"&&!i.gift_to&&i.codes&&i.codes.length);
  return `<div class="od" data-st="${esc(o.status)}">
<section class="od-stage chrome-rim" aria-labelledby="odH">${vis}<div class="od-copy"><h1 class="od-h" id="odH">${H[0]}</h1>${H[1]?`<p class="od-lead">${H[1]}</p>`:""}<p class="od-meta">${stBadge(o.status)}<span>Bestellnummer ${esc(o.id)}</span></p>${tl}</div></section>
<div class="od-body">
 <div class="od-main"><h2 class="od-sh">${hasCodes?"Deine Codes":end?"Bestellte Artikel":"Deine Bestellung"}</h2>${items}${reviewBox(o)}${typeof rvOptBox==="function"?rvOptBox(o)/* Bewertungsanfrage per E-Mail, freiwillig (71-newsletter.js) */:""}</div>
 <aside class="od-side" aria-label="Beleg und weitere Schritte">${rc}
  ${odAcct(o)/* Gast: „Konto mit einem Tipp anlegen“ (52-passkey.js) */}
  <div class="od-acts">${done?`<button class="btn btn-soft" data-a="reorderLive" data-v="${esc(o.id)}">${ic("i-repeat")}Erneut kaufen</button>`:`<a class="btn btn-soft" href="/hilfe">${ic("i-help")}Hilfe</a>`}<a class="btn btn-primary" href="/">Weiter einkaufen</a></div>
  <p class="od-sup">${done?"Problem mit einem Code?":"Fragen zur Bestellung?"} <a href="${sup}">Schreib uns</a> – mit Bestellnummer geht es am schnellsten.</p>
 </aside>
</div></div>`;
}
/* Einlöse-Schritte von Reloadly-Produkten nachladen (wie auf der Produktseite) */
const odHow=el=>$$(".od-how[data-b]",el).forEach(dt=>{const b=byId(dt.dataset.b);if(!b||!b.rl)return;
  API("/product/"+encodeURIComponent(b.id)).then(j=>{const st=j&&j.redeem?String(j.redeem).replace(/<[^>]+>/g," ").split(/(?<=[.!])\s+|\n+|\r+/).map(x=>x.trim()).filter(x=>x.length>2).slice(0,8):[];
    if(st.length&&dt.isConnected)$("ol",dt).innerHTML=st.map(x=>`<li>${esc(x)}</li>`).join("")}).catch(()=>{})});
A.odPrint=()=>{try{window.print()}catch(e){}};
A.codeShow=(c,el)=>{const s=document.getElementById(el.getAttribute("aria-controls")),shown=el.getAttribute("aria-pressed")==="true";s.textContent=shown?mask(c):c;el.setAttribute("aria-pressed",String(!shown));el.lastElementChild.textContent=shown?"Zeigen":"Verbergen"};
/* Kopieren mit Rückmeldung am Knopf; Ausweichweg für ältere Browser */
const odClip=async t=>{try{await navigator.clipboard.writeText(t);return true}catch(e){const a=document.createElement("textarea");a.value=t;a.setAttribute("readonly","");a.style.cssText="position:fixed;top:0;left:0;opacity:0";document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand("copy")}catch(x){}a.remove();return ok}};
A.codeCopy=async(c,el)=>{const ok=await odClip(c);if(!ok){toast("Kopieren nicht möglich. Tippe auf „Zeigen“ und markiere den Code.");return}toast("Code kopiert");
  const cd=el&&el.closest(".od-code");if(cd){cd.classList.remove("swept");void cd.offsetWidth;cd.classList.add("swept")}/* kurzer Glanz über die Chrom-Karte */
  if(el&&el.lastElementChild){clearTimeout(el._t);el.classList.add("done");el.lastElementChild.textContent="Kopiert";el._t=setTimeout(()=>{el.classList.remove("done");el.lastElementChild.textContent="Code kopieren"},2200)}};
/* „Jetzt einlösen“: Link öffnet die offizielle Seite im neuen Tab, der Code liegt dann schon in der Zwischenablage */
A.codeGo=async c=>{if(await odClip(c))toast("Code kopiert. Füge ihn auf der Einlöse-Seite ein.")};
/* Bewertung nach der Lieferung (erscheint als verifizierter Kauf). Der Trustpilot-Link steht allen offen – unabhängig von den Sternen. */
const RLBL=["","Schlecht","Geht so","In Ordnung","Gut","Sehr gut"];
const reviewBox=o=>{if(o.status!=="delivered")return "";
  if(o.reviewed)return `<div class="card rform rform-done rv"><span class="rf-medal" aria-hidden="true">${ic("i-check")}</span><div><b>Danke für deine Bewertung!</b><p>Sie erscheint im Shop als verifizierter Kauf.</p>${tpLink({cls:"rf-tp",text:"Auch auf Trustpilot bewerten"})}</div></div>`;
  rStars=0;
  return `<div class="card rform rv" id="rForm"><h2 class="od-h2">Wie zufrieden bist du?</h2><p>Deine Bewertung erscheint im Shop als verifizierter Kauf.</p><div class="starpick" role="group" aria-label="Sterne vergeben">${[1,2,3,4,5].map(i=>`<button type="button" data-a="rStar" data-v="${i}" aria-pressed="false" aria-label="${i} ${i>1?"Sterne":"Stern"}: ${RLBL[i]}" style="--k:${i-1}">${ic("i-star")}</button>`).join("")}<span class="rf-lbl" id="rLbl" aria-live="polite"></span></div><label class="lbl" for="rText">Deine Erfahrung (optional)</label><textarea class="inp" id="rText" maxlength="600" placeholder="Was hat dir gefallen? Was können wir besser machen?"></textarea><label class="lbl" for="rName">Name (wird abgekürzt angezeigt)</label><input class="inp" id="rName" maxlength="40" autocomplete="name" placeholder="z. B. Lena Hoffmann" value="${esc(S.user?S.user.name:"")}"><div class="err" id="rErr" role="alert"></div><button class="btn btn-primary btn-block" data-a="rSend" data-v="${esc(o.id)}">Bewertung senden</button>${tpLink()?`<div class="rf-alt"><span>Lieber öffentlich?</span>${tpLink()}</div>`:""}</div>`};
let rStars=0;
A.rStar=v=>{rStars=+v;$$(".starpick button").forEach(b=>{b.classList.toggle("on",+b.dataset.v<=rStars);b.setAttribute("aria-pressed",String(+b.dataset.v===rStars))});const l=$("#rLbl");if(l)l.textContent=RLBL[rStars]||"";const e=$("#rErr");if(e)e.textContent=""};
A.rSend=async(id,el)=>{if(!rStars){$("#rErr").textContent="Bitte wähle 1 bis 5 Sterne.";return}busy(el,true);try{await API("/reviews",{method:"POST",body:{order:id,k:(S.keys&&S.keys[id])||"",rating:rStars,text:$("#rText").value,name:$("#rName").value}});REV=null;Object.keys(REVB).forEach(k=>delete REVB[k]);const f=$("#rForm");if(f)f.outerHTML=reviewBox({status:"delivered",reviewed:true}).replace(" rv","");toast("Danke für deine Bewertung!")}catch(x){$("#rErr").textContent=x.message;busy(el,false)}};
A.reorderLive=id=>{const o=ordCache[id];if(!o)return;let n=0;o.items.forEach(i=>{const b=byId(i.brand);if(b&&b.amts.includes(i.face/100)){addCart({id:i.brand,a:i.face/100,q:i.qty,type:i.type,phone:i.phone||undefined},true);n++}});toast(n?"Wieder im Warenkorb":"Diese Artikel gibt es nicht mehr",n?["/warenkorb","Ansehen"]:null)};

/* Konto */
A.numDel=i=>{S.numbers.splice(+i,1);save();route(true);toast("Nummer gelöscht")};
function apiAccount(tab){
  if(!S.user)return apiLogin(null,new URLSearchParams("r=/konto"+(tab?"/"+tab:"")));
  const u=S.user,T=[["bestellungen","Bestellungen","i-receipt"],["abos","Abos","i-repeat"],["favoriten","Favoriten","i-heart"],["nummern","Nummern","i-phone-f"],["einstellungen","Einstellungen","i-gear"]];
  if(!T.some(t=>t[0]===tab))tab="bestellungen";
  let body=`<div id="accBody" class="acc-wait"><div class="spin"></div></div>`;
  if(tab==="favoriten"){const f=S.favs.map(byId).filter(Boolean);body=f.length?`<div class="tiles">${f.map(tile).join("")}</div>`:`<div class="card acc-none">${empty("Noch keine Favoriten","Tippe auf einer Produktseite auf das Herz, um eine Marke hier zu speichern.",["/kategorien","Marken entdecken"])}</div>`}
  if(tab==="nummern")body=S.numbers.length?`<div class="card acc-set">${S.numbers.map((x,i)=>{const o=byId(x.op),cc=COUNTRIES.find(c=>c.c===x.c)||COUNTRIES[0];return `<div class="setrow"><span class="si-ic">${flag(cc.c,22)}</span><div class="mid"><b>${cc.dial} ${esc(x.n)}</b><small>${o?esc(o.name):"Anbieter unbekannt"}</small></div><a class="btn btn-soft btn-sm" href="/aufladen?n=${encodeURIComponent(x.n)}&op=${encodeURIComponent(x.op||"")}">Aufladen</a><button class="acc-rm" data-a="numDel" data-v="${i}" aria-label="Nummer ${esc(x.n)} löschen">${ic("i-trash")}</button></div>`}).join("")}</div><p class="acc-fine">Gespeicherte Nummern liegen nur auf diesem Gerät.</p>`
    :`<div class="card acc-none">${empty("Noch keine Nummern","Nach einer Aufladung kannst du die Nummer hier speichern. Sie liegt nur auf diesem Gerät.",["/aufladen","Handy aufladen"])}</div>`;
  if(tab==="einstellungen")body=`<div class="card acc-set">
   <div class="setrow"><span class="si-ic">${ic("i-mail")}</span><div class="mid"><b>E-Mail</b><small>${esc(u.email)}</small></div></div>
   <div class="setrow"><span class="si-ic">${ic("i-bell")}</span><div class="mid"><b id="alL">Anmelde-Hinweise per E-Mail</b><small>Wir schreiben dir bei jeder neuen Anmeldung.</small></div><button class="switch" role="switch" aria-checked="${!!u.loginAlerts}" data-a="alerts" aria-labelledby="alL"></button></div>
   ${typeof consentRows==="function"?consentRows()/* Bewertungsanfragen + Newsletter (71-newsletter.js) */:""}
   <button class="setrow" data-a="country"><span class="si-ic">${flag(ctry().c,22)}</span><div class="mid"><b>Land für Aufladungen</b><small>${esc(ctry().n)}</small></div>${ic("i-chev")}</button></div>
   <h2 class="acc-sh" id="pkH">Passkeys</h2>
   <section class="card acc-set acc-pk" aria-labelledby="pkH"><div id="pkList" class="pk-list" aria-live="polite"><div class="pk-wait"><span class="spin"></span></div></div>
    ${pkCan()?`<div class="pk-add"><p>Anmelden mit Face ID, Touch ID oder Windows Hello – ohne Passwort und ohne Code.</p><button class="btn btn-primary btn-sm" data-a="pkAdd">${ic("i-plus")}Passkey hinzufügen</button></div>`:`<p class="pk-none">In diesem Browser kannst du keinen Passkey anlegen.</p>`}</section>
   <div class="acc-out"><button class="btn btn-soft btn-block btn-lg" data-a="logout">${ic("i-logout")}Abmelden</button><button class="btn btn-ghost btn-block acc-del" data-a="delAcc">Konto löschen</button></div>`;
  return {title:"Mein Konto",html:`<div class="acc sec">
<header class="acc-head rv"><span class="acc-av" data-off aria-hidden="true">${esc(initials(u.name))}</span><div class="acc-hi"><h1 class="acc-h">Hallo, ${esc(u.name.split(" ")[0])}</h1><p class="acc-p">Deine Bestellungen, Abos, Favoriten und Einstellungen.</p></div><span class="gc ink tilt acc-card" aria-hidden="true"><span class="art"><span class="mc-top">${LOGO(30)}instantcodes</span><span class="mc-name">${esc(u.name)}</span><span class="mc-mail">${esc(u.email)}</span></span><i class="gc-glare"></i><i class="rim"></i></span></header>
${accQaHTML(tab)/* Schnellaktionen (52-passkey.js) */}
<nav class="acc-tabs" aria-label="Kontobereiche">${T.map(t=>`<a href="/konto/${t[0]}"${t[0]===tab?' aria-current="page"':""}>${ic(t[2])}<span>${t[1]}</span></a>`).join("")}</nav>
<div class="acc-body">${body}</div></div>`,
  after(){
    const op=API("/orders");accQa(op);
    if(tab==="einstellungen"){pkMount();if(typeof consentMount==="function")consentMount()}
    if(tab==="abos")return aboAccount();
    if(tab!=="bestellungen")return;
    op.then(j=>{const el=$("#accBody");if(!el)return;j.orders.forEach(o=>ordCache[o.id]=o);el.classList.remove("acc-wait");
      el.innerHTML=j.orders.length?`<div class="acc-list">${j.orders.map(o=>{const n=o.items.reduce((s,i)=>s+(i.qty||1),0);const rate=o.status==="delivered"&&o.reviewed===false;/* Gelieferte, noch nicht bewertete Bestellung: „Bewerten“ führt zum Formular auf der Bestellseite */
        return `<div class="acc-row${rate?" can-rate":""}"><a class="card acc-ord" href="/bestellung/${o.id}"><span class="acc-fan" aria-hidden="true">${o.items.slice(0,3).map(i=>mini(brandOr(i.brand))).join("")}</span><span class="acc-om"><b>${new Date(o.created_at).toLocaleDateString("de-DE",{dateStyle:"medium"})}</b><small>${n} Artikel · ${esc(o.id)}</small>${stBadge(o.status)}</span><b class="acc-or">${eurc(o.total)}</b>${ic("i-chev")}</a>${rate?`<div class="acc-rate"><span>Wie zufrieden warst du?</span><a class="btn btn-soft btn-sm" href="/bestellung/${o.id}?bewerten=1">${ic("i-star")}Bewerten<span class="sr"> (Bestellung ${esc(o.id)})</span></a></div>`:""}</div>`}).join("")}</div>`
        :`<div class="card acc-none">${empty("Noch keine Bestellungen","Deine Bestellungen und Codes erscheinen hier.",["/","Jetzt stöbern"])}</div>`;
    }).catch(e=>{const el=$("#accBody");if(el){el.classList.remove("acc-wait");el.innerHTML=`<p class="err">${esc(e.message)}</p>`}});
  }};
}
A.alerts=async(v,el)=>{const on=el.getAttribute("aria-checked")!=="true";el.setAttribute("aria-checked",on);try{setUser((await API("/me",{method:"PATCH",body:{loginAlerts:on}})).user)}catch(e){toast(e.message);el.setAttribute("aria-checked",!on)}};
A.logout=async()=>{try{await API("/auth/logout",{method:"POST"})}catch(e){}setUser(null);toast("Abgemeldet");go("/")};
A.delAcc=()=>openSheet(`<div class="sheet-h"><h3>Konto löschen?</h3><button class="x" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button></div><p class="acc-sheet-p">Dein Konto wird gelöscht. Bestell- und Rechnungsdaten bewahren wir nur so lange auf, wie es gesetzlich vorgeschrieben ist.</p><div class="acc-sheet-a"><button class="btn btn-soft" data-a="closeSheet">Abbrechen</button><button class="btn acc-danger" data-a="delAccGo">Konto löschen</button></div>`);
A.delAccGo=async(_,el)=>{busy(el,true);try{await API("/me",{method:"DELETE"});setUser(null);closeSheet(true);toast("Konto gelöscht");go("/")}catch(e){busy(el,false);toast(e.message)}};

/* Rechtstexte – bei inhaltlichen Änderungen auch LEGAL_STAND anpassen */
const LEGAL_STAND="November 2026";
const IMP="https://mein.online-impressum.de/instacode/";
const SUP=()=>(CFG.support)||"support@instacode.store";
const LEGAL={
 agb:["Allgemeine Geschäftsbedingungen",()=>`
<h2>1. Geltungsbereich und Anbieter</h2>
<p>Diese AGB gelten für alle Bestellungen über den Onlineshop ${esc(CFG.site||"instantcodes")}. Anbieter und Vertragspartner ist der im <a href="${IMP}" target="_blank" rel="noopener">Impressum</a> genannte Betreiber. Abweichende Bedingungen des Kunden gelten nicht.</p>
<h2>2. Angebot</h2>
<p>Wir verkaufen digitale Produkte: Guthaben- und Geschenkkarten-Codes, Spiele-Keys sowie Handy-Guthaben (Aufladungen). Die Codes stammen von autorisierten Distributoren. Die Einlösung erfolgt ausschließlich beim jeweiligen Herausgeber (z.&nbsp;B. Apple, Google, Sony, Valve, Netzbetreiber) nach dessen Bedingungen. Regionale Beschränkungen sind in der Produktbeschreibung angegeben.</p>
<h2>3. Vertragsschluss</h2>
<p>Die Darstellung im Shop ist kein bindendes Angebot. Mit Klick auf den Bezahl-Button gibst du ein verbindliches Angebot ab. Der Vertrag kommt zustande, wenn wir die Bestellung per E-Mail bestätigen oder den Code ausliefern. Vertragssprache ist Deutsch.</p>
<h2>4. Preise und Zahlung</h2>
<p>Alle Preise sind Endpreise in Euro inklusive der gesetzlichen Mehrwertsteuer. Pro Bestellung fällt zusätzlich eine Servicegebühr an (derzeit ${feeTxt()||"keine"}), die im Warenkorb und vor Abschluss der Bestellung ausgewiesen und im Gesamtpreis enthalten ist. Versandkosten fallen nicht an. Die Zahlung erfolgt über unseren Zahlungsdienstleister Stripe mit den im Bestellvorgang angezeigten Zahlungsarten (z.&nbsp;B. Kreditkarte, Apple Pay, Google Pay). Der Betrag wird bei der Bestellung belastet.</p>
<h2>5. Lieferung</h2>
<p>Codes werden nach Zahlungseingang per E-Mail und in deinem Kundenkonto bereitgestellt, in der Regel innerhalb weniger Minuten. Aufladungen werden direkt auf die angegebene Rufnummer gebucht. Zum Schutz vor Betrug können einzelne Bestellungen manuell geprüft werden. Das kann bis zu 24 Stunden dauern. Ist eine Lieferung nicht möglich, erstatten wir den vollen Betrag.</p>
<h2>6. Abos (Pro, Premium, Max)</h2>
<p><b>6.1 Leistung.</b> Mit einem Abo bekommst du jeden Abo-Monat ein Paket mit digitalen Codes (Guthaben- und Abo-Codes für die auf der <a href="/abo">Abo-Seite</a> genannten Dienste). Welche Codes mit welchem Nennwert enthalten sind, steht auf der Abo-Seite und in der Bestätigung nach dem Abschluss. Codes, die länger als einen Monat gelten, liefern wir in passenden Abständen, zum Beispiel alle drei Monate. Ist ein Code dauerhaft nicht lieferbar, dürfen wir ihn durch einen gleichwertigen Code ersetzen; der Nennwert des Monatspakets sinkt dadurch nicht. Über Änderungen am Paket informieren wir dich vorab per E-Mail.</p>
<p><b>6.2 Preise und Abbuchung.</b> Pro kostet 30&nbsp;€ pro Monat, Premium 50&nbsp;€ für drei Monate und Max 80&nbsp;€ für sechs Monate. Das sind Endpreise; eine Servicegebühr fällt bei Abos nicht an. Der Preis wird zu Beginn jeder Laufzeit im Voraus über Stripe von der beim Abschluss gewählten Zahlungsart abgebucht. Die erste Laufzeit beginnt mit der Zahlung.</p>
<p><b>6.3 Laufzeit und Verlängerung.</b> Die erste Laufzeit beträgt bei Pro einen Monat, bei Premium drei Monate und bei Max sechs Monate. Kündigst du nicht, verlängert sich das Abo automatisch um die gleiche Laufzeit. Der Preis der neuen Laufzeit wird zu deren Beginn abgebucht.</p>
<p><b>6.4 Kündigung.</b> Pro kannst du jederzeit zum Ende des bezahlten Monats kündigen. Premium und Max kannst du frühestens zum Ende der ersten Laufzeit kündigen. Nach einer Verlängerung kannst du jederzeit mit einer Frist von einem Monat kündigen; spätestens endet das Abo dann mit Ablauf der bezahlten Laufzeit. Du kannst auch einen späteren Termin wählen. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Kündigen kannst du ohne Anmeldung über <a href="/kuendigen">Verträge hier kündigen</a>, in deinem Kundenkonto unter Abos oder per E-Mail an <a href="mailto:${SUP()}">${SUP()}</a>. Du bekommst sofort eine Bestätigung mit Eingangszeitpunkt und Vertragsende.</p>
<p><b>6.5 Anteilige Erstattung.</b> Endet ein Abo vor dem Ende der bezahlten Laufzeit, zum Beispiel nach einer Verlängerung oder aus wichtigem Grund, erstatten wir für jeden Abo-Monat, der erst nach dem Vertragsende beginnen würde und deshalb nicht mehr geliefert wird, den entsprechenden Anteil des Preises über deine ursprüngliche Zahlungsart. Bereits begonnene und gelieferte Monate werden nicht erstattet.</p>
<p><b>6.6 Lieferung.</b> Ein Abo-Monat beginnt jeweils am Kalendertag des Abschlusses. Zu Beginn jedes Abo-Monats stellen wir das Paket zusammen und prüfen es zum Schutz vor Missbrauch vor dem Versand. Das dauert in der Regel wenige Stunden, an Wochenenden und Feiertagen auch länger. Die Codes bekommst du per E-Mail; sie stehen außerdem in deiner Abo-Übersicht. Solange eine fällige Zahlung offen ist, pausieren die Lieferungen.</p>
<p><b>6.7 Persönliche Nutzung.</b> Die Codes sind für deinen persönlichen Gebrauch bestimmt; ein gewerblicher Weiterverkauf ist nicht erlaubt. Bei konkreten Anhaltspunkten für Missbrauch, etwa Weiterverkauf oder Zahlungsbetrug, dürfen wir einzelne Lieferungen zurückhalten und das Abo aus wichtigem Grund kündigen. Bezahlte, nicht gelieferte Monate erstatten wir dann.</p>
<p><b>6.8 Einlösung.</b> Du löst die Codes in deinem eigenen Konto beim jeweiligen Dienst nach dessen Bedingungen ein. Wie lange ein Code dein Abo beim Dienst abdeckt, hängt von deinem dortigen Tarif ab; Restguthaben bleibt beim Dienst. Amazon-Guthaben gilt für Einkäufe auf Amazon.de, nicht für die Prime-Mitgliedschaft.</p>
<p><b>6.9 Zahlungsprobleme.</b> Schlägt eine Abbuchung fehl, versucht unser Zahlungsdienstleister sie in den folgenden Tagen erneut, und du bekommst eine E-Mail mit einem Link zum Bezahlen. Bleibt die Zahlung aus, endet das Abo.</p>
<p><b>6.10 Widerruf.</b> Es gilt Abschnitt 8 und die <a href="/widerruf">Widerrufsbelehrung</a>. Beim Abo erlischt das Widerrufsrecht mit der ersten Lieferung von Codes, wenn du beim Abschluss ausdrücklich zugestimmt hast, dass wir vor Ablauf der Widerrufsfrist liefern, und bestätigt hast, dass du damit dein Widerrufsrecht verlierst. Bis zur ersten Lieferung kannst du widerrufen und bekommst den vollen Betrag zurück.</p>
<h2>7. Pflichten des Kunden</h2>
<p>Du bist für die Richtigkeit der E-Mail-Adresse und Rufnummer verantwortlich. Für Aufladungen auf eine falsch angegebene Nummer können wir keinen Ersatz leisten, wenn die Buchung bereits erfolgt ist. Codes sind wie Bargeld zu behandeln und nicht an Dritte weiterzugeben, die du nicht kennst.</p>
<h2>8. Widerrufsrecht</h2>
<p>Verbrauchern steht ein Widerrufsrecht nach Maßgabe der <a href="/widerruf">Widerrufsbelehrung</a> zu. Bei digitalen Inhalten erlischt es, wenn du der sofortigen Ausführung ausdrücklich zugestimmt und deine Kenntnis vom Verlust des Widerrufsrechts bestätigt hast.</p>
<h2>9. Gewährleistung</h2>
<p>Es gilt das gesetzliche Mängelhaftungsrecht. Ist ein gelieferter Code nicht einlösbar, melde dich bitte unter <a href="mailto:${SUP()}">${SUP()}</a> mit Bestellnummer und, wenn möglich, einem Screenshot der Fehlermeldung. Wir prüfen den Fall beim Distributor und liefern Ersatz oder erstatten den Kaufpreis.</p>
<h2>10. Haftung</h2>
<p>Wir haften unbeschränkt bei Vorsatz, grober Fahrlässigkeit und bei Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vorhersehbaren, vertragstypischen Schaden begrenzt. Im Übrigen ist die Haftung ausgeschlossen.</p>
<h2>11. Streitbeilegung</h2>
<p>Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
<h2>12. Schlussbestimmungen</h2>
<p>Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Bei Verbrauchern gilt diese Rechtswahl nur, soweit dadurch nicht der Schutz zwingender Bestimmungen des Staates entzogen wird, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat.</p>`],
 widerruf:["Widerrufsbelehrung",()=>`
<h2>Widerrufsrecht</h2>
<p>Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsschlusses.</p>
<p>Um dein Widerrufsrecht auszuüben, musst du uns (Kontaktdaten siehe <a href="${IMP}" target="_blank" rel="noopener">Impressum</a>, E-Mail: <a href="mailto:${SUP()}">${SUP()}</a>) mittels einer eindeutigen Erklärung (z.&nbsp;B. per E-Mail) über deinen Entschluss, diesen Vertrag zu widerrufen, informieren. Du kannst dafür das unten stehende Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist. Zur Wahrung der Frist reicht es aus, dass du die Mitteilung vor Ablauf der Widerrufsfrist absendest.</p>
<h2>Folgen des Widerrufs</h2>
<p>Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir von dir erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über deinen Widerruf bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen Transaktion eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes vereinbart. In keinem Fall werden dir wegen dieser Rückzahlung Entgelte berechnet.</p>
<h2>Vorzeitiges Erlöschen des Widerrufsrechts</h2>
<p>Das Widerrufsrecht erlischt bei Verträgen über die Bereitstellung von nicht auf einem körperlichen Datenträger befindlichen digitalen Inhalten (z.&nbsp;B. Codes und Keys), wenn wir mit der Ausführung des Vertrags begonnen haben, nachdem du ausdrücklich zugestimmt hast, dass wir vor Ablauf der Widerrufsfrist mit der Ausführung beginnen, du deine Kenntnis davon bestätigt hast, dass du durch deine Zustimmung mit Beginn der Ausführung dein Widerrufsrecht verlierst, und wir dir eine Bestätigung des Vertrags zur Verfügung gestellt haben (§ 356 Abs. 5 BGB). Bei Dienstleistungen wie Handy-Aufladungen erlischt das Widerrufsrecht, wenn die Leistung vollständig erbracht wurde und du vorher ausdrücklich zugestimmt hast (§ 356 Abs. 4 BGB).</p>
<p>Bei Abos beginnt die Ausführung mit der ersten Lieferung von Codes. Hast du beim Abschluss zugestimmt, dass wir vor Ablauf der Widerrufsfrist liefern, und bestätigt, dass du dadurch dein Widerrufsrecht verlierst, erlischt es mit dieser ersten Lieferung. Bis dahin kannst du widerrufen; wir erstatten dann den vollen Betrag. Kündigen kannst du das Abo unabhängig davon jederzeit nach den AGB über <a href="/kuendigen">Verträge hier kündigen</a>.</p>
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
<li><b>Newsletter:</b> Nur mit deiner Einwilligung und erst nach Bestätigung über den Link in unserer E-Mail (Double-Opt-in). Wir speichern deine E-Mail-Adresse, Zeitpunkt und Quelle der Anmeldung und der Bestätigung sowie einen Hashwert der IP-Adresse als Nachweis. Abmelden kannst du dich jederzeit über den Link in jeder E-Mail, im Konto oder per Nachricht an uns. Rechtsgrundlage: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 7 Abs. 2 UWG); Nachweis: Art. 6 Abs. 1 lit. c DSGVO.</li>
<li><b>Bewertungsanfrage:</b> Nur wenn du im Konto oder auf der Bestellseite zugestimmt hast, fragen wir dich einige Tage nach der Lieferung einmal per E-Mail nach deiner Meinung. Widerruf jederzeit über den Link in der E-Mail oder im Konto. Rechtsgrundlage: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).</li>
<li><b>Bewertungen:</b> Name, Sterne und Text, die du freiwillig nach einer Bestellung abgibst. Rechtsgrundlage: Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).</li>
<li><b>Abos:</b> Name, E-Mail-Adresse, gewählter Plan, Zahlungs- und Laufzeitdaten von Stripe, gelieferte Codes sowie Kündigungserklärungen mit Eingangszeitpunkt. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) und gesetzliche Nachweispflichten (Art. 6 Abs. 1 lit. c DSGVO).</li>
</ul>
<h2>3. Dienstleister</h2>
<ul>
<li><b>Hosting:</b> Railway Corporation, USA. Die Server und die Datenbank stehen in der EU (Niederlande). Grundlage für etwaige Übermittlungen in die USA: EU-Standardvertragsklauseln.</li>
<li><b>Zahlung:</b> Stripe Payments Europe Ltd., Irland. Stripe verarbeitet deine Zahlungsdaten (z.&nbsp;B. Karte, Apple Pay, Google Pay) selbst; wir erhalten keine vollständigen Kartendaten. Stripe kann zur Betrugsprävention Daten an Stripe Inc., USA übermitteln (EU-U.S. Data Privacy Framework). Datenschutz: stripe.com/de/privacy.</li>
<li><b>E-Mail-Versand:</b> Resend (Plus Five Five, Inc.), USA, für Bestellbestätigungen, Codes und Konto-E-Mails. Grundlage: EU-Standardvertragsklauseln.</li>
<li><b>Bezug von Codes und Aufladungen:</b> Reloadly Inc., USA. Für Handy-Aufladungen übermitteln wir die Rufnummer und den Betrag, für Codes nur Produkt und Menge, keine Kundendaten. Grundlage: Art. 6 Abs. 1 lit. b DSGVO und EU-Standardvertragsklauseln.</li>
<li><b>Domain und E-Mail-Postfach:</b> STRATO GmbH, Deutschland.</li>
${CFG.google?`<li><b>Anmeldung mit Google:</b> Google Ireland Ltd. Nur wenn du diese Anmeldung wählst, erhalten wir Name und E-Mail von Google.</li>`:""}
${CFG.trustpilot&&CFG.trustpilot.widget?`<li><b>Trustpilot:</b> Trustpilot A/S, Dänemark. Das Bewertungs-Widget lädt nur nach deiner Einwilligung im Cookie-Banner.</li>`:""}
</ul>
<h2>4. Chat mit der KI-Beraterin (Anthropic)</h2>
<p>Im Shop kannst du dich im Chat von einer digitalen Beraterin unterstützen lassen. Ihre Antworten erzeugt ein KI-Modell der Anthropic PBC, USA. Dafür übermitteln wir Daten an Anthropic, und zwar nur, wenn du den Chat nutzt, also eine Nachricht schickst oder einen Vorschlag der Beraterin annimmst. Ohne Nutzung des Chats geht nichts an Anthropic.</p>
<ul>
<li><b>Welche Daten:</b> deine Chat-Nachrichten und die Shop-Daten, die für die Beratung nötig sind: zuletzt angesehene Produkte, der Inhalt deines Warenkorbs und die gewählten Beträge. Zahlungsdaten übermitteln wir nicht. Bitte gib im Chat keine Codes, Passwörter oder Zahlungsdaten ein.</li>
<li><b>Zweck und Rechtsgrundlage:</b> Beantwortung deiner Fragen und Hilfe bei der Auswahl, also Durchführung vorvertraglicher Maßnahmen und Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO), sowie unser berechtigtes Interesse an einer schnellen und hilfreichen Beratung (Art. 6 Abs. 1 lit. f DSGVO).</li>
<li><b>Übermittlung in die USA:</b> Anthropic verarbeitet die Daten in den USA. Grundlage ist der Angemessenheitsbeschluss der EU-Kommission zum EU-U.S. Data Privacy Framework, soweit Anthropic danach zertifiziert ist, im Übrigen EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO).</li>
<li><b>Widerspruch:</b> Du kannst den Shop vollständig ohne Chat nutzen. Einer Verarbeitung auf Grundlage berechtigter Interessen kannst du jederzeit widersprechen (siehe Abschnitt 7).</li>
</ul>
${/* VOM INHABER ZU PRÜFEN: Zertifizierung von Anthropic unter dem EU-U.S. Data Privacy Framework (dataprivacyframework.gov) bzw. abgeschlossene Standardvertragsklauseln (Anthropic Data Processing Addendum) bestätigen und den Abschnitt danach anpassen. Der Hinweis erscheint nur im Testmodus. */""}${CFG.testmode?`<p class="lgl-check">Nur in der Vorschau sichtbar – vom Inhaber zu prüfen: Ist Anthropic unter dem EU-U.S. Data Privacy Framework zertifiziert, und sind die Standardvertragsklauseln (Data Processing Addendum) abgeschlossen? Abschnitt danach anpassen.</p>`:""}
<h2>5. Cookies und lokaler Speicher</h2>
<p>Wir verwenden nur technisch notwendige Cookies und lokalen Speicher für Anmeldung, Warenkorb, Spracheinstellungen und die sichere Zahlung (§ 25 Abs. 2 TDDDG). Es gibt kein Tracking und keine Werbung. Die Stripe-Zahlungsfelder setzen eigene, für die Betrugsprävention notwendige Cookies.</p>
<h2>6. Speicherdauer</h2>
<p>Bestell- und Rechnungsdaten bewahren wir wegen gesetzlicher Aufbewahrungspflichten bis zu 10 Jahre auf (§ 147 AO, § 257 HGB). Kontodaten löschen wir, wenn du dein Konto löschst, soweit keine Aufbewahrungspflicht besteht.</p>
<h2>7. Deine Rechte</h2>
<p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 15–21 DSGVO). Eine Einwilligung kannst du jederzeit widerrufen. Schreib uns dazu an <a href="mailto:${SUP()}">${SUP()}</a>. Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren.</p>
<h2>8. Sicherheit</h2>
<p>Alle Verbindungen sind per TLS verschlüsselt. Gekaufte Codes speichern wir verschlüsselt. Passwörter werden nur als sicherer Hash gespeichert.</p>`]
};
/* Lesbare Langform: Inhaltsverzeichnis als Glas-Leiste (Handy: klebend oben, Desktop: links) mit Lesefortschritt, Textspalte mit höchstens 68 Zeichen */
const LGL_DOCS=[["agb","AGB"],["widerruf","Widerruf"],["datenschutz","Datenschutz"]];
let lglSpy=null;
function legalPage(id){const x=LEGAL[id],toc=[];let n=0;
  const body=x[1]().replace(/<h2>([\s\S]*?)<\/h2>/g,(m,t)=>{const a=`${id}-${++n}`;toc.push([a,t.replace(/<[^>]+>/g,"")]);return `<h2 id="${a}">${t}</h2>`});
  return {title:x[0],html:`${crumb([[x[0]]])}<div class="lgl sec"><header class="lgl-head"><div class="lgl-art" aria-hidden="true"><i></i><i></i><i><b>§</b></i></div><h1 class="lgl-h">${x[0]}</h1><p class="lgl-meta">Stand: ${LEGAL_STAND}</p>
  <nav class="lgl-docs" aria-label="Rechtstexte">${LGL_DOCS.map(([k,t])=>`<a href="/${k}"${k===id?' aria-current="page"':""}>${t}</a>`).join("")}<a href="${IMP}" target="_blank" rel="noopener">Impressum${ic("i-arrow")}<span class="sr"> (öffnet ein neues Fenster)</span></a></nav></header>
  <div class="lgl-grid"><nav class="lgl-toc" aria-label="Inhalt"><b>Inhalt</b><ul>${toc.map(([a,t],i)=>`<li><a href="#${a}"><span class="lgl-n" aria-hidden="true">${i+1}</span><span>${esc(t.replace(/^\s*\d+\.\s*/,""))}</span></a></li>`).join("")}</ul><i class="lgl-prog" aria-hidden="true"></i></nav><article class="lgl-doc prose">${body}</article></div></div>`,
  /* Sprung im Inhaltsverzeichnis ohne Navigation (sonst baut popstate die Seite neu auf und springt nach oben) */
  after(){const t=$(".lgl-toc");if(!t)return;t.addEventListener("click",e=>{const a=e.target.closest("a[href^='#']"),h=a&&document.getElementById(a.hash.slice(1));if(!h)return;e.preventDefault();try{history.replaceState(null,"",a.hash)}catch(x){}
    $$(".lgl-doc h2.on").forEach(x=>x.classList.remove("on"));h.classList.add("on");h.setAttribute("tabindex","-1");h.focus({preventScroll:true});h.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"})});
    /* Aktueller Abschnitt und Lesefortschritt; die Leiste auf dem Handy rollt den aktiven Eintrag in die Mitte */
    const ul=$("ul",t),ls=$$("a",t),hs=$$(".lgl-doc h2"),doc=$(".lgl-doc"),stT=parseFloat(getComputedStyle(t).top)||0;let on=-1,raf=0;
    if(lglSpy)removeEventListener("scroll",lglSpy);
    const upd=()=>{raf=0;if(!doc.isConnected){removeEventListener("scroll",lglSpy);lglSpy=null;return}
      const y=Math.min(innerHeight*.35,240);let k=0;hs.forEach((h,i)=>{if(h.getBoundingClientRect().top<y)k=i});
      if(k!==on){on=k;ls.forEach((a,i)=>i===k?a.setAttribute("aria-current","location"):a.removeAttribute("aria-current"));
        const li=ls[k]&&ls[k].parentNode;if(li&&ul.scrollWidth>ul.clientWidth+4)ul.scrollTo({left:Math.max(0,li.offsetLeft-(ul.clientWidth-li.offsetWidth)/2),behavior:reduce?"auto":"smooth"})}
      t.classList.toggle("stuck",t.getBoundingClientRect().top<=stT+1);
      const r=doc.getBoundingClientRect();t.style.setProperty("--p",Math.max(0,Math.min(1,(innerHeight*.5-r.top)/Math.max(1,r.height-innerHeight*.3))).toFixed(3))};
    lglSpy=()=>{if(!raf)raf=requestAnimationFrame(upd)};addEventListener("scroll",lglSpy,{passive:true});upd()}}}
