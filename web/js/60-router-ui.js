/* ---------- router ---------- */
let cur={path:"/"},curKey="";
const app=$("#app");
const R=[[/^\/$/,home],[/^\/kategorien$/,cats],[/^\/kategorie\/([\w-]+)$/,category],[/^\/marke\/([\w-]+)$/,brandPage],[/^\/aufladen$/,topup],[/^\/suche$/,searchPage],[/^\/angebote$/,deals],[/^\/warenkorb$/,cartPage],[/^\/kasse$/,cartPage],[/^\/bestellung\/([\w-]+)$/,apiOrder],[/^\/login$/,apiLogin],[/^\/konto(?:\/(\w+))?$/,apiAccount],[/^\/hilfe$/,help],[/^\/abo$/,aboPage],[/^\/abo\/(AB-[A-Z0-9]+)$/,aboDetail],[/^\/kuendigen$/,cancelPage],[/^\/verifizieren$/,apiVerify],[/^\/passwort$/,apiReset],[/^\/(agb|datenschutz|widerruf)$/,legalPage]];
/* Lichtpunkt im Hauptknopf folgt Zeiger/Finger (--mx/--my, siehe .btn-primary) */
const LIT=".btn,.chip,.icon-btn,.amt,.qnav button,.paymore";
const litAt=(t,e)=>{const r=t.getBoundingClientRect();t.style.setProperty("--mx",(e.clientX-r.left)+"px");t.style.setProperty("--my",(e.clientY-r.top)+"px")};
let litE=null,litRaf=0;
document.addEventListener("pointermove",e=>{litE=e;if(litRaf)return;litRaf=requestAnimationFrame(()=>{litRaf=0;const t=litE.target.closest&&litE.target.closest(LIT);if(t)litAt(t,litE)})},{passive:true});
document.addEventListener("pointerdown",e=>{const t=e.target.closest&&e.target.closest(LIT);if(t)litAt(t,e)},{passive:true});
try{history.scrollRestoration="manual"}catch(e){}var SSR_T=/^\/(marke\/|kategorie\/|kategorien|aufladen|angebote|hilfe|agb|datenschutz|widerruf|abo$|kuendigen$|$)/.test(location.pathname)?document.title:null,SSR_P=location.pathname.replace(/\/index\.html$/,"/")||"/";const HOME_T="Gutscheine & Guthaben online kaufen – sofort per E-Mail | instantcodes";
/* Seitenwechsel mit View Transitions: alte Ansicht gleitet weg, neue steigt auf; eine angetippte Karte fliegt in die Produktseite (und zurück).
   Ohne API, beim ersten Aufbau, bei reduzierter Bewegung oder ausgeblendetem Tab: direkt umschalten. */
