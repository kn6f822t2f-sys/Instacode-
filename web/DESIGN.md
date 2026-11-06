# instantcodes – Design „Chrome & Glas – hell“

Shop für digitale Gutscheine, Spiele-Keys, Abos und Handy-Aufladungen (Deutschland, Du-Form, überwiegend iPhone-Nutzer).
Hauptaufgabe jeder Seite: Marke finden → Betrag wählen → bezahlen → Code sofort bekommen.
Stil: **hell, offen, vertrauenswürdig**. Porzellan-Grund mit weichem Studiolicht, weißes Glas mit Haarlinie, Chrom als Akzent (Metall-Ring, Kanten), schlanke Glas-Knöpfe. Viel Luft, klare Ordnung, leichte Schrift. Viel Bewegung, aber ruhig und schnell.

## Leitidee
1. **Hell und klar.** Grund `--bg #F3F4F6`, Flächen weiß (`#fff` bzw. `--glass`) mit Haarlinie (`--rim`) und weichem Schatten (`--lift`). Keine weißen Halbtransparenzen als Fläche (unsichtbar auf Hell) – Flächen sind weiß, Linien/Mulden dunkel-transparent (`rgba(14,16,20,.04–.14)`).
2. **Glas für Handlungen, Rauchglas für Kauf.** `.btn-primary` = klares Glas mit dunkler Schrift und Haarlinie. Kauf- und Absendeknöpfe (Kaufen, Bezahlen, Aufladen, Abo abschließen, Anmelden) bekommen zusätzlich `.btn-ink` = dunkles Rauchglas mit weißer Schrift – pro Ansicht höchstens einer davon im Blick. Gewählte Zustände (Chip, Betrag, Haken, Schalter, Reiter-Knopf) = dunkles Rauchglas. Nebenknopf `.btn-soft`/`.btn-outline` = nur Haarlinie auf fast unsichtbarem Glas.
3. **Vertrauen sichtbar.** Echte Zahlungszeichen (`payLogos()`, `/pay/*.svg`), echte Markenzeichen in Markenfarbe (`brandWall()`, `brandInk(b)`), Laufband `trustBand()`, Abzeichen `trustBadges(b)`. Nur wahre Aussagen: keine erfundenen Bewertungen, Zahlen, Siegel, keine „Partner“-Behauptungen (Marken heißen „im Sortiment“).
4. **Karten schweben.** Gutscheinkarten (`.gc`, farbig) und offizielle Spielebilder wirken auf Hell besonders; weicher farbiger Schatten (`--g`).
5. **Bewegung macht es wertig, aber schnell.** Einblenden (`.rv`), Seitenwechsel per View Transitions, Lichtpunkt unter dem Zeiger (`.card .spot …`), federnde Rückmeldung. Nur transform/opacity, `data-off` für Dauerschleifen, `.lite` sparsam, `prefers-reduced-motion` respektieren.
6. **Klarheit vor Deko.** Keine Labels über Überschriften, keine Großbuchstaben-Eyebrows, keine Emoji, keine Pfeile „→“ in Knopftexten.

## Tokens (in `css/01-base.css`)
- Grund `--bg #F3F4F6`, `--bg-2 #fff`, `--bg-3 #E9EBEF`. Text `--ink #0E1014`, `--ink-2 #474D59`, `--ink-3 #656B78` (dunkelste erlaubte Hinweisfarbe ist ink-3).
- Auswahl/Handlung: `--sel` (Schwarzchrom), `--sel-ink #fff`. Silber: `--chrome-fill` (nur für helle Metallflächen mit dunkler Schrift). Überschriften `--chrome-text` (dunkler Stahl).
- Akzente (auf Hell kontraststark): `--lav #7D5CF0`, `--iris #6A4FE0`, `--mint/--ok #0E9F6E` (Erfolg), `--rose #D9364C` (Fehler), `--amber #B86E00`, `--sky #2F7FD9`, `--pink #E7438F`. `--pearl` (Perlmutt-Verlauf), `--brand-grad`.
- Glas: `--glass` (weiß), `--glass-lo`, `--glass-solid`, `--rim`/`--rim-hi` (Haarlinie), `--lift`/`--lift-2`, `--well` + `--field` (Eingaben weiß mit Linie), `--focus` (Lavendel), `--blur`/`--blur-s`. Linien `--line`, `--line-2`.
- Form/Raum/Bewegung/Schrift wie bisher: `--r-*`, `--pill`, `--gut`, `--sec`, `--ease`, `--ease-out`, `--spring`, `--font`, `--mono`.

