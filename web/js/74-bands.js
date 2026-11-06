/* ---------- Bänder über der Fußzeile (auf jeder Seite) ----------
   reviewBand()  echte Bewertungen als Endlos-Band (rcard aus 70-reviews-chat.js). Erst ab 3 Bewertungen –
                 vorher ein ehrlicher Hinweis mit Trustpilot-Link, keine erfundenen Stimmen. Auf Seiten mit eigener
                 Bewertungsfläche (#revSec sichtbar) bleibt das Band aus, damit nichts doppelt steht.
   logoStrip()   Marken mit offiziellem Logo oder Markenzeichen als Laufband, jedes Logo führt zum Produkt.
   Beide laufen nur, solange sie sichtbar sind (data-off), und stehen bei reduzierter Bewegung still. */
async function reviewBand(){
  const el=$("#rband");if(!el||el.dataset.on)return;el.dataset.on="1";
  try{REV=REV||await API("/reviews")}catch(e){return}
  const R=REV||{count:0,items:[]};
  if(R.count>=3&&R.items&&R.items.length){
    const cards=R.items.slice(0,12).map((r,i)=>rcard(r,i,{in:true})).join("");
    el.innerHTML=`<div class="rb-head"><div><h2 class="h2">Was Kundinnen und Kunden sagen</h2><p class="rb-sum">${stars(R.avg)}<b>${revAvg(R.avg)}</b> von 5 · ${R.count} ${R.count===1?"Bewertung":"Bewertungen"} · nur echte Käufe</p></div>${tpLink()}</div>
<div class="rb-row" data-off><div class="rb-track"><div class="rb-set">${cards}</div><div class="rb-set" aria-hidden="true" inert>${cards}</div></div></div>`;
  }else{
    el.classList.add("rb-empty");
    el.innerHTML=`<div class="rb-in"><span class="rb-stars" aria-hidden="true">${[1,2,3,4,5].map(i=>`<i style="--i:${i}">★</i>`).join("")}</span><div class="rb-t"><b>Bewertungen nur von echten Käufen</b><span>Bewerten kann nur, wer bei uns bestellt und den Code erhalten hat. Die ersten Bewertungen erscheinen bald hier.</span></div>${tpLink({text:"Auf Trustpilot bewerten"})}</div>`;
  }
  el.hidden=false;bandsVis();if(typeof offIO!=="undefined"&&offIO)$$("[data-off]",el).forEach(x=>offIO.observe(x));
}
function logoStrip(){
  const el=$("#lgstrip");if(!el||el.dataset.on)return;
  const seen=new Set(),lite=document.documentElement.classList.contains("lite");
  const all=VIS().filter(b=>!isKey(b)&&hasMark(b)&&!seen.has(b.logo||b.si)&&seen.add(b.logo||b.si));
  /* Kategorien im Wechsel, damit Gaming, Shopping, Prepaid, Streaming und Mobilfunk gemischt laufen */
  const by={};all.forEach(b=>(by[b.cat]=by[b.cat]||[]).push(b));const cs=Object.keys(by),mix=[];
  for(let i=0;mix.length<all.length;i++)cs.forEach(c=>{if(by[c][i])mix.push(by[c][i])});
  const list=mix.slice(0,lite?22:34);
  if(list.length<10)return;el.dataset.on="1";
  const set=list.map(b=>`<a class="ls-i" href="/marke/${b.id}" aria-label="${esc(b.name)}" style="color:${brandInk(b)}">${brandMark(b,760,96,28,"ls-m")}</a>`).join("");
  el.innerHTML=`<div class="ls-head"><span>Marken im Sortiment</span><a class="more" href="/kategorien">Alle ${VIS().length} Produkte${ic("i-chev")}</a></div><div class="ls-row" data-off><div class="ls-track"><div class="ls-set">${set}</div><div class="ls-set" aria-hidden="true" inert>${set}</div></div></div>`;
  el.hidden=false;if(typeof offIO!=="undefined"&&offIO)$$("[data-off]",el).forEach(x=>offIO.observe(x));
}
/* Band aus, wenn die Seite selbst Bewertungen zeigt */
function bandsVis(){const el=$("#rband");if(!el||!el.dataset.on)return;const own=$("#revSec:not([hidden]),.rvs:not([hidden])",app);el.hidden=!!own}
/* ---------- Zahlungsarten: echte Zeichen der Anbieter, oben in der Leiste und als Band über der Fußzeile ----------
   Gezeigt wird nur, was der Shop gerade wirklich anbietet: payLogos() liest CFG.methods (vom Server aus der
   Stripe-Konfiguration ermittelt) und CFG.klarna (nur wenn Klarna aktiv ist, mit den erlaubten Kategorien).
   Passen die Zeichen oben auf dem Handy nicht in eine Zeile, laufen sie als leises Band (eine Animation für alle). */
const joinDe=l=>l.length>1?l.slice(0,-1).join(", ")+" und "+l[l.length-1]:(l[0]||"");
function payTop(){
  const r=$("#trustbar .pm-row");if(!r)return;const li=r.closest(".tb-pm");
  /* Klarna oben nur, wenn es für alle Produkte gilt – die Einschränkung steht sonst im Band unten und auf der Produktseite */
  const kl={klarna:!klarnaScope()};
  r.innerHTML=payLogos(null,kl);li.classList.remove("mq");
  requestAnimationFrame(()=>{const pl=$(".paylogos",r);if(innerWidth<900&&pl&&pl.scrollWidth>r.clientWidth+2){
    const set=payLogos(null,kl);li.classList.add("mq");r.innerHTML=`<span class="pm-track">${set}${set}</span>`}});
  if(typeof offIO!=="undefined"&&offIO)offIO.observe(li);
}
function payBand(){
  const el=$("#pband");if(!el)return;
  const ex=WALLETS().map(k=>PM[k]&&PM[k][0]).filter(Boolean);
  el.innerHTML=`<div class="pb-in">
  <div class="pb-t"><h2 class="h3" id="pbH">Bezahlen, wie du willst</h2>
   <p>${ex.length?`Express-Checkout mit ${joinDe(ex)}: Ein Tipp, fertig. `:""}Abgewickelt über Stripe, mit TLS-Verschlüsselung und 3&#8209;D&nbsp;Secure.</p></div>
  ${payLogos()}
</div>`;
  el.hidden=false;
}
