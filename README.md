# instacode – Shop mit automatischer Code-Auslieferung

## So läuft eine Bestellung ab
1. Kunde wählt Produkt und Betrag. Zwei Wege zum Bezahlen:
   - **Express-Checkout** (Produktseite, Schnellkauf, Warenkorb-Leiste, Warenkorb, Kasse): Apple Pay, Google Pay, PayPal oder Link mit einem Klick. Die E-Mail für die Codes kommt aus der Wallet. Vorher bestätigt der Kunde per Häkchen AGB und sofortige Lieferung (Widerrufsrecht erlischt) – ohne Häkchen sind die Buttons gesperrt, der Server lehnt ab.
   - **Bezahlen direkt im Warenkorb (ohne Weiterleitung):** Der Warenkorb ist gleichzeitig die Kasse. Rechts sitzt das Stripe-Zahlungsfeld (Payment Element) im instacode-Look: Karte, Link und weitere aktive Zahlungsarten. Gezahlt wird über Stripe, der Kunde verlässt die Seite aber nicht (nur bei Zahlungsarten mit Bank-Bestätigung wie EPS kurz zur Bank und zurück). Mengen und Rabattcode lassen sich ändern, ohne dass eingegebene Kartendaten verloren gehen. Ausweichweg: „Lieber auf der Stripe-Seite bezahlen“ (Weiterleitung, wie bisher).
2. Stripe meldet die Zahlung an den Server (Webhook). Der Server prüft sofort, ob er automatisch ausliefern darf:
   - Bestellwert höchstens `AUTO_MAX_EUR` (Standard 50 €),
   - der Kunde hat in den letzten 24 Stunden nicht mehr als `AUTO_MAX_DAY_EUR` (Standard 150 €) automatisch bekommen,
   - Stripe stuft das Risiko der Zahlung als **normal** ein,
   - keine Handy-Aufladung in der Bestellung (die muss beim Anbieter gebucht werden).
3. **Ja:** Der Server nimmt die Codes aus dem Code-Lager, schickt sie per E-Mail und schließt die Bestellung ab. Der Kunde sieht nach wenigen Sekunden **Geliefert**. Bei Geschenken bekommt die beschenkte Person ihre eigene Mail. Du musst nichts tun.
4. **Nein** (oder Lager leer): Die Bestellung landet im Admin unter **Prüfen**, mit Grund. Der Kunde bekommt „Zahlung erhalten“, du bekommst „Prüfung nötig“. Du lieferst mit einem Klick aus (leere Code-Felder werden aus dem Lager gefüllt) oder **erstattest**.

## Produkte, Bilder, Bewertungen
- **Katalog:** `catalog.json` ist die einzige Produktquelle (161 Produkte: Handy-Guthaben, Spiele-Keys pro Plattform, Gaming-Guthaben, Spielwährungen, Abos, App Stores, Streaming, Shopping, Software, Prepaid-Karten). Der Server liest sie beim Start und baut sie in die Seite ein. **Alle Preise sind Beispielwerte** – vor dem Live-Gang an deine Einkaufspreise anpassen. Spiele-Keys haben pro Plattform ein eigenes Produkt (z. B. `fc26-ps5`, `fc26-xbox`, `fc26-ea`), verbunden über `grp`.
- **Produktbilder:** Ohne Bild zeigt der Shop eine gestaltete Karte in Markenfarben. Im Admin unter **Produkte** lädst du pro Produkt ein Bild hoch (PNG, JPG, WebP, max. 4 MB, ideal 1200 × 756 px). Nimm die offiziellen Kartenbilder bzw. Cover von deinem Distributor oder aus dem Markenportal des Herstellers – nur mit Nutzungserlaubnis. Dort kannst du Produkte auch ausblenden (z. B. solange kein Lager da ist).
- **Bewertungen:** Nur echte Käufer mit gelieferter Bestellung können bewerten (Link in der Liefer-Mail und auf der Bestellseite), eine Bewertung pro Bestellung, Name gekürzt („Lena H.“). Im Shop erscheinen sie ab 3 Bewertungen, mit dem Hinweis, wie sie geprüft werden (Pflicht nach § 5b UWG). Im Admin unter **Bewertungen** kannst du regelwidrige Beiträge ausblenden – schlechte Bewertungen bitte nicht. Gekaufte oder ausgedachte Bewertungen sind in Deutschland verboten (UWG).
- **Trustpilot:** Profil auf trustpilot.com anlegen (kostenlos), Kunden zum Bewerten einladen. Sobald dort echte Bewertungen stehen, `TRUSTPILOT_BUSINESS_ID` und `TRUSTPILOT_TEMPLATE_ID` eintragen – das offizielle Widget erscheint dann im Bewertungsbereich (erst nach Cookie-Zustimmung).

