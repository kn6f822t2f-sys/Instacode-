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
const hdr=$("#hdr"),bgfx=$("#bgfx");let tk=false;
/* Kopfzeile: Lesefortschritt (--sp) und Hintergrund-Ebene (--sy, Parallax beim Scrollen) – nur an diesen zwei Elementen gesetzt, damit nicht die ganze Seite neu berechnet wird */
const scrollFx=()=>{const y=scrollY,max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
  hdr.style.setProperty("--sp",Math.min(1,y/max).toFixed(4));if(bgfx&&!reduce)bgfx.style.setProperty("--sy",Math.round(y))};
addEventListener("scroll",()=>{if(tk)return;tk=true;requestAnimationFrame(()=>{hdr.classList.toggle("scrolled",scrollY>8);scrollFx();if(!reduce)parUpdate();tk=false})},{passive:true});
/* Lichtkante der Kopfzeile folgt dem Zeiger */
hdr.addEventListener("pointermove",e=>{if(e.pointerType!=="mouse")return;const r=hdr.getBoundingClientRect();hdr.style.setProperty("--hx",Math.round(e.clientX-r.left)+"px")},{passive:true});
hdr.addEventListener("pointerleave",()=>hdr.style.removeProperty("--hx"));
/* Logo in der Kopfzeile: lebendiger Chrom-Ring (auf Touch-Geräten das Standbild – spart einen WebGL-Kontext) */
if(!document.documentElement.classList.contains("lite"))LIQUID.mount(hdr);
addEventListener("resize",()=>requestAnimationFrame(parUpdate),{passive:true});

/* ---------- Vertrauensleiste: auf kleinen Bildschirmen nacheinander ---------- */
/* Auf dem Handy zeigt die Leiste die Zahlungsarten fest (.tb-pm), die Texte wechseln nur ohne diese Zeile */
(()=>{const li=$$("#trustbar li:not(.tb-pm)");let i=0;if(reduce||li.length<2||$("#trustbar .tb-pm"))return;setInterval(()=>{if(innerWidth>=900||document.hidden)return;const a=li[i];i=(i+1)%li.length;a.classList.remove("on");a.classList.add("out");li[i].classList.remove("out");li[i].classList.add("on");setTimeout(()=>a.classList.remove("out"),600)},3600)})();

/* ---------- start ---------- */
applyTheme();updBadges();renderAcc();renderFooter();boot();scrollFx();
/* Bänder über der Fußzeile: echte Bewertungen und Markenlogos; nach jedem Seitenwechsel prüfen, ob die Seite eigene Bewertungen zeigt */
setTimeout(()=>{reviewBand();logoStrip();payBand()},600);
payTop();{let w=innerWidth;addEventListener("resize",()=>{if((w<900)!==(innerWidth<900)){w=innerWidth;payTop()}},{passive:true})}
new MutationObserver(()=>requestAnimationFrame(bandsVis)).observe(app,{childList:true});

/* Design-Vorschau für den Admin (/?design=<nr>): Farben und Startseiten-Texte eines Entwurfs nur in diesem Tab anwenden */
(()=>{const id=new URLSearchParams(location.search).get("design");if(!/^\d{1,9}$/.test(id||""))return;
  fetch("/api/admin/agents/design/"+id+"/preview",{credentials:"same-origin",headers:{"X-IC":"1"}}).then(r=>r.ok?r.json():null).then(j=>{if(!j)return;
    const st=document.createElement("style");st.textContent=":root{"+Object.entries(j.tokens||{}).filter(([k,v])=>/^--[a-z0-9-]+$/.test(k)&&!/[;{}<]/.test(v)).map(([k,v])=>k+":"+v).join(";")+"}";document.head.appendChild(st);
    HERO_PV=j.hero||{};const bar=document.createElement("div");bar.className="dpv";bar.setAttribute("role","status");
    bar.innerHTML=`<b>Vorschau:</b> ${esc(j.name||"Design-Entwurf")} <span>Nur du siehst das. Veröffentlichen im Admin unter KI-Agenten.</span>`;document.body.appendChild(bar);route(true)}).catch(()=>{})})();
if(!S.cookie)setTimeout(cookieShow,1600);
setTimeout(nudgeShow,12000);
})();
