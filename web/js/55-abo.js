/* ---------- Abo: /abo (Pläne und Abschluss), /abo/AB-… (Abo-Status), Konto › Abos, /kuendigen (§ 312k BGB) ----------
   Daten kommen vom Server (/api/abo/…). Gestaltung nur mit den Grundbauteilen und Tokens, eigene Regeln in css/66-abo.css. */
let ABOD=null,aboLoad=null,kdLast=null,abN=0;const ABO_B={};
const aboPlans=()=>ABOD?Promise.resolve(ABOD):(aboLoad=aboLoad||API("/abo/plans").then(j=>{ABOD=j.plans;return ABOD}).finally(()=>{aboLoad=null}));
/* Markenkarte: aus dem Katalog, sonst aus den Kartendaten der Abo-Pläne (Produkte, die im Shop gerade nicht sichtbar sind) */
const aboBrand=id=>{const b=byId(id);if(b)return b;if(ABO_B[id])return ABO_B[id];
  const c=ABOD&&ABOD.flatMap(p=>p.items).map(i=>i.card).find(x=>x&&x.id===id);if(!c)return null;
  const x=Object.assign({},c,{fg:c.fg||"#fff",disc:0});x.art=artOf(x);x.ini=(String(x.name).replace(/[^A-Za-z0-9]/g,"")||"?").slice(0,2);x.from=Math.min.apply(null,x.amts||[0]);return ABO_B[id]=x};
const aboDay=t=>t?new Date(t).toLocaleDateString("de-DE",{timeZone:"Europe/Berlin",day:"numeric",month:"long",year:"numeric"}):"–";
const aboE=c=>c%100?eurc(c):`${(c/100).toLocaleString("de-DE")} €`;
const aboDT=t=>new Date(t).toLocaleString("de-DE",{timeZone:"Europe/Berlin",dateStyle:"long",timeStyle:"short"})+" Uhr";
const aboTxt=p=>{const n=p.months,one=n===1;return {term:one?"1 Monat":`${n} Monate`,per:one?"pro Monat":`für ${n} Monate`,
  renew:one?"verlängert sich jeden Monat":`verlängert sich um jeweils ${n} Monate`,
  cancel:one?"Jederzeit zum Ende des bezahlten Monats":`Zum Ende der ersten ${n} Monate, danach jederzeit mit einem Monat Frist`,
  charge:one?"Monatlich im Voraus":`Alle ${n} Monate im Voraus`}};
const ABO_FAQ=[
  {q:"Wann kommen die Codes?",a:"Das erste Paket legen wir direkt nach der Zahlung an, danach jeden Monat am selben Tag ein neues. Jede Lieferung prüfen wir kurz von Hand, damit niemand ein Abo missbrauchen kann – meist dauert das nur wenige Stunden. Dann kommen die Codes per E-Mail und liegen zusätzlich in deinem Abo."},
  {q:"Wie funktioniert die Verlängerung?",a:"Pro verlängert sich jeden Monat, Premium um jeweils 3 Monate, Max um jeweils 6 Monate – automatisch, bis du kündigst. Abgebucht wird immer zu Beginn der neuen Laufzeit, danach bekommst du eine E-Mail mit Betrag und Zeitraum."},
  {q:"Wie kann ich kündigen?",a:"Ohne Anmeldung über „Verträge hier kündigen“ oder in deinem Konto unter Abos. Pro endet zum Ende des bezahlten Monats. Premium und Max enden frühestens nach der ersten Laufzeit; nach einer Verlängerung kannst du jederzeit mit einem Monat Frist kündigen und bekommst nicht mehr gelieferte Monate anteilig zurück. Die Bestätigung siehst du sofort und bekommst sie per E-Mail."},
  {q:"Brauche ich ein Konto bei den Diensten?",a:"Ja. Du löst die Codes in deinem eigenen Konto beim jeweiligen Dienst ein, zum Beispiel bei Netflix, Disney+, Spotify, DAZN, Xbox, PlayStation, Nintendo oder Crunchyroll. Das Guthaben bezahlt dort dein Abo oder deine Käufe. Amazon-Guthaben gilt für Einkäufe auf Amazon.de, nicht für die Prime-Mitgliedschaft."},
  {q:"Reicht ein Code für einen ganzen Monat beim Dienst?",a:"Das hängt von deinem Tarif beim Dienst ab. Je nach Dienst deckt ein Code einen Monat oder einen Teil davon; Restguthaben bleibt in deinem Konto beim Dienst. Was genau im Paket steckt, siehst du oben mit Betrag und Abstand."},
  {q:"Wie bezahle ich?",a:"Über Stripe mit Karte, Apple Pay, Google Pay oder Link. Der Betrag wird zu Beginn jeder Laufzeit automatisch abgebucht. Klarna und Kauf auf Rechnung gibt es für Abos nicht."},
  {q:"Kann ich das Abo widerrufen?",a:"Bis zur ersten Lieferung kannst du innerhalb von 14 Tagen widerrufen und bekommst den vollen Betrag zurück. Weil es um digitale Codes geht, erlischt das Widerrufsrecht mit der ersten Lieferung, wenn du dem beim Abschluss zugestimmt hast."}
];

