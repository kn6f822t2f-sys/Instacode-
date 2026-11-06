/* ---------- effects ---------- */
/* Bühnen und Laufband außerhalb des Bildschirms pausieren; sichtbare Bühnen bekommen Parallax */
const parVis=new Set();
const offIO="IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(en=>{const t=en.target;t.classList.toggle("off",!en.isIntersecting);if(t.hasAttribute("data-par")){if(en.isIntersecting)parVis.add(t);else parVis.delete(t)}}),{rootMargin:"120px 0px"}):null;
function parUpdate(){
  if(reduce||!parVis.size)return;
  const h=innerHeight,v=[];
  parVis.forEach(el=>{if(!el.isConnected){parVis.delete(el);return}const r=el.getBoundingClientRect();v.push([el,Math.max(-1.2,Math.min(1.2,((r.top+r.height/2)-h/2)/h))])});
  v.forEach(([el,y])=>el.style.setProperty("--sy",y.toFixed(3)));
}
function rails(root){
  $$(".rail-track",root).forEach(t=>{
    const btn=$$(`[data-a=railGo][data-v^="${t.id}|"]`);if(!btn.length)return;
    const upd=()=>{const max=t.scrollWidth-t.clientWidth-4;btn[0].disabled=t.scrollLeft<4;btn[1].disabled=t.scrollLeft>max};
    t.addEventListener("scroll",upd,{passive:true});upd();
  });
}
A.railGo=v=>{const p=v.split("|"),t=$("#"+p[0]);if(t)t.scrollBy({left:+p[1]*Math.max(220,t.clientWidth*.8),behavior:reduce?"auto":"smooth"})};
function fx(root){
  const h=$(".hero .h1",root);
  if(h&&!h.classList.contains("split")&&!reduce){
    let i=0;const wrap=(txt,cls)=>txt.split(/(\s+)/).map(w=>/^\s+$/.test(w)||!w?w:`<span class="w${cls?" "+cls:""}" style="--i:${i++}">${esc(w)}</span>`).join("");
    h.innerHTML=[...h.childNodes].map(n=>n.nodeType===3?wrap(n.textContent):n.nodeName==="BR"?"<br>":wrap(n.textContent,n.classList&&n.classList.contains("gt")?"gtw":"")).join("");
    h.classList.add("split");
  }
  if(offIO){if(root===app){offIO.disconnect();parVis.clear()}$$("[data-par],[data-off]",root).forEach(el=>offIO.observe(el))}
  rails(root);
  MOTION.mount(root);
  LIQUID.mount(root);
  requestAnimationFrame(parUpdate);
}
/* Maus: Karte neigt sich und glänzt, Bühnen folgen leicht dem Zeiger */
let ptr=null,ptrRaf=0,tiltEl=null;
const ptrFrame=()=>{
  ptrRaf=0;const e=ptr;if(!e)return;const t=e.target;if(!t||!t.closest)return;
  const card=t.closest(".gc.tilt");
  if(tiltEl&&tiltEl!==card){["--rx","--ry"].forEach(p=>tiltEl.style.removeProperty(p));tiltEl=null}
  if(card){const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
    card.style.setProperty("--ry",((x-.5)*14).toFixed(2)+"deg");card.style.setProperty("--rx",((.5-y)*12).toFixed(2)+"deg");
    card.style.setProperty("--gx",(x*100).toFixed(1)+"%");card.style.setProperty("--gy",(y*100).toFixed(1)+"%");tiltEl=card}
  const m=t.closest("[data-mouse]");
  if(m){const r=m.getBoundingClientRect();m.style.setProperty("--mx",(((e.clientX-r.left)/r.width-.5)*2).toFixed(3));m.style.setProperty("--my",(((e.clientY-r.top)/r.height-.5)*2).toFixed(3))}
};
if(!reduce&&matchMedia("(hover:hover) and (pointer:fine)").matches){
  document.addEventListener("pointermove",e=>{ptr=e;if(!ptrRaf)ptrRaf=requestAnimationFrame(ptrFrame)},{passive:true});
  document.addEventListener("pointerleave",()=>{if(tiltEl){["--rx","--ry"].forEach(p=>tiltEl.style.removeProperty(p));tiltEl=null}});
}
document.addEventListener("pointermove",e=>{if(e.pointerType!=="mouse")return;const c=e.target.closest&&e.target.closest(".card,.catcard,.qa,.spot,.step");if(!c)return;const r=c.getBoundingClientRect();c.style.setProperty("--mx",(e.clientX-r.left)+"px");c.style.setProperty("--my",(e.clientY-r.top)+"px")},{passive:true});
document.addEventListener("pointerdown",e=>{if(reduce)return;const b=e.target.closest&&e.target.closest(".btn,.chip,.amt,.qchip");if(!b)return;const r=b.getBoundingClientRect(),s=Math.max(r.width,r.height)*2,sp=document.createElement("span");sp.className="rip";sp.style.cssText=`width:${s}px;height:${s}px;left:${e.clientX-r.left-s/2}px;top:${e.clientY-r.top-s/2}px`;b.prepend(sp);setTimeout(()=>sp.remove(),650)},{passive:true});
/* ---------- Teilen, Link kopieren, Verschenken ---------- */
const prodUrl=id=>`${location.origin}/marke/${encodeURIComponent(id)}`;
async function copyText(t){try{await navigator.clipboard.writeText(t);return true}catch(e){const a=document.createElement("textarea");a.value=t;a.style.cssText="position:fixed;opacity:0";document.body.appendChild(a);a.select();let ok=false;try{ok=document.execCommand("copy")}catch(x){}a.remove();return ok}}
A.copyLink=async id=>{if(await copyText(prodUrl(id)))toast("Link kopiert – jetzt einfügen und teilen");else toast(prodUrl(id))};
A.share=id=>{const b=byId(id);if(!b)return;const url=prodUrl(id),text=`${b.name.replace(/ (Gift Card|Geschenkkarte)$/,"")} bei instantcodes – Code sofort per E-Mail`;
  const u=encodeURIComponent(url),t=encodeURIComponent(text),L=(k,f)=>`<img src="/img/mark/logos/${k}.svg" alt="" onerror="this.replaceWith(document.createTextNode('${f}'))">`;
  const opts=[["WhatsApp",`https://wa.me/?text=${t}%20${u}`,L("whatsapp-icon","W")],["Telegram",`https://t.me/share/url?url=${u}&text=${t}`,L("telegram","T")],["X",`https://twitter.com/intent/tweet?url=${u}&text=${t}`,L("x","X")],
    ["Facebook",`https://www.facebook.com/sharer/sharer.php?u=${u}`,L("facebook","f")],["Pinterest",`https://pinterest.com/pin/create/button/?url=${u}&description=${t}`,L("pinterest","P")],["Reddit",`https://www.reddit.com/submit?url=${u}&title=${t}`,L("reddit-icon","R")],
    ["E-Mail",`mailto:?subject=${t}&body=${u}`,ic("i-mail")],["SMS",`sms:?&body=${t}%20${u}`,ic("i-phone-f")]];
  openSheet(`<button class="x icon-btn" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button>
   <div class="sh-share"><div class="sh-prev">${gc(b,{tilt:false,badge:false})}<div><b>${esc(b.name)}</b><small>${esc(url.replace(/^https?:\/\//,""))}</small></div></div>
   ${navigator.share?`<button class="btn btn-primary btn-block btn-lg" data-a="shareNative" data-v="${esc(id)}">${ic("i-share")}Teilen über …</button>`:""}
   <div class="sh-grid">${opts.map(([n,h,i])=>`<a class="sh-opt" href="${h}" target="_blank" rel="noopener">${`<span>${i}</span>`}<small>${n}</small></a>`).join("")}</div>
   <button class="btn btn-soft btn-block" data-a="copyLink" data-v="${esc(id)}">${ic("i-copy")}Link kopieren</button></div>`)};
