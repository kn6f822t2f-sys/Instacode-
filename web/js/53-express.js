/* ---------- Express-Anmeldung: alle eingerichteten Anbieter als Knöpfe („Mit … fortfahren“) ----------
   Anmelden und Konto erstellen sind derselbe Weg: Wer neu ist, bekommt beim ersten Mal ein Konto.
   Angezeigt wird nur, was der Server meldet (CFG.auth, ohne tote Knöpfe). In der Vorschau laufen nicht eingerichtete
   Anbieter gegen den Simulator (CFG.auth.sim) – das steht dann sichtbar über den Knöpfen.
   Markenregeln: Apple schwarz mit weißem Apple-Zeichen und „Mit Apple fortfahren“ (Titel 43 % der Höhe, Systemschrift);
   Google weiß, Rand #747775, Roboto Medium 14 px, farbiges „G“, „Mit Google fortfahren“ (oder der Knopf von Google, GIS);
   PayPal „Mit PayPal fortfahren“ mit farbigem PayPal-Zeichen auf hellem Grund; übrige mit ihrem offiziellen Zeichen (public/auth/).
   xaGrid(r,o)   Raster: Face ID / Passkey groß, Apple–Google–PayPal breit, dann Microsoft, Discord, Twitch, Steam, Amazon, Handy, E-Mail-Code
   xaRow(r)      Kasse „Schneller:“ – runde Zeichen-Knöpfe
   xaEmail(qs)   /konto/email: E-Mail nachtragen und mit Code bestätigen (Konten von Steam, Handy, Microsoft, Amazon …)
   lkMount()     Konto › Einstellungen: verbundene Anmeldungen, weitere verbinden, trennen */
const XA={apple:["Apple","/auth/apple-white.svg"],google:["Google","/auth/google.svg"],paypal:["PayPal","/auth/paypal.svg"],microsoft:["Microsoft","/auth/microsoft.svg"],
  discord:["Discord","/auth/discord.svg"],twitch:["Twitch","/auth/twitch.svg"],steam:["Steam","/auth/steam.svg"],amazon:["Amazon","/auth/amazon.svg"],sms:["Handy",""]};
const xaApple=()=>{try{const u=navigator.userAgent||"";return /iPhone|iPad|iPod|Macintosh/.test(u)}catch(e){return false}};
/* Reihenfolge: auf Apple-Geräten Apple zuerst, sonst Google zuerst; dann PayPal, Microsoft, Discord, Twitch, Steam, Amazon */
const xaOrder=()=>{const a=CFG.auth||{},l=xaApple()?["apple","google"]:["google","apple"];return l.concat(["paypal","microsoft","discord","twitch","steam","amazon"]).filter(p=>a[p])};
const xaSim=()=>((CFG.auth||{}).sim||[]).length>0;
const xaHref=(p,r,x)=>`/auth/${p}?r=${encodeURIComponent(r||"/konto")}${x||""}`;
/* Face ID / Touch ID / Windows Hello – je nach Gerät (PKUV: Gerät kann sich selbst prüfen) */
const pkLabel=()=>{const u=navigator.userAgent||"";if(PKUV===false)return "Mit Passkey anmelden";
  return /iPhone|iPad|iPod/.test(u)?"Mit Face ID anmelden":/Macintosh/.test(u)?"Mit Touch ID anmelden":/Windows/.test(u)?"Mit Windows Hello anmelden":"Mit Passkey anmelden"};
const xaPkPaint=()=>pkUV().then(()=>$$(".xa-pkl").forEach(s=>{const t=pkLabel();if(s.textContent!==t)s.textContent=t}));
const xaWide=(p,r,gid)=>{const [n,src]=XA[p];
  if(p==="google"&&CFG.google)return `<div class="xa-gis" id="${gid||"gbtn"}"></div>`;
  return `<a class="xa-b xa-${p}${p==="apple"?" qa-apple":""}" href="${xaHref(p,r)}" data-xa="${p}"><img src="${src}" alt="" width="20" height="20"><span>Mit ${n} fortfahren</span></a>`};
