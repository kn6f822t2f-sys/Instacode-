/* ---------- Hilfe ---------- */
/* Eigene Klapp-Aktion: data-a="qa" ist bereits von den Schnellaktionen im Header belegt */
const helpFaq=(l,open)=>`<div class="faq">${l.map((x,i)=>`<div class="qa" data-open="${open===i}"><button data-a="hfaq" id="hfq${i}" aria-expanded="${open===i}" aria-controls="hfa${i}"><span>${esc(x.q)}</span>${ic("i-down")}</button><div class="qa-b" id="hfa${i}" role="region" aria-labelledby="hfq${i}"><div><p>${esc(x.a)}</p></div></div></div>`).join("")}</div>`;
A.hfaq=(_,el)=>{const box=el.parentNode,o=box.dataset.open==="true";box.dataset.open=String(!o);el.setAttribute("aria-expanded",String(!o))};
function help(){
  return {title:"Hilfe",html:`${crumb([["Hilfe"]])}
${phead({c:"#3B5BDB",icon:"i-help",title:"Wie können wir helfen?",text:"Antworten auf häufige Fragen, die digitale Assistentin Mia und unser Support per E-Mail.",cards:["apple","psn","paysafe"],extra:`<div class="field">${ic("i-search")}<input id="fq" type="search" placeholder="Frage suchen, z. B. einlösen" aria-label="Fragen durchsuchen" aria-controls="faqBox" autocomplete="off"></div>`})}
<section class="sec hp-quick"><div class="hq">
 <button class="hq-i spot" data-a="chatOpen"><span class="si-ic">${ic("i-chat")}</span><span><b>Mia fragen</b><small>Digitale Assistentin, antwortet sofort</small></span>${ic("i-chev")}</button>
 <a class="hq-i spot" href="mailto:${esc(CFG.support)}"><span class="si-ic">${ic("i-mail")}</span><span><b>E-Mail schreiben</b><small>${esc(CFG.support)}</small></span>${ic("i-chev")}</a>
 <a class="hq-i spot" href="/konto/bestellungen"><span class="si-ic">${ic("i-receipt")}</span><span><b>Meine Bestellungen</b><small>Codes und Status ansehen</small></span>${ic("i-chev")}</a>
</div></section>
<section class="sec hp-faq">${secHead("Häufige Fragen")}<div id="faqBox" aria-live="polite">${helpFaq(PALL,0)}</div></section>
<section class="sec hp-more"><div class="card hp-contact"><div><h2 class="h3">Noch etwas offen?</h2><p>Schreib uns mit deiner Bestellnummer, dann können wir am schnellsten helfen.</p></div><a class="btn btn-soft" href="mailto:${esc(CFG.support)}">${ic("i-mail")}${esc(CFG.support)}</a></div>
 <nav class="hp-legal" aria-label="Rechtliches"><a href="/agb">AGB</a><a href="/widerruf">Widerrufsbelehrung</a><a href="/datenschutz">Datenschutz</a><a href="https://mein.online-impressum.de/instacode/" target="_blank" rel="noopener">Impressum</a></nav></section>`,
  after(){const f=$("#fq");f.addEventListener("input",()=>{const v=f.value.trim().toLowerCase(),l=PALL.filter(x=>!v||(x.q+" "+x.a).toLowerCase().includes(v));$("#faqBox").innerHTML=l.length?helpFaq(l,v?0:-1):`<div class="hp-none"><p>Keine passende Frage gefunden.</p><button class="btn btn-soft" data-a="chatOpen">${ic("i-chat")}Mia fragen</button></div>`})}};
}
