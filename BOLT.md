# instacode – Bolt.new

Dieses Projekt ist für eine Node.js/Express-Umgebung vorbereitet.

## In Bolt.new
1. Das komplette Projekt als ZIP importieren/hochladen.
2. Bolt soll `npm install` ausführen.
3. Zum Starten `npm run dev` bzw. `npm start` verwenden.
4. Die Vorschau läuft über den von Bolt bereitgestellten Port (`PORT`).

## Wichtig
- Die Shop-Oberfläche funktioniert auch ohne Stripe/Resend-Konfiguration und kann in der Vorschau betrachtet werden.
- Checkout/Zahlungen sind ohne `STRIPE_SECRET_KEY` absichtlich deaktiviert.
- Für echte Zahlungen müssen die Umgebungsvariablen aus `.env.example` in Bolt als Secrets/Environment Variables hinterlegt werden.
- Für eine echte Produktionsumgebung braucht die SQLite-Datenbank persistenten Speicher. Bolt-Preview ist nicht als dauerhafte Produktionsdatenbank gedacht.
- Niemals echte Stripe- oder Resend-Schlüssel in den Quellcode schreiben.

## Vorschau ohne externe Dienste
`NODE_ENV` kann leer bleiben bzw. auf `development` gesetzt werden. Der Server startet standardmäßig auf Port 3000 bzw. dem von Bolt gesetzten `PORT`.
