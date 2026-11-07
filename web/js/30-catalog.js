/* ---------- Katalog: Kategorien, Kategorie, Angebote, Suche, Produkt, 404 ----------
   Formensprache „Chrome & Glas – hell“ (Bereich 50, Stil in css/50-catalog.css):
   kFan   Fächer schwebender Gutscheinkarten auf weißen Glasplatten mit Lichtschwenk (Köpfe, Leer-Zustände, 404)
   kHead  Seitenkopf mit Chrom-Überschrift, kurzer Beschreibung, Chips, Markenzeichen und eigener Bildwelt
   kWall  Cover-Wand aus offiziellen Spielebildern (Spiele-Keys), wandert beim Scrollen
   kOrbit Kategorie-Zeichen, die um den Fächer schweben (/kategorien)
   kSig   Funkwellen (Aufladen, 404)
   kbar   Filter- und Sortierleiste als klebende weiße Glas-Pille unter der Kopfzeile
   kb     Kategorie-Kachel im Bento-Raster (eigene Klassen, nicht .bc der Startseite)
   kVoid  Leer-Zustand mit Kartenfächer und klarem Weg zurück
   kBadge leises Abzeichen auf Produktkacheln („Offizieller Code“) */
/* Anfangsbuchstabe für das A–Z-Verzeichnis (Umlaute zählen zum Grundbuchstaben, Ziffern unter #) */
const azKey=n=>{const ch=String(n||"").normalize("NFD").replace(/[̀-ͯ]/g,"").charAt(0).toUpperCase();return /[A-Z]/.test(ch)?ch:"#"};
const azId=k=>"az-"+(k==="#"?"0":k.toLowerCase());
/* Reihenfolge für Fächer: das wichtigste Element in die Mitte, die übrigen abwechselnd links und rechts */
const fanOrder=l=>{const r=[];l.forEach((b,i)=>i%2?r.unshift(b):r.push(b));return r};
/* Karten mit Kartenbild zuerst (wirken im Fächer am klarsten) */
const imgFirst=l=>l.filter(b=>b&&b.img).concat(l.filter(b=>b&&!b.img));
/* Fächer: list = Marken (null = leere Glaskarte, "pearl" = Perlmutt-Karte). Jede Karte liegt auf einer Glasplatte und schwebt;
   Zeiger (--mx/--my aus [data-mouse]) und Scrollen (--sy aus [data-par]) verschieben die Ebenen unterschiedlich stark. */
const kFan=(list,o={})=>{const n=list.length,l=fanOrder(list);
  return `<div class="kf${o.cls?" "+o.cls:""}" data-off${o.par===false?"":" data-par"} aria-hidden="true"><span class="kf-halo"></span><span class="kf-ring"></span><span class="kf-floor"></span>${l.map((b,i)=>{const off=i-(n-1)/2,a=Math.abs(off);
    return `<span class="kf-c${a>=2?" kf-e":""}" style="--i:${i};--o:${off};--a:${a};--z:${10-Math.ceil(a)}"><i class="kf-p">${b==="pearl"?'<span class="gc kf-pearl"></span>':b?gc(b,{tilt:false,badge:!!o.badge,plat:false}):'<span class="gc ghost"></span>'}</i></span>`}).join("")}</div>`};
/* Funkwellen: Ringe wachsen aus der Mitte (Farbe über --wc) */
const kSig=(cls="")=>`<span class="ksig${cls?" "+cls:""}" data-off aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
/* Cover-Wand: offizielle Spielebilder in vier Spalten, schräg im Raum; die Spalten wandern beim Scrollen gegeneinander (--sy) */
const kWall=list=>{const l=list.filter(b=>b&&b.cov).slice(0,12),V=[150,-110,190,-90],O=[-30,-150,-70,-200];
  return `<div class="kw" data-par data-off aria-hidden="true"><div class="kw-in">${[0,1,2,3].map(k=>`<div class="kw-col" style="--k:${k};--v:${V[k]};--o0:${O[k]}">${l.filter((_,i)=>i%4===k).map(b=>gc(b,{tilt:false,badge:false,plat:false,cover:true})).join("")}</div>`).join("")}</div></div>`};
/* Offizielle Markenzeichen schweben um den Fächer (/kategorien) */
const kOrbit=cs=>{const seen=new Set(),l=ORBLOGO.map(byId).filter(b=>kMarkOk(b)&&!seen.has(b.si||b.logo)&&seen.add(b.si||b.logo)).slice(0,8);
  return `<div class="ko" aria-hidden="true">${l.map((b,i)=>`<span class="ko-i" style="--c:${brandInk(b)};--k:${i}"><span>${kMark(b,52)}</span></span>`).join("")}</div>`};
/* Je Markenzeichen nur eine Marke (PlayStation Plus, EA … kommen sonst mehrfach) */
const uniqSi=l=>{const s=new Set();return l.filter(b=>b&&b.si&&!s.has(b.si)&&s.add(b.si))};
/* Markenwand: alle Marken mit offiziellem Logo oder Markenzeichen, jede nur einmal */
const uniqMark=l=>{const s=new Set();return l.filter(b=>b&&!isKey(b)&&hasMark(b)&&!s.has(b.logo||b.si)&&s.add(b.logo||b.si))};
/* Seitenkopf: links Chrom-Überschrift, Text, Chips und echte Markenzeichen, rechts (Handy: oben) die Bildwelt der Seite
   (Kartenfächer, o.art ersetzt ihn, o.art2 kommt dazu) */
/* Ruhig (Konzept „Silberstreifen“): Titel, ein Satz, eine Zeile Fakten; die Bildwelt steht still (kein Zeiger-Parallax, kein Einblenden) */
const kHead=o=>`<div class="kh${o.cls?" "+o.cls:""}" style="--c:${o.c||"#7D5CF0"}">
  <div class="kh-art">${o.art||kFan(imgFirst(o.cards).slice(0,5),{badge:o.badge,par:false})}${o.art2||""}</div>
  <div class="kh-copy">
    <h1 class="h1 kh-t">${o.title}</h1>
    <p class="kh-l">${o.text}</p>
    ${o.meta&&o.meta.length?`<ul class="kh-m">${o.meta.map(m=>`<li>${ic(m[0])}<span>${m[1]}</span></li>`).join("")}</ul>`:""}
    ${o.extra?`<div class="kh-x">${o.extra}</div>`:""}
    ${o.logos&&o.logos.length>=3?`<div class="kh-lg"><small>Marken im Sortiment</small>${brandWall(o.logos,{cls:"kh-bw",n:8})}</div>`:""}
  </div>
