# instacode – Design „Klarglas & Flüssigmetall“

Shop für digitale Gutscheine, Spielguthaben und Handy-Aufladungen (Deutschland, Du-Form, überwiegend iPhone-Nutzer).
Hauptaufgabe jeder Seite: Marke finden → Betrag wählen → bezahlen → Code sofort bekommen.

## Leitidee
1. **Die Karte ist das Objekt.** Jede Gutscheinkarte (`.gc`) ist ein glänzendes Stück Kunststoff: sie neigt sich zur Maus/zum Finger, fängt Licht (`.gc-glare`, `::after`-Lichtstreifen), wirft Farbe ihrer Marke (`--g`).
2. **Glas ist leise, Chrom ist laut.** Flächen sind fast unsichtbares Klarglas *ohne Umrisse* (nur Lichtkante innen + weicher Schatten). Flüssiges Chrom (`.lm` WebGL oder `.metal`/`--chrome` per CSS) erscheint **nur am wichtigsten Element einer Ansicht** – z. B. Rahmen des iPhone-Demos im Hero, großer Kauf-/Bezahlknopf, gewählter Betrag. Nie mehrere Chrom-Flächen gleichzeitig im Bild.
3. **Bewegung antwortet auf Berührung.** Federnde Rückmeldung bei Druck, Neigen bei Zeiger. Daueranimation nur für das eine Signature-Element pro Ansicht; alles pausiert außerhalb des Bildschirms.
4. **Klarheit vor Deko.** Keine Labels über Überschriften, keine Großbuchstaben-Eyebrows, keine Nummern-Marker außer bei echten Abfolgen, kein einzelnes farbiges Wort in Überschriften, keine Emoji, keine Pfeile „→“ in Knopftexten.

## Tokens (in `css/01-base.css`)
- Farbe: `--frost #EEF0F6` (Grund), `--ink #0B0D1C` (Text), `--ink-2 #3B4159` (Zweittext), `--ink-3 #5F657D` (Hinweise), `--iris #5B4BF0` / `--iris-2 #4532DA` (Marke), `--volt #2E6BFF`, `--mint` (Erfolg), `--rose` (Fehler), `--amber`.
- Glas: `--glass`, `--glass-hi` (fast weiß), `--glass-lo` (sehr klar), `--blur`, `--blur-s`, `--rim` (Lichtkante innen), `--lift`, `--lift-2` (Schatten), `--well` (Eingabefeld-Mulde), `--focus`.
- Metall: `--chrome` (konisch, mit `--ang` animierbar über `animation:metalSpin`), `--chrome-flat`, `--brand-grad`.
- Form: `--r-xs 10`, `--r-s 14`, `--r-m 20`, `--r-l 28`, `--r-xl 36`, `--pill`. Raum: `--gut` (Seitenrand), `--sec` (Abschnittsabstand 56px).
- Bewegung: `--ease`, `--spring`. Schrift: `--font` (Systemschrift/SF Pro), `--mono`.
- Typo-Klassen: `.h1 .h2 .h3 .page-h1 .lead .fine .muted .code`.

**Glas-Rezept für neue Flächen:** `background:var(--glass); box-shadow:var(--rim),var(--lift); border-radius:var(--r-l);` Weichzeichner (`backdrop-filter:var(--blur)`) nur auf Flächen, die über Inhalt schweben (Overlays, Sheets, Kopfzeile). Auf `.lite` (Touch/klein) statt Blur `var(--glass-hi)` verwenden. **Keine `border:1px solid`** als Umriss; Trennung nur über Abstand, Lichtkante oder `box-shadow:0 -1px 0 var(--line)`.

## Fertige Bauteile (nicht neu erfinden, nicht global überschreiben)
`.card .si-ic .cc-ic .lg-group/.lg-lens .btn(.btn-primary .btn-soft .btn-outline .btn-ghost .btn-lg .btn-sm .btn-block) .icon-btn .badge .more .chips/.chip .amounts/.amt .lbl .inp .field .phone .sel .err .flag .switch .chk .qty .otp .row .express .trust .tabs .sec .sec-head .crumb .gc (+ .gc-img .art .gc-amt .gc-badge .gc-plat .holo .rim .gc-glare .key .cover .ghost .flash .scrollshine .tilt .press) .mini .mini-gc .tiles/.tile/.tile-media/.tile-meta/.qadd .rail/.rail-track/.rail-nav .catgrid/.catcard/.fan .stage/.fs/.float .phead/.phead-stage .faq/.qa .empty/.ghostfan .paylogos/.pmk/.pmk-kl/.kl-cap .spin .rv .bump .tick .shake .rip .shine .lm .metal`, Kopfzeile `.hdr …`, Fußzeile `.ftr .ft-*`, `.testbar .trustbar .bgfx .bgcards`.
Wenn ein Bauteil in deinem Bereich anders aussehen muss: **im Container deines Bereichs scopen** (z. B. `.pd .amt{…}`), nie die Grundregel ändern. Brauchst du eine Änderung am Fundament, schreib sie in deinen Abschlussbericht.

