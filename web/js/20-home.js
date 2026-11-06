/* ---------- home ---------- */
/* Aufbau (Chrome & Glas – hell): Bühne mit Chrom-Ring, Überschrift und Suche, Karten schweben um den Ring ·
   Vertrauens-Laufband · Bestseller · Scroll-Geschichte (Video läuft mit dem Scrollen im iPhone) · Kategorien als Bento ·
   Bezahlen · instantcodes Abo · Handy aufladen · Spiele-Keys · Angebote · Zuletzt angesehen · Marken im Sortiment ·
   Warum instantcodes · Bewertungen · Ratgeber · Fragen · Abschluss */
const shortName=b=>b.name.replace(/ (Gift Card|Geschenkkarte)$/,"").replace("Xbox Game Pass Ultimate","Game Pass");
/* Glaskarte, die schwebt: Lage (--x/--y in %), Breite, Tiefe (--d: Stärke der Parallax), Drehung, Takt */
const fcard=(b,o)=>`<span class="fc" style="--x:${o[0]}%;--y:${o[1]}%;--w:${o[2]}px;--d:${o[3]};--r:${o[4]}deg;--t:${o[5]}s"><i class="fc-b">${gc(b,{tilt:false,badge:false,plat:false})}</i></span>`;
const cloud=(list,slots)=>list.slice(0,slots.length).map((b,i)=>fcard(b,slots[i])).join("");
/* Kurzvideo im iPhone: lädt erst, wenn es sichtbar wird (15-effects.js), Standbild bis dahin */
const hvid=n=>`<video class="vf-vid" poster="/vid/${n}.jpg?v=8" muted loop playsinline preload="none"><source src="/vid/${n}.mp4?v=8" type="video/mp4"><source src="/vid/${n}.webm?v=8" type="video/webm"></video>`;
/* Video, das mit dem Scrollen läuft (16-motion.js, [data-scrub]) */
const svid=n=>`<video class="scrub-vid" poster="/vid/${n}.jpg?v=8" muted playsinline preload="none" data-src="/vid/${n}-scrub.mp4?v=8"></video>`;
const uniqLogos=n=>{const seen=new Set();return VIS().filter(b=>!isKey(b)&&hasMark(b)&&!seen.has(b.logo||b.si)&&seen.add(b.logo||b.si)).slice(0,n)};
/* Kartenwand: echte Gutscheinkarten mit offiziellen Logos in drei Reihen, die gegeneinander laufen (Bilder, Farbe, Bewegung).
   Zweite Hälfte jeder Reihe ist die Kopie für die Endlosschleife (für Screenreader und Tastatur ausgeblendet). */