## E-Mails und Logo
- **Design:** Alle Mails (Bestätigungscode, Willkommen, Anmeldung, Passwort, Zahlung erhalten, Lieferung, Geschenk, Rechnung, Erstattung, Zahlung fehlgeschlagen, Admin) im schwarz-violetten Look mit animiertem Kartenmotiv. Die Bilder liegen in `public/mail/` (`*.gif`, `wordmark.png`) und werden von deiner Domain geladen – sie erscheinen in echten Mails erst, wenn `BASE_URL` auf `https://instacode.store` zeigt und die Seite online ist. Gmail und Outlook zeigen die Animation als GIF; Outlook am PC zeigt das erste Bild.
- **Absender und Antworten:** Mails gehen von `MAIL_FROM` (z. B. `hallo@instacode.store`) raus, Antworten der Kunden landen bei `SUPPORT_EMAIL` in deinem Strato-Postfach. Doppelte Mails (z. B. wenn Stripe ein Ereignis zweimal meldet) werden verhindert.
- **Rechnung:** `INVOICE_MAIL=1` schickt nach jeder Lieferung zusätzlich eine Rechnung. Erst einschalten, wenn `INVOICE_SELLER` (Name, Anschrift, USt-IdNr./Steuernummer) und `INVOICE_TAX_NOTE` mit deinem Steuerberater geklärt sind – bei Guthaben/Gutscheinen hängt die Umsatzsteuer davon ab, ob es Einzweck- oder Mehrzweckgutscheine sind.
- **Logo:** `public/logo.svg` (Original), `logo.png`, `favicon.svg/.png`, `apple-touch-icon.png`, `icon-512.png`, Vorschaubild für Links `og.png`.

## Stripe-Zahlungsseite (eingerichtet)
- **Pro Produkt beschriftet:** Auf der Stripe-Seite steht jeder Artikel mit Bild (`public/cards/<id>.jpg` bzw. dein hochgeladenes Produktbild), klarem Namen (z. B. „EA SPORTS FC 26 – PS5-Key“, „Steam Guthaben 20 €“) und Beschreibung (Plattform, wo man einlöst, Gültigkeit, Lieferung, Geschenk-Empfänger).
- **Look:** instacode-Logo (`public/brand/checkout-logo.png`), Button-Farbe Violett, Schrift Inter, Text unter dem Button „Codes sofort auf dem Bildschirm und per E-Mail“. Die Stripe-Sitzung läuft 30 Minuten; danach wird die offene Bestellung storniert. Abbrechen führt zurück in den Warenkorb mit Hinweis „nichts abgebucht“.
- **Klarna ist ausgeschlossen:** Klarna verbietet laut Stripe den Verkauf von Gutscheinen und Guthabenkarten. Der Shop blendet Klarna deshalb immer aus. Schalte Klarna zusätzlich im Stripe-Dashboard unter Einstellungen › Zahlungsmethoden aus.
- **Beschriftung der Zahlungsarten:** Der Server liest beim Start aus Stripe, welche Zahlungsarten aktiv sind (Apple Pay, Google Pay, PayPal, Amazon Pay, Link, Karte …), und der Shop zeigt nur diese an. Stand bei der Einrichtung: Apple Pay, Amazon Pay, Link und Karte aktiv; Google Pay und PayPal waren im Konto noch nicht verfügbar – sobald du sie freischaltest, erscheinen sie automatisch.
- **Bereits erledigt im Live-Konto:** Zahlungsmethoden-Domains `instacode.store` und `www.instacode.store` (aktiv für Apple Pay, Google Pay, Link, PayPal, Amazon Pay) und der Webhook `https://instacode.store/api/stripe/webhook` mit allen nötigen Ereignissen. Das Signing-Secret findest du unter Entwickler › Webhooks › Endpunkt › „Signing-Secret anzeigen“ → als `STRIPE_WEBHOOK_SECRET` in Railway eintragen.
- **Noch im Dashboard einstellen:** Einstellungen › Unternehmensdetails › Öffentliche Details: Name „instacode“, Support-E-Mail, Website `https://instacode.store`, AGB-Link `https://instacode.store/#/agb`, Abrechnungsbezeichnung „INSTACODE“.

