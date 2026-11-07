/* ---------- Express-Anmeldung: Passkeys, Anmelde-Fenster, Konto aus der Gastbestellung, Konto-Schnellaktionen ----------
   pkCan()          Passkeys hier möglich: WebAuthn, sichere Herkunft, Host passt zur rpId des Servers (CFG.auth.passkey)
   pkUV()           Promise<bool>: Face ID, Touch ID oder Windows Hello bereit (Ergebnis zusätzlich in PKUV)
   A.pkLogin(r)     Anmelden mit Passkey ohne E-Mail-Eingabe (auffindbare Passkeys); danach r bzw. die aktuelle Seite neu
   A.pkAdd()        Passkey für das angemeldete Konto anlegen · pkMount() Liste mit Löschen (Konto › Einstellungen)
   A.loginOpen(r)   kompaktes Anmelde-Fenster: Express-Knöpfe (nur eingerichtete), Code per E-Mail, Link „Mit Passwort anmelden“.
                    Öffnet sich für Links auf /login (Kopfzeile, Menü …), nicht für „Konto erstellen“ und Links mit data-full.
   odAcct(o)        Bestellseite (Gast): „Konto mit einem Tipp anlegen“ – Code an die Bestell-E-Mail, verknüpft die Bestellung;
                    daneben alle eingerichteten Anbieter (odQuick, Raster aus 53-express.js).
                    Der Server antwortet für neue und bestehende Adressen gleich (keine Kontenaufzählung).
   accQaHTML/accQa  Konto: Schnellaktionen (Nochmal kaufen, Meine Codes, Passkey hinzufügen, Abo verwalten) */
