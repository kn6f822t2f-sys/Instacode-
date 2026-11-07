/* ---------- home ---------- */
/* Aufbau (Konzept „Silberstreifen“, web/DESIGN.md): Bühne mit Überschrift, Suche und Schnellwahl, rechts (Handy: darunter) der Chrom-Ring
   mit einer Code-Karte (19-codecard.js) · ein ruhiger Vertrauenssatz mit den echten Zahlungszeichen · Kategorien als Index-Liste ·
   Bestseller · Kartenwand („Regal“ echter Karten) · Spiele-Keys · Geschenk-Finder · So einfach geht's · Abo · Handy aufladen ·
   Angebote · Zuletzt angesehen · Warum instantcodes · Bewertungen · Ratgeber · Fragen · Abschluss.
   Bewegung gibt es nur in der Bühne; alles andere steht einfach da. */
const shortName=b=>b.name.replace(/ (Gift Card|Geschenkkarte)$/,"").replace("Xbox Game Pass Ultimate","Game Pass");
/* Kurzvideo im iPhone: lädt erst, wenn es sichtbar wird (15-effects.js), Standbild bis dahin */
const hvid=n=>`<video class="vf-vid" poster="/vid/${n}.jpg?v=9" muted loop playsinline preload="none"><source src="/vid/${n}.mp4?v=9" type="video/mp4"><source src="/vid/${n}.webm?v=9" type="video/webm"></video>`;
/* Kartenwand: echte Gutscheinkarten mit offiziellen Logos in Reihen, die gegeneinander laufen – das „Regal“ des Shops.
   Zweite Hälfte jeder Reihe ist die Kopie für die Endlosschleife (für Screenreader und Tastatur ausgeblendet). */
