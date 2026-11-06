/* ---------- Bewertungen + Trustpilot (nur echte Daten) ---------- */
let REV=null;
const stars=n=>`<span class="stars" role="img" aria-label="${String(Math.round(n*10)/10).replace(".",",")} von 5 Sternen">${[1,2,3,4,5].map(i=>ic("i-star",i<=Math.round(n)?"":"off")).join("")}</span>`;
const rcard=r=>`<article class="card rcard rv">${stars(r.rating)}${r.text?`<p>${esc(r.text)}</p>`:""}<footer class="who"><b>${esc(r.name)}</b><span class="verified">${ic("i-check")}Verifizierter Kauf</span><span class="when">${new Date(r.date).toLocaleDateString("de-DE",{month:"long",year:"numeric"})}${r.brands&&r.brands.length?`, ${esc(r.brands.join(", "))}`:""}</span></footer></article>`;
async function loadReviews(sel){
  const el=$(sel);if(!el)return;
  try{REV=REV||await API("/reviews")}catch(e){return}
  if(!el.isConnected)return;
  const tp=CFG.trustpilot&&S.cookie==="all", own=REV.count>=3;
  if(!own&&!tp){el.hidden=true;return}
  el.hidden=false;
  el.innerHTML=`${secHead("Das sagen Kundinnen und Kunden")}${own?`<div class="rv-head"><span class="rv-avg">${Number(REV.avg).toFixed(1).replace(".",",")}</span><div>${stars(REV.avg)}<div class="rv-count">aus ${REV.count} verifizierten Bewertungen</div></div></div><div class="rv-grid">${REV.items.slice(0,6).map(rcard).join("")}</div><p class="fine rv-note">${ic("i-shield")}So prüfen wir Bewertungen: Bewerten kann nur, wer bei uns bestellt und seinen Code erhalten hat, einmal pro Bestellung. Wir zeigen alle Bewertungen, auch kritische. Entfernt werden nur Beiträge mit Beleidigungen, persönlichen Daten oder Werbung.</p>`:""}${tp?`<div class="tp-box" id="tpBox"></div>`:""}`;
  reveal(el);if(tp)mountTrustpilot($("#tpBox"));
}
function mountTrustpilot(box){
  if(!box||!CFG.trustpilot)return;const t=CFG.trustpilot;
  box.innerHTML=`<div class="trustpilot-widget" data-locale="de-DE" data-template-id="${esc(t.tpl)}" data-businessunit-id="${esc(t.bu)}" data-style-height="52px" data-style-width="100%" data-theme="${isDark()?"dark":"light"}"><a href="${esc(t.url)}" target="_blank" rel="noopener">Bewertungen auf Trustpilot</a></div>`;
  const go2=()=>{try{window.Trustpilot&&window.Trustpilot.loadFromElement(box.firstElementChild,true)}catch(e){}};
  if(window.Trustpilot)return go2();
  if(!$("#tpjs")){const sc=document.createElement("script");sc.id="tpjs";sc.src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js";sc.async=true;sc.onload=go2;document.head.appendChild(sc)}
}

function renderAcc(){const a=$("#hacc");a.innerHTML=S.user?`<span class="avatar" title="${esc(S.user.name)}">${esc(initials(S.user.name))}</span>`:`<span class="btn btn-primary btn-sm">Anmelden</span>`;a.setAttribute("href",S.user?"/konto":"/login")}
function renderFooter(){
  const cats=CATSV();
  $("#ftr").innerHTML=`<div class="ft">
  <div class="ft-top"><a class="ft-logo" href="/" aria-label="instantcodes Startseite">${LOGO(40)}<span class="wordmark"><b>instant</b>codes</span></a>
   <p>Gutscheine, Spiele-Keys, Abos und Handy-Guthaben von ${BRANDS.length.toLocaleString("de-DE")} Produkten. Bezahlt in Sekunden, Code direkt per E-Mail.</p>
   ${payLogos()}</div>
  <div class="ft-cols">
   <div><h5>Sortiment</h5><ul>${cats.slice(0,7).map(c=>`<li><a href="/kategorie/${c.id}">${esc(c.name)}</a></li>`).join("")}</ul></div>
   <div><h5>Service</h5><ul><li><a href="/abo">instantcodes Abo</a></li><li><a href="/angebote">Angebote</a></li><li><a href="/hilfe">Hilfe und FAQ</a></li><li><a href="/konto">Mein Konto</a></li><li><button class="lnk" data-a="chatOpen">Assistentin Mia</button></li></ul></div>
   <div><h5>Rechtliches</h5><ul><li><a href="https://mein.online-impressum.de/instacode/" target="_blank" rel="noopener">Impressum</a></li><li><a href="/agb">AGB</a></li><li><a href="/widerruf">Widerrufsbelehrung</a></li><li><a href="/datenschutz">Datenschutz</a></li><li><button class="lnk" data-a="cookieOpen">Cookie-Einstellungen</button></li><li><a href="/kuendigen">Verträge hier kündigen</a></li></ul></div>
   <div><h5>Kontakt</h5><ul><li><a href="mailto:${esc(CFG.support)}">${esc(CFG.support)}</a></li><li><a href="/hilfe">Hilfe und Kontakt</a></li></ul></div>
  </div>
  <div class="ft-giant" aria-hidden="true"><b>instant</b>codes</div>
  <div class="ft-bottom"><span>© ${new Date().getFullYear()} ${esc(CFG.site||"instantcodes")}</span><span class="ft-stripe">Zahlungsabwicklung durch <img src="/pay/stripe.svg" alt="Stripe" loading="lazy" onerror="this.replaceWith(document.createTextNode('Stripe'))"></span></div>
  </div>`;
}
function applyTheme(){document.documentElement.setAttribute("data-theme","dark")}
function confetti(){if(reduce)return;const box=$("#confetti"),cols=["#FFFFFF","#E9EBEE","#B5BAC3","#FFE0F0","#DCCBFF","#D3FBF2"];for(let i=0;i<50;i++){const p=document.createElement("i");p.style.cssText=`left:${Math.random()*100}%;background:${cols[i%6]};--dx:${(Math.random()-.5)*180}px;--r:${Math.random()*720-360}deg;animation-duration:${1.7+Math.random()*1.4}s;animation-delay:${Math.random()*.3}s;width:${6+Math.random()*6}px;height:${8+Math.random()*8}px`;box.appendChild(p)}setTimeout(()=>{box.innerHTML=""},3800)}

/* ---------- chat ---------- */
const chat={open:false,started:false,asked:{}};
const KB=[
  [/rabatt|aktionscode|willkommen10|sparen|gutscheincode/i,"Mit dem Code <b>WILLKOMMEN10</b> bekommst du 10 % Rabatt auf deine erste Bestellung.",["/warenkorb","Zum Warenkorb"]],
  [/einl(ö|oe)s|aktivier|code/i,"Öffne den Dienst der Marke, wähle „Code einlösen“ und gib den Code ein. Deine Codes findest du auch unter Konto › Bestellungen.",["/konto/bestellungen","Meine Codes"]],
  [/dauer|lieferung|wann|schnell|sekunden|ankommen/i,"Meist sofort nach der Zahlung, automatisch per E-Mail. Falls wir eine Bestellung zur Sicherheit kurz prüfen, dauert es etwas länger. Den Stand siehst du auf der Bestellseite."],
  [/zahl|bezahl|paypal|karte|klarna|ideal|apple pay|google pay/i,()=>`Du kannst mit ${payNames()} bezahlen. Die Zahlung läuft sicher über Stripe.`],
  [/aufladen|handy|guthaben|nummer|prepaid|tarif|ausland/i,"Wähle Land und Nummer, der Anbieter wird meist automatisch erkannt. Danach Betrag wählen und bezahlen.",["/aufladen","Jetzt aufladen"]],
  [/geschenk|verschenk|schenken/i,"Auf jeder Produktseite kannst du „Als Geschenk senden“ aktivieren, mit E-Mail, Nachricht und Kartendesign."],
  [/konto|login|anmelden|registr/i,"Du kannst dich mit deiner E-Mail-Adresse anmelden. Dann bleiben Codes, Nummern und Favoriten gespeichert.",["/login","Anmelden"]],
  [/spiel|steam|playstation|xbox|nintendo|roblox|fortnite/i,"Spielguthaben gibt es für Steam, PlayStation, Xbox, Nintendo und mehr.",["/kategorie/gaming","Zu den Spielen"]],
  [/problem|fehler|erstatt|zur(ü|ue)ck|storno|funktioniert nicht/i,`Das tut mir leid. Schreib dem Team mit deiner Bestellnummer an <b>${esc(CFG.support)}</b>.`],
  [/^(hallo|hi|hey|moin|servus)/i,"Hallo! Wobei kann ich dir helfen?"],
  [/danke|super|perfekt/i,"Sehr gern! Sag Bescheid, wenn du noch etwas brauchst."]
];
const QR=["Wie löse ich einen Code ein?","Wie schnell kommt mein Code?","Welche Zahlungsarten gibt es?","Handy aufladen","Gibt es einen Rabattcode?","Kann ich verschenken?"];
const logEnd=()=>{const l=$("#chatLog");l.scrollTop=l.scrollHeight};
function qr(){const left=QR.filter(q=>!chat.asked[q]).slice(0,4);$("#chatQr").innerHTML=left.map(q=>`<button data-a="chatQ" data-v="${esc(q)}">${esc(q)}</button>`).join("");$("#chatQr").hidden=!left.length}
function bot(html,act){const l=$("#chatLog"),t=document.createElement("div");t.className="msg bot typing";t.setAttribute("aria-hidden","true");t.innerHTML="<i></i><i></i><i></i>";l.appendChild(t);logEnd();setTimeout(()=>{t.remove();const m=document.createElement("div");m.className="msg bot";m.innerHTML=html+(act?`<a class="mact" href="${act[0]}" data-a="chatClose">${esc(act[1])}${ic("i-chev")}</a>`:"");l.appendChild(m);logEnd()},reduce?0:650+Math.random()*450)}
function ask(text){const m=document.createElement("div");m.className="msg user";m.textContent=text;$("#chatLog").appendChild(m);logEnd();chat.asked[text]=true;qr();const hit=KB.find(k=>k[0].test(text));if(hit)bot(typeof hit[1]==="function"?hit[1]():hit[1],hit[2]);else bot("Dazu habe ich leider keine Antwort. Probier eine der Fragen unten oder schau in die Hilfe.",["/hilfe","Zur Hilfe"])}
A.chatQ=v=>ask(v);
/* Mia öffnet sich als Glas-Fenster unter ihrem Knopf in der Kopfzeile (#hai); der runde Knopf unten (#chatFab) bleibt ausgeblendet */
const chatBtns=()=>[$("#hai"),$("#chatFab")].filter(Boolean);
A.chatOpen=(v,el)=>{
  if(!chat.open)chat.from=el&&!el.closest("#menu,#qpanel")?el:$("#hai");
  closeMenu(true);palClose(true);qaClose();nudgeHide();
  const ch=$("#chat");underHdr(ch);const o=originAt(ch,$("#hai"),true);if(o)ch.style.setProperty("--ox",o[0]);const hd=$("#hai .hai-dot");hd&&hd.remove();chat.open=true;$("#chat").classList.add("open");chatBtns().forEach(b=>b.setAttribute("aria-expanded","true"));
  const b=$("#chatBadge");b.dataset.n="0";b.textContent="";
  if(!chat.started){chat.started=true;bot(`Hi${S.user?" "+esc(S.user.name.split(" ")[0]):""}, ich bin Mia, die digitale Assistentin von instantcodes. Ich helfe dir bei Aufladung, Gutscheinen und Bezahlung. Für persönliche Hilfe leite ich dich an unser Support-Team weiter.`);setTimeout(()=>bot("Wobei kann ich helfen?"),reduce?0:1300);qr()}
  if(matchMedia("(pointer:fine)").matches)setTimeout(()=>$("#chatIn").focus({preventScroll:true}),100);
};
function chatClose(silent){if(!chat.open)return;chat.open=false;$("#chat").classList.remove("open");chatBtns().forEach(b=>b.setAttribute("aria-expanded","false"));const f=chat.from||$("#hai");if(silent!==true&&f&&document.contains(f))f.focus({preventScroll:true})}
A.chatClose=(v,el)=>chatClose(!!el&&el.tagName==="A");
A.chatToggle=(v,el)=>chat.open?chatClose():A.chatOpen(v,el);
$("#hai").setAttribute("aria-expanded","false");$("#hai").setAttribute("aria-controls","chat");
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();const i=$("#chatIn"),v=i.value.trim();if(!v)return;i.value="";ask(v)});