const b64u=b=>{const u=new Uint8Array(b);let s="";for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")};
const ub64=s=>{s=String(s||"").replace(/-/g,"+").replace(/_/g,"/");const b=atob(s+"===".slice((s.length+3)%4)),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u.buffer};
const pkRp=()=>(CFG.auth&&CFG.auth.passkey)||"";
const pkCan=()=>{try{const rp=pkRp(),h=location.hostname;return !!(rp&&window.PublicKeyCredential&&navigator.credentials&&window.isSecureContext&&(h===rp||h.endsWith("."+rp)))}catch(e){return false}};
let PKUV=null,pkRun=false;
const pkUV=()=>{if(PKUV!==null)return Promise.resolve(PKUV);if(!pkCan()||!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable)return Promise.resolve(false);
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(v=>PKUV=!!v,()=>PKUV=false)};
/* Antwort des Browsers als JSON (base64url) für den Server */
const pkRes=c=>{const r=c.response,o={id:c.id,rawId:b64u(c.rawId),type:c.type,response:{clientDataJSON:b64u(r.clientDataJSON)}};
  if(r.attestationObject){o.response.attestationObject=b64u(r.attestationObject);try{o.response.transports=r.getTransports?r.getTransports():[]}catch(e){o.response.transports=[]}}
  else{o.response.authenticatorData=b64u(r.authenticatorData);o.response.signature=b64u(r.signature);o.response.userHandle=r.userHandle&&r.userHandle.byteLength?b64u(r.userHandle):null}
  return o};
const pkMsg=(x,reg)=>{const n=x&&x.name;
  if(n==="NotAllowedError"||n==="AbortError")return reg?"Kein Passkey angelegt. Du kannst es jederzeit noch einmal versuchen.":"Abgebrochen. Noch kein Passkey? Melde dich mit einem Code per E-Mail an und füge ihn danach im Konto hinzu.";
  if(n==="InvalidStateError")return reg?"Auf diesem Gerät gibt es schon einen Passkey für dein Konto.":"Das hat nicht geklappt. Bitte versuch es noch einmal.";
  if(n==="SecurityError")return "Passkeys funktionieren auf dieser Adresse nicht.";
  if(n==="NotSupportedError")return "Dieses Gerät unterstützt keine passenden Passkeys.";
  return (x&&x.message)||"Das hat nicht geklappt. Bitte versuch es noch einmal."};
/* Fehlermeldung dort zeigen, wo angetippt wurde: Anmelde-Fenster, Anmeldeseite, Kasse – sonst als Hinweis */
const pkErrEl=el=>{const h=el&&el.closest&&el.closest("#sheet,.au-card,.ck-ev");return h?$(h.id==="sheet"?"#qlErr":h.classList.contains("ck-ev")?"#evErr":"#aErr",h):null};
const pkSay=(el,m)=>{const e=pkErrEl(el);if(e)e.textContent=m||"";else if(m)toast(m)};
/* Nach jeder Express-Anmeldung: Fenster zu, auf der Seite bleiben (Kasse, Bestellung …) bzw. von /login weiter zum Ziel */
function loggedIn(u,r,msg){
  setUser(u);closeSheet(true);
  /* Konto ohne bestätigte E-Mail (Steam, Handy, Microsoft, Amazon …): zuerst die E-Mail nachtragen */
  if(u&&u.needsEmail){toast("Angemeldet. Jetzt noch deine E-Mail bestätigen.");go("/konto/email?r="+encodeURIComponent(r&&r.startsWith("/")&&!/^\/(login|verifizieren|passwort)/.test(r)?r:"/konto"));return}
  toast(msg||`Angemeldet als ${u.name||u.email}`);
  const here=location.pathname+location.search,auth=/^\/(login|verifizieren|passwort)/;
  if(auth.test(cur.path))go(r&&!auth.test(r)?r:"/konto");else if(r&&r!==here)go(r);else route(true);
}
A.pkLogin=async(r,el)=>{
  pkSay(el,"");
  if(!pkCan())return pkSay(el,"Passkeys gehen in diesem Browser nicht. Melde dich mit einem Code per E-Mail an.");
  if(pkRun)return;pkRun=true;busy(el,true);let id=null;
  try{
    const o=await API("/auth/passkey/login/options",{method:"POST"});
    const c=await navigator.credentials.get({publicKey:{challenge:ub64(o.challenge),rpId:o.rpId,timeout:o.timeout,userVerification:o.userVerification,allowCredentials:[]}});
    if(!c)throw Object.assign(new Error(""),{name:"NotAllowedError"});
    id=c.id;
    const j=await API("/auth/passkey/login",{method:"POST",body:pkRes(c)});
    S.pk=1;pkRun=false;busy(el,false);loggedIn(j.user,r);return;
  }catch(x){pkSay(el,pkMsg(x,false));
    /* Bei uns gelöschter Passkey: Browser bzw. Passwort-Manager bitten, ihn nicht mehr anzubieten */
    if(id&&/kennen wir nicht/.test((x&&x.message)||"")&&PublicKeyCredential.signalUnknownCredential)PublicKeyCredential.signalUnknownCredential({rpId:pkRp(),credentialId:id}).catch(()=>{})}
  pkRun=false;busy(el,false);
};
A.pkAdd=async(_,el)=>{
  if(!S.user)return A.loginOpen();
  if(!pkCan())return toast("In diesem Browser kannst du keinen Passkey anlegen.");
  if(pkRun)return;pkRun=true;busy(el,true);
  try{
    const o=await API("/auth/passkey/register/options",{method:"POST"});
    const pk=Object.assign({},o,{challenge:ub64(o.challenge),user:Object.assign({},o.user,{id:ub64(o.user.id)}),excludeCredentials:(o.excludeCredentials||[]).map(x=>Object.assign({},x,{id:ub64(x.id)}))});
    const c=await navigator.credentials.create({publicKey:pk});
    if(!c)throw Object.assign(new Error(""),{name:"NotAllowedError"});
    const j=await API("/auth/passkey/register",{method:"POST",body:pkRes(c)});
    S.pk=1;save();pkPaint(j.passkeys);toast("Passkey gespeichert. Ab jetzt meldest du dich mit einem Tipp an.");
  }catch(x){toast(pkMsg(x,true))}
  pkRun=false;busy(el,false);
};
/* Konto › Einstellungen: Passkeys mit Löschen */
const pkDate=t=>t?new Date(t).toLocaleDateString("de-DE",{dateStyle:"medium"}):"";
function pkPaint(l){const el=$("#pkList");if(!el||!l)return;
  el.innerHTML=l.length?l.map(p=>`<div class="setrow pk-row"><span class="si-ic">${ic("i-face")}</span><div class="mid"><b>${esc(p.name)}</b><small>Hinzugefügt am ${pkDate(p.created_at)}${p.last_used?` · zuletzt genutzt am ${pkDate(p.last_used)}`:""}${p.synced?" · auf deinen Geräten synchronisiert":""}</small></div><button class="acc-rm" data-a="pkDel" data-v="${esc(p.id)}" aria-label="Passkey ${esc(p.name)} löschen">${ic("i-trash")}</button></div>`).join("")
   :`<p class="pk-none">Noch kein Passkey. Damit meldest du dich per Face ID, Touch ID oder Windows Hello an – ohne Passwort und ohne Code.</p>`}
const pkMount=()=>{if(!$("#pkList"))return;API("/passkeys").then(j=>pkPaint(j.passkeys)).catch(e=>{const el=$("#pkList");if(el)el.innerHTML=`<p class="err">${esc(e.message)}</p>`})};
A.pkDel=id=>openSheet(`<div class="sheet-h"><h3>Passkey löschen?</h3><button class="x" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button></div><p class="acc-sheet-p">Mit diesem Passkey kannst du dich danach nicht mehr anmelden. Du kannst jederzeit einen neuen hinzufügen.</p><div class="acc-sheet-a"><button class="btn btn-soft" data-a="closeSheet">Abbrechen</button><button class="btn acc-danger" data-a="pkDelGo" data-v="${esc(id)}">Passkey löschen</button></div>`);
A.pkDelGo=async(id,el)=>{busy(el,true);
  try{const j=await API("/passkeys/"+encodeURIComponent(id),{method:"DELETE"});closeSheet();pkPaint(j.passkeys);toast("Passkey gelöscht");
    if(window.PublicKeyCredential&&PublicKeyCredential.signalUnknownCredential)PublicKeyCredential.signalUnknownCredential({rpId:pkRp(),credentialId:id}).catch(()=>{})}
  catch(x){busy(el,false);toast(x.message)}};

/* ---------- Anmelde-Fenster ---------- */
const QL={mail:"",r:"",busy:false};
A.loginOpen=(r,el)=>{
  if(S.user){go("/konto");return}
  r=typeof r==="string"&&r.startsWith("/")?r:location.pathname+location.search;QL.r=r;QL.busy=false;
  try{closeMenu(true)}catch(e){}
  const a=CFG.auth||{},pk=pkCan(),many=xaOrder().length+(a.sms?1:0)>=3&&!!a.code;/* viele Anbieter: E-Mail-Feld hinter „E-Mail-Code“ */
  openSheet(`<div class="sheet-h"><h3>Anmelden</h3><button class="x" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button></div>
   <p class="ql-lead">Ohne Passwort, in Sekunden. Neu hier? Dein Konto entsteht beim ersten Anmelden.</p>
   ${quickAuth(r,{sheet:true,mail:many})}
   ${a.code&&!many&&(xaOrder().length||a.sms||pk)?`<div class="au-or">oder mit E-Mail</div>`:""}
   ${a.code?`<form class="ql-code" id="qlCodeF" novalidate${many?" hidden":""}>
    <label class="lbl" for="qlMail">E-Mail – wir schicken dir einen Code</label>
    <div class="ql-row"><input class="inp" id="qlMail" type="email" autocomplete="email" inputmode="email" placeholder="name@beispiel.de" value="${esc(QL.mail||S.pendingEmail||S.lastEmail||"")}"><button type="submit" class="btn btn-primary${pk?"":" btn-ink"}" data-a="qlSend" id="qlSendB">Code senden</button></div>
    <div class="ql-otp" id="qlOtp" hidden><p class="ql-sent" id="qlSent" role="status"></p><div class="au-otpw"><span class="au-cells" aria-hidden="true">${"<i></i>".repeat(6)}</span><input class="inp otp au-otp" id="qlCode" inputmode="numeric" maxlength="40" autocomplete="one-time-code" placeholder="000000" aria-label="Code aus der E-Mail" aria-describedby="qlErr"></div></div>
   </form>`:""}
   <div class="err" id="qlErr" role="alert"></div>
   <p class="ql-alt"><a href="/login?r=${encodeURIComponent(r)}" data-full>Mit Passwort anmelden</a></p>`,
  {cls:"sh ql",after(){if(CFG.google)gsi(r,u=>loggedIn(u,r),null,{width:Math.min(360,Math.max(240,(($("#sheet .xa-w")||{}).clientWidth)||320))});xaPkPaint()}});
};
A.qlSend=async(_,el)=>{
  const i=$("#qlMail"),err=$("#qlErr");if(!i||el.disabled)return;const m=i.value.trim();err.textContent="";i.classList.remove("bad");
  if(!/^\S+@\S+\.\S+$/.test(m)){err.textContent="Bitte gib deine E-Mail-Adresse ein – wir schicken dir einen Code.";i.classList.add("bad");i.focus();return}
  busy(el,true);let ok=false;
  try{await API("/auth/code",{method:"POST",body:{email:m}});ok=true}catch(x){err.textContent=x.message}
  busy(el,false);if(!ok)return;
  QL.mail=m;S.pendingEmail=m;save();el.textContent="Neu senden";
  $("#qlOtp").hidden=false;$("#qlSent").innerHTML=`Code an <b>${esc(m)}</b> geschickt. Schau auch im Spam-Ordner nach.`;
  const c=$("#qlCode");c.value="";otpCells(c);setTimeout(()=>c.focus(),60);
};
A.qlGo=async()=>{const c=$("#qlCode"),err=$("#qlErr");if(!c||c.value.length!==6||QL.busy)return;QL.busy=true;err.textContent="";
  try{const j=await API("/auth/verify",{method:"POST",body:{email:QL.mail,code:c.value}});S.pendingEmail=null;QL.busy=false;loggedIn(j.user,QL.r)}
  catch(x){QL.busy=false;err.textContent=x.message;c.classList.add("bad");setTimeout(()=>c.select(),0)}};
/* Code-Felder (Anmelde-Fenster, Bestellseite): sechs Kästchen spiegeln das unsichtbare Eingabefeld */
const otpCells=o=>{const w=o&&o.closest(".au-otpw");if(!w)return;const v=o.value,f=document.activeElement===o;
  $$(".au-cells i",w).forEach((c,i)=>{const d=v[i]||"";if(c.textContent!==d)c.textContent=d;c.classList.toggle("on",!!d);c.classList.toggle("cur",f&&i===Math.min(v.length,5))})};
const QL_OTP={qlCode:()=>A.qlGo(),odaCode:()=>A.odAcctGo(ODA.id)};
document.addEventListener("input",e=>{const t=e.target;if(!t||!QL_OTP[t.id])return;t.value=t.value.replace(/\D/g,"").slice(0,6);t.classList.remove("bad");otpCells(t);if(t.value.length===6)QL_OTP[t.id]()});
["focusin","focusout"].forEach(ev=>document.addEventListener(ev,e=>{const t=e.target;if(t&&QL_OTP[t.id])setTimeout(()=>otpCells(t))}));
document.addEventListener("keydown",e=>{const t=e.target;if(e.key==="Enter"&&t&&QL_OTP[t.id]){e.preventDefault();if(t.value.length===6)QL_OTP[t.id]()}});
document.addEventListener("submit",e=>{if(e.target.classList&&e.target.classList.contains("ql-code"))e.preventDefault()});
/* Links auf /login öffnen das Anmelde-Fenster (Kopfzeile, Menü …). Läuft vor dem Seitenwechsel (Capture-Phase). */
document.addEventListener("click",e=>{
  const a=e.target.closest&&e.target.closest("a[href]");
  if(!a||S.user||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button||a.hasAttribute("data-full")||a.target==="_blank")return;
  const h=a.getAttribute("href")||"";if(!/^\/login(\?|$)/.test(h)||/[?&]m=reg\b/.test(h))return;
  if(/^\/(login|verifizieren|passwort|konto)/.test((cur&&cur.path)||""))return;   /* dort steht die Anmeldung schon groß */
  e.preventDefault();const r=new URLSearchParams(h.split("?")[1]||"").get("r");A.loginOpen(r&&r.startsWith("/")?r:null,a)},true);

/* ---------- Bestellseite: Konto mit einem Tipp anlegen (nur Gäste) ----------
   Ein Tipp schickt einen Code an die E-Mail der Bestellung; mit dem Code entsteht das Konto (bzw. die Anmeldung)
   und alle Gastbestellungen dieser Adresse – auch diese – landen darin. Ausgeblendet, wenn auf diesem Gerät schon
   ein Konto angemeldet war. Ob es zur Adresse ein Konto gibt, verrät der Server nicht. */
let ODA={};
/* Neben dem E-Mail-Code: alle eingerichteten Anbieter (53-express.js). Der Server legt dabei alle Gastbestellungen
   derselben bestätigten E-Mail-Adresse ins Konto (linkOrders) – deshalb der Hinweis auf die gleiche Adresse. */
const odQuick=o=>{const k=new URLSearchParams(location.search).get("k")||(S.keys||{})[o.id]||"",r=`/bestellung/${o.id}${k?"?k="+encodeURIComponent(k):""}`;
  const g=xaGrid(r,{ctx:"order",gid:"odG"});
  if(!g)return "";
  if(CFG.google){let n=0;const t=()=>{const el=$("#odG");if(el&&!el.childElementCount)return gsi(r,u=>loggedIn(u,r),el,{width:280});if(!el&&n++<20)setTimeout(t,100)};setTimeout(t,0)}
  return `<div class="od-acct-q"><p class="od-acct-or">oder schneller</p>${g}<p class="od-acct-f">Die Bestellung landet im Konto, wenn dort dieselbe E-Mail-Adresse bestätigt ist.</p></div>`};
function odAcct(o){
  if(S.user||S.acct||!o||!o.email||["canceled","refunded"].includes(o.status))return "";
  const st=ODA.id===o.id&&ODA.sent;
  return `<section class="card od-acct" id="odAcct" aria-labelledby="odAcctH"><span class="od-acct-i" aria-hidden="true">${ic("i-user")}</span>
   <h2 class="od-h2" id="odAcctH">Konto mit einem Tipp anlegen</h2>
   <p class="od-acct-p">Deine Codes jederzeit wiederfinden, auch auf anderen Geräten. Wir schicken einen Code an <b>${esc(o.email)}</b> und legen diese Bestellung in dein Konto.</p>
   <div class="od-acct-a"${st?" hidden":""}><button class="btn btn-primary btn-block" data-a="odAcctSend" data-v="${esc(o.id)}">${ic("i-mail")}Code an meine E-Mail senden</button>${odQuick(o)}</div>
   <div class="od-acct-c"${st?"":" hidden"}><label class="lbl" for="odaCode">Code aus der E-Mail</label>
    <div class="au-otpw"><span class="au-cells" aria-hidden="true">${"<i></i>".repeat(6)}</span><input class="inp otp au-otp" id="odaCode" inputmode="numeric" maxlength="40" autocomplete="one-time-code" placeholder="000000" aria-describedby="odaErr"></div>
    <button class="btn btn-primary btn-ink btn-block" data-a="odAcctGo" data-v="${esc(o.id)}">Konto anlegen</button>
    <p class="od-acct-re">Keine E-Mail? Schau im Spam-Ordner oder <button class="more" data-a="odAcctSend" data-v="${esc(o.id)}">sende den Code erneut</button>.</p></div>
   <div class="err" id="odaErr" role="alert"></div>
   <p class="od-acct-f">Ohne Passwort. Danach kannst du dich auch mit Passkey anmelden.</p></section>`;
}
A.odAcctSend=async(id,el)=>{const o=ordCache[id],err=$("#odaErr");if(!o||!err||el.disabled)return;err.textContent="";busy(el,true);let ok=false;
  try{await API("/auth/code",{method:"POST",body:{email:o.email}});ok=true}catch(x){err.textContent=x.message}
  busy(el,false);if(!ok)return;
  ODA={id,sent:true};$(".od-acct-a").hidden=true;$(".od-acct-c").hidden=false;toast(`Code an ${o.email} geschickt`);
  const c=$("#odaCode");if(c){c.value="";otpCells(c);setTimeout(()=>c.focus({preventScroll:true}),60)}};
A.odAcctGo=async(id,el)=>{const o=ordCache[id],c=$("#odaCode"),err=$("#odaErr");if(!o||!c||!err||ODA.busy)return;err.textContent="";
  if(c.value.length!==6){err.textContent="Bitte gib den 6-stelligen Code ein.";c.classList.add("bad");return}
  ODA.busy=true;const b=el&&el.tagName==="BUTTON"?el:$("[data-a=odAcctGo]");busy(b,true);
  try{const j=await API("/auth/verify",{method:"POST",body:{email:o.email,code:c.value}});ODA={};setUser(j.user);
    const box=$("#odAcct");if(box)box.innerHTML=`<span class="od-acct-i ok" aria-hidden="true">${ic("i-check")}</span><h2 class="od-h2">Fertig. Die Bestellung liegt in deinem Konto.</h2><p class="od-acct-p">Du bist angemeldet. Beim nächsten Mal geht es mit einem Code per E-Mail${pkCan()?" – oder noch schneller mit einem Passkey":""}.</p><div class="od-acct-b">${pkCan()?`<button class="btn btn-primary" data-a="pkAdd">${ic("i-face")}Passkey hinzufügen</button>`:""}<a class="btn btn-soft" href="/konto">Zum Konto</a></div>`;
    toast("Angemeldet – die Bestellung liegt in deinem Konto")}
  catch(x){ODA.busy=false;busy(b,false);err.textContent=x.message;c.classList.add("bad")}};

/* ---------- Konto: Schnellaktionen ---------- */
const accQaHTML=tab=>`<div class="acc-qa" role="group" aria-label="Schnellaktionen">
  <button class="btn btn-primary" data-a="accAgain" id="qaAgain" hidden>${ic("i-cart")}<span>Nochmal kaufen</span></button>
  <a class="btn btn-primary" href="/konto/bestellungen"${tab==="bestellungen"?' aria-current="page"':""}>${ic("i-receipt")}<span>Meine Codes</span></a>
  ${pkCan()?`<button class="btn btn-primary" data-a="pkAdd">${ic("i-face")}<span>Passkey hinzufügen</span></button>`:""}
  <a class="btn btn-primary" href="/konto/abos" id="qaAbo"${tab==="abos"?' aria-current="page"':""} hidden>${ic("i-repeat")}<span>Abo verwalten</span></a></div>`;
function accQa(op){
  op.then(j=>{const b=$("#qaAgain"),o=(j.orders||[]).find(x=>["delivered","processing"].includes(x.status)&&x.items.some(i=>{const p=byId(i.brand);return p&&p.amts.includes(i.face/100)}));
    if(!b||!o)return;ordCache[o.id]=o;b.dataset.v=o.id;b.hidden=false;
    const p=byId(o.items[0].brand);b.setAttribute("aria-label",`Nochmal kaufen: ${o.items.length>1?o.items.length+" Artikel der letzten Bestellung":p?p.name:"letzte Bestellung"}`)}).catch(()=>{});
  API("/abo/mine").then(j=>{const b=$("#qaAbo");if(b&&(j.subs||[]).some(s=>s.status!=="ended"))b.hidden=false}).catch(()=>{});
}
/* Ein Artikel: Schnellkauf mit Expresszahlung; mehrere oder Aufladung (Nummer): alles in den Warenkorb */
A.accAgain=id=>{const o=ordCache[id];if(!o)return;
  const ok=o.items.filter(i=>{const b=byId(i.brand);return b&&b.amts.includes(i.face/100)});
  if(ok.length===1&&ok[0].type!=="topup"&&!soldOut(ok[0].brand,ok[0].face/100))return A.qb(ok[0].brand,ok[0].face/100);
  A.reorderLive(id);if(ok.length)A.cartOpen()};