## Fertige Bauteile (nicht neu erfinden, nicht global überschreiben)
`.card .si-ic .cc-ic .lg-group/.lg-lens .btn(.btn-primary .btn-soft .btn-outline .btn-ghost .btn-lg .btn-sm .btn-block) .icon-btn .badge .more .chips/.chip .amounts/.amt .lbl .inp .field .phone .sel .err .flag .switch .chk .qty .otp .row .express .trust .tabs .sec .sec-head .crumb .gc (+ Varianten) .mini .mini-gc .tiles/.tile/.tile-media/.tile-meta/.qadd .rail/.rail-track/.rail-nav .catgrid/.catcard/.fan .stage/.fs/.float .phead/.phead-stage .faq/.qa .empty/.ghostfan .paylogos/.pmk/.pmk-kl/.kl-cap .spin .rv .bump .tick .shake .rip .shine .ring .spot .chrome-rim .lm .metal .lq .iph .tband .tbadges .bwall`, Kopfzeile `.hdr …`, Fußzeile `.ftr .ft-*`, `.testbar .trustbar .bgfx`.
Wenn ein Bauteil in deinem Bereich anders aussehen muss: **im Container deines Bereichs scopen** (z. B. `.pd .amt{…}`), nie die Grundregel ändern. Klassen-Präfixe vorher suchen (`grep`), damit sie nicht mit anderen Bereichen kollidieren. `.card` belegt mit Maus `::before`/`::after`.

## Knöpfe, iPhone, Seitenwechsel, Bilder
- **Knöpfe:** schlanke Pillen – 38 px (`.btn-lg` 44 px, `.btn-sm` 32 px), 14 px Schrift in Stärke 500, keine Kästen, keine fetten Schriftzüge. Beim Überfahren: leichtes Anheben, ein Glanz zieht einmal durch, ein Perlmutt-Lichtpunkt läuft um die Haarlinie, Licht folgt dem Zeiger. Drücken: leicht einsinken (scale .98). Volle Breite (`.btn-block`) nur in schmalen Formularen und Kaufboxen.
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
Echte `<button>`/`<a href>`; sichtbarer Fokus (`:focus-visible`, Lavendel); Touch-Ziele ≥ 32 px (WCAG 2.2 verlangt 24 px), Hauptaktionen 44 px; Text ≥ 4.5:1 (`--ink-3` ist die dunkelste erlaubte Textfarbe); `aria-label` an Icon-Knöpfen; dekorative Bühnen `aria-hidden`.

## Inhalt & Sprache
Deutsch, Du-Form, Satzanfang groß, kurze klare Verben („Jetzt kaufen“, „In den Warenkorb“). Fehlermeldungen sagen, was passiert ist und was zu tun ist.
**Verboten:** erfundene Bewertungen, Zahlen, Käufe, „X Personen sehen gerade“, Zertifikate/Siegel, Countdown-Druck. Bewertungen nur echte (`/api/reviews`, Anzeige ab 3 Bewertungen). Marken-Logos nicht selbst zeichnen: nur Reloadly-Kartenbilder (`b.img`), Simple-Icons-Dateien in `public/logo/` (`siI()`, Seitenverhältnis `SIA`) oder Proxy `/img/mark/<set>/<name>.svg`.