</div>`;
/* Leises Abzeichen auf Produktkacheln im Katalog (nur wahre Aussagen) */
const kaTxt=b=>b.cat==="topup"?"Direkt aufs Handy":"Offizieller Code";
const kBadge=root=>{if(!root)return;$$(".tile:not([data-ka])",root).forEach(t=>{t.dataset.ka=1;const m=$("a.tile-meta",t),id=m&&(m.getAttribute("href")||"").split("/marke/")[1],b=id&&byId(id);
  if(b)m.insertAdjacentHTML("beforeend",`<span class="ka-ok">${ic(b.cat==="topup"?"i-zap":"i-shield")}${kaTxt(b)}</span>`)})};
/* „Mehr anzeigen“ lädt weitere Kacheln nach: auch diese bekommen das Abzeichen */
{const more=A.moreTiles;A.moreTiles=v=>{more(v);const g=document.getElementById(v);if(g&&g.closest(".kat,.srch"))kBadge(g)}}
/* Leer-Zustand: leere Glaskarten mit einer Perlmutt-Karte in der Mitte, darunter ein klarer Weg weiter */
const kVoid=(title,text,btns)=>`<div class="kvoid rv">${kFan(["pearl",null,null],{cls:"kf-void",par:false})}<h2 class="kvoid-t">${title}</h2><p>${text}</p>${btns&&btns.length?`<div class="kvoid-b">${btns.map((b,i)=>`<a class="btn ${i?"btn-soft":"btn-primary"}" href="${b[0]}">${esc(b[1])}</a>`).join("")}</div>`:""}</div>`;
/* Bento-Raster: Breiten je Kachel. Desktop 12 Spalten in Reihen zu drei (5·4·3 / 3·4·5), Rest in Paaren;
   Handy 2 Spalten: jede dritte Kachel breit, eine einzelne letzte Kachel ebenfalls */
const kbSpans=n=>{const d=[];let r=0;
  while(d.length<n){const left=n-d.length;const row=left===4||left===2?(r%2?[5,7]:[7,5]):left===1?[12]:(r%2?[3,4,5]:[5,4,3]);row.forEach(x=>d.push(x));r++}
  const m=d.map((_,i)=>i%3===0?2:1);if(n>1&&m[n-1]===1&&m[n-2]===2)m[n-1]=2;
  return d.map((x,i)=>[x,m[i]])};
/* Kategorie als Zeile einer Index-Liste (Startseite, /kategorien) bzw. als kleine Fläche in der Wischleiste „Andere Kategorien“:
   links der Stapel echter Markenzeichen (kLogos), dann Name und Anzahl (Spiele, Anbieter oder Marken), rechts ein kleiner Pfeil */
const kbCard=(c,i,sp)=>{const k=c.id==="keys",t=c.id==="topup",n=k?catCount(c.id):VIS().filter(b=>b.cat===c.id).length;
  const unit=k?(n===1?"Spiel":"Spiele"):t?"Anbieter":(n===1?"Marke":"Marken");
  return `<a class="kb" href="/kategorie/${c.id}">${kLogosL(c.id,3,"kb-lg")||'<span class="klg kb-lg" aria-hidden="true"></span>'}<span class="kb-t"><b>${esc(c.name)}</b><small>${n} ${unit}</small></span><span class="kb-go" aria-hidden="true">${ic("i-chev")}</span></a>`};

function cats(){
  const az=VIS().slice().sort((a,b)=>a.name.localeCompare(b.name,"de")), cs=CATSV(), groups=[], sp=kbSpans(cs.length);
  az.forEach(b=>{const k=azKey(b.name);let g=groups.find(x=>x.k===k);if(!g)groups.push(g={k,l:[]});g.l.push(b)});
  const sub=b=>esc(catById(b.cat).name)+(isKey(b)?" · "+variants(b).map(v=>PLAT[v.plat]).join(", "):"");
  const cards=["netflix","steam","psn","fortnite","amazon","spotify","apple"].map(byId).filter(Boolean);
  /* Markenwand: bekannte Marken zuerst, Mobilfunk am Ende */
  const bw=uniqMark(SKY0.map(byId).concat(VIS().filter(b=>b.cat!=="topup"),VIS()));
  return {tab:"cats",title:"Kategorien",html:`${crumb([["Kategorien"]])}
${kHead({cls:"kh-cats",c:"#7D5CF0",title:"Kategorien",text:"Vom Spiele-Key bis zum Handy-Guthaben. Codes kommen nach der Zahlung per E&#8209;Mail, Handy-Guthaben geht direkt auf die Nummer.",
  meta:[["i-grid-f",`${cs.length} Kategorien`],["i-box",`${BRANDS.length} Produkte`],["i-mail","Code per E&#8209;Mail"]],cards:cards.length>=3?cards:IMGB().slice(0,5),art2:kOrbit(cs)})}
${trustBand()}
<section class="sec kb-sec" aria-label="Alle Kategorien"><div class="kb-grid">${cs.map((c,i)=>kbCard(c,i,sp[i])).join("")}</div></section>
${bw.length>=6?`<section class="sec kbw-sec" aria-labelledby="bwH"><div class="sec-head"><div><h2 class="h2" id="bwH">Marken im Sortiment</h2><p>Echte Markenzeichen, ein Tipp führt direkt zum Produkt.</p></div></div>${brandWall(bw,{n:42})}</section>`:""}
<section class="sec az-sec" aria-labelledby="azH"><div class="sec-head"><div><h2 class="h2" id="azH">Alle Produkte von A bis Z</h2><p>${VIS().length} Marken und Spiele, alphabetisch sortiert.</p></div></div>
  <nav class="az-nav" aria-label="Nach Anfangsbuchstabe springen"><div class="az-nav-in">${groups.map(g=>`<a href="#${azId(g.k)}" aria-label="Buchstabe ${g.k==="#"?"Ziffern":g.k}">${g.k}</a>`).join("")}</div></nav>
  <div class="az">${groups.map(g=>`<div class="az-g spot" id="${azId(g.k)}"><h3 class="az-k">${g.k}</h3><ul>${g.l.map(b=>`<li><a href="/marke/${b.id}">${mini(b)}<span class="az-t"><b>${esc(b.name)}</b><small>${sub(b)}</small></span>${ic("i-chev")}</a></li>`).join("")}</ul></div>`).join("")}</div>