const xaCell=(p,r)=>{const [n,src]=XA[p];return `<a class="xa-c" href="${xaHref(p,r)}" data-xa="${p}" aria-label="Mit ${n} fortfahren"><img src="${src}" alt="" width="20" height="20"><span>${n}</span></a>`};
/* o.ctx: "sheet" (Anmelde-Fenster), "page" (/login), "order" (Bestellseite) · o.mail: Zelle „E-Mail-Code“ · o.gid: Platz für den Google-Knopf (GIS) */
function xaGrid(r,o={}){
  const a=CFG.auth||{},ord=xaOrder(),wide=ord.filter(p=>["apple","google","paypal"].includes(p)),cells=ord.filter(p=>!wide.includes(p)).map(p=>xaCell(p,r));
  if(a.sms&&o.ctx!=="order")cells.push(`<button type="button" class="xa-c" data-a="smsOpen" aria-expanded="false" aria-controls="smsBox">${ic("i-phone-f")}<span>Handy</span></button>`);
  if(o.mail)cells.push(`<button type="button" class="xa-c" data-a="xaMail" aria-expanded="false" aria-controls="qlCodeF">${ic("i-mail")}<span>E-Mail-Code</span></button>`);
  const pk=o.ctx!=="order"&&pkCan();
  if(!wide.length&&!cells.length&&!pk)return "";
  return `<div class="xa" data-ctx="${o.ctx||"page"}">
   ${xaSim()?`<p class="xa-sim" role="note">${ic("i-zap")}<span>Vorschau: Die Anmeldung wird nur simuliert</span></p>`:""}
   ${pk?`<button type="button" class="${o.ctx==="sheet"?"btn btn-primary btn-ink btn-lg btn-block ql-pk":"qa-btn qa-pk"} xa-pk" data-a="pkLogin" data-v="${esc(r)}">${ic("i-face")}<span class="xa-pkl">${pkLabel()}</span></button>`:""}
   ${wide.length?`<div class="xa-w">${wide.map(p=>xaWide(p,r,o.gid)).join("")}</div>`:""}
   ${cells.length?`<div class="xa-g${cells.length%2?" odd":""}">${cells.join("")}</div>`:""}
   ${a.sms&&o.ctx!=="order"?`<div class="au-sms xa-sms" id="smsBox" hidden><label class="lbl" for="smsTel">Handynummer</label><div class="ql-row"><input class="inp" id="smsTel" type="tel" inputmode="tel" autocomplete="tel" placeholder="0151 2345678"><button type="button" class="btn btn-soft" data-a="smsSend">Code senden</button></div>
    <div id="smsCodeW" hidden><div class="ql-row"><input class="inp" id="smsCode" inputmode="numeric" autocomplete="one-time-code" maxlength="40" placeholder="Code aus der SMS" aria-label="Code aus der SMS"><button type="button" class="btn btn-primary btn-ink" data-a="smsCheck" data-v="${esc(r)}">Anmelden</button></div></div>
    <p class="xa-fine">Wir schicken dir einen Code per SMS. Danach bestätigst du einmal deine E-Mail – dorthin kommen deine Codes.</p><div class="err" id="smsErr" role="alert"></div></div>`:""}
  </div>`;
}
/* Kasse: runde Zeichen-Knöpfe (Apple schwarz, Google mit farbigem „G“, Logo-Knöpfe sind laut Apple und Google erlaubt) */
function xaRow(r,pk){
  const a=CFG.auth||{},ord=xaOrder(),out=[];
  if(pk)out.push(`<button class="ck-qa xa-i xa-ipk" data-a="pkLogin" data-v="${esc(r)}" id="ckPkB"${PKUV?"":" hidden"} aria-label="${esc(pkLabel())}" title="${esc(pkLabel())}">${ic("i-face")}</button>`);
  ord.forEach(p=>{const [n,src]=XA[p];
    if(p==="google"&&CFG.google)return out.push(`<span class="ck-g" id="ckG"></span>`);
    out.push(`<a class="ck-qa xa-i xa-i-${p}${p==="apple"?" ck-qa-apple":""}" href="${xaHref(p,r)}" data-xa="${p}" aria-label="Mit ${n} fortfahren" title="Mit ${n} fortfahren"><img src="${src}" alt="" width="20" height="20"></a>`)});
  if(a.sms)out.push(`<button class="ck-qa xa-i" data-a="xaSmsSheet" data-v="${esc(r)}" aria-label="Mit Handynummer fortfahren" title="Mit Handynummer fortfahren">${ic("i-phone-f")}</button>`);
  return out.join("");
}
/* Anmelde-Fenster: „E-Mail-Code“ klappt das E-Mail-Feld auf */
A.xaMail=(_,el)=>{const f=$("#qlCodeF");if(!f)return;f.hidden=!f.hidden;el.setAttribute("aria-expanded",String(!f.hidden));if(!f.hidden){const i=$("#qlMail");i&&setTimeout(()=>i.focus(),40)}};
/* Kasse: Handy-Knopf öffnet das Anmelde-Fenster mit aufgeklapptem Handy-Feld */
A.xaSmsSheet=r=>{A.loginOpen(r);setTimeout(()=>{const b=$("#sheet [data-a=smsOpen]");if(b&&$("#smsBox").hidden)A.smsOpen(null,b)},60)};
/* Rückmeldung beim Antippen: der Knopf zeigt, dass es zum Anbieter weitergeht (nach „Zurück“ wieder normal) */
document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest("a[data-xa]");if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;a.classList.add("go");a.setAttribute("aria-busy","true")});
addEventListener("pageshow",()=>$$("a[data-xa].go").forEach(a=>{a.classList.remove("go");a.removeAttribute("aria-busy")}));

