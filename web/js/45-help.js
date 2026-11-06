/* ---------- Hilfe ---------- */
/* Eigene Klapp-Aktion: data-a="qa" ist bereits von den Schnellaktionen im Header belegt */
const helpFaq=(l,open)=>`<div class="faq">${l.map((x,i)=>`<div class="qa" data-open="${open===i}"><button data-a="hfaq" id="hfq${i}" aria-expanded="${open===i}" aria-controls="hfa${i}"><span>${esc(x.q)}</span>${ic("i-down")}</button><div class="qa-b" id="hfa${i}" role="region" aria-labelledby="hfq${i}"><div><p>${esc(x.a)}</p></div></div></div>`).join("")}</div>`;
A.hfaq=(_,el)=>{const box=el.parentNode,o=box.dataset.open==="true";box.dataset.open=String(!o);el.setAttribute("aria-expanded",String(!o))};
/* Themen: ordnen die vorhandenen Fragen nach ihrer Überschrift zu (jede Frage gehört zu genau einem Thema) */
const HTOP=[["all","Alle Fragen","i-grid-f",null],["lief","Lieferung und Codes","i-zap",/schnell|wo finde/i],["pay","Bezahlung und Belege","i-wallet",/zahlung|rechnung|beleg/i],
  ["code","Einlösen und Regionen","i-key",/löse|einlös|region|aktivier/i],["gift","Geschenke und Ausland","i-gift",/schenk|ausland/i],["acc","Konto und Rückgabe","i-user",/konto|zurückgeben/i]];
const hTopicList=id=>{const t=HTOP.find(x=>x[0]===id);return !t||!t[3]?PALL:PALL.filter(x=>t[3].test(x.q))};
const nFr=n=>`${n} ${n===1?"Frage":"Fragen"}`;
const hDraw=(l,open)=>{const b=$("#faqBox");if(!b)return;
  b.innerHTML=l.length?helpFaq(l,open):`<div class="hp-none"><p>Keine passende Frage gefunden. Probier ein anderes Wort oder frag Mia.</p><button class="btn btn-primary" data-a="chatOpen">${ic("i-chat")}Mia fragen</button><a class="btn btn-soft" href="mailto:${esc(CFG.support)}">${ic("i-mail")}E-Mail schreiben</a></div>`;
  const n=$("#hpN");if(n)n.textContent=l.length?nFr(l.length):"Keine Treffer";};
const hPress=id=>$$(".hp-t").forEach(t=>t.setAttribute("aria-pressed",String(t.dataset.v===id)));
A.hTopic=v=>{const f=$("#fq");if(f){f.value="";hClearBtn()}hPress(v);hDraw(hTopicList(v),0);
  const s=$(".hp-faq");if(s&&s.getBoundingClientRect().top>innerHeight*.55)s.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"})};
const hClearBtn=()=>{const x=$("#fqX"),f=$("#fq");if(x&&f)x.hidden=!f.value};
A.hClear=()=>{const f=$("#fq");if(!f)return;f.value="";hClearBtn();hPress("all");hDraw(PALL,0);f.focus()};
function help(){
  return {title:"Hilfe",html:`${crumb([["Hilfe"]])}
<section class="hp-hero">
 <div class="hp-bub" data-off aria-hidden="true"><span class="hb hb-q"><i>${ic("i-help")}</i>Wie löse ich meinen Code ein?</span><span class="hb hb-a">Im Store „Code einlösen“ wählen.</span><span class="hb hb-t"><i></i><i></i><i></i></span></div>
 <h1 class="h1 hp-h rv">Wie können wir helfen?</h1>
 <p class="lead hp-lead rv" style="--d:80ms">Antworten auf häufige Fragen, die digitale Assistentin Mia und unser Support per E-Mail.</p>
 <div class="hp-search rv" style="--d:160ms">${ic("i-search")}<input id="fq" type="search" placeholder="Frage suchen, z. B. einlösen" aria-label="Fragen durchsuchen" aria-controls="faqBox" autocomplete="off" enterkeyhint="search"><button type="button" class="hp-x" id="fqX" data-a="hClear" aria-label="Suche leeren" hidden>${ic("i-x")}</button></div>
</section>
<section class="sec hp-tsec" aria-labelledby="hpTh"><h2 class="sr" id="hpTh">Themen</h2><div class="hp-topics" role="group" aria-label="Fragen nach Thema filtern">${HTOP.map((t,i)=>`<button class="hp-t rv" style="--d:${i*50}ms" data-a="hTopic" data-v="${t[0]}" aria-pressed="${!i}" aria-controls="faqBox"><span class="hp-t-ic">${ic(t[2])}</span><b>${esc(t[1])}</b><small>${nFr(hTopicList(t[0]).length)}</small></button>`).join("")}</div></section>
<section class="sec hp-faq"><div class="hp-fh"><h2 class="h2">Häufige Fragen</h2><p class="hp-n" id="hpN">${nFr(PALL.length)}</p></div><div id="faqBox" aria-live="polite">${helpFaq(PALL,0)}</div></section>
<section class="sec hp-more"><div class="hp-contact rv"><div><h2 class="h3">Noch etwas offen?</h2><p>Mia antwortet sofort. Für alles Persönliche schreib uns mit deiner Bestellnummer, dann können wir am schnellsten helfen.</p></div>
 <div class="hq">
  <button class="hq-i" data-a="chatOpen"><span class="si-ic">${ic("i-chat")}</span><span><b>Mia fragen</b><small>Digitale Assistentin, antwortet sofort</small></span>${ic("i-chev")}</button>
  <a class="hq-i" href="mailto:${esc(CFG.support)}"><span class="si-ic">${ic("i-mail")}</span><span><b>E-Mail schreiben</b><small>${esc(CFG.support)}</small></span>${ic("i-chev")}</a>
  <a class="hq-i" href="/konto/bestellungen"><span class="si-ic">${ic("i-receipt")}</span><span><b>Meine Bestellungen</b><small>Codes und Status ansehen</small></span>${ic("i-chev")}</a>
 </div></div>
 <nav class="hp-legal" aria-label="Rechtliches"><a href="/agb">AGB</a><a href="/widerruf">Widerrufsbelehrung</a><a href="/datenschutz">Datenschutz</a><a href="https://mein.online-impressum.de/instacode/" target="_blank" rel="noopener">Impressum${ic("i-arrow")}</a></nav></section>`,
  after(){const f=$("#fq");f.addEventListener("input",()=>{const v=f.value.trim().toLowerCase(),l=PALL.filter(x=>!v||(x.q+" "+x.a).toLowerCase().includes(v));hClearBtn();hPress("all");hDraw(l,v?0:-1)})}};
}