const cardWall=()=>{const seen=new Set(),list=VIS().filter(b=>!isKey(b)&&b.cat!=="topup"&&(b.logo||b.si)&&!seen.has(b.logo||b.si)&&seen.add(b.logo||b.si));
  if(list.length<12)return"";
  /* Kategorien im Wechsel (Gaming, Shopping, Prepaid, Streaming …), damit jede Reihe bunt gemischt ist */
  const by={};list.forEach(b=>(by[b.cat]=by[b.cat]||[]).push(b));const cs=Object.keys(by),mix=[];
  for(let i=0;mix.length<list.length;i++)cs.forEach(c=>{if(by[c][i])mix.push(by[c][i])});
  const rows=[0,1,2].map(r=>mix.filter((b,i)=>i%3===r).slice(0,16));
  const card=(b,dup,i)=>`<a class="cw-c" href="/marke/${b.id}" style="--i:${i}"${dup?' tabindex="-1" aria-hidden="true"':` aria-label="${esc(b.name)}"`}>${gc(b,{tilt:false,badge:false,plat:false})}<i class="cw-sh" aria-hidden="true"></i></a>`;
  return `<section class="cwall" data-off aria-label="Marken im Sortiment"><div class="sec cw-head"><div class="sec-head"><div><h2 class="h2">Alle Marken. Ein Shop.</h2><p>Gutscheine, Prepaid-Karten und Guthaben – offizielle Codes, meist in Sekunden per E-Mail.</p></div><div class="sh-r"><a class="more" href="/kategorien">Alle Marken${ic("i-chev")}</a></div></div></div>
<div class="cw-stage"><div class="cw-rows">${rows.map((r,i)=>`<div class="cw-row${i%2?" rev":""}" style="--dur:${58+i*12}s"><div class="cw-track">${r.map((b,j)=>card(b,0,j+i*3)).join("")}${r.map((b,j)=>card(b,1,j+i*3)).join("")}</div></div>`).join("")}</div></div></section>`};
function home(){
  const recent=S.recent.map(byId).filter(Boolean).filter(isRep).slice(0,10), c=ctry();
  const keys=VIS().filter(isKey), deals=DEALS(), best=pick(BEST0,14).map(byId).filter(Boolean);
  const off=deals.length?Math.round(Math.max.apply(null,deals.map(b=>b.disc))*100):0, nTop=BRANDS.filter(b=>b.cat==="topup").length;
  const cats=CATS.filter(c=>c.id!=="topup"&&VIS().some(b=>b.cat===c.id));
  const head=(title,sub,right)=>`<div class="sec-head"><div><h2 class="h2">${title}</h2>${sub?`<p>${sub}</p>`:""}</div>${right?`<div class="sh-r">${right}</div>`:""}</div>`;
  const seen=new Set(),pool=FEAT.concat(POP,BEST0).map(byId).concat(IMGB()).filter(b=>b&&b.cat!=="topup"&&!isKey(b)&&!seen.has(b.id)&&seen.add(b.id));
  const aboSvc=["netflix","disney","spotify","dazn","gpu","psplus-essential","nso","crunchyroll","amazon"].map(byId).filter(Boolean);
  const quick=[["steam","Steam"],["psn","PlayStation"],["amazon","Amazon"],["netflix","Netflix"]].filter(([id])=>byId(id));
  const storyCards=["steam","psn","netflix","spotify","amazon","apple"].map(byId).filter(Boolean);
  return {tab:"home",title:"Digitale Codes sofort per E-Mail",html:`<div class="home">
<section class="hero hro" data-mouse>
  <div class="hro-stage" aria-hidden="true">
    <div class="lq" data-off></div>
    <div class="hro-sky" data-par>${cloud(pool.slice(0,7),[[30,16,150,1.5,-12,9],[84,24,132,1.1,12,10.5],[78,84,150,1.6,-8,9.5],[50,52,112,.9,10,11],[62,6,96,.7,-6,12],[92,60,90,.55,8,13],[26,90,84,.5,-12,12.5]])}</div>
  </div>
  <div class="hro-copy">
    <a class="hro-pill rv" href="/abo"><span>Neu</span>instantcodes Abo – 9 Dienste, ein Preis${ic("i-chev")}</a>
    <h1 class="h1 rv" style="--d:80ms">Digitale Codes.<br>In Sekunden bei dir.</h1>
    <p class="lead rv" style="--d:160ms">Gutscheine, Spiele-Keys, Abos und Handy-Guthaben von <b data-count="${VIS().length}">${VIS().length}</b> Marken – sicher bezahlt, dein Code kommt meist direkt per E-Mail.</p>
    <button class="hro-search rv" style="--d:240ms" data-a="palOpen" aria-label="Suche öffnen">${ic("i-search")}<span>Marke oder Gutschein suchen</span><kbd class="kbdk">Strg K</kbd></button>
    <div class="hro-quick rv" style="--d:300ms">${quick.map(([id,t])=>`<a class="chip" href="/marke/${id}">${esc(t)}</a>`).join("")}<a class="chip" href="/aufladen">${ic("i-phone-f")}Handy aufladen</a></div>
    <div class="hro-trust rv" style="--d:360ms">${payLogos()}<p><span>${ic("i-lock")}TLS-verschlüsselt</span><span>${ic("i-shield")}3&#8209;D Secure</span><span class="ft-stripe">Zahlung über <img src="/pay/stripe.svg" alt="Stripe" loading="lazy" onerror="this.replaceWith(document.createTextNode('Stripe'))"></span></p></div>
  </div>
</section>
${trustBand({n:16})}
${cardWall()}
<section class="sec hm-best">${head("Bestseller","Was gerade am häufigsten gekauft wird.",`<a class="more" href="/angebote">Alle${ic("i-chev")}</a>${railNav("bestRail")}`)}${rail("bestRail",best)}</section>
<section class="hm-story" data-scrub aria-label="So kaufst du bei instantcodes">
  <div class="story-pin">
    <div class="story-copy">
      <h2 class="h2">So einfach geht's</h2>
      <ol class="story-steps">
        <li data-s="0"><span class="how-n">1</span><b>Marke und Betrag wählen</b><span>Gutschein, Spiele-Key, Abo oder Handy-Guthaben – über ${VIS().length} Marken.</span></li>
        <li data-s="1"><span class="how-n">2</span><b>Schnell und sicher bezahlen</b><span>${payNames()}. Abgewickelt über Stripe.</span></li>
        <li data-s="2"><span class="how-n">3</span><b>Code erhalten</b><span>Meist Sekunden nach der Zahlung – auf dem Bildschirm und per E-Mail.</span></li>
      </ol>
      <div class="story-bar" aria-hidden="true"><i></i></div>
    </div>
    <div class="story-stage" aria-hidden="true">
      <div class="story-orbit">${storyCards.map((b,i)=>`<span class="sc" style="--i:${i}">${gc(b,{tilt:false,badge:false,plat:false})}</span>`).join("")}</div>
      <div class="story-glow"></div>
      <div class="story-phone">${iphone(svid("ablauf"))}</div>
      <div class="story-tag t1">${ic("i-zap")}<span>Express-Zahlung</span></div>
      <div class="story-tag t2">${ic("i-check")}<span>Code ist da</span></div>
    </div>
  </div>
</section>
<section class="sec hm-cats">${head("Kategorien","Vom Spiele-Key bis zum Streaming-Guthaben.",`<a class="more" href="/kategorien">Alle Kategorien${ic("i-chev")}</a>`)}
  <div class="bento-cats">${cats.slice(0,6).map((k,i)=>{const l=VIS().filter(b=>b.cat===k.id),n=BRANDS.filter(b=>b.cat===k.id).length;return `<a class="bc spot rv" href="/kategorie/${k.id}" style="--c:${CCOL[k.id]};--d:${i*70}ms"><span class="bc-t"><b>${esc(k.name)}</b><small>${n} ${k.id==="keys"?"Spiele":"Produkte"}</small></span><span class="bc-go">${ic("i-arrow")}</span><span class="bc-fan" aria-hidden="true">${l.slice(0,3).map(b=>gc(b,{tilt:false,badge:false,plat:false})).join("")}</span></a>`}).join("")}</div>
</section>
${wgHome()}
<section class="sec hm-pay"><div class="payband rv">
  <div class="payband-copy"><h2 class="h2">Bezahlen, wie du willst</h2><p>${payNames()}. Die Zahlung läuft verschlüsselt über Stripe – deine Kartendaten sehen wir nie.</p></div>
  <div class="payband-logos">${payLogos()}</div>
  <ul class="payband-sec"><li><img src="/pay/stripe.svg" alt="Stripe" loading="lazy"><span>Zahlungsabwicklung</span></li><li>${ic("i-lock")}<span>TLS-verschlüsselt</span></li><li>${ic("i-shield")}<span>3&#8209;D Secure</span></li><li>${ic("i-mail")}<span>Bestätigung per E-Mail</span></li></ul>
</div></section>
<section class="sec hm-abo"><div class="abo-tz rv">
  <div class="abo-tz-copy"><h2 class="h2">instantcodes Abo</h2><p>Netflix, Disney+, Spotify, Game Pass, PlayStation Plus und mehr – als Code-Paket per E-Mail. Ein fester Preis, online kündbar.</p>
    <ul class="abo-tz-plans"><li><b>Pro</b><span>30 €</span><small>pro Monat</small></li><li><b>Premium</b><span>50 €</span><small>für 3 Monate</small></li><li><b>Max</b><span>80 €</span><small>für 6 Monate</small></li></ul>
    <a class="btn btn-primary btn-lg" href="/abo">Abo ansehen</a></div>
  <div class="abo-tz-art" data-off aria-hidden="true"><div class="abo-tz-ring"></div><div class="abo-tz-orb">${aboSvc.map((b,i)=>`<span class="abo-tz-c" style="--a:${(i*360/aboSvc.length).toFixed(1)}deg"><i>${gc(b,{tilt:false,badge:false,plat:false})}</i></span>`).join("")}</div><span class="abo-tz-core">${LOGO(56)}</span></div>
</div></section>
<section class="sec"><div class="tusec spot">
  <div class="tu-copy"><h2 class="h2">Handy aufladen</h2><p>Nummer eingeben, der Anbieter wird erkannt, Betrag wählen. Für ${nTop} Anbieter.</p>
    <div class="tu-form">
      <label class="lbl" for="twCtry">Empfängerland</label>
      <button class="sel" id="twCtry" data-a="country">${flag(c.c,24)}<span>${esc(c.n)}</span>${ic("i-down")}</button>
      <label class="lbl" for="twNum">Handynummer</label>
      <div class="phone"><span>${c.dial}</span><input id="twNum" inputmode="tel" placeholder="151 2345678" autocomplete="tel-national"></div>
      <div class="err" id="twErr" role="alert"></div>
      <button class="btn btn-primary btn-ink" data-a="twGo">Weiter zum Aufladen</button>
    </div></div>
  <div class="tu-visual" aria-hidden="true">
    <div class="tu-waves"><i></i><i></i><i></i></div>
    <div class="tu-stage" data-par>${["vodafone","o2","lyca"].map((id,i)=>`<span class="fs">${gc(pk(id,i+3),{tilt:false,badge:false})}</span>`).join("")}</div>
    <div class="iph-stage tu-iph" data-mouse><div class="iph-float" data-off><div class="iph-tilt">${iphone(hvid("aufladen"))}</div></div></div>
  </div>
</div></section>
${keys.length?`<section class="sec hm-keys">${head("Spiele-Keys",`${keys.length} Spiele für PC, PlayStation, Xbox und Nintendo`,`<a class="more" href="/kategorie/keys">Alle${ic("i-chev")}</a>${railNav("keyRail")}`)}
  <div class="chips" role="group" aria-label="Plattform">${[["all","Alle"],["pc","PC"],["ps","PlayStation"],["xbox","Xbox"],["nin","Nintendo"]].map((p,i)=>`<button class="chip" aria-pressed="${!i}" data-a="keyPlat" data-v="${p[0]}">${p[1]}</button>`).join("")}</div>
  ${rail("keyRail",keyList("all"),{cover:true})}
</section>`:""}
${deals.length?`<section class="sec">${head("Jetzt reduziert",`Bis zu ${off} % Rabatt auf ausgewählte Gutscheine.`,`<a class="more" href="/angebote">Alle${ic("i-chev")}</a>${railNav("dealRail")}`)}${rail("dealRail",deals)}</section>`:""}
${recent.length?`<section class="sec">${head("Zuletzt angesehen","",railNav("recentRail"))}${rail("recentRail",recent)}</section>`:""}
<section class="sec hm-brandwall">${head("Marken im Sortiment","Offizielle Codes bekannter Marken – sofort per E-Mail.",`<a class="more" href="/kategorien">Alle Marken${ic("i-chev")}</a>`)}${brandWall(uniqLogos(24),{n:18})}</section>
<section class="sec hm-why">
  <p class="say" data-words>Offizielle Codes von autorisierten Distributoren, sicher bezahlt über Stripe und meist in Sekunden bei dir. Ohne Umwege, ohne Wartezeit.</p>
  <ul class="why">
    <li class="spot rv"><span class="si-ic">${ic("i-zap")}</span><b>In Sekunden geliefert</b><small>Meist erscheint der Code direkt nach der Zahlung auf dem Bildschirm und kommt per E-Mail.</small></li>
    <li class="spot rv" style="--d:70ms"><span class="si-ic">${ic("i-shield")}</span><b>Offizielle Codes</b><small>Bezogen über autorisierte Distributoren. Auf jeder Produktseite steht, wo der Code gilt.</small></li>
    <li class="spot rv" style="--d:140ms"><span class="si-ic">${ic("i-lock")}</span><b>Sicher bezahlt</b><small>Zahlungsabwicklung über Stripe mit 3&#8209;D Secure. Kartendaten sehen wir nie.</small></li>
    <li class="spot rv" style="--d:210ms"><span class="si-ic">${ic("i-mail")}</span><b>Persönlicher Support</b><small>Fragen zu Bestellung oder Einlösung beantworten wir per E-Mail: <a href="mailto:${esc(CFG.support)}">${esc(CFG.support)}</a></small></li>
  </ul>
</section>
<section class="sec" id="revSec" hidden></section>
${seoBlock()}
<section class="sec hm-faq"><div class="faq-side"><h2 class="h2">Häufige Fragen</h2><p>Alles Wichtige zu Bestellung, Bezahlung und Einlösung.</p><a class="btn btn-soft" href="/hilfe">Alle Fragen</a></div>${faqList(PALL.slice(0,6))}</section>
<section class="sec hm-cta"><div class="cta-box" data-mouse>
  <div class="lq" data-off aria-hidden="true"></div>
  <h2 class="h2 rv">Dein nächster Code ist nur eine Suche entfernt.</h2>
  <p class="rv" style="--d:80ms">${BRANDS.length.toLocaleString("de-DE")} Produkte, sicher bezahlt mit ${payNames()}.</p>
  <div class="cta-btns rv" style="--d:160ms"><a class="btn btn-primary btn-lg" href="/kategorien">Sortiment ansehen</a><button class="btn btn-soft btn-lg" data-a="palOpen">${ic("i-search")}Suchen</button></div>
</div></section>
</div>`,
  after(){
    const n=$("#twNum");n&&n.addEventListener("keydown",e=>{if(e.key==="Enter")A.twGo()});
    loadReviews("#revSec");
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
