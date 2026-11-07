/* ---------- Eigene Widgets (Chrome & Glas – hell) ----------
   wgHome()    Startseite „Finde das passende Geschenk“: Reiter Geschenk-Finder | Nach Budget, daneben das Geschenk-Video
   wgGift()    Geschenk-Finder: drei Fragen als Glas-Chips → echte Produkte aus dem Katalog mit Karte, Preis, Ansehen, Schnellkauf
   wgBudget()  Budget-Finder: Regler 5–100 € → passende Produkte und Beträge, sanftes Umsortieren (FLIP, nur transform/opacity)
   wgRedeem()  Einlöse-Assistent (Hilfe): Marke suchen oder wählen → Schritte → offizielle Einlöseseite (b.ru) oder Produktseite
   wgRegion()  Regionen-Check (Kategorien): Land wählen → welche Codes dort gelten (Katalogfeld region)
   wvid(n)     Handy-Video im iPhone: lädt und spielt erst bei Sichtbarkeit, bei reduzierter Bewegung nur das Standbild
   Klicks laufen über data-a (90-start.js), Regler/Suche/Pfeiltasten über eigene delegierte Hörer – kein Einhängen nötig.
   Nur echte Katalogdaten, keine erfundenen Zahlen. Alle Namen mit Präfix wg, CSS in css/45-widgets.css. */
const wvid=n=>`<video class="wg-vid" poster="/vid/${n}.jpg?v=2" muted loop playsinline preload="none" aria-hidden="true"><source src="/vid/${n}.mp4?v=2" type="video/mp4"><source src="/vid/${n}.webm?v=2" type="video/webm"></video>`;
const wgPhone=(n,cls)=>`<div class="iph-stage wg-ph${cls?" "+cls:""}" data-mouse aria-hidden="true"><div class="iph-float" data-off><div class="iph-tilt">${iphone(wvid(n))}</div></div></div>`;
/* Reihenfolge: Bestseller zuerst, dann beliebte Mobilfunkanbieter, dann Marken mit Bild oder Logo */
const WG_PREF=["telekom","vodafone","o2","congstar","alditalk","lyca","lebara"];
const wgRank=b=>{const i=BEST0.indexOf(b.id),j=WG_PREF.indexOf(b.id);return (i>-1?i:j>-1?30+j:60)-(b.hot?6:0)-(b.img||b.logo||b.si?3:0)};
const wgSort=(a,b)=>wgRank(a)-wgRank(b)||a.name.localeCompare(b.name,"de");
const wgTxt=b=>(b.id+" "+b.name+" "+(b.tags||[]).join(" ")).toLowerCase();
const WG_MUS=/spotify|deezer|audible|apple music|tidal|music|musik|hörbuch/;
const wgAmt=(b,a)=>b.labels?optLabel(b,a):money(a);
/* größter Betrag bis max (Preis inkl. Rabatt), bei min>0 der kleinste darüber */
const wgFit=(b,max,min)=>{const ok=b.amts.filter(a=>!soldOut(b.id,a)).filter(a=>{const p=price(b,a);return min?p>min:p<=max+1e-9});
  if(!ok.length)return 0;return ok.reduce((x,y)=>min?(price(b,y)<price(b,x)?y:x):(price(b,y)>price(b,x)?y:x))};
const wgLive=(id,t)=>{const el=$("#"+id);if(!el)return;el.textContent="";clearTimeout(el._t);el._t=setTimeout(()=>{el.textContent=t},60)};
const wgPress=(sel,el)=>$$(sel).forEach(c=>c.setAttribute("aria-pressed",String(c===el)));
/* Schnellkauf mit vorgewähltem Betrag (Fenster aus 65-cart-pay.js) */
A.wgQb=v=>{const [id,a]=String(v).split("|");if(byId(id))A.qb(id,a)};
/* Als Geschenk senden: Produktseite öffnen, Geschenkoption einschalten, Nachricht zum Anlass vorschlagen */
A.wgGiftGo=v=>{const b=byId(v);if(!b)return;const msg=(WG_OCC.find(o=>o[0]===WGS.occ)||[])[2]||"";go("/marke/"+encodeURIComponent(v));
  let n=0;const t=()=>{const sw=$(".giftbox .switch");if(!sw){if(++n<25)setTimeout(t,120);return}A.giftNow();
    const m=$("#gMsg");if(m&&msg&&!m.value){m.value=msg;m.dispatchEvent(new Event("input",{bubbles:true}))}};setTimeout(t,160)};

