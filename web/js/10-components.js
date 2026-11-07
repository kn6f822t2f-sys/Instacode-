/* ---------- shared components ---------- */
/* Gutscheinkarte: das zentrale Bauteil */
/* Leuchtfarbe der Karte: Markenfarbe, sonst instantcodes-Lila */
const glowOf=b=>{const m=String(b.bg||"").match(/#[0-9a-fA-F]{6}/g);return m?m[m.length>1?1:0]:"#6A55FF"};
const PLATSI={steam:"steam",ps5:"playstation",ea:"ea",ubi:"ubisoft",bnet:"battledotnet",rockstar:"rockstargames"};
/* Offizielle Markenlogos (public/brand/*.svg, Zuordnung brandlogos.json → b.logo, b.lc Kartenmodus, b.lar Seitenverhältnis, b.lsc Skalierung):
   Größe nach Seitenverhältnis, damit breite Schriftzüge und runde Zeichen gleich gewichtig wirken. Admin-Uploads (ohne b.lar) wie bisher. */
const lgBox=(a,area,mw,mh,s)=>{a=+a||2.5;s=+s||1;let w=Math.sqrt(area*a),h=w/a;if(w>mw){w=mw;h=w/a}if(h>mh){h=mh;w=h*a}return [w*s,h*s]};
const gcLogo=b=>{if(!b.lar)return `<img class="gc-logo" src="${b.logo}" alt="" loading="lazy" decoding="async">`;const [w,h]=lgBox(b.lar,900,66,36,b.lsc);return `<img class="gc-logo fit" src="${b.logo}" alt="" style="width:${w.toFixed(1)}cqi;height:${h.toFixed(1)}cqi" loading="lazy" decoding="async">`};
const gcLt=b=>b.logo&&!b.img&&!b.cov&&b.lc==="light";
const gc=(b,o={})=>{const k=isKey(b);return `<span class="gc${o.tilt===false?"":" tilt"}${k?" key":""}${o.cover&&k?" cover":""}${b.logo&&!b.img&&!b.cov?" lg":""}${gcLt(b)?" lt":""}${o.cls?" "+o.cls:""}" style="--b:${b.bg};--f:${b.fg};--g:${glowOf(b)}${o.style?";"+o.style:""}">${b.img?`<img class="gc-img" src="${b.img}" alt="" loading="lazy" decoding="async">`:b.cov?`<span class="art" aria-hidden="true">${b.art}</span><img class="gc-img gc-cov" src="/img/cover/${b.id}/${o.cover?"p":"l"}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`:b.logo?`<span class="art art-logo" aria-hidden="true">${gcLogo(b)}</span>`:`<span class="art" aria-hidden="true">${!k&&b.si?`<span class="si-lock only">${siI(b.si)}</span>`:b.art}</span>`}${o.extra||""}${k&&b.plat&&o.plat!==false?`<em class="gc-plat">${PLATSI[b.plat]?siI(PLATSI[b.plat]):""}${PLAT[b.plat]||b.plat}</em>`:""}${o.amt!=null?`<span class="gc-amt"${o.amtId?` id="${o.amtId}"`:""}>${o.amt}</span>`:""}${b.disc&&o.badge!==false&&price(b,b.from)<b.from?`<em class="gc-badge">−${Math.round(b.disc*100)} %</em>`:""}<i class="holo" aria-hidden="true"></i><i class="gc-glare" aria-hidden="true"></i><i class="rim" aria-hidden="true"></i></span>`};
const priceTxt=b=>allSold(b)?"Derzeit ausverkauft":`${b.amts.length>1?"ab ":""}${money(price(b,b.from))}`;
/* ---------- Vertrauen: Band quer über die Seite, Abzeichen am Produkt, Markenwand ----------
   Nur wahre Aussagen (keine erfundenen Zahlen, Siegel oder Partnerschaften). */
const TRUST=()=>[["i-shield","Offizielle Codes"],["i-zap","Meist in Sekunden per E-Mail"],["i-lock","Sicher bezahlt über Stripe"],["i-mail","Persönlicher Support"],["i-check",`${VIS().length} Marken im Sortiment`]];
/* Markenfarbe für Zeichen auf hellem Grund: zu helle Farben werden Graphit */
const brandInk=b=>{const h=glowOf(b).replace("#","");const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),bl=parseInt(h.slice(4,6),16);return (r*.299+g*.587+bl*.114)>200?"#1B1E24":"#"+h};
/* Laufband: Zusagen, echte Zahlungszeichen und Markenlogos im Wechsel (doppelt für die Endlosschleife) */
/* Markenzeichen auf hellem Grund: farbiges Original als Bild, einfarbige Fassung (b.ltn) als Maske in Markenfarbe, sonst Simple-Icons-Zeichen */
const brandMark=(b,area,mw,mh,cls)=>{if(b.logo&&b.lar){const [w,h]=lgBox(b.lar,area,mw,mh,b.lsc),st=`width:${w.toFixed(1)}px;height:${h.toFixed(1)}px`;
    return b.ltn&&b.lc!=="light"?`<i class="${cls} bm" style="--si:url(${b.logo});${st};color:${brandInk(b)}"></i>`:`<img class="${cls} bm" src="${b.logo}" alt="" style="${st}" loading="lazy" decoding="async">`}
  return b.si?`<i class="${cls}" style="--si:url(/logo/${b.si}.svg);--a:${SIA[b.si]||1};color:${brandInk(b)}"></i>`:""};
const hasMark=b=>!!(b&&((b.logo&&b.lar)||b.si));
const trustBand=(o={})=>{const logos=VIS().filter(hasMark).slice(0,o.n||14);
  const set=`${TRUST().map(([i,t])=>`<span class="tb-i">${ic(i)}${esc(t)}</span>`).join("")}<span class="tb-pay">${PAYS().map(x=>x[3]==="revolut_pay"?`<b class="tb-rv"><img src="${markSrc("revolut")}" alt="" loading="lazy">Revolut Pay</b>`:MARK[x[3]]?`<img src="${markSrc(x[3])}" alt="${esc(x[0])}" loading="lazy">`:`<b>${esc(x[0])}</b>`).join("")}${CFG.klarna&&CFG.klarna.length&&!klarnaScope()?`<img class="tb-kl" src="${payLogo("klarna")||"/pay/klarna.svg"}" alt="Klarna" loading="lazy">`:""}</span>${logos.map(b=>brandMark(b,600,92,26,"tb-l")).join("")}`;
  return `<div class="tband${o.cls?" "+o.cls:""}" data-off role="note" aria-label="Darum instantcodes: offizielle Codes, Lieferung per E-Mail, sichere Zahlung über Stripe"><div class="tb-track" aria-hidden="true"><div class="tb-set">${set}</div><div class="tb-set">${set}</div></div></div>`};
/* Abzeichen für Produkt und Kachel */
const trustBadges=b=>`<ul class="tbadges" aria-label="Vorteile">${[["i-shield","Offizieller Code"],["i-zap",b&&b.cat==="topup"?"Direkt aufs Handy":"Meist sofort per E-Mail"],["i-lock","Sicher bezahlt"]].map(([i,t])=>`<li>${ic(i)}<span>${t}</span></li>`).join("")}</ul>`;
/* Markenwand mit echten Markenzeichen in Markenfarbe */
const brandWall=(list,o={})=>`<div class="bwall${o.cls?" "+o.cls:""}">${list.filter(hasMark).slice(0,o.n||24).map((b,i)=>`<a class="bw rv" href="/marke/${b.id}" style="--d:${(i%8)*40}ms;color:${brandInk(b)}" aria-label="${esc(b.name)}">${brandMark(b,1250,104,40,"bw-m")}<span>${esc(shortNm(b))}</span></a>`).join("")}</div>`;
const shortNm=b=>b.name.replace(/ (Gift Card|Geschenkkarte|Guthaben)$/,"");
/* iPhone-Rahmen (Statusleiste mit Uhrzeit, Netz, WLAN, Akku; Tasten). inner = Inhalt unter der Statusleiste */
const IPH_IC='<span class="iph-ic" aria-hidden="true"><svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 16 12"><path d="M8 2.3c2.5 0 4.8 1 6.5 2.6l1.2-1.3A11 11 0 0 0 8 .5 11 11 0 0 0 .3 3.6l1.2 1.3A9.3 9.3 0 0 1 8 2.3Zm0 3.6c1.5 0 2.9.6 3.9 1.5l1.2-1.3A7.3 7.3 0 0 0 8 4.1a7.3 7.3 0 0 0-5.1 2l1.2 1.3c1-.9 2.4-1.5 3.9-1.5Zm0 3.5c.6 0 1.1.2 1.5.6L8 11.6 6.5 10c.4-.4.9-.6 1.5-.6Z"/></svg><svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3.2" fill="none" stroke="currentColor" stroke-opacity=".4"/><rect x="2" y="2" width="19" height="8" rx="2"/><path d="M25 4v4c.8-.3 1.4-1.1 1.4-2S25.8 4.3 25 4Z" fill-opacity=".45"/></svg></span>';
const iphone=(inner,o={})=>`<div class="iph${o.cls?" "+o.cls:""}"${o.id?` id="${o.id}"`:""} style="${o.w?`--w:${o.w}px;`:""}${o.style||""}" aria-hidden="true"><i class="iph-k l a"></i><i class="iph-k l u"></i><i class="iph-k l d"></i><i class="iph-k r p"></i><i class="iph-k r c"></i><div class="iph-in"><div class="iph-scr"><div class="iph-stat"><b>9:41</b><span class="iph-isl"></span>${IPH_IC}</div><div class="iph-view">${inner}</div><i class="iph-glare"></i></div></div></div>`;
/* Bühne mit schwebenden Karten (Parallax beim Scrollen, Maus im Hero) */
const IMGB=()=>BRANDS.filter(b=>b.img&&b.cat!=="topup");
const pk=(id,i=0)=>byId(id)||IMGB()[i%Math.max(1,IMGB().length)]||BRANDS[0];
const stage=(ids,cls)=>`<div class="${cls} float" data-par aria-hidden="true">${ids.map((id,i)=>pk(id,i+3)).filter(Boolean).map(b=>`<span class="fs">${gc(b,{tilt:false,badge:false})}</span>`).join("")}</div>`;
/* Varianten einer Gruppe: Spiele nach Plattform, Gutscheine nach Land – sonst z. B. Laufzeiten oder Editionen */
const grpLbl=b=>{if(b.cat==="keys")return "Plattformen";const l=BRANDS.filter(x=>x.grp&&x.grp===b.grp);return new Set(l.map(x=>x.region||"")).size>1?"Länder":"Varianten"};
/* Kachel (Konzept „Silberstreifen“): kein Kasten – die Karte bzw. das Spielecover ist das Objekt. Darunter Name, Preis und eine Zeile
   Zusatzinfo (Plattformen bei Spielen, sonst Land bzw. Zahl der Länder/Varianten). Schnellkauf als weiße Scheibe unten rechts auf der Karte. */
const tileMeta=b=>{if(isKey(b))return [...new Set((grpSize(b)>1?variants(b):[b]).map(x=>PLAT[x.plat]||x.plat).filter(Boolean))].join(", ");
  if(grpSize(b)>1)return `${grpSize(b)} ${grpLbl(b)}`;
  return b.cat==="topup"?"Handy-Guthaben":REGION[b.region]||regDE(b.region)||"Deutschland"};
const tile=(b,i=0,o={})=>`<div class="tile"><div class="tile-media"><a href="/marke/${b.id}" tabindex="-1" aria-hidden="true">${gc(b,{cover:o&&o.cover})}</a>${b.cat==="topup"?"":`<button class="qadd" data-a="qb" data-v="${b.id}" aria-label="Schnellkauf: ${esc(b.name)}">${ic("i-plus")}</button>`}</div><a class="tile-meta" href="/marke/${b.id}"><span class="tile-name">${esc(b.name)}</span><span class="tile-sub">${priceTxt(b)}</span><span class="tile-x">${esc(tileMeta(b))}</span></a></div>`;
const catCard=(c,i=0)=>{const l=VIS().filter(b=>b.cat===c.id),nAll=BRANDS.filter(b=>b.cat===c.id).length;return `<a class="catcard rv" style="--c:${CCOL[c.id]};--d:${(i%5)*60}ms" href="/kategorie/${c.id}"><span class="cc-ic">${ic(c.icon)}</span><b>${esc(c.name)}</b><small>${nAll} ${c.id==="keys"?"Spiele":"Produkte"}</small><span class="fan" aria-hidden="true">${l.slice(0,3).map(b=>gc(b,{tilt:false,badge:false,plat:false})).join("")}</span></a>`};
/* Animierte Deko (eigene animierte WebP-Loops, lazy geladen) */
const secHead=(title,link,right)=>`<div class="sec-head"><h2 class="h2">${title}</h2>${right||link?`<div style="display:flex;align-items:center;gap:14px">${link?`<a class="more" href="${link[0]}">${esc(link[1])}${ic("i-chev")}</a>`:""}${right||""}</div>`:""}</div>`;
const railNav=id=>`<div class="rail-nav"><button class="prev" data-a="railGo" data-v="${id}|-1" aria-label="Zurück">${ic("i-chev")}</button><button class="next" data-a="railGo" data-v="${id}|1" aria-label="Weiter">${ic("i-chev")}</button></div>`;
const PAGED={};let pgN=0;
const tilesPaged=(l,o={})=>{const id="pg"+(++pgN),N=36;PAGED[id]={l,o,n:Math.min(N,l.length)};return `<div class="tiles${o.cover?" covers":""}" id="${id}">${l.slice(0,N).map((b,i)=>tile(b,i,o)).join("")}</div>${l.length>N?`<div class="more-wrap" data-more="${id}"><button class="btn btn-soft" data-a="moreTiles" data-v="${id}">Mehr anzeigen</button></div>`:""}`};
A.moreTiles=v=>{const P=PAGED[v],g=document.getElementById(v);if(!P||!g)return;const add=P.l.slice(P.n,P.n+48);g.insertAdjacentHTML("beforeend",add.map((b,i)=>tile(b,i,P.o)).join(""));P.n+=add.length;$$(".rv:not(.in)",g).forEach(x=>x.classList.add("in"));if(P.n>=P.l.length){const w=document.querySelector(`[data-more="${v}"]`);w&&w.remove()}};
const moreIO="IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting)A.moreTiles(en.target.dataset.more)}),{rootMargin:"600px 0px"}):null;
const rail=(id,list,o)=>`<div class="rail"><div class="rail-track" id="${id}">${list.map((b,i)=>tile(b,i,o)).join("")}</div></div>`;
const phead=o=>`<div class="phead rv" style="--c:${o.c}">${stage(o.cards,"phead-stage")}<span class="cc-ic"${o.icbg?` style="background:${o.icbg};color:#fff"`:""}>${ic(o.icon)}</span><h1 class="h1 page-h1">${o.title}</h1><p>${o.text}</p>${o.extra||""}</div>`;
const crumb=parts=>`<nav class="crumb" aria-label="Brotkrumen"><a href="/">Start</a>${parts.map(p=>`${ic("i-chev")}${p[1]?`<a href="${p[1]}">${esc(p[0])}</a>`:`<span>${esc(p[0])}</span>`}`).join("")}</nav>`;
const mqItem=(b,h)=>`<a class="mq-item" href="/marke/${b.id}"${h?' tabindex="-1" aria-hidden="true"':` aria-label="${esc(b.name)}"`}>${gc(b,{tilt:false,badge:false})}</a>`;
const mqRow=(l,rev)=>`<div class="mq-row${rev?" rev":""}"><div class="mq-set">${l.map(b=>mqItem(b,0)).join("")}</div><div class="mq-set" aria-hidden="true">${l.map(b=>mqItem(b,1)).join("")}</div></div>`;
const marquee=()=>{const l=VIS().filter(b=>!isKey(b)&&b.cat!=="software");return `<div class="mq" data-off aria-label="Beliebte Marken">${mqRow(l.slice(0,12))}${mqRow(l.slice(12,24),1)}</div>`};
/* Zahlungsarten: kommen live aus den Stripe-Einstellungen (Server liest sie aus), Klarna ist für Gutscheine ausgeschlossen */
const PM={apple_pay:["Apple Pay","#000","#fff"],google_pay:["Google Pay","#fff","#1F1F1F"],paypal:["PayPal","#FFC439","#003087"],revolut_pay:["Revolut Pay","#191C1F","#fff"],crypto:["Krypto","#3E73C4","#fff"],amazon_pay:["Amazon Pay","#FF9900","#131A22"],link:["Link","#00D66F","#011E0F"],eps:["EPS","#C8036F","#fff"],bancontact:["Bancontact","#005498","#fff"]};
const CARDS=[["Visa","#1A1F71","#fff","visa"],["Mastercard","#1C1C28","#fff","mastercard"],["Amex","#2E77BC","#fff","amex"]];
const pmKeys=()=>{let m;try{m=CFG.methods}catch(e){m=BOOT.config&&BOOT.config.methods}return m&&m.length?m:["apple_pay","google_pay","card","link"]};
/* Krypto nur zeigen, wenn die Kasse es wirklich anbietet: Stripe-Stablecoins laufen nur in USD, der Shop rechnet in EUR */
const cryptoOk=()=>{let i;try{i=CFG.inline}catch(e){i=BOOT.config&&BOOT.config.inline}return !!(i&&i.includes("crypto"))};
const PAYS=()=>pmKeys().filter(k=>k!=="crypto"||cryptoOk()).flatMap(k=>k==="card"?CARDS:PM[k]?[PM[k].concat(k)]:[]);
const payLogo=k=>{let l;try{l=CFG.paylogos}catch(e){l=BOOT.config&&BOOT.config.paylogos}return l&&l[k]};
const payNames=()=>{const m=pmKeys(),n=m.filter(k=>k!=="card"&&PM[k]).map(k=>PM[k][0]).slice(0,3);if(m.includes("card"))n.push("Karte");try{if(CFG.klarna&&CFG.klarna.length){const sc=klarnaScope();n.push(`Klarna${sc?" ("+sc+")":""}`)}}catch(e){}return n.length>1?n.slice(0,-1).join(", ")+" oder "+n[n.length-1]:n[0]||"Karte"};
/* Express-Zahlungsarten in fester Reihenfolge (Klarna kommt aus CFG.klarna, Revolut Pay als eigener Knopf nach den Stripe-Knöpfen) */
const XORD=["apple_pay","google_pay","paypal","revolut_pay","klarna","amazon_pay","link"];
const WALLETS=()=>pmKeys().filter(k=>XORD.includes(k)&&k!=="klarna").sort((a,b)=>XORD.indexOf(a)-XORD.indexOf(b));
/* Offizielle Zeichen liegen unter /pay (mitgeliefert), seltene Zahlungsarten kommen über den Logo-Proxy */
/* revolut = Revolut-Zeichen (Simple Icons, CC0). Revolut Pay steht laut Revolut nie nur als „R“: immer Zeichen plus Name (rvBadge).
   crypto = USDC-Zeichen (Iconify „cryptocurrency-color“, CC0) für Stripes Stablecoin-Zahlung, nur wenn sie in Stripe aktiv ist */
const MARK={apple_pay:"apple-pay",google_pay:"google-pay",paypal:"paypal",amazon_pay:"amazon-pay",visa:"visa",mastercard:"mastercard",amex:"amex",maestro:"maestro",klarna:"klarna",sepa:"sepa",bancontact:"si/bancontact",eps:"si/eps",revolut:"revolut",crypto:"crypto"};
const markSrc=k=>MARK[k]?(MARK[k].includes("/")?`/img/mark/${MARK[k]}.svg`:`/pay/${MARK[k]}.svg`):"";
const mark=(k,name)=>MARK[k]?`<span class="pmk" data-k="${k}"><img src="${markSrc(k)}" alt="${esc(name)}" loading="lazy" onerror="this.parentNode.classList.add('t')"><b>${esc(name)}</b></span>`:`<span class="pmk t" data-k="${k}"><b>${esc(name)}</b></span>`;
/* Klarna-Freigabe (Admin, CFG.klarna): deckt sie nicht das ganze Sortiment ab, steht „nur für …“ dabei.
   „Rechnung“ steht nur da, wo Klarna wirklich aktiv ist (CFG.klarna gibt es nur dann). */
const klarnaScope=()=>{let k;try{k=CFG.klarna}catch(e){k=BOOT.config&&BOOT.config.klarna}if(!k||!k.length)return "";
  const all=[...new Set(BRANDS.map(b=>b.cat))];if(all.length&&all.every(c=>k.includes(c)))return "";
  const n=k.map(id=>(CATS.find(c=>c.id===id)||{}).name).filter(Boolean);return n.length?"nur für "+(n.length>1?n.slice(0,-1).join(", ")+" und "+n[n.length-1]:n[0]):""};
/* Verbraucherkredit-Richtlinie (ab 20.11.2026): Werbung für späteres Bezahlen braucht direkt daneben und gleich auffällig diesen Hinweis */
const KL_WARN="Achtung! Kreditaufnahme kostet Geld.";
const klarnaBadge=(o={})=>{const sc=o.scope===false?"":klarnaScope();return `<span class="pmk pmk-kl" data-k="klarna"><img src="${payLogo("klarna")||"/pay/klarna.svg"}" alt="Klarna" loading="lazy" onerror="this.outerHTML='<b>Klarna.</b>'"></span><span class="kl-cap">Rechnung · Raten · Sofort${sc?` · ${esc(sc)}`:""}<span class="kl-warn">${KL_WARN}</span></span>`};
/* Zeichen plus Name (Revolut Pay, Krypto) */
const icBadge=(k,mk,name)=>`<span class="pmk pmk-tx" data-k="${k}"><img src="${markSrc(mk)}" alt="" loading="lazy" onerror="this.remove()"><b>${esc(name)}</b></span>`;
const rvBadge=()=>icBadge("revolut_pay","revolut","Revolut Pay");
/* pb: Produkt (Klarna nur, wenn seine Kategorie freigegeben ist) · o.klarna: Klarna ja/nein vorgeben (Kasse: ganzer Warenkorb) */
const payLogos=(pb,o={})=>{const kl=!!CFG.klarna&&(o.klarna!=null?!!o.klarna:(!pb||CFG.klarna.includes(pb.cat)));
  return `<div class="paylogos" aria-label="Zahlungsarten">${PAYS().map(x=>payLogo(x[3])?`<span class="pmk" data-k="${x[3]}"><img src="${esc(payLogo(x[3]))}" alt="${esc(x[0])}"></span>`:x[3]==="revolut_pay"?rvBadge():x[3]==="crypto"?icBadge("crypto","crypto",x[0]):mark(x[3],x[0])).join("")}${kl?klarnaBadge({scope:!pb&&o.klarna==null}):""}</div>`};
const faqList=(items,open)=>`<div class="faq">${items.map((x,i)=>`<div class="qa rv" style="--d:${i*60}ms" data-open="${open===i}"><button data-a="qa" aria-expanded="${open===i}"><span>${esc(x.q)}</span>${ic("i-down")}</button><div class="qa-b" role="region"><div><p>${esc(x.a)}</p></div></div></div>`).join("")}</div>`;
const empty=(title,text,btn)=>`<div class="empty rv"><div class="ghostfan" aria-hidden="true"><span class="gc ghost"></span><span class="gc ghost"></span><span class="gc" style="--b:var(--foil)"></span></div><h2 class="h3">${title}</h2><p>${text}</p>${btn?(btn[0]==="/"?`<button class="btn btn-primary" data-a="browse">${esc(btn[1])}</button>`:`<a class="btn btn-primary" href="${btn[0]}">${esc(btn[1])}</a>`):""}</div>`;
const PALL=FAQ.concat([
  {q:"Kann ich einen Gutschein verschenken?",a:"Ja. Aktiviere auf der Produktseite „Als Geschenk senden“, gib die E-Mail-Adresse ein und schreib eine persönliche Nachricht."},
  {q:"Wo finde ich meine gekauften Codes?",a:"Sobald wir geliefert haben: per E-Mail, auf der Bestellseite und, wenn du angemeldet bist, unter Konto › Bestellungen."},
  {q:"Kann ich ohne Konto bestellen?",a:"Ja, als Gast reicht deine E-Mail-Adresse. Mit Konto speicherst du Codes, Nummern und Favoriten."},
  {q:"Kann ich Codes zurückgeben?",a:"Digitale Codes sind nach der Auslieferung in der Regel vom Umtausch ausgeschlossen. Bei Problemen hilft der Support mit deiner Bestellnummer."}
]);