</section>`};
}
function category(id,qs){
  const c=catById(id);if(!c||c.id!==id)return notFound();
  const sort=qs.get("s")||"pop", pf=qs.get("p")||"all", K=id==="keys", TU=id==="topup", all=BRANDS.filter(b=>b.cat===id).length, uniq=VIS().filter(b=>b.cat===id).length;
  let l=K&&pf!=="all"?dedupeGrp(BRANDS.filter(b=>isKey(b)&&PLATG[b.plat]===pf)):VIS().filter(b=>b.cat===id);
  const fan=VIS().filter(b=>b.cat===id);
  if(sort==="az")l.sort((a,b)=>a.name.localeCompare(b.name,"de"));
  if(sort==="price")l.sort((a,b)=>price(a,a.from)-price(b,b.from));
  const q=o=>`/kategorie/${id}?s=${o.s||sort}${(o.p||pf)!=="all"?"&p="+(o.p||pf):""}`;
  const n=K?`${l.length} ${l.length===1?"Spiel":"Spiele"}`:TU?`${l.length} Anbieter`:`${l.length} ${l.length===1?"Marke":"Marken"}${all>l.length?` · ${all} Produkte`:""}`;
  const meta=K?[["i-key",`${uniq} Spiele`],["i-monitor","PC und Konsole"],["i-mail","Key per E&#8209;Mail"]]
    :TU?[["i-phone-f",`${uniq} Anbieter`],["i-zap","Direkt auf die Nummer"]]
    :[["i-grid-f",`${all} ${all===1?"Produkt":"Produkte"}`],["i-mail","Code per E&#8209;Mail"]];
  const text=K?`${esc(c.desc)}. Nach der Zahlung kommt dein Key per E&#8209;Mail, eingelöst wird er auf der jeweiligen Plattform.`
    :TU?"Prepaid-Guthaben für deine Nummer: Nummer eingeben, Betrag wählen, das Guthaben wird direkt nach der Zahlung gebucht."
    :`${esc(c.desc)}. Nach der Zahlung kommt dein Code per E&#8209;Mail.`;
  const others=CATSV().filter(x=>x.id!==id);
  /* Eigene Bildwelt: Spiele-Keys als Cover-Wand, Aufladen mit Funkwellen, sonst Kartenfächer im Farbhauch der Kategorie mit echten Markenzeichen */
  return {tab:"cats",title:c.name,html:`${crumb([["Kategorien","/kategorien"],[c.name]])}
${kHead({cls:K?"kh-keys":TU?"kh-tu":"kh-cat kh-"+id,c:CCOL[id],title:esc(c.name),text,meta,cards:fan,art:K&&fan.some(b=>b.cov)?kWall(fan):"",art2:TU?kSig():"",logos:K?null:uniqSi(fan),extra:TU?`<a class="btn btn-primary btn-lg" href="/aufladen">Nummer eingeben</a>`:""})}
${trustBand()}
<section class="sec kat" aria-label="${esc(c.name)}">
  <div class="kbar${K?" has-f":""}">
    <p class="kbar-n">${n}</p>
    ${K?`<div class="kbar-f" role="group" aria-label="Plattform">${[["all","Alle"],["pc","PC"],["ps","PlayStation"],["xbox","Xbox"],["nin","Nintendo"]].map(p=>`<a class="chip" href="${q({p:p[0]})}" ${p[0]===pf?'aria-current="page"':""}>${p[1]}</a>`).join("")}</div>`:""}
    <label class="kbar-s"><span>Sortieren</span><select class="sel" data-sort="${id}"><option value="pop"${sort==="pop"?" selected":""}>Beliebt</option><option value="az"${sort==="az"?" selected":""}>A bis Z</option><option value="price"${sort==="price"?" selected":""}>Günstigster Preis</option></select></label>
  </div>
  ${K?`<p class="kat-n">${n}</p>`:""}
  ${l.length?tilesPaged(l,{cover:K}):kVoid("Nichts gefunden","Für diese Auswahl gibt es gerade keine Produkte. Probier eine andere Plattform oder schau dir alle an.",[[`/kategorie/${id}`,"Alle anzeigen"],["/kategorien","Andere Kategorien"]])}
</section>
${others.length?`<section class="sec kat-more">${secHead("Andere Kategorien",["/kategorien","Alle"],railNav("catRail"))}<div class="rail"><div class="rail-track kb-rail" id="catRail">${others.map((x,i)=>kbCard(x,i)).join("")}</div></div></section>`:""}`,
  after(){const s=$("[data-sort]");s&&s.addEventListener("change",()=>go(`/kategorie/${id}?s=${s.value}${pf!=="all"?"&p="+pf:""}`));kBadge($(".kat"))}};
}
function deals(){
  const l=DEALS(), pop=POP.map(byId).filter(Boolean), off=l.length?Math.round(Math.max.apply(null,l.map(b=>b.disc))*100):0;
  return {tab:"home",title:"Angebote",html:`${crumb([["Angebote"]])}
${kHead({cls:"kh-deals",c:"#D9364C",badge:true,title:"Angebote",text:l.length?`${l.length} ${l.length===1?"Gutschein ist":"Gutscheine sind"} gerade günstiger als der Nennwert. Der Preis gilt, solange er hier steht.`:"Hier stehen Gutscheine, die gerade günstiger sind als ihr Nennwert.",
  meta:l.length?[["i-tag",`Bis zu ${off} % unter Nennwert`],["i-mail","Code per E&#8209;Mail"]]:[["i-mail","Code per E&#8209;Mail"]],cards:l.length?l:pop})}
${trustBand()}
<section class="sec kat">${l.length?tilesPaged(l):kVoid("Gerade keine Angebote","Sobald ein Gutschein günstiger ist als sein Nennwert, steht er hier. Bis dahin findest du alles in den Kategorien.",[["/kategorien","Kategorien ansehen"],["/","Zur Startseite"]])}</section>
${!l.length&&pop.length?`<section class="sec kat">${secHead("Beliebt",["/kategorien","Alle"],railNav("popRail"))}${rail("popRail",pop)}</section>`:""}`,
  after(){kBadge($(".view"))}};
}