/* ---------- Startseite: Geschenk-Finder und Budget-Finder als Reiter ---------- */
let WGT=0;
function wgHome(){
  const tab=(i,t)=>`<button role="tab" id="wgT${i}" aria-controls="wgP${i}" aria-selected="${WGT===i}" tabindex="${WGT===i?0:-1}" data-a="wgTab" data-v="${i}">${t}</button>`;
  return `<section class="sec wg-sec wg-home" id="geschenk-finder" aria-labelledby="wgHomeH">
  <div class="sec-head"><div><h2 class="h2" id="wgHomeH">Finde das passende Geschenk</h2><p>Drei kurze Fragen oder einfach dein Budget – wir zeigen dir passende Codes aus dem Sortiment.</p></div></div>
  <div class="wg-hm">
   <div class="card wg-box rv">
    <div class="tabs wg-tabs" role="tablist" aria-label="Geschenk finden">${tab(0,"Geschenk-Finder")}${tab(1,"Nach Budget")}</div>
    <div class="wg-panel" role="tabpanel" id="wgP0" aria-labelledby="wgT0"${WGT===0?"":" hidden"}>${wgGift()}</div>
    <div class="wg-panel" role="tabpanel" id="wgP1" aria-labelledby="wgT1"${WGT===1?"":" hidden"}>${wgBudget()}</div>
   </div>
   <div class="wg-hm-side rv" style="--d:120ms">${wgPhone("geschenk")}<p class="wg-cap">${ic("i-gift")}<span>Auf jeder Produktseite: „Als Geschenk senden“ mit persönlicher Nachricht.</span></p></div>
  </div></section>`;
}
A.wgTab=(v,el)=>{const i=+v;WGT=i;$$(".wg-tabs [role=tab]").forEach((t,k)=>{t.setAttribute("aria-selected",String(k===i));t.tabIndex=k===i?0:-1});
  [0,1].forEach(k=>{const p=$("#wgP"+k);if(p)p.hidden=k!==i});const p=$("#wgP"+i);if(p&&!reduce){p.classList.remove("wg-swap");void p.offsetWidth;p.classList.add("wg-swap")}
  if(i===1)wgBudDraw(false)};

/* ---------- a) Geschenk-Finder ---------- */
const WG_WHO=[["gamer","Gamer:in",b=>["gaming","currency","keys","subs"].includes(b.cat),"für Gamer:innen"],["serie","Serienfan",b=>b.cat==="entertainment"&&!WG_MUS.test(wgTxt(b)),"für Serienfans"],
  ["musik","Musik",b=>["entertainment","apps"].includes(b.cat)&&WG_MUS.test(wgTxt(b)),"für Musikfans"],["shop","Shopping",b=>b.cat==="shopping","zum Shoppen"],
  ["handy","Handy",b=>b.cat==="topup"||(b.cat==="apps"&&/android|play store|app store/.test(wgTxt(b))),"fürs Handy"]];
const WG_OCC=[["geb","Geburtstag","Alles Gute zum Geburtstag!"],["xmas","Weihnachten","Frohe Weihnachten!"],["so","Einfach so","Einfach so – für dich."]];
const WG_BUD=[["15","bis 15 €"],["30","bis 30 €"],["50","bis 50 €"],["50+","über 50 €"]];
const WG_QS=[["who","Für wen ist das Geschenk?",WG_WHO],["occ","Zu welchem Anlass?",WG_OCC],["bud","Wie viel möchtest du ausgeben?",WG_BUD]];
const WGS={who:null,occ:null,bud:null};
const wgDone=()=>WG_QS.filter(q=>WGS[q[0]]).length;
function wgGift(){
  const n=wgDone();
  return `<div class="wg-gf">
  <div class="wg-prog" aria-hidden="true"><i style="transform:scaleX(${(n/3).toFixed(3)})"></i></div>
  ${WG_QS.map(([k,t,opts],i)=>`<div class="wg-q" data-q="${k}"${i&&!WGS[WG_QS[i-1][0]]?" hidden":""}>
   <p class="wg-q-h" id="wgQ${k}"><span class="wg-n" aria-hidden="true">${i+1}</span>${t}</p>
   <div class="wg-chips" role="group" aria-labelledby="wgQ${k}">${opts.map(o=>`<button class="chip" data-a="wgPick" data-v="${k}|${o[0]}" aria-pressed="${WGS[k]===o[0]}">${esc(o[1])}</button>`).join("")}</div></div>`).join("")}
  <p class="sr" id="wgGLive" aria-live="polite"></p>
  <div class="wg-out" id="wgGOut">${wgGiftRes()}</div>
  </div>`;
}
const wgGiftList=()=>{const who=WG_WHO.find(w=>w[0]===WGS.who);if(!who)return [];const over=WGS.bud==="50+",max=over?0:+WGS.bud;
  return VIS().filter(b=>!allSold(b)&&who[2](b)).map(b=>({b,a:over?wgFit(b,0,50):wgFit(b,max)})).filter(x=>x.a).sort((x,y)=>wgSort(x.b,y.b)).slice(0,6)};
