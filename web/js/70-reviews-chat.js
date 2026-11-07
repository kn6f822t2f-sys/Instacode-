/* ---------- Bewertungen (nur echte) + Trustpilot ----------
   stars(n)            Sterne mit Textalternative; füllen sich beim Einblenden nacheinander (Bruchteile exakt, z. B. 4,6)
   loadReviews(sel)    Bewertungsfläche (Startseite #revSec): Schnitt, Verteilung, Zitate, Prüfhinweis, Trustpilot – erst ab 3 eigenen Bewertungen
   revSection()        dieselbe Fläche als Markup für andere Seiten (lädt sich selbst)
   pdRevMount(el)      füllt <div class="pd-rev" id="pdRev" data-brand="…"> auf der Produktseite: Sterne, Anzahl, 1–2 Zitate –
                       nur echte Bewertungen zu Bestellungen dieses Produkts (alle Länder-Varianten), sonst ein leiser Hinweis
   tpLink()            „Bewerte uns auf Trustpilot“ – reiner Link (ohne Sterne, ohne Widget), solange das Widget nicht eingerichtet ist
   Die Daten kommen aus /api/reviews (Server: nur gelieferte Bestellungen, eine Bewertung pro Bestellung). */
let REV=null;const REVB={};
const revAvg=n=>Number(n||0).toFixed(1).replace(".",",");
const stars=(n,o={})=>`<span class="stars${o.cls?" "+o.cls:""}" role="img" aria-label="${revAvg(n)} von 5 Sternen">${[1,2,3,4,5].map(i=>{const f=Math.max(0,Math.min(1,n-i+1));return `<i style="--k:${i-1}">${ic("i-star")}${f>0?`<b style="width:${Math.round(f*100)}%">${ic("i-star")}</b>`:""}</i>`}).join("")}</span>`;
const revWhen=t=>new Date(t).toLocaleDateString("de-DE",{month:"short",year:"numeric"});
const revCut=(t,n)=>{t=String(t||"").trim();return t.length>n?t.slice(0,n).replace(/\s+\S*$/,"")+" …":t};
const revProds=r=>(r.ids||[]).map(byId).filter(Boolean);
const rcard=(r,i=0,o={})=>{const ps=revProds(r).slice(0,2);
  return `<article class="rcard${o.in?"":" rv"}" style="--d:${(i%3)*70}ms">${stars(r.rating)}${r.text?`<blockquote><p>${esc(r.text)}</p></blockquote>`:`<p class="rc-none">Ohne Text bewertet</p>`}
  <footer class="who"><span class="who-av" aria-hidden="true">${esc(initials(r.name))}</span><span class="who-t"><b>${esc(r.name)}</b><small>${revWhen(r.date)}</small></span><span class="verified">${ic("i-check")}Verifizierter Kauf</span></footer>
  ${ps.length?`<div class="rc-prod">${ps.map(b=>`<a href="/marke/${b.id}">${mini(b)}<span>${esc(shortNm(b))}</span></a>`).join("")}</div>`:r.brands&&r.brands.length?`<div class="rc-prod"><span>${esc(r.brands.slice(0,2).join(", "))}</span></div>`:""}</article>`};
/* Trustpilot: nur Link mit offiziellem Zeichen (Simple Icons, public/logo/trustpilot.svg) */
const tpLink=(o={})=>{const T=CFG.trustpilot;if(!T||!T.write)return "";
  return `<a class="tp-link${o.cls?" "+o.cls:""}" href="${esc(o.read?T.url:T.write)}" target="_blank" rel="noopener"><img src="/logo/trustpilot.svg" alt="" width="18" height="18"><span>${esc(o.text||"Bewerte uns auf Trustpilot")}</span>${ic("i-arrow")}<span class="sr"> (öffnet ein neues Fenster)</span></a>`};
