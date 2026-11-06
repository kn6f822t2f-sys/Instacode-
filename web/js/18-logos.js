/* ---------- Kategorie-Logos: echte Marken statt Symbol-Kacheln ----------
   kLogos(cat,n,cls) liefert einen kleinen Stapel runder Glasplaketten mit den offiziellen Zeichen der bekanntesten Marken der Kategorie.
   Rund passen nur kompakte Zeichen: zuerst das Simple-Icons-Symbol (si), sonst ein Logo mit Seitenverhältnis bis 1,9. Breite Schriftzüge
   (z. B. „amazon“) fallen weg, statt winzig zu werden. Reihenfolge: kuratierte Liste je Kategorie, danach Beliebtheit. */
const CATLOGO={topup:["telekom","vodafone","o2"],keys:["steam","psn","nso","ea","ubisoft"],gaming:["steam","psn","ea","epic","battlenet","razer"],
  currency:["fortnite","roblox","valorant","lol","pubg"],subs:["gpu","psplus-essential","nso","nitro"],apps:["apple","gplay","m365p"],
  entertainment:["netflix","spotify","disney","dazn","twitch"],shopping:["zalando","ikea","nike","otto","uber"],software:["m365p","nordvpn","kaspersky","norton"],
  payment:["paysafe","visa","mastercard"]};
const ORBLOGO=["steam","netflix","psn","spotify","apple","fortnite","valorant","gplay","roblox","twitch"];
const kMarkOk=b=>!!(b&&(b.si||(b.logo&&b.lar&&b.lar<=1.9)));
/* Zeichen für eine runde Plakette; px = Durchmesser der Plakette (nur für Logos mit festen Maßen) */
const kMark=(b,px=36)=>b.si?`<i class="km" style="--si:url(/logo/${b.si}.svg);--a:${SIA[b.si]||1};color:${brandInk(b)}"></i>`
  :brandMark(b,px*px*.21,px*.72,px*.56,"km");
const kPick=(cat,n)=>{const seen=new Set(),out=[];
  const add=b=>{if(out.length>=n||!kMarkOk(b))return;const k=b.si||b.logo;if(seen.has(k))return;seen.add(k);out.push(b)};
  (CATLOGO[cat]||[]).forEach(id=>add(byId(id)));
  if(out.length<n){const best=id=>{const i=BEST0.indexOf(id);return i<0?99:i};VIS().filter(b=>b.cat===cat).sort((a,b)=>best(a.id)-best(b.id)||(b.hot?1:0)-(a.hot?1:0)).forEach(add)}
  return out};
const kLogos=(cat,n=3,cls="kb-lg",px=36)=>{const l=kPick(cat,n);return l.length?`<span class="klg ${cls}" aria-hidden="true">${l.map((b,i)=>`<span class="kl" style="--i:${i}">${kMark(b,px)}</span>`).join("")}</span>`:""};
/* Zahl der Spiele: Plattform-Varianten eines Spiels zählen einmal */
const catCount=id=>{const l=BRANDS.filter(b=>b.cat===id);return id==="keys"?new Set(l.map(b=>b.grp||b.id)).size:l.length};