## Code-Lager und Testmodus
- **Live** (Stripe-Schlüssel `sk_live_…`): Verkauft werden nur echte Codes, die du im Admin unter **Code-Lager** hochlädst (ein Code pro Zeile, pro Produkt und Betrag). Leere Beträge erscheinen im Shop als „ausverkauft“ und lassen sich nicht kaufen. Jeder Code wird genau einmal verkauft; doppelte Codes werden beim Hochladen übersprungen.
- **Testmodus** (`sk_test_…`): Testkäufe bekommen nur Testcodes (`TEST-XXXX-XXXX-XXXX`). Fehlen welche, erzeugt sie der **Testcode-Generator** automatisch. Oben im Shop erscheint ein Hinweis, die Mails sind als Testbestellung markiert. Echte Codes im Lager werden im Testmodus nicht angefasst.
- Der Generator ist im Live-Betrieb gesperrt. Echte Gutschein-Codes können nur von der jeweiligen Marke bzw. einem Distributor kommen – selbst erzeugte Codes würden beim Einlösen abgelehnt.
- Woher die echten Codes kommen: Einkauf bei einem Großhändler/Distributor mit Vertrag. Für Handy-Aufladungen ohne Handarbeit braucht es zusätzlich die Schnittstelle eines Aufladeanbieters (z. B. Reloadly) – noch nicht eingebaut.

## Vor dem Start klären (wichtig)
- **Stripe-Freigabe:** Der Verkauf von Guthaben/Gutscheinen anderer Firmen, Prepaid-Karten und Prepaid-Telefonguthaben gehört bei Stripe zu den eingeschränkten Geschäften und braucht eine schriftliche Freigabe. Vor dem ersten echten Verkauf beim Stripe-Support anfragen.
- **Bezugsquelle:** Codes nur aus legalen Quellen (Händler- oder Distributorverträge). Nicht als „offizieller Händler“ werben, solange es keinen Vertrag gibt.
- **Recht:** Gewerbe, Impressum, AGB, Datenschutzerklärung und Widerrufsbelehrung für digitale Inhalte. Die Seiten `#/impressum`, `#/agb`, `#/datenschutz`, `#/widerruf` enthalten nur Platzhalter. Die Texte trägst du in `public/index.html` im Abschnitt `const LEGAL=` ein (Text von einem Rechtstexte-Anbieter oder Anwalt).
- **Betrug:** Gutscheine sind ein beliebtes Ziel für Kartenbetrug: Der Code ist sofort weg, die Rückbuchung kommt Wochen später. Die Regeln oben (Betragsgrenze, Tageslimit, Stripe-Risiko) fangen das Gröbste ab. Setz die Grenzen am Anfang eher niedrig und schau dir die Prüffälle an. In Stripe unter Radar kannst du zusätzlich 3-D Secure für Karten erzwingen.

## Online stellen (am Computer, ca. 30–60 Minuten)
Empfehlung: **Railway** (railway.com), weil es dauerhaften Speicher für die Datenbank anbietet.