const REV_RULE="Bewerten kann nur, wer bei uns bestellt und seinen Code erhalten hat, einmal pro Bestellung. Wir zeigen alle Bewertungen, auch kritische. Entfernt werden nur Beiträge mit Beleidigungen, persönlichen Daten oder Werbung.";
/* Schnitt, Sterne, Verteilung (Balken wachsen per scaleX) */
const revSummary=(R,o={})=>`<div class="rvs-sum${o.in?"":" rv"}"><p class="rvs-avg"><b>${revAvg(R.avg)}</b><span>von 5</span></p>${stars(R.avg,{cls:"lg"})}<p class="rvs-n">${R.count} ${R.count===1?"verifizierte Bewertung":"verifizierte Bewertungen"}</p>
  ${R.dist?`<ul class="rvs-dist">${[5,4,3,2,1].map((s,i)=>{const n=R.dist[s-1]||0;return `<li style="--k:${i}"><span aria-hidden="true">${s}</span>${ic("i-star")}<i aria-hidden="true"><u style="--p:${(R.count?n/R.count:0).toFixed(3)}"></u></i><small><span class="sr">${s} ${s===1?"Stern":"Sterne"}: </span>${n}</small></li>`}).join("")}</ul>`:""}
  ${o.note===false?"":`<p class="rvs-note">${ic("i-shield")}<span><b>So prüfen wir Bewertungen.</b> ${REV_RULE}</span></p>`}${tpLink()}</div>`;
function revSection(id="revSec"){return `<section class="sec rvs" id="${esc(id)}" data-revs hidden></section>`}
async function loadReviews(sel){
  const el=typeof sel==="string"?$(sel):sel;if(!el)return;el.dataset.on="1";
  try{REV=REV||await API("/reviews")}catch(e){return}
  if(!el.isConnected)return;
  const T=CFG.trustpilot,tpw=!!(T&&T.widget&&S.cookie==="all"),own=REV.count>=3;
  if(!own&&!tpw){el.hidden=true;return}
  el.hidden=false;el.classList.add("rvs");
  const txt=REV.items.filter(r=>r.text),list=(txt.length>=3?txt:REV.items).slice(0,6);
  el.innerHTML=`${secHead("Das sagen Kundinnen und Kunden")}${own?`<div class="rvs-grid">${revSummary(REV)}<div class="rvs-cards">${list.map(rcard).join("")}</div></div>`:""}${tpw?`<div class="tp-box" id="tpBox"></div>`:""}`;
  reveal(el);if(tpw)mountTrustpilot($("#tpBox",el));
}
/* Produktseite: Platzhalter #pdRev (data-brand) wird gefüllt, sobald er im Dokument steht */
async function pdRevMount(el){
  if(!el||el.dataset.on)return;el.dataset.on="1";
  const b=byId(el.dataset.brand),ids=(b?variants(b).map(x=>x.id):[el.dataset.brand]).filter(Boolean).sort(),key=ids.join(",");if(!key)return;
  let R;try{R=REVB[key]=REVB[key]||await API("/reviews?brand="+encodeURIComponent(key))}catch(e){return}
  if(!el.isConnected)return;
  if(!R.count){el.innerHTML=`<p class="pdr-none">Noch keine Bewertungen</p>`;return}
  const q=R.items.filter(r=>r.text).slice(0,2),nm=b?shortNm(b):"";
  el.innerHTML=`<div class="pdr"><button class="pdr-h" data-a="revAll" data-v="${esc(key)}" data-n="${esc(nm)}" aria-haspopup="dialog">${stars(R.avg)}<b>${revAvg(R.avg)}</b><span>${R.count} ${R.count===1?"Bewertung":"Bewertungen"}</span>${ic("i-chev")}</button>
   ${q.length?`<div class="pdr-q">${q.map((r,i)=>`<figure class="pdr-c" style="--d:${i*80}ms"><blockquote><p>${esc(revCut(r.text,150))}</p></blockquote><figcaption>${stars(r.rating,{cls:"sm"})}<b>${esc(r.name)}</b><span>${ic("i-check")}Verifizierter Kauf</span></figcaption></figure>`).join("")}</div>`:""}</div>`;
}
/* Alle Bewertungen eines Produkts im Fenster */
A.revAll=async(v,el)=>{let R=REVB[v];if(!R){try{R=REVB[v]=await API("/reviews?brand="+encodeURIComponent(v))}catch(e){toast(e.message);return}}
  const nm=el&&el.dataset.n;
  openSheet(`<div class="sheet-h"><h3>${nm?`Bewertungen zu ${esc(nm)}`:"Bewertungen"}</h3><button class="x" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button></div>
   <div class="rvx">${revSummary(R,{in:true,note:false})}<div class="rvx-list">${R.items.map((r,i)=>rcard(r,i,{in:true})).join("")}</div>${R.count>R.items.length?`<p class="fine">Die ${R.items.length} neuesten von ${R.count} Bewertungen.</p>`:""}<p class="rvs-note">${ic("i-shield")}<span><b>So prüfen wir Bewertungen.</b> ${REV_RULE}</span></p></div>`,{wide:true})};