const cardWall=()=>{const seen=new Set(),list=VIS().filter(b=>!isKey(b)&&b.cat!=="topup"&&(b.logo||b.si)&&!seen.has(b.logo||b.si)&&seen.add(b.logo||b.si));
  if(list.length<12)return"";
  /* Kategorien im Wechsel (Gaming, Shopping, Prepaid, Streaming …), damit jede Reihe bunt gemischt ist */
  const by={};list.forEach(b=>(by[b.cat]=by[b.cat]||[]).push(b));const cs=Object.keys(by),mix=[];
  for(let i=0;mix.length<list.length;i++)cs.forEach(c=>{if(by[c][i])mix.push(by[c][i])});
  /* Touch-Geräte: zwei Reihen mit je 9 Karten (Grafikspeicher), sonst drei mit je 16 */
  const lite=document.documentElement.classList.contains("lite"),nr=lite?2:3,per=lite?9:16;
  const rows=Array.from({length:nr},(_,r)=>mix.filter((b,i)=>i%nr===r).slice(0,per));
  const card=(b,dup)=>`<a class="cw-c" href="/marke/${b.id}"${dup?' tabindex="-1" aria-hidden="true"':` aria-label="${esc(b.name)}"`}>${gc(b,{tilt:false,badge:false,plat:false})}</a>`;
  return `<section class="cwall" data-off aria-labelledby="cwH"><div class="sec cw-head"><div class="sec-head"><h2 class="h2" id="cwH">Alle Marken. Ein Shop.</h2><div class="sh-r"><a class="more" href="/kategorien">Alle anzeigen</a></div></div></div>
<div class="cw-stage"><div class="cw-rows">${rows.map((r,i)=>`<div class="cw-row${i%2?" rev":""}" style="--dur:${84+i*16}s"><div class="cw-track">${r.map(b=>card(b)).join("")}${r.map(b=>card(b,1)).join("")}</div></div>`).join("")}</div></div></section>`};
function home(){
  const recent=S.recent.map(byId).filter(Boolean).filter(isRep).slice(0,10), c=ctry();
  const keys=VIS().filter(isKey), deals=DEALS(), best=pick(BEST0,14).map(byId).filter(Boolean);
  const off=deals.length?Math.round(Math.max.apply(null,deals.map(b=>b.disc))*100):0, nTop=VIS().filter(b=>b.cat==="topup").length;
  /* Marken = alle Produkte außer Spielen (Länder-Varianten zählen einmal) */
  const nBrands=VIS().filter(b=>!isKey(b)).length;
  const head=(title,right,id,sub)=>`<div class="sec-head"><div><h2 class="h2"${id?` id="${id}"`:""}>${title}</h2>${sub?`<p>${sub}</p>`:""}</div>${right?`<div class="sh-r">${right}</div>`:""}</div>`;
  const all=(href,t="Alle anzeigen")=>`<a class="more" href="${href}">${t}</a>`;
  const aboSvc=["netflix","disney","spotify","dazn","gpu","psplus-essential","nso","crunchyroll","amazon"].map(byId).filter(Boolean);
  const quick=[["steam","Steam"],["psn","PlayStation"],["amazon","Amazon"],["netflix","Netflix"]].filter(([id])=>byId(id));
  return {tab:"home",title:"Digitale Codes sofort per E-Mail",html:`<div class="home">
<section class="hro" aria-labelledby="hroH">
  <div class="hro-copy">
    <h1 class="h1" id="hroH">Digitale Codes.<br>In Sekunden <span class="nw">bei dir.</span></h1>
    <p class="lead">Gutscheine, Spiele-Keys, Abos und Handy-Guthaben – von Steam bis Netflix, für dich oder zum Verschenken.</p>
    <button class="hro-search" data-a="palOpen" aria-label="Suche öffnen">${ic("i-search")}<span>Marke oder Gutschein suchen</span><kbd class="kbdk">Strg K</kbd></button>
    <nav class="hro-quick" aria-label="Beliebte Marken">${quick.map(([id,t])=>`<a class="chip" href="/marke/${id}">${esc(t)}</a>`).join("")}<a class="chip" href="/aufladen">Handy aufladen</a></nav>
  </div>
  <div class="hro-art"><div class="hro-ring" aria-hidden="true"><div class="lq" data-off></div></div>${codeCard()}</div>
  <div class="hro-trust"><p class="hro-say">Offizielle Codes von ${nBrands} Marken. Meist in Sekunden per E-Mail, sicher bezahlt über Stripe.</p>${payLogos()}</div>
</section>
<section class="sec hm-cats" aria-labelledby="hmCatsH">${head("Kategorien",all("/kategorien"),"hmCatsH")}
  <div class="kb-grid cx">${CATSV().map((k,i)=>kbCard(k,i)).join("")}</div>
</section>
<section class="sec hm-best" aria-labelledby="hmBestH">${head("Bestseller",railNav("bestRail"),"hmBestH")}${rail("bestRail",best)}</section>
${cardWall()}
${keys.length?`<section class="sec hm-keys" aria-labelledby="hmKeysH">${head("Spiele-Keys",`${all("/kategorie/keys")}${railNav("keyRail")}`,"hmKeysH")}
  <div class="chips" role="group" aria-label="Plattform">${[["all","Alle"],["pc","PC"],["ps","PlayStation"],["xbox","Xbox"],["nin","Nintendo"]].map((p,i)=>`<button class="chip" aria-pressed="${!i}" data-a="keyPlat" data-v="${p[0]}">${p[1]}</button>`).join("")}</div>
  ${rail("keyRail",keyList("all"),{cover:true})}
</section>`:""}
${wgHome()}
<section class="sec hm-how" aria-labelledby="howH">
  <div class="how-copy"><h2 class="h2" id="howH">So einfach geht's</h2>
    <ol class="how">
      <li><span class="how-n" aria-hidden="true">1</span><span class="how-t"><b>Marke und Betrag wählen</b><span>Gutschein, Spiele-Key, Abo oder Handy-Guthaben – über ${VIS().length.toLocaleString("de-DE")} Produkte im Sortiment.</span></span></li>
      <li><span class="how-n" aria-hidden="true">2</span><span class="how-t"><b>Sicher bezahlen</b><span>${payNames()}. Abgewickelt über Stripe.</span></span></li>
      <li><span class="how-n" aria-hidden="true">3</span><span class="how-t"><b>Code erhalten</b><span>Meist Sekunden nach der Zahlung – auf dem Bildschirm und per E-Mail.</span></span></li>
    </ol>
  </div>
  <div class="how-phone" aria-hidden="true">${iphone(hvid("ablauf"))}</div>
</section>
<section class="sec hm-abo" aria-labelledby="aboTzH"><div class="abo-tz">
  <div class="abo-tz-copy"><h2 class="h2" id="aboTzH">instantcodes Abo</h2><p>Netflix, Disney+, Spotify, Game Pass, PlayStation Plus und mehr – als Code-Paket per E-Mail. Ein fester Preis, online kündbar.</p>
    <ul class="abo-tz-plans"><li><b>Pro</b><span>30 €</span><small>pro Monat</small></li><li><b>Premium</b><span>50 €</span><small>für 3 Monate</small></li><li><b>Max</b><span>80 €</span><small>für 6 Monate</small></li></ul>
    <a class="btn btn-primary btn-lg" href="/abo">Abo ansehen</a></div>
  <div class="abo-tz-art" aria-hidden="true">${aboSvc.map(b=>gc(b,{tilt:false,badge:false,plat:false})).join("")}</div>
</div></section>
<section class="sec hm-tu" aria-labelledby="tuH"><div class="tusec">
  <div class="tu-copy"><h2 class="h2" id="tuH">Handy aufladen</h2><p>Nummer eingeben, der Anbieter wird erkannt, Betrag wählen. Für ${nTop} Anbieter, das Guthaben wird direkt gebucht.</p></div>
  <div class="tu-form">
    <label class="lbl" for="twCtry">Empfängerland</label>
    <button class="sel" id="twCtry" data-a="country">${flag(c.c,24)}<span>${esc(c.n)}</span>${ic("i-down")}</button>
    <label class="lbl" for="twNum">Handynummer</label>
    <div class="phone"><span>${c.dial}</span><input id="twNum" inputmode="tel" placeholder="151 2345678" autocomplete="tel-national"></div>
    <div class="err" id="twErr" role="alert"></div>
    <button class="btn btn-primary btn-ink btn-block" data-a="twGo">Weiter zum Aufladen</button>
  </div>
</div></section>
${deals.length?`<section class="sec">${head("Jetzt reduziert",`${all("/angebote")}${railNav("dealRail")}`,"",`Bis zu ${off} % unter Nennwert, solange der Preis hier steht.`)}${rail("dealRail",deals)}</section>`:""}
${recent.length?`<section class="sec">${head("Zuletzt angesehen",railNav("recentRail"))}${rail("recentRail",recent)}</section>`:""}
<section class="sec hm-why" aria-labelledby="whyH">${head("Warum instantcodes","","whyH")}
  <ul class="why">
    <li><b>In Sekunden geliefert</b><small>Meist erscheint der Code direkt nach der Zahlung auf dem Bildschirm und kommt per E-Mail.</small></li>
    <li><b>Offizielle Codes</b><small>Bezogen über autorisierte Distributoren. Auf jeder Produktseite steht, wo der Code gilt.</small></li>
    <li><b>Sicher bezahlt</b><small>Zahlungsabwicklung über Stripe mit 3&#8209;D Secure. Kartendaten sehen wir nie.</small></li>
    <li><b>Persönlicher Support</b><small>Fragen zu Bestellung oder Einlösung beantworten wir per E-Mail: <a href="mailto:${esc(CFG.support)}">${esc(CFG.support)}</a></small></li>
  </ul>
</section>
<section class="sec" id="revSec" hidden></section>
${seoBlock()}
<section class="sec hm-faq"><div class="faq-side"><h2 class="h2">Häufige Fragen</h2><p>Alles Wichtige zu Bestellung, Bezahlung und Einlösung.</p><a class="btn btn-soft" href="/hilfe">Alle Fragen</a></div>${faqList(PALL.slice(0,6))}</section>
<section class="sec hm-cta"><div class="cta-box">
  <h2 class="h2">Dein nächster Code ist nur eine Suche entfernt.</h2>
  <p>${BRANDS.length.toLocaleString("de-DE")} Produkte, sicher bezahlt mit ${payNames()}.</p>
  <div class="cta-btns"><a class="btn btn-primary btn-lg" href="/kategorien">Sortiment ansehen</a><button class="btn btn-soft btn-lg" data-a="palOpen">Suchen</button></div>
</div></section>
</div>`,
  after(){
    const n=$("#twNum");n&&n.addEventListener("keydown",e=>{if(e.key==="Enter")A.twGo()});
    loadReviews("#revSec");ccMount(app);
  }};
}
/* Ratgebertext auf dem Handy aufklappen */
A.seoMore=(v,el)=>{const s=el.closest(".seo");if(!s)return;const o=s.classList.toggle("open");el.setAttribute("aria-expanded",String(o));el.textContent=o?"Weniger anzeigen":"Weiterlesen"};
/* Ratgebertext der Startseite: echte Links zu Marken und Kategorien, nur was es im Shop gibt */
/* echte Pfad-Links (für Google) im Shop ohne Neuladen öffnen */
document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest('a[href^="/"]');if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button||a.target==="_blank"||a.hasAttribute("download"))return;
  const h=a.getAttribute("href");if(/^\/(api|auth|img|anim|mail|cards|admin|abmelden|r\/)|\.[a-z0-9]{2,5}($|\?)/i.test(h)||h.startsWith("//"))return;e.preventDefault();navFrom=a;go(h)});
