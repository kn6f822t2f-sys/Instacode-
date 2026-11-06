# instantcodes – Design „Chrome & Glas“

Shop für digitale Gutscheine, Spiele-Keys, Abos und Handy-Aufladungen (Deutschland, Du-Form, überwiegend iPhone-Nutzer).
Hauptaufgabe jeder Seite: Marke finden → Betrag wählen → bezahlen → Code sofort bekommen.
Stil: Graphit wie in einem Fotostudio, Milchglas mit Chromkante, Perlmutt-Reflexe, Knöpfe aus flüssigem Chrom, ein Ring aus flüssigem Metall (WebGL) als Herzstück.

## Leitidee
1. **Graphit, Studiolicht.** Grund `--bg #0E0F12` (nicht Schwarz). Darüber eine große weiche Lichtquelle oben rechts, Perlmutt-Schimmer (Rosa, Lavendel, Mint) an den Rändern und feines Korn (`.bgfx`).
2. **Chrom ist der Hauptakzent.** Hauptknopf, gewählter Betrag, aktiver Chip, Schalter und Haken sind hell gespiegeltes Chrom (`--chrome-fill`) mit dunkler Schrift `#0D0E11`. Überschriften `.h1 .h2` tragen den Chrom-Textverlauf (`--chrome-text`). Perlmutt (`--pearl`, `.pearl-t`) nur für kleine Akzente (Neu-Marke, Lichtring `--ring`, Hover-Glanz).
3. **Glas mit Chromkante.** Flächen sind Milchglas (`--glass`, `--rim`): helle Kante oben, feine Linie rundum. `.chrome-rim` setzt eine Verlaufskante aus Chrom (belegt `::before`).
4. **Karten schweben wie Glasobjekte.** Gutscheinkarten (`.gc`) neigen sich zum Zeiger; auf der Startseite liegen sie auf Glasplatten (`.fc`, Tiefe `--d`, Zeiger- und Scroll-Parallax) vor und hinter dem Metall-Ring.
5. **Bewegung macht es wertig.** Einblenden mit Unschärfe (`.rv`), Wort-für-Wort-Aufhellen (`[data-words]`), Hochzählen (`[data-count]`), Glanz, der über Chrom läuft, federnde Rückmeldung, Lichtpunkt unter dem Zeiger (`.card .catcard .qa .spot .step`). Bewegungs-Code: `js/15-effects.js`, `js/16-motion.js`.
6. **Klarheit vor Deko.** Keine Labels über Überschriften, keine Großbuchstaben-Eyebrows, keine Emoji, keine Pfeile „→“ in Knopftexten.

## Tokens (in `css/01-base.css`)
- Grund: `--bg #0E0F12`, `--bg-2 #141519`, `--bg-3 #1B1D22` (feste Flächen, Sheets/Menüs).
- Text: `--ink #F2F3F5`, `--ink-2 #AAAEB8` (Zweittext), `--ink-3 #8D919C` (Hinweise, mind. 13 px). Auf Chrom und weißen Flächen dunkle Schrift `#0D0E11`.
- Chrom & Perlmutt: `--chrome-text` (Überschriften), `--chrome-fill` (Knöpfe, aktive Zustände, Icons auf Chrom), `--chrome-edge` / `--edge` (Kanten), `--pearl` (Perlmutt-Verlauf), `--ring` (umlaufender Perlmutt-Lichtring), `--chrome`/`--chrome-flat`.
- Akzente (sparsam, eher als Licht als als Fläche): `--pink --lav --mint --sky --iris --iris-2`; Zustände `--mint` (Erfolg), `--rose` (Fehler), `--amber` (Hinweis). `--brand-grad` = Perlmutt, `--text-grad` = Chrom.
- Glas: `--glass` (Standard), `--glass-hi`, `--glass-lo`, `--glass-solid` (deckend, für Overlays auf `.lite`), `--rim` / `--rim-hi` (Kante), `--lift` / `--lift-2` (Schatten), `--glow`, `--well` + `--field`/`--field-hi` (Eingaben), `--focus`, `--blur`/`--blur-s`.
- Linien: `--line`, `--line-2`. Trennung per `box-shadow:0 -1px 0 var(--line)`, nie `border:1px solid`.
- Form: `--r-xs 10`, `--r-s 14`, `--r-m 18`, `--r-l 24`, `--r-xl 32`, `--pill`. Raum: `--gut` (Seitenrand, Inhalt max. 1240 px), `--sec` (Abschnittsabstand 72–128 px).
- Bewegung: `--ease`, `--ease-out`, `--spring`. Schrift: `--font` (Geist), `--mono`.
- Typo: `.h1` (36–62 px, 600), `.h2` (27–40 px, 590), beide in ruhigem Silber; `.h3 .page-h1 .lead .fine .muted .code .pearl-t`.