/* ---------- pop-ups ---------- */
const anyOverlay=()=>$("#scrim").classList.contains("open")||$("#menu").classList.contains("open")||chat.open||$("#cookie").classList.contains("show")||!!$(".proc");
const quietRoute=()=>/^\/(kasse|login|bestellung)/.test(cur.path||"");
/* Hinweis-Blase unter Mias Knopf: vom Inhaber abgeschaltet (keine ungefragten Pop-ups); NUDGE=true schaltet sie wieder ein */
const NUDGE=false;let nudged=false;
function nudgeShow(){if(!NUDGE||nudged)return;if(anyOverlay()||quietRoute()){setTimeout(nudgeShow,8000);return}nudged=true;underHdr($("#nudge"));$("#nudge").classList.add("show");setTimeout(nudgeHide,12000)}
function nudgeHide(){$("#nudge").classList.remove("show")}
A.nudgeClose=()=>nudgeHide();
/* Cookie-Hinweis: kurz, ehrlich, beide Wahlmöglichkeiten gleich gewichtet */
function cookieShow(){const tp=!!CFG.trustpilot,c=$("#cookie");
  c.innerHTML=`<div class="ck-h">${LOGO(26)}<h2>Cookies bei instantcodes</h2></div><p>Wir verwenden ${tp?"":"nur "}technisch notwendige Cookies und Speicher: für Anmeldung, Warenkorb und die sichere Zahlung über Stripe.${tp?" Mit „Alle erlauben“ laden wir zusätzlich Bewertungen von Trustpilot, dabei verarbeitet Trustpilot Daten deines Browsers.":" Kein Tracking, keine Werbung."} <a href="/datenschutz">Mehr erfahren</a></p><div class="ck-b">${tp?`<button class="btn btn-soft" data-a="cookie" data-v="min">Nur notwendige</button><button class="btn btn-soft" data-a="cookie" data-v="all">Alle erlauben</button>`:`<button class="btn btn-primary" data-a="cookie" data-v="min">Verstanden</button>`}</div>`;
  c.classList.add("show")}
