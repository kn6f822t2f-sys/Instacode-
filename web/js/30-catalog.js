/* ---------- Katalog: Kategorien, Kategorie, Angebote ---------- */
/* Anfangsbuchstabe für das A–Z-Verzeichnis (Umlaute zählen zum Grundbuchstaben, Ziffern unter #) */
const azKey=n=>{const ch=String(n||"").normalize("NFD").replace(/[̀-ͯ]/g,"").charAt(0).toUpperCase();return /[A-Z]/.test(ch)?ch:"#"};
const azId=k=>"az-"+(k==="#"?"0":k.toLowerCase());
function cats(){
  const az=VIS().slice().sort((a,b)=>a.name.localeCompare(b.name,"de")), cs=CATSV(), groups=[];
  az.forEach(b=>{const k=azKey(b.name);let g=groups.find(x=>x.k===k);if(!g)groups.push(g={k,l:[]});g.l.push(b)});
  const sub=b=>esc(catById(b.cat).name)+(isKey(b)?" · "+variants(b).map(v=>PLAT[v.plat]).join(", "):"");
  return {tab:"cats",title:"Kategorien",html:`${crumb([["Kategorien"]])}
${phead({c:"#7048E8",icon:"i-grid-f",title:"Kategorien",text:`${BRANDS.length} Produkte in ${cs.length} Kategorien. Codes kommen nach der Zahlung per E&#8209;Mail, Handy-Guthaben geht direkt auf die Nummer.`,cards:["netflix","fc26-ps5","steam"]})}
<section class="sec cat-sec"><div class="catgrid">${cs.map(catCard).join("")}</div></section>
<section class="sec" aria-labelledby="azH"><div class="sec-head"><h2 class="h2" id="azH">Alle Produkte von A bis Z</h2></div>
  <nav class="az-nav" aria-label="Nach Anfangsbuchstabe springen">${groups.map(g=>`<a href="#${azId(g.k)}" aria-label="Buchstabe ${g.k==="#"?"Ziffern":g.k}">${g.k}</a>`).join("")}</nav>
  <div class="az">${groups.map(g=>`<div class="az-g spot" id="${azId(g.k)}"><h3 class="az-k">${g.k}</h3><ul>${g.l.map(b=>`<li><a href="/marke/${b.id}">${mini(b)}<span class="az-t"><b>${esc(b.name)}</b><small>${sub(b)}</small></span>${ic("i-chev")}</a></li>`).join("")}</ul></div>`).join("")}</div>
</section>`};
}
function category(id,qs){
  const c=catById(id);if(!c||c.id!==id)return notFound();
  const sort=qs.get("s")||"pop", pf=qs.get("p")||"all", K=id==="keys", TU=id==="topup", all=BRANDS.filter(b=>b.cat===id).length, uniq=VIS().filter(b=>b.cat===id).length;
  let l=K&&pf!=="all"?dedupeGrp(BRANDS.filter(b=>isKey(b)&&PLATG[b.plat]===pf)):VIS().filter(b=>b.cat===id);
  const top=l.slice(0,3).map(b=>b.id);
  if(sort==="az")l.sort((a,b)=>a.name.localeCompare(b.name,"de"));
  if(sort==="price")l.sort((a,b)=>price(a,a.from)-price(b,b.from));
  const q=o=>`/kategorie/${id}?s=${o.s||sort}${(o.p||pf)!=="all"?"&p="+(o.p||pf):""}`;
  const n=K?`${l.length} ${l.length===1?"Spiel":"Spiele"}`:TU?`${l.length} Anbieter`:`${l.length} ${l.length===1?"Marke":"Marken"}${all>l.length?` · ${all} Produkte`:""}`;
  return {tab:"cats",title:c.name,html:`${crumb([["Kategorien","/kategorien"],[c.name]])}
${phead({c:CCOL[id],icon:c.icon,title:esc(c.name),text:K?`${esc(c.desc)}. ${uniq} Spiele, Key per E&#8209;Mail.`:TU?`Prepaid-Guthaben für ${uniq} Anbieter, direkt auf die Nummer gebucht.`:`${esc(c.desc)}. ${all} Produkte, Code per E&#8209;Mail.`,cards:top,extra:TU?`<a class="btn btn-primary cat-cta" href="/aufladen">Nummer eingeben</a>`:""})}
<section class="sec cat-list">
  ${K?`<div class="chips" role="group" aria-label="Plattform">${[["all","Alle"],["pc","PC"],["ps","PlayStation"],["xbox","Xbox"],["nin","Nintendo"]].map(p=>`<a class="chip" href="${q({p:p[0]})}" ${p[0]===pf?'aria-current="page"':""}>${p[1]}</a>`).join("")}</div>`:""}
  <div class="cat-bar"><p class="cat-n">${n}</p>
    <label class="cat-sort"><span>Sortieren</span><select class="sel" data-sort="${id}"><option value="pop"${sort==="pop"?" selected":""}>Beliebt</option><option value="az"${sort==="az"?" selected":""}>A bis Z</option><option value="price"${sort==="price"?" selected":""}>Günstigster Preis</option></select></label></div>
  ${l.length?tilesPaged(l,{cover:K}):empty("Nichts gefunden","Für diese Auswahl gibt es gerade keine Produkte.",[`/kategorie/${id}`,"Alle anzeigen"])}
</section>
<section class="sec">${secHead("Andere Kategorien")}<div class="catgrid">${CATSV().filter(x=>x.id!==id).map(catCard).join("")}</div></section>`,
  after(){const s=$("[data-sort]");s&&s.addEventListener("change",()=>go(`/kategorie/${id}?s=${s.value}${pf!=="all"?"&p="+pf:""}`))}};
}
function deals(){
  const l=DEALS(), pop=POP.map(byId).filter(Boolean);
  return {tab:"home",title:"Angebote",html:`${crumb([["Angebote"]])}
${phead({c:"#E11D48",icon:"i-tag",title:"Angebote",text:l.length?`${l.length} ${l.length===1?"Gutschein ist":"Gutscheine sind"} gerade günstiger als der Nennwert.`:"Gerade gibt es keine reduzierten Gutscheine.",cards:l.length?l.slice(0,3).map(b=>b.id):["zalando","netflix","spotify"]})}
<section class="sec cat-sec">${l.length?tilesPaged(l):empty("Gerade keine Angebote","Sobald ein Gutschein günstiger ist als sein Nennwert, steht er hier. Bis dahin findest du alles in den Kategorien.",["/kategorien","Kategorien ansehen"])}</section>
${!l.length&&pop.length?`<section class="sec">${secHead("Beliebt",["/kategorien","Alle"],railNav("popRail"))}${rail("popRail",pop)}</section>`:""}`};
}

/* ---------- Produktseite ---------- */
const DESIGNS=[["Blau","linear-gradient(135deg,#2F6BFF,#22C3FF)"],["Sunset","linear-gradient(135deg,#F43F5E,#FB923C)"],["Mint","linear-gradient(135deg,#0E9F6E,#1BA9D8)"],["Nacht","linear-gradient(135deg,#0B1020,#4338CA)"]];
const REDEEM={
  steam:["Öffne Steam und melde dich an.","Klicke unten links auf „Spiel hinzufügen“ und dann „Ein Produkt bei Steam aktivieren“.","Gib den Key ein und bestätige. Das Spiel erscheint in deiner Bibliothek."],
  ps5:["Öffne auf der PS5 den PlayStation Store.","Wähle oben das Menü mit den drei Punkten und dann „Code einlösen“.","Gib den Code ein und bestätige."],
  xbox:["Öffne den Microsoft Store oder redeem.microsoft.com.","Melde dich mit deinem Microsoft-Konto an.","Gib den 25-stelligen Code ein und bestätige."],
  xpc:["Öffne redeem.microsoft.com oder den Microsoft Store.","Melde dich mit deinem Microsoft-Konto an.","Gib den Code ein. Das Spiel steht auf Xbox und Windows-PC bereit."],
  switch:["Öffne den Nintendo eShop auf der Switch.","Wähle links „Code einlösen“.","Gib den Code ein und lade das Spiel herunter."],
  switch2:["Öffne den Nintendo eShop auf der Switch 2.","Wähle „Code einlösen“.","Gib den Code ein und lade das Spiel herunter."],
  ea:["Öffne die EA app und melde dich an.","Klicke auf dein Profil und dann „Produktcode einlösen“.","Gib den Code ein und starte den Download."],
  bnet:["Öffne Battle.net und melde dich an.","Klicke auf deinen Account und dann „Code einlösen“.","Gib den Code ein und bestätige."],
  ubi:["Öffne Ubisoft Connect und melde dich an.","Wähle im Menü „Key aktivieren“.","Gib den Key ein und bestätige."],
  rockstar:["Öffne den Rockstar Games Launcher und melde dich an.","Gehe zu „Einstellungen“ und dann „Code einlösen“.","Gib den Code ein und starte den Download."],
  pc:["Öffne minecraft.net/redeem.","Melde dich mit deinem Microsoft-Konto an.","Gib den Code ein und lade das Spiel herunter."]
};
const redeemSteps=b=>b.redeem?b.redeem.split(/(?<=[.!])\s+|\n+/).map(x=>x.trim()).filter(Boolean).slice(0,6):isKey(b)&&REDEEM[b.plat]?REDEEM[b.plat]:[`Öffne den Dienst oder die App von ${b.name}.`,b.type==="sub"?"Wähle in deinem Konto „Code einlösen“ oder „Abo verlängern“.":"Wähle „Code einlösen“ oder „Guthaben aufladen“.","Gib den Code ein und bestätige."];
const STORE_IN={steam:"in Steam",pc:"beim Hersteller",ea:"in der EA app",bnet:"in Battle.net",ubi:"in Ubisoft Connect",rockstar:"im Rockstar Games Launcher",ps5:"im PlayStation Store",xbox:"im Microsoft Store",xpc:"im Microsoft Store",switch:"im Nintendo eShop",switch2:"im Nintendo eShop"};
const STORE={steam:"Steam",pc:"Hersteller-Launcher",ea:"EA app",bnet:"Battle.net",ubi:"Ubisoft Connect",rockstar:"Rockstar Games Launcher",ps5:"PlayStation Store",xbox:"Microsoft Store",xpc:"Microsoft Store",switch:"Nintendo eShop",switch2:"Nintendo eShop"};
const descOf=b=>isKey(b)?`${b.name} als digitaler ${PLAT[b.plat]}-Key. Nach der Zahlung bekommst du den Key automatisch per E-Mail und löst ihn ${STORE_IN[b.plat]||"beim Hersteller"} ein. Der Key bleibt in deinem Konto gespeichert.`
  :b.type==="sub"?`${b.name} als digitaler Code. Nach der Zahlung kommt der Code per E-Mail, du löst ihn in deinem Konto ein und die Laufzeit startet. Kein Abo, keine automatische Verlängerung über instantcodes.`
  :`Digitaler ${b.name}-Code zum sofortigen Einlösen. Nach der Zahlung bekommst du den Code automatisch per E-Mail. In deinem Konto bleibt er gespeichert.${regTag(b)?` Wichtig: Dieser Code gilt nur für ${regDE(b.region)} und funktioniert nur mit einem Konto aus diesem Land. Der Wert ist in der Landeswährung angegeben, der Preis in Euro.`:""}`;
const varName=(b,v)=>isKey(b)?PLAT[v.plat]:v.name.replace(/^PlayStation Plus /,"").replace(/^Microsoft 365 /,"");
/* Express-Checkout-Box (auch im Warenkorb und im Schnellkauf verwendet) */
const xpayBox=(id,title,o={})=>`<div class="xpay locked" id="${id}" hidden>${title?`<div class="xpay-or">${title}</div>`:""}${o.noConsent?"":`<label class="chk xpay-ok"><input type="checkbox" class="xok"><span>Ich akzeptiere die <a href="/agb">AGB</a> und möchte, dass ihr sofort liefert. Mir ist bekannt, dass mein <a href="/widerruf">Widerrufsrecht</a> damit erlischt.</span></label>`}<div class="xpay-w"><div class="xpay-btns"></div><button type="button" class="xpay-lock" aria-label="Bitte zuerst die Zustimmung bestätigen"></button></div><div class="xpay-err" role="alert"></div></div>`;
/* Lichtfarbe der Marke: die kräftigste Farbe aus Kartengrund und Schrift, auf gut sichtbare Helligkeit gebracht */
const lightOf=b=>{
  let best=null;
  for(const h of (String(b.bg||"")+" "+String(b.fg||"")).match(/#[0-9a-f]{6}\b/gi)||[]){
    const [r,g,bl]=[1,3,5].map(i=>parseInt(h.substr(i,2),16)/255),mx=Math.max(r,g,bl),mn=Math.min(r,g,bl);
    if(!best||mx-mn>best.c)best={r,g,bl,mx,mn,c:mx-mn};
  }
  if(!best||best.c<.12)return "hsl(240 72% 64%)";
  const {r,g,bl,mx,mn,c}=best,l=(mx+mn)/2,s=c/(1-Math.abs(2*l-1));
  const h=Math.round(((mx===r?((g-bl)/c)%6:mx===g?(bl-r)/c+2:(r-g)/c+4)*60+360)%360);
  return `hsl(${h} ${Math.round(Math.max(.6,Math.min(.9,s))*100)}% ${Math.round(Math.max(.5,Math.min(.6,l))*100)}%)`;
};
/* Klebende Spalten (Desktop): die kürzere fährt mit, eine Spalte höher als das Fenster klebt mit ihrer Unterkante */
const stickRO="ResizeObserver" in window?new ResizeObserver(es=>es.forEach(e=>e.target.style.setProperty("--h",Math.ceil(e.target.offsetHeight)+"px"))):null;
let stuck=[];
const stick=(...els)=>{if(!stickRO)return;stuck.forEach(x=>stickRO.unobserve(x));stuck=els.filter(Boolean);stuck.forEach(x=>stickRO.observe(x))};
let pdIO=null;
function brandPage(id){
  const b=byId(id);if(!b)return notFound();
  if(b.cat==="topup")return topup(null,new URLSearchParams("op="+id));
  S.recent=[id].concat(S.recent.filter(x=>x!==id)).slice(0,12);save();
  const c=catById(b.cat), fav=S.favs.includes(id), K=isKey(b), vars=variants(b), card=b.type==="card", lc=lightOf(b);
  const def=b.amts[Math.min(1,b.amts.length-1)], avail=b.amts.filter(a=>!soldOut(id,a));
  const P={a:avail.includes(def)?def:(avail[0]||0),q:1,gift:false,design:0};
  const total=()=>P.a?price(b,P.a)*P.q:0;
  const saving=()=>card&&P.a?Math.max(0,Math.round((P.a-price(b,P.a))*P.q*100)/100):0;
  const tagRaw=()=>P.a?(card?money(P.a):optLabel(b,P.a)):"ausverkauft", tagTxt=()=>esc(tagRaw());
  const similar=VIS().filter(x=>x.cat===b.cat&&x.id!==id&&(!b.grp||x.grp!==b.grp)).slice(0,10);
  const dis=avail.length?"":" disabled", region=REGION[b.region]||esc(regDE(b.region)||b.regionName||"Deutschland");
  const amtSub=a=>soldOut(id,a)?"<small>ausverkauft</small>":!card||Math.abs(price(b,a)-a)>.004?`<small>${money(price(b,a))}</small>`:"";
  const short=b.name.replace(/ (Gift Card|Geschenkkarte)$/,""), barSub=()=>short+(card||!P.a?"":" · "+tagRaw())+(P.q>1?` · ${P.q} Stück`:"")+(P.gift?" · als Geschenk":"");
  return {tab:"cats",title:b.name+(K?` (${PLAT[b.plat]})`:""),buybar:true,html:`${crumb([[c.name,"/kategorie/"+c.id],[b.name]])}
<div class="pd${K?" pd-key":""}" style="--lc:${lc};--gd:${DESIGNS[0][1]}">
  <div class="pd-media">
    <div class="pd-stage" id="pdStage" data-mouse>
      ${b.img?`<span class="pd-ext" style="--bx:url('${esc(b.img)}')" aria-hidden="true"></span>`:""}<span class="pd-glow" aria-hidden="true"></span><span class="pd-shine" aria-hidden="true"></span>
      <div class="pd-obj">
        <span class="pd-floor" aria-hidden="true"></span>
        ${K?"":`<span class="ge-back" aria-hidden="true"></span>`}
        <div class="pd-card">${gc(b,{cls:"flash",cover:K,amt:K?null:tagTxt(),amtId:"pAmtTag",style:"--g:"+lc})}</div>
        ${K?"":`<div class="ge-front" id="gEnv" aria-hidden="true"><b id="gHead">Ein Geschenk für dich</b><span id="gSub">${S.user?"Von "+esc(S.user.name):"Mit persönlicher Nachricht"}</span></div>`}
      </div>
    </div>
  </div>
  <div class="pd-side">
    <a class="pd-tag" href="/kategorie/${c.id}" style="--c:${CCOL[c.id]}">${ic(c.icon)}${esc(c.name)}</a>
    <h1 class="h1">${esc(b.name)}</h1>
    <div class="pact lg-group" role="group" aria-label="Aktionen">
      <button data-a="share" data-v="${id}">${ic("i-share")}<span>Teilen</span></button>
      <button data-a="fav" data-v="${id}" aria-pressed="${fav}" class="pact-fav">${ic(fav?"i-heart-f":"i-heart")}<span>${fav?"Gemerkt":"Merken"}</span></button>
      <button data-a="copyLink" data-v="${id}">${ic("i-copy")}<span>Link kopieren</span></button>
      ${K?"":`<button data-a="giftNow">${ic("i-gift")}<span>Verschenken</span></button>`}
    </div>
    ${vars.length>1?(vars.some(v=>v.rl)?`<span class="lbl">Land und Währung <small class="muted">· ${vars.length} Varianten</small></span><div class="variants regions">${vars.map(v=>`<a class="chip" href="/marke/${v.id}" ${v.id===id?'aria-current="page"':""}>${flagE(v.region||"DE")}${esc(regDE(v.region||"DE"))}<small>${esc(v.cur||"EUR")}</small></a>`).join("")}</div>`:`<span class="lbl">${K?"Plattform":"Variante"}</span><div class="variants">${vars.map(v=>`<a class="chip" href="/marke/${v.id}" ${v.id===id?'aria-current="page"':""}>${esc(varName(b,v))}</a>`).join("")}</div>`):""}
    <div class="pinfo"><div><span class="si-ic">${ic("i-pin")}</span><div><small>Gültig in</small><b>${region}</b></div></div><div><span class="si-ic">${ic("i-mail")}</span><div><small>Lieferung</small><b>Sofort per E&#8209;Mail</b></div></div>${K?`<div><span class="si-ic">${ic("i-monitor")}</span><div><small>Aktivierung</small><b>${esc(STORE[b.plat]||PLAT[b.plat])}</b></div></div><div><span class="si-ic">${ic("i-key")}</span><div><small>Typ</small><b>Digitaler Key</b></div></div>`:""}</div>
    ${b.amts.length>1||!K?`<span class="lbl" id="pAmtL">${card?"Betrag":"Option"}</span><div class="${card?"amounts":"opts"}" id="pAmts" role="group" aria-labelledby="pAmtL" data-off>${b.amts.map(a=>`<button class="amt" data-a="pAmt" data-v="${a}" aria-pressed="${a===P.a}"${soldOut(id,a)?" disabled":""}>${card&&!b.labels?money(a):esc(optLabel(b,a))}${amtSub(a)}</button>`).join("")}</div>`:""}${avail.length?"":`<p class="err pd-sold">Derzeit ausverkauft. Schau bald wieder vorbei.</p>`}
    <div class="pd-qty"><span class="lbl" id="pQL">Menge</span><div class="qty" role="group" aria-labelledby="pQL"><button data-a="pQty" data-v="-1" aria-label="Weniger">−</button><span id="pQ" aria-live="polite">1</span><button data-a="pQty" data-v="1" aria-label="Mehr">+</button></div></div>
    ${K?"":`<div class="giftbox spot">
      <div class="gb-h"><span class="gb-ic" aria-hidden="true">${ic("i-gift")}</span><div class="gb-t"><b id="gbL">Als Geschenk senden</b><small>Per E-Mail mit persönlicher Karte</small></div><button class="switch" role="switch" aria-checked="false" data-a="pGift" aria-labelledby="gbL"></button></div>
      <div class="gb-f" id="giftF" hidden>
        <label class="lbl" for="gTo">E-Mail der beschenkten Person</label><input class="inp" id="gTo" type="email" autocomplete="off" placeholder="name@beispiel.de">
        <label class="lbl" for="gName">Von</label><input class="inp" id="gName" autocomplete="name" placeholder="Dein Name" value="${esc(S.user?S.user.name:"")}">
        <label class="lbl" for="gMsg">Nachricht</label><textarea class="inp" id="gMsg" maxlength="200" placeholder="Alles Gute zum Geburtstag!"></textarea>
        <span class="lbl" id="gdL">Kartendesign</span><div class="designs" role="group" aria-labelledby="gdL">${DESIGNS.map((d,i)=>`<button data-a="pDesign" data-v="${i}" aria-pressed="${i===0}" aria-label="Design ${d[0]}"><i style="background:${d[1]}"></i><span>${d[0]}</span></button>`).join("")}</div>
        <div class="err" id="gErr" role="alert"></div>
      </div>
    </div>`}
    <div class="pd-sum spot"><div class="pd-tot"><span>Gesamt</span><b id="pTot">${money(total())}</b></div><p class="pd-save" id="pSave"${saving()?"":" hidden"}>Du sparst ${money(saving())} gegenüber dem Nennwert</p><p class="pd-fee">${taxHint()}</p></div>
    <div class="pd-buy" data-off><button class="btn btn-primary btn-lg" data-a="pBuy"${dis}>Jetzt kaufen</button><button class="btn btn-outline btn-lg" data-a="pAdd"${dis}>In den Warenkorb</button></div>
    ${xpayBox("pX","Express-Checkout")}
    ${payLogos(b)}
  </div>
  <div class="pd-info">
    <div class="tabs" role="tablist" aria-label="Produktinformationen">${["Beschreibung","Einlösen","Hinweise"].map((t,i)=>`<button role="tab" id="pt${i}" aria-controls="pp${i}" aria-selected="${!i}" tabindex="${i?-1:0}" data-a="ptab" data-v="${i}">${t}</button>`).join("")}</div>
    <div class="tabp" id="pp0" role="tabpanel" aria-labelledby="pt0" data-p="0"><p>${esc(descOf(b))}</p></div>
    <div class="tabp" id="pp1" role="tabpanel" aria-labelledby="pt1" data-p="1" hidden><ol class="pd-steps" id="redeemOl">${redeemSteps(b).map(x=>`<li>${esc(x)}</li>`).join("")}</ol></div>
    <div class="tabp" id="pp2" role="tabpanel" aria-labelledby="pt2" data-p="2" hidden><p>Gültig in ${region}. Es gelten die Bedingungen von ${esc(b.name)}${K?` und ${esc(PLAT[b.plat])}`:""}. Digitale Codes sind nach der Auslieferung vom Umtausch ausgeschlossen.</p></div>
  </div>
</div>
${similar.length?`<section class="sec pd-more">${secHead("Mehr aus "+esc(c.name),["/kategorie/"+c.id,"Alle"],railNav("simRail"))}${rail("simRail",similar,{cover:K})}</section>`:""}
<div class="pd-bar" id="pdBar"><div class="pd-bar-in"><span class="pd-bar-t"><b id="bbTot">${money(total())}</b><small id="bbSub">${esc(barSub())}</small></span><button class="btn btn-primary" data-a="pBuy"${dis}>Jetzt kaufen</button></div></div>
`,
  after(){if(b.rl)API("/product/"+encodeURIComponent(b.id)).then(j=>{const o=document.getElementById("redeemOl");if(o&&j.redeem){const st=String(j.redeem).replace(/<[^>]+>/g," ").split(/(?<=[.!])\s+|\n+|\r+/).map(x=>x.trim()).filter(x=>x.length>2).slice(0,8);if(st.length)o.innerHTML=st.map(x=>`<li>${esc(x)}</li>`).join("")}}).catch(()=>{});
    const stg=$("#pdStage"),bar=$("#pdBar"),buy=$(".pd-buy");
    stick($(".pd-side"));
    stg.addEventListener("pointerleave",()=>{stg.style.removeProperty("--mx");stg.style.removeProperty("--my")});
    const side=$(".pd-side");side.addEventListener("focusin",e=>{if(e.target.matches("input,textarea"))bar.classList.add("typing")});side.addEventListener("focusout",()=>bar.classList.remove("typing"));
    /* Kaufleiste (Handy): erscheint, wenn weder die Karte noch die Kaufknöpfe zu sehen sind – und verschwindet vor „Mehr aus …“ und der Fußzeile, damit sie nichts überdeckt */
    pdIO&&pdIO.disconnect();pdIO=null;
    if("IntersectionObserver" in window){const more=$(".pd-more"),ft=$("#ftr"),v=new Map([[stg,true],[buy,false]]);if(more)v.set(more,false);if(ft)v.set(ft,false);
      pdIO=new IntersectionObserver(es=>{es.forEach(e=>v.set(e.target,e.isIntersecting));bar.classList.toggle("show",!v.get(stg)&&!v.get(buy)&&!v.get(more)&&!v.get(ft))});[...v.keys()].forEach(el=>el&&pdIO.observe(el))}
    const giftOk=()=>!P.gift||/^\S+@\S+\.\S+$/.test(($("#gTo")||{}).value||"");
    const X=xpayMount($("#pX"),()=>[Object.assign({id,a:P.a,q:P.q},P.gift?{gift:{to:$("#gTo").value.trim(),name:$("#gName").value.trim(),msg:$("#gMsg").value.trim(),design:P.design}}:{})],{ctx:"product",ready:giftOk});
    const upd=()=>{$("#pTot").textContent=money(total());$("#bbTot").textContent=money(total());$("#bbSub").textContent=barSub();$("#pQ").textContent=P.q;
      const sv=saving(),ps=$("#pSave");ps.hidden=!sv;ps.textContent=`Du sparst ${money(sv)} gegenüber dem Nennwert`;X&&X.refresh()};
    const tag=()=>{const t=$("#pAmtTag");if(!t)return;t.textContent=tagRaw();t.classList.remove("tick");void t.offsetWidth;t.classList.add("tick")};
    A.pAmt=(v,el)=>{P.a=+v;$$("#pAmts .amt").forEach(x=>x.setAttribute("aria-pressed",x===el));upd();tag()};
    A.pQty=v=>{P.q=Math.max(1,Math.min(10,P.q+ +v));upd()};
    A.pGift=(v,el)=>{P.gift=!P.gift;el.setAttribute("aria-checked",P.gift);$("#giftF").hidden=!P.gift;stg.classList.toggle("gifting",P.gift);upd()};
    A.pDesign=(v,el)=>{P.design=+v;$$(".designs button").forEach(x=>x.setAttribute("aria-pressed",x===el));$(".pd").style.setProperty("--gd",DESIGNS[P.design][1])};
    const tabs=$$(".pd-info [role=tab]");
    A.ptab=(v,el)=>{tabs.forEach(x=>{const on=x===el;x.setAttribute("aria-selected",on);x.tabIndex=on?0:-1});$$(".pd-info .tabp").forEach(p=>p.hidden=p.dataset.p!==v)};
    $(".pd-info [role=tablist]").addEventListener("keydown",e=>{const i=tabs.indexOf(document.activeElement);if(i<0)return;const k={ArrowRight:1,ArrowLeft:-1,Home:-i,End:tabs.length-1-i}[e.key];if(k==null)return;e.preventDefault();const t=tabs[(i+k+tabs.length)%tabs.length];t.focus();A.ptab(t.dataset.v,t)});
    const gm=$("#gMsg"),gn=$("#gName"),gt=$("#gTo");
    if(gm){const gp=()=>{$("#gHead").textContent=gm.value.trim()||"Ein Geschenk für dich";$("#gSub").textContent=gn.value.trim()?"Von "+gn.value.trim():"Mit persönlicher Nachricht"};gm.addEventListener("input",gp);gn.addEventListener("input",gp);gt.addEventListener("input",()=>{$("#gErr").textContent="";X&&X.refresh()});gp()}
    const build=()=>{
      const it={id,a:P.a,q:P.q,type:"code"};
      if(P.gift){const to=gt.value.trim();if(!/^\S+@\S+\.\S+$/.test(to)){$("#gErr").textContent="Bitte gib eine gültige E-Mail-Adresse ein.";gt.focus();return null}
        it.gift={to,name:gn.value.trim(),msg:gm.value.trim(),design:P.design}}
      return it;
    };
    const none=()=>{if(P.a)return false;toast("Dieses Produkt ist gerade ausverkauft");return true};
    A.pAdd=()=>{if(none())return;const it=build();if(it)addCart(it)};
    A.pBuy=()=>{if(none())return;const it=build();if(it){addCart(it,true);go("/kasse")}};
  }};
}
A.fav=(id,el)=>{
  const on=!S.favs.includes(id);S.favs=on?[id].concat(S.favs):S.favs.filter(x=>x!==id);save();
  $$(`[data-a="fav"][data-v="${id}"]`).forEach(b=>{b.setAttribute("aria-pressed",on);b.innerHTML=ic(on?"i-heart-f":"i-heart")+(b.classList.contains("pact-fav")?`<span>${on?"Gemerkt":"Merken"}</span>`:"")});if(el&&!el.matches(`[data-v="${id}"]`)){el.setAttribute("aria-pressed",on)}
  toast(on?"Zu Favoriten hinzugefügt":"Aus Favoriten entfernt",on?["/konto/favoriten","Ansehen"]:null);
  if(cur.path.startsWith("/konto"))route();
};

/* ---------- Suche ---------- */
/* Alle Wörter müssen passen; Name zählt mehr als Schlagwörter und Kategorie */
function searchBrands(q){
  const words=String(q||"").toLowerCase().split(/\s+/).filter(Boolean);if(!words.length)return [];
  const score=b=>{let s=0;const n=b.name.toLowerCase(),tg=(b.tags||[]).join(" ").toLowerCase(),pl=(PLAT[b.plat]||"").toLowerCase(),cn=catById(b.cat).name.toLowerCase();
    for(const w of words){const x=n.startsWith(w)?4:n.includes(w)?3:(pl.includes(w)||tg.includes(w))?2:cn.includes(w)?1:0;if(!x)return 0;s+=x}return s+(isRep(b)?.1:0)};
  return dedupeGrp(BRANDS.map(b=>[b,score(b)]).filter(x=>x[1]).sort((a,b)=>b[1]-a[1]).map(x=>x[0]));
}
function searchPage(_,qs){
  const q=qs.get("q")||"", f=CATS.some(c=>c.id===qs.get("c"))?qs.get("c"):"all";
  return {tab:"cats",title:q?`Suche: ${q}`:"Suche",html:`${crumb([["Suche"]])}
<section class="sec srch">
  <h1 class="h1 page-h1">Suche</h1>
  <form class="srch-f" role="search" action="/suche"><div class="field">${ic("i-search")}<input id="sq" name="q" type="search" value="${esc(q)}" placeholder="Marke, Spiel oder Gutschein" aria-label="Suchbegriff" autocomplete="off" enterkeyhint="search"></div></form>
  <div class="chips" role="group" aria-label="Kategorie"><button class="chip" aria-pressed="${f==="all"}" data-a="sf" data-v="all">Alle</button>${CATSV().map(c=>`<button class="chip" aria-pressed="${f===c.id}" data-a="sf" data-v="${c.id}">${ic(c.icon)}${esc(c.short)}</button>`).join("")}</div>
  <p class="srch-n" id="scount" role="status"></p>
  <div id="sres"></div>
</section>`,
  after(){
    let F=f;const inp=$("#sq");
    const url=()=>{const v=inp.value.trim(),p=new URLSearchParams();if(v)p.set("q",v);if(F!=="all")p.set("c",F);try{history.replaceState(null,"","/suche"+(p.toString()?"?"+p:""))}catch(e){}};
    const draw=()=>{const v=inp.value.trim(),l=(v?searchBrands(v):VIS()).filter(b=>F==="all"||b.cat===F);
      $("#scount").textContent=l.length?`${l.length} ${l.length===1?"Ergebnis":"Ergebnisse"}${v?` für „${v}“`:""}`:"";
      $("#sres").innerHTML=l.length?tilesPaged(l):empty("Nichts gefunden",v?`Für „${esc(v)}“ gibt es in dieser Auswahl keine Treffer. Versuch einen Marken- oder Spielnamen.`:"In dieser Kategorie gibt es gerade keine Produkte.",["/kategorien","Kategorien ansehen"]);
      $$("#sres .rv").forEach(x=>x.classList.add("in"));moreIO&&$$("#sres [data-more]").forEach(e=>moreIO.observe(e))};
    A.sf=(v,el)=>{F=v;$$("[data-a=sf]").forEach(c=>c.setAttribute("aria-pressed",c===el));url();draw()};
    let t;inp.addEventListener("input",()=>{clearTimeout(t);t=setTimeout(()=>{url();draw()},140)});
    $(".srch-f").addEventListener("submit",e=>{e.preventDefault();clearTimeout(t);url();draw();inp.blur()});
    draw();if(!q)setTimeout(()=>inp.focus({preventScroll:true}),80);
  }};
}
function notFound(){return {html:`<section class="sec">${empty("Seite nicht gefunden","Diese Seite gibt es nicht oder nicht mehr.",["/","Zur Startseite"])}</section>`,title:"Nicht gefunden"}}