**Glas-Rezept für neue Flächen:** `background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.02)); box-shadow:var(--rim),var(--lift); border-radius:var(--r-l);` (oder kurz `var(--glass)`). Weichzeichner (`backdrop-filter`) nur auf Flächen, die über Inhalt schweben. Auf `.lite` deckend mit `--glass-solid`/`--bg-2`. **Aktiver Zustand:** Chrom (`background:var(--chrome-fill);color:#0D0E11`), wie `.chip[aria-pressed=true]`.

## Fertige Bauteile (nicht neu erfinden, nicht global überschreiben)
`.card .si-ic .cc-ic .lg-group/.lg-lens .btn(.btn-primary .btn-soft .btn-outline .btn-ghost .btn-lg .btn-sm .btn-block) .icon-btn .badge .more .chips/.chip .amounts/.amt .lbl .inp .field .phone .sel .err .flag .switch .chk .qty .otp .row .express .trust .tabs .sec .sec-head .crumb .gc (+ Varianten) .mini .mini-gc .tiles/.tile/.tile-media/.tile-meta/.qadd .rail/.rail-track/.rail-nav .catgrid/.catcard/.fan .stage/.fs/.float .phead/.phead-stage .faq/.qa .empty/.ghostfan .paylogos/.pmk/.pmk-kl/.kl-cap .spin .rv .bump .tick .shake .rip .shine .ring .spot .chrome-rim .lm .metal .lq`, Kopfzeile `.hdr …`, Fußzeile `.ftr .ft-*`, `.testbar .trustbar .bgfx`.
Wenn ein Bauteil in deinem Bereich anders aussehen muss: **im Container deines Bereichs scopen** (z. B. `.pd .amt{…}`), nie die Grundregel ändern. Klassen-Präfixe vorher suchen (`grep`), damit sie nicht mit anderen Bereichen kollidieren. `.card` belegt mit Maus `::before`/`::after`.

## Knöpfe, iPhone, Seitenwechsel, Bilder
- **Knöpfe:** Hauptknopf gebürstetes Silber (ruhig), beim Überfahren leichtes Anheben, feiner Glanz, Licht folgt dem Zeiger; großer Hauptknopf zeigt den Perlmutt-Lichtring nur beim Überfahren. Nebenknopf Glas, Kante wird beim Überfahren heller. Drücken: leicht einsinken (scale .975).
- **iPhone:** `iphone(inhalt,{w,cls,id})` (js/10-components.js, CSS in 02-components.css) – Maße wie iPhone 16 Pro, Titanrahmen, Tasten, Dynamic Island, Statusleiste. Größe per CSS über `--w`. Für Videos: `.iph-stage[data-mouse] > .iph-float[data-off] > .iph-tilt > iphone(...)`. Videos im Format 402 × 828 pt aufnehmen (`/home/claude/devshim/vid/rec6.js kauf|aufladen`), als 540 × 1112 kodieren.
- **Seitenwechsel:** View Transitions im Router (`route()` in 60-router-ui.js): Inhalt blendet über, Kopfzeile bleibt stehen, eine angetippte Karte fliegt in die Produktseite (`view-transition-name: ic-card`). Ohne API/bei reduzierter Bewegung direkt.
- **Produktbilder:** Spiele-Keys zeigen offizielle Shop-Bilder (Steam, Nintendo, PlayStation, Minecraft). Nur die Adressen liegen in `covers.json` (erzeugt mit `node tools/covers.js`), der Server lädt die Bilder beim ersten Aufruf (`/img/cover/<id>/p|l`) und speichert sie im Datenordner. Gutscheinkarten: Originalbilder kommen automatisch, sobald Reloadly verbunden ist.
- **Zahlungszeichen:** offizielle Logos liegen unter `public/pay/*.svg` (Apple Pay, Google Pay, Visa, Mastercard, American Express, PayPal, Klarna, Amazon Pay, SEPA, Maestro, Stripe). Angezeigt werden nur die Zahlungsarten, die in Stripe aktiv sind.