/* ---------- E-Mail nachtragen (/konto/email) ---------- */
const XM={mail:"",busy:false};
function xaEmail(qs){
  const r=(qs&&qs.get("r"))||"/konto",u=S.user,back=/^\/(?![\/\\])/.test(r)?r:"/konto";
  if(!u)return apiLogin(null,new URLSearchParams("r="+encodeURIComponent("/konto/email?r="+back)));
  if(!u.needsEmail)return {title:"E-Mail bestätigt",html:authCard("Alles erledigt",`Deine Codes gehen an <b>${esc(u.email)}</b>.`,`<a class="btn btn-primary btn-ink btn-lg btn-block au-go" href="${esc(back)}">Weiter</a>`)};
  const prov=(u.logins||[]).map(p=>(XA[p]||[p])[0]).filter(Boolean),via=prov.length?`Du bist mit ${esc(prov.join(" und "))} angemeldet. `:"";
  return {title:"E-Mail bestätigen",html:authCard("Fast geschafft",`${via}Wohin sollen deine Codes gehen? Bestätige deine E-Mail-Adresse mit einem Code – dann ist dein Konto fertig.`,`
   <form class="au-form xm" novalidate>
    <label class="lbl" for="xmMail">E-Mail-Adresse</label>
    <div class="ql-row"><input class="inp" id="xmMail" type="email" autocomplete="email" inputmode="email" placeholder="name@beispiel.de" value="${esc(XM.mail||u.emailHint||"")}"><button type="submit" class="btn btn-primary btn-ink" data-a="xmSend" id="xmSendB">Code senden</button></div>
    <div class="ql-otp" id="xmOtp" hidden><p class="ql-sent" id="xmSent" role="status"></p><div class="au-otpw"><span class="au-cells" aria-hidden="true">${"<i></i>".repeat(6)}</span><input class="inp otp au-otp" id="xmCode" inputmode="numeric" maxlength="40" autocomplete="one-time-code" placeholder="000000" aria-label="Code aus der E-Mail" aria-describedby="xmErr"></div></div>
    <div class="err" id="xmErr" role="alert"></div>
   </form>
   <p class="au-legal">Gehört die Adresse schon zu einem Konto bei uns, verbinden wir beide. Deine Bestellungen bleiben erhalten.</p>
   <p class="ql-alt"><a href="${esc(back)}">Später</a></p>`),
   after(){const i=$("#xmMail");if(i&&!i.value)setTimeout(()=>i.focus(),120)}};
}
A.xmSend=async(_,el)=>{const i=$("#xmMail"),err=$("#xmErr");if(!i||el.disabled)return;const m=i.value.trim();err.textContent="";i.classList.remove("bad");
  if(!/^\S+@\S+\.\S+$/.test(m)){err.textContent="Bitte gib deine E-Mail-Adresse ein – wir schicken dir einen Code.";i.classList.add("bad");i.focus();return}
  busy(el,true);let ok=false;try{await API("/auth/email/send",{method:"POST",body:{email:m}});ok=true}catch(x){err.textContent=x.message}busy(el,false);if(!ok)return;
  XM.mail=m;el.textContent="Neu senden";$("#xmOtp").hidden=false;$("#xmSent").innerHTML=`Code an <b>${esc(m)}</b> geschickt. Schau auch im Spam-Ordner nach.`;
  const c=$("#xmCode");c.value="";otpCells(c);setTimeout(()=>c.focus(),60)};