## Flüssigmetall
- `<span class="lm" aria-hidden="true"></span>` als erstes Kind eines `position:relative`-Elements mit `border-radius`; der Router ruft nach jedem Seitenaufbau `metalMount(app)` auf. Für Elemente außerhalb von `#app` selbst `metalMount(el)` aufrufen. Höchstens 1–2 `.lm` pro Seite (WebGL).
- Für kleine Ränder: Klasse `.metal` (Chrom-Rand per CSS, Breite `--mw`).

## Leistung (Pflicht)
- Animiert werden nur `transform`, `opacity` (und `--ang` für Chrom). Keine Daueranimation von `box-shadow`, `filter`, `background-position` großer Flächen.
- Elemente mit Daueranimation bekommen `data-off`; der vorhandene Beobachter setzt `.off`, wenn sie unsichtbar sind → `animation-play-state:paused`.
- `.lite`-Klasse auf `<html>` = Touch oder schmal: weniger Blur, keine `.holo`, keine schweren Schatten-Animationen.
- `prefers-reduced-motion` wird global respektiert.

## Barrierefreiheit
Echte `<button>`/`<a href>`; sichtbarer Fokus (global `:focus-visible`); Touch-Ziele ≥ 44 px; Text ≥ 4.5:1 (Grau `--ink-3` nur auf hellem Grund); `aria-label` an Icon-Knöpfen.

## Inhalt & Sprache
Deutsch, Du-Form, Satzanfang groß, kurze klare Verben („Jetzt kaufen“, „In den Warenkorb“). Fehlermeldungen sagen, was passiert ist und was zu tun ist.
**Verboten:** erfundene Bewertungen, Zahlen, Käufe, „X Personen sehen gerade“, Zertifikate/Siegel, Countdown-Druck. Bewertungen nur echte (eigenes System `/api/reviews`, Anzeige ab 3 Bewertungen). Marken-Logos nicht selbst zeichnen: nur Reloadly-Kartenbilder (`b.img`) oder Server-Proxy `/img/mark/<set>/<name>.svg` (Sets: `logos`, `flag`, `si`).

## Muss erhalten bleiben (vom Inhaber ausdrücklich gewünscht)
- Kopfzeile: statischer Schriftzug „instacode“ mit Polier-Glanz, starkes transparentes Glas, Logo führt immer zur Startseite.
- Startseite: oben **keine Überschrift und keine Suchleiste**; große glänzende Bestseller-Karten zum Seitlich-Wischen mit kleinem Flammen-Badge „Bestseller“ direkt auf der Karte; daneben/darunter das **iPhone mit simuliertem Apple-Pay-Kauf im instacode-Checkout** (`apDemo`) mit Markenkarten drumherum; „Am beliebtesten“ steht **vor** „Kategorien“; Ablauf-Video-Abschnitt „Vom Antippen zum Code“ (`/vid/ablauf.*`).
- Zahlungs-Badges im Stil echter Akzeptanzlogos (`.pmk`), Klarna-Badge wo Klarna verfügbar (`klarnaBadge()`).
- Produktseiten mit echter URL, Aktionen Teilen/Merken/Link kopieren/Verschenken.
- Servicegebühr 4,99 € transparent anzeigen; Preise = Nennwert.
- Kein Jelly-/Wackel-Effekt, keine Mini-Animationen an Überschriften.

## Aufbau
- `web/index.html` ist das Gerüst; der Server fügt alle Dateien aus `web/css/` und `web/js/` in Namensreihenfolge ein (JS teilt einen Gültigkeitsbereich, `"use strict"`). Im Live-Betrieb einmal beim Start, in der Entwicklung bei jeder Dateiänderung.
- Bereiche: `01–03` Fundament, `40` Startseite, `50` Katalog/Produkt/Aufladen, `60` Warenkorb/Kasse/Bestellung, `70` Anmeldung/Konto/Hilfe/Rechtliches, `80` Menü/Suche/Sheets/Chat/Bewertungen.
- Neue Regeln in die Datei des Bereichs, Grundbauteile nur im Fundament ändern.
