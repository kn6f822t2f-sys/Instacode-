/* ---------- Newsletter (Fußzeile, Double-Opt-in) und Einwilligung zu Bewertungsanfragen (Konto, Bestellseite) ----------
   Fußzeile: kleiner eigener Block nlFooter(), eingebunden in renderFooter() (70-reviews-chat.js).
   Anmeldung → POST /api/newsletter → Bestätigungsmail; eingetragen ist man erst nach dem Klick auf den Link (server.js).
   Bewertungsanfrage per E-Mail nur mit freiwilliger, nicht vorausgewählter Zustimmung: im Konto (Einstellungen) oder auf der Bestellseite.
   Die Kasse (40-cart.js) bleibt unverändert. */
function nlFooter(){return `<form class="nl" id="nlForm" novalidate aria-labelledby="nlH">
 <h5 class="nl-h" id="nlH">Newsletter</h5>
 <p class="nl-p">Neue Marken, Angebote und Aktionen per E-Mail. Abmelden geht jederzeit mit einem Klick.</p>
 <div class="nl-row"><label class="sr" for="nlMail">E-Mail-Adresse für den Newsletter</label><input class="inp nl-in" id="nlMail" type="email" autocomplete="email" inputmode="email" placeholder="deine@email.de" aria-describedby="nlFine nlMsg"><button class="btn btn-primary btn-ink nl-b" type="submit">Anmelden</button></div>
 <p class="nl-fine" id="nlFine">Du bekommst zuerst eine E-Mail zur Bestätigung. Erst danach schicken wir dir Werbung per E-Mail. Widerruf jederzeit, mehr unter <a href="/datenschutz">Datenschutz</a>.</p>
 <p class="nl-msg" id="nlMsg" role="status" aria-live="polite"></p></form>`}
document.addEventListener("submit",async e=>{const f=e.target;if(!f||f.id!=="nlForm")return;e.preventDefault();
  const i=$("#nlMail",f),m=i.value.trim(),out=$("#nlMsg",f),b=$("button",f);
  if(!/^\S+@\S+\.\S+$/.test(m)){out.textContent="Bitte gib eine gültige E-Mail-Adresse ein.";out.className="nl-msg err";i.setAttribute("aria-invalid","true");i.focus();return}
  i.removeAttribute("aria-invalid");busy(b,true);
  try{const j=await API("/newsletter",{method:"POST",body:{email:m,source:"fusszeile"}});out.textContent=j.msg;out.className="nl-msg ok";i.value=""}catch(x){out.textContent=x.message;out.className="nl-msg err"}
  busy(b,false)});

/* Konto › Einstellungen: zwei Zeilen (Bewertungsanfragen, Newsletter), Stand kommt von /api/consent */
function consentRows(){return `<div class="setrow"><span class="si-ic">${ic("i-star")}</span><div class="mid"><b id="rvL">Bewertungsanfragen per E-Mail</b><small>Nach einer Lieferung fragen wir dich einmal, wie zufrieden du warst. Freiwillig, jederzeit abschaltbar.</small></div><button class="switch" role="switch" aria-checked="false" data-a="rvAcc" aria-labelledby="rvL" id="rvSw"></button></div>
   <div class="setrow"><span class="si-ic">${ic("i-mail")}</span><div class="mid"><b>Newsletter</b><small id="nlSt">Neue Marken, Angebote und Aktionen per E-Mail.</small></div><span id="nlAct"></span></div>`}
async function consentMount(){let j;try{j=await API("/consent")}catch(e){return}
  const sw=$("#rvSw");if(sw)sw.setAttribute("aria-checked",String(!!j.review));nlAcc(j.newsletter)}
function nlAcc(st){const s=$("#nlSt"),a=$("#nlAct");if(!s||!a)return;
  s.textContent=st==="active"?"Angemeldet: Neuigkeiten zu neuen Marken, Angeboten und Aktionen.":st==="pending"?"Fast geschafft: Bitte bestätige die Anmeldung über den Link in unserer E-Mail.":"Neue Marken, Angebote und Aktionen per E-Mail.";
  a.innerHTML=st==="active"?`<button class="btn btn-soft btn-sm" data-a="nlOff">Abmelden</button>`:`<button class="btn btn-soft btn-sm" data-a="nlOn">${st==="pending"?"Erneut senden":"Anmelden"}</button>`}
A.rvAcc=async(v,el)=>{const on=el.getAttribute("aria-checked")!=="true";el.setAttribute("aria-checked",on);
  try{await API("/consent/review",{method:"POST",body:{on}});toast(on?"Bewertungsanfragen eingeschaltet":"Bewertungsanfragen ausgeschaltet")}catch(e){toast(e.message);el.setAttribute("aria-checked",!on)}};
A.nlOn=async(v,el)=>{if(!S.user)return;busy(el,true);try{await API("/newsletter",{method:"POST",body:{email:S.user.email,source:"konto"}});toast("Bitte bestätige die Anmeldung in unserer E-Mail");nlAcc("pending")}catch(e){toast(e.message);busy(el,false)}};
A.nlOff=async(v,el)=>{busy(el,true);try{await API("/newsletter/off",{method:"POST"});toast("Vom Newsletter abgemeldet");nlAcc("unsub")}catch(e){toast(e.message);busy(el,false)}};

/* Bestellseite: Platzhalter aus orderView(), wird hier befüllt (Stand vom Server, Bestellschlüssel aus S.keys) */
const rvOptBox=o=>["canceled","refunded"].includes(o.status)||o.reviewed?"":`<div class="card rvopt" data-o="${esc(o.id)}" hidden></div>`;
async function rvOptMount(box){box.dataset.on="1";const id=box.dataset.o,k=(S.keys&&S.keys[id])||new URLSearchParams(location.search).get("k")||"";
  let j;try{j=await API(`/consent/review?order=${encodeURIComponent(id)}&k=${encodeURIComponent(k)}`)}catch(e){return}
  if(!box.isConnected||j.reviewed||j.asked)return;
  box.innerHTML=j.account?`<p class="rvopt-p">${ic("i-star")}<span>Nach der Lieferung fragen wir dich einmal per E-Mail nach deiner Meinung. Das kannst du in deinem <a href="/konto/einstellungen">Konto</a> abschalten.</span></p>`
    :`<label class="chk rvopt-c"><input type="checkbox" id="rvOk"${j.on?" checked":""}><span><b>Bewertungsanfrage per E-Mail (freiwillig)</b><br>Ja, ihr dürft mich ein paar Tage nach der Lieferung einmal per E-Mail fragen, wie zufrieden ich war. Widerruf jederzeit über den Link in der E-Mail.</span></label>`;
  box.hidden=false;
  const c=$("#rvOk",box);if(c)c.addEventListener("change",async()=>{const on=c.checked;try{await API("/consent/review",{method:"POST",body:{order:id,k,on}});toast(on?"Danke! Wir fragen dich nach der Lieferung einmal per E-Mail.":"Keine Bewertungsanfrage per E-Mail")}catch(e){c.checked=!on;toast(e.message)}})}
const rvOptScan=()=>$$(".rvopt:not([data-on])").forEach(rvOptMount);
if("MutationObserver" in window&&$("#app"))new MutationObserver(rvOptScan).observe($("#app"),{childList:true,subtree:true});
