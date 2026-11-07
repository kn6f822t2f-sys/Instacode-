/* ---------- Lesbare Kategorie-Zeichen für die Index-Liste (Konzept „Silberstreifen“) ----------
   kLogosL(cat,n,cls) arbeitet wie kLogos (18-logos.js: gleiche kuratierte Reihenfolge CATLOGO, danach Beliebtheit), nimmt aber nur Zeichen,
   die in der runden Plakette lesbar bleiben: Plakette 34 px (Handy) bzw. 38 px (Desktop), Zeichen in einem Feld von 54 % Höhe und 74 % Breite.
   Von Simple-Icons-Zeichen (si, Seitenverhältnis SIA) und offiziellem Logo (logo, lar) zählt das kompaktere. Was dabei unter ~14 px Höhe fiele
   (breite Schriftzüge wie IKEA, VISA, Kaspersky, Disney+), fällt weg und die nächste Marke rückt nach. KM_TEXT: Logos, die fast nur aus
   kleiner Schrift bestehen. Größen in Prozent, damit die Zeichen mit der Plakette wachsen. Nur echte Markenzeichen, keine Ersatzsymbole. */
const KM_H=.54,KM_W=.74,KM_MIN=14,KM_S=34;
const KM_TEXT=new Set(["gpu"]);
const kmSrc=b=>{const s=b.si?{si:b.si,a:SIA[b.si]||1}:null,l=b.logo&&b.lar?{logo:b.logo,a:+b.lar}:null;return s&&l?(l.a<s.a-.05?l:s):(s||l)};
const kmOk=b=>{if(!b||KM_TEXT.has(b.id))return false;const m=kmSrc(b);return !!m&&Math.min(KM_H*KM_S,KM_W*KM_S/m.a)>=KM_MIN};
const kmMark=b=>{const m=kmSrc(b),h=Math.min(KM_H,KM_W/m.a),w=h*m.a,st=`width:${(w*100).toFixed(1)}%;height:${(h*100).toFixed(1)}%`;
  if(m.si)return `<i class="km bm" style="--si:url(/logo/${m.si}.svg);${st};color:${brandInk(b)}"></i>`;
  return b.ltn&&b.lc!=="light"?`<i class="km bm" style="--si:url(${m.logo});${st};color:${brandInk(b)}"></i>`:`<img class="km bm" src="${m.logo}" alt="" style="${st}" loading="lazy" decoding="async">`};
const kLogosL=(cat,n=3,cls="kb-lg")=>{const seen=new Set(),out=[];
  const add=b=>{if(out.length>=n||!kmOk(b))return;const k=kmSrc(b);const key=k.si||k.logo;if(seen.has(key))return;seen.add(key);out.push(b)};
  (CATLOGO[cat]||[]).forEach(id=>add(byId(id)));
  if(out.length<n){const best=id=>{const i=BEST0.indexOf(id);return i<0?99:i};VIS().filter(b=>b.cat===cat).sort((a,b)=>best(a.id)-best(b.id)||(b.hot?1:0)-(a.hot?1:0)).forEach(add)}
  return out.length?`<span class="klg ${cls}" aria-hidden="true">${out.map((b,i)=>`<span class="kl" style="--i:${i}">${kmMark(b)}</span>`).join("")}</span>`:""};