/* ---------- Produktseite ---------- */
const DESIGNS=[["Blau","linear-gradient(135deg,#2F6BFF,#22C3FF)"],["Sunset","linear-gradient(135deg,#F43F5E,#FB923C)"],["Mint","linear-gradient(135deg,#0E9F6E,#1BA9D8)"],["Nacht","linear-gradient(135deg,#0B1020,#4338CA)"]];
const REDEEM={
  steam:["Öffne Steam und melde dich an.","Klicke unten links auf „Spiel hinzufügen“ und dann „Ein Produkt bei Steam aktivieren“.","Gib den Key ein und bestätige. Das Spiel erscheint in deiner Bibliothek."],
  ps5:["Öffne auf der PS5 den PlayStation Store.","Wähle oben das Menü mit den drei Punkten und dann „Code einlösen“.","Gib den Code ein und bestätige."],
  xbox:["Öffne den Microsoft Store oder redeem.microsoft.com.","Melde dich mit deinem Microsoft-Konto an.","Gib den 25-stelligen Code ein und bestätige."],
  xpc:["Öffne redeem.microsoft.com oder den Microsoft Store.","Melde dich mit deinem Microsoft-Konto an.","Gib den Code ein. Das Spiel steht auf Xbox und Windows-PC bereit."],
  switch:["Öffne den Nintendo eShop auf der Switch.","Wähle links „Code einlösen“.","Gib den Code ein und lade das Spiel herunter."],
  switch2:["Öffne den Nintendo eShop auf der Switch 2.","Wähle „Code einlösen“.","Gib den Code ein und lade das Spiel herunter."],
  ea:["Öffne die EA app und melde dich an.","Klicke auf dein Profil und dann „Produktcode einlösen“.","Gib den Code ein und starte den Download."],
  bnet:["Öffne Battle.net und melde dich an.","Klicke auf deinen Account und dann „Code einlösen“.","Gib den Code ein und bestätige."],
  ubi:["Öffne Ubisoft Connect und melde dich an.","Wähle im Menü „Key aktivieren“.","Gib den Key ein und bestätige."],
  rockstar:["Öffne den Rockstar Games Launcher und melde dich an.","Gehe zu „Einstellungen“ und dann „Code einlösen“.","Gib den Code ein und starte den Download."],
  pc:["Öffne minecraft.net/redeem.","Melde dich mit deinem Microsoft-Konto an.","Gib den Code ein und lade das Spiel herunter."]
};
const redeemSteps=b=>b.redeem?b.redeem.split(/(?<=[.!])\s+|\n+/).map(x=>x.trim()).filter(Boolean).slice(0,6):isKey(b)&&REDEEM[b.plat]?REDEEM[b.plat]:[`Öffne den Dienst oder die App von ${b.name}.`,b.type==="sub"?"Wähle in deinem Konto „Code einlösen“ oder „Abo verlängern“.":"Wähle „Code einlösen“ oder „Guthaben aufladen“.","Gib den Code ein und bestätige."];
const STORE_IN={steam:"in Steam",pc:"beim Hersteller",ea:"in der EA app",bnet:"in Battle.net",ubi:"in Ubisoft Connect",rockstar:"im Rockstar Games Launcher",ps5:"im PlayStation Store",xbox:"im Microsoft Store",xpc:"im Microsoft Store",switch:"im Nintendo eShop",switch2:"im Nintendo eShop"};
const STORE={steam:"Steam",pc:"Hersteller-Launcher",ea:"EA app",bnet:"Battle.net",ubi:"Ubisoft Connect",rockstar:"Rockstar Games Launcher",ps5:"PlayStation Store",xbox:"Microsoft Store",xpc:"Microsoft Store",switch:"Nintendo eShop",switch2:"Nintendo eShop"};
const descOf=b=>isKey(b)?`${b.name} als digitaler ${PLAT[b.plat]}-Key. Nach der Zahlung bekommst du den Key automatisch per E-Mail und löst ihn ${STORE_IN[b.plat]||"beim Hersteller"} ein. Der Key bleibt in deinem Konto gespeichert.`
  :b.type==="sub"?`${b.name} als digitaler Code. Nach der Zahlung kommt der Code per E-Mail, du löst ihn in deinem Konto ein und die Laufzeit startet. Kein Abo, keine automatische Verlängerung über instantcodes.`
  :`Digitaler ${b.name}-Code zum sofortigen Einlösen. Nach der Zahlung bekommst du den Code automatisch per E-Mail. In deinem Konto bleibt er gespeichert.${regTag(b)?` Wichtig: Dieser Code gilt nur für ${regDE(b.region)} und funktioniert nur mit einem Konto aus diesem Land. Der Wert ist in der Landeswährung angegeben, der Preis in Euro.`:""}`;
const varName=(b,v)=>isKey(b)?PLAT[v.plat]:v.name.replace(/^PlayStation Plus /,"").replace(/^Microsoft 365 /,"");
/* Offizielle Einlöse-Seite der Marke (b.ru = {url,label} aus redeemlinks.json). Der Link geht über /go/<id> (Server-Allowlist) und öffnet einen neuen Tab. */
const ruDom=u=>{try{return new URL(u).hostname.replace(/^www\./,"")}catch(e){return ""}};
const ruBtn=(b,o={})=>b&&b.ru&&b.id?`<a class="btn ${o.cls||"btn-primary"}" href="/go/${esc(b.id)}" target="_blank" rel="noopener"${o.attrs||""}><span>${o.text||"Auf "+esc(ruDom(b.ru.url))+" einlösen"}</span>${ic("i-arrow")}<span class="sr"> ${o.sr||""}(öffnet ein neues Fenster)</span></a>`:"";
/* Strukturierte Daten der Produktseite (Product + BreadcrumbList) nur mit echten Werten: Preise der lieferbaren Beträge, Verfügbarkeit aus dem Bestand,
   Sterne nur bei echten Bewertungen (R aus /api/reviews). Das Skript liegt in der Ansicht und verschwindet beim Seitenwechsel mit ihr. */
const pdOrigin=()=>{try{return String(CFG.base||location.origin).replace(/\/+$/,"")}catch(e){return location.origin}};
const pdLd=(b,c,R)=>{const O=pdOrigin(),abs=u=>/^https?:/.test(u)?u:O+u,avail=b.amts.filter(a=>!soldOut(b.id,a)),pl=(avail.length?avail:b.amts).map(a=>price(b,a)),url=O+"/marke/"+b.id;
  const p={"@type":"Product",name:b.name,image:abs(b.img||(b.cov?`/img/cover/${b.id}/p`:"/og.png")),description:descOf(b),sku:b.id,category:c.name,brand:{"@type":"Brand",name:b.name},
    offers:{"@type":"AggregateOffer",priceCurrency:"EUR",lowPrice:Math.min(...pl),highPrice:Math.max(...pl),offerCount:avail.length||b.amts.length,availability:"https://schema.org/"+(avail.length?"InStock":"OutOfStock"),url,seller:{"@type":"Organization",name:"instantcodes"}}};
  if(R&&R.count>0&&R.avg)p.aggregateRating={"@type":"AggregateRating",ratingValue:R.avg,reviewCount:R.count,bestRating:5,worstRating:1};
  const bc={"@type":"BreadcrumbList",itemListElement:[["Start","/"],[c.name,"/kategorie/"+c.id],[b.name,"/marke/"+b.id]].map(([n,u],i)=>({"@type":"ListItem",position:i+1,name:n,item:O+u}))};
  return JSON.stringify({"@context":"https://schema.org","@graph":[p,bc]}).replace(/</g,"\\u003c")};
/* Express-Checkout-Box (auch im Warenkorb und im Schnellkauf verwendet) */
/* Express-Box der Produktseite: dasselbe Gerüst wie Schnellkauf, Warenkorb und Kasse (xpBox in 65-cart-pay.js):
   Zustimmung · Express-Knöpfe · „oder mit Karte bezahlen“, darunter „Jetzt kaufen“ und „In den Warenkorb“ */
