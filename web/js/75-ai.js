/* ---------- Mia: KI-Shopberaterin ----------
   Chat: Glas-Fenster unter der Kopfzeile (Handy: Vollbild-Blatt von unten). Antworten kommen von /api/ai/chat
   (Claude mit Werkzeugen, ohne Schlüssel einfacher Modus). Mias Aktionen laufen sichtbar im Chat:
   Warenkorb (mit Rückgängig), Schnellkauf, Produkt, Kasse, Aufladen, Abo. Bezahlen kann nur die Kundin selbst.
   Absichtserkennung: läuft nur hier im Browser (sessionStorage). Erst wenn die Kundin im Chat schreibt oder
   auf „Mehr von Mia“ tippt, gehen Seite, angesehene Produkte, Warenkorb (ohne Kontaktdaten) und Absicht an den Server.
   Vorschläge: höchstens einer pro Seite, wenige pro Sitzung, schließbar, „Nicht mehr anzeigen“ wird gemerkt. */
const chat={open:false,started:false,from:null};
const MIA={log:[],busy:false,st:null,stP:null,sid:"",tip:null,tipT:0};
const miaSS={get:(k,d)=>{try{const v=sessionStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},set:(k,v)=>{try{sessionStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
MIA.sid=miaSS.get("mia_sid","")||(Math.random().toString(36).slice(2)+Date.now().toString(36)).slice(0,20);miaSS.set("mia_sid",MIA.sid);
MIA.log=miaSS.get("mia_log",[]);if(!Array.isArray(MIA.log))MIA.log=[];
const miaWait=ms=>new Promise(r=>setTimeout(r,ms));
const miaMob=()=>!matchMedia("(min-width:768px)").matches;
/* Kontaktdaten und Codes verlassen den Browser nicht (der Server maskiert zusätzlich) */
const miaMask=s=>String(s||"")
  .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g,"[E-Mail entfernt]")
  .replace(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){3,7}(?: ?[A-Z0-9]{1,4})?\b/gi,m=>m.replace(/\D/g,"").length>=12?"[Kontonummer entfernt]":m)
  .replace(/\b(?:[A-Z0-9]{4,6}[- ]){2,}[A-Z0-9]{3,6}\b/g,m=>/\d/.test(m)&&/[A-Z]/i.test(m)?"[Code entfernt]":m)
  .replace(/(?:\+|\b00)?\d[\d \/().-]{5,}\d/g,m=>m.replace(/\D/g,"").length>=7?(m.replace(/\D/g,"").length>=13&&!/^(\+|00)/.test(m)?"[Nummer entfernt]":"[Telefonnummer entfernt]"):m);
const miaShort=b=>shortNm(b).replace(/ (Gift Card|Geschenkkarte|Guthaben)$/,"");
const miaAmtT=(b,a)=>b.type==="card"&&!b.labels?money(a).replace(",00",""):optLabel(b,a);
const miaStatus=()=>MIA.st?Promise.resolve(MIA.st):(MIA.stP=MIA.stP||API("/ai/status").then(j=>(MIA.st=j)).catch(()=>{MIA.stP=null;return null}));

/* ---------- Absichtserkennung (nur lokal) ---------- */
const SIG=Object.assign({b:{},c:{},q:[],amt:{},gift:0,ck:0,ckLeft:0,top:0,topD:0,abo:0,shown:[],n:0,last:0,cart:0,added:null},miaSS.get("mia_sig",{}));
const MI={cur:null,key:"",hid:0,hidAt:0,lastKey:0,lastAct:0,qbId:null,tm:0,tries:0,pageShown:false,ret:false};
const sigSave=()=>miaSS.set("mia_sig",SIG);
const miaTerm=q=>{q=miaMask(String(q||"").trim()).slice(0,40);if(q.length<2)return;SIG.q=SIG.q.filter(x=>x!==q).concat(q).slice(-6);sigSave()};
(()=>{try{const t=+S.miaSeen||0;if(!miaSS.get("mia_seen",0)){MI.ret=!!t&&Date.now()-t>6*36e5;miaSS.set("mia_seen",1)}S.miaSeen=Date.now();save()}catch(e){}})();
function miaCartCheck(){const n=cartCount();if(n>SIG.cart&&S.cart.length){const l=S.cart[S.cart.length-1];SIG.added={id:l.id,t:Date.now()}}SIG.cart=n}
function miaView(){
  const p=location.pathname,key=p+location.search,now=Date.now();if(key===MI.key)return;MI.key=key;
  if(MI.cur){const d=Math.max(0,Math.min(300e3,now-MI.cur.t-MI.hid));if(MI.cur.b&&SIG.b[MI.cur.b])SIG.b[MI.cur.b].d+=d;if(MI.cur.p==="/aufladen")SIG.topD+=d}
  MI.cur={p,t:now,b:null};MI.hid=0;MI.pageShown=false;MI.tries=0;miaTipHide(true);
  let m;
  if((m=p.match(/^\/marke\/([\w-]+)$/))){const b=byId(m[1]);if(b){const e=SIG.b[b.id]||(SIG.b[b.id]={n:0,d:0,c:b.cat,t:0});e.n++;e.t=now;MI.cur.b=b.id;if(b.cat==="topup")SIG.top=now}}
  else if((m=p.match(/^\/kategorie\/([\w-]+)$/)))SIG.c[m[1]]=(SIG.c[m[1]]||0)+1;
  else if(p==="/suche")miaTerm(new URLSearchParams(location.search).get("q"));
  else if(p==="/aufladen")SIG.top=now;
  else if(p==="/abo")SIG.abo=now;
  if(/^\/(kasse|warenkorb)$/.test(p)&&S.cart.length)SIG.ck=now;
  else if(SIG.ck&&!/^\/(kasse|warenkorb|bestellung)/.test(p)&&S.cart.length){SIG.ckLeft=now;SIG.ck=0}
  if(/^\/bestellung\//.test(p)){SIG.ck=0;SIG.ckLeft=0}
  miaCartCheck();sigSave();miaSchedule(6000);
}
/* Kandidaten für einen Vorschlag, wichtigste zuerst */
const MIA_PAIR={psn:["psplus-essential","Für Online-Spiele auf PS4 und PS5 brauchst du in der Regel PlayStation Plus."],nintendo:["nso","Für Online-Spiele auf der Switch brauchst du Nintendo Switch Online."],xbox:["gpu",""],ea:["eaplay",""]};
const MIA_ABO=["netflix","spotify","disney","dazn","crunchyroll","psplus-essential","psplus-extra","psplus-premium","gpu","pcgp","nso","nsoplus","eaplay"];
function miaIntents(all){
  const now=Date.now(),p=location.pathname,cb=MI.cur&&MI.cur.b?byId(MI.cur.b):null,L=[],inCart=id=>S.cart.some(i=>i.id===id);
  if(SIG.ckLeft&&now-SIG.ckLeft<20*60e3&&S.cart.length&&!/^\/(kasse|warenkorb)/.test(p))
    L.push({k:"checkout",p:100,text:"Dein Warenkorb ist gespeichert. Hast du eine Frage zur Bezahlung oder zum Code? Ich helfe gern.",acts:[["go","/kasse","Zur Kasse"]],more:"Ich habe eine Frage zur Bezahlung, bevor ich bestelle."});
  if(cb&&cb.amts.length>1&&cb.cat!=="topup"){const s=SIG.amt[cb.id]||[],d=[...new Set(s)];
    if(s.length>=3&&d.length>=2)L.push({k:"dither",id:cb.id,amts:d.slice(-4),p:90,text:`Unsicher, welcher Betrag passt? Tipp auf einen Betrag für den Schnellkauf oder frag mich.`,acts:cb.amts.filter(a=>!soldOut(cb.id,a)).slice(0,4).map(a=>["qb",cb.id+"|"+a,miaAmtT(cb,a)]),more:`Welcher Betrag passt bei ${miaShort(cb)} für mich?`})}
  if(SIG.added&&now-SIG.added.t<10*60e3){const x=MIA_PAIR[SIG.added.id],yb=x&&byId(x[0]);
    if(yb&&!inCart(yb.id)&&(!cb||cb.id!==yb.id))L.push({k:"pairs",id:SIG.added.id,p:75,text:`Passt oft dazu: ${yb.name}. ${x[1]}`.trim(),acts:[["qb",yb.id,"Schnellkauf"],["go","/marke/"+yb.id,"Ansehen"]],more:`Was passt zu ${miaShort(byId(SIG.added.id))}?`})}
  const gc3=["shopping","entertainment","apps"],gv=Object.values(SIG.b).filter(e=>gc3.includes(e.c)).length,gq=SIG.q.some(q=>/geschenk|schenk|geburtstag|weihnacht/i.test(q));
  if(cb&&!isKey(cb)&&cb.cat!=="topup"&&!SIG.gift&&$(".giftbox")&&(gq||(gv>=3&&gc3.includes(cb.cat))))
    L.push({k:"gift",id:cb.id,p:70,text:`Suchst du ein Geschenk? ${miaShort(cb)} kannst du mit persönlicher Nachricht direkt per E-Mail verschicken.`,acts:[["gift","","Als Geschenk senden"]],more:"Ich suche ein Geschenk. Was passt?"});
  const fav=Object.entries(SIG.b).filter(([id,e])=>(e.n>=2||e.d>=40e3)&&byId(id)&&byId(id).cat!=="topup"&&!inCart(id)&&(!cb||cb.id!==id)).sort((a,b)=>b[1].t-a[1].t)[0];
  if(fav&&!/^\/(kasse|warenkorb)/.test(p)){const b=byId(fav[0]);
    L.push({k:"brand",id:b.id,p:50,text:`Noch auf der Suche nach ${miaShort(b)}? Hier geht es direkt zum Betrag.`,acts:b.amts.filter(a=>!soldOut(b.id,a)).slice(0,3).map(a=>["qb",b.id+"|"+a,miaAmtT(b,a)]),more:`Ich interessiere mich für ${miaShort(b)}. Was passt für mich?`})}
  if(Object.keys(SIG.b).filter(id=>MIA_ABO.includes(id)).length>=2&&!SIG.abo&&p!=="/abo")
    L.push({k:"abo",p:40,text:"Mehrere Dienste im Blick? Das instantcodes Abo liefert jeden Monat ein Paket mit Codes und ist online kündbar.",acts:[["go","/abo","Abo ansehen"]],more:"Erzähl mir mehr über das Abo."});
  if(p!=="/aufladen"&&((SIG.top&&SIG.topD>=15e3&&now-SIG.top<30*60e3)||SIG.q.some(q=>/aufladen|prepaid|handy/i.test(q))))
    L.push({k:"topup",p:30,text:"Handy aufladen? Nummer eingeben, der Anbieter wird meist erkannt, das Guthaben kommt direkt nach der Zahlung.",acts:[["go","/aufladen","Jetzt aufladen"]],more:"Ich möchte mein Handy aufladen."});
  if(MI.ret&&p==="/"&&S.recent&&S.recent[0]&&byId(S.recent[0])&&!inCart(S.recent[0])){const b=byId(S.recent[0]);
    L.push({k:"return",id:b.id,p:20,text:`Willkommen zurück. Zuletzt hast du dir ${miaShort(b)} angesehen.`,acts:b.cat==="topup"?[["go","/aufladen?op="+b.id,"Aufladen"]]:[["qb",b.id,"Schnellkauf"],["go","/marke/"+b.id,"Ansehen"]],more:`Ich war vorhin bei ${miaShort(b)}.`})}
  return L.filter(x=>all||!SIG.shown.includes(x.k)).sort((a,b)=>b.p-a.p);
}
const miaTop=()=>{const c=miaIntents(true)[0];return c?{k:c.k,id:c.id||null,amts:c.amts||[]}:null};
/* Vorschläge nur, wenn nichts anderes offen ist, niemand tippt und die Seite kein Rechtstext/Kasse ist */
const miaOv=()=>["#scrim","#menu","#drawer","#pal"].some(s=>{const e=$(s);return e&&e.classList.contains("open")})||($("#cookie")&&$("#cookie").classList.contains("show"))||($("#qpanel")&&!$("#qpanel").hidden)||!!$(".proc");
const MIA_QUIET=/^\/(agb|datenschutz|widerruf|kuendigen|kasse|login|verifizieren|passwort|bestellung|konto|abo\/)/;
function miaCan(){
  const now=Date.now(),ae=document.activeElement;
  if(S.miaOff||!MI.cur||MIA_QUIET.test(location.pathname))return 0;
  if(SIG.n>=3||now-SIG.last<90e3||MI.pageShown)return 0;
  if(document.hidden||chat.open||miaOv())return 1;
  if(ae&&(/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)||ae.isContentEditable))return 1;
  if(now-MI.lastKey<4000||now-MI.lastAct<3000||now-MI.cur.t<5000)return 1;
  return 2;
}
function miaSchedule(ms){clearTimeout(MI.tm);MI.tm=setTimeout(miaTick,ms)}
async function miaTick(){
  const c=miaCan();if(!c)return;
  if(c===1){if(++MI.tries<8)miaSchedule(4000);return}
  const st=await miaStatus();if(!st||!st.proactive)return;
  const x=miaIntents()[0];if(x&&miaCan()===2)miaTipShow(x);
}
document.addEventListener("keydown",()=>{MI.lastKey=Date.now()},true);
document.addEventListener("input",()=>{MI.lastKey=Date.now()},true);
document.addEventListener("visibilitychange",()=>{if(document.hidden)MI.hidAt=Date.now();else if(MI.hidAt){MI.hid+=Date.now()-MI.hidAt;MI.hidAt=0}});
document.addEventListener("click",e=>{
  const t=e.target.closest&&e.target.closest("[data-a],.giftbox .switch,.pal-item");if(!t)return;
  const a=t.dataset&&t.dataset.a;MI.lastAct=Date.now();
  if(a==="qb")MI.qbId=t.dataset.v;
  if(a==="pAmt"||a==="qbAmt"){const id=a==="pAmt"?MI.cur&&MI.cur.b:MI.qbId;if(id){SIG.amt[id]=(SIG.amt[id]||[]).concat(+t.dataset.v).slice(-12);sigSave();if(a==="pAmt")miaSchedule(3500)}}
  if(a==="giftNow"||t.matches(".giftbox .switch")){SIG.gift=Date.now();sigSave()}
  if(t.matches(".pal-item")){const v=$("#palIn");v&&miaTerm(v.value)}
  const inChat=!!t.closest("#chat");setTimeout(()=>{const n=SIG.cart;miaCartCheck();if(SIG.cart>n){sigSave();if(!inChat)miaSchedule(5000)}},80);
},true);
(()=>{const i=$("#palIn");i&&i.addEventListener("keydown",e=>{if(e.key==="Enter")miaTerm(i.value)})})();
try{new MutationObserver(()=>miaView()).observe($("#app"),{childList:true})}catch(e){}

/* ---------- Vorschlags-Blase ---------- */
const miaLive=(()=>{const d=document.createElement("div");d.className="sr";d.id="miaLive";d.setAttribute("role","status");d.setAttribute("aria-live","polite");d.setAttribute("aria-atomic","true");document.body.appendChild(d);return d})();
const miaSay=t=>{miaLive.textContent="";setTimeout(()=>{miaLive.textContent=t},60)};
const miaTipEl=(()=>{const d=document.createElement("aside");d.className="mia-tip";d.id="miaTip";d.hidden=true;d.setAttribute("aria-label","Vorschlag von Mia");document.body.appendChild(d);
  d.addEventListener("pointerenter",()=>clearTimeout(MIA.tipT));d.addEventListener("focusin",()=>clearTimeout(MIA.tipT));
  d.addEventListener("pointerleave",()=>{if(!d.contains(document.activeElement))MIA.tipT=setTimeout(()=>miaTipHide(),9000)});return d})();
function miaTipShow(c){
  MI.pageShown=true;SIG.n++;SIG.last=Date.now();SIG.shown.push(c.k);sigSave();MIA.tip=c;
  const el=miaTipEl;
  el.innerHTML=`<span class="mia-av sm" aria-hidden="true">${LOGO(22)}</span><div class="mia-tip-b"><p class="mia-tip-t"><b>Mia</b>${esc(c.text)}</p>
    ${c.acts&&c.acts.length?`<div class="mia-tip-acts">${c.acts.map((x,i)=>`<button type="button" class="mia-chip${x[0]==="go"||x[0]==="gift"?" strong":""}" data-a="miaTipAct" data-v="${i}">${esc(x[2])}</button>`).join("")}</div>`:""}
    <div class="mia-tip-f"><button type="button" class="mia-more" data-a="miaTipMore">${ic("i-chat")}Mehr von Mia</button><button type="button" class="mia-off" data-a="miaOff">Nicht mehr anzeigen</button></div></div>
    <button type="button" class="mia-x sm" data-a="miaTipClose" aria-label="Vorschlag schließen">${ic("i-x")}</button>`;
  el.hidden=false;if(!miaMob())underHdr(el);el.dataset.k=c.k;
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add("show")));
  miaSay("Vorschlag von Mia: "+c.text);
  clearTimeout(MIA.tipT);MIA.tipT=setTimeout(()=>{if(!el.matches(":hover,:focus-within"))miaTipHide()},16000);
}
function miaTipHide(now){const el=miaTipEl;clearTimeout(MIA.tipT);if(el.hidden)return;el.classList.remove("show");if(now===true){el.hidden=true;return}setTimeout(()=>{if(!el.classList.contains("show"))el.hidden=true},320)}
A.miaTipClose=()=>miaTipHide();
A.miaTipAct=v=>{const c=MIA.tip,x=c&&c.acts[+v];if(!x)return;miaTipHide();
  if(x[0]==="qb"){const [id,a]=x[1].split("|");A.qb(id,a?+a:undefined)}else if(x[0]==="go")go(x[1]);else if(x[0]==="gift"&&A.giftNow)A.giftNow()};