var navFrom=null,routed=false;
const VT_NAME="ic-card",inView=el=>{if(!el)return false;const r=el.getBoundingClientRect();return r.width>0&&r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth};
const vtClear=()=>$$(".vt-card").forEach(e=>{e.style.viewTransitionName="";e.classList.remove("vt-card")});
const vtTag=el=>{if(!el)return;vtClear();el.style.viewTransitionName=VT_NAME;el.classList.add("vt-card")};
function route(keep){
  const from=navFrom;navFrom=null;
  const anim=routed&&!keep&&!reduce&&!document.hidden&&typeof document.startViewTransition==="function";routed=true;
  if(!anim)return routeNow(keep);
  /* Karte der alten Ansicht markieren: angetippte Kachel, sonst (zurück) die Karte der Produktseite */
  const oldCard=from&&from.closest?(from.closest(".tile,.tile-media,.fc,.bc,.pal-item,a")||from).querySelector(".gc"):$(".pd-card .gc",app);
  const fromId=(cur.path.match(/^\/marke\/([\w-]+)/)||[])[1];
  vtClear();const hadOld=inView(oldCard);if(hadOld)vtTag(oldCard);
  document.documentElement.classList.add("vt-on");
  try{const t=document.startViewTransition(()=>{routeNow(keep,true);
      if(!hadOld)return;
      let nc=$(".pd-card .gc",app);
      if(!nc&&fromId){const a=$(`.tile-media a[href="/marke/${fromId}"]`,app);nc=a&&a.querySelector(".gc")}
      if(nc&&inView(nc))vtTag(nc)});
    t.finished.finally(()=>{vtClear();document.documentElement.classList.remove("vt-on")});
  }catch(e){vtClear();document.documentElement.classList.remove("vt-on");routeNow(keep)}
}
function routeNow(keep,vt){
  if(/^#\//.test(location.hash)){try{history.replaceState(null,"",location.hash.slice(1))}catch(e){}}const pth=location.pathname.replace(/\/index\.html$/,"/");
  const h=(pth||"/")+location.search,qi=h.indexOf("?"),path=(qi>-1?h.slice(0,qi):h)||"/",qs=new URLSearchParams(qi>-1?h.slice(qi+1):"");
  cur={path,qs};curKey=location.pathname+location.search;
  let v=null;for(const [re,fn] of R){const m=path.match(re);if(m){v=fn(m[1],qs);break}}
  v=v||notFound();
  const y=scrollY;
  app.innerHTML=`<div class="view${keep||vt?" k":""}">${v.html}</div>`;
  if(SSR_T&&(path===SSR_P||(path==="/"&&SSR_P==="/"))){document.title=SSR_T;SSR_T=null}else document.title=path==="/"?HOME_T:(v.title?v.title+" · ":"")+"instantcodes";
  $$(".hnav a").forEach(a=>a.classList.toggle("on",path===a.getAttribute("href")));
  document.body.classList.toggle("has-buybar",!!v.buybar);
  closeMenu(true);closePanels();A.cartClose();if(!keep)closeSheet(true);
  if(keep)scrollTo(0,y);else{const r=document.documentElement;r.style.scrollBehavior="auto";scrollTo({top:0,left:0,behavior:"instant"});requestAnimationFrame(()=>{scrollTo(0,0);r.style.scrollBehavior=""})}
  if(v.after)v.after();
  reveal(app);fx(app);metalMount(app);moreIO&&$$("[data-more]",app).forEach(e=>moreIO.observe(e));
  if(keep)$$(".rv",app).forEach(x=>x.classList.add("in"));
}
function go(p){p=String(p||"/").replace(/^#/,"");if(location.pathname+location.search===p)route();else{try{history.pushState(null,"",p)}catch(e){location.href=p;return}route()}}
addEventListener("hashchange",()=>{if(/^#\//.test(location.hash))route()});addEventListener("popstate",()=>{if(/^#\//.test(location.hash)||location.pathname+location.search!==curKey)route()});

/* ---------- Überlagerungen: gemeinsame Helfer ---------- */
const isOpen=s=>{const e=$(s);return !!e&&e.classList.contains("open")};
/* Seite bleibt gesperrt, solange noch ein modales Fenster offen ist */
const unlock=()=>{if(!["#scrim","#menu","#pal","#drawer"].some(isOpen))document.body.classList.remove("lock")};
const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
const focusables=el=>$$(FOCUSABLE,el).filter(x=>x.getClientRects().length&&getComputedStyle(x).visibility!=="hidden");
/* Tab bleibt im obersten offenen Dialog (Suche > Warenkorb > Fenster > Menü); den Warenkorb verwaltet 65-cart-pay selbst */
document.addEventListener("keydown",e=>{
  if(e.key!=="Tab")return;
  const m=["#pal","#drawer","#scrim","#menu"].map(s=>$(s)).find(x=>x&&x.classList.contains("open"));
  if(!m||m.id==="drawer")return;
  const f=focusables(m);if(!f.length){e.preventDefault();return}
  const a=document.activeElement,i=f.indexOf(a);
  if(!m.contains(a)){e.preventDefault();f[e.shiftKey?f.length-1:0].focus();return}
  if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}
  else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}
});
/* Mittelpunkt des auslösenden Knopfs relativ zur Fläche: von dort wächst sie auf (transform-origin) */
const originAt=(box,trg,fixed)=>{const r=trg&&trg.getBoundingClientRect&&trg.closest&&trg.closest(".hdr")?trg.getBoundingClientRect():null;if(!r||!r.width)return null;
  let x,y;if(fixed){const cs=getComputedStyle(box);x=parseFloat(cs.left);y=parseFloat(cs.top)}else{x=box.offsetLeft;y=box.offsetTop}
  return [Math.round(r.left+r.width/2-x)+"px",Math.round(r.top+r.height/2-y)+"px"]};
const underHdr=el=>{const r=$("#hdr").getBoundingClientRect(),t=Math.max(8,Math.round(r.bottom+8));el.style.top=t+"px";el.style.setProperty("--top",t+"px")};
/* Kopfzeile wandert beim Scrollen nach oben: angedockte Fenster folgen ihr */
let dockRaf=0;
addEventListener("scroll",()=>{if(dockRaf||(!qaCur&&!chat.open))return;dockRaf=requestAnimationFrame(()=>{dockRaf=0;if(qaCur)underHdr($("#qpanel"));if(chat.open)underHdr($("#chat"))})},{passive:true});

/* ---------- Fenster von unten (Sheet) ---------- */
let lastFocus=null;
function sheetLabel(sh,o){const h=$("h1,h2,h3",sh);
  if(h){h.id=h.id||"sheetT";sh.setAttribute("aria-labelledby",h.id);sh.removeAttribute("aria-label")}
  else{sh.removeAttribute("aria-labelledby");sh.setAttribute("aria-label",o.label||($(".sh-share",sh)?"Teilen":"Dialog"))}}
function openSheet(html,o={}){
  const sc=$("#scrim"),sh=$("#sheet");
  if(!sc.classList.contains("open"))lastFocus=document.activeElement;
  chatClose(true);qaClose();
  sh.innerHTML=`<div class="${o.cls||"sh"}">${html}</div>`;sh.classList.toggle("wide",!!o.wide);sh.style.transform="";sh.scrollTop=0;
  sheetLabel(sh,o);
  sc.classList.add("open");document.body.classList.add("lock");
  const x=$("#sheet .x");if(x)x.focus({preventScroll:true});
  if(o.after)o.after();
  /* Inhalt, der erst nach dem Öffnen eingesetzt wird (Schnellkauf), bekommt Titel und Fokus im nächsten Frame */
  requestAnimationFrame(()=>{if(!sc.classList.contains("open"))return;sheetLabel(sh,o);if(!sh.contains(document.activeElement)){const f=$(".x",sh)||focusables(sh)[0];f&&f.focus({preventScroll:true})}});
}
function closeSheet(silent){
  const sc=$("#scrim");if(!sc.classList.contains("open"))return;
  sc.classList.remove("open");unlock();
  if(silent!==true&&lastFocus&&document.contains(lastFocus))lastFocus.focus({preventScroll:true});
}
A.closeSheet=()=>closeSheet();
/* Wischen nach unten schließt das Fenster (Touch): am Griff oder wenn der Inhalt oben steht */
(()=>{const sh=$("#sheet");let t=null;
  sh.addEventListener("touchstart",e=>{if(e.touches.length!==1){t=null;return}const p=e.touches[0],top=sh.getBoundingClientRect().top,zone=p.clientY-top<60;
    t=zone||sh.scrollTop<=0?{x:p.clientX,y:p.clientY,at:Date.now(),zone,dy:0,on:false}:null},{passive:true});
  sh.addEventListener("touchmove",e=>{if(!t)return;const p=e.touches[0],dx=p.clientX-t.x,dy=p.clientY-t.y;
    if(!t.on){if(Math.abs(dy)<6)return;if(Math.abs(dx)>Math.abs(dy)||dy<0||(!t.zone&&sh.scrollTop>0)){t=null;return}t.on=true;sh.classList.add("drag")}
    e.preventDefault();t.dy=Math.max(0,dy);sh.style.transform=`translate3d(0,${t.dy}px,0)`},{passive:false});
  const end=()=>{if(!t)return;const {dy,at,on}=t;t=null;if(!on)return;sh.classList.remove("drag");const v=dy/Math.max(1,Date.now()-at);
    if(dy>110||(v>.6&&dy>40))closeSheet();sh.style.transform=""};
  sh.addEventListener("touchend",end);sh.addEventListener("touchcancel",end);
})();
A.country=()=>openSheet(`<div class="sheet-h"><h3>Land wählen</h3><button class="x" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button></div><div class="clist">${COUNTRIES.map(x=>`<button data-a="setCountry" data-v="${x.c}" aria-current="${x.c===S.country}">${flag(x.c,28)}<span>${esc(x.n)}</span>${x.c===S.country?ic("i-check"):""}</button>`).join("")}</div>`);
A.setCountry=v=>{S.country=v;save();closeSheet(true);closeMenu(true);toast(`Land: ${ctry().n}`);renderFooter();route(true)};

/* ---------- Menü (Handy) ---------- */
const menuScrim=document.createElement("div");menuScrim.className="menu-scrim";menuScrim.dataset.a="closeMenu";menuScrim.setAttribute("aria-hidden","true");$("#menu").before(menuScrim);
let menuFrom=null;
function renderMenu(){
  const c=ctry(),u=S.user,row=(tag,attr,icon,t,v)=>`<${tag} class="mi" ${attr}><span class="si-ic">${icon}</span><span class="mi-t">${t}</span>${v?`<span class="mi-v">${v}</span>`:""}${ic("i-chev","mi-c")}</${tag}>`;
  /* Vollbild-Glas: große Einträge in Chrom, darunter Kategorien als Glas-Kacheln, Service und Konto */
  const big=[["/angebote","Angebote"],["/abo","Abo","m-abo"],["/aufladen","Handy aufladen"],["/hilfe","Hilfe und Kontakt"]];
  $("#menuBody").innerHTML=`<button class="m-search" data-a="palOpen">${ic("i-search")}<span>Marke oder Gutschein suchen</span></button>
  <nav class="m-big" aria-label="Hauptbereiche">${big.map((b,i)=>`<a href="${b[0]}"${b[2]?` class="${b[2]}"`:""} style="--i:${i}"><span>${b[1]}</span>${ic("i-arrow")}</a>`).join("")}</nav>
  <section class="m-sec" aria-labelledby="mCats"><div class="m-hrow"><h2 class="m-h" id="mCats">Kategorien</h2><a class="more" href="/kategorien">Alle ansehen${ic("i-chev")}</a></div><div class="m-cats">${CATSV().filter(k=>k.id!=="topup").map(k=>`<a class="m-cat" href="/kategorie/${k.id}" style="--c:${CCOL[k.id]}"><span class="cc-ic">${ic(k.icon)}</span><span>${esc(k.name)}</span></a>`).join("")}</div></section>
  <section class="m-sec" aria-labelledby="mSvc"><h2 class="m-h" id="mSvc">Service</h2><div class="m-list">
   ${row("button",`data-a="chatOpen"`,LOGO(24),"Mia fragen<small>KI-Beraterin, antwortet sofort</small>")}
   ${row("button",`data-a="country"`,flag(c.c,22),"Land",esc(c.n))}
  </div></section>
  <div class="m-acc">${u?`<a class="mi m-user" href="/konto"><span class="avatar">${esc(initials(u.name))}</span><span class="mi-t">${esc(u.name)}<small>Bestellungen, Codes und Einstellungen</small></span>${ic("i-chev","mi-c")}</a>`
    :`<a class="btn btn-primary btn-ink btn-block btn-lg" href="/login">Anmelden</a><a class="btn btn-soft btn-block" href="/login?m=reg">Konto erstellen</a><p class="m-note">Mit Konto findest du deine Codes jederzeit wieder.</p>`}</div>`;
}
A.menu=(v,el)=>{menuFrom=el||document.activeElement;const m=$("#menu"),o=originAt(m,menuFrom,true);if(o){m.style.setProperty("--mox",o[0]);m.style.setProperty("--moy",o[1])}renderMenu();$("#menuBody").scrollTop=0;$("#menu").classList.add("open");menuScrim.classList.add("open");document.body.classList.add("lock");$("#menu .x").focus({preventScroll:true})};
function closeMenu(silent){const m=$("#menu");if(!m.classList.contains("open"))return;m.classList.remove("open");menuScrim.classList.remove("open");unlock();if(silent!==true&&menuFrom&&document.contains(menuFrom))menuFrom.focus({preventScroll:true})}
A.closeMenu=()=>closeMenu();

/* ---------- Schnellsuche (Strg+K, /) ---------- */
let palSel=0,palFrom=null;
(()=>{const i=$("#palIn");if(matchMedia("(max-width:479px)").matches)i.placeholder="Marke oder Spiel suchen";i.setAttribute("role","combobox");i.setAttribute("aria-expanded","true");i.setAttribute("aria-autocomplete","list")})();
function palMark(){const l=$("#palList");$$(".pal-item",l).forEach(x=>x.setAttribute("aria-selected",+x.dataset.i===palSel));const el=$(`[data-i="${palSel}"]`,l);$("#palIn").setAttribute("aria-activedescendant",el?el.id:"");return el}
function palDraw(){
  const q=$("#palIn").value.trim(),list=$("#palList");let n=0;
  const opt=(href,lead,title,sub,end)=>{const i=n++;return `<a class="pal-item" role="option" id="po${i}" href="${href}" data-i="${i}" aria-selected="false">${lead}<span class="pal-t"><b>${title}</b>${sub?`<small>${sub}</small>`:""}</span>${end?`<span class="pr">${end}</span>`:""}</a>`};
  const and=a=>a.length>1?a.slice(0,-1).join(", ")+" und "+a[a.length-1]:a[0]||"";
  const prod=b=>opt(`/marke/${b.id}`,mini(b),esc(b.name),esc(catById(b.cat).name)+(isKey(b)?" für "+esc(and([...new Set(variants(b).map(v=>PLAT[v.plat]||v.plat))])):""),priceTxt(b));
  const cat=c=>opt(`/kategorie/${c.id}`,`<span class="si-ic" style="--c:${c.col}">${ic(c.icon)}</span>`,esc(c.name),esc(c.desc));
  const head=t=>`<div class="pal-h" role="presentation">${t}</div>`;
  let html="";
  if(!q)html=`${head("Beliebt")}${POP.map(byId).filter(Boolean).map(prod).join("")}${head("Kategorien")}${CATSV().map(cat).join("")}`;
  else{const r=searchBrands(q).slice(0,9),cs=CATSV().filter(c=>c.name.toLowerCase().includes(q.toLowerCase()));
    html=r.length||cs.length?`${r.length?head("Produkte")+r.map(prod).join(""):""}${cs.length?head("Kategorien")+cs.map(cat).join(""):""}${opt(`/suche?q=${encodeURIComponent(q)}`,`<span class="si-ic">${ic("i-search")}</span>`,`Alle Ergebnisse für „${esc(q)}“`)}`
      :`<p class="pal-empty" role="status">Nichts gefunden für „${esc(q)}“. Versuch einen Marken- oder Spielnamen.</p>`}
  list.innerHTML=html;list.dataset.n=n;palMark();
}
function palOpen(){const p=$("#pal");if(p.classList.contains("open"))return;palFrom=document.activeElement;palSel=0;$("#palIn").value="";palDraw();$("#palList").scrollTop=0;const bx=$(".pal-box",p),o=originAt(bx,palFrom,false);bx.style.setProperty("--pox",o?o[0]:"50%");bx.style.setProperty("--poy",o?o[1]:"0px");p.classList.add("open");document.body.classList.add("lock");setTimeout(()=>$("#palIn").focus({preventScroll:true}),20)}
function palClose(silent){const p=$("#pal");if(!p||!p.classList.contains("open"))return;p.classList.remove("open");unlock();if(silent!==true&&palFrom&&document.contains(palFrom))palFrom.focus({preventScroll:true})}
function closePanels(){palClose(true);qaClose()}
A.palOpen=()=>{closeMenu();palOpen()};A.palClose=()=>palClose();
$("#palIn").addEventListener("input",()=>{palSel=0;palDraw();$("#palList").scrollTop=0});
$("#palIn").addEventListener("keydown",e=>{
  const n=+$("#palList").dataset.n||0;
  if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();palSel=(palSel+(e.key==="ArrowDown"?1:-1)+n)%Math.max(n,1);const el=palMark();el&&el.scrollIntoView({block:"nearest"})}
  if(e.key==="Enter"){e.preventDefault();const el=$(`#palList [data-i="${palSel}"]`);if(el){palClose();go(el.getAttribute("href"))}}
});
$("#palList").addEventListener("pointermove",e=>{if(e.pointerType!=="mouse")return;const it=e.target.closest(".pal-item");if(it&&+it.dataset.i!==palSel){palSel=+it.dataset.i;palMark()}},{passive:true});
$("#pal").addEventListener("click",e=>{if(e.target===$("#pal"))palClose();else if(e.target.closest(".pal-item"))palClose(true)});

/* ---------- Schnellaktionen in der Kopfzeile (Desktop): Glas-Panels unter der Kopfzeile ---------- */
let qaCur=null,qaBtn=null;
function qaClose(restore){const p=document.getElementById("qpanel");if(!p||p.hidden)return;p.classList.remove("open");qaCur=null;$$(".qnav [data-a=qa]").forEach(b=>b.setAttribute("aria-expanded","false"));
  if(restore===true&&qaBtn&&p.contains(document.activeElement))qaBtn.focus();setTimeout(()=>{if(!qaCur)p.hidden=true},260)}
function qaHTML(v){
  if(v==="cats")return `<div class="qp-h"><b>Kategorien</b><a class="more" href="/kategorien">Alle ansehen${ic("i-chev")}</a></div><div class="qp-cats">${CATSV().map(c=>{const n=BRANDS.filter(b=>b.cat===c.id).length,top=VIS().filter(b=>b.cat===c.id&&b.img).slice(0,3);return `<a class="qp-cat" href="/kategorie/${c.id}" style="--c:${CCOL[c.id]}"><span class="cc-ic">${ic(c.icon)}</span><span class="qp-t"><b>${esc(c.name)}</b><small>${n} ${c.id==="keys"?"Spiele":"Produkte"}</small></span><span class="qp-fan" aria-hidden="true">${top.map(b=>`<img src="${esc(b.img)}" alt="" loading="lazy">`).join("")}</span></a>`}).join("")}</div>`;
  if(v==="topup"){const c=ctry(),ops=BRANDS.filter(b=>b.cat==="topup").slice(0,8);return `<div class="qp-h"><b>Handy aufladen</b><a class="more" href="/aufladen">Zur Aufladung${ic("i-chev")}</a></div><label class="qp-lbl" for="qpNum">Handynummer in ${esc(c.n)}</label><div class="qp-top"><div class="phone"><span>${c.dial}</span><input id="qpNum" inputmode="tel" placeholder="151 2345678" autocomplete="tel-national"></div><button class="btn btn-primary" data-a="qpTop">Weiter</button></div><div class="err" id="qpErr" role="alert"></div><div class="qp-ops">${ops.map(b=>`<a class="qp-op" href="/aufladen?op=${b.id}">${mini(b)}<span>${esc(b.name)}</span></a>`).join("")}</div>`}
  if(v==="deals"){const l=POP.map(byId).filter(Boolean).slice(0,6);return `<div class="qp-h"><b>Beliebte Gutscheine</b><a class="more" href="/angebote">Alle Angebote${ic("i-chev")}</a></div><div class="qp-prods">${l.map(b=>`<div class="qp-prod"><a href="/marke/${b.id}" tabindex="-1" aria-hidden="true">${gc(b,{tilt:false,badge:false})}</a><a class="qp-t" href="/marke/${b.id}"><b>${esc(b.name)}</b><small>${priceTxt(b)}</small></a><button class="btn btn-soft btn-sm" data-a="qb" data-v="${b.id}" aria-label="${esc(b.name)} kaufen">Kaufen</button></div>`).join("")}</div>`}
  if(v==="help")return `<div class="qp-h"><b>Hilfe</b><a class="more" href="/hilfe">Alle Fragen${ic("i-chev")}</a></div><div class="qp-help">${FAQ.slice(0,4).map(f=>`<details><summary>${esc(f.q)}${ic("i-down")}</summary><p>${esc(f.a)}</p></details>`).join("")}</div><div class="qp-acts"><button class="btn btn-primary btn-sm" data-a="chatOpen">${ic("i-chat")}Mia fragen</button><a class="btn btn-soft btn-sm" href="mailto:${esc(CFG.support)}">${ic("i-mail")}E-Mail an den Support</a></div>`;
  return "";
}
function qaOpen(v,el,e){
  const p=$("#qpanel");if(qaCur===v){qaClose();return}
  chatClose(true);palClose(true);qaCur=v;qaBtn=el;
  p.innerHTML=qaHTML(v);p.dataset.v=v;p.setAttribute("aria-label",el.textContent.trim());p.hidden=false;underHdr(p);
  /* Panel sitzt unter seinem Knopf und wächst aus ihm heraus */
  const r=el.getBoundingClientRect(),w=p.offsetWidth,x=Math.round(Math.max(12,Math.min(r.left-18,innerWidth-w-12)));
  p.style.setProperty("--qx",x+"px");p.style.setProperty("--ox",Math.round(r.left+r.width/2-x)+"px");
  requestAnimationFrame(()=>p.classList.add("open"));
  $$(".qnav [data-a=qa]").forEach(b=>b.setAttribute("aria-expanded",b===el?"true":"false"));
  const n=$("#qpNum");
  if(n){n.addEventListener("keydown",k=>{if(k.key==="Enter"){k.preventDefault();A.qpTop()}});setTimeout(()=>n.focus({preventScroll:true}),120)}
  else if(e&&e.detail===0){const f=focusables(p)[0];f&&setTimeout(()=>f.focus({preventScroll:true}),60)}
}
/* data-a="qa" nutzen auch die FAQ-Akkordeons (15-effects): nur Knöpfe der Kopfzeile öffnen ein Panel */
const faqToggle=A.qa;
A.qa=(v,el,e)=>el&&el.closest(".qnav")?qaOpen(v,el,e):faqToggle&&faqToggle(v,el,e);
A.qpTop=()=>{const d=(($("#qpNum")||{}).value||"").replace(/\D/g,"").replace(/^0+/,"");if(d.length<6||d.length>12){$("#qpErr").textContent="Bitte gib eine gültige Handynummer ein.";$("#qpNum").focus();return}qaClose();go("/aufladen?n="+d)};
document.addEventListener("click",e=>{if(!qaCur)return;if(e.target.closest("#qpanel a"))return qaClose();if(e.target.closest("#qpanel")||e.target.closest(".qnav [data-a=qa]"))return;qaClose()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")qaClose(true)});
$("#qpanel").addEventListener("focusout",e=>{const t=e.relatedTarget;if(qaCur&&t&&!$("#qpanel").contains(t)&&!t.closest(".qnav"))qaClose()});