function seoBlock(){
  const ids=new Set(VIS().map(b=>b.id)),L=(l)=>{const x=l.filter(([id])=>ids.has(id)).map(([id,t])=>`<a href="/marke/${id}">${esc(t)}</a>`);return x.length>1?x.slice(0,-1).join(", ")+" und "+x[x.length-1]:x[0]||""};
  const C=(id,t)=>`<a href="/kategorie/${id}">${esc(t)}</a>`;
  const shop=L([["amazon","Amazon Gutscheine"],["zalando","Zalando"],["ikea","IKEA"],["mediamarkt","MediaMarkt"],["lieferando","Lieferando"],["douglas","Douglas"]]);
  const game=L([["steam","Steam Guthaben"],["psn","PlayStation Store Karten"],["xbox","Xbox Guthaben"],["nintendo","Nintendo eShop Karten"]]);
  const cur=L([["fortnite","V-Bucks"],["roblox","Robux"],["valorant","Valorant Points"],["fcpoints","FC Points"]]);
  const subs=L([["gpu","Xbox Game Pass"],["psplus-essential","PlayStation Plus"],["nso","Nintendo Switch Online"]]);
  const ent=L([["netflix","Netflix"],["spotify","Spotify"],["disney","Disney+"],["dazn","DAZN"],["apple","Apple Gift Card"],["gplay","Google Play"]]);
  const tel=L([["vodafone","Vodafone"],["telekom","Telekom"],["o2","o2"],["lebara","Lebara"],["lyca","Lycamobile"]]);
  return `<section class="sec hm-seo"><div class="seo">
  <h2 class="h2">Gutscheine und Guthaben online kaufen – sofort per E-Mail</h2>
  <p class="seo-lead">instantcodes ist dein Shop für digitale Gutscheine, Geschenkkarten und Guthabenkarten. Du wählst Marke und Betrag, bezahlst sicher und bekommst deinen Code in Sekunden per E-Mail – ohne Versand, ohne Wartezeit, rund um die Uhr.</p>
  <div class="seo-grid" id="seoGrid">
    <div><h3>Geschenkkarten und Shopping-Gutscheine</h3><p>${shop?shop+" als ":""}${C("shopping","digitale Geschenkkarten")} – ideal als Last-Minute-Geschenk zum Geburtstag, zu Weihnachten oder einfach so. Auf Wunsch schicken wir den Gutschein mit persönlicher Nachricht direkt an die beschenkte Person.</p></div>
    <div><h3>Gaming-Guthaben, V-Bucks und Spiele-Keys</h3><p>${game?game+": ":""}${C("gaming","Gaming-Guthaben")} für alle Plattformen. Dazu ${cur?cur+" und weitere ":""}${C("currency","Spielwährungen")}, ${subs?subs+" als ":""}${C("subs","Abo-Codes")} sowie ${C("keys","Spiele-Keys")} für PC und Konsole.</p></div>
    <div><h3>Streaming, Musik und App Stores</h3><p>${ent?ent+" – ":""}${C("entertainment","Streaming-Guthaben")} und ${C("apps","App-Store-Guthaben")} für Filme, Serien, Musik, Apps und Spiele. Einfach im Konto einlösen, ganz ohne Kreditkarte beim Anbieter.</p></div>
    <div><h3>Handy aufladen und Prepaid-Guthaben</h3><p>${C("topup","Handy online aufladen")}${tel?" für "+tel:""}: Nummer eingeben, Betrag wählen, fertig. Das Prepaid-Guthaben wird direkt gebucht – auch für Nummern im Ausland.</p></div>
    <div><h3>Sicher bezahlen</h3><p>Du bezahlst mit ${payNames()}. Die Zahlung läuft verschlüsselt über Stripe mit 3-D Secure, deine Kartendaten sehen wir nie. Bestellbestätigung und Codes bekommst du per E-Mail und findest sie jederzeit in deinem Kundenkonto.</p></div>
    <div><h3>Für welches Land gilt mein Code?</h3><p>Auf jeder Produktseite steht, in welchem Land der Code gilt. Viele Marken gibt es in mehreren Regionen und Währungen – wähle einfach Land und Betrag aus. Für Deutschland und Österreich findest du alle wichtigen Gutscheine an einem Ort.</p></div>
  </div>
  <button class="btn btn-soft btn-sm seo-more" data-a="seoMore" aria-expanded="false" aria-controls="seoGrid">Weiterlesen</button>
</div></section>`}