A.cookie=v=>{S.cookie=v;save();$("#cookie").classList.remove("show");if(v==="all"&&$("#revSec"))loadReviews("#revSec")};
A.cookieOpen=()=>cookieShow();
document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest(".brandmark,.ft-logo");if(!a||e.metaKey||e.ctrlKey)return;e.preventDefault();e.stopPropagation();try{closeMenu();closePanels();A.cartClose();closeSheet(true)}catch(x){}
  if(location.pathname==="/"&&!location.search)scrollTo({top:0,behavior:reduce?"auto":"smooth"});else go("/")},true);
document.addEventListener("pointerdown",e=>{const t=e.target.closest&&e.target.closest(".bsl-track");if(!t||e.pointerType!=="mouse")return;const x0=e.clientX,s0=t.scrollLeft;let moved=false;
  const mv=ev=>{const dx=ev.clientX-x0;if(Math.abs(dx)>4){moved=true;t.classList.add("drag")}t.scrollLeft=s0-dx};
  const up=()=>{removeEventListener("pointermove",mv);removeEventListener("pointerup",up);t.classList.remove("drag");if(moved){const blk=ev=>{ev.preventDefault();ev.stopPropagation();t.removeEventListener("click",blk,true)};t.addEventListener("click",blk,true);setTimeout(()=>t.removeEventListener("click",blk,true),50)}};
  addEventListener("pointermove",mv);addEventListener("pointerup",up)});
document.addEventListener("dragstart",e=>{if(e.target.closest&&e.target.closest(".bsl-track"))e.preventDefault()});
A.browse=()=>{try{A.cartClose();closeSheet(true)}catch(e){}go("/");let n=0;const t=()=>{const g=$("#popGrid");if(g&&cur.path==="/"){const y=g.closest("section").getBoundingClientRect().top+scrollY-84;window.scrollTo({top:y,behavior:reduce?"auto":"smooth"})}else if(n++<30)setTimeout(t,50)};setTimeout(t,160)};