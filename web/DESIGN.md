# instantcodes – Design „Silberstreifen“

Shop für digitale Codes (Gutscheine, Spiele-Keys, Spielguthaben, Handy-Guthaben), Lieferung per E-Mail in Sekunden. Deutsch, Du-Form, überwiegend iPhone.
Gegenstand ist die **Gutscheinkarte selbst**: ID-1-Format (1,586 : 1), Markenfarbe und Logo, Hologramm-Folie, Silberstreifen über dem Code.
Der eine besondere Moment: der Code erscheint. Alles andere ist ruhig, hell und klar.

Stilschicht: `css/95-silber.css` (kommt nach allen anderen Stilen, überschreibt die Grundstile über Tokens und gezielte Regeln).

## Farben (Tokens in `:root` von 95-silber.css)
| Name | Wert | Verwendung |
|---|---|---|
| Alu | `#EEF0F3` (`--bg`) | Seitengrund. Kühl, silbrig, nie cremig |
| Kartenweiß | `#FFFFFF` | Flächen |
| Gunmetal | `#1D2129` (`--ink`, `--sel`) | Text und die **eine** Hauptaktion |
| Zinn | `#626A76` (`--ink-3`) | Nebentext (4,8 : 1 auf Alu). `--ink-2 #4A515C` für Beschriftungen |
| Silberlinie | `rgba(29,33,41,.12)` (`--line`) | 1-px-Strukturlinien |
| Folie | `--foil-g` (+ Holo `--holo-g`) | **nur** Rubbelstreifen im Hero, gewählter Betrag (Folienkante), Echos des Logo-Rings |
| Status-Grün | `#1E8E5A` (`--ok`) | nur Lieferstatus |
| Fußzeile | `#E6E9ED` | Grund der Fußzeile, Nebentext dort `#4E5561` |

## Schrift: nur Geist
- Display (genau eine pro Seite: Hero-Überschrift oder Seitentitel): 500, −0,045em, Zeilenhöhe .98, `clamp(44px,8vw,92px)`.
- H2: 600, −0,03em, `clamp(28px,3.4vw,40px)`, 1,08. Karten- und Abschnittstitel: 600, 17–19 px, −0,012em.
- Text: 400, 16 px (ab 900 px 17 px), 1,55, höchstens 66ch. Klein/Meta: 14 px, 450, Zinn. Preise: 600, `tabular-nums`. Knöpfe: 15 px, 550.
- Keine Stärke unter 400 bei Text unter 24 px. Keine Eyebrows, keine Großbuchstaben-Labels, keine Pfeile in Knopftexten, keine „A · B · C“-Ketten in neuen Texten.

## Formen und Schatten
- Ecken: 12 px Karten und Produktbilder (`.gc` mit `min(12px,…)`, wächst mit kleinen Karten mit), 10 px Knöpfe und Eingaben, 8 px Chips, 22 px Flächen und Blätter. Keine Pillen außer winzigen Statuspunkten.
- Schatten nur für Gegenstände (Karten, Cover): `--obj` = `0 1px 1px rgba(29,33,41,.08),0 12px 26px -16px rgba(29,33,41,.38)`.
- Flächen: weiß mit 1-px-Silberlinie (`--rim`), ohne Schlagschatten (`--lift` ist leer).

## Glas
Nur Kopfzeile, klebende Kaufleiste (`.pd-bar-in`) und Blätter/Schubladen (`.sheet .drawer .menu .pal-box .qpanel .mia`): `rgba(255,255,255,.78)` mit `blur(16px) saturate(1.6)`.
`-webkit-backdrop-filter` zuerst, mit festen Werten, nie mit Variablen. Eine globale Regel setzt `backdrop-filter` und `mix-blend-mode` überall zurück; Glas wird nur dort ausdrücklich eingeschaltet.
Auf `.lite` behält nur die Kopfzeile den Weichzeichner, alles andere ist `.96` Weiß (das Vollbild-Menü auf dem Handy deckend). Bei `prefers-reduced-transparency` deckend weiß. Alles andere ist deckend.

## Bewegung
- Eine inszenierte Szene, im Hero: Code-Karte (`js/19-codecard.js`) gleitet aus dem Chrom-Ring (~700 ms, nur transform/opacity), dann wird die Folie im Zickzack weggerubbelt (~1,1 s, eine Canvas, rAF nur während der Animation, Zeit der Dokument-Zeitleiste) und ein **Beispielcode** erscheint, immer mit Beschriftung „Beispielcode“. Maus: Klick legt die Folie wieder auf, Zeiger rubbelt frei. Touch: Tippen spielt erneut ab, `touch-action:pan-y`.
- `.rv`-Einblenden ist abgeschaltet, Inhalte stehen einfach da. Seitenwechsel nur als kurzes Überblenden.
- Hover nur mit Maus; auf Karten nur der Holo-Lichtschwenk (`.gc::after`) plus 2 px Anheben auf Kacheln.
- Bänder: Kartenwand (`.cwall`) und Markenlogos laufen langsam; Bewertungsband ruhig. Keine Daueranimationen auf vielen kleinen Elementen.
- `prefers-reduced-motion`: Endzustand sofort.

