/* ---------- KI-Telefonassistent (IONOS AI Frontdesk) ----------
   Nummer (CFG.phone, aus SUPPORT_PHONE) steht in Hilfe und Fußzeile. „Mit KI sprechen“ (CFG.voice, aus IONOS_VOICE_AGENT)
   startet einen Sprachanruf im Browser über das Website-Widget von IONOS. Dessen Skript lädt erst nach ausdrücklicher
   Zustimmung in diesem Besuch – vorher fließen keine Daten an IONOS, und ohne Klick kostet es keinen Speicher auf dem Handy. */
const VOICE_JS="https://ionos.ai-voicereceptionist.com/widget/v1/embed.js";
let voiceState=0,voiceOk=false; // 0 nicht geladen, 1 lädt, 2 bereit, -1 nicht erreichbar
const telLink=(cls="")=>CFG.phone?`<a class="${cls}" href="tel:${esc(CFG.phone.tel)}">${esc(CFG.phone.show)}</a>`:"";
/* Ob das Widget etwas angezeigt hat, sehen wir nur an neuen Elementen im <body> (Aufbau des Widgets ist nicht dokumentiert) */
function voiceLoad(){
  if(!CFG.voice||voiceState===1||voiceState===2){if(voiceState===2)voiceReady(true);return}
  voiceState=1;const before=new Set(document.body.children);
  const s=document.createElement("script");s.src=VOICE_JS;s.async=true;s.setAttribute("data-agent-id",CFG.voice);
  s.onload=()=>setTimeout(()=>{const shown=[...document.body.children].some(el=>!before.has(el)&&el!==s&&el.tagName!=="SCRIPT");voiceState=shown?2:-1;voiceReady(shown)},2500);
  s.onerror=()=>{voiceState=-1;s.remove();voiceReady(false)};
  document.body.appendChild(s);
}
function voiceReady(ok){
  if(ok)return toast("Der KI-Assistent ist bereit: Tippe auf „Mit KI sprechen“ unten auf der Seite.");
  openSheet(`<div class="sheet-h"><h3>Gerade nicht erreichbar</h3><button class="x" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button></div>
<p class="acc-sheet-p">Der Sprachassistent ließ sich nicht laden. ${CFG.phone?`Ruf stattdessen an: ${telLink()}. `:""}Oder schreib uns an <a href="mailto:${esc(CFG.support)}">${esc(CFG.support)}</a>.</p>
<div class="acc-sheet-a"><button class="btn btn-soft" data-a="closeSheet">Schließen</button></div>`,{label:"Sprachassistent nicht erreichbar"});
}
A.voiceOpen=()=>{
  if(!CFG.voice)return;
  if(voiceOk)return voiceLoad();
  openSheet(`<div class="sheet-h"><h3>Mit KI sprechen</h3><button class="x" data-a="closeSheet" aria-label="Schließen">${ic("i-x")}</button></div>
<p class="acc-sheet-p">Du sprichst direkt im Browser mit unserem KI-Assistenten, rund um die Uhr. Dafür laden wir den Sprachassistenten von IONOS. Er braucht dein Mikrofon; dein Gespräch und technische Daten wie deine IP-Adresse gehen dabei an IONOS und deren Dienstleister, möglicherweise auch in die USA. Mehr dazu in der <a href="/datenschutz">Datenschutzerklärung</a>.</p>
${CFG.phone?`<p class="acc-sheet-p vc-tel">Lieber ganz normal anrufen? ${telLink()}</p>`:""}
<div class="acc-sheet-a"><button class="btn btn-soft" data-a="closeSheet">Abbrechen</button><button class="btn btn-primary btn-ink" data-a="voiceGo">Zustimmen und laden</button></div>`,{label:"Mit KI sprechen"});
};
A.voiceGo=()=>{voiceOk=true;closeSheet(true);voiceLoad()};
/* Kontakt-Einträge für Hilfe-Seite (Liste .hq) und Fußzeile – nur, wenn eingerichtet */
const hqVoice=()=>(CFG.phone?`<a class="hq-i" href="tel:${esc(CFG.phone.tel)}"><span class="si-ic">${ic("i-phone-f")}</span><span><b>Anrufen</b><small>${esc(CFG.phone.show)}, KI-Assistent</small></span>${ic("i-chev")}</a>`:"")
  +(CFG.voice?`<button class="hq-i" data-a="voiceOpen"><span class="si-ic">${ic("i-spark")}</span><span><b>Mit KI sprechen</b><small>Sprachanruf im Browser, rund um die Uhr</small></span>${ic("i-chev")}</button>`:"");
const ftVoice=()=>(CFG.phone?`<li>${telLink()} <span class="ft-note">KI-Telefonassistent, rund um die Uhr</span></li>`:"")
  +(CFG.voice?`<li><button class="lnk" data-a="voiceOpen">Mit KI sprechen</button></li>`:"");