A.miaTipMore=(v,el)=>{const c=MIA.tip;miaTipHide(true);A.chatOpen(null,$("#hai"));if(c)miaAsk(c.more,{intent:{k:c.k,id:c.id||null,amts:c.amts||[]}})};
A.miaOff=()=>{S.miaOff=true;save();miaTipHide();toast("Mia zeigt keine Vorschläge mehr. Im Chat ist sie weiter für dich da.")};
A.miaOn=()=>{S.miaOff=false;save();toast("Vorschläge von Mia sind wieder an.");miaRenderNote()};

/* ---------- Chat ---------- */
const MIA_LBL={"/agb":"AGB","/widerruf":"Widerrufsbelehrung","/datenschutz":"Datenschutz","/hilfe":"Hilfe","/kuendigen":"Kündigungsseite","/abo":"Abo-Seite","/aufladen":"Aufladeseite","/angebote":"Angebote","/warenkorb":"Warenkorb","/kasse":"Kasse","/konto/bestellungen":"Meine Bestellungen","/konto":"Kundenkonto","/kategorien":"Kategorien","/login":"Anmeldung"};
function miaFmt(t){
  let h=esc(t).replace(/\*\*([^*\n]{1,80})\*\*/g,"<b>$1</b>");
  h=h.replace(/(^|[\s(„"])(\/(?:agb|widerruf|datenschutz|hilfe|kuendigen|abo|aufladen|angebote|warenkorb|kasse|konto\/bestellungen|konto|kategorien|login))(?=[\s.,;:!?)“"]|$)/g,(m,a,p)=>`${a}<a href="${p}">${MIA_LBL[p]||p}</a>`);
  const sup=esc(CFG.support||"");if(sup)h=h.split(sup).join(`<a href="mailto:${sup}">${sup}</a>`);
  return h.replace(/\n/g,"<br>");
}
const miaLogEl=()=>$("#chatLog");
const miaEnd=(smooth)=>{const l=miaLogEl();if(l)l.scrollTo({top:l.scrollHeight,behavior:smooth&&!reduce?"smooth":"auto"})};
const miaSave=()=>miaSS.set("mia_log",MIA.log.slice(-30));
function miaNoteHTML(){
  const st=MIA.st,ai=!st||st.ai;
  return `<div class="mia-note">${ic("i-shield")}<p>${ai?`Mia ist eine KI und kann sich irren. Deine Nachrichten werden zur Beantwortung an Anthropic übermittelt, dazu Seite, angesehene Produkte und Warenkorb (ohne Kontaktdaten).`:`Mia antwortet gerade im einfachen Modus ohne KI. Deine Nachrichten werden nur zur Beantwortung an instantcodes übermittelt.`}${st&&st.test?" Testmodus: feste Testantworten.":""} <a href="/datenschutz">Datenschutz</a>${S.miaOff?` · <button type="button" class="mia-lnk" data-a="miaOn">Vorschläge wieder einschalten</button>`:""}</p></div>`;
}
function miaRenderNote(){const n=$("#chatLog .mia-note");if(n)n.outerHTML=miaNoteHTML();const s=$("#miaSub");if(s&&MIA.st)s.textContent=MIA.st.ai?(MIA.st.test?"KI-Shopberaterin · Testmodus":"KI-Shopberaterin von instantcodes"):"Digitale Assistentin · einfacher Modus"}
function miaCardHTML(c){
  const b=byId(c.id);if(!b)return "";
  const card=b.type==="card",avail=b.amts.filter(a=>!soldOut(b.id,a)),def=b.amts[Math.min(1,b.amts.length-1)];
  const a=c.a!=null&&avail.includes(+c.a)?+c.a:avail.includes(def)?def:(avail[0]||0);
  const sub=[catById(b.cat).name,isKey(b)&&b.plat?PLAT[b.plat]:"",REGION[b.region]||""].filter(Boolean).map(esc).join(" · ");
  return `<div class="mia-card" data-id="${b.id}" data-amt="${a||""}">
    <a class="mia-gc" href="/marke/${b.id}" tabindex="-1" aria-hidden="true">${gc(b,{tilt:false,badge:false,plat:false})}</a>
    <div class="mia-ci"><a class="mia-cn" href="/marke/${b.id}">${esc(b.name)}</a><span class="mia-cs">${sub}</span><span class="mia-cpr"><b class="mia-cp">${a?money(price(b,a)):"Derzeit ausverkauft"}</b><a class="mia-lnk" href="/marke/${b.id}" aria-label="${esc(b.name)} ansehen">Ansehen</a></span></div>
    ${b.amts.length>1&&b.cat!=="topup"?`<div class="mia-amts" role="group" aria-label="${card?"Betrag":"Option"} für ${esc(b.name)}">${b.amts.slice(0,6).map(x=>`<button type="button" class="mia-amt" data-a="miaAmt" data-v="${x}" aria-pressed="${x===a}"${soldOut(b.id,x)?" disabled":""}>${esc(miaAmtT(b,x))}</button>`).join("")}</div>`:""}
    <div class="mia-cb">${b.cat==="topup"?`<button type="button" class="btn btn-primary btn-sm" data-a="miaGo" data-v="/aufladen?op=${b.id}">Aufladen</button>`
      :`<button type="button" class="btn btn-primary btn-sm" data-a="miaBuy" data-v="${b.id}"${a?"":" disabled"}>Sofort kaufen</button><button type="button" class="btn btn-soft btn-sm" data-a="miaAdd" data-v="${b.id}"${a?"":" disabled"}>In den Warenkorb</button>`}</div>
  </div>`;
}
const MIA_ACT={qb:"Schnellkauf öffnen",open:"Produkt ansehen",checkout:"Zur Kasse",topup:"Handy aufladen",abo:"Abo ansehen"};
const MIA_DONE={qb:"Schnellkauf geöffnet",open:"Produktseite geöffnet",checkout:"Kasse geöffnet",topup:"Aufladeseite geöffnet",abo:"Abo-Seite geöffnet"};
const miaActLbl=x=>{const b=x.id&&byId(x.id);return x.t==="link"?x.label:x.t==="qb"&&b?`${b.name}${x.a?" "+miaAmtT(b,x.a):""}`:x.t==="open"&&b?b.name:x.t==="topup"&&x.op&&byId(x.op)?byId(x.op).name+" aufladen":MIA_ACT[x.t]||""};
function miaActHTML(x,i,mi){
  const b=x.id&&byId(x.id);
  if(x.t==="cart"&&b){
    if(x.done)return `<div class="mia-done${x.undone?" undone":""}">${ic(x.undone?"i-x":"i-check")}<span>${x.undone?"Entfernt":"Im Warenkorb"}: ${esc(b.name)} ${esc(miaAmtT(b,x.a))}${x.q>1?` × ${x.q}`:""}</span>${x.undone?"":`<button type="button" class="mia-lnk" data-a="miaUndo" data-v="${mi}|${i}">Rückgängig</button>`}</div>`;
    return `<button type="button" class="mia-chip strong" data-a="miaDo" data-v="${mi}|${i}">${esc(b.name)} ${esc(miaAmtT(b,x.a))} in den Warenkorb</button>`;
  }
  const lbl=miaActLbl(x);if(!lbl)return "";
  if(x.done)return `<div class="mia-done">${ic("i-check")}<span>${esc(MIA_DONE[x.t]||"Erledigt")}</span><button type="button" class="mia-lnk" data-a="miaDo" data-v="${mi}|${i}">${x.t==="qb"?"Nochmal öffnen":"Nochmal"}</button></div>`;
  return x.t==="link"?`<a class="mia-chip strong" href="${esc(x.href)}">${esc(lbl)}</a>`:`<button type="button" class="mia-chip strong" data-a="miaDo" data-v="${mi}|${i}">${esc(lbl)}</button>`;
}
function miaMsgHTML(m,i){
  if(m.r==="u")return `<div class="mia-g user" data-i="${i}"><div class="mia-m user"><p>${esc(m.t)}</p>${m.masked?`<small>Kontaktdaten und Codes wurden vor dem Senden entfernt.</small>`:""}</div></div>`;
  const cards=(m.cards||[]).map(miaCardHTML).join(""),acts=(m.acts||[]).map((x,j)=>miaActHTML(x,j,i)).join("");
  return `<div class="mia-g bot" data-i="${i}"><div class="mia-m bot${m.err?" err":""}">${m.t?`<p>${miaFmt(m.t)}</p>`:""}${m.note?`<small class="mia-mode">${esc(m.note)}</small>`:""}</div>${cards?`<div class="mia-cards">${cards}</div>`:""}${acts?`<div class="mia-acts">${acts}</div>`:""}</div>`;
}
function miaRender(){const l=miaLogEl();if(!l)return;l.innerHTML=miaNoteHTML()+MIA.log.map(miaMsgHTML).join("");l.classList.add("still");requestAnimationFrame(()=>l.classList.remove("still"));miaEnd()}
function miaAppend(i){const l=miaLogEl();if(!l)return;const t=document.createElement("template");t.innerHTML=miaMsgHTML(MIA.log[i],i);l.appendChild(t.content);miaEnd(true)}
function miaRedraw(i){const g=$(`#chatLog .mia-g[data-i="${i}"]`);if(!g)return;const t=document.createElement("template");t.innerHTML=miaMsgHTML(MIA.log[i],i);const n=t.content.firstElementChild;n.classList.add("still");g.replaceWith(n)}
function miaStarters(){
  const b=MI.cur&&MI.cur.b?byId(MI.cur.b):null,c=miaIntents(true)[0],L=[];
  if(b&&b.cat!=="topup"&&b.amts.length>1)L.push(`Welcher Betrag passt bei ${miaShort(b)}?`);
  if(c&&c.more&&!(L.length&&b&&c.id===b.id&&(c.k==="dither"||c.k==="brand")))L.push(c.more);
  L.push("Geschenk finden","Handy aufladen","Wie löse ich einen Code ein?","Wie schnell kommt mein Code?");
  return [...new Set(L)].slice(0,4);
}
function miaChips(list){const q=$("#chatQr");if(!q)return;const used=new Set(MIA.log.filter(m=>m.r==="u").map(m=>m.t));list=(list||[]).filter(x=>!used.has(x)).slice(0,4);
  q.innerHTML=list.map(x=>`<button type="button" class="mia-chip" data-a="chatQ" data-v="${esc(x)}">${esc(x)}</button>`).join("");q.hidden=!list.length}
function miaTyping(on){const l=miaLogEl();if(!l)return;const t=$(".mia-m.typing",l);if(on&&!t){l.insertAdjacentHTML("beforeend",`<div class="mia-m bot typing" aria-hidden="true"><i></i><i></i><i></i></div>`);miaEnd(true);miaSay("Mia schreibt …")}if(!on&&t)t.remove()}
function miaCtx(intent){
  const p=location.pathname,page=/^\/bestellung\//.test(p)?"/bestellung":/^\/abo\/AB-/.test(p)?"/abo/vertrag":/^\/konto/.test(p)?"/konto":/^\/[\w\-\/]{0,60}$/.test(p)?p:"/";
  return {page,viewed:(S.recent||[]).filter(id=>byId(id)).slice(0,5),cart:S.cart.slice(0,10).map(i=>({id:i.id,a:i.a,q:i.q})),q:SIG.q.slice(-3),intent:intent||miaTop()};
}
async function miaAsk(text,o={}){
  text=String(text||"").replace(/\s+/g," ").trim().slice(0,500);if(!text||MIA.busy)return;
  MIA.busy=true;$("#chatForm").classList.add("busy");miaChips([]);
  const masked=miaMask(text);MIA.log.push({r:"u",t:text,masked:masked!==text||undefined});miaSave();miaAppend(MIA.log.length-1);
  miaTyping(true);
  const hist=MIA.log.filter(m=>!m.err&&!m.loc&&(m.r==="u"||m.r==="a")).slice(-12).map(m=>({r:m.r,t:m.r==="u"?miaMask(m.t):m.t,shown:m.cards&&m.cards.length?m.cards.map(c=>c.id):undefined}));
  const t0=Date.now();let j;
  try{j=await API("/ai/chat",{method:"POST",body:{messages:hist,ctx:miaCtx(o.intent),sid:MIA.sid}})}
  catch(e){j={err:1,reply:e.message||"Verbindung fehlgeschlagen. Bitte versuch es erneut.",chips:["Nochmal versuchen"],retry:text}}
  const w=(reduce?0:520)-(Date.now()-t0);if(w>0)await miaWait(w);
  miaTyping(false);
  const m={r:"a",t:String(j.reply||""),cards:(j.cards||[]).filter(c=>byId(c.id)).slice(0,3),acts:(j.actions||[]).slice(0,4),note:j.note||null,mode:j.mode,err:j.err||undefined,retry:j.retry};
  MIA.log.push(m);const i=MIA.log.length-1;
  const nav=miaRun(m);miaSave();miaAppend(i);miaSay("Mia: "+m.t);
  MIA.busy=false;$("#chatForm").classList.remove("busy");
  miaChips(j.chips||(m.acts.some(x=>x.t==="cart")?["Zur Kasse","Passt noch etwas dazu?"]:m.cards.length?["Wie löse ich das ein?","Als Geschenk verschicken"]:miaStarters()));
  requestAnimationFrame(()=>miaEnd(true));
  if(nav)setTimeout(()=>miaDo(nav,true),reduce?60:650);
  if(chat.open&&!miaMob())setTimeout(()=>{const f=$("#chatIn");f&&document.activeElement===document.body&&f.focus({preventScroll:true})},50);
}
/* Aktionen ausführen: Warenkorb sofort (mit Rückgängig), höchstens eine Navigation automatisch, alles andere als Knopf */
function miaRun(m){
  let nav=null;
  m.acts=m.acts.filter(x=>x&&(x.t==="link"||MIA_ACT[x.t]||x.t==="cart"));
  for(const x of m.acts){
    if(!x.auto)continue;
    if(x.t==="cart"){const b=byId(x.id);if(b&&b.amts.includes(+x.a)&&b.cat!=="topup"){addCart({id:b.id,a:+x.a,q:Math.max(1,Math.min(5,+x.q||1)),type:"code"},true);x.done=1}}
    else if(!nav&&MIA_ACT[x.t]){nav=x;x.done=1}
    x.auto=false;
  }
  return nav;
}
function miaDo(x,auto){
  if(x.t==="cart"){const b=byId(x.id);if(!b)return;addCart({id:b.id,a:+x.a,q:x.q||1,type:"code"},true);return}
  if(x.t==="qb"){const b=byId(x.id);if(!b)return;chatClose(true);const h=$("#hai");h&&h.focus({preventScroll:true});A.qb(b.id,x.a||undefined);return}
  const href=x.t==="open"?`/marke/${x.id}`:x.t==="checkout"?"/kasse":x.t==="topup"?`/aufladen${x.op?`?op=${encodeURIComponent(x.op)}`:""}`:x.t==="abo"?"/abo":null;
  if(!href)return;if(miaMob())chatClose(true);go(href);
}
A.miaDo=v=>{const [mi,ai]=String(v).split("|").map(Number),m=MIA.log[mi],x=m&&m.acts&&m.acts[ai];if(!x)return;miaDo(x);if(x.t==="cart"){x.done=1;x.undone=0;miaSave();miaRedraw(mi)}};
A.miaUndo=v=>{const [mi,ai]=String(v).split("|").map(Number),m=MIA.log[mi],x=m&&m.acts&&m.acts[ai];if(!x||x.undone)return;
  const it=S.cart.find(i=>i.id===x.id&&+i.a===+x.a&&!i.gift&&!i.phone);if(it){it.q-=x.q||1;if(it.q<=0)S.cart.splice(S.cart.indexOf(it),1);save();updBadges(true);SIG.cart=cartCount();sigSave()}
  x.undone=1;miaSave();miaRedraw(mi);miaSay("Aus dem Warenkorb entfernt");const f=$("#chatIn");f&&f.focus({preventScroll:true})};
A.miaAmt=(v,el)=>{const c=el.closest(".mia-card"),b=c&&byId(c.dataset.id);if(!b)return;c.dataset.amt=v;$$(".mia-amt",c).forEach(x=>x.setAttribute("aria-pressed",String(x===el)));
  const p=$(".mia-cp",c);if(p){p.textContent=money(price(b,+v));p.classList.remove("tick");void p.offsetWidth;p.classList.add("tick")}$$("[data-a=miaBuy],[data-a=miaAdd]",c).forEach(x=>x.disabled=false)};
A.miaAdd=(id,el)=>{const c=el.closest(".mia-card"),b=byId(id),a=c&&+c.dataset.amt;if(!b||!a)return;addCart({id:b.id,a,q:1,type:"code"},true);
  el.classList.add("ok");el.innerHTML=`${ic("i-check")}Im Warenkorb`;miaSay(`${b.name} ${miaAmtT(b,a)} liegt im Warenkorb`);setTimeout(()=>{if(el.isConnected){el.classList.remove("ok");el.textContent="In den Warenkorb"}},2400)};
A.miaBuy=(id,el)=>{const c=el.closest(".mia-card"),a=c&&+c.dataset.amt;miaDo({t:"qb",id,a})};
A.miaGo=v=>{if(miaMob())chatClose(true);go(v)};
A.chatQ=v=>{if(v==="Zur Kasse"&&S.cart.length){miaDo({t:"checkout"});return}if(v==="Nochmal versuchen"){const l=MIA.log[MIA.log.length-1];if(l&&l.err&&l.retry){MIA.log.splice(-2,2);miaSave();miaRender();miaAsk(l.retry)}return}miaAsk(v)};
function miaGreet(){
  const n=S.user&&S.user.name?" "+S.user.name.split(" ")[0]:"";
  MIA.log.push({r:"a",loc:1,t:`Hi${n}, ich bin Mia, die KI-Shopberaterin von instantcodes. Ich helfe dir, das passende Guthaben oder den richtigen Gutschein zu finden, und lege es dir auf Wunsch direkt in den Warenkorb. Wonach suchst du?`,acts:[],cards:[]});miaSave();
}
A.chatOpen=(v,el)=>{
  if(!chat.open)chat.from=el&&el.closest&&!el.closest("#menu,#qpanel,#miaTip")&&el.isConnected?el:$("#hai");
  try{closeMenu(true);palClose(true);qaClose();nudgeHide();A.cartClose()}catch(e){}
  miaTipHide(true);
  const ch=$("#chat");if(!ch)return;
  if(!miaMob()){underHdr(ch);const o=originAt(ch,$("#hai"),true);if(o)ch.style.setProperty("--ox",o[0])}
  const hd=$("#hai .hai-dot");hd&&hd.remove();const bd=$("#chatBadge");if(bd){bd.dataset.n="0";bd.textContent=""}
  if(!MIA.log.length)miaGreet();
  if(!chat.started){chat.started=true;miaRender();miaChips(miaStarters())}
  chat.open=true;ch.classList.add("open");document.documentElement.classList.toggle("mia-lock",miaMob());$("#miaScrim").classList.add("open");
  $$("#hai,#chatFab").forEach(b=>b.setAttribute("aria-expanded","true"));
  miaStatus().then(()=>miaRenderNote());miaEnd();
  setTimeout(()=>{const f=matchMedia("(pointer:fine)").matches?$("#chatIn"):$("#chat .mia-x");f&&f.focus({preventScroll:true})},90);
};
function chatClose(silent){
  if(!chat.open)return;chat.open=false;const ch=$("#chat");ch.classList.remove("open");ch.style.transform="";$("#miaScrim").classList.remove("open");document.documentElement.classList.remove("mia-lock");
  $$("#hai,#chatFab").forEach(b=>b.setAttribute("aria-expanded","false"));
  const f=chat.from||$("#hai");if(silent!==true&&f&&document.contains(f))f.focus({preventScroll:true});
}
A.chatClose=(v,el)=>chatClose(!!el&&el.tagName==="A");
A.chatToggle=(v,el)=>chat.open?chatClose():A.chatOpen(v,el);
$("#hai").setAttribute("aria-expanded","false");$("#hai").setAttribute("aria-controls","chat");
["pointerenter","focus","touchstart"].forEach(ev=>$("#hai").addEventListener(ev,()=>miaStatus(),{once:true,passive:true}));
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();const i=$("#chatIn"),v=i.value.trim();if(!v||MIA.busy)return;i.value="";miaAsk(v)});
/* Links im Chat: auf dem Handy schließt sich das Blatt, damit man die Seite sieht */
$("#chatLog").addEventListener("click",e=>{const a=e.target.closest("a[href^='/']");if(a&&miaMob())chatClose(true)});
/* Fokus bleibt im Chat (Tab/Umschalt+Tab), solange kein anderes Fenster darüber liegt */
document.addEventListener("keydown",e=>{
  if(e.key!=="Tab"||!chat.open||["#pal","#drawer","#scrim","#menu"].some(s=>{const x=$(s);return x&&x.classList.contains("open")}))return;
  const ch=$("#chat"),f=focusables(ch);if(!f.length)return;const a=document.activeElement,i=f.indexOf(a);
  if(!ch.contains(a)){e.preventDefault();f[0].focus();return}
  if(e.shiftKey&&i<=0){e.preventDefault();f[f.length-1].focus()}else if(!e.shiftKey&&i===f.length-1){e.preventDefault();f[0].focus()}
});
/* Desktop: Klick neben das Fenster schließt es (Kopfzeilen-Knopf, Fenster, Suche und Warenkorb ausgenommen) */
document.addEventListener("pointerdown",e=>{if(!chat.open||miaMob())return;const t=e.target;if(t.closest&&t.closest("#chat,#hai,#miaTip,#scrim,#drawer,#pal,#toast,#cookie"))return;chatClose(true)},true);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!miaTipEl.hidden&&miaTipEl.contains(document.activeElement)){miaTipHide();const h=$("#hai");h&&h.focus({preventScroll:true})}});
/* Handy: am Griff nach unten wischen schließt das Blatt */
(()=>{const h=$("#miaHead"),ch=$("#chat");if(!h||!ch)return;let y0=null,dy=0,t0=0;
  h.addEventListener("touchstart",e=>{if(!miaMob()||e.touches.length!==1)return;y0=e.touches[0].clientY;dy=0;t0=Date.now();ch.classList.add("drag")},{passive:true});
  h.addEventListener("touchmove",e=>{if(y0==null)return;dy=Math.max(0,e.touches[0].clientY-y0);ch.style.transform=`translate3d(0,${dy}px,0)`},{passive:true});
  const end=()=>{if(y0==null)return;ch.classList.remove("drag");const v=dy/Math.max(1,Date.now()-t0);y0=null;if(dy>110||(v>.6&&dy>40))chatClose();else ch.style.transform=""};
  h.addEventListener("touchend",end);h.addEventListener("touchcancel",end)})();
addEventListener("resize",()=>{if(chat.open)document.documentElement.classList.toggle("mia-lock",miaMob())},{passive:true});
