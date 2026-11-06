/* ---------- Bewegung ----------
   [data-words]  Satz hellt sich beim Scrollen Wort für Wort auf (--p 0…1 am Element, Wörter rechnen in CSS selbst)
   [data-count]  Zahl zählt beim Erscheinen hoch (Endwert steht schon im HTML)
   [data-scrub]  Scroll-Geschichte: Fortschritt --p, Schritt data-step, Video läuft mit dem Scrollen
   Alles nur transform/opacity, pausiert ohne Sichtbarkeit, entfällt bei reduzierter Bewegung. */
const MOTION=(()=>{
  const words=new Set();let wRaf=0;
  const wFrame=()=>{wRaf=0;const h=innerHeight;words.forEach(el=>{if(!el.isConnected){words.delete(el);return}const r=el.getBoundingClientRect();if(r.bottom<-50||r.top>h+50)return;
    const p=Math.max(0,Math.min(1,(h*.88-r.top)/(r.height+h*.42)));el.style.setProperty("--p",p.toFixed(3))})};
  const wKick=()=>{if(!wRaf&&words.size)wRaf=requestAnimationFrame(wFrame)};
  addEventListener("scroll",wKick,{passive:true});addEventListener("resize",wKick,{passive:true});
  const split=el=>{if(el.dataset.split)return;el.dataset.split=1;const t=el.textContent.trim().split(/\s+/);el.style.setProperty("--n",t.length);
    el.setAttribute("aria-label",el.textContent.trim());el.innerHTML=t.map((w,i)=>`<span class="w" style="--i:${i}" aria-hidden="true">${esc(w)}</span>`).join(" ")};
  /* Hochzählen */
  const fmt=n=>Math.round(n).toLocaleString("de-DE");
  const cIO="IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(en=>{if(!en.isIntersecting)return;const el=en.target;cIO.unobserve(el);
    const to=+el.dataset.count,t0=performance.now(),D=1500;const step=now=>{const k=Math.min(1,(now-t0)/D),e=1-Math.pow(2,-10*k);el.textContent=fmt(to*(k>=1?1:e));if(k<1)requestAnimationFrame(step)};requestAnimationFrame(step)}),{threshold:.6}):null;
  /* Scroll-Geschichte [data-scrub]: Fortschritt --p (0…1) und data-step am Element; ein enthaltenes Video
     (data-src) wird erst kurz vor dem Erscheinen geladen und läuft mit dem Scrollen vor und zurück */
  const scrubs=new Set();let sRaf=0;
  const sFrame=()=>{sRaf=0;const h=innerHeight;scrubs.forEach(el=>{if(!el.isConnected){scrubs.delete(el);return}
    const r=el.getBoundingClientRect();if(r.bottom<-h||r.top>2.5*h)return;
    const p=Math.max(0,Math.min(1,-r.top/Math.max(1,r.height-h)));el.style.setProperty("--p",p.toFixed(4));
    const st=String(p<.34?0:p<.68?1:2);if(el.dataset.step!==st)el.dataset.step=st;
    const v=el._v;if(!v)return;
    if(!v.getAttribute("src")&&r.top<2*h){v.src=v.dataset.src;v.preload="auto";v.load()}
    if(v.readyState>=1&&v.duration){const t=Math.min(v.duration-.04,p*v.duration);if(Math.abs(v.currentTime-t)>.025){try{v.currentTime=t}catch(e){}}}})};
  const sKick=()=>{if(!sRaf&&scrubs.size)sRaf=requestAnimationFrame(sFrame)};
  addEventListener("scroll",sKick,{passive:true});addEventListener("resize",sKick,{passive:true});
  const scrub=el=>{if(el._sc)return;el._sc=1;const v=el._v=$("video",el);
    if(v){v.muted=true;v.addEventListener("loadedmetadata",sKick);
      /* iOS zeigt Einzelbilder erst nach einmaligem Abspielen */
      v.addEventListener("loadeddata",()=>{const pr=v.play();pr&&pr.then(()=>{v.pause();sKick()}).catch(()=>{})},{once:true})}
    scrubs.add(el)};
  return {mount(root){
    $$("[data-scrub]",root).forEach(scrub);sKick();
    $$("[data-words]",root).forEach(el=>{split(el);if(reduce)el.style.setProperty("--p",1);else words.add(el)});wKick();
    $$("[data-count]",root).forEach(el=>{if(reduce||!cIO)return;el.textContent="0";cIO.observe(el)});
  }};
})();
