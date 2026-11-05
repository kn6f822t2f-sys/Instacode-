/* ---------- shared components ---------- */
/* Gutscheinkarte: das zentrale Bauteil */
/* Leuchtfarbe der Karte: Markenfarbe, sonst instacode-Lila */
const glowOf=b=>{const m=String(b.bg||"").match(/#[0-9a-fA-F]{6}/g);return m?m[m.length>1?1:0]:"#6A55FF"};
const PLATSI={steam:"steam",ps5:"playstation",ea:"ea",ubi:"ubisoft",bnet:"battledotnet",rockstar:"rockstargames"};
const gc=(b,o={})=>{const k=isKey(b);return `<span class="gc${o.tilt===false?"":" tilt"}${k?" key":""}${o.cover&&k?" cover":""}${o.cls?" "+o.cls:""}" style="--b:${b.bg};--f:${b.fg};--g:${glowOf(b)}${o.style?";"+o.style:""}">${b.img?`<img class="gc-img" src="${b.img}" alt="" loading="lazy" decoding="async">`:b.logo?`<span class="art art-logo" aria-hidden="true"><img class="gc-logo" src="${b.logo}" alt="" loading="lazy" decoding="async"></span>`:`<span class="art" aria-hidden="true">${b.art}</span>`}${o.extra||""}${k&&b.plat&&o.plat!==false?`<em class="gc-plat">${PLATSI[b.plat]?siI(PLATSI[b.plat]):""}${PLAT[b.plat]||b.plat}</em>`:""}${o.amt!=null?`<span class="gc-amt"${o.amtId?` id="${o.amtId}"`:""}>${o.amt}</span>`:""}${b.disc&&o.badge!==false&&price(b,b.from)<b.from?`<em class="gc-badge">−${Math.round(b.disc*100)} %</em>`:""}<i class="holo" aria-hidden="true"></i><i class="gc-glare" aria-hidden="true"></i><i class="rim" aria-hidden="true"></i></span>`};
const priceTxt=b=>allSold(b)?"Derzeit ausverkauft":`${b.amts.length>1?"ab ":""}${money(price(b,b.from))}`;
/* Bühne mit schwebenden Karten (Parallax beim Scrollen, Maus im Hero) */
const IMGB=()=>BRANDS.filter(b=>b.img&&b.cat!=="topup");
const pk=(id,i=0)=>byId(id)||IMGB()[i%Math.max(1,IMGB().length)]||BRANDS[0];
const stage=(ids,cls)=>`<div class="${cls} float" data-par aria-hidden="true">${ids.map((id,i)=>pk(id,i+3)).filter(Boolean).map(b=>`<span class="fs">${gc(b,{tilt:false,badge:false})}</span>`).join("")}</div>`;
const tile=(b,i=0,o={})=>`<div class="tile rv" style="--d:${(i%4)*70}ms"><div class="tile-media"><a href="/marke/${b.id}" tabindex="-1" aria-hidden="true">${gc(b,{cls:"scrollshine",cover:o&&o.cover})}</a>${b.cat==="topup"?"":`<button class="qadd" data-a="qb" data-v="${b.id}" aria-label="Schnellkauf: ${esc(b.name)}">${ic("i-plus")}</button>`}</div><a class="tile-meta" href="/marke/${b.id}"><span class="tile-name">${esc(b.name)}</span><span class="tile-sub">${priceTxt(b)}${grpSize(b)>1?` · ${grpSize(b)} Länder`:regTag(b)}</span></a></div>`;
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
const PM={apple_pay:["Apple Pay","#000","#fff"],google_pay:["Google Pay","#fff","#1F1F1F"],paypal:["PayPal","#FFC439","#003087"],amazon_pay:["Amazon Pay","#FF9900","#131A22"],link:["Link","#00D66F","#011E0F"],eps:["EPS","#C8036F","#fff"],bancontact:["Bancontact","#005498","#fff"]};
const CARDS=[["Visa","#1A1F71","#fff","visa"],["Mastercard","#1C1C28","#fff","mastercard"],["Amex","#2E77BC","#fff","amex"]];
const pmKeys=()=>{let m;try{m=CFG.methods}catch(e){m=BOOT.config&&BOOT.config.methods}return m&&m.length?m:["apple_pay","card","link"]};
const PAYS=()=>pmKeys().flatMap(k=>k==="card"?CARDS:PM[k]?[PM[k].concat(k)]:[]);
const payLogo=k=>{let l;try{l=CFG.paylogos}catch(e){l=BOOT.config&&BOOT.config.paylogos}return l&&l[k]};
const payNames=()=>{const m=pmKeys(),n=m.filter(k=>k!=="card"&&PM[k]).map(k=>PM[k][0]).slice(0,3);if(m.includes("card"))n.push("Karte");try{if(CFG.klarna&&CFG.klarna.length)n.push("Klarna (Rechnung, Raten)")}catch(e){}return n.length>1?n.slice(0,-1).join(", ")+" oder "+n[n.length-1]:n[0]||"Karte"};
const WALLETS=()=>pmKeys().filter(k=>["apple_pay","google_pay","paypal","amazon_pay","link"].includes(k));
const MARK={apple_pay:"apple-pay",google_pay:"google-pay",paypal:"paypal",amazon_pay:"si/amazonpay",visa:"visa",mastercard:"mastercard",amex:"amex",klarna:"si/klarna",bancontact:"si/bancontact",eps:"si/eps"};
const markSrc=k=>MARK[k]?(MARK[k].includes("/")?`/img/mark/${MARK[k]}.svg`:`/img/mark/logos/${MARK[k]}.svg`):"";
const mark=(k,name)=>MARK[k]?`<span class="pmk" data-k="${k}"><img src="${markSrc(k)}" alt="${esc(name)}" loading="lazy" onerror="this.parentNode.classList.add('t')"><b>${esc(name)}</b></span>`:`<span class="pmk t" data-k="${k}"><b>${esc(name)}</b></span>`;
const klarnaBadge=()=>`<span class="pmk pmk-kl" data-k="klarna"><img src="${payLogo("klarna")||"/img/mark/si/klarna.svg?v=2"}" alt="Klarna" loading="lazy" onerror="this.outerHTML='<b>Klarna.</b>'"></span><span class="kl-cap">Rechnung · Raten · Sofort</span>`;
const payLogos=(pb)=>`<div class="paylogos" aria-label="Zahlungsarten">${PAYS().map(x=>payLogo(x[3])?`<span class="pmk" data-k="${x[3]}"><img src="${esc(payLogo(x[3]))}" alt="${esc(x[0])}"></span>`:mark(x[3],x[0])).join("")}${CFG.klarna&&(!pb||CFG.klarna.includes(pb.cat))?klarnaBadge():""}</div>`;
const faqList=(items,open)=>`<div class="faq">${items.map((x,i)=>`<div class="qa rv" style="--d:${i*60}ms" data-open="${open===i}"><button data-a="qa" aria-expanded="${open===i}"><span>${esc(x.q)}</span>${ic("i-down")}</button><div class="qa-b" role="region"><div><p>${esc(x.a)}</p></div></div></div>`).join("")}</div>`;
const empty=(title,text,btn)=>`<div class="empty rv"><div class="ghostfan" aria-hidden="true"><span class="gc ghost"></span><span class="gc ghost"></span><span class="gc" style="--b:var(--foil)"></span></div><h2 class="h3">${title}</h2><p>${text}</p>${btn?(btn[0]==="/"?`<button class="btn btn-primary" data-a="browse">${esc(btn[1])}</button>`:`<a class="btn btn-primary" href="${btn[0]}">${esc(btn[1])}</a>`):""}</div>`;
const PALL=FAQ.concat([
  {q:"Kann ich einen Gutschein verschenken?",a:"Ja. Aktiviere auf der Produktseite „Als Geschenk senden“, gib die E-Mail-Adresse ein und schreib eine persönliche Nachricht."},
  {q:"Wo finde ich meine gekauften Codes?",a:"Sobald wir geliefert haben: per E-Mail, auf der Bestellseite und, wenn du angemeldet bist, unter Konto › Bestellungen."},
  {q:"Kann ich ohne Konto bestellen?",a:"Ja, als Gast reicht deine E-Mail-Adresse. Mit Konto speicherst du Codes, Nummern und Favoriten."},
  {q:"Kann ich Codes zurückgeben?",a:"Digitale Codes sind nach der Auslieferung in der Regel vom Umtausch ausgeschlossen. Bei Problemen hilft der Support mit deiner Bestellnummer."}
]);
