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