/* ---------- /abo ---------- */
function aboPage(_,qs){
  if(qs&&qs.get("abgebrochen"))setTimeout(()=>toast("Abschluss abgebrochen – es wurde nichts abgebucht."),350);
  if(!["pro","premium","max"].includes(S.aboPlan))S.aboPlan="pro";
  return {title:"Abo – jeden Monat Codes",html:`<div class="ab" id="abRoot">${ABOD?aboBody():`<section class="sec ab-wait"><span class="spin"></span><p class="fine">Pläne werden geladen …</p></section>`}</div>`,
  after(){if(ABOD)return;aboPlans().then(()=>{const r=$("#abRoot");if(!r||cur.path!=="/abo")return;r.innerHTML=aboBody();reveal(r);fx(r);metalMount(r)})
    .catch(e=>{const r=$("#abRoot");if(r)r.innerHTML=`<section class="sec">${empty("Abo-Seite gerade nicht erreichbar",esc(e.message),["/","Zur Startseite"])}</section>`})}};
}
const aboKey=p=>JSON.stringify(p.items.map(i=>[i.brand,i.a,i.every]));
/* Dienste-Orbit: die Karten der Dienste kreisen auf zwei Bahnen um den Abo-Kern (innen 4, außen bis 5).
   Die Bahn dreht sich, jede Karte dreht sich gegenläufig mit und bleibt aufrecht – nur transform, pausiert außerhalb des Bildes. */
const aboOrbit=list=>{const ring=(l,cls)=>l.length?`<span class="ab-ring ${cls}"><span class="ab-rot">${l.map((b,i)=>`<span class="ab-arm" style="--a:${Math.round(360/l.length*i+(cls==="r2"?18:0))}deg;--k:${i}"><span class="ab-sat">${gc(b,{tilt:false,badge:false,plat:false})}</span></span>`).join("")}</span></span>`:"";
  return `<div class="ab-orb" data-off aria-hidden="true"><span class="ab-glow"></span>${ring(list.slice(4),"r2")}${ring(list.slice(0,4),"r1")}<span class="ab-core"><span class="ab-core-in">${LOGO(40)}<b>Abo</b><small>${list.length} Dienste</small></span></span></div>`};
