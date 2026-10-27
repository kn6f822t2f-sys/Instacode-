/* ---------- global events + effects ---------- */
document.addEventListener("click",e=>{
  const el=e.target.closest("[data-a]");
  if(el){const fn=A[el.dataset.a];if(fn){if(el.tagName==="BUTTON")e.preventDefault();fn(el.dataset.v,el,e)}return}
  if(e.target===$("#scrim"))closeSheet();

});
document.addEventListener("keydown",e=>{
  const typing=/^(INPUT|TEXTAREA|SELECT)$/.test((e.target&&e.target.tagName)||"")||(e.target&&e.target.isContentEditable);
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("#pal").classList.contains("open")?palClose():A.palOpen();return}
  if(e.key==="/"&&!typing){e.preventDefault();A.palOpen();return}
  if(e.key!=="Escape")return;
  if($("#pal").classList.contains("open"))palClose();else if($("#drawer").classList.contains("open"))A.cartClose();else if($("#scrim").classList.contains("open"))closeSheet();else if($("#menu").classList.contains("open"))closeMenu();else if(chat.open)chatClose()});
const hdr=$("#hdr");let tk=false;
document.addEventListener("pointerdown",e=>{if(reduce)return;const b=e.target.closest(".btn");if(!b)return;const r=b.getBoundingClientRect(),d=Math.max(r.width,r.height)*2.2,s=document.createElement("span");s.className="rip";s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`;b.appendChild(s);setTimeout(()=>s.remove(),650)},{passive:true});
const LITE=document.documentElement.classList.contains("lite");let BGC=null,BGF=null,svT=null,sv=0,ly=0;
addEventListener("scroll",()=>{if(tk)return;tk=true;requestAnimationFrame(()=>{const y=scrollY,h=document.documentElement.scrollHeight-innerHeight,pr=h>0?Math.min(1,y/h).toFixed(4):"0";
  hdr.classList.toggle("scrolled",y>8);
  if(!reduce&&!LITE){parUpdate();BGC=BGC&&BGC.isConnected?BGC:document.getElementById("bgcards");BGF=BGF||document.querySelector(".bgfx");
    if(BGF)BGF.style.setProperty("--sp",pr);
    if(BGC){BGC.style.setProperty("--sp",pr);BGC.style.setProperty("--sy",Math.round(y));const v=y-(ly||y);ly=y;sv=Math.max(-40,Math.min(40,sv*.6+v*.4));BGC.style.setProperty("--sv",sv.toFixed(2));
      clearTimeout(svT);svT=setTimeout(function decay(){sv*=.75;BGC.style.setProperty("--sv",sv.toFixed(2));if(Math.abs(sv)>.05)svT=setTimeout(decay,40)},80)}}
  tk=false})},{passive:true});
addEventListener("resize",()=>requestAnimationFrame(parUpdate),{passive:true});

/* ---------- Vertrauensleiste: auf kleinen Bildschirmen nacheinander ---------- */
(()=>{const li=$$("#trustbar li");let i=0;if(reduce||li.length<2)return;setInterval(()=>{if(innerWidth>=900||document.hidden)return;const a=li[i];i=(i+1)%li.length;a.classList.remove("on");a.classList.add("out");li[i].classList.remove("out");li[i].classList.add("on");setTimeout(()=>a.classList.remove("out"),600)},3600)})();

/* ---------- start ---------- */
applyTheme();updBadges();renderAcc();renderFooter();boot();

if(!S.cookie)setTimeout(cookieShow,1600);
setTimeout(nudgeShow,12000);
})();