A.shareNative=id=>{const b=byId(id);navigator.share({title:`${b.name} – instantcodes`,text:`${b.name} bei instantcodes – Code sofort per E-Mail`,url:prodUrl(id)}).then(()=>closeSheet()).catch(()=>{})};
A.giftNow=()=>{const sw=$(".giftbox .switch");if(sw&&sw.getAttribute("aria-checked")!=="true")sw.click();const g=$(".giftbox");if(g)g.scrollIntoView({behavior:"smooth",block:"center"});setTimeout(()=>{const i=$("#gTo");i&&i.focus()},450)};

/* ---------- Liquid Glass: Linse fließt zwischen den Knöpfen einer Gruppe (Morphing), Lichtpunkt folgt dem Finger ---------- */
(function(){
  const lens=g=>{let l=g.querySelector(":scope>.lg-lens");if(!l){l=document.createElement("i");l.className="lg-lens";l.setAttribute("aria-hidden","true");g.prepend(l)}return l};
  const move=(g,t)=>{const l=lens(g),gr=g.getBoundingClientRect(),r=t.getBoundingClientRect();l.style.width=r.width+"px";l.style.height=r.height+"px";l.style.transform=`translate3d(${r.left-gr.left}px,${r.top-gr.top}px,0)`;l.classList.add("on")};
  document.addEventListener("pointerover",e=>{const t=e.target.closest&&e.target.closest(".lg-group>button,.lg-group>a,.lg-group>.chip");if(!t)return;move(t.parentElement,t)},{passive:true});
  document.addEventListener("pointerout",e=>{const g=e.target.closest&&e.target.closest(".lg-group");if(!g||(e.relatedTarget&&g.contains(e.relatedTarget)))return;const l=g.querySelector(":scope>.lg-lens");l&&l.classList.remove("on")},{passive:true});
  document.addEventListener("focusin",e=>{const t=e.target.closest&&e.target.closest(".lg-group>button,.lg-group>a");if(t)move(t.parentElement,t)});
  /* Glanzlicht folgt Maus/Finger auf allen Glasflächen */
  let raf=0,last=null;document.addEventListener("pointermove",e=>{last=e;if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const t=last.target.closest&&last.target.closest(".btn,.chip,.amt,.icon-btn,.qa-btn,.card,.catcard,.hb,.sh-opt,.pact button,.hdr,.qnav button");if(!t)return;const r=t.getBoundingClientRect();t.style.setProperty("--lx",((last.clientX-r.left)/r.width*100).toFixed(1)+"%");t.style.setProperty("--ly",((last.clientY-r.top)/r.height*100).toFixed(1)+"%")})},{passive:true});
})();
/* Ablauf-Video: spielt nur, solange es sichtbar ist – bei reduzierter Bewegung bleibt das Standbild */
(function(){if(!("IntersectionObserver" in window)||reduce)return;const io=new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;if(e.isIntersecting){if(v.preload==="none")v.preload="auto";const pr=v.play();pr&&pr.catch(()=>{})}else v.pause()}),{threshold:.25});
  const scan=()=>document.querySelectorAll("video.vf-vid:not([data-io])").forEach(v=>{v.dataset.io=1;io.observe(v)});new MutationObserver(scan).observe(document.getElementById("app")||document.body,{childList:true,subtree:true});scan()})();