const revScan=()=>{const p=$("#pdRev:not([data-on])");if(p)pdRevMount(p);$$("[data-revs]:not([data-on])").forEach(x=>loadReviews(x))};
if("MutationObserver" in window&&$("#app"))new MutationObserver(revScan).observe($("#app"),{childList:true,subtree:true});
function mountTrustpilot(box){
  const t=CFG.trustpilot;if(!box||!t||!t.widget)return;
  box.innerHTML=`<div class="trustpilot-widget" data-locale="de-DE" data-template-id="${esc(t.tpl)}" data-businessunit-id="${esc(t.bu)}" data-style-height="52px" data-style-width="100%" data-theme="light"><a href="${esc(t.url)}" target="_blank" rel="noopener">Bewertungen auf Trustpilot</a></div>`;
  const go2=()=>{try{window.Trustpilot&&window.Trustpilot.loadFromElement(box.firstElementChild,true)}catch(e){}};
  if(window.Trustpilot)return go2();
  if(!$("#tpjs")){const sc=document.createElement("script");sc.id="tpjs";sc.src="https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js";sc.async=true;sc.onload=go2;document.head.appendChild(sc)}
}

function renderAcc(){const a=$("#hacc");a.innerHTML=S.user?`<span class="avatar" title="${esc(S.user.name)}">${esc(initials(S.user.name))}</span>`:`<span class="btn btn-primary btn-sm">Anmelden</span>`;a.setAttribute("href",S.user?"/konto":"/login");
  /* abgemeldet öffnet der Link das Anmelde-Fenster (52-passkey.js) */S.user?a.removeAttribute("aria-haspopup"):a.setAttribute("aria-haspopup","dialog")}