## Flüssigmetall
- **Ring (Startseite, Abschluss):** `<div class="lq" data-off aria-hidden="true"></div>` in einem `position:relative`-Element; der Router ruft `LIQUID.mount()` (in `fx()`) auf. WebGL-Shader `js/13-liquid.js`: fließender Chrom-Ring, Glanzlicht folgt dem Zeiger, pausiert unsichtbar, auf Touch halbe Auflösung und 30 Bilder/s, bei reduzierter Bewegung Standbild, ohne WebGL CSS-Ring (`.nogl`). Höchstens 2 pro Seite.
- **Rahmen:** `<span class="lm" aria-hidden="true"></span>` als erstes Kind eines Elements mit `border-radius` (`metalMount(app)`), sparsam. Für kleine Ränder `.metal` (CSS).

## Leistung (Pflicht)
- Animiert werden nur `transform`/`translate`/`scale`/`rotate` und `opacity`. Keine Daueranimation von `box-shadow`, `filter`, `background-position` großer Flächen.
- Elemente mit Daueranimation bekommen `data-off` → `.off` außerhalb des Bildschirms → `animation-play-state:paused`.
- `.lite` auf `<html>` = Touch oder schmal: kein Blur auf Karten, keine `.holo`, weniger Ebenen.
- `prefers-reduced-motion` wird global respektiert.

## Barrierefreiheit
Echte `<button>`/`<a href>`; sichtbarer Fokus (`:focus-visible`, Lavendel); Touch-Ziele ≥ 44 px; Text ≥ 4.5:1 (`--ink-3` ist die dunkelste erlaubte Textfarbe); `aria-label` an Icon-Knöpfen; dekorative Bühnen `aria-hidden`.

## Inhalt & Sprache
Deutsch, Du-Form, Satzanfang groß, kurze klare Verben („Jetzt kaufen“, „In den Warenkorb“). Fehlermeldungen sagen, was passiert ist und was zu tun ist.
**Verboten:** erfundene Bewertungen, Zahlen, Käufe, „X Personen sehen gerade“, Zertifikate/Siegel, Countdown-Druck. Bewertungen nur echte (`/api/reviews`, Anzeige ab 3 Bewertungen). Marken-Logos nicht selbst zeichnen: nur Reloadly-Kartenbilder (`b.img`), Simple-Icons-Dateien in `public/logo/` (`siI()`, Seitenverhältnis `SIA`) oder Proxy `/img/mark/<set>/<name>.svg`.

## Marke
- Name **instantcodes** (Wortmarke `<b>instant</b>codes`: „instant“ kräftig, „codes“ leicht). Zeichen `#logo`: Graphit-Kachel mit Chromkante, Code-Klammern aus Chrom, Blitz in Perlmutt (`public/logo.svg`, `favicon.svg`, PNG-Größen, `og.png`).
- Interne Namen bleiben: Speicher-Schlüssel `instacode_v1`, Datenbank `instacode.db`, Adressen `@instacode.store`.

## Startseite (Aufbau)
Bühne (Überschrift „Digitale Codes. In Sekunden bei dir.“, große Suche öffnet die Palette, Schnellwahl, Zahlungs-Badges; rechts der Metall-Ring mit schwebenden Glaskarten) · Markenband in Chrom · Bestseller · Kategorien-Bento · Abo-Teaser · So einfach geht's (Video `/vid/ablauf.*`) · Handy aufladen · Spiele-Keys · Angebote · Zuletzt angesehen · Aussage + Zusagen · Bewertungen · Ratgeber · Fragen · Abschluss.

## Muss erhalten bleiben
- Kopfzeile: Glas-Pille, Wortmarke mit Polier-Glanz, Logo führt zur Startseite, Suche (Strg K), Konto, Warenkorb.
- Zahlungs-Badges im Stil echter Akzeptanzlogos (`.pmk`), Klarna-Badge wo verfügbar (`klarnaBadge()`, nicht bei Abos).
- Produktseiten mit echter URL, Aktionen Teilen/Merken/Link kopieren/Verschenken.
- Servicegebühr 4,99 € transparent; Preise = Nennwert.
- Fußzeile: „Verträge hier kündigen“ → `/kuendigen`.

## Aufbau
- `web/index.html` ist das Gerüst; der Server fügt alle Dateien aus `web/css/` und `web/js/` in Namensreihenfolge ein (JS teilt einen Gültigkeitsbereich). Live einmal beim Start, in der Entwicklung bei jeder Dateiänderung.
- Bereiche: `01–03` Fundament, `40` Startseite, `50` Katalog/Produkt/Aufladen, `60` Warenkorb/Kasse/Bestellung, `66` Abo, `70` Anmeldung/Konto/Hilfe/Rechtliches, `80` Menü/Suche/Sheets/Chat/Bewertungen.
- Neue Regeln in die Datei des Bereichs, Grundbauteile nur im Fundament ändern.