const wgItem=(x,i)=>{const b=x.b,a=x.a,n=esc(b.name),K=isKey(b),gift=!K&&b.cat!=="topup";
  return `<li class="wg-it" style="--d:${i*70}ms">
   <a class="wg-it-c" href="/marke/${b.id}" tabindex="-1" aria-hidden="true">${gc(b,{tilt:false,badge:false,plat:false,cover:K})}</a>
   <div class="wg-it-t"><a class="wg-it-n" href="/marke/${b.id}">${n}</a><small>${K?esc(PLAT[b.plat]||""):wgAmt(b,a)}${!K&&Math.abs(price(b,a)-a)<.005?"":` · ${money(price(b,a))}`}</small></div>
   <div class="wg-it-a"><a class="btn btn-soft btn-sm" href="/marke/${b.id}">Ansehen<span class="sr">: ${n}</span></a><button class="btn btn-primary btn-sm" data-a="wgQb" data-v="${b.id}|${a}">Schnellkauf<span class="sr">: ${n}</span></button>${gift?`<button class="icon-btn wg-gb" data-a="wgGiftGo" data-v="${b.id}" aria-label="Als Geschenk senden: ${n}" title="Als Geschenk senden">${ic("i-gift")}</button>`:""}</div></li>`};
function wgGiftRes(){
  const n=wgDone();
  if(n<3)return `<p class="wg-wait">${n?`Noch ${3-n===1?"eine Frage":"zwei Fragen"}, dann zeigen wir dir passende Codes.`:"Wähle oben, für wen das Geschenk ist."}</p>`;
  const l=wgGiftList(),occ=WG_OCC.find(o=>o[0]===WGS.occ);
  if(!l.length)return `<div class="wg-none"><p>Dazu haben wir gerade nichts in diesem Budget.</p><button class="btn btn-soft btn-sm" data-a="wgPick" data-v="bud|${WGS.bud==="15"?"30":"50+"}">Budget erhöhen</button></div>`;
  return `<ul class="wg-res" aria-label="Geschenkideen">${l.map(wgItem).join("")}</ul>
  <div class="wg-tip">${ic("i-gift")}<p><b>Als Geschenk senden</b><span>Der Code kommt per E-Mail mit deiner Nachricht, zum Beispiel „${esc(occ[2])}“. Tipp auf das Geschenk-Symbol.</span></p><button class="btn btn-ghost btn-sm" data-a="wgReset">Neu starten</button></div>`;
}
const wgGiftDraw=()=>{const o=$("#wgGOut");if(!o)return;o.innerHTML=wgGiftRes();const bar=$(".wg-prog i");if(bar)bar.style.transform=`scaleX(${(wgDone()/3).toFixed(3)})`;
  if(wgDone()<3)return;const l=wgGiftList(),who=WG_WHO.find(w=>w[0]===WGS.who),bud=WG_BUD.find(w=>w[0]===WGS.bud);
  wgLive("wgGLive",l.length?`${l.length} ${l.length===1?"Geschenkidee":"Geschenkideen"} ${who[3]} ${bud[1]}: ${l.slice(0,3).map(x=>x.b.name).join(", ")}${l.length>3?" und mehr":""}.`:"Dazu haben wir gerade nichts in diesem Budget.")};
A.wgPick=(v,el)=>{const [k,x]=String(v).split("|");if(!(k in WGS))return;WGS[k]=x;wgPress(`[data-a=wgPick][data-v^="${k}|"]`,$(`.wg-q [data-a=wgPick][data-v="${k}|${x}"]`)||el);
  const qs=$$(".wg-q"),i=qs.findIndex(q=>q.dataset.q===k),nx=qs[i+1];
  if(nx&&nx.hidden){nx.hidden=false;wgLive("wgGLive",`Frage ${i+2} von 3: ${WG_QS[i+1][1]}`)}
  wgGiftDraw()};
