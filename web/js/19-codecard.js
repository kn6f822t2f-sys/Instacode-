/* ---------- Code-Karte im Hero (Konzept „Silberstreifen“) ----------
   Eine echte Gutscheinkarte (gc) einer Top-Marke liegt schräg vor dem Chrom-Ring: Steam, PlayStation und Amazon im Wechsel je Besuch.
   Auf der Karte: Markenlogo, ein Betrag, den die Marke wirklich anbietet (25 € oder der nächstliegende), und der Silberstreifen.
   Einmal je Seitenaufruf, sobald die Karte im Bild ist: Sie gleitet aus dem Ring (nur transform/opacity, ~700 ms), dann wird die
   Folie im Zickzack weggerubbelt (~1,1 s) und ein Beispielcode erscheint – immer mit der Beschriftung „Beispielcode“.
   Maus: Klick legt die Folie wieder auf, dann rubbelt der Zeiger sie frei. Touch: Tippen spielt die Szene erneut ab;
   Scrollen bleibt frei (touch-action:pan-y, kein preventDefault). Eine Leinwand, requestAnimationFrame nur während der Animation,
   bei reduzierter Bewegung sofort der Endzustand. Rein dekorativ (aria-hidden), der Code ist kein echter Code. */
const CC_IDS=["steam","psn","amazon"],CC_CODE="X7KQ-29DM-RT4P";
const CC_I=(()=>{let i=0;try{i=parseInt(localStorage.getItem("ic_cc"),10)||0;localStorage.setItem("ic_cc",String((i+1)%CC_IDS.length))}catch(e){}return i})();
let ccSeen=false;
/* Zeit der Dokument-Zeitleiste: läuft wie CSS-Animationen (auch wenn sie für Aufnahmen verlangsamt wird) */
const ccNow=()=>{const t=document.timeline&&document.timeline.currentTime;return t!=null?+t:performance.now()};
const ccAmt=b=>b.amts.includes(25)?25:b.amts.slice().sort((x,y)=>Math.abs(x-25)-Math.abs(y-25)||x-y)[0];
function codeCard(){
  const l=CC_IDS.map(byId).filter(Boolean),b=l.length?l[CC_I%l.length]:VIS().find(x=>!isKey(x)&&x.logo);if(!b)return "";
  return `<div class="cc${ccSeen||reduce?" done":""}" data-cc aria-hidden="true"><div class="cc-tilt">${gc(b,{tilt:false,badge:false,plat:false,cls:"cc-gc",amt:`${ccAmt(b)} €`,
    extra:`<span class="cc-strip"><span class="cc-code">${CC_CODE}</span><canvas class="cc-foil" width="1" height="1"></canvas></span>`})}<span class="cc-cap">Beispielcode</span></div></div>`;
}
/* Folie: Silber (105°) mit leichtem Holo-Hauch (115°) und feiner Riffelung wie auf echter Rubbelfolie */
const CC_FOIL=[[0,"#D7DCE3"],[.28,"#F7F9FB"],[.5,"#BFC6CF"],[.68,"#EEF1F5"],[1,"#C9CFD7"]];
const CC_HOLO=[[0,"rgba(255,155,210,.28)"],[.4,"rgba(143,227,255,.28)"],[.75,"rgba(255,228,143,.28)"],[1,"rgba(255,228,143,.14)"]];
function ccMount(root){
  const el=$("[data-cc]",root);if(!el||el._cc)return;el._cc=1;
  const strip=$(".cc-strip",el),cv=$(".cc-foil",el),tilt=$(".cc-tilt",el);
  const ctx=cv.getContext&&cv.getContext("2d");
  const fine=matchMedia("(hover:hover) and (pointer:fine)").matches;
  let W=1,H=1,D=1,raf=0,state="open",work=0,last=null,idle=0;
  const grad=(deg,stops)=>{const a=deg*Math.PI/180,dx=Math.sin(a),dy=-Math.cos(a),L=Math.abs(W*dx)+Math.abs(H*dy),g=ctx.createLinearGradient(W/2-dx*L/2,H/2-dy*L/2,W/2+dx*L/2,H/2+dy*L/2);stops.forEach(([o,c])=>g.addColorStop(o,c));return g};
  const size=()=>{D=Math.min(devicePixelRatio||1,2);const w=Math.max(1,Math.round(strip.offsetWidth*D)),h=Math.max(1,Math.round(strip.offsetHeight*D));if(w!==cv.width||h!==cv.height){cv.width=w;cv.height=h}W=w;H=h};
  const paint=()=>{size();ctx.globalCompositeOperation="source-over";ctx.globalAlpha=1;ctx.clearRect(0,0,W,H);
    ctx.fillStyle=grad(105,CC_FOIL);ctx.fillRect(0,0,W,H);ctx.fillStyle=grad(115,CC_HOLO);ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=.09;ctx.strokeStyle="#5F6874";ctx.lineWidth=D;ctx.beginPath();for(let x=-H;x<W;x+=3*D){ctx.moveTo(x,H);ctx.lineTo(x+H*.55,0)}ctx.stroke();ctx.globalAlpha=1;
    el.classList.remove("open");cv.classList.remove("gone")};
  const finish=()=>{cancelAnimationFrame(raf);raf=0;state="open";el.classList.remove("scratch");el.classList.add("open");cv.classList.add("gone");setTimeout(()=>{if(state==="open")ctx.clearRect(0,0,W,H)},320)};
  const brush=()=>{ctx.globalCompositeOperation="destination-out";ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=H*.8};
  /* Zickzack von links nach rechts, gleichmäßig über die Streckenlänge verteilt */
  const auto=(dur=1100)=>{cancelAnimationFrame(raf);paint();state="auto";brush();
    const n=7,pad=H*.3,P=[];for(let i=0;i<=n;i++)P.push([pad+(W-2*pad)*i/n,i%2?H*.8:H*.2]);
    const seg=[];let tot=0;for(let i=1;i<P.length;i++){const d=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);seg.push(d);tot+=d}
    const at=s=>{let i=0;while(i<seg.length-1&&s>seg[i]){s-=seg[i];i++}const k=Math.min(1,s/seg[i]);return [P[i][0]+(P[i+1][0]-P[i][0])*k,P[i][1]+(P[i+1][1]-P[i][1])*k]};
    let done=0;const t0=ccNow();
    const step=()=>{const k=Math.min(1,(ccNow()-t0)/dur),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2,to=tot*e;
      if(to>done){ctx.beginPath();let p=at(done);ctx.moveTo(p[0],p[1]);for(let s=done+3*D;s<to;s+=3*D){p=at(s);ctx.lineTo(p[0],p[1])}p=at(to);ctx.lineTo(p[0],p[1]);ctx.stroke();done=to}
      if(k<1)raf=requestAnimationFrame(step);else{raf=0;setTimeout(()=>{if(state==="auto")finish()},260)}};
    raf=requestAnimationFrame(step)};
  if(!ctx){el.classList.add("done","open");return}
  /* Auftritt nur beim ersten Erscheinen in diesem Seitenaufruf; danach (und bei reduzierter Bewegung) sofort der Endzustand */
  if(el.classList.contains("done"))el.classList.add("open");
  else{paint();state="intro";el.classList.add("pre");
    /* kurzer Atemzug nach dem Aufbau der Seite, dann Auftritt; Rubbeln erst, wenn die Karte liegt (Ersatz-Zeitgeber ab Animationsbeginn) */
    const run=()=>{if(ccSeen)return;ccSeen=true;setTimeout(()=>{if(!el.isConnected)return;el.classList.remove("pre");el.classList.add("go");
      let t=0,fb=0;const next=()=>{if(t)return;t=1;clearTimeout(fb);auto()};
      el.addEventListener("animationstart",()=>{clearTimeout(fb);fb=setTimeout(next,1000)},{once:true});
      el.addEventListener("animationend",next,{once:true});fb=setTimeout(next,2000)},280)};
    /* sobald die Karte zur Hälfte im Bild ist */
    if("IntersectionObserver" in window){const io=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){io.disconnect();run()}},{threshold:.5});io.observe(el)}else run()}
  if(reduce)return;
  /* Zeigerposition → Leinwand (die Karte ist gedreht: Drehung aus der berechneten Transformation zurückrechnen) */
  const local=e=>{const r=strip.getBoundingClientRect(),m=new DOMMatrixReadOnly(getComputedStyle(tilt).transform),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),c=m.a,s=m.b,n=Math.hypot(c,s)||1;
    return [((dx*c+dy*s)/n+strip.offsetWidth/2)*D,((-dx*s+dy*c)/n+strip.offsetHeight/2)*D]};
  el.addEventListener("click",()=>{if(state==="auto"||state==="intro")return;
    if(!fine){auto();return}
    if(state==="open"){paint();state="scratch";work=0;last=null;el.classList.add("scratch")}});
  if(fine){
    el.addEventListener("pointermove",e=>{if(state!=="scratch"||e.pointerType!=="mouse")return;clearTimeout(idle);const p=local(e);
      if(p[0]<-H||p[1]<-H||p[0]>W+H||p[1]>H*2){last=null;return}
      brush();ctx.beginPath();ctx.moveTo((last||p)[0],(last||p)[1]);ctx.lineTo(p[0],p[1]);ctx.stroke();
      if(last)work+=Math.hypot(p[0]-last[0],p[1]-last[1]);last=p;if(work>W*2.4)finish()});
    /* Folie nie verdeckt liegen lassen: ohne Rubbeln deckt sich der Code nach kurzer Zeit von selbst auf */
    el.addEventListener("pointerleave",()=>{last=null;if(state!=="scratch")return;clearTimeout(idle);idle=setTimeout(()=>{if(state==="scratch"){el.classList.remove("scratch");auto(900)}},1400)});
  }
}