const xpayBox=(id,o={})=>xpBox(id,o);
/* Klebende Spalten (Desktop): die kürzere fährt mit, eine Spalte höher als das Fenster klebt mit ihrer Unterkante */
const stickRO="ResizeObserver" in window?new ResizeObserver(es=>es.forEach(e=>e.target.style.setProperty("--h",Math.ceil(e.target.offsetHeight)+"px"))):null;
let stuck=[];
const stick=(...els)=>{if(!stickRO)return;stuck.forEach(x=>stickRO.unobserve(x));stuck=els.filter(Boolean);stuck.forEach(x=>stickRO.observe(x))};
let pdIO=null;
/* Farbwelt der Produktbühne: die kräftigste Farbe aus Kartenverlauf und Schrift (graue Marken bekommen Lavendel) */
const vivid=b=>{let best="#7D5CF0",bs=.15;((String(b.bg||"")+" "+String(b.fg||"")).match(/#[0-9a-fA-F]{6}/g)||[]).forEach(h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255),s=Math.max(...c)-Math.min(...c);if(s>bs){bs=s;best=h}});return best};
/* Produktseite: links die Bühne (Karte auf einer Glasplatte über einem Chrom-Sockel, Studiolicht, Perlmutt-Reflexe),
   rechts die Kaufsäule aus Glas (Desktop klebend), darunter ruhige Info-Kacheln und Reiter */
function brandPage(id){
  const b=byId(id);if(!b)return notFound();
  if(b.cat==="topup")return topup(null,new URLSearchParams("op="+id));
  S.recent=[id].concat(S.recent.filter(x=>x!==id)).slice(0,12);save();
  const c=catById(b.cat), fav=S.favs.includes(id), K=isKey(b), vars=variants(b), card=b.type==="card";
  const def=b.amts[Math.min(1,b.amts.length-1)], avail=b.amts.filter(a=>!soldOut(id,a));
  const P={a:avail.includes(def)?def:(avail[0]||0),q:1,gift:false,design:0};
  const total=()=>P.a?price(b,P.a)*P.q:0;
  const saving=()=>card&&P.a?Math.max(0,Math.round((P.a-price(b,P.a))*P.q*100)/100):0;
  const tagRaw=()=>P.a?(card?money(P.a):optLabel(b,P.a)):"ausverkauft", tagTxt=()=>esc(tagRaw());
  const similar=VIS().filter(x=>x.cat===b.cat&&x.id!==id&&(!b.grp||x.grp!==b.grp)).slice(0,10);
  const dis=avail.length?"":" disabled", region=REGION[b.region]||esc(regDE(b.region)||b.regionName||"Deutschland");
  const amtSub=a=>soldOut(id,a)?"<small>ausverkauft</small>":!card||Math.abs(price(b,a)-a)>.004?`<small>${money(price(b,a))}</small>`:"";
  const short=b.name.replace(/ (Gift Card|Geschenkkarte)$/,""), barSub=()=>short+(card||!P.a?"":" · "+tagRaw())+(P.q>1?` · ${P.q} Stück`:"")+(P.gift?" · als Geschenk":"");
  const tiles=[["i-pin","Gültig in",region],["i-mail","Lieferung","Meist sofort per E&#8209;Mail"]].concat(K?[["i-monitor","Aktivierung",esc(STORE[b.plat]||PLAT[b.plat])],["i-key","Typ","Digitaler Key"]]:[["i-card-f","Format",b.type==="sub"?"Code mit fester Laufzeit":"Digitaler Code"]]);
  return {tab:"cats",title:b.name+(K?` (${PLAT[b.plat]})`:""),buybar:true,html:`${crumb([[c.name,"/kategorie/"+c.id],[b.name]])}
<div class="pd${K?" pd-key":""}" style="--gd:${DESIGNS[0][1]};--pg:${vivid(b)}">
  <div class="pd-media">
    <div class="pd-stage${K&&b.covh?" has-hero":""}${K&&b.covg?" has-logo":""}" id="pdStage" data-mouse data-off>
      <span class="pd-sky" aria-hidden="true"></span>${K&&b.covh?`<span class="pd-hero" aria-hidden="true"><img src="/img/cover/${esc(b.id)}/h" alt="" decoding="async" onerror="this.parentNode.remove();document.getElementById('pdStage').classList.remove('has-hero')"></span>`:""}
      <span class="pd-amb" aria-hidden="true">${K&&b.cov?`<img src="/img/cover/${esc(b.id)}/l" alt="" loading="lazy" decoding="async" onerror="this.remove()">`:""}</span>
      <span class="pd-beam" aria-hidden="true"></span><span class="pd-floor" aria-hidden="true"></span><span class="pd-shine" aria-hidden="true"></span>
      ${K&&b.covg?`<img class="pd-glogo" src="/img/cover/${esc(b.id)}/g" alt="" decoding="async" onerror="this.remove();document.getElementById('pdStage').classList.remove('has-logo')">`:""}
      <div class="pd-obj">
        ${K?"":`<span class="ge-back" aria-hidden="true"></span>`}
        <span class="pd-shade" aria-hidden="true"></span>
        <span class="pd-refl" aria-hidden="true"><span class="pd-float"><span class="pd-glass">${gc(b,{tilt:false,badge:false,plat:false,cover:K})}</span></span></span>
        <div class="pd-card"><div class="pd-float"><div class="pd-glass">${gc(b,{cls:"flash",cover:K,amt:K?null:tagTxt(),amtId:"pAmtTag"})}</div></div></div>
        ${K?"":`<div class="ge-front" id="gEnv" aria-hidden="true"><b id="gHead">Ein Geschenk für dich</b><span id="gSub">${S.user?"Von "+esc(S.user.name):"Mit persönlicher Nachricht"}</span></div>`}
      </div>
      <span class="pd-sweep" aria-hidden="true"></span>
    </div>
  </div>
  <div class="pd-side">
    <a class="pd-tag" href="/kategorie/${c.id}" style="--c:${CCOL[c.id]}">${ic(c.icon)}${esc(c.name)}</a>
    <h1 class="h1">${esc(b.name)}</h1>
    <p class="pd-sub">${K?esc(PLAT[b.plat])+" · Digitaler Key":"Digitaler Code"} · Gültig in ${region}</p>
    <div class="pd-rev" id="pdRev" data-brand="${esc(b.id)}"></div>
    <div class="pact lg-group" role="group" aria-label="Aktionen">
      <button data-a="share" data-v="${id}">${ic("i-share")}<span>Teilen</span></button>
      <button data-a="fav" data-v="${id}" aria-pressed="${fav}" class="pact-fav">${ic(fav?"i-heart-f":"i-heart")}<span>${fav?"Gemerkt":"Merken"}</span></button>
      <button data-a="copyLink" data-v="${id}">${ic("i-copy")}<span>Link kopieren</span></button>
      ${K?"":`<button data-a="giftNow">${ic("i-gift")}<span>Verschenken</span></button>`}
    </div>
    ${vars.length>1?(vars.some(v=>v.rl)?`<span class="lbl">Land und Währung <small class="muted">· ${vars.length} Varianten</small></span><div class="variants regions">${vars.map(v=>`<a class="chip" href="/marke/${v.id}" ${v.id===id?'aria-current="page"':""}>${flagE(v.region||"DE")}${esc(regDE(v.region||"DE"))}<small>${esc(v.cur||"EUR")}</small></a>`).join("")}</div>`:`<span class="lbl">${K?"Plattform":"Variante"}</span><div class="variants">${vars.map(v=>`<a class="chip" href="/marke/${v.id}" ${v.id===id?'aria-current="page"':""}>${esc(varName(b,v))}</a>`).join("")}</div>`):""}
    ${b.amts.length>1||!K?`<span class="lbl" id="pAmtL">${card?"Betrag":"Option"}</span><div class="${card?"amounts":"opts"}${card&&b.labels?" lbls":""}" id="pAmts" role="group" aria-labelledby="pAmtL" data-off>${b.amts.map(a=>`<button class="amt" data-a="pAmt" data-v="${a}" aria-pressed="${a===P.a}"${soldOut(id,a)?" disabled":""}>${card&&!b.labels?money(a):esc(optLabel(b,a))}${amtSub(a)}</button>`).join("")}</div>`:""}${avail.length?"":`<p class="err pd-sold">Derzeit ausverkauft. Schau bald wieder vorbei.</p>`}
    <div class="pd-qty"><span class="lbl" id="pQL">Menge</span><div class="qty" role="group" aria-labelledby="pQL"><button data-a="pQty" data-v="-1" aria-label="Weniger">−</button><span id="pQ" aria-live="polite">1</span><button data-a="pQty" data-v="1" aria-label="Mehr">+</button></div></div>
    ${K?"":`<div class="giftbox spot">
      <div class="gb-h"><span class="gb-ic" aria-hidden="true">${ic("i-gift")}</span><div class="gb-t"><b id="gbL">Als Geschenk senden</b><small>Per E-Mail mit persönlicher Karte</small></div><button class="switch" role="switch" aria-checked="false" data-a="pGift" aria-labelledby="gbL"></button></div>
      <div class="gb-f" id="giftF" hidden>
        <label class="lbl" for="gTo">E-Mail der beschenkten Person</label><input class="inp" id="gTo" type="email" autocomplete="off" placeholder="name@beispiel.de">
        <label class="lbl" for="gName">Von</label><input class="inp" id="gName" autocomplete="name" placeholder="Dein Name" value="${esc(S.user?S.user.name:"")}">
        <label class="lbl" for="gMsg">Nachricht</label><textarea class="inp" id="gMsg" maxlength="200" placeholder="Alles Gute zum Geburtstag!"></textarea>
        <span class="lbl" id="gdL">Kartendesign</span><div class="designs" role="group" aria-labelledby="gdL">${DESIGNS.map((d,i)=>`<button data-a="pDesign" data-v="${i}" aria-pressed="${i===0}" aria-label="Design ${d[0]}"><i style="background:${d[1]}"></i><span>${d[0]}</span></button>`).join("")}</div>
        <div class="err" id="gErr" role="alert"></div>
      </div>
    </div>`}
    <div class="pd-pay">
      <div class="pd-sum"><div class="pd-tot"><span>Gesamt</span><b id="pTot">${money(total())}</b></div><p class="pd-save" id="pSave"${saving()?"":" hidden"}>Du sparst ${money(saving())} gegenüber dem Nennwert</p><p class="pd-fee">${taxHint()}</p></div>
      ${xpayBox("pX")}
      <div class="pd-buy" data-off><button class="btn btn-primary btn-ink btn-lg" data-a="pBuy"${dis}>Jetzt kaufen</button><button class="btn btn-outline btn-lg" data-a="pAdd"${dis}>In den Warenkorb</button></div>
      ${payLogos(b)}
      ${trustBadges(b)}
    </div>
  </div>
  <div class="pd-info">
    <ul class="pinfo">${tiles.map(t=>`<li><span class="pinfo-ic">${ic(t[0])}</span><span><small>${t[1]}</small><b>${t[2]}</b></span></li>`).join("")}</ul>
    <div class="tabs" role="tablist" aria-label="Produktinformationen">${["Beschreibung","Einlösen","Hinweise"].map((t,i)=>`<button role="tab" id="pt${i}" aria-controls="pp${i}" aria-selected="${!i}" tabindex="${i?-1:0}" data-a="ptab" data-v="${i}">${t}</button>`).join("")}</div>
    <div class="tabp" id="pp0" role="tabpanel" aria-labelledby="pt0" data-p="0"><p>${esc(descOf(b))}</p></div>
    <div class="tabp" id="pp1" role="tabpanel" aria-labelledby="pt1" data-p="1" hidden><ol class="pd-steps" id="redeemOl">${redeemSteps(b).map(x=>`<li>${esc(x)}</li>`).join("")}</ol>${b.ru?`<div class="pd-go">${ruBtn(b)}<small>Offizielle Seite: ${esc(b.ru.label)}</small></div>`:""}</div>
    <div class="tabp" id="pp2" role="tabpanel" aria-labelledby="pt2" data-p="2" hidden><p>Gültig in ${region}. Es gelten die Bedingungen von ${esc(b.name)}${K?` und ${esc(PLAT[b.plat])}`:""}. Digitale Codes sind nach der Auslieferung vom Umtausch ausgeschlossen.</p></div>
  </div>
</div>
${similar.length?`<section class="sec pd-more">${secHead("Mehr aus "+esc(c.name),["/kategorie/"+c.id,"Alle"],railNav("simRail"))}${rail("simRail",similar,{cover:K})}</section>`:""}
<div class="pd-bar" id="pdBar"><div class="pd-bar-in"><span class="pd-bar-t"><b id="bbTot">${money(total())}</b><small id="bbSub">${esc(barSub())}</small></span><button class="btn btn-primary btn-ink" data-a="pBuy"${dis}>Jetzt kaufen</button></div></div>
<script type="application/ld+json" id="pdLd">${pdLd(b,c)}<\/script>
`,
  after(){if(b.rl)API("/product/"+encodeURIComponent(b.id)).then(j=>{const o=document.getElementById("redeemOl");if(o&&j.redeem){const st=String(j.redeem).replace(/<[^>]+>/g," ").split(/(?<=[.!])\s+|\n+|\r+/).map(x=>x.trim()).filter(x=>x.length>2).slice(0,8);if(st.length)o.innerHTML=st.map(x=>`<li>${esc(x)}</li>`).join("")}}).catch(()=>{});
    const stg=$("#pdStage"),bar=$("#pdBar"),buy=$(".pd-buy");
    stick($(".pd-side"));kBadge($(".pd-more"));
    /* Strukturierte Daten: die vom Server eingesetzte Fassung (Produkt/Kategorie) weicht der aktuellen in der Ansicht; Sterne kommen nur mit echten Bewertungen dazu */
    $$('head script[type="application/ld+json"]').forEach(s=>{if(/"(Product|BreadcrumbList|CollectionPage)"/.test(s.textContent))s.remove()});
    {const rk=variants(b).map(x=>x.id).filter(Boolean).sort().join(","),ldR=R=>{const s=document.getElementById("pdLd");if(s&&R&&R.count)s.textContent=pdLd(b,c,R)};
      if(REVB[rk])ldR(REVB[rk]);else API("/reviews?brand="+encodeURIComponent(rk)).then(R=>{REVB[rk]=REVB[rk]||R;ldR(R)}).catch(()=>{})}
    stg.addEventListener("pointerleave",()=>{stg.style.removeProperty("--mx");stg.style.removeProperty("--my")});
    const side=$(".pd-side");side.addEventListener("focusin",e=>{if(e.target.matches("input,textarea"))bar.classList.add("typing")});side.addEventListener("focusout",()=>bar.classList.remove("typing"));
    /* Kaufleiste (Handy): erscheint, wenn weder die Karte noch die Kaufknöpfe zu sehen sind, und verschwindet vor der Fußzeile */
    pdIO&&pdIO.disconnect();pdIO=null;
    if("IntersectionObserver" in window){const more=$(".pd-more"),ft=$("#ftr"),v=new Map([[stg,true],[buy,false]]);if(more)v.set(more,false);if(ft)v.set(ft,false);
      pdIO=new IntersectionObserver(es=>{es.forEach(e=>v.set(e.target,e.isIntersecting));bar.classList.toggle("show",!v.get(stg)&&!v.get(buy)&&!v.get(ft))});[...v.keys()].forEach(el=>el&&pdIO.observe(el))}
    const giftOk=()=>!P.gift||/^\S+@\S+\.\S+$/.test(($("#gTo")||{}).value||"");
    const X=xpayMount($("#pX"),()=>[Object.assign({id,a:P.a,q:P.q},P.gift?{gift:{to:$("#gTo").value.trim(),name:$("#gName").value.trim(),msg:$("#gMsg").value.trim(),design:P.design}}:{})],{ctx:"product",ready:giftOk,toKasse:()=>A.pBuy(),
      /* Express sichtbar: „Jetzt kaufen“ tritt als Glasknopf zurück (höchstens ein dunkler Kaufknopf im Blick) */
      onState:st=>{const p=$(".pd-buy [data-a=pBuy]");if(p)p.classList.toggle("btn-ink",st==="none")}});
    const upd=()=>{$("#pTot").textContent=money(total());$("#bbTot").textContent=money(total());$("#bbSub").textContent=barSub();$("#pQ").textContent=P.q;
      const sv=saving(),ps=$("#pSave");ps.hidden=!sv;ps.textContent=`Du sparst ${money(sv)} gegenüber dem Nennwert`;X&&X.refresh()};
    const tag=()=>{const t=$("#pAmtTag");if(!t)return;t.textContent=tagRaw();t.classList.remove("tick");void t.offsetWidth;t.classList.add("tick")};
    A.pAmt=(v,el)=>{P.a=+v;$$("#pAmts .amt").forEach(x=>x.setAttribute("aria-pressed",x===el));upd();tag()};
    A.pQty=v=>{P.q=Math.max(1,Math.min(10,P.q+ +v));upd()};
    A.pGift=(v,el)=>{P.gift=!P.gift;el.setAttribute("aria-checked",P.gift);$("#giftF").hidden=!P.gift;stg.classList.toggle("gifting",P.gift);upd()};
    A.pDesign=(v,el)=>{P.design=+v;$$(".designs button").forEach(x=>x.setAttribute("aria-pressed",x===el));$(".pd").style.setProperty("--gd",DESIGNS[P.design][1])};
    const tabs=$$(".pd-info [role=tab]");
    A.ptab=(v,el)=>{tabs.forEach(x=>{const on=x===el;x.setAttribute("aria-selected",on);x.tabIndex=on?0:-1});$$(".pd-info .tabp").forEach(p=>p.hidden=p.dataset.p!==v)};
    $(".pd-info [role=tablist]").addEventListener("keydown",e=>{const i=tabs.indexOf(document.activeElement);if(i<0)return;const k={ArrowRight:1,ArrowLeft:-1,Home:-i,End:tabs.length-1-i}[e.key];if(k==null)return;e.preventDefault();const t=tabs[(i+k+tabs.length)%tabs.length];t.focus();A.ptab(t.dataset.v,t)});
    const gm=$("#gMsg"),gn=$("#gName"),gt=$("#gTo");
    if(gm){const gp=()=>{$("#gHead").textContent=gm.value.trim()||"Ein Geschenk für dich";$("#gSub").textContent=gn.value.trim()?"Von "+gn.value.trim():"Mit persönlicher Nachricht"};gm.addEventListener("input",gp);gn.addEventListener("input",gp);gt.addEventListener("input",()=>{$("#gErr").textContent="";X&&X.refresh()});gp()}
    const build=()=>{
      const it={id,a:P.a,q:P.q,type:"code"};
      if(P.gift){const to=gt.value.trim();if(!/^\S+@\S+\.\S+$/.test(to)){$("#gErr").textContent="Bitte gib eine gültige E-Mail-Adresse ein.";gt.focus();return null}
        it.gift={to,name:gn.value.trim(),msg:gm.value.trim(),design:P.design}}
      return it;
    };
    const none=()=>{if(P.a)return false;toast("Dieses Produkt ist gerade ausverkauft");return true};
    A.pAdd=()=>{if(none())return;const it=build();if(it)addCart(it)};
    A.pBuy=()=>{if(none())return;const it=build();if(it){addCart(it,true);go("/kasse")}};
  }};
}
A.fav=(id,el)=>{
  const on=!S.favs.includes(id);S.favs=on?[id].concat(S.favs):S.favs.filter(x=>x!==id);save();
  $$(`[data-a="fav"][data-v="${id}"]`).forEach(b=>{b.setAttribute("aria-pressed",on);b.innerHTML=ic(on?"i-heart-f":"i-heart")+(b.classList.contains("pact-fav")?`<span>${on?"Gemerkt":"Merken"}</span>`:"")});if(el&&!el.matches(`[data-v="${id}"]`)){el.setAttribute("aria-pressed",on)}
  toast(on?"Zu Favoriten hinzugefügt":"Aus Favoriten entfernt",on?["/konto/favoriten","Ansehen"]:null);
  if(cur.path.startsWith("/konto"))route();
};

/* ---------- Suche ---------- */
/* Alle Wörter müssen passen; Name zählt mehr als Schlagwörter und Kategorie */
function searchBrands(q){
  const words=String(q||"").toLowerCase().split(/\s+/).filter(Boolean);if(!words.length)return [];
  const score=b=>{let s=0;const n=b.name.toLowerCase(),tg=(b.tags||[]).join(" ").toLowerCase(),pl=(PLAT[b.plat]||"").toLowerCase(),cn=catById(b.cat).name.toLowerCase();
    for(const w of words){const x=n.startsWith(w)?4:n.includes(w)?3:(pl.includes(w)||tg.includes(w))?2:cn.includes(w)?1:0;if(!x)return 0;s+=x}return s+(isRep(b)?.1:0)};
  return dedupeGrp(BRANDS.map(b=>[b,score(b)]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]).map(x=>x[0]));
}
/* Schwebende Markenzeichen im Suchkopf (echte Zeichen aus /logo, je Zeichen eine Marke) */
const SKY0=["steam","psn","netflix","spotify","apple","gplay","fortnite","roblox","zalando","valorant","dazn","twitch"];
const skyList=()=>uniqSi(SKY0.map(byId).concat(VIS())).slice(0,10);
function searchPage(_,qs){
  const q=qs.get("q")||"", f=CATS.some(c=>c.id===qs.get("c"))?qs.get("c"):"all";
  return {tab:"cats",title:q?`Suche: ${q}`:"Suche",html:`${crumb([["Suche"]])}
<section class="sec srch">
  <div class="srch-h" data-mouse>
    <div class="sk" data-off aria-hidden="true">${skyList().map((b,i)=>`<span class="sk-m" data-si="${esc(b.si)}" style="--k:${i};color:${brandInk(b)}"><i style="--si:url(/logo/${esc(b.si)}.svg);--a:${SIA[b.si]||1}"></i></span>`).join("")}</div>
    <h1 class="h1 srch-t">Suche</h1>
    <p class="srch-l">${VIS().length} Marken und Spiele. Tipp einen Namen ein, die Treffer erscheinen sofort.</p>
    <form class="srch-f" role="search" action="/suche"><div class="field srch-in">${ic("i-search")}<input id="sq" name="q" type="search" value="${esc(q)}" placeholder="Marke, Spiel oder Gutschein" aria-label="Suchbegriff" autocomplete="off" enterkeyhint="search"></div></form>
  </div>
  <div class="kbar srch-bar"><div class="kbar-f" role="group" aria-label="Kategorie"><button class="chip" aria-pressed="${f==="all"}" data-a="sf" data-v="all">Alle</button>${CATSV().map(c=>`<button class="chip" aria-pressed="${f===c.id}" data-a="sf" data-v="${c.id}">${ic(c.icon)}${esc(c.short)}</button>`).join("")}</div></div>
  <p class="srch-n" id="scount" role="status"></p>
  <div id="sres"></div>
</section>`,
  after(){
    let F=f;const inp=$("#sq");
    const url=()=>{const v=inp.value.trim(),p=new URLSearchParams();if(v)p.set("q",v);if(F!=="all")p.set("c",F);try{history.replaceState(null,"","/suche"+(p.toString()?"?"+p:""))}catch(e){}};
    const draw=()=>{const v=inp.value.trim(),l=(v?searchBrands(v):VIS()).filter(b=>F==="all"||b.cat===F);
      $("#scount").textContent=l.length?`${l.length} ${l.length===1?"Ergebnis":"Ergebnisse"}${v?` für „${v}“`:""}`:"";
      $("#sres").innerHTML=l.length?tilesPaged(l):kVoid("Nichts gefunden",v?`Für „${esc(v)}“ gibt es in dieser Auswahl keine Treffer. Versuch einen Marken- oder Spielnamen.`:"In dieser Kategorie gibt es gerade keine Produkte.",[["/kategorien","Kategorien ansehen"],["/","Zur Startseite"]]);
      $$("#sres .rv").forEach(x=>x.classList.add("in"));moreIO&&$$("#sres [data-more]").forEach(e=>moreIO.observe(e));kBadge($("#sres"));
      /* Passende Markenzeichen im Kopf leuchten auf */
      const hit=new Set(v?l.slice(0,24).map(b=>b.si).filter(Boolean):[]),sk=$(".sk");
      if(sk){sk.classList.toggle("q",hit.size>0);$$(".sk-m",sk).forEach(m=>m.classList.toggle("hit",hit.has(m.dataset.si)))}};
    A.sf=(v,el)=>{F=v;$$("[data-a=sf]").forEach(c=>c.setAttribute("aria-pressed",c===el));url();draw()};
    let t;inp.addEventListener("input",()=>{clearTimeout(t);t=setTimeout(()=>{url();draw()},140)});
    $(".srch-f").addEventListener("submit",e=>{e.preventDefault();clearTimeout(t);url();draw();inp.blur()});
    draw();if(!q)setTimeout(()=>inp.focus({preventScroll:true}),80);
  }};
}
/* 404: „4 ◯ 4“ – die Null ist der Ring aus flüssigem Chrom, von ihm laufen Wellen weg, dahinter ein Fächer leerer Glaskarten; darunter klare Wege zurück */
function notFound(){
  const cs=CATSV().filter(c=>c.id!=="topup").slice(0,5);
  return {title:"Nicht gefunden",html:`<section class="nf" data-mouse>
  <div class="nf-stage" aria-hidden="true">${kFan(["pearl",null,null,null,null],{cls:"kf-nf",par:false})}<div class="nf-num"><span>4</span><span class="nf-o">${kSig()}<span class="lq" data-off></span></span><span>4</span></div></div>
  <h1 class="h1 nf-t">Seite nicht gefunden</h1>
  <p class="lead nf-l">Diese Seite gibt es nicht oder nicht mehr. Über die Suche oder die Kategorien findest du schnell, was du brauchst.</p>
  <div class="nf-b"><a class="btn btn-primary btn-lg" href="/">Zur Startseite</a><button class="btn btn-soft btn-lg" data-a="palOpen">${ic("i-search")}Suchen</button></div>
  ${cs.length?`<nav class="nf-c" aria-label="Beliebte Kategorien">${cs.map(c=>`<a class="chip" href="/kategorie/${c.id}">${ic(c.icon)}${esc(c.short)}</a>`).join("")}<a class="chip" href="/aufladen">${ic("i-phone-f")}Handy aufladen</a></nav>`:""}
</section>`};
}