function aboBody(){
  const P=ABOD,sel=P.find(p=>p.id===S.aboPlan)||P[0],same=P.every(p=>aboKey(p)===aboKey(sel));
  const pref=["netflix","disney","spotify","gpu","psplus-essential"],ids=sel.items.map(i=>i.brand);
  const fan=pref.filter(x=>ids.includes(x)).concat(ids.filter(x=>!pref.includes(x))).filter((x,i,a)=>a.indexOf(x)===i).slice(0,9).map(aboBrand).filter(Boolean);
  return `<section class="sec ab-hero">
  <div class="ab-hero-copy">
   <h1 class="h1 rv">Jeden Monat neue Codes</h1>
   <p class="lead rv" style="--d:80ms">Netflix, Disney+, Spotify, DAZN, Xbox Game Pass, PlayStation Plus, Switch Online, Crunchyroll und Amazon-Guthaben – als Code-Paket per E-Mail. Ein fester Preis, online kündbar.</p>
   <div class="ab-hero-a rv" style="--d:140ms"><a class="btn btn-primary btn-lg" href="#plaene">Pläne vergleichen</a><a class="btn btn-soft btn-lg" href="#inhalt">Das steckt drin</a></div>
   <ul class="ab-pts rv" style="--d:200ms"><li>${ic("i-check")}Codes im Wert von im Schnitt ${eurc(sel.avgValue)} pro Monat</li><li>${ic("i-check")}Kündigung online, ohne Anmeldung</li><li>${ic("i-check")}Keine Servicegebühr</li></ul>
  </div>
  ${aboOrbit(fan)}
 </section>
 <section class="sec ab-sec" id="plaene">${secHead("Wähle deinen Plan")}
  <div class="ab-plans">${P.map(aboPlanCard).join("")}</div>
  <p class="fine ab-note">Alle Preise sind Endpreise inkl. MwSt., ohne Servicegebühr. Code-Wert ist der Nennwert der Codes im Paket. Abgebucht wird zu Beginn jeder Laufzeit.</p></section>
 <section class="sec ab-sec" id="inhalt">${secHead("Das steckt drin")}${same?"":`<p class="fine ab-note">Inhalt im Plan ${esc(sel.name)}</p>`}
  <ul class="ab-items">${sel.items.map(aboItem).join("")}</ul>
  <p class="fine ab-note">Du löst die Codes in deinem eigenen Konto beim jeweiligen Dienst ein. Amazon-Guthaben gilt für Einkäufe auf Amazon.de, nicht für die Prime-Mitgliedschaft. Codes mit mehreren Monaten Laufzeit kommen in passenden Abständen.</p></section>
 <section class="sec ab-sec">${secHead("So läuft dein Abo")}
  <ol class="ab-steps">
   <li class="card rv"><span class="si-ic">${ic("i-card-f")}</span><b>Plan wählen und bezahlen</b><span>Sicher über Stripe. Abgebucht wird zu Beginn jeder Laufzeit.</span></li>
   <li class="card rv" style="--d:80ms"><span class="si-ic">${ic("i-mail")}</span><b>Jeden Monat Codes</b><span>Wir prüfen jede Lieferung kurz und schicken dir das Paket per E-Mail. Alle Codes liegen auch in deinem Abo.</span></li>
   <li class="card rv" style="--d:160ms"><span class="si-ic">${ic("i-repeat")}</span><b>Online kündigen</b><span>Über „Verträge hier kündigen“, ohne Anmeldung. Die Bestätigung kommt sofort.</span></li>
  </ol></section>
 ${aboCheckout(sel)}
 <section class="sec ab-sec">${secHead("Häufige Fragen")}${faqList(ABO_FAQ)}</section>`;
}
const aboPlanCard=(p,i)=>{const t=aboTxt(p),on=S.aboPlan===p.id;
  return `<article class="card ab-plan rv${on?" on":""}" style="--d:${i*80}ms" data-plan="${p.id}">
  <header class="ab-plan-h"><h3 class="h3">${esc(p.name)}</h3>${p.months===6?`<span class="chip ab-tag">Günstigster Monatspreis</span>`:""}</header>
  <p class="ab-price"><b>${aboE(p.price)}</b><span>${t.per}</span></p>
  <p class="ab-eq">${p.months>1?`entspricht ${eurc(p.perMonth)} pro Monat`:"monatlich kündbar"}</p>
  <dl class="ab-dl">
   <div><dt>Code-Wert</dt><dd>im Schnitt ${eurc(p.avgValue)} pro Monat</dd></div>
   <div><dt>Erste Laufzeit</dt><dd>${t.term} · Codes im Wert von ${eurc(p.termValue)}</dd></div>
   <div><dt>Verlängerung</dt><dd>${t.renew[0].toUpperCase()+t.renew.slice(1)}</dd></div>
   <div><dt>Kündbar</dt><dd>${t.cancel}</dd></div>
   <div><dt>Abbuchung</dt><dd>${t.charge}</dd></div>
  </dl>
  <button class="btn ${on?"btn-primary":"btn-soft"} btn-lg btn-block" data-a="aboPick" data-v="${p.id}" aria-pressed="${on}">${on?`${esc(p.name)} gewählt`:`${esc(p.name)} wählen`}</button></article>`};