## Marke
- Name **instantcodes** (Wortmarke `<b>instant</b>codes`: „instant“ kräftig, „codes“ leicht). Zeichen `#logo`: **Ring aus flüssigem Chrom** – derselbe Ring wie auf der Startseite, in der Logo-Fassung (rundere Form, kräftigeres Chrom, Perlmutt am Rand). Bilddateien: `public/logo-ring.webp` (Symbol `#logo`, `LOGO()`), `logo.png`/`logo.svg`, `favicon.png/.svg`, `apple-touch-icon.png`, `icon-512.png` (auch Mail-Logo und Stripe-Symbol), `brand/checkout-logo.png` (Stripe-Kasse), `og.png`. In der Kopfzeile läuft der Ring live (WebGL, `.lq-mini`, Uniform `k=1`), das Bild ist der Platzhalter.
- Interne Namen bleiben: Speicher-Schlüssel `instacode_v1`, Datenbank `instacode.db`, Adressen `@instacode.store`.

## Startseite (Aufbau)
Bühne (Überschrift „Digitale Codes. In Sekunden bei dir.“, große Suche öffnet die Palette, Schnellwahl, Zahlungs-Badges; rechts der Metall-Ring mit schwebenden Glaskarten) · Markenband in Chrom · Bestseller · Kategorien-Bento · Abo-Teaser · So einfach geht's (Video `/vid/ablauf.*`) · Handy aufladen · Spiele-Keys · Angebote · Zuletzt angesehen · Aussage + Zusagen · Bewertungen · Ratgeber · Fragen · Abschluss.

## Muss erhalten bleiben
- Kopfzeile: schmale, fast durchsichtige Glas-Pille (52 px, Desktop 56 px). Effekte im Balken: lebendiger Chrom-Ring, Lichtkante folgt dem Zeiger (`--hx`), Glanz zieht alle 10 s durch, Perlmutt-Linie zeigt den Lesefortschritt (`--sp`), Glas-Linse hinter der Navigation. Wortmarke mit Polier-Glanz, Suche (Strg K), KI-Beraterin (Funkel-Symbol), Warenkorb, Konto.
- Hintergrund (`.bgfx`, liegt hinter allem, deshalb hat `body` keinen eigenen Hintergrund): Farbschleier, drei unscharfe Chrom-Ringe und ein Perlmutt-Lichtband bewegen sich beim Scrollen mit eigener Geschwindigkeit (`--sy`, nur an `.bgfx` gesetzt). Große Flächen gleiten scroll-gekoppelt herein (`animation-timeline:view()`, sonst `.rv`).
- Überschriften in klarer Tinte ohne Verlauf (`.h1` 470, `.h2` 460), Flächen als helles Glas (60–65 % Weiß), damit der bewegte Hintergrund durchscheint.
- Zahlungs-Badges im Stil echter Akzeptanzlogos (`.pmk`), Klarna-Badge wo verfügbar (`klarnaBadge()`, nicht bei Abos).
- Produktseiten mit echter URL, Aktionen Teilen/Merken/Link kopieren/Verschenken.
- Servicegebühr 4,99 € transparent; Preise = Nennwert.
- Fußzeile: „Verträge hier kündigen“ → `/kuendigen`.

## Aufbau
- `web/index.html` ist das Gerüst; der Server fügt alle Dateien aus `web/css/` und `web/js/` in Namensreihenfolge ein (JS teilt einen Gültigkeitsbereich). Live einmal beim Start, in der Entwicklung bei jeder Dateiänderung.
- Bereiche: `01–03` Fundament, `40` Startseite, `50` Katalog/Produkt/Aufladen, `60` Warenkorb/Kasse/Bestellung, `66` Abo, `70` Anmeldung/Konto/Hilfe/Rechtliches, `80` Menü/Suche/Sheets/Chat/Bewertungen.
- Neue Regeln in die Datei des Bereichs, Grundbauteile nur im Fundament ändern.