A.wgReset=()=>{WGS.who=WGS.occ=WGS.bud=null;const p=$("#wgP0");if(!p)return;p.innerHTML=wgGift();const f=$(".wg-q .chip",p);f&&f.focus({preventScroll:true});
  const q=$(".wg-q",p);if(q&&q.getBoundingClientRect().top<70)q.scrollIntoView({behavior:reduce?"auto":"smooth",block:"center"})};

/* ---------- c) Budget-Finder ---------- */
const WG_BC=[["all","Alle",b=>!isKey(b)&&b.cat!=="topup"],["game","Gaming",b=>["gaming","currency","subs"].includes(b.cat)],["stream","Streaming & Musik",b=>b.cat==="entertainment"],
  ["shop","Shopping",b=>b.cat==="shopping"],["apps","App Stores",b=>b.cat==="apps"],["keys","Spiele-Keys",isKey]];
const WGB={v:25,c:"all"};let wgBRaf=0;
const wgBudList=()=>{const c=(WG_BC.find(x=>x[0]===WGB.c)||WG_BC[0])[2],v=WGB.v;
  return VIS().filter(b=>!allSold(b)&&c(b)).map(b=>({b,a:wgFit(b,v)})).filter(x=>x.a).sort((x,y)=>(v-price(x.b,x.a))-(v-price(y.b,y.a))||wgSort(x.b,y.b))};
function wgBudget(){
  const l=wgBudList();
  return `<div class="wg-bf">
  <div class="wg-bf-h"><label class="wg-bf-l" for="wgBud">Dein Budget</label><output class="wg-bf-o" id="wgBudO" for="wgBud">bis ${WGB.v} €</output></div>
  <input class="wg-range" id="wgBud" type="range" min="5" max="100" step="5" value="${WGB.v}" aria-valuetext="bis ${WGB.v} Euro" style="--p:${((WGB.v-5)/95*100).toFixed(1)}%">
  <div class="wg-scale" aria-hidden="true"><span>5 €</span><span>50 €</span><span>100 €</span></div>
  <div class="wg-chips wg-bc" role="group" aria-label="Kategorie">${WG_BC.map(c=>`<button class="chip" data-a="wgBc" data-v="${c[0]}" aria-pressed="${WGB.c===c[0]}">${esc(c[1])}</button>`).join("")}</div>
  <p class="wg-sum" id="wgBudS" aria-live="polite">${wgBudSum(l)}</p>
  <ul class="wg-bl" id="wgBudL" aria-label="Passende Produkte">${l.slice(0,8).map(wgBudEl).map(e=>e.outerHTML).join("")}</ul>
  </div>`;
}
const wgBudSum=l=>l.length?`${l.length} ${l.length===1?"Produkt passt":"Produkte passen"} in dein Budget von bis zu ${WGB.v} €${l.length>8?" – hier die 8 mit dem passendsten Betrag":""}.`:`Bis ${WGB.v} € haben wir in dieser Kategorie gerade nichts. Schieb den Regler etwas höher.`;
const wgBudHTML=x=>{const b=x.b,a=x.a,K=isKey(b),n=esc(shortNm(b));
  return `<a class="wg-b-in" href="/marke/${b.id}">${gc(b,{tilt:false,badge:false,plat:false,cover:K,amt:K?null:wgAmt(b,a)})}<span class="wg-b-t"><b>${n}</b><small>${K?money(price(b,a)):`${wgAmt(b,a)}${Math.abs(price(b,a)-a)<.005?"":` für ${money(price(b,a))}`}`}</small></span></a>
  <button class="wg-qb" data-a="wgQb" data-v="${b.id}|${a}" aria-label="Schnellkauf: ${n}, ${K?money(price(b,a)):wgAmt(b,a)}">${ic("i-plus")}</button>`};
