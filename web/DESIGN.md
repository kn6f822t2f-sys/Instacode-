# instacode – Design „Nachtglas“ (neutrales Schwarz, Framer-Stil)

Shop für digitale Gutscheine, Spielguthaben und Handy-Aufladungen (Deutschland, Du-Form, überwiegend iPhone-Nutzer).
Hauptaufgabe jeder Seite: Marke finden → Betrag wählen → bezahlen → Code sofort bekommen.
Vorbild: das Framer-Template „Primary Button“ des Inhabers – neutrales Schwarz, weiße Pillen-Knöpfe, große Typografie, Pastell-Akzente, viel Bewegung.

## Leitidee
1. **Neutrales Schwarz, Licht in Pastell.** Grund `--bg #050506` ohne Blaustich, weiches Pastell-Licht (Rosa, Lavendel, Periwinkel, Himmelblau) und feines Korn. Flächen sind dunkles Glas (`--glass`, `--rim`), keine harten Umrisse.
2. **Weiß ist der Hauptakzent.** Hauptknopf, gewählter Betrag und aktiver Chip sind weiße Pillen mit dunkler Schrift; der große Hauptknopf und der gewählte Betrag tragen einen umlaufenden Pastell-Lichtring (`--ring`). `--brand-grad` (Logo-Verlauf) nur für kleine Markenelemente.
3. **Karten schweben.** Gutscheinkarten (`.gc`) neigen sich zum Zeiger, werfen ihre Markenfarbe, schweben in Wolken (`.fc` mit Tiefe `--d`, Zeiger- und Scroll-Parallax) und drehen sich im Bestseller-Karussell (3D).
4. **Bewegung macht es wertig.** Einblenden mit Unschärfe (`.rv`), Sätze hellen sich Wort für Wort auf (`[data-words]`), Kennzahlen zählen hoch (`[data-count]`), Schritt-Karten stapeln sich (sticky), Kategorie-Zeilen mit mitfliegendem Kartenfächer (`[data-crows]`), Lichtpunkt unter dem Zeiger (`.card`, `.catcard`, `.qa`, `.spot`). Bewegungs-Code: `js/16-motion.js`.
5. **Klarheit vor Deko.** Keine Labels über Überschriften, keine Großbuchstaben-Eyebrows, kein einzelnes farbiges Wort in Überschriften, keine Emoji, keine Pfeile „→“ in Knopftexten.

## Tokens (in `css/01-base.css`)
- Grund: `--bg #050506`, `--bg-2 #0C0C0E`, `--bg-3 #161618` (feste Flächen, z. B. Sheets/Menüs), `--frost` = `--bg`.
- Text: `--ink #F5F5F5`, `--ink-2 #A8A8AD` (Zweittext), `--ink-3 #8C8C92` (Hinweise, mind. 13 px). Nie dunkle Schrift auf dunklem Grund; weiße Flächen (z. B. Zahlungs-Badges) bekommen eigene dunkle Schrift.
- Akzent: Pastell `--pink --lav --peri --sky --lime` und `--pastel` (Verlauf), `--iris`/`--iris-2` (Akzent als Text/Icon), `--mint` (Erfolg), `--rose` (Fehler), `--amber`. `--brand-grad` (Logo), `--text-grad` (Überschriften), `--tint`.
- Linien: `--line` (8 % weiß), `--line-2` (14 %). Trennung über `box-shadow:0 -1px 0 var(--line)`, nie `border:1px solid`.
- Glas: `--glass` (Standard), `--glass-hi` (heller, z. B. aktive Fläche), `--glass-lo` (sehr leise), `--glass-solid` (deckend, für Overlays auf `.lite`), `--rim` / `--rim-hi` (Lichtkante innen), `--lift` / `--lift-2` (Schatten), `--glow` (violettes Leuchten), `--well` + `--field`/`--field-hi` (Eingabefelder), `--focus`, `--blur`/`--blur-s`.
- Licht/Metall: `--ring` (umlaufender Glanzpunkt, mit `--ang` über `animation:metalSpin` animierbar), `--chrome`/`--chrome-flat` (dunkles Titan).
- Form: `--r-xs 10`, `--r-s 14`, `--r-m 18`, `--r-l 24`, `--r-xl 32`, `--pill`. Raum: `--gut` (Seitenrand), `--sec` (Abschnittsabstand, 64–104 px).
- Bewegung: `--ease`, `--ease-out` (Einblenden), `--spring` (Rückmeldung). Schrift: `--font` (Geist, selbst gehostet), `--mono` (Geist Mono).
- Typo-Klassen: `.h1 .h2` (mit leichtem Glanzverlauf), `.h3 .page-h1 .lead .fine .muted .code`.
- Hilfsklassen: `.spot` (Lichtpunkt + Kante für eigene Glasflächen; belegt `::before`/`::after`), `.ring` (Lichtring um ein Element; belegt `::before`).