const keyList=pg=>pg==="all"?VIS().filter(isKey):dedupeGrp(BRANDS.filter(b=>isKey(b)&&PLATG[b.plat]===pg));
A.keyPlat=(v,el)=>{$$("[data-a=keyPlat]").forEach(c=>c.setAttribute("aria-pressed",c===el));const t=$("#keyRail");t.innerHTML=keyList(v).map((b,i)=>tile(b,i,{cover:true})).join("");t.scrollLeft=0;$$(".rv",t).forEach(x=>x.classList.add("in"));rails(t.closest(".sec"))};
A.twGo=()=>{const d=($("#twNum").value||"").replace(/\D/g,"").replace(/^0+/,"");if(d.length<6||d.length>12){$("#twErr").textContent="Bitte gib eine gültige Handynummer ein.";$("#twNum").focus();return}go("/aufladen?n="+d)};
A.qa=(v,el)=>{const box=el.parentNode,o=box.dataset.open==="true";box.dataset.open=String(!o);el.setAttribute("aria-expanded",String(!o))};
/* Touch: Karte neigt sich beim Antippen zum Finger und fängt Licht, beim Loslassen federt sie zurück */
if(!reduce){
  let pc=null;
  const rel=()=>{if(!pc)return;pc.classList.remove("press");["--rx","--ry"].forEach(p=>pc.style.removeProperty(p));pc=null};
  document.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse")return;const c=e.target.closest&&e.target.closest(".gc.tilt");if(!c)return;
    const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;pc=c;
    c.style.setProperty("--ry",((x-.5)*12).toFixed(2)+"deg");c.style.setProperty("--rx",((.5-y)*10).toFixed(2)+"deg");
    c.style.setProperty("--gx",(x*100).toFixed(1)+"%");c.style.setProperty("--gy",(y*100).toFixed(1)+"%");c.classList.add("press")},{passive:true});
  ["pointerup","pointercancel","pointerleave"].forEach(t=>document.addEventListener(t,rel,{passive:true}));
  addEventListener("scroll",rel,{passive:true});
}