const wgBudEl=x=>{const li=document.createElement("li");li.className="wg-b";li.dataset.k=x.b.id;li.dataset.a=x.a;li.innerHTML=wgBudHTML(x);return li};
/* FLIP: alte Lage merken → neu ordnen → von der alten Lage in die neue gleiten (nur transform/opacity) */
function wgBudDraw(anim){
  const L=$("#wgBudL");if(!L)return;const l=wgBudList(),top=l.slice(0,8),keep=new Set(top.map(x=>x.b.id));
  const s=$("#wgBudS");if(s){clearTimeout(s._t);s._t=setTimeout(()=>{s.textContent=wgBudSum(l)},anim?280:0)}
  const old=new Map($$(":scope>li[data-k]",L).map(li=>[li.dataset.k,li])),first=new Map(),lr=L.getBoundingClientRect();
  if(anim)old.forEach((li,k)=>first.set(k,li.getBoundingClientRect()));
  old.forEach((li,k)=>{if(keep.has(k))return;
    if(!anim){li.remove();return}
    const r=first.get(k);li.removeAttribute("data-k");li.setAttribute("aria-hidden","true");li.classList.add("wg-gone");
    li.style.cssText=`position:absolute;left:${(r.left-lr.left).toFixed(1)}px;top:${(r.top-lr.top).toFixed(1)}px;width:${r.width.toFixed(1)}px`;
    li.getAnimations().forEach(x=>x.cancel());li.animate([{opacity:1,transform:"scale(1)"},{opacity:0,transform:"scale(.88)"}],{duration:220,easing:"ease-in",fill:"forwards"}).finished.then(()=>li.remove(),()=>li.remove())});
  const fresh=new Set();
  top.forEach(x=>{let li=old.get(x.b.id);if(li){if(+li.dataset.a!==x.a){li.dataset.a=x.a;li.innerHTML=wgBudHTML(x)}}else{li=wgBudEl(x);fresh.add(li)}L.appendChild(li)});
  $$(":scope>li.wg-gone",L).forEach(li=>L.appendChild(li));
  if(!anim)return;
  $$(":scope>li[data-k]",L).forEach((li,i)=>{li.getAnimations().forEach(x=>x.cancel());
    if(fresh.has(li)){li.animate([{opacity:0,transform:"translateY(10px) scale(.94)"},{opacity:1,transform:"none"}],{duration:420,delay:80+i*18,easing:"cubic-bezier(.16,1,.3,1)",fill:"backwards"});return}
    const f=first.get(li.dataset.k);if(!f)return;const r=li.getBoundingClientRect(),dx=f.left-r.left,dy=f.top-r.top;if(Math.abs(dx)<1&&Math.abs(dy)<1)return;
    li.animate([{transform:`translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`},{transform:"none"}],{duration:520,easing:"cubic-bezier(.16,1,.3,1)"})});
}
const wgBudOut=()=>{const o=$("#wgBudO"),r=$("#wgBud");if(o)o.textContent=`bis ${WGB.v} €`;if(r){r.setAttribute("aria-valuetext",`bis ${WGB.v} Euro`);r.style.setProperty("--p",((WGB.v-5)/95*100).toFixed(1)+"%")}};
A.wgBc=(v,el)=>{if(!WG_BC.some(c=>c[0]===v))return;WGB.c=v;wgPress("[data-a=wgBc]",el);wgBudDraw(!reduce)};

/* ---------- b) Einlöse-Assistent ---------- */
const WGR={id:null};
const wgRdPool=()=>VIS().filter(b=>b.cat!=="payment");
const wgRdList=q=>{q=String(q||"").trim().toLowerCase();const P=wgRdPool();
  if(!q)return P.filter(b=>!isKey(b)&&b.cat!=="topup"&&hasMark(b)).sort(wgSort).slice(0,12);
  return P.filter(b=>wgTxt(b).includes(q)||(isKey(b)&&String(PLAT[b.plat]||"").toLowerCase().includes(q))).sort((a,b)=>(a.name.toLowerCase().startsWith(q)?0:1)-(b.name.toLowerCase().startsWith(q)?0:1)||wgSort(a,b)).slice(0,12)};