1. **GitHub:** Konto anlegen, neues privates Repository erstellen, den Inhalt dieses Ordners hochladen („Add file“ › „Upload files“).
2. **Railway:** „New Project“ › „Deploy from GitHub repo“ › dein Repository wählen.
3. **Speicher:** Im Service „Add Volume“, Mount-Pfad `/data`.
4. **Variablen:** Unter „Variables“ alle Werte aus `.env.example` eintragen. Für `SESSION_SECRET` und `CODES_KEY` je eine lange Zufallsfolge nehmen (z. B. aus einem Passwort-Generator, 64 Zeichen). **CODES_KEY danach nie mehr ändern**, sonst sind gespeicherte Codes unlesbar.
5. **Domain instacode.store:** In Railway › Service › „Settings“ › „Networking“ › „Custom Domain“ zuerst `instacode.store`, dann `www.instacode.store` hinzufügen. Railway zeigt dir je einen DNS-Eintrag (CNAME bzw. für die Hauptdomain ALIAS/ANAME oder CNAME-Flattening). Diese Einträge beim Anbieter, wo du die Domain gekauft hast, im DNS-Bereich anlegen. Nach einigen Minuten bis Stunden ist die Domain aktiv, das SSL-Zertifikat kommt automatisch. Als `BASE_URL` `https://instacode.store` eintragen – der Server leitet `www.` automatisch dorthin um. Falls dein Anbieter für die Hauptdomain keinen ALIAS/CNAME kann: DNS zu Cloudflare (kostenlos) umziehen.
6. **Stripe:** Dashboard › Entwickler › API-Schlüssel: zuerst die **Test-Schlüssel**, `sk_test_…` als `STRIPE_SECRET_KEY` und `pk_test_…` als `STRIPE_PUBLISHABLE_KEY`. Dann › Webhooks › Endpunkt hinzufügen: `https://instacode.store/api/stripe/webhook`, Ereignisse `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.canceled` (im Live-Konto bereits angelegt). Das Signing-Secret als `STRIPE_WEBHOOK_SECRET`. Zahlungsarten unter Einstellungen › Zahlungsmethoden aktivieren (Karte, Apple Pay, Google Pay, PayPal, Link, Klarna).
7. **Apple Pay und Google Pay freischalten:** Stripe › Einstellungen › Zahlungsmethoden › **Zahlungsmethoden-Domains** › `instacode.store` und `www.instacode.store` hinzufügen (eine Datei musst du dafür nicht hochladen, das erledigt Stripe). Apple Pay erscheint nur in Safari bzw. auf Apple-Geräten mit eingerichteter Wallet, Google Pay nur in Chrome mit hinterlegter Karte – das ist normal. Die Buttons zeigen immer nur, was auf dem Gerät des Kunden verfügbar ist.
8. **E-Mails:** Konto bei resend.com, Domain `instacode.store` verifizieren (DNS-Einträge SPF, DKIM, ggf. MX/Return-Path bei deinem Domain-Anbieter), API-Key als `RESEND_API_KEY`, Absender `instacode <hallo@instacode.store>` als `MAIL_FROM`, Firmenangaben als `MAIL_FOOTER`. Für Antworten ein Postfach `support@instacode.store` einrichten (z. B. beim Domain-Anbieter) und als `SUPPORT_EMAIL` eintragen.
9. **Admin:** Zugang hat im Live-Betrieb nur ekrem.dinler@icloud.com (fest im Code). Im Shop mit dieser Adresse anmelden, dann `BASE_URL/admin` direkt aufrufen. Der Shop zeigt nirgends einen Link dorthin; für alle anderen antwortet `/admin` mit „Not Found“.
10. **Testkauf:** Mit der Stripe-Testkarte `4242 4242 4242 4242` (beliebiges Datum in der Zukunft, beliebige Prüfnummer) unter 50 € bestellen – die Testcodes kommen automatisch per Mail. Für den Prüffall eine Bestellung über 50 € oder die Stripe-Testkarte `4000 0000 0000 9235` (erhöhtes Risiko) nehmen und im Admin ausliefern. Die Express-Buttons kannst du im Testmodus mit einer Testkarte in deiner echten Wallet ausprobieren (Stripe ersetzt sie im Testmodus automatisch).
11. **Live gehen:** Erst nach Stripe-Freigabe und fertigen Rechtstexten die Live-Schlüssel (`sk_live_…`, `pk_live_…`) eintragen, einen neuen Live-Webhook mit denselben Ereignissen anlegen, die Zahlungsmethoden-Domains im Live-Modus prüfen, Preise in `catalog.json` anpassen und echte Codes ins Code-Lager hochladen.

