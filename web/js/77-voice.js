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
/* Datenschutzerklärung: eigener Abschnitt, sobald Nummer oder Sprach-Knopf eingerichtet sind (PHN verschiebt die Nummern der folgenden Abschnitte) */
const PHN=()=>CFG.phone||CFG.voice?1:0;
const voicePrivacy=()=>PHN()?`<h2>5. KI-Telefonassistent${CFG.voice?" und Sprachanruf im Browser":""}</h2>
<p>${CFG.phone?`Unter unserer Rufnummer ${esc(CFG.phone.show)}`:"Über unsere Rufnummer"}${CFG.voice?" und über den Knopf „Mit KI sprechen“ auf dieser Website":""} nimmt ein KI-Assistent Anrufe entgegen. Ihn betreibt die IONOS SE, Elgendorfer Str. 57, 56410 Montabaur, in unserem Auftrag (Auftragsverarbeitung nach Art. 28 DSGVO). Zu Beginn jedes Gesprächs sagt der Assistent, dass du mit einer KI sprichst.</p>
<ul>
<li><b>Welche Daten:</b> der Inhalt des Gesprächs (Sprache und der daraus erstellte Text), Verbindungsdaten wie Rufnummer, Datum, Uhrzeit und Dauer sowie die Angaben, die du freiwillig machst, etwa Name, E-Mail-Adresse oder Bestellnummer.${CFG.voice?" Beim Sprachanruf im Browser außerdem technische Daten wie deine IP-Adresse.":""}</li>
<li><b>Zweck und Rechtsgrundlage:</b> Entgegennahme, Weitergabe und Beantwortung deines Anliegens, also Vertragsanbahnung und -durchführung (Art. 6 Abs. 1 lit. b DSGVO), sowie unser berechtigtes Interesse an einer jederzeit erreichbaren und effizienten Kommunikation (Art. 6 Abs. 1 lit. f DSGVO).${CFG.voice?" Das Skript von IONOS für den Sprachanruf im Browser laden wir erst, wenn du ausdrücklich zustimmst (§ 25 Abs. 1 TDDDG, Art. 6 Abs. 1 lit. a DSGVO); vorher werden keine Daten an IONOS übertragen. Dabei kann IONOS eigene Cookies oder lokalen Speicher verwenden.":""}</li>
<li><b>Aufzeichnung und Zusammenfassung:</b> Das Gespräch wird zur Bearbeitung in Text umgewandelt, wir erhalten eine Zusammenfassung per E-Mail. Du kannst das Gespräch jederzeit beenden und uns stattdessen schreiben. Eine automatisierte Entscheidung im Sinne von Art. 22 DSGVO findet nicht statt.</li>
<li><b>Dienstleister und Übermittlung in Drittländer:</b> IONOS setzt für Hosting, Spracherkennung und Sprachverarbeitung weitere Dienstleister ein; dabei kann eine Übermittlung in die USA stattfinden. Grundlage ist der Angemessenheitsbeschluss zum EU-U.S. Data Privacy Framework, soweit der Empfänger danach zertifiziert ist, im Übrigen EU-Standardvertragsklauseln. IONOS kann pseudonymisierte Daten zur Verbesserung der Sprachverarbeitung nutzen.</li>
<li><b>Speicherdauer:</b> Wir speichern die Daten nur so lange, wie es für die Bearbeitung deines Anliegens nötig ist, danach werden sie gelöscht oder anonymisiert, soweit keine gesetzliche Aufbewahrungspflicht besteht.</li>
</ul>
${/* VOM INHABER ZU PRÜFEN: Auftragsverarbeitungsvertrag (AVV) mit IONOS im IONOS-Konto abschließen und die Liste der Unterauftragsverarbeiter im IONOS-Hilfe-Center „KI-Telefonassistent: Datenschutz und Datenverarbeitung“ gegen diesen Abschnitt prüfen. */""}`:"";