## Bauteile
- **Knöpfe:** `.btn-primary`/`.btn-ink` = Gunmetal mit 1-px-Innenlicht oben, 48 px Handy / 44 px Desktop, eine pro Ansicht. `.btn-soft`/`.btn-outline` = Weiß mit Silberlinie. `.btn-ghost` = Textlink (Unterstrich, Abstand 3 px). „Anmelden“ in der Kopfzeile ist Nebenknopf.
- **Chips:** 34 px, 8 px Ecken, weiß mit Linie; gewählt Gunmetal mit weißer Schrift. **Beträge** (`.amt`): gewählt Gunmetal mit statischer Folienkante.
- **Eingaben:** weiß, Linie, 10 px, 16 px Schrift. Fokus überall: 2 px Gunmetal-Umriss mit 2 px Abstand.
- **Kacheln** (`tile()` in js/10-components.js): kein Kasten; die Karte bzw. das Cover ist das Objekt. Darunter Name (15/600), Preis (14, tabular), eine Meta-Zeile (13, Zinn: Plattformen bzw. Land). Schnellkauf `.qadd` (`data-a="qb"`) als 34-px-Scheibe unten rechts.
- **Kategorien** (`kbCard` in js/30-catalog.js): Index-Liste statt Bento – Zeile ≥ 76 px, Linien statt Kästen, links der Stapel echter Markenzeichen (`kLogosL` in js/18-marks.js: nur Zeichen, die in der Plakette ≥ ~14 px lesbar sind; Plakette 34 px Handy, 38 px Desktop, Zeichen ~54 %, Überlappung −9 px), dann Name und Anzahl („235 Spiele“, „47 Marken“, „19 Anbieter“), rechts ein Pfeil. Desktop zweispaltig. Hover: weiße Zeile.
- **Abschnittsköpfe:** H2 links, rechts höchstens ein Textlink („Alle anzeigen“) bzw. Wischleisten-Knöpfe.
- **Kopfzeile:** volle Breite, 56 px, Glas; die Silberlinie unten erscheint erst nach dem Scrollen (`.hdr.scrolled`, gesetzt in `scrollFx()` in js/90-start.js). Darüber eine 32-px-Leiste nur mit Zahlungszeichen.
- **Produktseite:** weiße Bildfläche (22 px), Spielbild und offizielles Logo bleiben (`.pd-hero`, `.pd-glogo`); Kaufbox weiße Fläche mit Linie; „Jetzt kaufen“ Hauptaktion, „In den Warenkorb“ Nebenknopf; Stripe-Express-Knöpfe unverändert.
- **Fußzeile:** `#E6E9ED`, Gunmetal, echte Zahlungszeichen.

## Startseite (Aufbau)
Bühne (Überschrift, Satz, Suche 52 px, Schnellwahl-Chips; Ring mit Code-Karte; ein ruhiger Vertrauenssatz mit Live-Zahl der Marken und `payLogos()`) · Kategorien (Index-Liste) · Bestseller · Kartenwand („Regal“) · Spiele-Keys · Geschenk-Finder · So einfach geht's (drei Schritte, Ablauf-Video) · Abo · Handy aufladen · Angebote · Zuletzt angesehen · Warum instantcodes · Bewertungen · Ratgeber · Fragen · Abschluss.
Hintergrund: keine Farbschleier, keine schwebenden Ringe; nur ein statischer Holo-Schein hinter dem Hero-Ring.

## Muss erhalten bleiben
- Alle ids, Klassen und data-Attribute, die JS oder Tests nutzen. Im Zweifel umgestalten statt entfernen.
- **Zahlungszeichen unverändert:** Original-Zeichen auf weißer Plakette, gleiche Höhe; Revolut Pay immer Zeichen plus Name; `.kl-warn` („Achtung! Kreditaufnahme kostet Geld.“) direkt unter jeder Klarna-Werbung für späteres Bezahlen; Logik von `payTop()`/`payBand()` unverändert. Nur zeigen, was die Kasse anbietet.
- Echte Markenzeichen (`kLogos`/`kLogosL`), keine Emoji oder Ersatzsymbole.
- **Ehrlichkeit:** keine erfundenen Bewertungen, Zahlen, Rabatte, keine Dringlichkeit; Bewertungen nur echte (Anzeige ab 3); Widerrufs-Zustimmung nie vorausgewählt; der Hero-Code ist sichtbar als „Beispielcode“ beschriftet und zeigt einen Betrag, den die Marke wirklich anbietet.
- Servicegebühr 4,99 € transparent; „Verträge hier kündigen“ in der Fußzeile.

## Leistung (iPhone-Grafikspeicher)
Kein `backdrop-filter` auf `.lite` außer Kopfzeile; kein `mix-blend-mode`; keine Daueranimationen auf vielen kleinen Elementen; animiert wird nur transform/opacity.
Messung `layers2.js` (iPhone): Startseite ≤ 90 Ebenen, andere Seiten ≤ 70.

## Barrierefreiheit
Text ≥ 4,5 : 1; Hauptaktionen ≥ 44 px Trefferfläche (Pseudo-Element erlaubt); Eingaben ≥ 16 px; sichtbarer Fokus; Deko `aria-hidden`.

## Marke
Name **instantcodes** (Wortmarke `<b>instant</b>codes`), Zeichen: Ring aus flüssigem Chrom (`#logo`, live als WebGL in der Kopfzeile `.lq-mini`, groß im Hero, js/13-liquid.js). Interne Namen bleiben (`instacode_v1`, `instacode.db`).

## Aufbau
`web/index.html` ist das Gerüst; der Server fügt alle Dateien aus `web/css/` und `web/js/` in Namensreihenfolge ein (JS teilt einen Gültigkeitsbereich).
Bereiche: `01–03` Fundament, `40` Startseite, `50` Katalog/Produkt/Aufladen, `60` Warenkorb/Kasse/Bestellung, `66` Abo, `70` Anmeldung/Konto/Hilfe/Rechtliches, `80` Menü/Suche/Blätter/Chat, `95-silber` Gestaltung.
Handy-Videos (`/vid/*`): aufgenommen mit `rec6.js`/`rec7.js` in /home/claude/devshim/vid, kodiert wie `enc7.sh`; nach neuer Aufnahme `?v=` erhöhen.