const wgRdBtn=b=>`<button class="wg-rb" data-a="wgRd" data-v="${b.id}" aria-pressed="${WGR.id===b.id}"><span class="wg-rb-m" style="color:${brandInk(b)}">${hasMark(b)&&!isKey(b)?brandMark(b,720,78,26,"wg-rb-i"):mini(b)}</span><span class="wg-rb-n">${esc(shortNm(b))}</span></button>`;
function wgRedeem(){
  return `<section class="sec wg-sec wg-rd-sec" id="einloesen" aria-labelledby="wgRdH">
  <div class="sec-head"><div><h2 class="h2" id="wgRdH">Einlöse-Assistent</h2><p>Wähle deine Marke oder dein Spiel. Wir zeigen dir Schritt für Schritt, wie du den Code einlöst.</p></div></div>
  <div class="card wg-rd rv">
   <div class="wg-rd-l">
    <label class="wg-lbl" for="wgRdQ">Marke oder Spiel suchen</label>
    <div class="wg-find">${ic("i-search")}<input id="wgRdQ" type="search" placeholder="z. B. Steam, Netflix, Amazon" autocomplete="off" enterkeyhint="search" aria-controls="wgRdG" aria-describedby="wgRdN"></div>
    <p class="sr" id="wgRdN" aria-live="polite"></p>
    <div class="wg-rd-g" id="wgRdG" role="group" aria-label="Marken">${wgRdList("").map(wgRdBtn).join("")}</div>
   </div>
   <div class="wg-rd-r" id="wgRdOut">${WGR.id&&byId(WGR.id)?wgRdSteps(byId(WGR.id),false):wgRdEmpty()}</div>
  </div></section>`;
}
const wgRdEmpty=()=>`<div class="wg-rd-e"><span class="wg-rd-ic" aria-hidden="true">${ic("i-key")}</span><p><b>Noch keine Marke gewählt</b><span>Tipp links auf eine Marke oder such nach ihr. Die Schritte erscheinen hier.</span></p></div>`;
const wgRdTxt=b=>b.cat==="topup"?["Du musst nichts einlösen.","Das Guthaben wird nach der Zahlung direkt auf die Handynummer gebucht.","Die Bestätigung bekommst du per E-Mail."]:redeemSteps(b);
function wgRdSteps(b,anim){
  const st=wgRdTxt(b),ru=b.ru&&/^https:\/\//.test(String(b.ru.url||""))?b.ru:null,K=isKey(b);
  return `<div class="wg-rd-o${anim?" wg-anim":""}">
   <div class="wg-rd-h"><span class="wg-rd-c" aria-hidden="true">${gc(b,{tilt:false,badge:false,plat:false,cover:K})}</span><div><h3 class="h3" id="wgRdT">${esc(b.name)}</h3><small>${K?`${esc(PLAT[b.plat]||"")}-Key · `:""}${b.cat==="topup"?"Handy-Guthaben":"So löst du den Code ein"}</small></div></div>
   <ol class="wg-steps" id="wgRdOl" aria-labelledby="wgRdT">${st.map((x,i)=>`<li style="--d:${120+i*140}ms"><span class="wg-sn" aria-hidden="true">${i+1}</span><span>${esc(x)}</span></li>`).join("")}</ol>
   <div class="wg-rd-a">${ru?`<a class="btn btn-primary" href="${esc(ru.url)}" target="_blank" rel="noopener noreferrer">${esc(ru.label||"Offizielle Einlöseseite")}<span class="sr"> (öffnet ein neues Fenster)</span></a><a class="btn btn-soft" href="/marke/${b.id}">Zur Produktseite</a>`
     :`<a class="btn btn-primary" href="/marke/${b.id}">Zur Produktseite</a>`}</div>
   <p class="wg-rd-n">Deine gekauften Codes findest du in der E-Mail und unter <a href="/konto/bestellungen">Konto › Bestellungen</a>.</p>
  </div>`;
}
A.wgRd=(v,el)=>{const b=byId(v),o=$("#wgRdOut");if(!b||!o)return;WGR.id=v;wgPress("#wgRdG [data-a=wgRd]",el);
  o.innerHTML=wgRdSteps(b,!reduce);const st=wgRdTxt(b);wgLive("wgRdN",`${b.name}: ${st.length} Schritte. ${st[0]}`);
  if(innerWidth<900){const r=o.getBoundingClientRect();if(r.top>innerHeight*.7||r.bottom<80)o.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"})}
  /* Reloadly-Produkte: genaue Anleitung vom Server (wie auf der Produktseite) */
  if(b.rl)API("/product/"+encodeURIComponent(b.id)).then(j=>{if(WGR.id!==v||!j||!j.redeem)return;const ol=$("#wgRdOl");if(!ol)return;
    const s=String(j.redeem).replace(/<[^>]+>/g," ").split(/(?<=[.!])\s+|\n+|\r+/).map(x=>x.trim()).filter(x=>x.length>2).slice(0,8);
    if(s.length)ol.innerHTML=s.map((x,i)=>`<li style="--d:${i*90}ms"><span class="wg-sn" aria-hidden="true">${i+1}</span><span>${esc(x)}</span></li>`).join("")}).catch(()=>{})};
const wgRdFilter=q=>{const g=$("#wgRdG");if(!g)return;const l=wgRdList(q);
  g.innerHTML=l.length?l.map(wgRdBtn).join(""):`<p class="wg-rd-0">Nichts gefunden. Probier den Namen der Marke, zum Beispiel „PlayStation“.</p>`;
  wgLive("wgRdN",q.trim()?(l.length?`${l.length} ${l.length===1?"Treffer":"Treffer"}`:"Keine Treffer"):"")};

/* ---------- d) Regionen-Check ---------- */
const WG_EU=["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE"];
const WG_FL=["DE","AT","NL","FR","CH","TR","GB","US"];
const wgFlag=c=>c==="EU"?ic("i-globe"):WG_FL.includes(c)?flag(c,20):`<img class="wg-flg" src="/img/mark/flag/${c.toLowerCase()}-4x3.svg" alt="" loading="lazy" onerror="this.remove()">`;
const wgLand=c=>c==="EU"?"Anderes EU-Land":regDE(c);
/* Deutschland, Nachbarn, alle übrigen EU-Länder als ein Chip, dann jedes weitere Land aus dem Katalog */
const wgRegLands=()=>{const base=["DE","AT","NL","FR","EU"],ex=[...new Set(BRANDS.map(b=>b.region).filter(r=>/^[A-Z]{2}$/.test(r||"")&&r!=="EU"&&!base.includes(r)))].sort();return base.concat(ex)};
const WGG={c:"DE",all:false};
/* gilt in Land c: genau dieses Land, oder Europa-Code in einem EU-Land */
const wgRegOk=(b,c)=>b.region===c||(b.region==="EU"&&(c==="EU"||WG_EU.includes(c)));
const wgRegList=c=>dedupeGrp(BRANDS.filter(b=>wgRegOk(b,c)&&(typeof isActiveB!=="function"||isActiveB(b)))).sort(wgSort);
function wgRegion(){
  return `<section class="sec wg-sec wg-reg-sec" id="regionen" aria-labelledby="wgRgH">
  <div class="sec-head"><div><h2 class="h2" id="wgRgH">Regionen-Check</h2><p>Wähle das Land, in dem du den Code einlöst. Wir zeigen dir, welche Codes aus dem Sortiment dort gelten.</p></div></div>
  <div class="card wg-reg rv">
   <div class="wg-chips wg-reg-c" role="group" aria-label="Land wählen">${wgRegLands().map(c=>`<button class="chip" data-a="wgReg" data-v="${c}" aria-pressed="${WGG.c===c}">${wgFlag(c)}${esc(wgLand(c))}</button>`).join("")}</div>
   <p class="wg-sum" id="wgRgS" aria-live="polite">${wgRegSum(WGG.c)}</p>
   <div id="wgRgL">${wgRegBody(WGG.c,false)}</div>
  </div></section>`;
}
const WG_IN={EU:"den übrigen EU-Ländern",NL:"den Niederlanden",TR:"der Türkei",US:"den USA",CH:"der Schweiz",GB:"Großbritannien",CZ:"Tschechien",SK:"der Slowakei",AE:"den Vereinigten Arabischen Emiraten",PH:"den Philippinen"};
const wgRegSum=c=>{const l=wgRegList(c),eu=l.filter(b=>b.region==="EU").length,own=l.length-eu,n=regDE(c);
  return l.length?`In ${WG_IN[c]||n} ${l.length===1?"gilt ein Produkt":`gelten ${l.length} Produkte`} aus dem Sortiment${own&&eu?`: ${own} für ${n}, ${eu} als Europa-Code`:eu?l.length===1?", ein Europa-Code":", alle als Europa-Code":""}.`
    :`Für ${c==="EU"?"die übrigen EU-Länder":n} haben wir gerade keine passenden Codes.`};
function wgRegBody(c,anim){
  const l=wgRegList(c),cats=CATS.map(k=>[k,l.filter(b=>b.cat===k.id).length]).filter(x=>x[1]),show=WGG.all?l:l.slice(0,18);
  const de=c!=="DE"?dedupeGrp(BRANDS.filter(b=>b.region==="DE"&&!wgRegOk(b,c))).length:0;
  return `${cats.length?`<ul class="wg-reg-k" aria-label="Nach Kategorie">${cats.map(([k,n])=>`<li><a href="/kategorie/${k.id}">${ic(k.icon)}<span>${esc(k.short)}</span><b>${n}</b></a></li>`).join("")}</ul>`:""}
  <ul class="wg-reg-g${anim?" wg-anim":""}" aria-label="Produkte für ${esc(wgLand(c))}">${show.map((b,i)=>`<li style="--d:${Math.min(i,17)*28}ms"><a href="/marke/${b.id}">${mini(b)}<span><b>${esc(shortNm(b))}</b><small>${b.region==="EU"?"Europa":esc(REGION[b.region]||regDE(b.region))}${isKey(b)&&b.plat?` · ${esc(PLAT[b.plat]||"")}`:""}</small></span></a></li>`).join("")}</ul>
  ${l.length>show.length?`<button class="btn btn-soft btn-sm wg-reg-m" data-a="wgRegAll">Alle ${l.length} anzeigen</button>`:""}
  ${de?`<p class="wg-reg-n">${ic("i-globe")}<span>${de} weitere Produkte gelten nur in Deutschland. Wo ein Code gilt, steht auf jeder Produktseite unter „Gültig in“.</span></p>`:`<p class="wg-reg-n">${ic("i-globe")}<span>Wo ein Code gilt, steht auf jeder Produktseite unter „Gültig in“.</span></p>`}`;
}
A.wgReg=(v,el)=>{if(!/^[A-Z]{2}$/.test(v)||!wgRegLands().includes(v))return;WGG.c=v;WGG.all=false;wgPress("[data-a=wgReg]",el);const L=$("#wgRgL");if(L)L.innerHTML=wgRegBody(v,!reduce);wgLive("wgRgS",wgRegSum(v))};
A.wgRegAll=(_,el)=>{WGG.all=true;const L=$("#wgRgL");if(!L)return;L.innerHTML=wgRegBody(WGG.c,false);const a=$$(".wg-reg-g a",L)[18];a&&a.focus({preventScroll:true})};

/* ---------- Ereignisse: Regler, Suche, Pfeiltasten in den Reitern ---------- */
document.addEventListener("input",e=>{const t=e.target;if(!t||!t.id)return;
  if(t.id==="wgBud"){WGB.v=Math.max(5,Math.min(100,+t.value||25));wgBudOut();if(!wgBRaf)wgBRaf=requestAnimationFrame(()=>{wgBRaf=0;wgBudDraw(!reduce)})}
  else if(t.id==="wgRdQ")wgRdFilter(t.value)});
document.addEventListener("keydown",e=>{const t=e.target;if(!t||!t.closest||!t.closest(".wg-tabs"))return;
  const k=e.key,tabs=$$(".wg-tabs [role=tab]"),i=tabs.indexOf(t);if(i<0)return;
  const j=k==="ArrowRight"?(i+1)%tabs.length:k==="ArrowLeft"?(i-1+tabs.length)%tabs.length:k==="Home"?0:k==="End"?tabs.length-1:-1;
  if(j<0)return;e.preventDefault();tabs[j].focus();A.wgTab(String(j))});

/* ---------- Videos: laden und spielen erst bei Sichtbarkeit; reduzierte Bewegung = nur Standbild ----------
   Regionen-Check auf der Kategorien-Übersicht: wird nach dem Aufbau der Seite vor der A–Z-Liste eingesetzt (30-catalog.js bleibt unberührt). */
(function(){
  const io=!reduce&&"IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(e=>{const v=e.target;
    if(e.isIntersecting){if(v.preload==="none")v.preload="auto";const p=v.play();p&&p.catch(()=>{})}else if(!v.paused)v.pause()}),{threshold:.25}):null;
  const scan=()=>{if(io)document.querySelectorAll("video.wg-vid:not([data-io])").forEach(v=>{v.dataset.io=1;io.observe(v)});
    try{if(location.pathname==="/kategorien"){const vw=document.querySelector("#app>.view");if(vw&&!vw.querySelector("#regionen")){const az=vw.querySelector(".az-sec");
      const box=document.createElement("div");box.innerHTML=wgRegion();const sec=box.firstElementChild;if(az)az.before(sec);else vw.appendChild(sec);reveal(sec)}}}catch(err){}};
  new MutationObserver(scan).observe(document.getElementById("app")||document.body,{childList:true,subtree:true});
})();