A.xmGo=async()=>{const c=$("#xmCode"),err=$("#xmErr");if(!c||c.value.length!==6||XM.busy)return;XM.busy=true;err.textContent="";
  try{const j=await API("/auth/email/verify",{method:"POST",body:{email:XM.mail,code:c.value}});XM.busy=false;XM.mail="";setUser(j.user);
    toast(j.merged?"Fertig – wir haben deine Konten verbunden":"E-Mail bestätigt. Dein Konto ist fertig.");
    const r=new URLSearchParams(location.search).get("r")||"/konto";go(/^\/(?![\/\\])/.test(r)&&!/^\/konto\/email/.test(r)?r:"/konto")}
  catch(x){XM.busy=false;err.textContent=x.message;c.classList.add("bad");setTimeout(()=>c.select(),0)}};
QL_OTP.xmCode=()=>A.xmGo();
document.addEventListener("submit",e=>{if(e.target.classList&&e.target.classList.contains("xm")){e.preventDefault();const b=$("#xmSendB");b&&A.xmSend(null,b)}});

/* ---------- Konto › Einstellungen: Anmeldemethoden ---------- */
const lkName=p=>(XA[p]||[p])[0];
const lkIco=p=>p==="sms"?`<span class="si-ic">${ic("i-phone-f")}</span>`:`<span class="si-ic lk-ic${p==="apple"?" lk-apple":""}"><img src="${p==="apple"?"/auth/apple.svg":XA[p][1]}" alt="" width="18" height="18"></span>`;
function lkPaint(j){const el=$("#lkList");if(!el)return;const have=new Set(j.links.map(l=>l.provider)),a=CFG.auth||{},r="/konto/einstellungen";
  const rows=j.links.map(l=>`<div class="setrow lk-row">${lkIco(l.provider)}<div class="mid"><b>${esc(l.name)}</b><small>${l.email?esc(l.email)+" · ":""}verbunden am ${pkDate(l.created_at)}</small></div><button class="acc-rm" data-a="lkDel" data-v="${esc(l.provider)}" aria-label="${esc(l.name)} trennen">${ic("i-trash")}</button></div>`).join("");
  const more=xaOrder().filter(p=>!have.has(p)).map(p=>`<a class="ck-qa xa-i xa-i-${p}${p==="apple"?" ck-qa-apple":""}" href="${xaHref(p,r,"&link=1")}" data-xa="${p}" aria-label="${esc(lkName(p))} verbinden" title="${esc(lkName(p))} verbinden"><img src="${XA[p][1]}" alt="" width="20" height="20"></a>`)
    .concat(a.sms&&!have.has("sms")?[`<button class="ck-qa xa-i" data-a="lkSms" aria-label="Handynummer verbinden" title="Handynummer verbinden">${ic("i-phone-f")}</button>`]:[]);
  el.innerHTML=(j.hasEmail?`<div class="setrow lk-row"><span class="si-ic">${ic("i-mail")}</span><div class="mid"><b>E-Mail-Code</b><small>${esc((S.user&&S.user.email)||"")}</small></div></div>`:"")+rows
    +(more.length?`<div class="lk-more"><p>Weitere Anmeldung verbinden – danach geht es auch damit, mit einem Tipp.</p><div class="xa-row">${more.join("")}</div></div>`:"")
    +(!rows&&!j.hasEmail?`<p class="pk-none">Noch keine Anmeldemethode.</p>`:"")}
