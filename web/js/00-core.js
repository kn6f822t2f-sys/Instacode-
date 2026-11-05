(()=>{"use strict";
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ic=(id,c="")=>`<svg class="ico ${c}" aria-hidden="true"><use href="#${id}"/></svg>`;
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const LOGO=(s=30)=>`<svg class="lg-mark" width="${s}" height="${s}" aria-hidden="true"><use href="#logo"/></svg>`;
const A={};
var COUNTRIES=[
  {c:"DE",n:"Deutschland",cur:"EUR",r:1,dial:"+49"},
  {c:"AT",n:"Österreich",cur:"EUR",r:1,dial:"+43"},
  {c:"CH",n:"Schweiz",cur:"CHF",r:0.95,dial:"+41"},
  {c:"NL",n:"Niederlande",cur:"EUR",r:1,dial:"+31"},
  {c:"FR",n:"Frankreich",cur:"EUR",r:1,dial:"+33"},
  {c:"GB",n:"Vereinigtes Königreich",cur:"GBP",r:0.86,dial:"+44"},
  {c:"TR",n:"Türkei",cur:"TRY",r:37,dial:"+90"},
  {c:"US",n:"USA",cur:"USD",r:1.09,dial:"+1"}
];
var CATS=[
  {id:"topup",name:"Handy aufladen",short:"Aufladen",icon:"i-phone-f",col:"#3B5BDB",desc:"Guthaben für Prepaid-Tarife"},
  {id:"keys",name:"Spiele-Keys",short:"Spiele-Keys",icon:"i-key",col:"#7048E8",desc:"Aktuelle Spiele für PC und Konsole"},
  {id:"gaming",name:"Gaming-Guthaben",short:"Gaming",icon:"i-pad-f",col:"#10B981",desc:"Steam, PlayStation, Xbox, Nintendo und mehr"},
  {id:"currency",name:"Spielwährungen",short:"Spielwährung",icon:"i-coin",col:"#E8930C",desc:"V-Bucks, Robux, Valorant Points und mehr"},
  {id:"subs",name:"Abos",short:"Abos",icon:"i-repeat",col:"#EC4899",desc:"Game Pass, PlayStation Plus, Switch Online"},
  {id:"apps",name:"App Stores",short:"App Stores",icon:"i-apps",col:"#0EA5E9",desc:"Guthaben für Apps, Filme und Musik"},
  {id:"entertainment",name:"Streaming & Musik",short:"Streaming",icon:"i-play-f",col:"#A855F7",desc:"Netflix, Disney+, Spotify, DAZN und mehr"},
  {id:"shopping",name:"Shopping & Essen",short:"Shopping",icon:"i-bag-f",col:"#F97316",desc:"Mode, Elektronik, Essen und mehr"},
  {id:"software",name:"Software",short:"Software",icon:"i-shield",col:"#06B6D4",desc:"Office, Antivirus und VPN"},
  {id:"payment",name:"Prepaid-Karten",short:"Prepaid",icon:"i-card-f",col:"#6366F1",desc:"Bezahlkarten für Online-Zahlungen"}
];
function wm(t,sz,fw,ls,extra){return '<span class="wm" style="font-size:'+(sz/100)+'em;font-weight:'+fw+';letter-spacing:'+(ls||"0")+'">'+t+(extra||"")+'</span>'}
var GEM='<svg viewBox="0 0 64 64" style="width:.64em;height:.64em" aria-hidden="true"><polygon points="32,32 32,6 54,19" fill="#FF5E7E"/><polygon points="32,32 54,19 54,45" fill="#FFB84D"/><polygon points="32,32 54,45 32,58" fill="#5BD6A3"/><polygon points="32,32 32,58 10,45" fill="#4DB8FF"/><polygon points="32,32 10,45 10,19" fill="#7C5CFF"/><polygon points="32,32 10,19 32,6" fill="#E85CFF"/></svg>';
var DIAM='<svg viewBox="0 0 28 16" style="width:.3em;height:.17em" aria-hidden="true"><path d="M8 0l8 8-8 8-8-8z" fill="#fff"/><path d="M20 3l5 5-5 5-5-5z" fill="#fff"/></svg>';
var RING='<svg viewBox="0 0 32 32" style="width:.34em;height:.34em" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="#fff" stroke-width="3"/><circle cx="20" cy="12" r="4.5" fill="#fff"/><circle cx="12" cy="21" r="3" fill="#fff"/></svg>';
var PLAYG='<svg viewBox="0 0 24 24" style="width:.26em;height:.26em" aria-hidden="true"><path d="M5 3l15 9-15 9z" fill="#01875F"/></svg>';
/* Katalog kommt vom Server (in die Seite eingebettet, also ohne zusätzliche Ladezeit) */
const BOOT=(()=>{try{return JSON.parse(document.getElementById("boot").textContent||"{}")}catch(e){return {}}})();
const PLAT={steam:"Steam",pc:"PC",ea:"EA app",bnet:"Battle.net",ubi:"Ubisoft Connect",rockstar:"Rockstar Launcher",ps5:"PS5",xbox:"Xbox",xpc:"Xbox & PC",switch:"Switch",switch2:"Switch 2"};
const PLATG={steam:"pc",pc:"pc",ea:"pc",bnet:"pc",ubi:"pc",rockstar:"pc",ps5:"ps",xbox:"xbox",xpc:"xbox",switch:"nin",switch2:"nin"};
/* Echte Markenzeichen (Simple Icons, /logo/<slug>.svg) als Maske – sie übernehmen die Schriftfarbe der Karte */
const SIA={"adidas":1.56,"airbnb":0.93,"aldinord":0.95,"apple":0.82,"audible":1.58,"bitdefender":0.87,"deutschetelekom":0.85,"discord":1.3,"ea":1.97,"edeka":0.83,"epicgames":0.87,"fortnite":0.43,"googleplay":0.9,"ikea":2.36,"kaspersky":4.51,"leagueoflegends":0.94,"mastercard":1.58,"netflix":0.57,"nike":2.67,"nordvpn":1.25,"otto":2.75,"paramountplus":1.24,"penny":4.5,"playstation":1.26,"pubg":1.34,"rtl":4.82,"saturn":1.69,"twitch":0.86,"uber":2.77,"ubereats":1.3,"ubisoft":0.96,"valorant":1.21,"visa":2.87,"zalando":0.96};
const siI=s=>{const a=SIA[s]||1;return `<i class="si${a>2?" w":""}" style="--si:url(/logo/${s}.svg);--a:${a}" aria-hidden="true"></i>`};
function siArt(p,m){
  if(p.sio)return `<span class="si-lock only">${siI(p.si)}</span>`;
  const t=p.sit||m.t||p.name,k=t.length>=8?.66:t.length>=6?.74:.84,fs=v=>Math.min(v,.3).toFixed(3),st=`font-weight:${m.w};letter-spacing:${m.ls}`;
  if(m.two&&!p.sit)return `<span class="si-lock" style="font-size:${fs(m.s*k*.82/100)}em">${siI(p.si)}<span class="wm2"><b style="${st}">${esc(t)}</b><small>${esc(m.two)}</small></span></span>`;
  return `<span class="si-lock" style="font-size:${fs(m.s*k/100)}em;${st}">${siI(p.si)}<span class="wm">${esc(t)}</span></span>`;
}
function artOf(p){
  const m=p.mark||{t:p.name,s:30,w:800,ls:"-.02em"};
  if(p.si&&p.type!=="key")return siArt(p,m);
  if(p.type==="key"){const t=m.t||p.name,n=t.length,lw=Math.max(...t.split(/\s+/).map(w=>w.length)),fs=Math.min(n<=10?.3:n<=16?.24:n<=24?.19:.16,2.5/lw).toFixed(3);return `<span class="kt" style="font-size:${fs}em">${esc(t)}</span>`}
  if(m.g==="gem")return GEM;
  const g={diam:DIAM,ring:RING,playg:PLAYG}[m.g]||"";
  if(m.two)return `${g}<span class="wm2"><b style="font-size:${m.s/100}em;font-weight:${m.w};letter-spacing:${m.ls}">${esc(m.t)}</b><small style="font-size:${Math.round(m.s*.43)/100}em;font-weight:700;letter-spacing:.06em">${esc(m.two)}</small></span>`;
  return g+wm(esc(m.t),m.s,m.w,m.ls);
}
let BRANDS=[],BY=new Map(),REP=new Set();
function setCatalog(list){
  BRANDS=list.map(p=>Object.assign({},p,{fg:p.fg||"#fff",disc:p.disc||0,art:artOf(p),from:Math.min.apply(null,p.amts),ini:(p.name.replace(/[^A-Za-z0-9]/g,"")||"?").slice(0,2)}));
  BY=new Map(BRANDS.map(b=>[b.id,b]));
  REP=new Set();const seen=new Set();
  BRANDS.forEach(b=>{if(!b.grp||!seen.has(b.grp)){REP.add(b.id);if(b.grp)seen.add(b.grp)}});
  VISC=null;GRPN=null;
  try{refreshPicks()}catch(e){}
}
setCatalog(BOOT.products||[]);
/* Für Bildgenerierung (Produktbilder auf der Stripe-Zahlungsseite): Karte als HTML */
window.instacodeCard=(id,o)=>{const b=byId(id);return b?gc(b,Object.assign({tilt:false,badge:false},o||{})):""};window.instacodeIds=()=>BRANDS.map(b=>b.id);
var POP0=["apple","steam","psn","fortnite","fc26-ps5","amazon","netflix","gpu"],FEAT0=["apple","psn","fortnite","gpu","steam"];
const pick=(base,n)=>{const l=base.filter(id=>byId(id));const pref=["steam","playstation","xbox","nintendo","amazon","netflix","spotify","apple","google","zalando","ikea","fortnite","roblox","paysafecard","disney"];
  for(const w of pref){if(l.length>=n)break;const b=BRANDS.find(x=>x.img&&!l.includes(x.id)&&x.name.toLowerCase().includes(w));if(b)l.push(b.id)}
  for(const b of BRANDS){if(l.length>=n)break;if(b.img&&!l.includes(b.id))l.push(b.id)}return l};
var BEST0=["apple","steam","psn","amazon","netflix","gpu","nintendo","gplay","spotify","fortnite","roblox","disney","psplus-essential","xbox","zalando","paysafe","fcpoints","valorant","lieferando","ikea","dazn","ea"];var POP=[],FEAT=[];const refreshPicks=()=>{POP=pick(POP0,8);FEAT=pick(FEAT0,5)};
var FAQ=[
  {q:"Wie schnell kommt mein Code an?",a:"Meist sofort: Nach der Zahlung kommt dein Code automatisch per E-Mail. Manche Bestellungen prüfen wir zur Sicherheit kurz von Hand, dann dauert es etwas länger. Den Stand siehst du jederzeit auf der Bestellseite."},
  {q:"Wie löse ich einen Code ein?",a:"Öffne den Dienst der Marke, wähle „Code einlösen“ und gib den Code ein. Handy-Guthaben wird direkt auf die Nummer gebucht."},
  {q:"Welche Zahlungsarten gibt es?",get a(){return `${payNames()} – je nach Gerät direkt mit einem Klick. Die Zahlung läuft sicher über Stripe, deine Kartendaten sehen wir nie.`}},
  {q:"Für welche Region gelten die Codes?",a:"Das steht auf jeder Produktseite unter „Gültig in“. Gutscheine gelten meist für Deutschland, Spiele-Keys für Europa."},
  {q:"Kann ich Gutscheine auf Rechnung kaufen?",get a(){const k=CFG.klarna&&CFG.klarna.length;return k?`Ja. An der Kasse und direkt neben Apple Pay findest du Klarna: Bezahle per Rechnung (später), in Raten oder sofort. Klarna prüft die Zahlung in wenigen Sekunden. Alternativ zahlst du mit ${payNames()}.`:`Kauf auf Rechnung ist derzeit nicht möglich. Du bezahlst sofort und sicher mit ${payNames()} und bekommst den Code direkt per E-Mail.`}},
  {q:"Bekomme ich eine Rechnung oder einen Beleg?",a:"Ja. Nach dem Kauf bekommst du eine Bestellbestätigung per E-Mail, und alle Bestellungen stehen mit Betrag und Datum in deinem Kundenkonto. Brauchst du eine Rechnung mit Firmenangaben, schreib uns einfach."},
  {q:"Wie aktiviere ich einen Spiele-Key?",a:"Auf der Produktseite unter „Einlösen“ steht der genaue Weg für die jeweilige Plattform, zum Beispiel Steam, PlayStation Store, Microsoft Store oder Nintendo eShop."},
  {q:"Kann ich Guthaben für Freunde im Ausland kaufen?",a:"Ja. Wähle das Land deiner Freundin oder deines Freundes als Empfängerland und gib die Handynummer ein."}
];


function flag(code,s){
  s=s||24;
  var stripes="";
  for(var i=0;i<7;i++){stripes+='<rect y="'+(i*2*24/13).toFixed(2)+'" width="24" height="'+(24/13).toFixed(2)+'" fill="#B22234"/>'}
  var G={
    DE:'<rect width="24" height="8" fill="#000"/><rect y="8" width="24" height="8" fill="#DD0000"/><rect y="16" width="24" height="8" fill="#FFCE00"/>',
    AT:'<rect width="24" height="24" fill="#ED2939"/><rect y="8" width="24" height="8" fill="#fff"/>',
    NL:'<rect width="24" height="8" fill="#AE1C28"/><rect y="8" width="24" height="8" fill="#fff"/><rect y="16" width="24" height="8" fill="#21468B"/>',
    FR:'<rect width="8" height="24" fill="#002395"/><rect x="8" width="8" height="24" fill="#fff"/><rect x="16" width="8" height="24" fill="#ED2939"/>',
    CH:'<rect width="24" height="24" fill="#D52B1E"/><rect x="10" y="5" width="4" height="14" fill="#fff"/><rect x="5" y="10" width="14" height="4" fill="#fff"/>',
    TR:'<rect width="24" height="24" fill="#E30A17"/><circle cx="9.5" cy="12" r="5" fill="#fff"/><circle cx="11" cy="12" r="4" fill="#E30A17"/><circle cx="15.5" cy="12" r="1.3" fill="#fff"/>',
    GB:'<rect width="24" height="24" fill="#012169"/><path d="M0 0L24 24M24 0L0 24" stroke="#fff" stroke-width="4.5"/><path d="M0 0L24 24M24 0L0 24" stroke="#C8102E" stroke-width="1.8"/><path d="M12 0v24M0 12h24" stroke="#fff" stroke-width="7"/><path d="M12 0v24M0 12h24" stroke="#C8102E" stroke-width="4"/>',
    US:'<rect width="24" height="24" fill="#fff"/>'+stripes+'<rect width="11" height="13" fill="#3C3B6E"/>'
  };
  return '<svg class="flag" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" aria-hidden="true"><g clip-path="url(#fclip)">'+(G[code]||G.DE)+'</g></svg>';
}


const CCOL=Object.fromEntries(CATS.map(c=>[c.id,c.col]));
const CATSV=()=>CATS.filter(c=>BRANDS.some(b=>b.cat===c.id&&(typeof isActiveB!=="function"||isActiveB(b))));
const byId=id=>BY.get(id), catById=id=>CATS.find(c=>c.id===id)||CATS[0];
refreshPicks();
const isRep=b=>REP.has(b.id);
var VISC=null,GRPN=null;const VIS=()=>VISC||(VISC=BRANDS.filter(isRep));
const variants=b=>b.grp?BRANDS.filter(x=>x.grp===b.grp):[b];
const isKey=b=>!!b&&b.type==="key";
const DEALS=()=>VIS().filter(b=>b.disc>0&&price(b,b.from)<b.from);
const dedupeGrp=list=>{const seen=new Set();return list.filter(b=>{const k=b.grp||b.id;if(seen.has(k))return false;seen.add(k);return true})};
const optLabel=(b,a)=>(b&&b.labels&&b.labels[b.amts.indexOf(a)])||money(a);
const REGION={DE:"Deutschland",EU:"Europa",TR:"Türkei"};
let STOCK=BOOT.stock||{soldout:{}};
const soldOut=(id,a)=>!!(STOCK.soldout[id]&&STOCK.soldout[id].includes(a));
const allSold=b=>b.cat!=="topup"&&b.amts.every(a=>soldOut(b.id,a));
const OPS={DE:{telekom:"151 160 170 171 175",vodafone:"152 162 172 173 174",o2:"155 157 159 163 176 177 178 179"}};

/* ---------- state ---------- */
const KEY="instacode_v1";
const S=Object.assign({country:"DE",cart:[],user:null,orders:[],favs:[],recent:[],numbers:[],cards:[],cookie:null,theme:"system",notif:{deals:true,alerts:false},promo:0,news:false},(()=>{try{return JSON.parse(localStorage.getItem(KEY))||{}}catch(e){return {}}})());
const cleanCart=()=>{if(BRANDS.length)S.cart=S.cart.filter(i=>{const b=byId(i.id);return b&&b.amts.includes(+i.a)})};
cleanCart();
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const ctry=()=>COUNTRIES.find(c=>c.c===S.country)||COUNTRIES[0];
const EURF=new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"});const money=eur=>EURF.format(eur);
const flagE=c=>{c=String(c||"").toLowerCase();return /^[a-z]{2}$/.test(c)?`<img class="flg" src="/img/mark/flag/${c}-4x3.svg" alt="" loading="lazy">`:""};
const grpSize=b=>{if(!b||!b.grp)return 1;if(!GRPN){GRPN=new Map();BRANDS.forEach(x=>{if(x.grp)GRPN.set(x.grp,(GRPN.get(x.grp)||0)+1)})}return GRPN.get(b.grp)||1};
const regDE=c=>{try{return c&&c.length===2?new Intl.DisplayNames(["de"],{type:"region"}).of(c):c}catch(e){return c}};
const regTag=b=>b&&b.rl&&b.region&&!["DE","AT","EU"].includes(b.region)?` · ${regDE(b.region)}`:"";
/* Endpreis inkl. MwSt. – gleiche Rechnung wie auf dem Server (Cent-genau) */
const VATR=()=>{try{return +CFG.vat||0}catch(e){return 0}},FEEC=()=>{try{return +CFG.fee||0}catch(e){return 0}};
const unitC=(b,a)=>{if(!b)return 0;const n=Math.round((b.px&&b.px[a]!=null?b.px[a]:a)*100);return Math.round(n*(100+VATR())/100)};
const price=(b,a)=>unitC(b,a)/100;
const feeTxt=()=>FEEC()?money(FEEC()/100):"";
const taxHint=()=>`inkl. ${VATR()?String(VATR()).replace(".",",")+" % ":""}MwSt.${FEEC()?` · zzgl. ${feeTxt()} Servicegebühr pro Bestellung`:""}`;
const FLAME='<svg class="hb-fl" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="flg" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FF3D00"/><stop offset=".6" stop-color="#FF8A00"/><stop offset="1" stop-color="#FFD54A"/></linearGradient></defs><path fill="url(#flg)" d="M12 2c.6 3.2 2.6 5 4.2 6.9C17.8 10.8 19 12.6 19 15a7 7 0 0 1-14 0c0-2.3 1-4.1 2.4-5.4.2 1.6.9 2.8 2.1 3.4C9 9.2 10.3 5.2 12 2z"/><path fill="#FFE9A8" d="M12 13c.3 1.4 1.3 2.2 1.9 3 .4.6.6 1.1.6 1.8a2.5 2.5 0 0 1-5 0c0-1 .5-1.9 1.3-2.5.1.6.4 1 .9 1.2C11.5 15.2 11.6 14.2 12 13z"/></svg>';
const mini=b=>b&&b.art?`<span class="mini-gc" aria-hidden="true">${gc(b,{tilt:false,badge:false})}</span>`:`<span class="mini" style="background:${b.bg};color:${b.fg}" aria-hidden="true">${esc(b.ini)}</span>`;
const initials=n=>String(n||"?").split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();

/* ---------- toast ---------- */
let toastT;
function toast(msg,link){const t=$("#toast");t.innerHTML=`<span>${esc(msg)}</span>${link?`<a href="${link[0]}">${esc(link[1])}</a>`:""}`;t.classList.add("show");clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove("show"),2800)}

/* ---------- cart ---------- */
const cartCount=()=>S.cart.reduce((s,i)=>s+i.q,0);
const lineTotal=i=>price(byId(i.id),i.a)*i.q;
const subTotal=()=>S.cart.reduce((s,i)=>s+lineTotal(i),0);
const itemsC=()=>S.cart.reduce((s,i)=>s+Math.round(unitC(byId(i.id),i.a)*(1-(S.promo||0)))*i.q,0);
const promoAmt=()=>subTotal()-itemsC()/100;
const feeAmt=()=>S.cart.length?FEEC()/100:0;
const grandTotal=()=>S.cart.length?(itemsC()+FEEC())/100:0;
const vatAmt=()=>{const g=Math.round(grandTotal()*100),v=VATR();return v?Math.round(g-g*100/(100+v))/100:0};
const vatRow=()=>VATR()&&S.cart.length?`<div class="sumrow vatrow"><span>darin ${String(VATR()).replace(".",",")} % MwSt.</span><span>${money(vatAmt())}</span></div>`:"";
function updBadges(anim){
  const n=cartCount();
  $$("[data-cart]").forEach(b=>{b.textContent=n||"";b.dataset.n=n;if(anim&&!reduce){b.classList.remove("bump");void b.offsetWidth;b.classList.add("bump")}});
}
function addCart(item,silent){
  const same=!item.gift&&S.cart.find(x=>x.id===item.id&&x.a===item.a&&(x.phone||"")===(item.phone||"")&&!x.gift);
  if(same)same.q=Math.min(10,same.q+item.q);
  else S.cart.push(Object.assign({k:Date.now().toString(36)+Math.random().toString(36).slice(2,6),q:1},item));
  save();updBadges(true);
  if(!silent){if(matchMedia("(min-width:768px)").matches&&typeof A.cartOpen==="function")A.cartOpen();else toast(`${byId(item.id).name} im Warenkorb`,["/warenkorb","Ansehen"])}
}

/* ---------- reveal ---------- */
const rio="IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(en=>{if(en.isIntersecting){en.target.classList.add("in");rio.unobserve(en.target)}}),{threshold:0,rootMargin:"0px 0px 20% 0px"}):null;
const reveal=root=>$$(".rv:not(.in)",root).forEach(el=>rio?rio.observe(el):el.classList.add("in"));