function renderFooter(){
  const cats=CATSV();
  $("#ftr").innerHTML=`<div class="ft">
  <div class="ft-top"><a class="ft-logo" href="/" aria-label="instantcodes Startseite">${LOGO(40)}<span class="wordmark"><b>instant</b>codes</span></a>
   <p>Gutscheine, Spiele-Keys, Abos und Handy-Guthaben von ${BRANDS.length.toLocaleString("de-DE")} Produkten. Bezahlt in Sekunden, Code ${fastAll()?"direkt ":""}per E-Mail.</p>
   ${payLogos()}${typeof nlFooter==="function"?nlFooter()/* Newsletter-Anmeldung (71-newsletter.js) */:""}</div>
  <div class="ft-cols">
   <div><h5>Sortiment</h5><ul>${cats.slice(0,7).map(c=>`<li><a href="/kategorie/${c.id}">${esc(c.name)}</a></li>`).join("")}</ul></div>
   <div><h5>Service</h5><ul><li><a href="/abo">instantcodes Abo</a></li><li><a href="/angebote">Angebote</a></li><li><a href="/hilfe">Hilfe und FAQ</a></li><li><a href="/konto">Mein Konto</a></li><li><button class="lnk" data-a="chatOpen">KI-Beraterin Mia</button></li></ul></div>
   <div><h5>Rechtliches</h5><ul><li><a href="https://mein.online-impressum.de/instacode/" target="_blank" rel="noopener">Impressum</a></li><li><a href="/agb">AGB</a></li><li><a href="/widerruf">Widerrufsbelehrung</a></li><li><a href="/datenschutz">Datenschutz</a></li><li><button class="lnk" data-a="cookieOpen">Cookie-Einstellungen</button></li><li><a href="/kuendigen">Verträge hier kündigen</a></li></ul></div>
   <div><h5>Kontakt</h5><ul><li><a href="mailto:${esc(CFG.support)}">${esc(CFG.support)}</a></li>${ftVoice()}<li><a href="/hilfe">Hilfe und Kontakt</a></li>${CFG.trustpilot&&CFG.trustpilot.write?`<li><a href="${esc(CFG.trustpilot.write)}" target="_blank" rel="noopener">Bewerte uns auf Trustpilot<span class="sr"> (öffnet ein neues Fenster)</span></a></li>`:""}</ul></div>
  </div>
  <div class="ft-giant" aria-hidden="true"><b>instant</b>codes</div>
  <div class="ft-bottom"><span>© ${new Date().getFullYear()} ${esc(CFG.site||"instantcodes")}</span><span class="ft-stripe">Zahlungsabwicklung durch <img src="/pay/stripe.svg" alt="Stripe" loading="lazy" onerror="this.replaceWith(document.createTextNode('Stripe'))"></span></div>
  </div>`;
}
function applyTheme(){document.documentElement.setAttribute("data-theme","light")}
/* Konfetti auf hellem Grund: Graphit, Lavendel, Rosa, Himmel, Mint, Silber */
function confetti(){if(reduce)return;const box=$("#confetti"),cols=["#1A1C21","#7D5CF0","#E7438F","#2F7FD9","#0E9F6E","#B5BAC3"];for(let i=0;i<50;i++){const p=document.createElement("i");p.style.cssText=`left:${Math.random()*100}%;background:${cols[i%6]};--dx:${(Math.random()-.5)*180}px;--r:${Math.random()*720-360}deg;animation-duration:${1.7+Math.random()*1.4}s;animation-delay:${Math.random()*.3}s;width:${6+Math.random()*6}px;height:${8+Math.random()*8}px`;box.appendChild(p)}setTimeout(()=>{box.innerHTML=""},3800)}

/* ---------- chat ---------- */
/* Mia (Chat, Aktionen, Vorschläge) steht in 75-ai.js: chat, chatClose, A.chatOpen, A.chatClose, A.chatToggle, A.chatQ */

/* ---------- pop-ups ---------- */
const anyOverlay=()=>$("#scrim").classList.contains("open")||$("#menu").classList.contains("open")||chat.open||$("#cookie").classList.contains("show")||!!$(".proc");
const quietRoute=()=>/^\/(kasse|login|bestellung)/.test(cur.path||"");
/* Hinweis-Blase unter Mias Knopf: vom Inhaber abgeschaltet (keine ungefragten Pop-ups); NUDGE=true schaltet sie wieder ein */
const NUDGE=false;let nudged=false;
function nudgeShow(){if(!NUDGE||nudged)return;if(anyOverlay()||quietRoute()){setTimeout(nudgeShow,8000);return}nudged=true;underHdr($("#nudge"));$("#nudge").classList.add("show");setTimeout(nudgeHide,12000)}
function nudgeHide(){$("#nudge").classList.remove("show")}
A.nudgeClose=()=>nudgeHide();
/* Cookie-Hinweis: kurz, ehrlich, beide Wahlmöglichkeiten gleich gewichtet */
function cookieShow(){const tp=!!(CFG.trustpilot&&CFG.trustpilot.widget),c=$("#cookie");
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