const aboItem=(it,i)=>{const b=aboBrand(it.brand);return `<li class="ab-item rv" style="--d:${(i%6)*50}ms"><span class="ab-item-c">${b?gc(b,{tilt:false,badge:false,plat:false}):""}</span><span class="ab-item-t"><b>${esc(it.label)}</b><small>${it.every===1?"jeden Monat":`alle ${it.every} Monate`} · Wert ${eurc(it.face)}</small></span></li>`};
function aboCheckout(p){
  const t=aboTxt(p);
  return `<section class="sec ab-sec" id="abschluss"><div class="card ab-co rv">
  <div class="ab-co-l"><h2 class="h2">Abo abschließen</h2>
   <div class="chips ab-pick" role="group" aria-label="Plan wählen">${ABOD.map(x=>`<button class="chip" data-a="aboPick" data-v="${x.id}" data-stay="1" aria-pressed="${x.id===p.id}">${esc(x.name)} · ${aboE(x.price)}</button>`).join("")}</div>
   <dl class="ab-dl ab-sum">
    <div><dt>Plan</dt><dd>${esc(p.name)}</dd></div>
    <div><dt>Preis</dt><dd>${eurc(p.price)} ${t.per}${p.months>1?` (entspricht ${eurc(p.perMonth)} pro Monat)`:""}</dd></div>
    <div><dt>Erste Laufzeit</dt><dd>${t.term} ab Zahlung</dd></div>
    <div><dt>Verlängerung</dt><dd>Automatisch, ${t.renew}, bis du kündigst</dd></div>
    <div><dt>Kündigung</dt><dd>${t.cancel}</dd></div>
    <div><dt>Lieferung</dt><dd>Jeden Monat ein Code-Paket per E-Mail, nach kurzer Prüfung</dd></div>
    <div class="ab-sum-tot"><dt>Heute zu zahlen</dt><dd>${eurc(p.price)}</dd></div>
   </dl>
   <p class="fine">Endpreis inkl. MwSt. Keine Servicegebühr.</p></div>
  <div class="ab-co-r">
   <h3 class="h3">E-Mail für dein Abo</h3>${evBox()}
   <label class="chk ab-ok" id="aboOkL"><input type="checkbox" id="aboOk"><span>Ich akzeptiere die <a href="/agb">AGB</a> mit den Abo-Bedingungen und habe die <a href="/datenschutz">Datenschutzerklärung</a> gelesen. Ich stimme zu, dass ihr vor Ablauf der Widerrufsfrist mit der Lieferung beginnt, und weiß, dass mein <a href="/widerruf">Widerrufsrecht</a> mit der ersten Lieferung erlischt.</span></label>
   <div class="err" id="aboErr" role="alert"></div>
   <button class="btn btn-primary btn-ink btn-lg btn-block" id="aboBtn" data-a="aboGo">${ic("i-lock")}<span>Zahlungspflichtig abonnieren</span></button>
   <p class="fine">Weiter zur sicheren Zahlung bei Stripe: Karte, Apple Pay, Google Pay oder Link. Klarna ist für Abos nicht verfügbar. Kündigen kannst du jederzeit unter <a href="/kuendigen">Verträge hier kündigen</a>.</p>
  </div></div></section>`;
}
A.aboPick=(v,el)=>{if(!["pro","premium","max"].includes(v))return;S.aboPlan=v;save();const stay=el&&el.dataset.stay;route(true);
  if(!stay)requestAnimationFrame(()=>{const c=$("#abschluss");c&&c.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"})})};
A.aboGo=async(_,el)=>{
  const err=$("#aboErr");err.textContent="";
  if(!evMail()){err.textContent="Bitte bestätige zuerst deine E-Mail-Adresse mit dem Code.";ckNudge($("#evBox"));const m=$("#payMail");m&&m.focus({preventScroll:true});return}
  if(!$("#aboOk").checked){err.textContent="Bitte bestätige die AGB und den Beginn der Lieferung.";ckNudge($("#aboOkL"));return}
  if(!CFG.payments){err.textContent="Zahlungen sind noch nicht eingerichtet. Bitte versuch es später erneut.";return}
  busy(el,true," Weiterleitung zu Stripe …");
  try{const j=await API("/abo/checkout",{method:"POST",body:{plan:S.aboPlan,consent:true}});S.aboKeys=Object.assign(S.aboKeys||{},{[j.id]:j.key});save();location.href=j.url}
  catch(x){err.innerHTML=esc(x.message)+(/läuft schon ein Abo/.test(x.message)?` <a href="/konto/abos">Zum Konto</a>`:"");busy(el,false)}
};

/* ---------- Abo-Ansicht (Konto und /abo/AB-…) ---------- */
const ABO_ST={active:"Aktiv",past_due:"Zahlung offen",ended:"Beendet",pending:"Zahlung wird bestätigt"};
const ABO_DS={pending:"Wird vorbereitet",delivered:"Geliefert",skipped:"Nicht geliefert",empty:"Keine Codes"};
function aboCard(s){
  const run=["active","past_due"].includes(s.status),t=aboTxt(s),st=s.status==="active"&&s.cancel_at?`Gekündigt zum ${aboDay(s.cancel_at)}`:ABO_ST[s.status]||s.status;
  const f=[["Vertragsnummer",esc(s.id)],["Preis",`${eurc(s.price)} ${t.per}`]];
  if(s.next_charge)f.push(["Nächste Abbuchung",`${aboDay(s.next_charge)} · ${eurc(s.price)}`]);
  if(s.next_delivery)f.push(["Nächste Lieferung",aboDay(s.next_delivery)]);
  if(run&&!s.cancel_at&&s.earliest_end)f.push(["Frühestens kündbar zum",aboDay(s.earliest_end)]);
  if(s.cancel_at&&s.status!=="ended")f.push(["Endet am",aboDay(s.cancel_at)]);
  if(s.status==="ended")f.push(["Beendet am",aboDay(s.ended_at||s.cancel_at)]);
  if(s.refund_due)f.push(["Erstattung",`${eurc(s.refund_due)} für nicht gelieferte Monate, über deine Zahlungsart`]);
  if(s.refunded)f.push(["Erstattet",eurc(s.refunded)]);
  return `<article class="card ab-sub rv" data-st="${esc(s.status)}">
  <header class="ab-sub-h"><div><h2 class="h3">Abo ${esc(s.planName)}</h2><small>${s.started_at?"seit "+aboDay(s.started_at):"neu"}</small></div><span class="ostat" data-s="${s.status==="active"&&!s.cancel_at?"delivered":s.status==="ended"?"canceled":"processing"}">${esc(st)}</span></header>
  ${s.status==="past_due"?`<p class="ab-warn" role="status">${ic("i-card-f")}<span>Die letzte Abbuchung hat nicht geklappt. Bitte bezahle über den Link in unserer E-Mail. Bis dahin pausieren neue Lieferungen.</span></p>`:""}
  <dl class="ab-dl">${f.map(x=>`<div><dt>${x[0]}</dt><dd>${x[1]}</dd></div>`).join("")}</dl>
  <h3 class="ab-sub-t">Lieferungen</h3>
  ${s.deliveries.length?`<div class="ab-months">${s.deliveries.map((d,i)=>aboMonth(d,i===0)).join("")}</div>`:`<p class="fine">Noch keine Lieferung. Das erste Paket legen wir direkt nach der Zahlung an.</p>`}
  ${run&&!s.cancel_at?`<div class="ab-sub-a"><a class="btn btn-soft" href="/kuendigen?abo=${encodeURIComponent(s.id)}">Abo kündigen</a></div>`
    :run?`<p class="fine ab-sub-n">Deine Kündigung ist eingegangen${s.cancel_requested_at?` (${aboDT(s.cancel_requested_at)})`:""}. Bis zum ${aboDay(s.cancel_at)} läuft dein Abo normal weiter.</p>`:""}
 </article>`;
}
function aboMonth(d,open){
  const n=d.items.length,sub=d.status==="delivered"&&d.delivered_at?`geliefert am ${aboDay(d.delivered_at)}`:ABO_DS[d.status]||d.status;
  return `<details class="ab-month" data-s="${esc(d.status)}"${open?" open":""}><summary><span class="ab-month-t"><b>Monat ${d.month}</b><small>${aboDay(d.due_at)} · ${n} ${n===1?"Code":"Codes"} · ${esc(sub)}</small></span>${ic("i-down")}</summary>
   ${d.status==="pending"?`<p class="fine">Wir prüfen jede Lieferung kurz von Hand. Danach kommen die Codes per E-Mail und erscheinen hier.</p>`:""}
   ${d.status==="skipped"?`<p class="fine">Dieser Monat wurde nicht geliefert. Wir melden uns per E-Mail bei dir.</p>`:""}
   <ul class="ab-mi">${d.items.map(i=>{const b=aboBrand(i.brand);return `<li><span class="ab-mi-h">${b?mini(b):""}<span><b>${esc(i.label)}</b><small>Wert ${eurc(i.face)}</small></span></span>${(i.codes||[]).map(c=>{const k="abc"+(++abN);
     return `<div class="od-code"><span class="od-code-l" id="${k}l">Dein Code</span><code class="od-code-v" id="${k}" data-code="${esc(c)}" aria-labelledby="${k}l ${k}">${esc(mask(c))}</code><div class="od-code-a"><button class="btn btn-soft" data-a="codeShow" data-v="${esc(c)}" aria-controls="${k}" aria-pressed="false">${ic("i-eye")}<span>Zeigen</span></button><button class="btn btn-primary" data-a="codeCopy" data-v="${esc(c)}">${ic("i-copy")}<span>Code kopieren</span></button></div></div>`}).join("")}</li>`}).join("")}</ul></details>`;
}
function aboDetail(id,qs){
  const k=qs.get("k")||(S.aboKeys&&S.aboKeys[id])||"",neu=qs.get("neu")==="1";
  if(qs.get("k")){S.aboKeys=Object.assign(S.aboKeys||{},{[id]:k});save()}
  return {title:"Abo "+id,html:`<div class="sec ab-det" id="abDet"><div class="od-load"><div class="spin"></div><p>Abo wird geladen …</p></div></div>`,
  after(){
    clearTimeout(pollT);const path=cur.path;let n=0,seen="";
    const tick=async()=>{
      if(cur.path!==path)return;n++;let j;
      try{j=(await Promise.all([API(`/abo/vertrag/${encodeURIComponent(id)}?k=${encodeURIComponent(k)}`),aboPlans().catch(()=>null)]))[0]}
      catch(e){const el=$("#abDet");if(el)el.innerHTML=`<div class="card">${empty("Abo nicht gefunden","Öffne den Link aus deiner E-Mail oder melde dich an.",["/konto/abos","Zum Konto"])}</div>`;return}
      if(cur.path!==path)return;
      const s=j.sub,sig=s.status+"|"+s.deliveries.map(d=>d.status).join(","),el=$("#abDet");
      if(sig!==seen&&el){seen=sig;el.innerHTML=aboDetailView(s,j.email,neu);$$(".rv",el).forEach(x=>x.classList.add("in"));fx(el)}
      const wait=s.status==="pending"?2500:s.deliveries.some(d=>d.status==="pending")?20000:0;
      if(wait&&n<200)pollT=setTimeout(tick,wait);
    };
    tick();
  }};
}
function aboDetailView(s,email,neu){
  const H=s.status==="pending"?["Zahlung wird bestätigt …","Das dauert meist nur wenige Sekunden. Bitte lass diese Seite kurz offen."]
    :neu&&s.status==="active"?[`Willkommen im Abo ${esc(s.planName)}`,`Danke! Dein erstes Paket bereiten wir gerade vor. Sobald es geprüft ist, kommen die Codes an ${esc(email)} und erscheinen hier.`]
    :[`Dein Abo ${esc(s.planName)}`,`Alle Lieferungen und Codes an einem Ort. Die E-Mails gehen an ${esc(email)}.`];
  return `<header class="ab-det-h rv">${s.status==="pending"?`<div class="spin" aria-hidden="true"></div>`:`<span class="od-medal metal" aria-hidden="true">${ic(s.status==="ended"?"i-x":"i-check")}</span>`}<h1 class="h1">${H[0]}</h1><p class="lead">${H[1]}</p></header>
  ${aboCard(s)}
  ${!S.user&&s.status!=="pending"?`<div class="card ab-cta rv"><h2 class="h3">Alles an einem Ort</h2><p class="fine">Erstelle ein Konto mit ${esc(email)}, dann findest du dein Abo und alle Codes unter Konto › Abos.</p><a class="btn btn-soft" href="/login?m=reg&r=/konto/abos">Konto erstellen</a></div>`:""}`;
}
/* Konto › Abos (Aufruf aus apiAccount in 50-live.js) */
function aboAccount(){
  Promise.all([API("/abo/mine"),aboPlans().catch(()=>null)]).then(([j])=>{const el=$("#accBody");if(!el)return;el.classList.remove("acc-wait");
    el.innerHTML=j.subs.length?`<div class="ab-acc">${j.subs.map(aboCard).join("")}</div>`
      :`<div class="card acc-none">${empty("Noch kein Abo","Mit dem instantcodes Abo bekommst du jeden Monat Codes für Netflix, Disney+, Spotify und mehr.",["/abo","Abo ansehen"])}</div>`;
    $$(".rv",el).forEach(x=>x.classList.add("in"));fx(el)})
  .catch(e=>{const el=$("#accBody");if(el){el.classList.remove("acc-wait");el.innerHTML=`<p class="err">${esc(e.message)}</p>`}});
}

/* ---------- /kuendigen: Kündigungsseite nach § 312k BGB (ohne Anmeldung, Bestätigung sofort) ---------- */
function cancelPage(_,qs){
  const ref=(qs.get("abo")||"").toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,20),u=S.user;
  const min=new Date(Date.now()+864e5).toISOString().slice(0,10);
  const opt=(name,val,title,sub,on)=>`<label class="kd-opt"><input type="radio" name="${name}" value="${val}"${on?" checked":""}><span><b>${title}</b>${sub?`<small>${sub}</small>`:""}</span></label>`;
  return {title:"Verträge hier kündigen",html:`<div class="kd sec" id="kdRoot">
 <header class="kd-head rv"><h1 class="h1">Verträge hier kündigen</h1><p class="lead">Kündige dein instantcodes Abo ohne Anmeldung. Die Bestätigung siehst du sofort hier und bekommst sie per E-Mail.</p></header>
 <div class="kd-grid">
  <form class="card kd-form rv" id="kdForm" novalidate>
   <fieldset class="kd-fs"><legend class="h3">Deine Angaben</legend>
    <div class="kd-f"><label class="lbl" for="kdName">Vor- und Nachname</label><input class="inp" id="kdName" autocomplete="name" value="${esc(u?u.name:"")}"></div>
    <div class="kd-f"><label class="lbl" for="kdMail">E-Mail-Adresse</label><input class="inp" id="kdMail" type="email" inputmode="email" autocomplete="email" value="${esc(u?u.email:"")}" aria-describedby="kdMailH"><small class="fine" id="kdMailH">Die Adresse, mit der du das Abo abgeschlossen hast.</small></div>
    <div class="kd-f"><label class="lbl" for="kdRef">Vertragsnummer (falls bekannt)</label><input class="inp" id="kdRef" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="AB-1A2B3C4D" value="${esc(ref)}" aria-describedby="kdRefH"><small class="fine" id="kdRefH">Steht in jeder E-Mail zu deinem Abo.</small></div>
   </fieldset>
   <fieldset class="kd-fs"><legend class="h3">Art der Kündigung</legend>
    ${opt("kdKind","ordentlich","Ordentliche Kündigung","Zum nächstmöglichen Termin laut Vertrag.",true)}
    ${opt("kdKind","ausserordentlich","Außerordentliche Kündigung","Fristlos aus wichtigem Grund.")}
    <div class="kd-f" id="kdReasonW" hidden><label class="lbl" for="kdReason">Grund für die außerordentliche Kündigung</label><textarea class="inp" id="kdReason" rows="3" maxlength="1000"></textarea></div>
   </fieldset>
   <fieldset class="kd-fs"><legend class="h3">Zeitpunkt</legend>
    ${opt("kdWhen","asap","Zum nächstmöglichen Zeitpunkt","",true)}
    ${opt("kdWhen","date","Zu einem bestimmten Datum","")}
    <div class="kd-f" id="kdDateW" hidden><label class="lbl" for="kdDate">Datum</label><input class="inp" id="kdDate" type="date" min="${min}"></div>
   </fieldset>
   <section class="kd-sum" aria-labelledby="kdSumH"><h2 class="h3" id="kdSumH">Deine Kündigung</h2><dl class="ab-dl" id="kdSum"></dl></section>
   <div class="err" id="kdErr" role="alert"></div>
   <button type="submit" class="btn btn-primary btn-ink btn-lg btn-block" data-a="kdGo">Jetzt kündigen</button>
   <p class="fine">Mit „Jetzt kündigen“ gibst du deine Kündigung ab. Du siehst die Bestätigung sofort mit Datum und Uhrzeit und bekommst sie per E-Mail.</p>
  </form>
  <aside class="kd-side">
   <div class="card kd-info rv"><h2 class="h3">So endet dein Abo</h2>
    <ul class="kd-rules"><li><b>Pro</b><span>Zum Ende des bezahlten Monats.</span></li><li><b>Premium und Max</b><span>Zum Ende der ersten Laufzeit (3 bzw. 6 Monate). Nach einer Verlängerung jederzeit mit einem Monat Frist; nicht mehr gelieferte Monate erstatten wir anteilig.</span></li><li><b>Außerordentlich</b><span>Sofort, wenn ein wichtiger Grund vorliegt.</span></li></ul>
    <p class="fine">Bis zum Vertragsende bekommst du deine Code-Pakete wie gewohnt.</p></div>
   <div class="card kd-info rv"><h2 class="h3">Lieber per E-Mail?</h2><p class="fine">Schreib an <a href="mailto:${esc(SUP())}">${esc(SUP())}</a> mit Name, E-Mail-Adresse und Vertragsnummer.</p></div>
  </aside>
 </div></div>`,
  after(){const f=$("#kdForm");if(!f)return;f.addEventListener("input",kdSync);f.addEventListener("change",kdSync);kdSync()}};
}
const kdVal=s=>(($(s)||{}).value||"").trim(),kdRadio=n=>(document.querySelector(`input[name="${n}"]:checked`)||{}).value;
const kdData=()=>({name:kdVal("#kdName"),email:kdVal("#kdMail").toLowerCase(),ref:kdVal("#kdRef").toUpperCase(),kind:kdRadio("kdKind")||"ordentlich",reason:kdVal("#kdReason"),when:kdRadio("kdWhen")||"asap",date:kdVal("#kdDate")});
const kdDate=d=>new Date(d+"T12:00:00").toLocaleDateString("de-DE",{day:"numeric",month:"long",year:"numeric"});
function kdSync(){
  const d=kdData(),rw=$("#kdReasonW"),dw=$("#kdDateW"),sum=$("#kdSum");if(!sum)return;
  rw.hidden=d.kind!=="ausserordentlich";dw.hidden=d.when!=="date";
  const rows=[["Name",d.name||"–"],["E-Mail",d.email||"–"],["Vertragsnummer",d.ref||"nicht angegeben"],["Art",d.kind==="ausserordentlich"?"Außerordentliche Kündigung":"Ordentliche Kündigung"]]
    .concat(d.kind==="ausserordentlich"?[["Grund",d.reason||"–"]]:[],[["Zeitpunkt",d.when==="date"?(d.date?"zum "+kdDate(d.date):"Datum wählen"):"zum nächstmöglichen Zeitpunkt"]]);
  sum.innerHTML=rows.map(r=>`<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join("");
}
A.kdGo=async(_,el)=>{
  const d=kdData(),err=$("#kdErr");err.textContent="";$$("#kdForm .bad").forEach(x=>x.classList.remove("bad"));
  const no=(m,s)=>{err.textContent=m;const x=$(s);if(x){x.classList.add("bad");x.focus()}};
  if(d.name.length<2)return no("Bitte gib deinen Namen an.","#kdName");
  if(!/^\S+@\S+\.\S+$/.test(d.email))return no("Bitte gib die E-Mail-Adresse an, mit der du das Abo abgeschlossen hast.","#kdMail");
  if(d.kind==="ausserordentlich"&&d.reason.length<3)return no("Bitte nenne den Grund für die außerordentliche Kündigung.","#kdReason");
  if(d.when==="date"&&!d.date)return no("Bitte wähle das Datum, zu dem du kündigen möchtest.","#kdDate");
  busy(el,true," Wird gesendet …");
  try{const j=await API("/abo/kuendigen",{method:"POST",body:Object.assign({},d,{via:S.user&&d.ref?"konto":"formular"})});kdDone(j.cancel)}
  catch(x){err.textContent=x.message;busy(el,false)}
};
const kdRows=c=>[["Eingangsnummer",c.id],["Eingegangen am",aboDT(c.received_at)],["Name",c.name],["E-Mail",c.email],["Vertragsnummer",c.ref||"nicht angegeben"],
  ["Art",c.kind==="ausserordentlich"?"Außerordentliche Kündigung":"Ordentliche Kündigung"]].concat(c.reason?[["Grund",c.reason]]:[],
  [["Gewünschter Zeitpunkt",c.wish==="date"&&c.wish_date?"zum "+aboDay(c.wish_date):"zum nächstmöglichen Zeitpunkt"]],c.results.map(x=>[`Vertragsende ${x.sub}`,aboDay(x.end)]));
const kdResult=x=>x.already?"Dieser Vertrag war bereits zu diesem Termin gekündigt."
  :x.adjusted?`Der gewünschte Termin liegt vor dem frühestmöglichen Ende. Deine Kündigung gilt deshalb zum ${aboDay(x.end)}.`
  :"Bis dahin bekommst du deine Code-Pakete wie gewohnt, danach buchen wir nichts mehr ab.";
function kdDone(c){
  kdLast=c;const r=$("#kdRoot");if(!r)return;
  r.innerHTML=`<div class="kd-done">
  <header class="kd-done-h rv in"><span class="od-medal metal" aria-hidden="true">${ic("i-check")}</span><h1 class="h1" id="kdDoneH" tabindex="-1">Deine Kündigung ist eingegangen</h1>
   <p class="lead">Eingegangen am <b>${aboDT(c.received_at)}</b>. Die Bestätigung ist unterwegs an ${esc(c.email)}.</p></header>
  ${c.results.length?c.results.map(x=>`<div class="card kd-res rv in"><small>Abo ${esc(x.planName)} · ${esc(x.sub)}</small><p class="kd-end">Endet am ${aboDay(x.end)}</p><p class="fine">${kdResult(x)}${x.refund>0?` Für Monate, die nicht mehr geliefert werden, erstatten wir dir anteilig ${eurc(x.refund)}.`:""}</p></div>`).join("")
    :`<div class="card kd-res rv in"><p class="kd-end">Wir ordnen deine Kündigung zu</p><p class="fine">Zu diesen Angaben haben wir noch keinen laufenden Vertrag gefunden. Wir prüfen deine Kündigung von Hand und melden uns bei dir. Du musst nichts weiter tun.</p></div>`}
  <div class="card kd-rec rv in"><h2 class="h3">Deine Kündigungserklärung</h2><dl class="ab-dl">${kdRows(c).map(x=>`<div><dt>${esc(x[0])}</dt><dd>${esc(x[1])}</dd></div>`).join("")}</dl>
   <div class="kd-acts"><button class="btn btn-primary" data-a="kdSave">${ic("i-receipt")}Bestätigung speichern</button><button class="btn btn-soft" data-a="kdPrint">Drucken</button></div></div>
  <p class="fine kd-foot">Fragen? Schreib an <a href="mailto:${esc(SUP())}">${esc(SUP())}</a> und nenne die Eingangsnummer ${esc(c.id)}.</p></div>`;
  scrollTo({top:0,left:0,behavior:"instant"});const h=$("#kdDoneH");h&&h.focus({preventScroll:true});
}
A.kdSave=()=>{if(!kdLast)return;const c=kdLast;
  const txt=`Kündigungsbestätigung – instantcodes\n${"=".repeat(36)}\n\n${kdRows(c).map(x=>`${x[0]}: ${x[1]}`).join("\n")}\n\n`+
    (c.results.length?c.results.map(x=>`Abo ${x.planName} (${x.sub}): endet am ${aboDay(x.end)}. ${kdResult(x)}${x.refund>0?` Anteilige Erstattung: ${eurc(x.refund)}.`:""}`).join("\n"):"Zu diesen Angaben wurde noch kein laufender Vertrag gefunden. Die Kündigung wird von Hand zugeordnet.")+
    `\n\nFragen: ${SUP()}\n${location.origin}/kuendigen\n`;
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([txt],{type:"text/plain;charset=utf-8"}));a.download=`Kuendigung-${c.id}.txt`;document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800);toast("Bestätigung gespeichert")};
A.kdPrint=()=>window.print();