**Glas-Rezept für neue Flächen:** `background:var(--glass); box-shadow:var(--rim),var(--lift); border-radius:var(--r-l);` Weichzeichner (`backdrop-filter:var(--blur)`) nur auf Flächen, die über Inhalt schweben (Overlays, Sheets, Kopfzeile, Leisten am Bildschirmrand). Auf `.lite` (Touch/klein) Overlays deckend mit `--glass-solid` bzw. `--bg-2`/`--bg-3`. Aktive/gewählte Zustände: helle Pille (`#F3F4F8` mit dunkler Schrift, wie `.chip[aria-pressed=true]`) oder violettes Glas mit Lichtkante (wie `.amt[aria-pressed=true]`).

## Fertige Bauteile (nicht neu erfinden, nicht global überschreiben)
`.card .si-ic .cc-ic .lg-group/.lg-lens .btn(.btn-primary .btn-soft .btn-outline .btn-ghost .btn-lg .btn-sm .btn-block) .icon-btn .badge .more .chips/.chip .amounts/.amt .lbl .inp .field .phone .sel .err .flag .switch .chk .qty .otp .row .express .trust .tabs .sec .sec-head .crumb .gc (+ .gc-img .art .gc-amt .gc-badge .gc-plat .holo .rim .gc-glare .key .cover .ghost .flash .scrollshine .tilt .press) .mini .mini-gc .tiles/.tile/.tile-media/.tile-meta/.qadd .rail/.rail-track/.rail-nav .catgrid/.catcard/.fan .stage/.fs/.float .phead/.phead-stage .faq/.qa .empty/.ghostfan .paylogos/.pmk/.pmk-kl/.kl-cap .spin .rv .bump .tick .shake .rip .shine .ring .spot .lm .metal`, Kopfzeile `.hdr …`, Fußzeile `.ftr .ft-*`, `.testbar .trustbar .bgfx`.
Wenn ein Bauteil in deinem Bereich anders aussehen muss: **im Container deines Bereichs scopen** (z. B. `.pd .amt{…}`), nie die Grundregel ändern. `.card` belegt mit Maus `::before` (Kante) und `::after` (Lichtpunkt) – eigene Pseudo-Elemente auf `.card`-Flächen daher nicht verwenden.

## Flüssigmetall
- `<span class="lm" aria-hidden="true"></span>` als erstes Kind eines `position:relative`-Elements mit `border-radius`; der Router ruft nach jedem Seitenaufbau `metalMount(app)` auf. Höchstens 1–2 `.lm` pro Seite (WebGL). Farbe: dunkles Titan.
- Für kleine Ränder: Klasse `.metal` (Chrom-Rand per CSS, Breite `--mw`).

## Leistung (Pflicht)
- Animiert werden nur `transform`/`translate`/`scale`/`rotate`, `opacity` (und `--ang` für Ringe). Keine Daueranimation von `box-shadow`, `filter`, `background-position` großer Flächen.
- Elemente mit Daueranimation bekommen `data-off`; der vorhandene Beobachter setzt `.off`, wenn sie unsichtbar sind → `animation-play-state:paused`.
- `.lite`-Klasse auf `<html>` = Touch oder schmal: kein Blur auf Karten, keine `.holo`, keine schweren Schatten-Animationen.
- `prefers-reduced-motion` wird global respektiert.

## Barrierefreiheit
Echte `<button>`/`<a href>`; sichtbarer Fokus (global `:focus-visible`); Touch-Ziele ≥ 44 px; Text ≥ 4.5:1 auf dem dunklen Grund (`--ink-3` ist die hellste erlaubte Hinweisfarbe, nichts Dunkleres für Text); `aria-label` an Icon-Knöpfen.

## Inhalt & Sprache
Deutsch, Du-Form, Satzanfang groß, kurze klare Verben („Jetzt kaufen“, „In den Warenkorb“). Fehlermeldungen sagen, was passiert ist und was zu tun ist.
**Verboten:** erfundene Bewertungen, Zahlen, Käufe, „X Personen sehen gerade“, Zertifikate/Siegel, Countdown-Druck. Bewertungen nur echte (eigenes System `/api/reviews`, Anzeige ab 3 Bewertungen). Marken-Logos nicht selbst zeichnen: nur Reloadly-Kartenbilder (`b.img`), Simple-Icons-Dateien in `public/logo/` (über `siI()`) oder Server-Proxy `/img/mark/<set>/<name>.svg` (Sets: `logos`, `flag`, `si`).

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