## Weitere Einstellungen
- **Support-Adresse:** über `SUPPORT_EMAIL` (Standard `support@instacode.store`).
- **Datenschutz:** Stripe (Zahlung, Express-Buttons laden `js.stripe.com`) und – falls eingetragen – Trustpilot und Google-Login in der Datenschutzerklärung nennen. Trustpilot lädt erst nach Cookie-Zustimmung.
- **Anmeldung mit Apple, Google, PayPal, Microsoft, Discord, Twitch, Steam, Amazon und SMS:** im Admin unter „Anmeldung“ einrichten (Anleitung, Redirect-URIs zum Kopieren, „Testen“ und „Probe-Anmeldung“). Zugangsdaten werden verschlüsselt gespeichert und wirken sofort; Railway-Variablen (siehe `.env.example`) haben Vorrang. Im Shop erscheinen nur eingerichtete Anbieter, die Datenschutzerklärung nennt sie automatisch. Code in `auth.js` und `web/js/53-express.js`.
- **Produkte und Preise:** nur in `catalog.json` pflegen (Beträge `amts`, Anzeigenamen `labels`, Rabatt `disc`, Farben `bg`/`fg`, Logo-Text `mark`, Plattform `plat`, Region `region`, Suchbegriffe `tags`, `hot` für „beliebt“). Nach Änderungen den Server neu starten.
- **Schrift:** Aus Datenschutzgründen lädt die Seite keine Google Fonts, sondern nutzt die Systemschrift. Für „Plus Jakarta Sans“ die Schriftdateien selbst in `public/` ablegen und per `@font-face` einbinden.
- **Backups:** Die Datenbank liegt in `/data/instacode.db`, hochgeladene Produktbilder in `/data/img/`. Beides regelmäßig sichern.
- **Ladezeit:** Die Startseite wird mit Katalog fertig ausgeliefert und vom Server komprimiert (ca. 65 KB statt 265 KB).

## KI-Agenten (Admin › KI-Agenten)
Drei Claude-Agenten arbeiten dauerhaft im Hintergrund am Shop. Der Server prüft alle 5 Minuten, wer fällig ist; es läuft immer nur einer gleichzeitig. Code in `agents.js`.
- **Sortiment-Agent** (Standard alle 12 Std.): recherchiert per Websuche, was in Deutschland gefragt ist, sucht passende Marken beim Lieferanten Reloadly und schlägt sie vor. Nach der Freigabe lädt der Shop die Produkte mit **offiziellen Bildern und Einkaufspreisen vom Lieferanten** (plus `RL_MARGIN`). Bilder oder Texte aus dem Netz übernimmt er nie. Außerdem: Produkttexte und Suchbegriffe schreiben, Bestseller als „beliebt“ markieren, Unpassendes ausblenden, fehlende Produkte ohne Lieferanten als „Sortimentslücke“ melden.
- **Design-Agent** (alle 72 Std.): entwirft Farbwelten und Startseiten-Überschrift passend zu Saison und Sortiment, nur mit freigegebenen Farb-Tokens aus `web/css/01-base.css` und nach `web/DESIGN.md`. Jeder Entwurf hat eine Vorschau (`/?design=<nr>`, nur für den Admin sichtbar). „Standard-Design wiederherstellen“ setzt alles zurück.
- **Shop-Wächter** (täglich): prüft Prüffälle, hängende Zahlungen, Ausverkauftes, Lieferanten-Guthaben, Zahlungsarten und Bewertungen und schreibt eine priorisierte Aufgabenliste.
- **Freigabe oder automatisch:** pro Agent einstellbar. Standard: Sortiment und Design nur mit Freigabe, der Wächter-Bericht automatisch. Alles steht im Verlauf; Ausblenden, Texte und Design lassen sich zurücknehmen.
- **Kosten:** Tages-Budget in US-Dollar (Standard 5 $, `AGENT_DAILY_USD`), danach Pause bis Mitternacht. Modell `claude-opus-5-5` (änderbar auf Sonnet/Haiku). Bei einer Ablehnung durch die Sicherheitsfilter springt automatisch ein anderes Claude-Modell ein (server-side fallback).
- Voraussetzung: `ANTHROPIC_API_KEY` in Railway. Für neue Marken mit Bildern und Preisen zusätzlich Reloadly (`RELOADLY_CLIENT_ID`/`_SECRET`).

## Lokal testen (für Entwickler)
```
npm install
cp .env.example .env   # Werte eintragen, NODE_ENV=development, DATA_DIR=./data, BASE_URL=http://localhost:3000
npm start
```
Ohne `RESEND_API_KEY` erscheinen Mails nur im Terminal. Für Webhooks lokal: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