const lkMount=()=>{if(!$("#lkList"))return;API("/auth/links").then(lkPaint).catch(e=>{const el=$("#lkList");if(el)el.innerHTML=`<p class="err">${esc(e.message)}</p>`})};
A.lkDel=p=>openSheet(`<div class="sheet-h"><h3>${esc(lkName(p))} trennen?</h3><button class="x" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button></div><p class="acc-sheet-p">Danach kannst du dich nicht mehr mit ${esc(lkName(p))} anmelden. Du kannst die Verbindung jederzeit wieder herstellen.</p><div class="acc-sheet-a"><button class="btn btn-soft" data-a="closeSheet">Abbrechen</button><button class="btn acc-danger" data-a="lkDelGo" data-v="${esc(p)}">Trennen</button></div>`);
A.lkDelGo=async(p,el)=>{busy(el,true);try{await API("/auth/links/"+encodeURIComponent(p),{method:"DELETE"});closeSheet();toast(`${lkName(p)} getrennt`);const m=await API("/me");setUser(m.user);lkMount()}catch(x){busy(el,false);toast(x.message)}};
/* Handynummer verbinden: SMS-Code im kleinen Fenster, der Server hängt die Nummer an dieses Konto */
A.lkSms=()=>openSheet(`<div class="sheet-h"><h3>Handynummer verbinden</h3><button class="x" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button></div>
  <p class="acc-sheet-p">Danach kannst du dich auch mit einem SMS-Code anmelden.</p>
  <div class="au-sms xa-sms"><label class="lbl" for="smsTel">Handynummer</label><div class="ql-row"><input class="inp" id="smsTel" type="tel" inputmode="tel" autocomplete="tel" placeholder="0151 2345678"><button type="button" class="btn btn-soft" data-a="smsSend">Code senden</button></div>
  <div id="smsCodeW" hidden><div class="ql-row"><input class="inp" id="smsCode" inputmode="numeric" autocomplete="one-time-code" maxlength="40" placeholder="Code aus der SMS" aria-label="Code aus der SMS"><button type="button" class="btn btn-primary btn-ink" data-a="lkSmsGo">Verbinden</button></div></div><div class="err" id="smsErr" role="alert"></div></div>`,{cls:"sh ql"});
A.lkSmsGo=async(_,el)=>{const e=$("#smsErr");e.textContent="";busy(el,true);try{const j=await API("/auth/sms/verify",{method:"POST",body:{phone:S.smsTel||$("#smsTel").value,code:$("#smsCode").value,link:true}});setUser(j.user);closeSheet();toast("Handynummer verbunden");lkMount()}catch(x){e.textContent=x.message;busy(el,false)}};

/* ---------- Datenschutz: nur eingerichtete Anmeldungen nennen ---------- */
const XA_DS={apple:"Apple (Apple Distribution International Ltd., Irland)",google:"Google (Google Ireland Ltd., Irland)",paypal:"PayPal (PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg)",
  microsoft:"Microsoft (Microsoft Ireland Operations Ltd., Irland)",discord:"Discord (Discord Netherlands B.V., Niederlande)",twitch:"Twitch (Twitch Interactive, Inc., USA)",
  steam:"Steam (Valve Corporation, USA)",amazon:"Amazon (Amazon Europe Core S.à r.l., Luxemburg)"};
function xaPrivacy(){const a=CFG.auth||{},l=Object.keys(XA_DS).filter(p=>a[p]).map(p=>XA_DS[p]);let h="";
  if(l.length)h+=`<li><b>Anmeldung über einen Anbieter:</b> ${l.join("; ")}. Nur wenn du eine dieser Anmeldungen wählst, erhalten wir vom Anbieter eine Konto-Kennung und – je nach Anbieter – deinen Namen und deine E-Mail-Adresse. Passwörter bekommen wir nie. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Für Anbieter in den USA gelten das EU-U.S. Data Privacy Framework bzw. EU-Standardvertragsklauseln.</li>`;
  if(a.sms)h+=`<li><b>Anmeldung per SMS-Code:</b> Twilio (Twilio Ireland Ltd., Irland; Verarbeitung auch durch Twilio Inc., USA) erhält deine Handynummer, um dir den Code zu schicken. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO; Übermittlung in die USA auf Grundlage von EU-Standardvertragsklauseln.</li>`;
  /* VOM INHABER ZU PRÜFEN: Firmennamen und Übermittlungsgrundlagen der Anbieter (erscheint nur im Testmodus) */
  if(h&&CFG.testmode)h+=`<li class="lgl-check">Nur in der Vorschau sichtbar – vom Inhaber zu prüfen: Firmennamen der Anmelde-Anbieter und Grundlagen der Datenübermittlung (Data Privacy Framework bzw. Standardvertragsklauseln).</li>`;
  return h}
