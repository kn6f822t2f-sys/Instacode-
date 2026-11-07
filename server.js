"use strict";
/* instantcodes – Shop-Server (instacode.store)
   Konten, Bestätigungs-E-Mails, Stripe Checkout und Expresszahlung (Apple Pay, Google Pay, PayPal …),
   automatische Code-Auslieferung, Bewertungen nach dem Kauf, Produktbilder, Admin-Bereich. */
const express = require("express");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Stripe = require("stripe");
const mail = require("./emails");
const RL = require("./reloadly");
const CATALOG = require("./catalog.json");
/* Offizielle Shop-Bilder der Spiele (Steam, Nintendo, PlayStation, Minecraft) – nur die Adressen, siehe tools/covers.js */
const COVERS = (() => { try { return require("./covers.json"); } catch (e) { return {}; } })();

const E = process.env;
const PROD = E.NODE_ENV === "production";
const BASE = (E.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const stripe = E.STRIPE_SECRET_KEY ? Stripe(E.STRIPE_SECRET_KEY) : null;
/* Admin-Zugang: im Live-Betrieb ausschließlich diese eine Adresse (fest eingebaut, nicht per Variable änderbar) */
const OWNER = "ekrem.dinler@icloud.com";
const ADMINS = PROD ? [OWNER] : ((E.ADMIN_EMAILS || OWNER).split(",").map(s => s.trim().toLowerCase()).filter(Boolean));
const PROMOS = { WILLKOMMEN10: 0.10 };
/* Preise: Mehrwertsteuer wird auf jeden Produktpreis aufgeschlagen, dazu eine feste Servicegebühr pro Bestellung (enthält ebenfalls MwSt.) */
const VAT = Math.max(0, Number(E.VAT_RATE != null && E.VAT_RATE !== "" ? E.VAT_RATE : 0)); // Preise sind bereits Endpreise inkl. MwSt.; nur bei Bedarf Aufschlag setzen
const FEE = Math.max(0, Math.round(Number(E.SERVICE_FEE != null && E.SERVICE_FEE !== "" ? E.SERVICE_FEE : 4.99) * 100));
const gross = net => Math.round(net * (100 + VAT) / 100);
const vatOf = g => VAT ? Math.round(g - g * 100 / (100 + VAT)) : 0;
const PK = E.STRIPE_PUBLISHABLE_KEY || "";
const DEVPAY = /_attrappe$/.test(E.STRIPE_SECRET_KEY || "");   // nur Vorschau-Umgebung ohne echtes Stripe
/* Uhr für die Abo-Logik. In der Vorschau (Stripe-Attrappe) kann eine Test-Uhr sie vorstellen, wie Stripe-Test-Clocks; live immer die echte Zeit. */
const clock = () => Date.now() + (DEVPAY ? (+globalThis.__icClock || 0) : 0);
const SUPPORT = E.SUPPORT_EMAIL || "info@instantcodes.de";
/* Neuere Stripe-API-Version nur für Checkout und PaymentIntents (Branding, ausgeschlossene Zahlungsarten) */
const STRIPE_V = "2025-09-30.clover";
/* Klarna verbietet laut Stripe den Verkauf von Gutscheinen und Guthabenkarten – deshalb ausgeschlossen, außer alle Artikel
   liegen in einer im Admin freigegebenen Kategorie (klarnaOk / KLARNA_CATS) */
const EXCLUDED_PM = ["klarna"];
/* Welche Zahlungsarten im Shop beschriftet werden: live aus der Stripe-Zahlungsarten-Einstellung gelesen.
   Reihenfolge = Reihenfolge der Express-Knöpfe (Apple Pay, Google Pay, PayPal, Revolut Pay, Klarna, Amazon Pay, Link).
   crypto = Stripe-Stablecoin-Zahlung: nur Zeichen, erscheint live ausschließlich, wenn sie im Stripe-Konto wirklich aktiv ist */
const PM_SHOW = ["apple_pay", "google_pay", "paypal", "revolut_pay", "amazon_pay", "link", "card", "eps", "bancontact", "crypto"];
let KLARNA_AVAIL = E.KLARNA_AVAILABLE === "1";
/* Vorschau ohne echtes Stripe: alle Express-Zahlungsarten simuliert aktiv (PAY_METHODS bzw. KLARNA_AVAILABLE=1 überschreiben) */
let PAY_METHODS = (E.PAY_METHODS || (DEVPAY ? "apple_pay,google_pay,paypal,revolut_pay,amazon_pay,link,card,crypto" : "apple_pay,google_pay,card,link")).split(",").map(s => s.trim()).filter(m => PM_SHOW.includes(m));
async function loadPayMethods() {
  if (!stripe || /_attrappe$/.test(E.STRIPE_SECRET_KEY || "") || E.PAY_METHODS) return;
  try {
    const l = await stripe.paymentMethodConfigurations.list({ limit: 20 });
    const c = (l.data || []).find(x => x.is_default && x.active) || (l.data || [])[0];
    if (!c) return;
    KLARNA_AVAIL = !!(c.klarna && c.klarna.available && c.klarna.display_preference && c.klarna.display_preference.value === "on");
    const on = PM_SHOW.filter(m => !EXCLUDED_PM.includes(m) && c[m] && c[m].available && c[m].display_preference && c[m].display_preference.value === "on");
    if (on.length) PAY_METHODS = on;
  } catch (e) { console.error("Zahlungsarten konnten nicht gelesen werden:", e.message); }
}
/* Eingebettetes Zahlungsfeld im Warenkorb (Payment Element): Karte (inkl. Apple/Google Pay über die Express-Buttons) plus aktive Zusatzarten */
/* crypto bewusst nicht: Stripe-Stablecoins laufen laut Stripe nur in USD (andere Währungen private Vorschau) – ein EUR-Zahlungsfeld würde scheitern */
const INLINE_PM = ["card", "link", "paypal", "revolut_pay", "amazon_pay", "eps", "bancontact"];
const inlineTypes = () => INLINE_PM.filter(m => m === "card" || PAY_METHODS.includes(m));
/* Trustpilot: der Link „Bewerte uns auf Trustpilot“ steht immer bereit (TRUSTPILOT_URL=aus schaltet ihn ab).
   Das Widget mit Sternen (TrustBox) gibt es nur mit TRUSTPILOT_BUSINESS_ID und TRUSTPILOT_TEMPLATE_ID, geladen erst nach Einwilligung. */
const TP_URL = /^(0|aus|off|nein)$/i.test(E.TRUSTPILOT_URL || "") ? "" : (E.TRUSTPILOT_URL || "https://de.trustpilot.com/review/instantcodes.de");
const TP = TP_URL ? { url: TP_URL, write: /\/review\//.test(TP_URL) ? TP_URL.replace("/review/", "/evaluate/") : TP_URL,
  widget: !!(E.TRUSTPILOT_BUSINESS_ID && E.TRUSTPILOT_TEMPLATE_ID), bu: E.TRUSTPILOT_BUSINESS_ID || "", tpl: E.TRUSTPILOT_TEMPLATE_ID || "" } : null;
if (PROD && (!E.SESSION_SECRET || !E.CODES_KEY)) { console.error("SESSION_SECRET und CODES_KEY müssen gesetzt sein."); process.exit(1); }

/* Automatische Auslieferung
   LIVE: echter Stripe-Schlüssel (sk_live_/rk_live_). Dann nur echte Codes aus dem Lager, Generator gesperrt.
   Testmodus: Testkäufe nutzen nur Testcodes; fehlen welche, erzeugt der Generator sie (TEST-…). */
const LIVE = /^(sk|rk)_live_/.test(E.STRIPE_SECRET_KEY || "");
const TESTMODE = !LIVE;
const TEST_GEN = TESTMODE && E.TEST_CODES !== "0";
const AUTO = E.AUTO_DELIVERY !== "0";
const euroCents = (v, d) => { const n = parseFloat(String(v == null ? "" : v).replace(",", ".")); return Math.round((isFinite(n) ? n : d) * 100); };
const AUTO_MAX = euroCents(E.AUTO_MAX_EUR, 50);        // höchster Bestellwert für Sofortlieferung
const AUTO_DAY = euroCents(E.AUTO_MAX_DAY_EUR, 150);   // höchstens so viel pro Kunde (E-Mail) in 24 Stunden

/* ---------- Datenbank ---------- */
const DATA = E.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(DATA, { recursive: true });
const db = new Database(path.join(DATA, "instacode.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("synchronous = NORMAL");   // mit WAL sicher und deutlich schneller
db.pragma("temp_store = MEMORY");
db.pragma("cache_size = -16000");    // ca. 16 MB Seiten-Cache
db.pragma("mmap_size = 134217728");
db.pragma("busy_timeout = 5000");
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, pw_hash TEXT,
  verified INTEGER DEFAULT 0, google_sub TEXT, login_alerts INTEGER DEFAULT 1, created_at INTEGER);
CREATE TABLE IF NOT EXISTS idents(provider TEXT NOT NULL, sub TEXT NOT NULL, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER, PRIMARY KEY(provider, sub));
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER);
CREATE TABLE IF NOT EXISTS tokens(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, kind TEXT,
  hash TEXT, expires_at INTEGER, used INTEGER DEFAULT 0, tries INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, access_key TEXT, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email TEXT, status TEXT, currency TEXT, subtotal INTEGER, discount INTEGER, total INTEGER, promo TEXT,
  stripe_session TEXT, payment_intent TEXT, created_at INTEGER, paid_at INTEGER, delivered_at INTEGER, note TEXT);
CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY, order_id TEXT REFERENCES orders(id) ON DELETE CASCADE, brand TEXT, name TEXT,
  unit INTEGER, face INTEGER, qty INTEGER, type TEXT, phone TEXT, gift_to TEXT, gift_from TEXT, gift_msg TEXT, codes TEXT);
CREATE INDEX IF NOT EXISTS ix_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS ix_orders_user ON orders(user_id);
CREATE TABLE IF NOT EXISTS codes(id INTEGER PRIMARY KEY, brand TEXT NOT NULL, face INTEGER NOT NULL, code TEXT NOT NULL, hash TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'free', is_test INTEGER NOT NULL DEFAULT 0, order_id TEXT, item_id INTEGER, added_at INTEGER, sold_at INTEGER);
CREATE INDEX IF NOT EXISTS ix_codes_pick ON codes(brand, face, status, is_test);
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY, active INTEGER NOT NULL DEFAULT 1, img TEXT, img_v INTEGER);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY, order_id TEXT UNIQUE NOT NULL, email TEXT, name TEXT, rating INTEGER NOT NULL,
  text TEXT, brands TEXT, hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER);
CREATE INDEX IF NOT EXISTS ix_reviews_vis ON reviews(hidden, created_at);
CREATE TABLE IF NOT EXISTS rl_catalog(product_id INTEGER PRIMARY KEY, id TEXT UNIQUE, data TEXT NOT NULL, img TEXT, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS optout(email TEXT PRIMARY KEY, at INTEGER);
CREATE TABLE IF NOT EXISTS rl_map(id TEXT PRIMARY KEY, product_id INTEGER, country TEXT, name TEXT, amts TEXT, updated_at INTEGER);`);
/* Spalten nachrüsten, falls die Datenbank schon von einer älteren Version stammt */
const orderCols = db.prepare("PRAGMA table_info(orders)").all().map(c => c.name);
if (!orderCols.includes("delivered_by")) db.exec("ALTER TABLE orders ADD COLUMN delivered_by TEXT");
if (!orderCols.includes("hold_reason")) db.exec("ALTER TABLE orders ADD COLUMN hold_reason TEXT");
if (!orderCols.includes("channel")) db.exec("ALTER TABLE orders ADD COLUMN channel TEXT");
if (!orderCols.includes("fee")) db.exec("ALTER TABLE orders ADD COLUMN fee INTEGER DEFAULT 0");
if (!orderCols.includes("vat")) db.exec("ALTER TABLE orders ADD COLUMN vat INTEGER DEFAULT 0");
const prodCols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
if (!prodCols.includes("logo")) db.exec("ALTER TABLE products ADD COLUMN logo TEXT");
if (!prodCols.includes("logo_v")) db.exec("ALTER TABLE products ADD COLUMN logo_v INTEGER");
if (!db.prepare("PRAGMA table_info(rl_map)").all().some(c => c.name === "manual")) db.exec("ALTER TABLE rl_map ADD COLUMN manual INTEGER DEFAULT 0");
if (!prodCols.includes("img_src")) db.exec("ALTER TABLE products ADD COLUMN img_src TEXT");
if (!orderCols.includes("consent_at")) db.exec("ALTER TABLE orders ADD COLUMN consent_at INTEGER");
if (!orderCols.includes("pay_fp")) db.exec("ALTER TABLE orders ADD COLUMN pay_fp TEXT"); // Fingerabdruck des Zahlungsmittels (Tageslimit pro Karte/Wallet)
/* Passkeys (WebAuthn): öffentlicher Schlüssel (SPKI, base64url), Algorithmus, Zähler; id = Credential-ID (base64url) */
db.exec(`CREATE TABLE IF NOT EXISTS passkeys(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, pubkey TEXT NOT NULL, alg INTEGER NOT NULL,
  sign_count INTEGER NOT NULL DEFAULT 0, transports TEXT, name TEXT, aaguid TEXT, user_handle TEXT, backed_up INTEGER DEFAULT 0, created_at INTEGER, last_used INTEGER);
CREATE INDEX IF NOT EXISTS ix_passkeys_user ON passkeys(user_id);`);

/* ---------- Hilfsfunktionen ---------- */
const now = () => Date.now();
const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
const rnd = (n = 32) => crypto.randomBytes(n).toString("base64url");
const KEY = crypto.createHash("sha256").update(E.CODES_KEY || E.SESSION_SECRET || "nur-fuer-lokale-tests").digest();
const enc = t => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", KEY, iv); const d = Buffer.concat([c.update(t, "utf8"), c.final()]); return [iv, c.getAuthTag(), d].map(b => b.toString("base64")).join("."); };
const dec = s => { const [iv, tag, d] = s.split(".").map(x => Buffer.from(x, "base64")); const c = crypto.createDecipheriv("aes-256-gcm", KEY, iv); c.setAuthTag(tag); return Buffer.concat([c.update(d), c.final()]).toString("utf8"); };
const norm = e => String(e || "").trim().toLowerCase();
const emailOk = e => typeof e === "string" && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const isAdmin = u => !!u && u.verified && ADMINS.includes(u.email);
const pub = u => u && { id: u.id, email: u.email, name: u.name, verified: !!u.verified, admin: isAdmin(u), loginAlerts: !!u.login_alerts, google: !!u.google_sub };
const userById = id => db.prepare("SELECT * FROM users WHERE id=?").get(id);
const userByEmail = e => db.prepare("SELECT * FROM users WHERE email=?").get(e);
const safe = p => p.catch(err => console.error("Mail-Fehler:", err.message));
const cookies = req => Object.fromEntries((req.headers.cookie || "").split(";").map(c => c.trim()).filter(Boolean).map(c => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));

/* Bestell-E-Mail bestätigen: vor jeder Zahlung Pflicht (Code per E-Mail). Nachweis als signiertes Cookie, 24 Stunden gültig. */
const EV_TTL = 24 * 36e5;
const evSign = (e, exp) => crypto.createHmac("sha256", KEY).update(`ev|${e}|${exp}`).digest("base64url");
function verifiedEmail(req) {
  if (req.user && req.user.verified) return req.user.email;
  const v = cookies(req).ic_ev;
  if (!v) return null;
  const [e64, exp, sig] = v.split(".");
  let e; try { e = Buffer.from(e64 || "", "base64url").toString("utf8"); } catch { return null; }
  if (!e || !(+exp > now())) return null;
  const want = evSign(e, exp);
  if (!sig || sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  return e;
}
const EV_MSG = "Bitte bestätige zuerst deine E-Mail-Adresse mit dem Code, den wir dir schicken.";

function startSession(res, uid) {
  const t = rnd();
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(sha(t), uid, now() + 30 * 864e5);
  res.cookie("ic_sess", t, { httpOnly: true, secure: PROD, sameSite: "lax", maxAge: 30 * 864e5, path: "/" });
}
function endSession(req, res) {
  const t = cookies(req).ic_sess;
  if (t) db.prepare("DELETE FROM sessions WHERE token_hash=?").run(sha(t));
  res.clearCookie("ic_sess", { path: "/" });
}
const linkOrders = (uid, email) => db.prepare("UPDATE orders SET user_id=? WHERE user_id IS NULL AND email=?").run(uid, email);

async function sendVerify(u) {
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare("UPDATE tokens SET used=1 WHERE user_id=? AND kind='verify'").run(u.id);
  db.prepare("INSERT INTO tokens(user_id,kind,hash,expires_at) VALUES(?,?,?,?)").run(u.id, "verify", sha(code), now() + 15 * 60e3);
  await (u.verified ? mail.loginCode(u.email, u.name, code) : mail.verify(u.email, u.name, code)); // bestätigtes Konto: Anmelde-Code, sonst E-Mail bestätigen
}

function orderFull(id) {
  const o = db.prepare("SELECT * FROM orders WHERE id=?").get(id);
  if (!o) return null;
  o.items = db.prepare("SELECT * FROM items WHERE order_id=? ORDER BY id").all(id).map(i => ({
    id: i.id, brand: i.brand, name: i.name, face: i.face, unit: i.unit, qty: i.qty, type: i.type, phone: i.phone,
    gift_to: i.gift_to, gift_from: i.gift_from, gift_msg: i.gift_msg, codes: i.codes ? JSON.parse(dec(i.codes)) : []
  }));
  return o;
}
const pubOrder = (o, admin) => ({
  id: o.id, status: o.status, channel: o.channel, reviewed: o.status === "delivered" ? !!db.prepare("SELECT 1 FROM reviews WHERE order_id=?").get(o.id) : undefined, email: o.email, currency: o.currency, subtotal: o.subtotal, discount: o.discount, fee: o.fee || 0, vat: o.vat != null ? o.vat : vatOf(o.total), total: o.total,
  created_at: o.created_at, paid_at: o.paid_at, delivered_at: o.delivered_at, note: admin ? o.note : undefined,
  access_key: admin ? o.access_key : undefined, hold_reason: admin ? o.hold_reason : undefined, delivered_by: admin ? o.delivered_by : undefined,
  items: o.items.map(i => ({ ...i, codes: admin || (o.status === "delivered" && !i.gift_to) ? i.codes : [] }))
});

/* ---------- Katalog: Datei + Einstellungen aus der Datenbank (aktiv, Produktbild) ---------- */
const IMG_DIR = path.join(DATA, "img");
fs.mkdirSync(IMG_DIR, { recursive: true });
const fc = a => Math.round(Number(a) * 100);                       // Euro → Cent
const optLabel = (b, a) => (b.labels && b.labels[b.amts.indexOf(a)]) || `${String(a).replace(".", ",")} €`;
let prodCache = null;
const prodRows = () => prodCache || (prodCache = Object.fromEntries(db.prepare("SELECT * FROM products").all().map(r => [r.id, r])));
const isActive = id => !!CATALOG[id] && (prodRows()[id] ? !!prodRows()[id].active : true);
const RL_HIDE_PLAIN = () => E.SHOW_PLAIN !== "1" && Object.values(CATALOG).some(b => b.rl);
let shopCache = null;
/* Offizielle Markenlogos (public/brand/*.svg, Zuordnung in brandlogos.json) – nur ohne Admin-Upload.
   lc = Kartenmodus („brand“ Markenfarbe + helles Logo, „light“ weiße Karte + farbiges Original), lsc = Skalierung, lar = Seitenverhältnis, ltn = einfarbiges Logo (auf hellem Grund in Markenfarbe einfärbbar) */
const BRANDLOGOS = (() => { try { return require("./brandlogos.json"); } catch (e) { return {}; } })();
const brandLogo = x => { const L = BRANDLOGOS[x.id]; if (!L || !L.src) return x; x.logo = L.src; x.lc = L.card === "light" ? "light" : "brand"; if (L.scale && L.scale !== 1) x.lsc = L.scale; if (L.ar) x.lar = L.ar; if (L.tint) x.ltn = 1; return x; };
/* Offizielle Einlöse-Seiten (redeemlinks.json, nur geprüfte Adressen): Schlüssel = Produkt-ID, „plat:<plattform>“ gilt für alle Spiele-Keys dieser Plattform.
   Im Katalog als ru = {url, label}; /go/<id> leitet nur auf diese Ziele weiter (Allowlist). */
const REDEEMLINKS = (() => { const out = {}; let raw = {}; try { raw = require("./redeemlinks.json"); } catch (e) { return out; }
  for (const [k, v] of Object.entries(raw)) { try { const u = new URL(v.url); if (u.protocol === "https:" && v.label) out[k] = { url: u.href, label: String(v.label) }; } catch (e) {} }
  return out; })();
const redeemLink = b => (b && !b.rl && (REDEEMLINKS[b.id] || (b.type === "key" && b.plat && REDEEMLINKS["plat:" + b.plat]))) || null;
function shopCatalog() {
  const rows = prodRows(), n = Object.keys(CATALOG).length;
  if (shopCache && shopCache.rows === rows && shopCache.n === n) return shopCache.out;
  const out = [];
  for (const b of Object.values(CATALOG)) {
    const r = rows[b.id] || {};
    if (r.active === 0) continue;
    if (RL_HIDE_PLAIN() && !b.rl && b.cat !== "topup" && !r.img && !(b.cat === "keys" && COVERS[b.id])) continue; // ohne Originalbild nicht anzeigen (Spiele haben offizielle Cover)
    const x = { ...b }; delete x.redeem; delete x.brand;
    if (!x.rl && !x.grp && x.cat !== "topup") x.grp = "g:" + grpKey(x.name);
    if (r.img) x.img = `/img/p/${b.id}.${r.img}?v=${r.img_v}`;
    if (r.logo) x.logo = `/img/p/${b.id}.logo.${r.logo}?v=${r.logo_v}`;
    else brandLogo(x);
    const ru = redeemLink(b); if (ru) x.ru = { url: ru.url, label: ru.label };
    if (COVERS[b.id] && !x.img) { x.cov = 1; if (COVERS[b.id].h) x.covh = 1; if (COVERS[b.id].g) x.covg = 1; }
    out.push(x);
  }
  shopCache = { rows, n, out };
  return out;
}
/* Ausverkaufte Beträge mit einer einzigen Abfrage */
function soldoutMap() {
  const soldout = {};
  if (TEST_GEN || NEVER_SOLDOUT) return soldout;
  const have = {};
  db.prepare("SELECT brand, face, COUNT(*) n FROM codes WHERE status='free' AND is_test=? GROUP BY brand, face").all(TESTMODE ? 1 : 0).forEach(r => { have[`${r.brand}|${r.face}`] = r.n; });
  for (const b of Object.values(CATALOG)) {
    if (b.cat === "topup") continue;
    const out = b.amts.filter(a => !have[`${b.id}|${fc(a)}`] && !rlHas(b.id, fc(a)));
    if (out.length) soldout[b.id] = out;
  }
  return soldout;
}
const publicConfig = () => ({ site: (BASE_HOST || "").replace(/^www\./, ""), vat: VAT, fee: FEE, payments: !!stripe, express: !!stripe && !!(PK || DEVPAY), pk: PK || (DEVPAY ? "pk_test_attrappe" : null), devpay: DEVPAY,
  google: E.GOOGLE_CLIENT_ID || null, auth: authMethods(), mail: !!E.RESEND_API_KEY, methods: PAY_METHODS, inline: inlineTypes(), paylogos: payLogos(), klarna: KLARNA_ON() ? KLARNA_CATS() : null, testmode: TESTMODE, support: SUPPORT, trustpilot: TP, base: BASE });

/* Produktempfehlungen in Liefer-Mails: Abmeldung per signiertem Link */
const unsubSig = e => crypto.createHmac("sha256", KEY).update("unsub|" + e).digest("base64url").slice(0, 24);
mail.configure({ recs: E.MAIL_RECS !== "0", optedOut: e => !!db.prepare("SELECT 1 FROM optout WHERE email=?").get(norm(e)), unsubLink: e => `${BASE}/abmelden?e=${encodeURIComponent(norm(e))}&s=${unsubSig(norm(e))}`,
  redeem: id => redeemLink(CATALOG[id]) }); // „Jetzt einlösen“ in Liefer-Mails: /go/<id> nur, wenn es eine geprüfte offizielle Seite gibt

/* ---------- Code-Lager + Testcode-Generator ---------- */
class Stockout extends Error {}
const codeHash = c => crypto.createHmac("sha256", KEY).update(String(c).trim().toUpperCase()).digest("hex");
const CODE_CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const testCode = () => "TEST-" + Array.from({ length: 3 }, () => Array.from({ length: 4 }, () => CODE_CH[crypto.randomInt(CODE_CH.length)]).join("")).join("-");
const isCodeBrand = id => !!CATALOG[id] && CATALOG[id].cat !== "topup";
const freeCount = (brand, face) => db.prepare("SELECT COUNT(*) n FROM codes WHERE brand=? AND face=? AND status='free' AND is_test=?").get(brand, face, TESTMODE ? 1 : 0).n;
/* Reloadly: im Live-Betrieb echte Einkäufe; im Testmodus nur mit RELOADLY_SANDBOX=1 (nie echte Codes für Testzahlungen) */
const RL_USE = RL.ON && (!TESTMODE || RL.SANDBOX);
const rlMap = id => RL_USE ? db.prepare("SELECT * FROM rl_map WHERE id=? AND product_id IS NOT NULL").get(id) : null;
const rlHas = (brand, face) => { const m = rlMap(brand); if (!m) return false; const a = JSON.parse(m.amts || "null"); return !a || a.includes(face / 100); };
/* Nie „ausverkauft“: fehlende Codes werden nach der Zahlung bei Reloadly gekauft oder von Hand nachgeliefert (SOLDOUT=1 schaltet die Bestandsprüfung wieder ein) */
const NEVER_SOLDOUT = E.SOLDOUT !== "1";
const available = (brand, face) => (NEVER_SOLDOUT || TEST_GEN || rlHas(brand, face) ? Infinity : freeCount(brand, face));

function addCodes(brand, face, list, isTest) {
  const ins = db.prepare("INSERT OR IGNORE INTO codes(brand,face,code,hash,is_test,added_at) VALUES(?,?,?,?,?,?)");
  let added = 0;
  db.transaction(() => list.forEach(c => { added += ins.run(brand, face, enc(c), codeHash(c), isTest ? 1 : 0, now()).changes; }))();
  return { added, duplicates: list.length - added };
}

/* Nimmt freie Codes aus dem Lager (Testmodus: nur Testcodes, fehlende erzeugt der Generator). Nur innerhalb einer Transaktion aufrufen. */
function takeCodes(brand, face, qty, orderId, itemId) {
  const rows = db.prepare("SELECT id, code FROM codes WHERE brand=? AND face=? AND status='free' AND is_test=? ORDER BY id LIMIT ?").all(brand, face, TESTMODE ? 1 : 0, qty);
  const sell = db.prepare("UPDATE codes SET status='sold', order_id=?, item_id=?, sold_at=? WHERE id=?");
  rows.forEach(r => sell.run(orderId, itemId, now(), r.id));
  const out = rows.map(r => dec(r.code));
  while (out.length < qty && TEST_GEN) {
    const c = testCode();
    if (db.prepare("INSERT OR IGNORE INTO codes(brand,face,code,hash,status,is_test,order_id,item_id,added_at,sold_at) VALUES(?,?,?,?,'sold',1,?,?,?,?)")
      .run(brand, face, enc(c), codeHash(c), orderId, itemId, now(), now()).changes) out.push(c);
  }
  return out.length < qty ? null : out;
}

/* Von Hand eingetragene Codes im Lager als verkauft markieren bzw. nachtragen (Schutz vor Doppelverkauf) */
function claimCode(c, orderId, itemId) {
  const h = codeHash(c);
  if (db.prepare("UPDATE codes SET status='sold', order_id=?, item_id=?, sold_at=? WHERE hash=? AND status='free'").run(orderId, itemId, now(), h).changes) return;
  const it = db.prepare("SELECT brand, face FROM items WHERE id=?").get(itemId);
  db.prepare("INSERT OR IGNORE INTO codes(brand,face,code,hash,status,is_test,order_id,item_id,added_at,sold_at) VALUES(?,?,?,?,'sold',?,?,?,?,?)")
    .run(it.brand, it.face, enc(c), h, TESTMODE ? 1 : 0, orderId, itemId, now(), now());
}

/* Bestellung abschließen: Codes aus `given` (Admin) verwenden, Rest aus dem Lager. Wirft Stockout, wenn etwas fehlt – dann bleibt alles unverändert. */
function deliverOrder(o, given, topups, by, note) {
  db.transaction(() => {
    const st = db.prepare("UPDATE items SET codes=? WHERE id=?");
    for (const it of o.items) {
      let codes;
      if (it.type === "topup") {
        if (!topups[it.id]) throw new Error(`Aufladung für ${it.name} ist nicht bestätigt.`);
        codes = topups[it.id];
      } else {
        codes = (given[it.id] || []).slice(0, it.qty);
        codes.forEach(c => claimCode(c, o.id, it.id));
        if (codes.length < it.qty) {
          const got = takeCodes(it.brand, it.face, it.qty - codes.length, o.id, it.id);
          if (!got) throw new Stockout(`${it.name} ${it.face / 100} €`);
          codes = codes.concat(got);
        }
      }
      st.run(enc(JSON.stringify(codes)), it.id);
    }
    db.prepare("UPDATE orders SET status='delivered', delivered_at=?, delivered_by=?, hold_reason=NULL, note=COALESCE(?, note) WHERE id=?").run(now(), by, note, o.id);
  })();
}

const sendDelivered = id => {
  const full = orderFull(id);
  full.items.filter(i => i.gift_to).forEach(i => safe(mail.gift(full, i)));
  safe(mail.delivered(full)); // Codes geliefert · nur Aufladungen: „Guthaben gebucht“ · nur Geschenke: „Geschenk verschickt“
  if (E.INVOICE_MAIL === "1") safe(mail.invoice(full)); // Rechnung als eigene Mail (erst einschalten, wenn Firmen- und Steuerangaben stimmen)
  return full;
};

/* Prüft, ob eine bezahlte Bestellung sofort ausgeliefert werden darf. Gibt den Grund zurück, falls nicht. */
async function holdReason(o) {
  if (!AUTO) return "Automatische Auslieferung ist ausgeschaltet";
  if (o.items.some(i => i.type === "topup") && !RL_USE) return "Enthält eine Handy-Aufladung (beim Anbieter buchen)";
  if (o.total > AUTO_MAX) return `Bestellwert über ${(AUTO_MAX / 100).toLocaleString("de-DE")} €`;
  const day = db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE email=? AND delivered_by='auto' AND delivered_at>?").get(o.email, now() - 864e5).s;
  if (day + o.total > AUTO_DAY) return `Tageslimit von ${(AUTO_DAY / 100).toLocaleString("de-DE")} € für diesen Kunden erreicht`;
  if (!o.payment_intent) return "Keine Zahlungsreferenz";
  try {
    const pi = await stripe.paymentIntents.retrieve(o.payment_intent, { expand: ["latest_charge", "payment_method"] });
    const ch = pi.latest_charge && typeof pi.latest_charge === "object" ? pi.latest_charge : null;
    const risk = ch && ch.outcome && ch.outcome.risk_level;
    if (risk !== "normal") return `Stripe-Risiko: ${risk || "unbekannt"}`;
    const pm = payInfo(pi, ch);
    /* Tageslimit zusätzlich pro Zahlungsmittel (Karte/Wallet): wer die E-Mail wechselt, umgeht es so nicht */
    if (pm.fp) {
      db.prepare("UPDATE orders SET pay_fp=? WHERE id=?").run(pm.fp, o.id);
      const dayFp = db.prepare("SELECT COALESCE(SUM(total),0) s FROM orders WHERE (email=? OR pay_fp=?) AND delivered_by='auto' AND delivered_at>?").get(o.email, pm.fp, now() - 864e5).s;
      if (dayFp + o.total > AUTO_DAY) return `Tageslimit von ${(AUTO_DAY / 100).toLocaleString("de-DE")} € für dieses Zahlungsmittel erreicht`;
    }
    /* Expresszahlung ohne bestätigte E-Mail: nur ausliefern, wenn wirklich mit einer Wallet bezahlt wurde
       und die Wallet genau die E-Mail übermittelt hat, an die die Codes gehen */
    if (o.channel === "wallet") {
      if (!WALLET_PM.includes(pm.wallet)) return "Expresszahlung ohne Wallet (E-Mail nicht bestätigt)";
      if (!pm.email) return "Wallet hat keine E-Mail übermittelt";
      if (pm.email !== norm(o.email)) return "E-Mail aus der Wallet weicht von der Bestellung ab";
    }
  } catch (err) { console.error("Risikoprüfung:", err.message); return "Risikoprüfung bei Stripe nicht möglich"; }
  return null;
}
/* Wallets, deren E-Mail wir bei der Expresszahlung übernehmen (Apple Pay, Google Pay, Link, PayPal, Amazon Pay) */
const WALLET_PM = ["apple_pay", "google_pay", "link", "paypal", "amazon_pay"];
/* Express-Zahlungsarten insgesamt; Klarna und Revolut Pay liefern keine geprüfte E-Mail und brauchen deshalb eine bestätigte */
const NOMAIL_PM = ["klarna", "revolut_pay"];
const XPM = WALLET_PM.concat(NOMAIL_PM);
/* Zahlungsmittel aus PaymentIntent/Charge: Wallet-Art, von der Wallet übermittelte E-Mail, Fingerabdruck */
function payInfo(pi, ch) {
  const pm = pi.payment_method && typeof pi.payment_method === "object" ? pi.payment_method : {};
  const pd = (ch && ch.payment_method_details) || {}, card = pm.card || pd.card || null;
  const type = pm.type || pd.type || null;
  const wallet = (card && card.wallet && card.wallet.type) || (["link", "paypal", "amazon_pay"].includes(type) ? type : null);
  const email = norm((pm.billing_details && pm.billing_details.email) || (ch && ch.billing_details && ch.billing_details.email)
    || (pm.link && pm.link.email) || (pd.link && pd.link.email) || (pm.paypal && pm.paypal.payer_email) || (pd.paypal && pd.paypal.payer_email) || "") || null;
  const fp = (card && card.fingerprint) || (pm.paypal && pm.paypal.payer_id ? "pp:" + pm.paypal.payer_id : null) || (pd.paypal && pd.paypal.payer_id ? "pp:" + pd.paypal.payer_id : null)
    || (type === "link" && email ? "link:" + email : null);
  return { type, wallet, email, fp };
}

/* Fehlende Codes und Aufladungen bei Reloadly einkaufen. Gekaufte Codes landen im Lager und werden danach von deliverOrder vergeben. */
async function supply(o) {
  const topups = {};
  if (!RL_USE) return topups;
  for (const it of o.items) {
    const ref = `${o.id}-${it.id}-${Date.now().toString(36)}`; // pro Versuch eindeutig (Reloadly lehnt doppelte Kennungen ab)
    if (it.type === "topup") {
      const r = await RL.topup({ phone: it.phone, country: (CATALOG[it.brand] || {}).region, amount: it.face / 100 * it.qty, ref });
      topups[it.id] = [r.label];
      continue;
    }
    const need = it.qty - freeCount(it.brand, it.face);
    if (need <= 0) continue;
    const m = rlMap(it.brand);
    if (!m) continue;
    const bal = await RL.balance();
    if (!bal.error && Number(bal.amount) <= 0) throw new Error("Reloadly: Das Reloadly-Guthaben ist leer. Bitte das Reloadly-Konto aufladen.");
    const r = await RL.buyCards({ productId: m.product_id, country: m.country, face: it.face / 100, qty: need, ref, email: null });
    const ins = db.prepare("INSERT OR IGNORE INTO codes(brand,face,code,hash,is_test,added_at) VALUES(?,?,?,?,?,?)");
    db.transaction(() => r.codes.forEach(c => ins.run(it.brand, it.face, enc(c), codeHash(c), TESTMODE ? 1 : 0, now())))();
    console.log(`Reloadly: ${r.codes.length} Code(s) für ${it.name} ${optLabel(CATALOG[it.brand] || {}, it.face / 100)} gekauft (Transaktion ${r.tx})`);
  }
  return topups;
}

/* Nach bestätigter Zahlung: sofort ausliefern oder zur Prüfung an das Team geben */
async function afterPayment(id) {
  const o = orderFull(id);
  let reason = await holdReason(o);
  if (!reason) {
    try { const tu = await supply(o); deliverOrder(o, {}, tu, "auto", "Automatisch ausgeliefert"); sendDelivered(id); console.log(`Bestellung ${id} automatisch ausgeliefert`); return; }
    catch (err) { if (!(err instanceof Stockout)) console.error(err); reason = err instanceof Stockout ? `Lager leer: ${err.message}` : /Reloadly|Aufladung|Netzbetreiber/.test(err.message) ? err.message.slice(0, 200) : "Fehler bei der Auslieferung"; }
  }
  db.prepare("UPDATE orders SET hold_reason=? WHERE id=?").run(reason, id);
  console.log(`Bestellung ${id} wartet auf Prüfung: ${reason}`);
  const full = orderFull(id);
  safe(mail.orderReceived(full));
  ADMINS.forEach(a => safe(mail.adminNew(a, full)));
}

/* ---------- App ---------- */
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
/* same-origin-allow-popups: Wallet- und PayPal-Fenster von Stripe brauchen den Rückkanal zum Shop */
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false, crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" } }));
/* Bilder und Schriften, die in E-Mails stecken, dürfen Mailprogramme von außen laden (sonst blockiert CORP „same-origin“ sie z. B. in Thunderbird) */
app.use((req, res, next) => { if (/^\/(mail|cards|fonts|img\/(rl|p|cover))\//.test(req.path) || req.path === "/icon-512.png") res.set("Cross-Origin-Resource-Policy", "cross-origin").set("Access-Control-Allow-Origin", "*"); next(); });

/* Stripe-Webhook braucht den unveränderten Body, deshalb vor express.json() */
let ABO = null; // Abo-Modul (abo.js), wird weiter unten eingerichtet
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) return res.status(503).end();
  let ev;
  /* Geprüft wird gegen jedes bekannte Geheimnis (STRIPE_WEBHOOK_SECRET und das selbst angelegte) – so bleibt die Zustellung auch nach einem Schlüsselwechsel gültig */
  for (const s of whSecrets()) { try { ev = stripe.webhooks.constructEvent(req.body, req.get("stripe-signature"), s); break; } catch (err) {} }
  if (!ev) return res.status(400).send("Ungültige Signatur");
  /* Abo-Ereignisse (Checkout im Abo-Modus, Rechnungen, Abo-Änderungen): bei Fehlern 500, dann wiederholt Stripe die Zustellung */
  if (ABO && ABO.isEvent(ev)) {
    try { await ABO.webhook(ev); return res.json({ received: true }); }
    catch (err) { console.error("Abo-Webhook", ev.type, err); return res.status(500).send("Fehler"); }
  }
  const s = ev.data.object, id = s.metadata && s.metadata.order_id;
  const o = id && db.prepare("SELECT * FROM orders WHERE id=?").get(id);
  if (o) {
    const isPI = ev.type.startsWith("payment_intent.");
    const paid = (ev.type === "checkout.session.completed" && s.payment_status === "paid") || ev.type === "checkout.session.async_payment_succeeded" || ev.type === "payment_intent.succeeded";
    if (paid && ["awaiting_payment", "payment_pending"].includes(o.status)) {
      db.prepare("UPDATE orders SET status='processing', paid_at=?, payment_intent=?, total=? WHERE id=?")
        .run(now(), isPI ? s.id : s.payment_intent, isPI ? (s.amount_received || s.amount) : s.amount_total, id);
      afterPayment(id).catch(err => console.error("Auslieferung fehlgeschlagen:", err));
    } else if (ev.type === "checkout.session.completed") {
      if (db.prepare("UPDATE orders SET status='payment_pending' WHERE id=? AND status='awaiting_payment'").run(id).changes) safe(mail.orderPending(orderFull(id)));
    } else if (ev.type === "payment_intent.processing") {
      if (db.prepare("UPDATE orders SET status='payment_pending' WHERE id=? AND status='awaiting_payment'").run(id).changes) safe(mail.orderPending(orderFull(id)));
    } else if (ev.type === "payment_intent.canceled") {
      db.prepare("UPDATE orders SET status='canceled' WHERE id=? AND status IN ('awaiting_payment','payment_pending')").run(id);
    } else if (ev.type === "checkout.session.async_payment_failed" || ev.type === "checkout.session.expired") {
      db.prepare("UPDATE orders SET status='canceled' WHERE id=? AND status IN ('awaiting_payment','payment_pending')").run(id);
      if (ev.type === "checkout.session.async_payment_failed") safe(mail.paymentFailed(orderFull(id)));
    }
  }
  res.json({ received: true });
});

/* www.instacode.store → instacode.store */
const BASE_HOST = (() => { try { return new URL(BASE).host; } catch (e) { return ""; } })();
app.use((req, res, next) => (PROD && BASE_HOST && req.get("host") === "www." + BASE_HOST) ? res.redirect(301, BASE + req.originalUrl) : next());
/* Vorschau-Adressen (z. B. *.up.railway.app) nicht von Suchmaschinen aufnehmen lassen – nur die echte Domain zählt */
app.use((req, res, next) => { const h = String(req.get("host") || ""); if (BASE_HOST && h && h !== BASE_HOST && h !== "www." + BASE_HOST && !/^localhost|^127\./.test(h)) res.set("X-Robots-Tag", "noindex, nofollow"); next(); });

app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  const t = cookies(req).ic_sess;
  if (t) {
    const u = db.prepare("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").get(sha(t), now());
    if (u) req.user = u;
  }
  next();
});
/* Schutz gegen fremde Formulare (CSRF): API-Aufrufe der Seite senden immer X-IC: 1 */
app.use("/api", (req, res, next) => (req.method !== "GET" && req.get("x-ic") !== "1") ? bad(res, "Ungültige Anfrage", 403) : next());
const need = (req, res, next) => req.user ? next() : bad(res, "Bitte melde dich an.", 401);
const admin = (req, res, next) => isAdmin(req.user) ? next() : bad(res, "Nicht gefunden", 404);
const lim = rateLimit({ windowMs: 15 * 60e3, limit: 40, standardHeaders: true, legacyHeaders: false, message: { error: "Zu viele Versuche. Bitte warte ein paar Minuten." } });
const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(err => { console.error(err); bad(res, "Da ist etwas schiefgelaufen. Bitte versuch es erneut.", 500); });

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/config", (req, res) => res.json(publicConfig()));
let catOut = null;
app.get("/api/catalog", (req, res) => {
  const cat = shopCatalog();
  if (!catOut || catOut.cat !== cat) { const raw = Buffer.from(JSON.stringify({ products: cat.map(slim) })); catOut = { cat, raw, br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }), gz: zlib.gzipSync(raw) }; }
  const ae = String(req.get("accept-encoding") || "");
  res.set("Cache-Control", "public, max-age=300").set("Vary", "Accept-Encoding").type("json");
  if (/\bbr\b/.test(ae)) return res.set("Content-Encoding", "br").send(catOut.br);
  if (/\bgzip\b/.test(ae)) return res.set("Content-Encoding", "gzip").send(catOut.gz);
  res.send(catOut.raw);
});
app.get("/api/product/:id", (req, res) => {
  const b = CATALOG[String(req.params.id)]; if (!b) return bad(res, "Nicht gefunden.", 404);
  let redeem = b.redeem || null, desc = null;
  if (b.rl) { const row = db.prepare("SELECT data FROM rl_catalog WHERE id=?").get(b.id); if (row) { const p = JSON.parse(row.data); redeem = (p.redeemInstruction && (p.redeemInstruction.concise || p.redeemInstruction.verbose)) || null; } }
  res.set("Cache-Control", "public, max-age=3600").json({ redeem: redeem ? String(redeem).slice(0, 1500) : null, desc });
});
/* Ausverkaufte Beträge, damit der Shop sie ausgrauen kann */
app.get("/api/stock", (req, res) => res.set("Cache-Control", "no-store").json({ soldout: soldoutMap() }));

/* ---------- Bewertungen (nur nach echter, gelieferter Bestellung) ---------- */
/* GET /api/reviews            – alle sichtbaren: Anzahl, Schnitt, Verteilung, je Produkt (by), die neuesten 24
   GET /api/reviews?brand=a,b   – nur Bewertungen zu Bestellungen mit diesen Produkten (Produktseite, Varianten einer Marke)
   Die Produkte einer Bewertung kommen aus der Bestellung (items.brand), nicht aus Eingaben der Kundin. */
const REV_COLS = "r.name, r.rating, r.text, r.brands, r.created_at, (SELECT group_concat(DISTINCT i.brand) FROM items i WHERE i.order_id=r.order_id) ids";
const revOut = r => ({ name: r.name, rating: r.rating, text: r.text, brands: JSON.parse(r.brands || "[]"), ids: String(r.ids || "").split(",").filter(Boolean), date: r.created_at });
const revDist = rows => [1, 2, 3, 4, 5].map(s => rows.filter(r => r.rating === s).length);
app.get("/api/reviews", (req, res) => {
  const want = [...new Set(String(req.query.brand || "").split(",").map(s => s.trim()).filter(s => /^[\w-]{1,60}$/.test(s)))].slice(0, 40);
  res.set("Cache-Control", "public, max-age=60");
  if (want.length) {
    const rows = db.prepare(`SELECT ${REV_COLS} FROM reviews r WHERE r.hidden=0 AND EXISTS (SELECT 1 FROM items i WHERE i.order_id=r.order_id AND i.brand IN (${want.map(() => "?").join(",")})) ORDER BY r.created_at DESC LIMIT 500`).all(...want);
    const n = rows.length, avg = n ? Math.round(rows.reduce((s, r) => s + r.rating, 0) / n * 10) / 10 : null;
    /* Zitate: neueste mit Text zuerst */
    const items = rows.filter(r => r.text).concat(rows.filter(r => !r.text)).slice(0, 12).map(revOut);
    return res.json({ brand: want, count: n, avg, dist: revDist(rows), items });
  }
  const all = db.prepare("SELECT rating FROM reviews WHERE hidden=0").all();
  const n = all.length, avg = n ? Math.round(all.reduce((s, r) => s + r.rating, 0) / n * 10) / 10 : null;
  const by = {};
  for (const r of db.prepare("SELECT brand, COUNT(*) n, AVG(rating) avg FROM (SELECT DISTINCT r.id, r.rating, i.brand FROM reviews r JOIN items i ON i.order_id=r.order_id WHERE r.hidden=0) GROUP BY brand").all())
    by[r.brand] = { n: r.n, avg: Math.round(r.avg * 10) / 10 };
  const items = db.prepare(`SELECT ${REV_COLS} FROM reviews r WHERE r.hidden=0 ORDER BY r.created_at DESC LIMIT 24`).all().map(revOut);
  res.json({ count: n, avg, dist: revDist(all), by, items });
});
app.post("/api/reviews", rateLimit({ windowMs: 60 * 60e3, limit: 20 }), (req, res) => {
  const b = req.body || {}, o = db.prepare("SELECT * FROM orders WHERE id=?").get(String(b.order || ""));
  const allowed = o && ((req.user && o.user_id === req.user.id) || (b.k && b.k === o.access_key));
  if (!allowed) return bad(res, "Bestellung nicht gefunden.", 404);
  if (o.status !== "delivered") return bad(res, "Bewerten kannst du, sobald deine Bestellung geliefert ist.");
  const rating = parseInt(b.rating, 10);
  if (!(rating >= 1 && rating <= 5)) return bad(res, "Bitte wähle 1 bis 5 Sterne.");
  const text = String(b.text || "").trim().slice(0, 600);
  const raw = String(b.name || "").trim().slice(0, 40), parts = raw.split(/\s+/).filter(Boolean);
  const name = parts.length ? parts[0] + (parts[1] ? " " + parts[1][0].toUpperCase() + "." : "") : "Kunde";
  const brands = [...new Set(db.prepare("SELECT name FROM items WHERE order_id=?").all(o.id).map(r => r.name))].slice(0, 3);
  try { db.prepare("INSERT INTO reviews(order_id,email,name,rating,text,brands,created_at) VALUES(?,?,?,?,?,?,?)").run(o.id, o.email, name, rating, text, JSON.stringify(brands), now()); }
  catch (err) { return bad(res, "Für diese Bestellung gibt es schon eine Bewertung."); }
  res.json({ ok: true });
});

/* ---------- Konto ---------- */
app.get("/api/me", (req, res) => res.json({ user: pub(req.user) || null }));

app.post("/api/auth/register", lim, wrap(async (req, res) => {
  const { name, password } = req.body || {}, e = norm(req.body && req.body.email), n = String(name || "").trim().slice(0, 80);
  if (n.length < 2) return bad(res, "Bitte gib deinen Namen ein.");
  if (!emailOk(e)) return bad(res, "Bitte gib eine gültige E-Mail-Adresse ein.");
  if (String(password || "").length < 8) return bad(res, "Das Passwort braucht mindestens 8 Zeichen.");
  let u = userByEmail(e);
  if (u && u.verified) return bad(res, "Für diese E-Mail gibt es schon ein Konto. Bitte melde dich an.");
  const h = await bcrypt.hash(String(password), 12);
  if (u) db.prepare("UPDATE users SET name=?, pw_hash=? WHERE id=?").run(n, h, u.id);
  else db.prepare("INSERT INTO users(email,name,pw_hash,created_at) VALUES(?,?,?,?)").run(e, n, h, now());
  await sendVerify(userByEmail(e));
  res.json({ ok: true, verify: true });
}));

/* Code an die Bestell-E-Mail schicken */
const evLim = rateLimit({ windowMs: 15 * 60e3, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: "Zu viele Codes angefordert. Bitte warte ein paar Minuten." } });
app.post("/api/checkout/email/send", evLim, wrap(async (req, res) => {
  const e = norm(req.body.email);
  if (!emailOk(e)) return bad(res, "Bitte gib eine gültige E-Mail-Adresse ein.");
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare("UPDATE tokens SET used=1 WHERE kind='ev' AND hash LIKE ?").run(sha(e) + ":%");
  db.prepare("INSERT INTO tokens(user_id,kind,hash,expires_at) VALUES(NULL,'ev',?,?)").run(`${sha(e)}:${sha(e + "|" + code)}`, now() + 15 * 60e3);
  await mail.orderCode(e, code);
  res.json({ ok: true });
}));
/* Code prüfen und Nachweis setzen */
app.post("/api/checkout/email/verify", lim, (req, res) => {
  const e = norm(req.body.email), code = String(req.body.code || "").replace(/\D/g, "");
  const t = db.prepare("SELECT * FROM tokens WHERE kind='ev' AND hash LIKE ? AND used=0 AND expires_at>? ORDER BY id DESC").get(sha(e) + ":%", now());
  if (!t || t.tries >= 5) return bad(res, "Der Code ist abgelaufen. Fordere einen neuen an.");
  if (t.hash !== `${sha(e)}:${sha(e + "|" + code)}`) { db.prepare("UPDATE tokens SET tries=tries+1 WHERE id=?").run(t.id); return bad(res, "Der Code stimmt nicht."); }
  db.prepare("UPDATE tokens SET used=1 WHERE id=?").run(t.id);
  const exp = now() + EV_TTL;
  res.cookie("ic_ev", `${Buffer.from(e).toString("base64url")}.${exp}.${evSign(e, exp)}`, { httpOnly: true, secure: PROD, sameSite: "lax", maxAge: EV_TTL, path: "/" });
  res.json({ ok: true, email: e });
});
app.get("/api/checkout/email", (req, res) => res.json({ email: verifiedEmail(req) }));

app.post("/api/auth/verify", lim, wrap(async (req, res) => {
  const u = userByEmail(norm(req.body.email)), code = String(req.body.code || "").replace(/\D/g, "");
  if (!u) return bad(res, "Der Code ist ungültig.");
  const t = db.prepare("SELECT * FROM tokens WHERE user_id=? AND kind='verify' AND used=0 AND expires_at>? ORDER BY id DESC").get(u.id, now());
  if (!t || t.tries >= 5) return bad(res, "Der Code ist abgelaufen. Fordere einen neuen an.");
  if (t.hash !== sha(code)) { db.prepare("UPDATE tokens SET tries=tries+1 WHERE id=?").run(t.id); return bad(res, "Der Code stimmt nicht."); }
  db.prepare("UPDATE tokens SET used=1 WHERE id=?").run(t.id);
  const first = !u.verified;
  db.prepare("UPDATE users SET verified=1 WHERE id=?").run(u.id);
  linkOrders(u.id, u.email); startSession(res, u.id);
  if (first) safe(mail.welcome(u.email, u.name));
  res.json({ ok: true, user: pub(userById(u.id)) });
}));

app.post("/api/auth/resend", lim, wrap(async (req, res) => {
  const u = userByEmail(norm(req.body.email));
  if (u && !u.verified) await sendVerify(u);
  res.json({ ok: true });
}));

app.post("/api/auth/login", lim, wrap(async (req, res) => {
  const u = userByEmail(norm(req.body.email));
  const ok = u && u.pw_hash && await bcrypt.compare(String(req.body.password || ""), u.pw_hash);
  if (!ok) return bad(res, "E-Mail oder Passwort ist falsch.");
  if (!u.verified) { await sendVerify(u); return res.json({ ok: true, verify: true }); }
  startSession(res, u.id); linkOrders(u.id, u.email);
  if (u.login_alerts) safe(mail.loginAlert(u.email, u.name, req.get("user-agent") || ""));
  res.json({ ok: true, user: pub(u) });
}));

app.post("/api/auth/google", lim, wrap(async (req, res) => {
  if (!E.GOOGLE_CLIENT_ID) return bad(res, "Google-Login ist noch nicht eingerichtet.");
  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(String(req.body.credential || "")));
  const p = await r.json();
  if (!r.ok || p.aud !== E.GOOGLE_CLIENT_ID || String(p.email_verified) !== "true") return bad(res, "Google-Anmeldung fehlgeschlagen.");
  const e = norm(p.email); let u = userByEmail(e), first = false;
  if (!u) { first = true; db.prepare("INSERT INTO users(email,name,verified,google_sub,created_at) VALUES(?,?,1,?,?)").run(e, (p.name || e.split("@")[0]).slice(0, 80), p.sub, now()); }
  else db.prepare("UPDATE users SET verified=1, google_sub=? WHERE id=?").run(p.sub, u.id);
  u = userByEmail(e); startSession(res, u.id); linkOrders(u.id, e);
  safe(first ? mail.welcome(e, u.name) : (u.login_alerts ? mail.loginAlert(e, u.name, req.get("user-agent") || "") : Promise.resolve()));
  res.json({ ok: true, user: pub(u) });
}));

/* ---------- Schnell-Login: E-Mail-Code, Apple, Discord, Twitch, SMS ---------- */
/* Anmelden ohne Passwort: Code per E-Mail, danach /api/auth/verify wie bei der Registrierung */
app.post("/api/auth/code", lim, wrap(async (req, res) => {
  const e = norm(req.body.email); if (!emailOk(e)) return bad(res, "Bitte gib eine gültige E-Mail-Adresse ein.");
  let u = userByEmail(e);
  if (!u) { db.prepare("INSERT INTO users(email,name,verified,created_at) VALUES(?,?,0,?)").run(e, e.split("@")[0].slice(0, 80), now()); u = userByEmail(e); }
  await sendVerify(u); res.json({ ok: true });
}));
function identLogin(provider, sub, email, name) {
  sub = String(sub || ""); if (!sub) throw new Error("Anmeldung fehlgeschlagen.");
  const hit = db.prepare("SELECT user_id FROM idents WHERE provider=? AND sub=?").get(provider, sub);
  let u = hit && userById(hit.user_id), first = false;
  if (!u) {
    const e = email ? norm(email) : null;
    if (e) u = userByEmail(e);
    if (!u) {
      if (!e) throw new Error("Bitte gib dort eine bestätigte E-Mail-Adresse frei.");
      first = true; db.prepare("INSERT INTO users(email,name,verified,created_at) VALUES(?,?,1,?)").run(e, String(name || e.split("@")[0]).slice(0, 80), now()); u = userByEmail(e);
    } else db.prepare("UPDATE users SET verified=1 WHERE id=?").run(u.id);
    db.prepare("INSERT OR IGNORE INTO idents(provider,sub,user_id,created_at) VALUES(?,?,?,?)").run(provider, sub, u.id, now());
  }
  return { u: userById(u.id), first };
}
const OSIG = v => crypto.createHmac("sha256", E.SESSION_SECRET || "dev-secret").update(v).digest("base64url").slice(0, 32);
function appleSecret() {
  const b = o => Buffer.from(JSON.stringify(o)).toString("base64url"), n = Math.floor(Date.now() / 1000);
  const data = b({ alg: "ES256", kid: E.APPLE_KEY_ID }) + "." + b({ iss: E.APPLE_TEAM_ID, iat: n, exp: n + 3000, aud: "https://appleid.apple.com", sub: E.APPLE_CLIENT_ID });
  return data + "." + crypto.sign("sha256", Buffer.from(data), { key: String(E.APPLE_PRIVATE_KEY).replace(/\\n/g, "\n"), dsaEncoding: "ieee-p1363" }).toString("base64url");
}
const OAUTH = {
  apple: E.APPLE_CLIENT_ID && E.APPLE_TEAM_ID && E.APPLE_KEY_ID && E.APPLE_PRIVATE_KEY ? { name: "Apple", auth: "https://appleid.apple.com/auth/authorize", token: "https://appleid.apple.com/auth/token", scope: "name email", id: E.APPLE_CLIENT_ID, secret: appleSecret, formPost: true,
    profile: async (t, x) => { const p = JSON.parse(Buffer.from(String(t.id_token || "").split(".")[1] || "", "base64url").toString() || "{}"); let name = null;
      try { const n = JSON.parse(x.user || "{}").name || {}; name = [n.firstName, n.lastName].filter(Boolean).join(" ") || null; } catch (e) {}
      return { sub: p.sub, email: (p.email_verified === true || p.email_verified === "true") ? p.email : null, name }; } } : null,
  discord: E.DISCORD_CLIENT_ID && E.DISCORD_CLIENT_SECRET ? { name: "Discord", auth: "https://discord.com/oauth2/authorize", token: "https://discord.com/api/oauth2/token", scope: "identify email", id: E.DISCORD_CLIENT_ID, secret: () => E.DISCORD_CLIENT_SECRET,
    profile: async t => { const p = await (await fetch("https://discord.com/api/users/@me", { headers: { Authorization: "Bearer " + t.access_token } })).json(); return { sub: p.id, email: p.verified ? p.email : null, name: p.global_name || p.username }; } } : null,
  twitch: E.TWITCH_CLIENT_ID && E.TWITCH_CLIENT_SECRET ? { name: "Twitch", auth: "https://id.twitch.tv/oauth2/authorize", token: "https://id.twitch.tv/oauth2/token", scope: "user:read:email", id: E.TWITCH_CLIENT_ID, secret: () => E.TWITCH_CLIENT_SECRET,
    profile: async t => { const p = ((await (await fetch("https://api.twitch.tv/helix/users", { headers: { Authorization: "Bearer " + t.access_token, "Client-Id": E.TWITCH_CLIENT_ID } })).json()).data || [])[0] || {}; return { sub: p.id, email: p.email || null, name: p.display_name }; } } : null,
};
const SMS_ON = !!(E.TWILIO_ACCOUNT_SID && E.TWILIO_AUTH_TOKEN && E.TWILIO_VERIFY_SID);
const authMethods = () => ({ google: !!E.GOOGLE_CLIENT_ID, apple: !!OAUTH.apple, discord: !!OAUTH.discord, twitch: !!OAUTH.twitch, sms: SMS_ON, code: !!E.RESEND_API_KEY || !PROD, passkey: PK_RP });
const safePath = r => /^\/[\w\-/?=&%.]*$/.test(String(r || "")) ? String(r) : "/konto";
app.get("/auth/:p", (req, res) => {
  const P = OAUTH[req.params.p]; if (!P) return res.redirect(302, "/login");
  const st = rnd(16), r = safePath(req.query.r), v = `${req.params.p}.${st}.${Buffer.from(r).toString("base64url")}`;
  res.cookie("ic_oa", `${v}.${OSIG(v)}`, { httpOnly: true, secure: PROD, sameSite: PROD ? "none" : "lax", maxAge: 10 * 60e3, path: "/auth" });
  const q = new URLSearchParams({ client_id: P.id, redirect_uri: `${BASE}/auth/${req.params.p}/callback`, response_type: "code", scope: P.scope, state: st });
  if (P.formPost) q.set("response_mode", "form_post");
  res.redirect(302, `${P.auth}?${q}`);
});
const formBody = req => new Promise(ok => { if (req.body && Object.keys(req.body).length) return ok(req.body); let d = ""; req.on("data", c => { d += c; if (d.length > 3e4) req.destroy(); }); req.on("end", () => ok(Object.fromEntries(new URLSearchParams(d)))); req.on("error", () => ok({})); });
const oauthCallback = wrap(async (req, res) => {
  const P = OAUTH[req.params.p], x = req.method === "POST" ? await formBody(req) : req.query, fail = m => res.redirect(302, `/login?fehler=${encodeURIComponent(m)}`);
  if (!P) return fail("Diese Anmeldung ist nicht eingerichtet.");
  const raw = String(cookies(req).ic_oa || ""), i = raw.lastIndexOf("."), v = raw.slice(0, i), [pv, st, rb] = v.split(".");
  res.clearCookie("ic_oa", { path: "/auth" });
  if (!raw || OSIG(v) !== raw.slice(i + 1) || pv !== req.params.p || st !== String(x.state || "")) return fail("Die Anmeldung ist abgelaufen. Bitte versuch es noch einmal.");
  if (!x.code) return fail(`${P.name}-Anmeldung abgebrochen.`);
  const tr = await fetch(P.token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: P.id, client_secret: P.secret(), code: String(x.code), grant_type: "authorization_code", redirect_uri: `${BASE}/auth/${req.params.p}/callback` }) });
  const t = await tr.json().catch(() => ({}));
  if (!tr.ok || (!t.access_token && !t.id_token)) { console.error(`${P.name}-Login:`, tr.status, JSON.stringify(t).slice(0, 200)); return fail(`${P.name}-Anmeldung fehlgeschlagen.`); }
  try {
    const pr = await P.profile(t, x), { u, first } = identLogin(req.params.p, pr.sub, pr.email, pr.name);
    startSession(res, u.id); linkOrders(u.id, u.email);
    safe(first ? mail.welcome(u.email, u.name) : (u.login_alerts ? mail.loginAlert(u.email, u.name, req.get("user-agent") || "") : Promise.resolve()));
    res.redirect(302, safePath(Buffer.from(rb || "", "base64url").toString()));
  } catch (e) { fail(e.message); }
});
app.get("/auth/:p/callback", oauthCallback);
app.post("/auth/:p/callback", oauthCallback);
/* SMS-Code über Twilio Verify */
const telNorm = t => { let d = String(t || "").replace(/[^\d+]/g, ""); if (d.startsWith("00")) d = "+" + d.slice(2); else if (d.startsWith("0")) d = "+49" + d.slice(1); else if (!d.startsWith("+")) d = "+" + d; return /^\+\d{8,15}$/.test(d) ? d : null; };
const twilio = (path, body) => fetch(`https://verify.twilio.com/v2/Services/${E.TWILIO_VERIFY_SID}/${path}`, { method: "POST",
  headers: { Authorization: "Basic " + Buffer.from(`${E.TWILIO_ACCOUNT_SID}:${E.TWILIO_AUTH_TOKEN}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) }).then(r => r.json().then(j => ({ ok: r.ok, ...j })));
app.post("/api/auth/sms/send", lim, wrap(async (req, res) => {
  if (!SMS_ON) return bad(res, "SMS-Anmeldung ist noch nicht eingerichtet.");
  const to = telNorm(req.body.phone); if (!to) return bad(res, "Bitte gib eine gültige Handynummer ein.");
  const r = await twilio("Verifications", { To: to, Channel: "sms", Locale: "de" });
  if (!r.ok) { console.error("Twilio:", r.code, r.message); return bad(res, "Die SMS konnte nicht gesendet werden. Prüfe die Nummer."); }
  res.json({ ok: true, phone: to });
}));
app.post("/api/auth/sms/verify", lim, wrap(async (req, res) => {
  if (!SMS_ON) return bad(res, "SMS-Anmeldung ist noch nicht eingerichtet.");
  const to = telNorm(req.body.phone), code = String(req.body.code || "").replace(/\D/g, "");
  if (!to || code.length < 4) return bad(res, "Bitte gib den Code aus der SMS ein.");
  const r = await twilio("VerificationCheck", { To: to, Code: code });
  if (!r.ok || r.status !== "approved") return bad(res, "Der Code stimmt nicht oder ist abgelaufen.");
  let hit = db.prepare("SELECT user_id FROM idents WHERE provider='sms' AND sub=?").get(to), u = hit && userById(hit.user_id);
  if (!u) { const e = `tel${to.replace(/\D/g, "")}@sms.instacode.store`; u = userByEmail(e);
    if (!u) { db.prepare("INSERT INTO users(email,name,verified,created_at) VALUES(?,?,1,?)").run(e, `Kunde ···${to.slice(-4)}`, now()); u = userByEmail(e); }
    db.prepare("INSERT OR IGNORE INTO idents(provider,sub,user_id,created_at) VALUES('sms',?,?,?)").run(to, u.id, now()); }
  startSession(res, u.id); res.json({ ok: true, user: pub(u) });
}));

/* ---------- Passkeys (Face ID, Touch ID, Windows Hello) – WebAuthn ohne Zusatzpakete ----------
   rpId = Host aus BASE_URL (ohne „www.“), lokal „localhost“. Erlaubte Herkunft: BASE_URL (und die www-Variante).
   Challenge: 32 Zufallsbytes, serverseitig in tokens (pk_reg / pk_login), 5 Minuten gültig, nur einmal verwendbar.
   Geprüft werden type, challenge, origin, rpIdHash, Flags UP + UV, Signatur (nur ES256 / RS256) und signCount.
   Attestation „none“: Herstellerangaben werden weder verlangt noch ausgewertet. Auffindbare Passkeys (residentKey
   „preferred“) erlauben die Anmeldung ohne E-Mail-Eingabe. */
const PK_RP = (() => { try { return new URL(BASE).hostname.replace(/^www\./, ""); } catch (e) { return "localhost"; } })();
const PK_ORIGINS = (() => { const s = new Set(); try { const u = new URL(BASE); s.add(u.origin);
  if (u.hostname !== "localhost") { const w = new URL(BASE); w.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : "www." + u.hostname; s.add(w.origin); } } catch (e) {} return s; })();
const PK_TTL = 5 * 60e3, PK_ALGS = [-7, -257], PK_RPHASH = crypto.createHash("sha256").update(PK_RP).digest();
/* Kleiner CBOR-Decoder (RFC 8949) für attestationObject, authenticatorData und COSE-Schlüssel: nur Typen mit fester Länge */
function cborRead(buf, at = 0) {
  let p = at, depth = 0;
  const need = n => { if (p + n > buf.length) throw new Error("CBOR zu kurz"); };
  const len = ai => {
    if (ai < 24) return ai;
    if (ai === 24) { need(1); return buf[p++]; }
    if (ai === 25) { need(2); p += 2; return buf.readUInt16BE(p - 2); }
    if (ai === 26) { need(4); p += 4; return buf.readUInt32BE(p - 4); }
    if (ai === 27) { need(8); p += 8; const v = buf.readBigUInt64BE(p - 8); if (v > 9007199254740991n) throw new Error("CBOR-Zahl zu groß"); return Number(v); }
    throw new Error("CBOR: unbestimmte Länge nicht erlaubt");
  };
  const item = () => {
    if (++depth > 12) throw new Error("CBOR zu tief verschachtelt");
    need(1); const b = buf[p++], mt = b >> 5, ai = b & 31; let v;
    if (mt === 0) v = len(ai);
    else if (mt === 1) v = -1 - len(ai);
    else if (mt === 2 || mt === 3) { const n = len(ai); need(n); v = mt === 2 ? buf.subarray(p, p + n) : buf.toString("utf8", p, p + n); p += n; }
    else if (mt === 4) { const n = len(ai); if (n > 64) throw new Error("CBOR-Liste zu lang"); v = []; for (let i = 0; i < n; i++) v.push(item()); }
    else if (mt === 5) { const n = len(ai); if (n > 64) throw new Error("CBOR-Map zu groß"); v = new Map(); for (let i = 0; i < n; i++) { const k = item(); v.set(k, item()); } }
    else if (mt === 7 && ai >= 20 && ai <= 22) v = ai === 21 ? true : ai === 20 ? false : null;
    else throw new Error("CBOR-Typ nicht unterstützt");
    depth--; return v;
  };
  const v = item(); return [v, p];
}
/* authenticatorData: rpIdHash (32) · Flags (1) · signCount (4) · [AAGUID (16) · Länge (2) · Credential-ID · COSE-Schlüssel] · [Erweiterungen] */
function pkAuthData(ad) {
  if (!Buffer.isBuffer(ad) || ad.length < 37) throw new Error("authenticatorData zu kurz");
  const f = ad[32], o = { rpIdHash: ad.subarray(0, 32), up: !!(f & 1), uv: !!(f & 4), bs: !!(f & 16), count: ad.readUInt32BE(33) };
  let p = 37;
  if (f & 64) {
    if (ad.length < p + 18) throw new Error("Schlüsseldaten fehlen");
    o.aaguid = ad.subarray(p, p + 16).toString("hex"); const n = ad.readUInt16BE(p + 16); p += 18;
    if (n < 16 || n > 1023 || ad.length < p + n) throw new Error("Credential-ID ungültig");
    o.credId = ad.subarray(p, p + n); p += n;
    [o.cose, p] = cborRead(ad, p);
  }
  if (f & 128) p = cborRead(ad, p)[1];
  if (p !== ad.length) throw new Error("authenticatorData hat Restbytes");
  return o;
}
/* COSE → Node-Schlüssel: nur ES256 (EC2, P-256) und RS256 (RSA ≥ 2048 Bit) */
function pkKey(m) {
  const g = k => m instanceof Map ? m.get(k) : undefined, buf = v => Buffer.isBuffer(v);
  let jwk = null;
  if (g(3) === -7 && g(1) === 2 && g(-1) === 1 && buf(g(-2)) && g(-2).length === 32 && buf(g(-3)) && g(-3).length === 32)
    jwk = { kty: "EC", crv: "P-256", x: g(-2).toString("base64url"), y: g(-3).toString("base64url") };
  else if (g(3) === -257 && g(1) === 3 && buf(g(-1)) && g(-1).length >= 256 && buf(g(-2)) && g(-2).length <= 8)
    jwk = { kty: "RSA", n: g(-1).toString("base64url"), e: g(-2).toString("base64url") };
  if (!jwk) throw new Error("Schlüsseltyp nicht unterstützt (nur ES256 und RS256)");
  return { alg: g(3), spki: crypto.createPublicKey({ key: jwk, format: "jwk" }).export({ type: "spki", format: "der" }).toString("base64url") };
}
const pkSigOk = (alg, spki, data, sig) => { try { const key = crypto.createPublicKey({ key: Buffer.from(spki, "base64url"), format: "der", type: "spki" });
  return alg === -7 ? crypto.verify("sha256", data, { key, dsaEncoding: "der" }, sig) : alg === -257 ? crypto.verify("sha256", data, { key, padding: crypto.constants.RSA_PKCS1_PADDING }, sig) : false; } catch (e) { return false; } };
const pkB64 = v => typeof v === "string" && v.length <= 8192 && /^[\w-]+$/.test(v) ? Buffer.from(v, "base64url") : null;
/* Undurchsichtige Nutzerkennung für den Passkey (keine E-Mail, keine fortlaufende Nummer) */
const pkHandle = u => crypto.createHmac("sha256", KEY).update(`pk-user|${u.id}|${u.created_at || 0}`).digest().subarray(0, 16).toString("base64url");
/* Challenge aus clientDataJSON einlösen: muss existieren, unbenutzt und unabgelaufen sein; wird sofort verbraucht (auch wenn danach etwas scheitert) */
function pkTake(kind, c, uid) {
  const ch = c && typeof c.challenge === "string" && /^[\w-]{43}$/.test(c.challenge) ? c.challenge : null;
  if (!ch) return false;
  const t = db.prepare("SELECT id, user_id FROM tokens WHERE kind=? AND hash=? AND used=0 AND expires_at>?").get(kind, sha(ch), now());
  if (!t || db.prepare("UPDATE tokens SET used=1 WHERE id=? AND used=0").run(t.id).changes !== 1) return false;
  return uid == null || t.user_id === uid;
}
const pkClient = raw => { let c = null; try { c = JSON.parse(raw.toString("utf8")); } catch (e) {} return c && typeof c === "object" ? c : null; };
const pkOriginOk = c => PK_ORIGINS.has(c.origin) && c.crossOrigin !== true && !c.topOrigin;
const PK_AAGUID = { fbfc3007154e4ecc8c0b6e020557d7bd: "iCloud-Schlüsselbund", dd4ec289e01d41c9bb8970fa845d4bf2: "iCloud-Schlüsselbund", ea9b8d664d011d213ce4b6b48cb575d4: "Google Passwortmanager",
  adce000235bcc60a648b0b25f1f05503: "Chrome", "08987058cadc4b81b6e130de50dcbe96": "Windows Hello", "9ddd1817af5a4672a2b93e3dd95000a9": "Windows Hello", "6028b017b1d44c02b4b3afcdafc96bb2": "Windows Hello",
  bada5566a7aa401fbd9645619a55120d: "1Password", d548826e79b4db40a3d811116f7e8349: "Bitwarden" };
const pkDevice = ua => /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "";
const pkName = (aaguid, ua) => { const d = pkDevice(String(ua || "")), p = PK_AAGUID[aaguid]; return (p ? p + (d && p !== "Windows Hello" ? ` · ${d}` : "") : d ? `Passkey · ${d}` : "Passkey").slice(0, 60); };
const pkOut = p => ({ id: p.id, name: p.name || "Passkey", created_at: p.created_at, last_used: p.last_used, synced: !!p.backed_up });
const pkList = uid => db.prepare("SELECT * FROM passkeys WHERE user_id=? ORDER BY created_at DESC").all(uid).map(pkOut);

/* Registrierung (angemeldet): Optionen, dann Prüfung und Speichern */
app.post("/api/auth/passkey/register/options", lim, need, (req, res) => {
  const u = req.user, ch = rnd(32);
  db.prepare("INSERT INTO tokens(user_id,kind,hash,expires_at) VALUES(?,?,?,?)").run(u.id, "pk_reg", sha(ch), now() + PK_TTL);
  const have = db.prepare("SELECT id, transports FROM passkeys WHERE user_id=?").all(u.id);
  res.json({ challenge: ch, rp: { id: PK_RP, name: "instantcodes" }, user: { id: pkHandle(u), name: u.email, displayName: u.name || u.email },
    pubKeyCredParams: PK_ALGS.map(alg => ({ type: "public-key", alg })), timeout: PK_TTL, attestation: "none",
    authenticatorSelection: { residentKey: "preferred", requireResidentKey: false, userVerification: "required" },
    excludeCredentials: have.map(c => ({ type: "public-key", id: c.id, transports: JSON.parse(c.transports || "[]") })), hints: ["client-device"] });
});
app.post("/api/auth/passkey/register", lim, need, (req, res) => {
  const fail = why => { console.warn("Passkey-Registrierung abgelehnt:", why); return bad(res, "Der Passkey konnte nicht gespeichert werden. Bitte versuch es noch einmal."); };
  const b = req.body || {}, r = b.response || {}, raw = pkB64(b.rawId), cd = pkB64(r.clientDataJSON), ao = pkB64(r.attestationObject);
  if (b.type !== "public-key" || !raw || !cd || !ao || b.id !== b.rawId) return fail("Format");
  const c = pkClient(cd);
  if (!pkTake("pk_reg", c, req.user.id)) return fail("Challenge unbekannt, abgelaufen oder schon benutzt");
  if (c.type !== "webauthn.create") return fail("type " + c.type);
  if (!pkOriginOk(c)) return fail("Herkunft " + c.origin);
  let att, ad, k;
  try { att = cborRead(ao)[0]; if (!(att instanceof Map) || typeof att.get("fmt") !== "string" || !(att.get("attStmt") instanceof Map)) throw new Error("attestationObject ungültig"); ad = pkAuthData(att.get("authData")); }
  catch (e) { return fail(e.message); }
  /* Attestation „none“ angefordert; liefert ein Gerät trotzdem eine, wird sie nicht ausgewertet (kein Vertrauen daraus abgeleitet) */
  if (att.get("fmt") === "none" && att.get("attStmt").size) return fail("attStmt bei none nicht leer");
  if (!ad.rpIdHash.equals(PK_RPHASH)) return fail("rpIdHash");
  if (!ad.up || !ad.uv) return fail("Flags UP/UV fehlen");
  if (!ad.credId || !ad.credId.equals(raw)) return fail("Credential-ID passt nicht");
  try { k = pkKey(ad.cose); } catch (e) { return fail(e.message); }
  const id = raw.toString("base64url");
  if (db.prepare("SELECT 1 FROM passkeys WHERE id=?").get(id)) return fail("Credential schon registriert");
  if (db.prepare("SELECT COUNT(*) n FROM passkeys WHERE user_id=?").get(req.user.id).n >= 20) return bad(res, "Du hast schon 20 Passkeys. Lösche zuerst einen alten.");
  const tr = Array.isArray(r.transports) ? r.transports.filter(t => typeof t === "string" && /^[a-z-]{2,16}$/.test(t)).slice(0, 6) : [];
  db.prepare("INSERT INTO passkeys(id,user_id,pubkey,alg,sign_count,transports,name,aaguid,user_handle,backed_up,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
    .run(id, req.user.id, k.spki, k.alg, ad.count, JSON.stringify(tr), pkName(ad.aaguid, req.get("user-agent")), ad.aaguid || null, pkHandle(req.user), ad.bs ? 1 : 0, now());
  safe(mail.passkeyAdded(req.user.email, req.user.name, db.prepare("SELECT name, created_at FROM passkeys WHERE id=?").get(id), req.get("user-agent") || "")); // Sicherheitshinweis
  res.json({ ok: true, id, passkeys: pkList(req.user.id) });
});
/* Anmeldung: ohne E-Mail (leere allowCredentials → auffindbare Passkeys) */
app.post("/api/auth/passkey/login/options", lim, (req, res) => {
  const ch = rnd(32);
  db.prepare("INSERT INTO tokens(user_id,kind,hash,expires_at) VALUES(NULL,'pk_login',?,?)").run(sha(ch), now() + PK_TTL);
  res.json({ challenge: ch, rpId: PK_RP, timeout: PK_TTL, userVerification: "required", allowCredentials: [] });
});
app.post("/api/auth/passkey/login", lim, (req, res) => {
  const fail = (why, msg) => { console.warn("Passkey-Anmeldung abgelehnt:", why); return bad(res, msg || "Die Anmeldung mit Passkey hat nicht geklappt. Bitte versuch es noch einmal oder melde dich mit einem Code an."); };
  const b = req.body || {}, r = b.response || {}, raw = pkB64(b.rawId), cd = pkB64(r.clientDataJSON), adRaw = pkB64(r.authenticatorData), sig = pkB64(r.signature);
  if (b.type !== "public-key" || !raw || !cd || !adRaw || !sig || b.id !== b.rawId) return fail("Format");
  const c = pkClient(cd);
  if (!pkTake("pk_login", c)) return fail("Challenge unbekannt, abgelaufen oder schon benutzt");
  if (c.type !== "webauthn.get") return fail("type " + c.type);
  if (!pkOriginOk(c)) return fail("Herkunft " + c.origin);
  const pk = db.prepare("SELECT * FROM passkeys WHERE id=?").get(raw.toString("base64url"));
  if (!pk) return fail("unbekannter Passkey", "Diesen Passkey kennen wir nicht (mehr). Melde dich mit einem Code an und füge im Konto einen neuen hinzu.");
  if (r.userHandle && r.userHandle !== pk.user_handle) return fail("userHandle passt nicht");
  let ad; try { ad = pkAuthData(adRaw); } catch (e) { return fail(e.message); }
  if (!ad.rpIdHash.equals(PK_RPHASH)) return fail("rpIdHash");
  if (!ad.up || !ad.uv) return fail("Flags UP/UV fehlen");
  if (!pkSigOk(pk.alg, pk.pubkey, Buffer.concat([adRaw, crypto.createHash("sha256").update(cd).digest()]), sig)) return fail("Signatur");
  /* Zähler: Geräte ohne Zähler melden immer 0; sonst muss er steigen (sonst Hinweis auf einen kopierten Schlüssel) */
  if ((ad.count || pk.sign_count) && ad.count <= pk.sign_count) return fail(`signCount ${ad.count} ≤ ${pk.sign_count}`);
  const u = userById(pk.user_id); if (!u) return fail("Konto fehlt");
  db.prepare("UPDATE passkeys SET sign_count=?, last_used=?, backed_up=? WHERE id=?").run(ad.count, now(), ad.bs ? 1 : 0, pk.id);
  startSession(res, u.id); linkOrders(u.id, u.email);
  if (u.login_alerts) safe(mail.loginAlert(u.email, u.name, req.get("user-agent") || ""));
  res.json({ ok: true, user: pub(u) });
});
/* Liste und Löschen im Konto */
app.get("/api/passkeys", need, (req, res) => res.set("Cache-Control", "no-store").json({ passkeys: pkList(req.user.id) }));
app.delete("/api/passkeys/:id", lim, need, (req, res) => {
  const old = db.prepare("SELECT name, created_at FROM passkeys WHERE id=? AND user_id=?").get(String(req.params.id), req.user.id);
  const n = db.prepare("DELETE FROM passkeys WHERE id=? AND user_id=?").run(String(req.params.id), req.user.id).changes;
  if (!n) return bad(res, "Diesen Passkey gibt es nicht mehr.", 404);
  safe(mail.passkeyRemoved(req.user.email, req.user.name, old)); // Sicherheitshinweis
  res.json({ ok: true, passkeys: pkList(req.user.id) });
});

app.post("/api/auth/logout", (req, res) => { endSession(req, res); res.json({ ok: true }); });

app.post("/api/auth/forgot", lim, wrap(async (req, res) => {
  const u = userByEmail(norm(req.body.email));
  if (u) {
    const t = rnd(24);
    db.prepare("UPDATE tokens SET used=1 WHERE user_id=? AND kind='reset'").run(u.id);
    db.prepare("INSERT INTO tokens(user_id,kind,hash,expires_at) VALUES(?,?,?,?)").run(u.id, "reset", sha(t), now() + 30 * 60e3);
    await mail.reset(u.email, u.name, `${BASE}/passwort?t=${t}`);
  }
  res.json({ ok: true }); // immer gleiche Antwort, damit niemand testen kann, welche Adressen registriert sind
}));

app.post("/api/auth/reset", lim, wrap(async (req, res) => {
  const pw = String(req.body.password || "");
  if (pw.length < 8) return bad(res, "Das Passwort braucht mindestens 8 Zeichen.");
  const t = db.prepare("SELECT * FROM tokens WHERE kind='reset' AND hash=? AND used=0 AND expires_at>?").get(sha(req.body.token || ""), now());
  if (!t) return bad(res, "Der Link ist ungültig oder abgelaufen.");
  db.prepare("UPDATE tokens SET used=1 WHERE id=?").run(t.id);
  db.prepare("UPDATE users SET pw_hash=?, verified=1 WHERE id=?").run(await bcrypt.hash(pw, 12), t.user_id);
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(t.user_id);
  const u = userById(t.user_id); safe(mail.pwChanged(u.email, u.name));
  res.json({ ok: true });
}));

app.patch("/api/me", need, (req, res) => {
  const n = req.body.name != null ? String(req.body.name).trim().slice(0, 80) : req.user.name;
  const la = req.body.loginAlerts != null ? (req.body.loginAlerts ? 1 : 0) : req.user.login_alerts;
  db.prepare("UPDATE users SET name=?, login_alerts=? WHERE id=?").run(n || req.user.name, la, req.user.id);
  res.json({ user: pub(userById(req.user.id)) });
});

app.delete("/api/me", need, wrap(async (req, res) => {
  const u = req.user;
  db.prepare("DELETE FROM users WHERE id=?").run(u.id); // Bestellungen bleiben für die Buchhaltung erhalten (Aufbewahrungspflicht)
  res.clearCookie("ic_sess", { path: "/" });
  safe(mail.deleted(u.email, u.name));
  res.json({ ok: true });
}));

/* ---------- Bestellung + Zahlung ---------- */
function line(it) {
  const b = CATALOG[it && it.id];
  if (!b || !isActive(b.id)) throw new Error("Ein Produkt im Warenkorb gibt es nicht mehr.");
  const a = Number(it.a);
  if (!b.amts.includes(a)) throw new Error(`Ungültiger Betrag für ${b.name}.`);
  const q = Math.max(1, Math.min(10, parseInt(it.q, 10) || 1));
  const type = b.cat === "topup" ? "topup" : "code";
  let phone = null, gift = null;
  if (type === "topup") {
    phone = String(it.phone || "").replace(/[^\d+ ]/g, "").slice(0, 24);
    if (phone.replace(/\D/g, "").length < 7) throw new Error("Bitte gib eine gültige Handynummer an.");
  }
  if (type === "code" && it.gift) {
    const to = norm(it.gift.to);
    if (!emailOk(to)) throw new Error("Bitte prüfe die E-Mail-Adresse für das Geschenk.");
    gift = { to, from: String(it.gift.name || "").slice(0, 60), msg: String(it.gift.msg || "").slice(0, 200) };
  }
  return { b, a, q, type, phone, gift, face: fc(a), unit: unitPrice(b, a) };
}
/* Endpreis eines Betrags in Cent, inkl. MwSt. (gleiche Rechnung wie im Browser) */
const unitPrice = (b, a) => gross(b.px && b.px[String(a)] != null ? Math.round(b.px[String(a)] * 100) : Math.round(a * 100)); // Preis = Kartenwert
class Bad extends Error {}
const lineName = l => `${l.b.name} · ${optLabel(l.b, l.a)}${l.type === "topup" ? " · " + l.phone : ""}${l.gift ? " · Geschenk" : ""}`;
/* Texte und Bilder für die Stripe-Zahlungsseite: pro Produkt sauber beschriftet */
const PLAT_N = { steam: "Steam", pc: "PC", ea: "EA app", bnet: "Battle.net", ubi: "Ubisoft Connect", rockstar: "Rockstar Games Launcher", ps5: "PlayStation 5", xbox: "Xbox", xpc: "Xbox und PC", switch: "Nintendo Switch", switch2: "Nintendo Switch 2" };
const STORE_N = { steam: "in Steam", pc: "beim Hersteller", ea: "in der EA app", bnet: "in Battle.net", ubi: "in Ubisoft Connect", rockstar: "im Rockstar Games Launcher", ps5: "im PlayStation Store", xbox: "im Microsoft Store", xpc: "im Microsoft Store", switch: "im Nintendo eShop", switch2: "im Nintendo eShop" };
const REGION_N = { DE: "Deutschland", EU: "Europa", TR: "Türkei" };
const checkoutName = l => l.type === "topup" ? `${l.b.name} Aufladung ${optLabel(l.b, l.a)}`
  : l.b.type === "key" ? `${l.b.name} – ${optLabel(l.b, l.a)}`
  : `${l.b.name} ${/^\d/.test(optLabel(l.b, l.a)) ? "Guthaben " : ""}${optLabel(l.b, l.a)}`;
const checkoutDesc = l => {
  const where = `gültig in ${REGION_N[l.b.region] || "Deutschland"}`;
  if (l.type === "topup") return `Handy-Guthaben für ${l.phone} · wird nach der Zahlung gebucht`;
  const gift = l.gift ? ` · als Geschenk per E-Mail an ${l.gift.to}` : "";
  if (l.b.type === "key") return `Digitaler Key für ${PLAT_N[l.b.plat] || "PC"} · Aktivierung ${STORE_N[l.b.plat] || "beim Hersteller"} · ${where} · sofort per E-Mail${gift}`;
  return `Digitaler Code · ${where} · sofort auf dem Bildschirm und per E-Mail${gift}`;
};
const checkoutImage = l => { if (l.b.rl && l.b.img) return /^https?:/.test(l.b.img) ? l.b.img : BASE + l.b.img; const r = prodRows()[l.b.id]; return r && r.img ? `${BASE}/img/p/${l.b.id}.${r.img}?v=${r.img_v}` : `${BASE}/cards/${l.b.id}.jpg`; };
/* Stripe-Aufruf mit neuer API-Version; falls Konto oder Bibliothek sie (noch) nicht kennen, ohne die neuen Felder wiederholen */
async function stripeCall(fn, params, newer, opts = {}) {
  try { return await fn({ ...params, ...newer }, { ...opts, apiVersion: STRIPE_V }); }
  catch (err) {
    if (err && (err.type === "StripeInvalidRequestError" || err.statusCode === 400) && /branding_settings|excluded_payment_method_types|version/i.test(err.message || "")) {
      console.error("Stripe: neue Felder nicht angenommen, sende ohne:", err.message);
      return fn(params, opts.idempotencyKey ? { ...opts, idempotencyKey: opts.idempotencyKey + "-alt" } : opts);
    }
    throw err;
  }
}
/* Prüft Warenkorb, Bestand und Rabatt; rechnet den Endpreis. Wirft Bad mit einer Meldung für den Kunden. */
function prepareOrder({ items, email, promo }) {
  if (!Array.isArray(items) || !items.length || items.length > 20) throw new Bad("Dein Warenkorb ist leer.");
  let lines;
  try { lines = items.map(line); } catch (err) { throw new Bad(err.message); }
  const need = {};
  lines.filter(l => l.type === "code").forEach(l => { const k = `${l.b.id}|${l.face}`; need[k] = (need[k] || 0) + l.q; });
  for (const k in need) {
    const [b, f] = k.split("|"), have = available(b, +f), label = `${CATALOG[b].name} ${optLabel(CATALOG[b], +f / 100)}`;
    if (have < need[k]) throw new Bad(have ? `Von ${label} sind nur noch ${have} Stück da.` : `${label} ist gerade ausverkauft.`);
  }
  const code = String(promo || "").trim().toUpperCase();
  let rate = 0;
  if (email && PROMOS[code] && !db.prepare("SELECT 1 FROM orders WHERE email=? AND promo=? AND status IN ('processing','delivered')").get(email, code)) rate = PROMOS[code];
  lines.forEach(l => { l.pay = Math.round(l.unit * (1 - rate)); });
  const sub = lines.reduce((s, l) => s + l.unit * l.q, 0), itemsSum = lines.reduce((s, l) => s + l.pay * l.q, 0);
  const fee = FEE, total = itemsSum + fee;
  return { lines, rate, code, sub, items: itemsSum, fee, total, vat: vatOf(total) };
}
/* Digitale Inhalte: Zustimmung zu AGB und sofortiger Ausführung (Erlöschen des Widerrufsrechts, § 356 Abs. 5 BGB) ist Pflicht */
const CONSENT_MSG = "Bitte bestätige die AGB und die sofortige Lieferung (Widerrufsrecht erlischt), um fortzufahren.";
function createOrder(req, e, P, channel) {
  const id = "IC-" + crypto.randomBytes(4).toString("hex").toUpperCase(), key = rnd(18);
  db.transaction(() => {
    db.prepare("INSERT INTO orders(id,access_key,user_id,email,status,currency,subtotal,discount,total,promo,created_at,channel,consent_at,fee,vat) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, key, req.user ? req.user.id : null, e, "awaiting_payment", "eur", P.sub, P.sub - P.items, P.total, P.rate ? P.code : null, now(), channel, now(), P.fee, P.vat);
    const st = db.prepare("INSERT INTO items(order_id,brand,name,unit,face,qty,type,phone,gift_to,gift_from,gift_msg) VALUES(?,?,?,?,?,?,?,?,?,?,?)");
    P.lines.forEach(l => st.run(id, l.b.id, l.b.name, l.pay, l.face, l.q, l.type, l.phone, l.gift && l.gift.to, l.gift && l.gift.from, l.gift && l.gift.msg));
  })();
  return { id, key };
}

/* Normaler Bezahlweg: Weiterleitung auf die Stripe-Zahlungsseite */
app.post("/api/checkout", wrap(async (req, res) => {
  if (!stripe) return bad(res, "Zahlungen sind noch nicht eingerichtet.", 503);
  const e = verifiedEmail(req);
  if (!e) return bad(res, EV_MSG, 403);
  if (req.body.consent !== true) return bad(res, CONSENT_MSG);
  let P; try { P = prepareOrder({ items: req.body.items, email: e, promo: req.body.promo }); } catch (err) { if (err instanceof Bad) return bad(res, err.message); throw err; }
  const { id, key } = createOrder(req, e, P, "checkout");
  const s = await stripeCall((p, o) => stripe.checkout.sessions.create(p, o), {
    mode: "payment", locale: "de", submit_type: "pay", customer_email: e, client_reference_id: id,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 Minuten, danach wird die reservierte Bestellung storniert
    billing_address_collection: "auto",
    metadata: { order_id: id },
    payment_intent_data: { metadata: { order_id: id }, description: `instantcodes Bestellung ${id}`, statement_descriptor_suffix: "INSTACODE" },
    line_items: P.lines.map(l => ({ quantity: l.q, price_data: { currency: "eur", unit_amount: l.pay,
      product_data: { name: checkoutName(l), description: checkoutDesc(l), images: [checkoutImage(l)], metadata: { product_id: l.b.id } } } }))
      .concat(P.fee ? [{ quantity: 1, price_data: { currency: "eur", unit_amount: P.fee, product_data: { name: "Servicegebühr", description: "Pro Bestellung, inkl. MwSt." } } }] : []),
    custom_text: {
      submit: { message: "Nach der Zahlung erscheinen deine Codes sofort auf dem Bildschirm und kommen zusätzlich per E-Mail." },
      after_submit: { message: "Zahlung wird bestätigt – du wirst gleich zurück zu instantcodes geleitet." }
    },
    success_url: `${BASE}/r/${id}?k=${key}`,
    cancel_url: `${BASE}/warenkorb?abgebrochen=1`
  }, {
    excluded_payment_method_types: klarnaOk(P.lines) ? [] : EXCLUDED_PM,
    branding_settings: { display_name: "instantcodes", button_color: "#16171B", background_color: "#FFFFFF", border_style: "rounded", font_family: "inter",
      icon: { type: "url", url: `${BASE}/icon-512.png` }, logo: { type: "url", url: `${BASE}/brand/checkout-logo.png` } }
  }, { idempotencyKey: "cs-" + id });
  db.prepare("UPDATE orders SET stripe_session=? WHERE id=?").run(s.id, id);
  res.json({ url: s.url, id, key });
}));

/* Preis für die Express-Buttons (ohne Rabattcode, damit Wallet-Betrag und Zahlung immer übereinstimmen) */
app.post("/api/quote", (req, res) => {
  try {
    const P = prepareOrder({ items: req.body.items, email: req.body.email ? norm(req.body.email) : null, promo: req.body.promo });
    res.json({ total: P.total, discount: P.sub - P.items, fee: P.fee, vat: P.vat, lines: P.lines.map(l => ({ label: lineName(l) + (l.q > 1 ? ` × ${l.q}` : ""), amount: l.pay * l.q })).concat(P.fee ? [{ label: "Servicegebühr", amount: P.fee }] : []) });
  } catch (err) { if (err instanceof Bad) return bad(res, err.message); throw err; }
});

/* Expresszahlung (Apple Pay, Google Pay, PayPal, Link …): Bestellung + PaymentIntent anlegen */
const expressLim = rateLimit({ windowMs: 15 * 60e3, limit: 60, standardHeaders: true, legacyHeaders: false, message: { error: "Zu viele Versuche. Bitte warte ein paar Minuten." } });
/* Expresszahlung ohne bestätigte E-Mail (E-Mail aus der Wallet): strenger begrenzt */
const walletLim = rateLimit({ windowMs: 15 * 60e3, limit: 12, standardHeaders: true, legacyHeaders: false, skip: req => !!verifiedEmail(req), message: { error: "Zu viele Versuche. Bitte warte ein paar Minuten." } });
app.post("/api/express/intent", expressLim, walletLim, wrap(async (req, res) => {
  if (!stripe) return bad(res, "Zahlungen sind noch nicht eingerichtet.", 503);
  /* Bestätigte E-Mail (Code oder Konto) hat Vorrang. Ohne sie gilt die E-Mail, die die Wallet (Apple Pay, Google Pay, Link …)
     übermittelt: Die Bestellung bekommt den Kanal „wallet“ und wird nur ausgeliefert, wenn Stripe nach der Zahlung
     eine Wallet-Zahlung mit genau dieser E-Mail meldet (holdReason). Alle übrigen Prüfungen und Limits gelten unverändert. */
  let e = verifiedEmail(req), channel = "express";
  if (!e) {
    const we = norm(req.body.email);
    if (req.body.wallet !== true || !emailOk(we)) return bad(res, EV_MSG, 403);
    e = we; channel = "wallet";
  }
  if (req.body.consent !== true) return bad(res, CONSENT_MSG);
  /* Gewählte Express-Zahlungsart. Klarna und Revolut Pay übermitteln keine geprüfte E-Mail: nur mit bestätigter E-Mail (Kanal „express“) */
  const pm = XPM.includes(req.body.pm) ? req.body.pm : null;
  if (NOMAIL_PM.includes(pm) && channel !== "express") return bad(res, EV_MSG, 403);
  if (pm === "revolut_pay" && !PAY_METHODS.includes("revolut_pay")) return bad(res, "Revolut Pay ist gerade nicht verfügbar. Bitte nimm eine andere Zahlungsart.");
  let P; try { P = prepareOrder({ items: req.body.items }); } catch (err) { if (err instanceof Bad) return bad(res, err.message); throw err; }
  if (pm === "klarna" && !klarnaOk(P.lines)) return bad(res, "Klarna ist für diese Artikel nicht verfügbar. Bitte nimm eine andere Zahlungsart.");
  if (req.body.expect != null && Number(req.body.expect) !== P.total) return bad(res, "Der Preis hat sich gerade geändert. Bitte versuch es noch einmal.", 409);
  const { id, key } = createOrder(req, e, P, channel);
  const meta = { order_id: id, email_src: channel === "wallet" ? "wallet" : "verified" };
  if (pm) meta.express_pm = pm;
  /* Revolut Pay gibt es nicht im Express Checkout Element: eigener Knopf, Zahlung wird hier bestätigt und der Kunde
     direkt zu Revolut weitergeleitet (App auf dem Handy, QR-Code am Computer), danach zurück auf die Bestellseite */
  if (pm === "revolut_pay") {
    const back = `/r/${id}?k=${encodeURIComponent(key)}`;
    const pi = await stripe.paymentIntents.create({
      amount: P.total, currency: "eur", payment_method_types: ["revolut_pay"], payment_method_data: { type: "revolut_pay" }, confirm: true, return_url: BASE + back,
      metadata: DEVPAY ? { ...meta, wallet: "Revolut Pay" } : meta, description: `instantcodes Bestellung ${id}`
    }, { idempotencyKey: "pi-" + id });
    db.prepare("UPDATE orders SET payment_intent=? WHERE id=?").run(pi.id, id);
    /* Weiterleitung zu Revolut; ohne Adresse (anderer next_action-Typ) übernimmt Stripe.js im Browser (handleNextAction) */
    const next = pi.next_action && pi.next_action.redirect_to_url && pi.next_action.redirect_to_url.url;
    const redirect = DEVPAY ? `/__devpay/pi/${pi.id}?r=${encodeURIComponent(back)}` : next || (pi.status === "requires_action" ? null : BASE + back);
    return res.json({ id, key, total: P.total, redirect, client_secret: pi.client_secret });
  }
  /* Klarna nur, wenn alle Artikel freigegeben sind (gleiche Regel wie Stripe-Kasse und Zahlungsfeld) und die E-Mail bestätigt ist */
  const klarna = channel === "express" && klarnaOk(P.lines);
  const pi = await stripeCall((p, o) => stripe.paymentIntents.create(p, o), {
    amount: P.total, currency: "eur", automatic_payment_methods: { enabled: true },
    metadata: meta, description: `instantcodes Bestellung ${id}`, statement_descriptor_suffix: "INSTACODE"
  }, { excluded_payment_method_types: klarna ? [] : EXCLUDED_PM }, { idempotencyKey: "pi-" + id });
  db.prepare("UPDATE orders SET payment_intent=? WHERE id=?").run(pi.id, id);
  res.json({ client_secret: pi.client_secret, id, key, total: P.total });
}));

/* Zahlung direkt im Warenkorb (Stripe Payment Element, ohne Weiterleitung): Bestellung + PaymentIntent anlegen */
app.post("/api/pay/intent", expressLim, wrap(async (req, res) => {
  if (!stripe) return bad(res, "Zahlungen sind noch nicht eingerichtet.", 503);
  if (req.body.consent !== true) return bad(res, CONSENT_MSG);
  const e = verifiedEmail(req);
  if (!e) return bad(res, EV_MSG, 403);
  let P; try { P = prepareOrder({ items: req.body.items, email: e, promo: req.body.promo }); } catch (err) { if (err instanceof Bad) return bad(res, err.message); throw err; }
  if (req.body.expect != null && Number(req.body.expect) !== P.total)
    return res.status(409).json({ error: P.sub - P.items === 0 && req.body.promo ? "Der Rabattcode gilt nur für die erste Bestellung pro E-Mail-Adresse. Der Gesamtbetrag wurde angepasst – bitte prüfen und erneut bestellen." : "Der Preis hat sich gerade geändert. Bitte prüfen und erneut bestellen.", total: P.total, discount: P.sub - P.total });
  const { id, key } = createOrder(req, e, P, "inline");
  const pi = await stripe.paymentIntents.create({
    amount: P.total, currency: "eur", payment_method_types: inlineTypes().concat(klarnaOk(P.lines) ? ["klarna"] : []),
    metadata: { order_id: id }, description: `instantcodes Bestellung ${id}`, statement_descriptor_suffix: "INSTACODE"
  }, { idempotencyKey: "pi-" + id });
  db.prepare("UPDATE orders SET payment_intent=? WHERE id=?").run(pi.id, id);
  res.json({ client_secret: pi.client_secret, id, key, total: P.total, return_url: `${BASE}/r/${id}?k=${encodeURIComponent(key)}` });
}));

app.get("/api/orders", need, (req, res) => {
  const ids = db.prepare("SELECT id FROM orders WHERE user_id=? AND status!='awaiting_payment' ORDER BY created_at DESC LIMIT 100").all(req.user.id);
  res.json({ orders: ids.map(r => pubOrder(orderFull(r.id))) });
});

app.get("/api/orders/:id", (req, res) => {
  const o = orderFull(String(req.params.id));
  const ok = o && ((req.user && o.user_id === req.user.id) || (req.query.k && req.query.k === o.access_key) || isAdmin(req.user));
  if (!ok) return bad(res, "Bestellung nicht gefunden.", 404);
  res.json({ order: pubOrder(o) });
});

/* ---------- Admin: Bestellungen (Prüffälle) ---------- */
app.get("/api/admin/orders", admin, (req, res) => {
  const st = String(req.query.status || "processing");
  const rows = st === "all"
    ? db.prepare("SELECT id FROM orders WHERE status!='awaiting_payment' ORDER BY created_at DESC LIMIT 200").all()
    : db.prepare("SELECT id FROM orders WHERE status=? ORDER BY created_at ASC LIMIT 200").all(st);
  const counts = Object.fromEntries(db.prepare("SELECT status, COUNT(*) n FROM orders GROUP BY status").all().map(r => [r.status, r.n]));
  const orders = rows.map(r => {
    const o = pubOrder(orderFull(r.id), true);
    if (o.status === "processing") o.items.forEach(i => { if (i.type === "code") i.stock = available(i.brand, i.face) === Infinity ? null : freeCount(i.brand, i.face); });
    return o;
  });
  res.json({ orders, counts, testmode: TESTMODE, generator: TEST_GEN });
});

/* Ausliefern durch das Team: leere Code-Felder werden aus dem Lager gefüllt */
app.post("/api/admin/orders/:id/deliver", admin, wrap(async (req, res) => {
  const o = orderFull(String(req.params.id));
  if (!o) return bad(res, "Bestellung nicht gefunden.", 404);
  if (o.status !== "processing") return bad(res, "Nur bezahlte Bestellungen in Bearbeitung können ausgeliefert werden.");
  if (req.body.reloadly) {
    if (!RL_USE) return bad(res, "Reloadly ist nicht eingerichtet.");
    let tu;
    try { tu = await supply(o); deliverOrder(o, {}, tu, "admin", "Über Reloadly ausgeliefert"); }
    catch (err) { return bad(res, err instanceof Stockout ? `Kein Reloadly-Produkt und kein Lagerbestand für ${err.message}.` : err.message); }
    return res.json({ order: pubOrder(sendDelivered(o.id), true) });
  }
  const input = Object.fromEntries((req.body.items || []).map(i => [String(i.id), i]));
  const given = {}, topups = {};
  for (const it of o.items) {
    const inp = input[String(it.id)] || {};
    if (it.type === "topup") { if (!inp.done) return bad(res, `Bitte bestätige die Aufladung für ${it.name}.`); topups[it.id] = [String(inp.ref || "aufgeladen").slice(0, 100)]; continue; }
    const codes = [...new Set((Array.isArray(inp.codes) ? inp.codes : []).map(c => String(c).trim()).filter(Boolean).map(c => c.slice(0, 200)))];
    if (codes.length > it.qty) return bad(res, `Für ${it.name} werden nur ${it.qty} Code(s) benötigt.`);
    for (const c of codes) if ((db.prepare("SELECT status FROM codes WHERE hash=?").get(codeHash(c)) || {}).status === "sold") return bad(res, `Der Code ${c.slice(0, 6)}… wurde schon verkauft.`);
    given[it.id] = codes;
  }
  try { deliverOrder(o, given, topups, "admin", String(req.body.note || "").slice(0, 500) || null); }
  catch (err) { if (err instanceof Stockout) return bad(res, `Nicht genug Codes im Lager für ${err.message}. Bitte Codes eintragen oder das Lager auffüllen.`); throw err; }
  res.json({ order: pubOrder(sendDelivered(o.id), true) });
}));

/* ---------- Reloadly-Katalog: alle Euro-Produkte mit Originalbild automatisch in den Shop ---------- */
const RL_IMG = path.join(DATA, "img", "rl");
fs.mkdirSync(RL_IMG, { recursive: true });
const RL_COUNTRIES = (E.RELOADLY_COUNTRIES || "DE,AT,NL,FR,BE,IT,ES,IE,FI,PT,LU").split(",").map(x => x.trim().toUpperCase()).filter(Boolean);
const kvGet = k => (db.prepare("SELECT v FROM kv WHERE k=?").get(k) || {}).v;
const kvSet = (k, v) => db.prepare("INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(k, String(v));

/* ---------- Stripe-Selbsteinrichtung ----------
   Mit einem echten Stripe-Schlüssel legt der Shop beim Start selbst an, was sonst im Dashboard zu klicken wäre:
   1. den Webhook (BASE/api/stripe/webhook) mit allen Ereignissen, die Shop und Abo auswerten – das Geheimnis wird
      verschlüsselt in der Datenbank gespeichert. STRIPE_WEBHOOK_SECRET hat Vorrang, wenn gesetzt.
   2. die Zahlungs-Domains (für Apple Pay, Google Pay, Link, PayPal …) für die Shop-Adresse und die Domain ohne www.
   Fremde Webhooks auf dieselbe Adresse werden nie gelöscht; nur eigene (metadata.instantcodes = "1") werden erneuert. */
const WH_EVENTS = ["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed",
  "checkout.session.expired", "payment_intent.succeeded", "payment_intent.processing", "payment_intent.canceled", "payment_intent.payment_failed",
  "charge.refunded", "customer.subscription.deleted", "customer.subscription.updated", "invoice.paid", "invoice.payment_succeeded", "invoice.payment_failed"];
let WH_OWN; // Geheimnis des selbst angelegten Webhooks (verschlüsselt in kv „stripe_wh“), einmal gelesen
const whOwn = () => { if (WH_OWN === undefined) { WH_OWN = null; const s = kvGet("stripe_wh"); if (s) { try { WH_OWN = dec(s); } catch (e) {} } } return WH_OWN; };
const whSecrets = () => [E.STRIPE_WEBHOOK_SECRET, whOwn()].filter((x, i, a) => x && a.indexOf(x) === i);
const stripeState = { webhook: null, domains: [], error: null };
async function stripeSetup() {
  if (!stripe || DEVPAY || !/^https:\/\//.test(BASE)) return;
  const url = BASE.replace(/\/$/, "") + "/api/stripe/webhook";
  try {
    const all = (await stripe.webhookEndpoints.list({ limit: 100 })).data.filter(w => w.url === url);
    const ours = all.find(w => w.metadata && w.metadata.instantcodes === "1"), foreign = all.filter(w => !(w.metadata && w.metadata.instantcodes === "1"));
    if ((ours && whOwn()) || (foreign.length && E.STRIPE_WEBHOOK_SECRET)) {
      if (ours) await stripe.webhookEndpoints.update(ours.id, { enabled_events: WH_EVENTS, disabled: false });
      stripeState.webhook = ours && whOwn() ? "eigener Webhook aktiv" : "Webhook aus STRIPE_WEBHOOK_SECRET";
    } else if (foreign.length && !E.STRIPE_WEBHOOK_SECRET) {
      stripeState.webhook = "Es gibt schon einen Webhook auf diese Adresse – bitte dessen Geheimnis als STRIPE_WEBHOOK_SECRET setzen oder ihn löschen.";
      console.warn("Stripe: " + stripeState.webhook);
    } else {
      if (ours) await stripe.webhookEndpoints.del(ours.id);
      /* Ereignisse in der API-Version der eingebauten Stripe-Bibliothek – dieselbe Form, die der Shop auch beim Abruf bekommt */
      const p = { url, enabled_events: WH_EVENTS, description: "instantcodes Shop (automatisch angelegt)", metadata: { instantcodes: "1" } };
      if (Stripe.API_VERSION) p.api_version = Stripe.API_VERSION;
      const w = await stripe.webhookEndpoints.create(p);
      WH_OWN = w.secret; kvSet("stripe_wh", enc(w.secret)); stripeState.webhook = "Webhook angelegt";
      console.log("Stripe: Webhook angelegt für " + url);
    }
  } catch (e) { stripeState.error = "Webhook: " + e.message; console.error("Stripe-Webhook: " + e.message); }
  try {
    const host = new URL(BASE).hostname, names = [host];
    if (host.startsWith("www.")) names.push(host.slice(4));
    for (const d of names) {
      const ex = (await stripe.paymentMethodDomains.list({ domain_name: d, limit: 1 })).data[0];
      const pmd = ex || await stripe.paymentMethodDomains.create({ domain_name: d, enabled: true });
      if (!pmd.apple_pay || pmd.apple_pay.status !== "active") await stripe.paymentMethodDomains.validate(pmd.id).catch(() => {});
      stripeState.domains.push(d);
    }
    console.log("Stripe: Zahlungs-Domains eingerichtet (" + stripeState.domains.join(", ") + ")");
  } catch (e) { stripeState.error = (stripeState.error ? stripeState.error + " | " : "") + "Domains: " + e.message; console.error("Stripe-Domains: " + e.message); }
}
setTimeout(() => { stripeSetup().catch(e => console.error("Stripe-Einrichtung: " + e.message)); }, 4000);
/* Klarna: nur für im Admin freigegebene Kategorien (Standard: aus). Stripe nennt Gutscheine als verbotene Kategorie – erst nach schriftlicher Freigabe durch Stripe einschalten. */
/* Klarna (Rechnung, Raten, Sofort): Standard = alle Kategorien; im Admin einschränkbar, „-“ = aus */
const ALL_CATS = ["topup", "keys", "gaming", "currency", "subs", "apps", "entertainment", "shopping", "software", "payment"];
/* Klarna verbietet laut Stripe „Stored value cards, vouchers and gift cards“: ohne eigene Einstellung im Admin daher nur Spiele-Keys und Software */
const KLARNA_SAFE = ["keys", "software"];
const KLARNA_CATS = () => { const v = kvGet("klarna_cats"); return v == null || v === "" ? KLARNA_SAFE : v === "-" ? [] : v.split(",").map(x => x.trim()).filter(Boolean); };
const KLARNA_ON = () => KLARNA_AVAIL && KLARNA_CATS().length > 0;
const klarnaOk = lines => KLARNA_ON() && lines.length > 0 && lines.every(l => KLARNA_CATS().includes(l.b.cat));
const KLARNA_INFO = () => ({ available: KLARNA_AVAIL, cats: KLARNA_CATS(), on: KLARNA_ON() });
function rlCat(p) {
  const t = `${(p.category && p.category.name) || ""} ${p.productName} ${(p.brand && p.brand.brandName) || ""}`.toLowerCase();
  if (/playstation plus|game pass|xbox live|switch online|ea play|ubisoft\+|abo|subscription|membership/.test(t)) return "subs";
  if (/v-?bucks|robux|valorant|riot|points|coins|diamonds|gems|uc\b|cp\b|free fire|pubg|mobile legends|genshin|league of legends/.test(t)) return "currency";
  if (/steam|playstation|psn|xbox|nintendo|battle\.?net|blizzard|ea |origin|epic|razer|roblox|gaming|game|rockstar|ubisoft|riot/.test(t)) return "gaming";
  if (/apple|itunes|google play|app store/.test(t)) return "apps";
  if (/netflix|spotify|disney|dazn|deezer|youtube|music|stream|movie|tv|entertainment|audible|twitch|paramount|sky|rtl|joyn|wow/.test(t)) return "entertainment";
  if (/software|antivirus|norton|kaspersky|mcafee|vpn|office|microsoft 365|avast|bitdefender/.test(t)) return "software";
  if (/visa|mastercard|paysafecard|prepaid|neosurf|cashlib|flexepin|crypto|payment|transcash/.test(t)) return "payment";
  return "shopping";
}
/* Sortiment: nur Länder der EU und nur bekannte Top-Marken (RL_ALL=1 schaltet den Filter ab) */
const EU27 = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR IE IT LV LT LU MT NL PL PT RO SK SI ES SE HU".split(" "));
const TOP_BRANDS = [
  /\bamazon\b/, /\b(apple|itunes|app store)\b/, /\bgoogle play\b/, /\b(playstation|psn)\b/, /\bxbox\b/, /\bnintendo\b/, /\bsteam\b/,
  /\bnetflix\b/, /\bspotify\b/, /\bdisney\b/, /\bdazn\b/, /\broblox\b/, /\b(fortnite|v-?bucks)\b/, /\b(ea sports|ea play|ea app|ea\b)/, /\b(riot|valorant|league of legends)\b/,
  /\b(battle\.?net|blizzard)\b/, /\bubisoft\b/, /\bminecraft\b/, /\brazer gold\b/, /\bpubg\b/, /\bcall of duty\b/, /\btwitch\b/,
  /\bzalando\b/, /\bikea\b/, /\bh ?& ?m\b/, /\bmedia ?markt\b/, /\bsaturn\b/, /\botto\b/, /\bdouglas\b/, /\bsephora\b/, /\bnike\b/, /\badidas\b/, /\bzara\b/,
  /\bdecathlon\b/, /\babout you\b/, /\blieferando\b/, /\buber\b/, /\bairbnb\b/, /\b(booking\.com|hotels\.com)\b/, /\b(rewe|lidl|aldi|edeka)\b/,
  /\bmicrosoft\b/, /\bnorton\b/, /\bmcafee\b/, /\bnordvpn\b/, /\bpaysafecard\b/];
const RL_ALL = E.RL_ALL === "1";
function rlAllowed(p) {
  if (RL_ALL) return true;
  if (!EU27.has((p.country && p.country.isoName) || "")) return false;
  const t = `${(p.brand && p.brand.brandName) || ""} ${p.productName || ""}`.toLowerCase();
  return TOP_BRANDS.some(re => re.test(t));
}
const rlClean = n => String(n || "").replace(/\s*\((DE|AT|EU|EUR|Germany|Deutschland)\)\s*/gi, " ").replace(/\s+(DE|AT|EU|EUR|Germany|Deutschland|Austria|Österreich)$/i, "").replace(/\s+(DE|AT|EU|EUR|Germany|Deutschland)\s+/i, " ").replace(/\s{2,}/g, " ").trim();
function rlAmts(p) {
  if (p.denominationType === "FIXED") return [...new Set((p.fixedRecipientDenominations || []).map(Number).filter(a => a >= 1 && a <= 500))].sort((a, b) => a - b).slice(0, 8);
  const lo = Number(p.minRecipientDenomination), hi = Number(p.maxRecipientDenomination);
  return [...new Set([lo, 10, 15, 20, 25, 50, 75, 100, 150, 200].filter(a => a >= lo && a <= hi && a <= 500).map(a => Math.round(a * 100) / 100))].sort((a, b) => a - b).slice(0, 7);
}
/* Gruppenschlüssel: gleiche Karte in verschiedenen Ländern/Währungen → eine Produktseite */
const GENERIC = /\b(gift ?cards?|e-?gift|egift|geschenkkarten?|gutscheine?|guthaben(karte)?|vouchers?|cards?|karte|wallet|store|digital|code|online|prepaid|top ?up|recharge|cr[eé]dit|carte|cadeau|tarjeta|regalo|buono|bon|eur|euro)\b/g;
function grpKey(name, p) {
  let n = " " + String(name || "").toLowerCase() + " ";
  if (p) {
    const c = p.country || {};
    [c.isoName, c.name, p.recipientCurrencyCode, c.isoName === "US" ? "usa" : "", c.isoName === "GB" ? "uk" : "", c.isoName === "AE" ? "uae" : ""]
      .filter(Boolean).forEach(t => { n = n.replace(new RegExp(`[\\s(\\[.-]${String(t).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s)\\].,-]|$)`, "g"), " "); });
  }
  n = n.replace(/\.(com|de|co\.uk|fr|it|es|nl|ca|com\.au|in|ae|sa|jp|mx|br|pl|se|at|ch|be)\b/g, " ").replace(GENERIC, " ").replace(/\b(de|at|eu|us|uk|fr|it|es|nl|ch|be|pl|tr|ca|au|in|ae|sa|br|mx|jp|kr|ie|pt|se|no|dk|fi)\b/g, " ");
  return n.replace(/[^a-z0-9]+/g, "") || String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
const RL_MARGIN = Math.max(0, parseFloat(E.RL_MARGIN || "0") || 0); // Fremdwährung: Preis = Einkaufspreis bei Reloadly
const curFmt = (a, c) => `${Number(a).toLocaleString("de-DE", { maximumFractionDigits: 2 })} ${({ USD: "$", GBP: "£", EUR: "€" })[c] || c}`;
function rlBrand(row) {
  const p = JSON.parse(row.data), cur = p.recipientCurrencyCode;
  const name = rlClean(p.productName), country = (p.country && p.country.isoName) || "DE";
  const img = row.img ? `/img/rl/${row.product_id}.${row.img}` : (p.logoUrls || [])[0] || null;
  if (!img) return null;
  const base = { id: row.id, name, grp: "g:" + grpKey(p.productName, p), cat: rlCat(p), type: "card", disc: 0, bg: "linear-gradient(135deg,#1B1E2E,#2C3150)", fg: "#fff",
    mark: { t: name, s: 22, w: 800 }, region: country, regionName: (p.country && p.country.name) || country, rl: 1, img, brand: (p.brand && p.brand.brandName) || name };
  if (cur === "EUR") { const amts = rlAmts(p); return amts.length ? { ...base, amts } : null; }
  /* Fremdwährung: Preis in Euro aus dem Einkaufspreis bei Reloadly (+ Aufschlag), nur wenn das Reloadly-Konto in Euro abrechnet */
  if (p.senderCurrencyCode !== "EUR") return null;
  const fee = a => (Number(p.senderFee) || 0) + a * (Number(p.senderFeePercentage) || 0) / 100;
  let pairs = [];
  if (p.denominationType === "FIXED" && p.fixedRecipientToSenderDenominationsMap) {
    pairs = Object.entries(p.fixedRecipientToSenderDenominationsMap).map(([r, s]) => [Number(r), Number(s)]);
  } else if (p.recipientCurrencyToSenderCurrencyExchangeRate) {
    const rate = Number(p.recipientCurrencyToSenderCurrencyExchangeRate), lo = Number(p.minRecipientDenomination), hi = Number(p.maxRecipientDenomination);
    const nice = [5, 10, 15, 20, 25, 50, 75, 100, 150, 200, 250, 500, 1000, 2000, 5000, 10000].filter(a => a >= lo && a <= hi);
    pairs = (nice.length ? nice : [lo]).map(a => [a, a * rate]);
  }
  pairs = pairs.filter(([r, s]) => r > 0 && s > 0).map(([r, s]) => [r, Math.ceil((s + fee(s)) * (1 + RL_MARGIN) * 100) / 100]).filter(([, e]) => e >= 1 && e <= 500)
    .sort((x, y) => x[0] - y[0]).slice(0, 8);
  if (!pairs.length) return null;
  return { ...base, amts: pairs.map(x => x[0]), labels: pairs.map(x => curFmt(x[0], cur)), px: Object.fromEntries(pairs.map(([r, e]) => [String(r), e])), cur };
}
/* importierte Produkte in den Katalog einhängen */
function rlInject() {
  for (const k of Object.keys(CATALOG)) if (CATALOG[k].rl) delete CATALOG[k];
  const up = db.prepare("INSERT INTO rl_map(id,product_id,country,name,amts,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id,country=excluded.country,name=excluded.name,amts=excluded.amts");
  let n = 0;
  const rank = row => { const p = JSON.parse(row.data), c = (p.country || {}).isoName; return (c === "DE" ? 0 : c === "AT" ? 1 : p.recipientCurrencyCode === "EUR" ? 2 : c === "US" ? 3 : c === "GB" ? 4 : 5); };
  const rows = db.prepare("SELECT * FROM rl_catalog").all().filter(r => { try { return rlAllowed(JSON.parse(r.data)); } catch (e) { return false; } }).map(r => [rank(r), r]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  for (const row of rows) {
    const b = rlBrand(row); if (!b) continue;
    const p = JSON.parse(row.data);
    CATALOG[b.id] = b; n++;
    up.run(b.id, row.product_id, (p.country && p.country.isoName) || "DE", p.productName, JSON.stringify(b.amts), now());
  }
  prodCache = null; pageCache = null;
  return n;
}
async function rlDownload(url, file) {
  const r = await fetch(url); if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = Object.keys(IMG_TYPES).find(k => IMG_TYPES[k](buf)); if (!ext || buf.length > 3e6) return null;
  fs.writeFileSync(`${file}.${ext}`, buf); return ext;
}
let rlImportRunning = null;
async function rlImport() {
  if (!RL.ON) throw new Error("Reloadly ist nicht verbunden.");
  if (rlImportRunning) return rlImportRunning;
  rlImportRunning = (async () => {
    const mapped = new Set(db.prepare("SELECT product_id FROM rl_map WHERE id NOT LIKE 'rl%'").all().map(r => r.product_id));
    let all = [];
    try { all = await RL.allProducts(); } catch (e) { console.error("Reloadly-Gesamtkatalog:", e.message); }
    if (!all.length) for (const cc of RL_COUNTRIES) { try { all.push(...await RL.products(cc)); } catch (e) {} }
    const seen = new Set(), keep = [];
    for (const p of all) {
      if (!(p.logoUrls || []).length || mapped.has(p.productId) || !rlAllowed(p)) continue;
      const key = `${rlClean(p.productName).toLowerCase().replace(/[^a-z0-9]+/g, "")}|${(p.country && p.country.isoName) || ""}|${p.recipientCurrencyCode}`;
      if (seen.has(key)) continue; seen.add(key); keep.push(p);
    }
    const ins = db.prepare("INSERT INTO rl_catalog(product_id,id,data,img,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(product_id) DO UPDATE SET data=excluded.data,img=COALESCE(excluded.img,rl_catalog.img),updated_at=excluded.updated_at");
    let imgs = 0;
    /* Bilder: für den Heimatmarkt (Euro, DE/AT) lokal speichern, alle anderen direkt vom Reloadly-CDN laden */
    for (let i = 0; i < keep.length; i += 8) {
      await Promise.all(keep.slice(i, i + 8).map(async p => {
        const have = db.prepare("SELECT img FROM rl_catalog WHERE product_id=?").get(p.productId);
        let ext = have && have.img;
        const home = p.recipientCurrencyCode === "EUR" && ["DE", "AT"].includes(p.country && p.country.isoName);
        if (!ext && home) { try { ext = await rlDownload(p.logoUrls[0], path.join(RL_IMG, String(p.productId))); if (ext) imgs++; } catch (e) {} }
        ins.run(p.productId, `rl${p.productId}`, JSON.stringify(p), ext || null, now());
      }));
    }
    /* Produkte, die Reloadly nicht mehr führt, aus dem Shop nehmen */
    const ids = new Set(keep.map(p => p.productId));
    const gone = db.prepare("SELECT product_id FROM rl_catalog").all().filter(r => !ids.has(r.product_id));
    if (keep.length > 20) db.transaction(() => gone.forEach(r => db.prepare("DELETE FROM rl_catalog WHERE product_id=?").run(r.product_id)))();
    kvSet("rl_import_v3", now());
    const n = rlInject();
    console.log(`Reloadly-Katalog: ${n} Produkte im Shop, ${imgs} neue Bilder, ${gone.length} entfernt`);
    return { products: n, images: imgs, removed: keep.length > 20 ? gone.length : 0 };
  })().finally(() => { rlImportRunning = null; });
  return rlImportRunning;
}
app.get("/img/rl/:file", (req, res) => {
  const m = String(req.params.file).match(/^(\d+)\.(png|jpg|webp)$/);
  if (!m) return res.status(404).end();
  res.set("Cache-Control", "public, max-age=604800, immutable");
  res.sendFile(path.join(RL_IMG, `${m[1]}.${m[2]}`), err => { if (err && !res.headersSent) res.status(404).end(); });
});

/* ---------- Admin: Reloadly ---------- */
app.get("/api/admin/reloadly", admin, wrap(async (req, res) => {
  const map = Object.fromEntries(db.prepare("SELECT * FROM rl_map").all().map(r => [r.id, r]));
  const products = Object.values(CATALOG).filter(b => b.cat !== "topup" && !b.rl).map(b => ({ id: b.id, name: b.name, labels: b.labels, amts: b.amts, map: map[b.id] || null }));
  res.json({ imported: db.prepare("SELECT COUNT(*) n FROM rl_catalog WHERE img IS NOT NULL").get().n, lastImport: +kvGet("rl_import_v3") || null, on: RL.ON, active: RL_USE, sandbox: RL.SANDBOX, testmode: TESTMODE, balance: RL.ON ? await RL.balance() : null, products });
}));
app.post("/api/admin/reloadly/import", admin, wrap(async (req, res) => {
  try { res.json(await rlImport()); } catch (e) { bad(res, e.message); }
}));
/* Alle Shop-Produkte automatisch passenden Reloadly-Produkten zuordnen */
app.post("/api/admin/reloadly/sync", admin, wrap(async (req, res) => {
  if (!RL.ON) return bad(res, "RELOADLY_CLIENT_ID und RELOADLY_CLIENT_SECRET fehlen.");
  const lists = {};
  const get = async c => (lists[c] = lists[c] || await RL.products(c));
  const up = db.prepare("INSERT INTO rl_map(id,product_id,country,name,amts,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id,country=excluded.country,name=excluded.name,amts=excluded.amts,updated_at=excluded.updated_at");
  let found = 0, images = 0; const missing = [];
  for (const b of Object.values(CATALOG)) {
    if (b.cat === "topup" || b.rl) continue;
    const manual = db.prepare("SELECT manual, product_id, country FROM rl_map WHERE id=?").get(b.id);
    if (manual && manual.manual) { found++; const mp = (await get(manual.country || "DE")).find(x => x.productId === manual.product_id); if (mp && await rlImage(b.id, mp.logoUrls)) images++; continue; }
    let p = null, c = null;
    for (const cc of [...new Set([b.region && b.region !== "EU" ? b.region : "DE", "DE", "AT", "NL", "FR", "BE", "IT", "ES", "IE", "FI"])]) { p = RL.match(b, await get(cc)); if (p) { c = cc; break; } }
    if (!p) { missing.push(b.name + (b.labels ? " " + b.labels[0] : "")); continue; }
    const fixed = p.fixedRecipientDenominations || [];
    const amts = p.denominationType === "RANGE" ? b.amts.filter(a => a >= p.minRecipientDenomination && a <= p.maxRecipientDenomination) : b.amts.filter(a => fixed.includes(a));
    up.run(b.id, p.productId, c, p.productName, JSON.stringify(amts), now()); found++;
    if (await rlImage(b.id, p.logoUrls)) images++;
  }
  /* Handy-Aufladungen: Betreiber-Logos */
  try {
    const ops = await RL.operators("DE");
    for (const b of Object.values(CATALOG).filter(x => x.cat === "topup")) {
      const op = RL.matchOperator(b, ops);
      if (op && await rlImage(b.id, op.logoUrls)) images++;
    }
  } catch (e) { console.error("Reloadly-Betreiber:", e.message); }
  prodCache = null; pageCache = null;
  res.json({ found, images, missing });
}));
/* Offizielles Produktbild von Reloadly übernehmen (eigene Uploads bleiben unangetastet) */
async function rlImage(id, urls) {
  const url = (urls || []).find(u => /^https:\/\//.test(u));
  if (!url) return false;
  const row = prodRows()[id] || {};
  if (row.img && row.img_src !== "rl") return false;
  try {
    const r = await fetch(url);
    if (!r.ok) return false;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return false;
    const ext = Object.keys(IMG_TYPES).find(k => IMG_TYPES[k](buf));
    if (!ext) return false;
    fs.mkdirSync(IMG_DIR, { recursive: true });
    for (const k of Object.keys(IMG_TYPES)) { try { fs.unlinkSync(path.join(IMG_DIR, `${id}.${k}`)); } catch (e) {} }
    fs.writeFileSync(path.join(IMG_DIR, `${id}.${ext}`), buf);
    db.prepare("INSERT INTO products(id,img,img_v,img_src) VALUES(?,?,?,'rl') ON CONFLICT(id) DO UPDATE SET img=excluded.img, img_v=excluded.img_v, img_src='rl'").run(id, ext, now());
    prodCache = null;
    return true;
  } catch (e) { console.error("Reloadly-Bild", id, e.message); return false; }
}

/* Reloadly-Katalog durchsuchen (für die Zuordnung von Hand) */
const rlCache = {};
app.get("/api/admin/reloadly/search", admin, wrap(async (req, res) => {
  if (!RL.ON) return bad(res, "Reloadly ist nicht verbunden.");
  const q = String(req.query.q || "").toLowerCase().replace(/[^a-z0-9äöüß ]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!q.length) return res.json({ results: [] });
  const out = [];
  for (const cc of ["DE", "AT", "NL", "FR", "BE", "IT", "ES", "IE", "FI"]) {
    if (!rlCache[cc] || rlCache[cc].t < now() - 36e5) rlCache[cc] = { t: now(), list: await RL.products(cc).catch(() => []) };
    for (const p of rlCache[cc].list) {
      const name = `${p.productName} ${p.brand && p.brand.brandName}`.toLowerCase();
      if (q.every(w => name.includes(w))) out.push({ productId: p.productId, name: p.productName, country: cc, currency: p.recipientCurrencyCode,
        amounts: p.denominationType === "RANGE" ? `${p.minRecipientDenomination}–${p.maxRecipientDenomination}` : (p.fixedRecipientDenominations || []).join(", "), logo: (p.logoUrls || [])[0] || null });
    }
  }
  out.sort((a, b) => (b.currency === "EUR") - (a.currency === "EUR"));
  res.json({ results: out.slice(0, 30) });
}));

/* Reloadly-Produkt von Hand zuordnen (productId aus dem Reloadly-Katalog) oder entfernen */
app.post("/api/admin/reloadly/map/:id", admin, wrap(async (req, res) => {
  const b = CATALOG[String(req.params.id)];
  if (!b) return bad(res, "Produkt nicht gefunden.", 404);
  const pid = parseInt(req.body.productId, 10);
  if (!pid) { db.prepare("DELETE FROM rl_map WHERE id=?").run(b.id); prodCache = null; pageCache = null; return res.json({ ok: true }); }
  db.prepare("INSERT INTO rl_map(id,product_id,country,name,amts,updated_at,manual) VALUES(?,?,?,?,?,?,1) ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id,country=excluded.country,name=excluded.name,amts=NULL,updated_at=excluded.updated_at,manual=1")
    .run(b.id, pid, String(req.body.country || "DE").toUpperCase().slice(0, 2), String(req.body.name || "").slice(0, 120), null, now());
  if (req.body.logo) await rlImage(b.id, [String(req.body.logo)]);
  prodCache = null; pageCache = null;
  res.json({ ok: true });
}));

/* ---------- Admin: Code-Lager ---------- */
app.get("/api/admin/stock", admin, (req, res) => {
  const n = {};
  db.prepare("SELECT brand, face, is_test, status, COUNT(*) c FROM codes GROUP BY brand, face, is_test, status").all()
    .forEach(r => { const k = `${r.brand}|${r.face}`; n[k] = n[k] || { free: 0, sold: 0, test_free: 0, test_sold: 0 }; n[k][(r.is_test ? "test_" : "") + (r.status === "free" ? "free" : "sold")] += r.c; });
  const hasStock = new Set(Object.keys(n).map(k => k.split("|")[0]));
  const visible = new Set(shopCatalog().map(b => b.id));
  const products = Object.values(CATALOG).filter(b => isCodeBrand(b.id) && (!b.rl || hasStock.has(b.id) || (visible.has(b.id) && b.region === "DE"))).map(b => ({ id: b.id, name: b.rl && b.region !== "DE" ? `${b.name} (${b.region})` : b.name, cat: b.cat,
    amts: b.amts.map((a, i) => ({ a, label: optLabel(b, a), ...(n[`${b.id}|${fc(a)}`] || { free: 0, sold: 0, test_free: 0, test_sold: 0 }) })) }));
  res.json({ products, testmode: TESTMODE, generator: TEST_GEN, rules: { auto: AUTO, max: AUTO_MAX, day: AUTO_DAY } });
});

/* ---------- Admin: Codes aus einer Textdatei automatisch sortieren ---------- */
const nrm = t => String(t || "").toLowerCase().replace(/[^a-z0-9äöüß]+/g, "");
let matchList = null, matchN = 0;
function codeMatchers() {
  const n = Object.keys(CATALOG).length;
  if (matchList && matchN === n) return matchList;
  matchN = n;
  matchList = Object.values(CATALOG).filter(b => isCodeBrand(b.id)).flatMap(b => {
    const keys = new Set([nrm(b.name), nrm((b.mark && b.mark.t) || ""), b.grp ? b.grp.slice(2) : "", nrm(b.id)].filter(k => k && k.length >= 3));
    return [...keys].map(k => ({ k, b, pri: (b.rl ? 1 : 0) + (b.region && b.region !== "DE" ? 2 : 0) }));
  }).sort((x, y) => y.k.length - x.k.length || x.pri - y.pri);
  return matchList;
}
const AMT_RE = /(?:^|[\s;,|:\t(])(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|eur|euro)(?=$|[\s;,|)\t])|(?:€|eur)\s*(\d{1,4}(?:[.,]\d{1,2})?)/i;
function parseCodeText(text, def) {
  const groups = new Map(), skipped = [];
  let ctxB = def.brand ? CATALOG[def.brand] : null, ctxA = def.a ? Number(def.a) : null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim(); if (!line || /^(#|\/\/)/.test(line)) continue;
    const am = line.match(AMT_RE), amt = am ? Number((am[1] || am[2]).replace(",", ".")) : null;
    const rest = am ? line.replace(am[0], " ") : line;
    const toks = rest.split(/[\s;,|\t]+/).filter(Boolean);
    const isCode = t => t.length >= 8 && /\d/.test(t) && /^[A-Za-z0-9][A-Za-z0-9-]{6,}[A-Za-z0-9]$/.test(t) && !/^\d{1,4}([.,]\d+)?$/.test(t);
    const cands = toks.filter(isCode).sort((a, b) => b.length - a.length);
    const textPart = nrm(toks.filter(t => !isCode(t)).join(" "));
    let b = null;
    if (textPart.length >= 3) for (const m of codeMatchers()) { if (textPart.includes(m.k) && (!amt || m.b.amts.includes(amt))) { b = m.b; break; } }
    let amt2 = amt;
    if (!amt2) { const bb = b || ctxB; const num = toks.find(t => /^\d{1,4}([.,]\d{1,2})?$/.test(t) && bb && bb.amts.includes(Number(t.replace(",", ".")))); if (num) amt2 = Number(num.replace(",", ".")); }
    if (!cands.length) { if (b) ctxB = b; if (amt2) ctxA = amt2; continue; } // Abschnittsüberschrift
    let code = cands[0];
    const pin = toks.find(t => t !== code && /^\d{4,8}$/.test(t));
    if (pin && /pin/i.test(line)) code = `${code} · PIN ${pin}`;
    const B = b || ctxB, A = amt2 || ctxA;
    if (!B || !A || !B.amts.includes(A)) { skipped.push(line.slice(0, 80)); continue; }
    const k = `${B.id}|${fc(A)}`;
    if (!groups.has(k)) groups.set(k, { brand: B.id, name: B.name, region: B.region || "DE", a: A, label: optLabel(B, A), codes: [] });
    groups.get(k).codes.push(code);
  }
  return { groups: [...groups.values()].map(g => ({ ...g, codes: [...new Set(g.codes)] })), skipped };
}
app.post("/api/admin/codes/parse", admin, express.json({ limit: "2mb" }), (req, res) => {
  const r = parseCodeText(req.body.text, { brand: req.body.brand, a: req.body.a });
  res.json({ groups: r.groups.map(g => ({ ...g, count: g.codes.length, sample: g.codes.slice(0, 3).map(c => c.slice(0, 4) + "…"), codes: undefined })), skipped: r.skipped.slice(0, 50), skippedCount: r.skipped.length });
});
app.post("/api/admin/codes/import-text", admin, express.json({ limit: "2mb" }), (req, res) => {
  const test = !!req.body.test;
  if (test && LIVE) return bad(res, "Im Live-Betrieb können keine Testcodes hochgeladen werden.");
  const r = parseCodeText(req.body.text, { brand: req.body.brand, a: req.body.a });
  if (!r.groups.length) return bad(res, "In der Datei wurden keine zuordenbaren Codes gefunden.");
  let added = 0, dup = 0;
  const out = r.groups.map(g => { const x = addCodes(g.brand, fc(g.a), g.codes.filter(c => c.length <= 200 && (test || !/^TEST-/i.test(c))), test); added += x.added; dup += x.duplicates; return { name: g.name, label: g.label, added: x.added }; });
  res.json({ added, duplicates: dup, groups: out, skipped: r.skipped.length });
});

/* ---------- Admin: Übersicht, Verbindungen und Werkzeuge ---------- */
app.get("/api/admin/overview", admin, wrap(async (req, res) => {
  const day = now() - 864e5, week = now() - 7 * 864e5;
  const sum = (from) => db.prepare("SELECT COUNT(*) n, COALESCE(SUM(total),0) s FROM orders WHERE paid_at>? AND status IN ('processing','delivered')").get(from);
  const st = Object.fromEntries(db.prepare("SELECT status, COUNT(*) n FROM orders GROUP BY status").all().map(r => [r.status, r.n]));
  const cat = shopCatalog();
  res.json({
    mode: LIVE ? "live" : "test", stripe: !!stripe, payMethods: PAY_METHODS, base: BASE,
    reloadly: { on: RL.ON, active: RL_USE, sandbox: RL.SANDBOX, balance: RL.ON ? await RL.balance() : null, imported: db.prepare("SELECT COUNT(*) n FROM rl_catalog").get().n, lastImport: +kvGet("rl_import_v3") || null },
    mail: { on: !!E.RESEND_API_KEY, from: E.MAIL_FROM || null, support: SUPPORT },
    stripeSetup: stripeState,
    orders: { today: sum(day), week: sum(week), processing: st.processing || 0, delivered: st.delivered || 0, refunded: st.refunded || 0 },
    catalog: { products: cat.length, groups: new Set(cat.map(b => b.grp || b.id)).size, stockFree: db.prepare("SELECT COUNT(*) n FROM codes WHERE status='free' AND is_test=0").get().n },
    auto: { on: AUTO, max: AUTO_MAX, day: AUTO_DAY, neverSoldout: NEVER_SOLDOUT }, klarna: KLARNA_INFO()
  });
}));
app.post("/api/admin/klarna", admin, (req, res) => {
  const cats = (Array.isArray(req.body.cats) ? req.body.cats : []).map(String).filter(c => /^[a-z]+$/.test(c));
  kvSet("klarna_cats", cats.length ? cats.join(",") : "-"); pageCache = null; shopCache = null;
  res.json({ klarna: KLARNA_INFO() });
});
/* Echte Zahlungs- und Länderlogos (Iconify, Sets „logos“ und „flag“), einmal geladen und lokal zwischengespeichert */
const MARK_DIR = path.join(DATA, "img", "mark"), markMiss = new Map();
fs.mkdirSync(MARK_DIR, { recursive: true });
app.get("/img/mark/:set/:name", wrap(async (req, res) => {
  const set = String(req.params.set), name = String(req.params.name).replace(/\.svg$/, "");
  if (!["logos", "flag", "si"].includes(set) || !/^[a-z0-9-]{2,40}$/.test(name)) return res.status(404).end();
  /* „si“ = Simple Icons (offizielle Markenzeichen, einfarbig) – für Marken, die im Set „logos“ fehlen, in Markenfarbe */
  const SI_COLOR = { klarna: "0A0B09", amazonpay: "232F3E", bancontact: "005498", eps: "C8036F", sofort: "EF809F", giropay: "000268" };
  const file = path.join(MARK_DIR, `${set}-${name}.svg`), key = set + "/" + name;
  if (markMiss.get(key) > now() - 36e5) return res.status(404).end();
  if (!fs.existsSync(file)) {
    try { const r = await fetch(set === "si" ? `https://api.iconify.design/simple-icons/${name}.svg?height=auto&color=%23${SI_COLOR[name] || "0A0C1A"}` : `https://api.iconify.design/${set}/${name}.svg?height=auto`); const t = r.ok ? await r.text() : ""; if (!/^<svg[\s>]/.test(t) || /<script/i.test(t)) { markMiss.set(key, now()); return res.status(404).end(); } fs.writeFileSync(file, t); }
    catch (e) { markMiss.set(key, now()); return res.status(404).end(); }
  }
  res.set("Cache-Control", "public, max-age=2592000, immutable").type("image/svg+xml").sendFile(file);
}));
/* Spiele-Bilder: beim ersten Aufruf vom offiziellen Shop geladen, danach lokal zwischengespeichert (nicht im Repo) */
const COVER_DIR = path.join(DATA, "img", "cover"), coverMiss = new Map(), coverLoad = new Map();
fs.mkdirSync(COVER_DIR, { recursive: true });
const COVER_HOSTS = /^https:\/\/(shared\.akamai\.steamstatic\.com|shared\.cloudflare\.steamstatic\.com|cdn\.cloudflare\.steamstatic\.com|assets\.nintendo\.com|image\.api\.playstation\.com|www\.minecraft\.net)\//;
const coverKey = u => crypto.createHash("sha1").update(u).digest("hex").slice(0, 24);
app.get("/img/cover/:id/:v", wrap(async (req, res) => {
  const c = COVERS[String(req.params.id)], v = String(req.params.v).replace(/\.jpg$/, "");
  const src = c && /^[plhg]$/.test(v) ? c[v] : null; /* p Hochformat, l Querformat, h Hintergrundbild, g offizielles Spiel-Logo */
  if (!src || !COVER_HOSTS.test(src)) return res.status(404).end();
  const key = coverKey(src), file = path.join(COVER_DIR, key);
  if (!fs.existsSync(file)) {
    if (coverMiss.get(key) > now() - 36e5) return res.status(404).end();
    if (!coverLoad.has(key)) coverLoad.set(key, (async () => {
      const r = await fetch(src, { headers: { "user-agent": "Mozilla/5.0 (instantcodes)" }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 2000 || buf.length > 6e6) throw new Error("Größe");
      fs.writeFileSync(file + ".tmp", buf); fs.renameSync(file + ".tmp", file);
    })().finally(() => coverLoad.delete(key)));
    try { await coverLoad.get(key); } catch (e) { coverMiss.set(key, now()); return res.status(404).end(); }
  }
  const head = Buffer.alloc(12), fd = fs.openSync(file, "r"); fs.readSync(fd, head, 0, 12, 0); fs.closeSync(fd);
  const type = head[0] === 0x89 && head[1] === 0x50 ? "image/png" : head.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : "image/jpeg";
  res.setHeader("Content-Type", type); res.setHeader("Cache-Control", "public, max-age=2592000, immutable"); res.setHeader("Content-Length", fs.statSync(file).size);
  fs.createReadStream(file).on("error", () => res.end()).pipe(res);
}));
/* Apple Pay: Stripes Domain-Verknüpfungsdatei (für alle Stripe-Konten gleich), einmal geladen und zwischengespeichert */
const APPLE_FILE = path.join(DATA, "apple-developer-merchantid-domain-association");
app.get("/.well-known/apple-developer-merchantid-domain-association", wrap(async (req, res) => {
  if (!fs.existsSync(APPLE_FILE)) {
    try { const r = await fetch("https://stripe.com/files/apple-pay/apple-developer-merchantid-domain-association", { signal: AbortSignal.timeout(10000) });
      const t = r.ok ? await r.text() : ""; if (t.length < 100) return res.status(404).end(); fs.writeFileSync(APPLE_FILE, t);
    } catch (e) { return res.status(404).end(); }
  }
  res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.setHeader("Cache-Control", "public, max-age=86400");
  fs.createReadStream(APPLE_FILE).pipe(res);
}));
app.post("/api/admin/testmail", admin, wrap(async (req, res) => {
  if (!E.RESEND_API_KEY) return bad(res, "RESEND_API_KEY fehlt.");
  try { await mail.test(req.user.email); res.json({ ok: true, to: req.user.email }); } catch (e) { bad(res, "Versand fehlgeschlagen: " + e.message); }
}));

const stockTarget = (body) => {
  const b = CATALOG[body.brand], a = Number(body.a);
  if (!b || !isCodeBrand(b.id)) throw new Error("Bitte ein Produkt wählen.");
  if (!b.amts.includes(a)) throw new Error(`Ungültiger Betrag für ${b.name}.`);
  return { b, face: fc(a) };
};

app.post("/api/admin/codes", admin, (req, res) => {
  let t; try { t = stockTarget(req.body); } catch (err) { return bad(res, err.message); }
  const list = [...new Set(String(req.body.codes || "").split(/[\r\n,;]+/).map(c => c.trim()).filter(Boolean))];
  if (!list.length) return bad(res, "Bitte mindestens einen Code eintragen (einer pro Zeile).");
  if (list.length > 2000) return bad(res, "Höchstens 2000 Codes auf einmal.");
  if (list.some(c => c.length > 200)) return bad(res, "Ein Code ist zu lang (höchstens 200 Zeichen).");
  const test = !!req.body.test;
  if (test && LIVE) return bad(res, "Im Live-Betrieb können keine Testcodes hochgeladen werden.");
  if (!test && list.some(c => /^TEST-/i.test(c))) return bad(res, "Codes mit TEST- bitte als Testcodes hochladen.");
  res.json(addCodes(t.b.id, t.face, list, test));
});

app.post("/api/admin/codes/generate", admin, (req, res) => {
  if (!TEST_GEN) return bad(res, "Der Testcode-Generator ist nur im Testmodus verfügbar.", 403);
  let t; try { t = stockTarget(req.body); } catch (err) { return bad(res, err.message); }
  const n = Math.max(1, Math.min(500, parseInt(req.body.count, 10) || 10));
  res.json(addCodes(t.b.id, t.face, Array.from({ length: n }, testCode), true));
});

app.post("/api/admin/codes/purge-test", admin, (req, res) => {
  res.json({ removed: db.prepare("DELETE FROM codes WHERE is_test=1 AND status='free'").run().changes });
});

app.post("/api/admin/orders/:id/refund", admin, wrap(async (req, res) => {
  const o = orderFull(String(req.params.id));
  if (!o) return bad(res, "Bestellung nicht gefunden.", 404);
  if (!["processing", "payment_pending"].includes(o.status) || !o.payment_intent) return bad(res, "Diese Bestellung kann nicht erstattet werden.");
  await stripe.refunds.create({ payment_intent: o.payment_intent });
  db.prepare("UPDATE orders SET status='refunded', note=? WHERE id=?").run(String(req.body.reason || "").slice(0, 500), o.id);
  safe(mail.refunded(orderFull(o.id), String(req.body.reason || "")));
  res.json({ ok: true });
}));

/* ---------- Admin: Produkte ---------- */
app.get("/api/admin/products", admin, (req, res) => {
  const rows = prodRows();
  res.json({ products: Object.values(CATALOG).filter(b => !b.rl).map(b => { const r = rows[b.id] || {};
    return { id: b.id, name: b.name, cat: b.cat, type: b.type, amts: b.amts, labels: b.labels, bg: b.bg, fg: b.fg, mark: b.mark, plat: b.plat,
      active: r.active !== 0, img: r.img ? `/img/p/${b.id}.${r.img}?v=${r.img_v}` : null, logo: r.logo ? `/img/p/${b.id}.logo.${r.logo}?v=${r.logo_v}` : null }; }) });
});
app.post("/api/admin/products/:id", admin, (req, res) => {
  const id = String(req.params.id);
  if (!CATALOG[id]) return bad(res, "Produkt nicht gefunden.", 404);
  db.prepare("INSERT INTO products(id,active) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET active=excluded.active").run(id, req.body.active ? 1 : 0);
  prodCache = null; pageCache = null;
  res.json({ ok: true });
});
const IMG_TYPES = { png: b => b[0] === 0x89 && b[1] === 0x50, jpg: b => b[0] === 0xFF && b[1] === 0xD8, webp: b => b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP" };
app.post("/api/admin/products/:id/image", admin, express.raw({ type: () => true, limit: "4mb" }), (req, res) => {
  const id = String(req.params.id);
  if (!CATALOG[id]) return bad(res, "Produkt nicht gefunden.", 404);
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length < 16) return bad(res, "Bitte eine Bilddatei hochladen.");
  if (buf.length > 4 * 1024 * 1024) return bad(res, "Das Bild ist zu groß (höchstens 4 MB).");
  const ext = Object.keys(IMG_TYPES).find(k => IMG_TYPES[k](buf));
  if (!ext) return bad(res, "Erlaubt sind PNG, JPG und WebP.");
  for (const k of Object.keys(IMG_TYPES)) { try { fs.unlinkSync(path.join(IMG_DIR, `${id}.${k}`)); } catch (e) {} }
  fs.writeFileSync(path.join(IMG_DIR, `${id}.${ext}`), buf);
  const v = now();
  db.prepare("INSERT INTO products(id,img,img_v) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET img=excluded.img, img_v=excluded.img_v").run(id, ext, v);
  prodCache = null; pageCache = null;
  res.json({ ok: true, img: `/img/p/${id}.${ext}?v=${v}` });
});
app.delete("/api/admin/products/:id/image", admin, (req, res) => {
  const id = String(req.params.id);
  for (const k of Object.keys(IMG_TYPES)) { try { fs.unlinkSync(path.join(IMG_DIR, `${id}.${k}`)); } catch (e) {} }
  db.prepare("UPDATE products SET img=NULL, img_v=NULL WHERE id=?").run(id);
  prodCache = null; pageCache = null;
  res.json({ ok: true });
});
const readImg = (req, res) => {
  const buf = req.body;
  if (!Buffer.isBuffer(buf) || buf.length < 16) { bad(res, "Bitte eine Bilddatei hochladen."); return null; }
  if (buf.length > 4 * 1024 * 1024) { bad(res, "Das Bild ist zu groß (höchstens 4 MB)."); return null; }
  const ext = Object.keys(IMG_TYPES).find(k => IMG_TYPES[k](buf));
  if (!ext) { bad(res, "Erlaubt sind PNG, JPG und WebP (für Logos am besten PNG mit transparentem Hintergrund)."); return null; }
  return { buf, ext };
};
/* Markenlogo pro Produkt (ersetzt den Schriftzug auf der Karte, Farben bleiben) */
app.post("/api/admin/products/:id/logo", admin, express.raw({ type: () => true, limit: "4mb" }), (req, res) => {
  const id = String(req.params.id);
  if (!CATALOG[id]) return bad(res, "Produkt nicht gefunden.", 404);
  const f = readImg(req, res); if (!f) return;
  for (const k of Object.keys(IMG_TYPES)) { try { fs.unlinkSync(path.join(IMG_DIR, `${id}.logo.${k}`)); } catch (e) {} }
  fs.writeFileSync(path.join(IMG_DIR, `${id}.logo.${f.ext}`), f.buf);
  const v = now();
  db.prepare("INSERT INTO products(id,logo,logo_v) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET logo=excluded.logo, logo_v=excluded.logo_v").run(id, f.ext, v);
  prodCache = null;
  res.json({ ok: true, logo: `/img/p/${id}.logo.${f.ext}?v=${v}` });
});
app.delete("/api/admin/products/:id/logo", admin, (req, res) => {
  const id = String(req.params.id);
  for (const k of Object.keys(IMG_TYPES)) { try { fs.unlinkSync(path.join(IMG_DIR, `${id}.logo.${k}`)); } catch (e) {} }
  db.prepare("UPDATE products SET logo=NULL, logo_v=NULL WHERE id=?").run(id);
  prodCache = null;
  res.json({ ok: true });
});
/* Offizielle Zahlungslogos (Apple Pay, Visa …) – lädst du aus den Markenportalen der Anbieter hoch */
const PAY_LOGO_KEYS = ["apple_pay", "google_pay", "paypal", "revolut_pay", "amazon_pay", "link", "visa", "mastercard", "amex", "eps", "bancontact", "klarna", "crypto"];
const PAY_DIR = path.join(IMG_DIR, "pay");
fs.mkdirSync(PAY_DIR, { recursive: true });
let payLogoCache = null;
const payLogos = () => payLogoCache || (payLogoCache = Object.fromEntries(fs.readdirSync(PAY_DIR).map(f => f.match(/^([a-z_]+)\.(png|jpg|webp)$/)).filter(m => m && PAY_LOGO_KEYS.includes(m[1]))
  .map(m => [m[1], `/img/pay/${m[0]}?v=${Math.round(fs.statSync(path.join(PAY_DIR, m[0])).mtimeMs)}`])));
app.get("/api/admin/paylogos", admin, (req, res) => res.json({ keys: PAY_LOGO_KEYS, logos: payLogos() }));
app.post("/api/admin/paylogos/:key", admin, express.raw({ type: () => true, limit: "4mb" }), (req, res) => {
  const key = String(req.params.key); if (!PAY_LOGO_KEYS.includes(key)) return bad(res, "Unbekannte Zahlungsart.", 404);
  const f = readImg(req, res); if (!f) return;
  for (const k of Object.keys(IMG_TYPES)) { try { fs.unlinkSync(path.join(PAY_DIR, `${key}.${k}`)); } catch (e) {} }
  fs.writeFileSync(path.join(PAY_DIR, `${key}.${f.ext}`), f.buf); payLogoCache = null;
  res.json({ ok: true, logos: payLogos() });
});
app.delete("/api/admin/paylogos/:key", admin, (req, res) => {
  const key = String(req.params.key); if (!PAY_LOGO_KEYS.includes(key)) return bad(res, "Unbekannte Zahlungsart.", 404);
  for (const k of Object.keys(IMG_TYPES)) { try { fs.unlinkSync(path.join(PAY_DIR, `${key}.${k}`)); } catch (e) {} }
  payLogoCache = null; res.json({ ok: true, logos: payLogos() });
});
app.get("/img/pay/:file", (req, res) => {
  const m = String(req.params.file).match(/^([a-z_]+)\.(png|jpg|webp)$/);
  if (!m || !PAY_LOGO_KEYS.includes(m[1])) return res.status(404).end();
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(path.join(PAY_DIR, m[0]));
});
app.get("/img/p/:file", (req, res) => {
  const m = String(req.params.file).match(/^([\w-]+)(\.logo)?\.(png|jpg|webp)$/);
  if (!m) return res.status(404).end();
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(path.join(IMG_DIR, m[0]));
});

/* ---------- Admin: Bewertungen ---------- */
app.get("/api/admin/reviews", admin, (req, res) => {
  res.json({ reviews: db.prepare("SELECT r.id, r.order_id, r.email, r.name, r.rating, r.text, r.brands, r.hidden, r.created_at, (SELECT group_concat(DISTINCT i.brand) FROM items i WHERE i.order_id=r.order_id) ids FROM reviews r ORDER BY r.created_at DESC LIMIT 300").all()
    .map(r => ({ ...r, brands: JSON.parse(r.brands || "[]"), ids: String(r.ids || "").split(",").filter(Boolean), hidden: !!r.hidden })),
    trustpilot: TP ? { url: TP.url, widget: TP.widget } : null });
});
app.post("/api/admin/reviews/:id", admin, (req, res) => {
  db.prepare("UPDATE reviews SET hidden=? WHERE id=?").run(req.body.hidden ? 1 : 0, Number(req.params.id));
  res.json({ ok: true });
});

/* ---------- Abos (abo.js): Pläne, Stripe-Abos, monatliche Lieferungen mit Freigabe, Kündigung nach § 312k BGB ---------- */
/* Kartendaten eines Produkts für die Abo-Seite (auch für Produkte, die im Shop gerade nicht sichtbar sind) */
const cardOf = id => { const b = CATALOG[id]; if (!b) return null; const r = prodRows()[id] || {}; const { redeem, brand, px, ...x } = b;
  if (r.img) x.img = `/img/p/${id}.${r.img}?v=${r.img_v}`; if (r.logo) x.logo = `/img/p/${id}.logo.${r.logo}?v=${r.logo_v}`; else brandLogo(x); return x; };
ABO = require("./abo")({ app, db, stripe, stripeCall, STRIPE_V, mail, CATALOG, E, BASE, ADMINS, TESTMODE, TEST_GEN, clock, now, rnd, enc, dec, norm, emailOk, bad, wrap, need, admin, rateLimit,
  verifiedEmail, EV_MSG, isAdmin, safe, takeCodes, codeHash, supply, Stockout, RL_USE: () => RL_USE, rlHas, freeCount, optLabel, fc, isCodeBrand, cardOf, kvGet, kvSet });
/* Mia, KI-Shopberaterin (ai.js): Chat mit Claude und Werkzeugen, Fallback ohne Schlüssel, Status im Admin */
require("./ai")({ app, E, PROD, bad, admin, kvGet, kvSet, shopCatalog, unitPrice, optLabel, FEE, SUPPORT, PROMOS, payWords: () => payWords(), abo: () => ABO });

/* Rückkehr nach Zahlungen mit Weiterleitung (z. B. PayPal, Klarna) */
app.get("/r/:id", (req, res) => res.redirect(302, `/bestellung/${encodeURIComponent(req.params.id)}?k=${encodeURIComponent(String(req.query.k || ""))}`));

/* ---------- Seiten ---------- */
/* Startseite: Katalog, Einstellungen und Bestand direkt mitliefern (spart Ladezeit) */
let pageCache = null, pageOut = null, bootCache = null;
/* Für den Browser nur die nötigen Felder (spart bei ~2.300 Produkten etwa die Hälfte der Seitengröße) */
const slim = b => { if (!b.rl) return b; const { bg, fg, mark, disc, regionName, ...x } = b; return x; };
/* Seite aus web/ zusammensetzen: Gerüst + alle CSS- und JS-Dateien in Dateinamen-Reihenfolge.
   Im Live-Betrieb einmal beim Start, sonst neu, sobald sich eine Datei ändert. */
const WEB = path.join(__dirname, "web");
const webFiles = () => {
  const ls = ext => fs.readdirSync(path.join(WEB, ext)).filter(f => f.endsWith("." + ext)).sort().map(f => path.join(WEB, ext, f));
  return { shell: path.join(WEB, "index.html"), css: ls("css"), js: ls("js") };
};
let webChecked = 0;
const buildPage = () => {
  if (pageCache && (PROD || Date.now() - webChecked < 800)) return pageCache;
  webChecked = Date.now();
  const f = webFiles(), all = [f.shell, ...f.css, ...f.js];
  const stamp = all.map(p => p + ":" + fs.statSync(p).mtimeMs).join("|");
  if (pageCache && pageCache.stamp === stamp) return pageCache;
  const read = p => fs.readFileSync(p, "utf8");
  const css = f.css.map(read).join("\n"), js = f.js.map(read).join("\n");
  pageCache = { stamp, mtime: Date.now(), html: read(f.shell).replace(/https:\/\/www\.instacode\.store/g, BASE).replace("/*@CSS*/", () => css).replace("/*@JS*/", () => js) };
  return pageCache;
};
const sendIndex = (req, res) => {
  buildPage();
  const cat = shopCatalog(), cfg = JSON.stringify(publicConfig()), so = JSON.stringify(soldoutMap());
  if (!bootCache || bootCache.cat !== cat || bootCache.cfg !== cfg || bootCache.so !== so)
    bootCache = { cat, cfg, so, data: JSON.stringify({ products: cat.map(slim), config: JSON.parse(cfg), stock: { soldout: JSON.parse(so) } }).replace(/</g, "\\u003c") };
  const data = bootCache.data;
  /* fertige Seite komprimiert zwischenspeichern (ca. 260 KB → 50 KB), neu nur wenn sich Seite, Katalog oder Bestand ändert */
  if (!pageOut || pageOut.data !== data || pageOut.mtime !== pageCache.mtime) {
    let html = pageCache.html.replace('<script type="application/json" id="boot"></script>', `<script type="application/json" id="boot">${data}</script>`);
    const gsv = String(E.GOOGLE_SITE_VERIFICATION || "").replace(/[^\w-]/g, "");
    if (gsv) html = html.replace("<head>", `<head>\n<meta name="google-site-verification" content="${gsv}">`);
    const raw = Buffer.from(html);
    pageOut = { data, mtime: pageCache.mtime, raw, br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }), gz: zlib.gzipSync(raw, { level: 6 }) };
  }
  const ae = String(req.get("accept-encoding") || "");
  res.set("Cache-Control", "no-cache").set("Vary", "Accept-Encoding").type("html");
  if (/\bbr\b/.test(ae)) return res.set("Content-Encoding", "br").send(pageOut.br);
  if (/\bgzip\b/.test(ae)) return res.set("Content-Encoding", "gzip").send(pageOut.gz);
  res.send(pageOut.raw);
};
app.get(["/", "/index.html"], sendIndex);

/* ---------- SEO: eigene Adressen pro Produkt/Kategorie mit Titel, Beschreibung und strukturierten Daten ---------- */
const CAT_SEO = {
  topup: ["Handy aufladen", "Handy online aufladen: Prepaid-Guthaben für Vodafone, Telekom, o2, Lebara, Lycamobile und mehr. Nummer eingeben, Betrag wählen, sofort gebucht – auch ins Ausland."],
  gaming: ["Gaming-Guthaben", "Steam Guthaben, PlayStation Store Karte (PSN), Xbox Guthaben und Nintendo eShop Karte online kaufen. Code sofort per E-Mail, direkt einlösbar."],
  currency: ["Spielwährungen", "V-Bucks, Robux, Valorant Points, FC Points und mehr online kaufen. Sicher bezahlen, Code in Sekunden per E-Mail."],
  subs: ["Abos und Mitgliedschaften", "Xbox Game Pass, PlayStation Plus, Nintendo Switch Online und EA Play als Code kaufen – Laufzeit wählen, sofort per E-Mail."],
  apps: ["App-Store-Guthaben", "Apple Gift Card und Google Play Guthaben online kaufen: für Apps, Spiele, Filme, Musik und iCloud. Code sofort per E-Mail."],
  entertainment: ["Streaming und Musik", "Netflix, Spotify, Disney+ und DAZN Geschenkkarten online kaufen. Ideal als Geschenk, Code sofort per E-Mail."],
  shopping: ["Shopping-Gutscheine", "Amazon, Zalando, IKEA, MediaMarkt, Lieferando, Douglas und mehr: Geschenkkarten digital kaufen und sofort per E-Mail verschenken."],
  software: ["Software", "Software-Lizenzen für Office, Antivirus und VPN als Code kaufen – sofort per E-Mail."],
  payment: ["Prepaid-Karten", "paysafecard und weitere Prepaid-Bezahlkarten online kaufen. Anonym online bezahlen, Code sofort per E-Mail."],
  keys: ["Spiele-Keys", "Spiele-Keys für PC, PlayStation, Xbox und Nintendo Switch online kaufen. Key sofort per E-Mail, direkt aktivieren."] };
const PAY_NAMES = { apple_pay: "Apple Pay", google_pay: "Google Pay", paypal: "PayPal", revolut_pay: "Revolut Pay", amazon_pay: "Amazon Pay", link: "Link", card: "Karte", eps: "eps", bancontact: "Bancontact", crypto: "Krypto (Stablecoins)" };
const payWords = () => { const l = PAY_METHODS.map(m => PAY_NAMES[m]).filter(Boolean); return l.length > 1 ? l.slice(0, -1).join(", ") + " oder " + l[l.length - 1] : (l[0] || "Karte"); };
/* Suchbegriff pro Kategorie: so wie Leute bei Google tippen („Steam Guthaben kaufen“, „Amazon Gutschein kaufen“) */
const KW = { topup: "aufladen", gaming: "Guthaben kaufen", currency: "kaufen", subs: "kaufen", apps: "Guthaben kaufen", entertainment: "Geschenkkarte kaufen",
  shopping: "Gutschein kaufen", software: "Lizenz kaufen", payment: "kaufen", keys: "Key kaufen" };
const CAT_NAME = { topup: "Handy aufladen", gaming: "Gaming-Guthaben", currency: "Spielwährungen", subs: "Abos", apps: "App Stores", entertainment: "Streaming & Musik", shopping: "Shopping & Essen", software: "Software", payment: "Prepaid-Karten", keys: "Spiele-Keys" };
const kwFor = b => b.cat === "topup" ? "aufladen" : /gutschein|guthaben|gift ?card|geschenkkarte|points|credits|v-bucks|robux|karte\b|pass\b|plus\b|online\b|play\b/i.test(b.name) ? "kaufen" : (KW[b.cat] || "kaufen");
function seoTitle(b) {
  const head = `${b.name} ${kwFor(b)}`;
  const tail = b.cat === "topup" ? " – Guthaben online" : " – Code sofort per E-Mail";
  return (head + tail + " | instantcodes").length <= 66 ? head + tail + " | instantcodes" : (head + " | instantcodes").length <= 66 ? head + " | instantcodes" : head;
}
const crumbs = l => ({ "@type": "BreadcrumbList", itemListElement: l.map(([n, u], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: BASE + u })) });
const xesc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const seoCache = new Map();
/* Echte Bewertungen eines Produkts (alle Länder-Varianten, wie auf der Produktseite) für aggregateRating; ohne Bewertungen null. 5 Minuten zwischengespeichert. */
const ratingCache = new Map();
function ratingOf(b) {
  const cat = shopCatalog(), g = (cat.find(x => x.id === b.id) || {}).grp, ids = (g ? cat.filter(x => x.grp === g).map(x => x.id) : [b.id]).sort().slice(0, 40), key = ids.join(",");
  const hit = ratingCache.get(key); if (hit && hit.t > Date.now() - 300e3) return hit.r;
  const row = db.prepare(`SELECT COUNT(*) n, AVG(r.rating) avg FROM reviews r WHERE r.hidden=0 AND EXISTS (SELECT 1 FROM items i WHERE i.order_id=r.order_id AND i.brand IN (${ids.map(() => "?").join(",")}))`).get(...ids);
  const r = row && row.n ? { "@type": "AggregateRating", ratingValue: Math.round(row.avg * 10) / 10, reviewCount: row.n, bestRating: 5, worstRating: 1 } : null;
  if (ratingCache.size > 2000) ratingCache.clear(); ratingCache.set(key, { t: Date.now(), r }); return r;
}
function seoMeta(p) {
  let m;
  if ((m = p.match(/^\/marke\/([\w-]+)$/))) {
    const b = CATALOG[m[1]]; if (!b || !isActive(b.id)) return null;
    const img =b.img ? (/^https?:/.test(b.img) ? b.img : BASE + b.img) : `${BASE}/og.png`;
    const t = seoTitle(b), euro = x => String(x).replace(".", ",") + " €";
    const amts = b.labels || b.amts.map(euro), shown = amts.length > 6 ? amts.slice(0, 6).join(", ") + " und mehr" : amts.join(", ");
    const lead = `${b.name} ${kwFor(b).replace(/(aufladen|kaufen)$/, "online $1")}: ${shown}.`, pay = `Sicher bezahlen mit ${payWords()}`;
    const tailD = b.cat === "topup" ? " Guthaben wird direkt auf die Nummer gebucht." : " Code in Sekunden per E-Mail.";
    let d = lead + tailD;
    for (const extra of [b.regionName && b.cat !== "topup" ? ` Gültig in ${b.regionName}.` : "", ` ${pay}.`, b.cat === "topup" ? "" : " Ohne Versandkosten."])
      if (extra && (d + extra).length <= 158) d += extra;
    /* Strukturierte Daten nur mit echten Werten: Preise der lieferbaren Beträge, Verfügbarkeit aus dem Bestand, Sterne nur bei echten Bewertungen */
    const so = soldoutMap()[b.id] || [], avail = b.amts.filter(a => !so.includes(a)), pl = (avail.length ? avail : b.amts).map(a => unitPrice(b, a));
    const offer = { "@type": "AggregateOffer", priceCurrency: "EUR", lowPrice: Math.min(...pl) / 100, highPrice: Math.max(...pl) / 100, offerCount: avail.length || b.amts.length,
      availability: avail.length ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${BASE}/marke/${b.id}`, seller: { "@type": "Organization", name: "instantcodes" } };
    const rating = ratingOf(b);
    const ld = { "@context": "https://schema.org", "@graph": [
      { "@type": "Product", name: b.name, image: img, description: d, category: CAT_NAME[b.cat] || "Gutscheine", brand: { "@type": "Brand", name: b.brand || b.name }, sku: b.id, offers: offer, ...(rating ? { aggregateRating: rating } : {}) },
      crumbs([["Start", "/"], [CAT_NAME[b.cat] || "Kategorien", `/kategorie/${b.cat}`], [b.name, `/marke/${b.id}`]]) ] };
    return { t, d, img, ld, h1: b.name, url: `${BASE}/marke/${b.id}` };
  }
  if ((m = p.match(/^\/kategorie\/([\w-]+)$/)) && CAT_SEO[m[1]]) {
    const id = m[1], [n, d] = CAT_SEO[id], url = `${BASE}/kategorie/${id}`;
    const items = shopCatalog().filter(b => b.cat === id && !b.rl).slice(0, 40);
    const ld = { "@context": "https://schema.org", "@graph": [
      { "@type": "CollectionPage", name: n, description: d, url, inLanguage: "de-DE", mainEntity: { "@type": "ItemList", itemListElement: items.map((b, i) => ({ "@type": "ListItem", position: i + 1, name: b.name, url: `${BASE}/marke/${b.id}` })) } },
      crumbs([["Start", "/"], ["Kategorien", "/kategorien"], [n, `/kategorie/${id}`]]) ] };
    return { t: id === "topup" ? "Handy aufladen – Prepaid-Guthaben online | instantcodes" : `${n} online kaufen – sofort per E-Mail | instantcodes`, d, h1: n, url, ld };
  }
  const P = { "/kategorien": ["Gutscheine & Geschenkkarten – alle Kategorien", "Alle Gutscheine, Geschenkkarten, Guthabenkarten, Spiele-Keys und Handy-Guthaben bei instantcodes im Überblick – digital und sofort per E-Mail."], "/aufladen": ["Handy aufladen – Prepaid-Guthaben online", CAT_SEO.topup[1]], "/angebote": ["Gutschein-Angebote", "Reduzierte Gutscheine, Geschenkkarten und Guthabenkarten bei instantcodes – Code sofort per E-Mail."],
    "/hilfe": ["Hilfe und FAQ", "Antworten zu Bestellung, Lieferung, Einlösen, Zahlung und Rechnung bei instantcodes – schnell und verständlich erklärt."],
    "/abo": ["Abo: jeden Monat Codes für Netflix, Disney+, Spotify und mehr", "Das instantcodes Abo: jeden Monat Codes für Netflix, Disney+, Spotify, DAZN, Xbox Game Pass und mehr. Pro, Premium oder Max – online kündbar."],
    "/kuendigen": ["Verträge hier kündigen", "Kündige dein instantcodes Abo ohne Anmeldung. Die Bestätigung bekommst du sofort auf dem Bildschirm und per E-Mail."], "/agb": ["AGB", "Allgemeine Geschäftsbedingungen von instantcodes."], "/datenschutz": ["Datenschutz", "Datenschutzerklärung von instantcodes."], "/widerruf": ["Widerrufsbelehrung", "Widerrufsbelehrung für digitale Inhalte bei instantcodes."] }[p];
  return P ? { t: `${P[0]} | instantcodes`, d: P[1], h1: P[0], url: BASE + p } : null;
}
function sendSeo(req, res, next) {
  const meta = seoMeta(req.path); if (!meta) return next();
  sendIndex({ get: () => "" }, { set() { return this; }, type() { return this; }, send(raw) {
    const key = req.path + "|" + pageOut.mtime + "|" + pageOut.data.length + "|" + (meta.ld ? crypto.createHash("sha1").update(JSON.stringify(meta.ld)).digest("base64url").slice(0, 12) : "");
    let out = seoCache.get(key);
    if (!out) {
      let h = pageOut.raw.toString("utf8")
        .replace(/<title>[^<]*<\/title>/, `<title>${xesc(meta.t)}</title>`)
        .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${xesc(meta.d)}">`)
        .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${meta.url}">`)
        .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${xesc(meta.t)}">`)
        .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${xesc(meta.d)}">`)
        .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${meta.url}">`);
      if (meta.img) h = h.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${meta.img}">`);
      if (meta.ld) h = h.replace("</head>", `<script type="application/ld+json">${JSON.stringify(meta.ld).replace(/</g, "\\u003c")}</script></head>`);
      h = h.replace('<main', `<noscript><h1>${xesc(meta.h1)}</h1><p>${xesc(meta.d)}</p></noscript><main`);
      const raw = Buffer.from(h); out = { raw, br: zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }), gz: zlib.gzipSync(raw) };
      if (seoCache.size > 600) seoCache.clear(); seoCache.set(key, out);
    }
    const ae = String(req.get("accept-encoding") || "");
    res.set("Cache-Control", "no-cache").set("Vary", "Accept-Encoding").type("html");
    if (/\bbr\b/.test(ae)) return res.set("Content-Encoding", "br").send(out.br);
    if (/\bgzip\b/.test(ae)) return res.set("Content-Encoding", "gzip").send(out.gz);
    res.send(out.raw);
  } });
}
app.get(["/marke/:id", "/kategorie/:id", "/kategorien", "/aufladen", "/angebote", "/hilfe", "/agb", "/datenschutz", "/widerruf", "/abo", "/kuendigen"], sendSeo);
app.get("/abmelden", (req, res) => {
  const e = norm(req.query.e), ok = e && req.query.s === unsubSig(e);
  if (ok) db.prepare("INSERT OR IGNORE INTO optout(email,at) VALUES(?,?)").run(e, now());
  res.set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex, nofollow").type("html").send(nlPage(ok ? "Du bist abgemeldet" : "Link ungültig",
    ok ? "Du bekommst keine Produktempfehlungen mehr. Bestell- und Lieferbestätigungen erhältst du weiterhin." : "Bitte nutze den Link aus deiner E-Mail.", `<a class="b" href="${BASE}/">Zum Shop</a>`));
});

/* ---------- Newsletter (Double-Opt-in), Einwilligungen, Bewertungsanfragen, Admin-Mailvorschau ----------
   UWG § 7 Abs. 2 Nr. 2 und DSGVO Art. 6 Abs. 1 lit. a, Art. 7 Abs. 1 (Nachweis der Einwilligung):
   - Anmeldung (Fußzeile, Konto) speichert Zeitpunkt, IP-Hash (HMAC, keine Klar-IP) und Quelle; eingetragen ist man erst nach
     dem Klick auf den Bestätigungslink (Zeitpunkt + IP-Hash der Bestätigung). Alle Schritte stehen zusätzlich in newsletter_log.
   - Jede Werbemail hat einen Abmeldelink und die Kopfzeilen List-Unsubscribe + List-Unsubscribe-Post (RFC 8058). Abmeldung wirkt sofort.
   - Bewertungsanfrage nur mit ausdrücklicher Einwilligung (Konto oder Bestellseite), einmal pro Bestellung, REVIEW_DELAY_H Stunden
     nach der Lieferung (Standard 72). REVIEW_MAILS=0 schaltet sie ab. Einwilligungen und Widerrufe stehen in consent_log.
   - Keine Warenkorb-Erinnerungen: dafür gibt es keine Einwilligung. */
db.exec(`CREATE TABLE IF NOT EXISTS newsletter(email TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending', source TEXT, created_at INTEGER, ip_hash TEXT,
  token_hash TEXT, token_exp INTEGER, sent_at INTEGER, confirmed_at INTEGER, confirm_ip_hash TEXT, unsub_at INTEGER, unsub_via TEXT);
CREATE INDEX IF NOT EXISTS ix_newsletter_status ON newsletter(status);
CREATE INDEX IF NOT EXISTS ix_newsletter_token ON newsletter(token_hash);
CREATE TABLE IF NOT EXISTS newsletter_log(id INTEGER PRIMARY KEY, email TEXT NOT NULL, event TEXT NOT NULL, at INTEGER NOT NULL, ip_hash TEXT, source TEXT, detail TEXT);
CREATE INDEX IF NOT EXISTS ix_newsletter_log ON newsletter_log(email, at);
CREATE TABLE IF NOT EXISTS campaigns(id INTEGER PRIMARY KEY, subject TEXT, data TEXT, created_at INTEGER, finished_at INTEGER, recipients INTEGER, sent INTEGER DEFAULT 0, failed INTEGER DEFAULT 0, by TEXT);
CREATE TABLE IF NOT EXISTS consent_log(id INTEGER PRIMARY KEY, email TEXT, kind TEXT, granted INTEGER, source TEXT, order_id TEXT, at INTEGER, ip_hash TEXT);`);
if (!db.prepare("PRAGMA table_info(orders)").all().some(c => c.name === "review_ok_at")) db.exec("ALTER TABLE orders ADD COLUMN review_ok_at INTEGER");
if (!db.prepare("PRAGMA table_info(orders)").all().some(c => c.name === "review_asked_at")) db.exec("ALTER TABLE orders ADD COLUMN review_asked_at INTEGER");
if (!db.prepare("PRAGMA table_info(users)").all().some(c => c.name === "review_ok_at")) db.exec("ALTER TABLE users ADD COLUMN review_ok_at INTEGER");

const nlEsc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/* Kleine Seite im Markenauftritt (Bestätigung, Abmeldung) */
const nlPage = (title, text, extra = "") => `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${nlEsc(title)} · instantcodes</title><link rel="icon" href="/favicon.png"><style>
@font-face{font-family:Geist;src:url(/fonts/geist.woff2) format("woff2");font-weight:100 900;font-display:swap}
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#F3F4F6;color:#0E1014;font:16px/1.6 Geist,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:24px 16px}
.c{width:100%;max-width:440px;background:#fff;border-radius:24px;box-shadow:inset 0 0 0 1px rgba(14,16,20,.08),0 24px 60px -30px rgba(14,16,20,.28);padding:36px 28px 28px;text-align:center;position:relative;overflow:hidden}
.c::before{content:"";position:absolute;inset:0 0 auto;height:4px;background:linear-gradient(115deg,#FFD7EB 0%,#DCE3FF 34%,#C8F5EA 66%,#F0DDFF 100%)}
.l{display:inline-flex;align-items:center;gap:9px;text-decoration:none;color:#0E1014;font-size:22px;letter-spacing:-.04em;margin-bottom:22px}.l img{width:34px;height:34px}.l b{font-weight:640}.l span{font-weight:300}
h1{font-size:24px;line-height:1.25;font-weight:520;letter-spacing:-.02em;margin:0 0 10px}p{margin:0 0 22px;color:#474D59}form{margin:0}
.b{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 26px;border-radius:999px;border:0;background:#0E1014;color:#fff;font:inherit;font-size:15px;font-weight:500;text-decoration:none;cursor:pointer}
.b:focus-visible,a:focus-visible{outline:2px solid #7D5CF0;outline-offset:3px}.s{font-size:13px;color:#656B78;margin:22px 0 0}.s a{color:#6A4FE0}</style></head>
<body><main class="c"><a class="l" href="/" aria-label="instantcodes Startseite"><img src="/mail/logo-ring.png" alt=""><span><b>instant</b>codes</span></a><h1>${nlEsc(title)}</h1><p>${text}</p>${extra}
<p class="s">Fragen? <a href="mailto:${nlEsc(SUPPORT)}">${nlEsc(SUPPORT)}</a> · <a href="https://mein.online-impressum.de/instacode/">Impressum</a> · <a href="/datenschutz">Datenschutz</a></p></main></body></html>`;
const nlPageSend = (res, code, ...a) => res.status(code).set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex, nofollow").set("Referrer-Policy", "no-referrer").type("html").send(nlPage(...a));
/* IP nur als HMAC-Hash (pseudonym), reicht als Nachweis zusammen mit Zeitpunkt und Quelle */
const ipHash = req => crypto.createHmac("sha256", KEY).update("ip|" + String((req && req.ip) || "")).digest("hex").slice(0, 32);
const nlSig = (k, e) => crypto.createHmac("sha256", KEY).update(`nl|${k}|${e}`).digest("base64url").slice(0, 24);
/* Abmeldelink: k=news (Newsletter) oder k=review (Bewertungsanfragen) */
const nlUnsub = (e, k = "news") => `${BASE}/newsletter/abmelden?e=${encodeURIComponent(norm(e))}&k=${k}&s=${nlSig(k, norm(e))}`;
const nlLog = (e, event, req, source, detail) => db.prepare("INSERT INTO newsletter_log(email,event,at,ip_hash,source,detail) VALUES(?,?,?,?,?,?)").run(e, event, now(), req ? ipHash(req) : null, source || null, detail || null);
const consentLog = (e, kind, granted, source, orderId, req) => db.prepare("INSERT INTO consent_log(email,kind,granted,source,order_id,at,ip_hash) VALUES(?,?,?,?,?,?,?)").run(e, kind, granted ? 1 : 0, source, orderId || null, now(), req ? ipHash(req) : null);
const maskMail = e => String(e).replace(/^(.{1,2})[^@]*(@.*)$/, "$1…$2");
const NL_SRC = ["fusszeile", "konto"], NL_TTL = 7 * 864e5;
const NL_MSG = "Fast geschafft! Wir haben dir eine E-Mail geschickt. Bitte bestätige darin deine Anmeldung – erst dann bist du eingetragen.";
const nlLim = rateLimit({ windowMs: 15 * 60e3, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: "Zu viele Versuche. Bitte warte ein paar Minuten." } });

/* Anmeldung: immer dieselbe Antwort (niemand kann testen, wer schon angemeldet ist); höchstens eine Bestätigungsmail pro 10 Minuten */
app.post("/api/newsletter", nlLim, wrap(async (req, res) => {
  const e = norm(req.body.email), src = NL_SRC.includes(req.body.source) ? req.body.source : "fusszeile";
  if (!emailOk(e) || /@sms\.instacode\.store$/.test(e)) return bad(res, "Bitte gib eine gültige E-Mail-Adresse ein.");
  const r = db.prepare("SELECT * FROM newsletter WHERE email=?").get(e);
  if (r && (r.status === "active" || (r.status === "pending" && r.sent_at > now() - 10 * 60e3 && r.token_exp > now()))) return res.json({ ok: true, msg: NL_MSG });
  const t = rnd(24);
  db.prepare(`INSERT INTO newsletter(email,status,source,created_at,ip_hash,token_hash,token_exp,sent_at) VALUES(?,'pending',?,?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET status='pending', source=excluded.source, created_at=excluded.created_at, ip_hash=excluded.ip_hash,
      token_hash=excluded.token_hash, token_exp=excluded.token_exp, sent_at=excluded.sent_at, confirmed_at=NULL, confirm_ip_hash=NULL`)
    .run(e, src, now(), ipHash(req), sha(t), now() + NL_TTL, now());
  nlLog(e, "anmeldung", req, src);
  await mail.newsletterConfirm(e, `${BASE}/newsletter/bestaetigen?t=${t}`);
  res.json({ ok: true, msg: NL_MSG });
}));
/* Bestätigung in zwei Schritten (Seite mit Knopf → POST), damit Link-Scanner von Mailprogrammen niemanden versehentlich eintragen */
const nlByToken = t => t ? db.prepare("SELECT * FROM newsletter WHERE token_hash=?").get(sha(t)) : null;
app.get("/newsletter/bestaetigen", (req, res) => {
  const t = String(req.query.t || ""), r = nlByToken(t);
  if (!r || r.status !== "pending" || !(r.token_exp > now())) return nlPageSend(res, 410, "Link abgelaufen", "Dieser Bestätigungslink ist nicht mehr gültig. Melde dich einfach noch einmal unten im Shop an – du bekommst dann einen neuen Link.", `<a class="b" href="${BASE}/">Zum Shop</a>`);
  nlPageSend(res, 200, "Anmeldung bestätigen", `Soll <b>${nlEsc(maskMail(r.email))}</b> den Newsletter von instantcodes bekommen? Neue Marken, Angebote und Aktionen per E-Mail – abmelden geht jederzeit mit einem Klick.`,
    `<form method="post" action="/newsletter/bestaetigen"><input type="hidden" name="t" value="${nlEsc(t)}"><button class="b" type="submit">Ja, Anmeldung bestätigen</button></form>`);
});
app.post("/newsletter/bestaetigen", wrap(async (req, res) => {
  const b = await formBody(req), r = nlByToken(String((b && b.t) || ""));
  if (!r || r.status !== "pending" || !(r.token_exp > now())) return nlPageSend(res, 410, "Link abgelaufen", "Dieser Bestätigungslink ist nicht mehr gültig. Melde dich einfach noch einmal an.", `<a class="b" href="${BASE}/">Zum Shop</a>`);
  db.prepare("UPDATE newsletter SET status='active', confirmed_at=?, confirm_ip_hash=?, token_hash=NULL, token_exp=NULL, unsub_at=NULL, unsub_via=NULL WHERE email=?").run(now(), ipHash(req), r.email);
  nlLog(r.email, "bestaetigt", req, r.source);
  nlPageSend(res, 200, "Du bist dabei!", "Danke für deine Bestätigung. Ab jetzt bekommst du Neuigkeiten zu neuen Marken, Angeboten und Aktionen. Abmelden kannst du dich jederzeit mit einem Klick am Ende jeder E-Mail.", `<a class="b" href="${BASE}/">Zum Shop</a>`);
}));
/* Abmeldung: Newsletter oder Bewertungsanfragen, sofort wirksam */
function nlOff(e, k, via, req) {
  if (k === "review") {
    db.prepare("UPDATE users SET review_ok_at=NULL WHERE email=?").run(e);
    db.prepare("UPDATE orders SET review_ok_at=NULL WHERE email=? AND review_ok_at IS NOT NULL").run(e);
    consentLog(e, "bewertung", false, via, null, req);
    return;
  }
  const r = db.prepare("SELECT status FROM newsletter WHERE email=?").get(e);
  if (r && r.status !== "unsub") { db.prepare("UPDATE newsletter SET status='unsub', unsub_at=?, unsub_via=?, token_hash=NULL, token_exp=NULL WHERE email=?").run(now(), via, e); nlLog(e, "abmeldung", req, via); }
}
const nlUnsubOk = q => { const e = norm(q.e), k = q.k === "review" ? "review" : "news", s = String(q.s || ""), want = nlSig(k, e);
  return e && s.length === want.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want)) ? { e, k } : null; };
app.get("/newsletter/abmelden", (req, res) => {
  const v = nlUnsubOk(req.query);
  if (!v) return nlPageSend(res, 400, "Link ungültig", `Bitte nutze den Abmeldelink aus deiner E-Mail oder schreib uns an ${nlEsc(SUPPORT)} – wir tragen dich sofort aus.`);
  nlOff(v.e, v.k, "link", req);
  nlPageSend(res, 200, "Du bist abgemeldet", v.k === "review" ? "Wir schicken dir keine Bewertungsanfragen mehr. Bestell- und Lieferbestätigungen bekommst du weiterhin." : "Du bekommst keinen Newsletter mehr von uns. Bestell- und Lieferbestätigungen bekommst du weiterhin.", `<a class="b" href="${BASE}/">Zum Shop</a>`);
});
/* Ein-Klick-Abmeldung aus dem Mailprogramm (RFC 8058: POST mit „List-Unsubscribe=One-Click“ an dieselbe Adresse) */
app.post("/newsletter/abmelden", wrap(async (req, res) => {
  await formBody(req); // Inhalt („List-Unsubscribe=One-Click“) wird nicht gebraucht, nur gelesen
  const v = nlUnsubOk(req.query);
  if (!v) return res.status(400).type("text/plain").send("Link ungültig");
  nlOff(v.e, v.k, "ein-klick", req);
  res.set("Cache-Control", "no-store").type("text/plain").send("Abgemeldet");
}));

/* Einwilligungen im Konto und auf der Bestellseite */
const orderAccess = (req, id, k) => { const o = db.prepare("SELECT * FROM orders WHERE id=?").get(String(id || "")); return o && ((req.user && o.user_id === req.user.id) || (k && k === o.access_key) || isAdmin(req.user)) ? o : null; };
app.get("/api/consent", need, (req, res) => {
  const u = userById(req.user.id), nl = db.prepare("SELECT status FROM newsletter WHERE email=?").get(u.email);
  res.set("Cache-Control", "no-store").json({ review: !!u.review_ok_at, newsletter: nl ? nl.status : null });
});
app.get("/api/consent/review", (req, res) => {
  const o = orderAccess(req, req.query.order, String(req.query.k || ""));
  if (!o) return bad(res, "Bestellung nicht gefunden.", 404);
  const u = o.user_id ? userById(o.user_id) : null;
  res.set("Cache-Control", "no-store").json({ on: !!o.review_ok_at, account: !!(u && u.review_ok_at), asked: !!o.review_asked_at, reviewed: !!db.prepare("SELECT 1 FROM reviews WHERE order_id=?").get(o.id), status: o.status });
});
app.post("/api/consent/review", lim, (req, res) => {
  const on = req.body.on === true;
  if (req.body.order) {
    const o = orderAccess(req, req.body.order, String(req.body.k || ""));
    if (!o) return bad(res, "Bestellung nicht gefunden.", 404);
    db.prepare("UPDATE orders SET review_ok_at=? WHERE id=?").run(on ? now() : null, o.id);
    consentLog(o.email, "bewertung", on, "bestellseite", o.id, req);
    return res.json({ ok: true, on });
  }
  if (!req.user) return bad(res, "Bitte melde dich an.", 401);
  db.prepare("UPDATE users SET review_ok_at=? WHERE id=?").run(on ? now() : null, req.user.id);
  consentLog(req.user.email, "bewertung", on, "konto", null, req);
  res.json({ ok: true, on });
});
app.post("/api/newsletter/off", need, (req, res) => { nlOff(req.user.email, "news", "konto", req); res.json({ ok: true }); });

/* Bewertungsanfragen: einmal pro Bestellung, nur mit Einwilligung, nicht nach einer Bewertung, höchstens 30 Tage nach der Lieferung */
const REVIEW_DELAY = Math.max(0, Number(E.REVIEW_DELAY_H != null && E.REVIEW_DELAY_H !== "" ? E.REVIEW_DELAY_H : 72)) * 36e5;
function askReviews() {
  if (E.REVIEW_MAILS === "0") return 0;
  const t = now(), ids = db.prepare(`SELECT o.id FROM orders o WHERE o.status='delivered' AND o.review_asked_at IS NULL AND o.delivered_at <= ? AND o.delivered_at > ?
      AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.order_id=o.id)
      AND (o.review_ok_at IS NOT NULL OR EXISTS (SELECT 1 FROM users u WHERE u.id=o.user_id AND u.review_ok_at IS NOT NULL))
    ORDER BY o.delivered_at LIMIT 50`).all(t - REVIEW_DELAY, t - 30 * 864e5).map(r => r.id);
  for (const id of ids) {
    if (!db.prepare("UPDATE orders SET review_asked_at=? WHERE id=? AND review_asked_at IS NULL").run(t, id).changes) continue;
    const o = orderFull(id);
    safe(mail.reviewRequest(o, nlUnsub(o.email, "review")));
  }
  /* Datensparsamkeit: nie bestätigte Anmeldungen nach 30 Tagen löschen */
  const old = db.prepare("SELECT email FROM newsletter WHERE status='pending' AND created_at < ?").all(t - 30 * 864e5).map(r => r.email);
  old.forEach(e => { db.prepare("DELETE FROM newsletter WHERE email=? AND status='pending'").run(e); if (!db.prepare("SELECT 1 FROM newsletter_log WHERE email=? AND event='bestaetigt'").get(e)) db.prepare("DELETE FROM newsletter_log WHERE email=?").run(e); });
  return ids.length;
}
setTimeout(askReviews, 90e3).unref(); setInterval(askReviews, 30 * 60e3).unref();
app.post("/api/admin/review-mails/run", admin, (req, res) => res.json({ sent: askReviews() }));

/* ---------- Admin: Newsletter ---------- */
let nlSending = false;
function campaignIn(b) {
  const c = { subject: String(b.subject || "").trim().slice(0, 150), pre: String(b.pre || "").trim().slice(0, 150), title: String(b.title || "").trim().slice(0, 120),
    text: String(b.text || "").trim().slice(0, 4000), cta: String(b.cta || "").trim().slice(0, 40), url: String(b.url || "").trim().slice(0, 300),
    code: String(b.code || "").trim().toUpperCase().slice(0, 40), codeNote: String(b.codeNote || "").trim().slice(0, 200), img: String(b.img || "").trim().slice(0, 500),
    brands: [...new Set((Array.isArray(b.brands) ? b.brands : String(b.brands || "").split(/[\s,;]+/)).map(x => String(x).trim().toLowerCase()).filter(id => CATALOG[id]))].slice(0, 6) };
  if (!c.subject) throw new Bad("Bitte einen Betreff eingeben.");
  if (c.url && c.url.startsWith(BASE + "/")) c.url = c.url.slice(BASE.length);
  if (c.url && !/^\/[\w\-/?=&%.#]*$/.test(c.url)) throw new Bad("Der Link muss auf eine Seite im Shop zeigen, z. B. /angebote oder /marke/steam.");
  if (c.img && !/^https:\/\/[^\s"'<>]+$/.test(c.img)) throw new Bad("Die Bild-Adresse muss mit https:// beginnen.");
  if (c.code && !PROMOS[c.code]) throw new Bad(`Den Rabattcode ${c.code} gibt es im Shop nicht. Verfügbar: ${Object.keys(PROMOS).join(", ")}.`);
  return c;
}
app.get("/api/admin/newsletter", admin, (req, res) => {
  const counts = Object.fromEntries(db.prepare("SELECT status, COUNT(*) n FROM newsletter GROUP BY status").all().map(r => [r.status, r.n]));
  res.set("Cache-Control", "no-store").json({ counts, sending: nlSending, mail: !!E.RESEND_API_KEY, promos: Object.keys(PROMOS),
    list: db.prepare("SELECT email, status, source, created_at, ip_hash, confirmed_at, confirm_ip_hash, unsub_at, unsub_via FROM newsletter ORDER BY COALESCE(unsub_at, confirmed_at, created_at) DESC LIMIT 500").all(),
    campaigns: db.prepare("SELECT id, subject, created_at, finished_at, recipients, sent, failed, by FROM campaigns ORDER BY id DESC LIMIT 20").all(),
    review: { on: E.REVIEW_MAILS !== "0", delayH: REVIEW_DELAY / 36e5, accounts: db.prepare("SELECT COUNT(*) n FROM users WHERE review_ok_at IS NOT NULL").get().n,
      orders: db.prepare("SELECT COUNT(*) n FROM orders WHERE review_ok_at IS NOT NULL").get().n, asked: db.prepare("SELECT COUNT(*) n FROM orders WHERE review_asked_at IS NOT NULL").get().n } });
});
/* Nachweis als CSV (Semikolon, für Excel) */
app.get("/api/admin/newsletter.csv", admin, (req, res) => {
  const d = t => t ? new Date(t).toISOString() : "", q = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const rows = db.prepare("SELECT * FROM newsletter ORDER BY created_at").all().map(r => [r.email, r.status, r.source, d(r.created_at), r.ip_hash, d(r.confirmed_at), r.confirm_ip_hash, d(r.unsub_at), r.unsub_via].map(q).join(";"));
  res.set("Cache-Control", "no-store").set("Content-Disposition", `attachment; filename="newsletter-nachweis-${new Date().toISOString().slice(0, 10)}.csv"`).type("text/csv; charset=utf-8")
    .send("﻿" + ["E-Mail;Status;Quelle;Angemeldet (UTC);IP-Hash Anmeldung;Bestätigt (UTC);IP-Hash Bestätigung;Abgemeldet (UTC);Abgemeldet über"].concat(rows).join("\r\n"));
});
app.post("/api/admin/newsletter/preview", admin, (req, res) => {
  let c; try { c = campaignIn(req.body || {}); } catch (e) { return bad(res, e.message); }
  const r = mail._render("promo", req.user.email, c, nlUnsub(req.user.email));
  res.json({ subject: r.subject, pre: r.pre, html: r.html, text: r.text, campaign: c });
});
app.post("/api/admin/newsletter/test", admin, wrap(async (req, res) => {
  if (!E.RESEND_API_KEY) return bad(res, "RESEND_API_KEY fehlt.");
  let c; try { c = campaignIn(req.body || {}); } catch (e) { return bad(res, e.message); }
  await mail.promo(req.user.email, { ...c, subject: "[Test] " + c.subject }, nlUnsub(req.user.email));
  res.json({ ok: true, to: req.user.email });
}));
/* Versand nur an bestätigte Abonnenten; die Anzahl muss im Admin bestätigt werden (Schutz vor Versehen) */
app.post("/api/admin/newsletter/send", admin, (req, res) => {
  if (!E.RESEND_API_KEY) return bad(res, "RESEND_API_KEY fehlt.");
  if (nlSending) return bad(res, "Es läuft schon ein Versand. Bitte warte, bis er fertig ist.");
  let c; try { c = campaignIn(req.body || {}); } catch (e) { return bad(res, e.message); }
  const to = db.prepare("SELECT email FROM newsletter WHERE status='active' ORDER BY confirmed_at").all().map(r => r.email);
  if (!to.length) return bad(res, "Es gibt noch keine bestätigten Abonnenten.");
  if (Number(req.body.confirm) !== to.length) return bad(res, `Bitte bestätige den Versand an ${to.length} Abonnenten.`, 409);
  const id = db.prepare("INSERT INTO campaigns(subject,data,created_at,recipients,by) VALUES(?,?,?,?,?)").run(c.subject, JSON.stringify(c), now(), to.length, req.user.email).lastInsertRowid;
  nlSending = true;
  (async () => {
    let sent = 0, failed = 0;
    for (const e of to) {
      if ((db.prepare("SELECT status FROM newsletter WHERE email=?").get(e) || {}).status !== "active") continue; // inzwischen abgemeldet
      try { await mail.promo(e, c, nlUnsub(e)); sent++; } catch (err) { failed++; console.error("Newsletter an", e, err.message); }
      db.prepare("UPDATE campaigns SET sent=?, failed=? WHERE id=?").run(sent, failed, id);
      await new Promise(ok => setTimeout(ok, 550)); // Resend erlaubt standardmäßig etwa 2 Mails pro Sekunde
    }
    db.prepare("UPDATE campaigns SET finished_at=? WHERE id=?").run(now(), id);
    console.log(`Newsletter ${id}: ${sent} gesendet, ${failed} fehlgeschlagen`);
  })().catch(e => console.error("Newsletter-Versand:", e)).finally(() => { nlSending = false; });
  res.json({ ok: true, id, recipients: to.length });
});
app.post("/api/admin/newsletter/unsub", admin, (req, res) => {
  const e = norm(req.body.email); if (!emailOk(e)) return bad(res, "Ungültige Adresse.");
  nlOff(e, "news", "admin", req); res.json({ ok: true });
});

/* ---------- Admin: alle Mail-Vorlagen mit Beispieldaten ansehen (nur Inhaber) ---------- */
app.get("/api/admin/mails", admin, (req, res) => {
  res.set("Cache-Control", "no-store").json({ mail: !!E.RESEND_API_KEY, from: E.MAIL_FROM || "info@instantcodes.de", support: SUPPORT,
    mails: mail._samples().map(s => { const r = mail._render(s.key, ...s.args); return { id: s.id, group: s.group, key: s.key, name: s.name, trigger: s.trigger, subject: r.subject, pre: r.pre, ad: !!r.listUnsub, size: Buffer.byteLength(r.html) }; }) });
});
app.get("/admin/mail/:id", (req, res) => {
  res.set("Cache-Control", "no-store").set("X-Robots-Tag", "noindex, nofollow");
  if (!isAdmin(req.user)) return res.status(404).type("text/plain").send("Not Found");
  const s = mail._samples().find(x => x.id === String(req.params.id));
  if (!s) return res.status(404).type("text/plain").send("Vorlage nicht gefunden");
  const r = mail._render(s.key, ...s.args);
  if (req.query.text) return res.type("text/plain; charset=utf-8").send(`Betreff: ${r.subject}\nVorschautext: ${r.pre}\n\n${r.text}`);
  res.type("html").send(r.html);
});
app.post("/api/admin/mails/:id/test", admin, wrap(async (req, res) => {
  if (!E.RESEND_API_KEY) return bad(res, "RESEND_API_KEY fehlt.");
  try { await mail._sendSample(String(req.params.id), req.user.email); res.json({ ok: true, to: req.user.email }); } catch (e) { bad(res, "Versand fehlgeschlagen: " + e.message); }
}));
/* Kasse, Konto, Bestellungen, Suche und Weiterleitungen zu fremden Seiten (/go/) gehören nicht in den Suchindex */
app.get("/robots.txt", (req, res) => res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /r/\nDisallow: /go/\nDisallow: /kasse\nDisallow: /warenkorb\nDisallow: /konto\nDisallow: /login\nDisallow: /bestellung/\nDisallow: /verifizieren\nDisallow: /passwort\nDisallow: /suche\nDisallow: /newsletter/\nDisallow: /abmelden\n\nSitemap: ${BASE}/sitemap.xml\n`));
app.get("/sitemap.xml", (req, res) => {
  const day = new Date().toISOString().slice(0, 10);
  const urls = ["/", "/abo", "/kategorien", "/aufladen", "/angebote", "/hilfe", "/agb", "/datenschutz", "/widerruf", "/kuendigen"]
    .concat([...new Set(shopCatalog().map(b => b.cat))].map(c => `/kategorie/${c}`))
    .concat(shopCatalog().map(b => `/marke/${b.id}`));
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${BASE}${u}</loc><lastmod>${day}</lastmod><changefreq>${u.startsWith("/marke") ? "weekly" : "daily"}</changefreq><priority>${u === "/" ? "1.0" : u.startsWith("/kategorie") ? "0.8" : "0.6"}</priority></url>`).join("")}</urlset>`);
});
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"], maxAge: PROD ? "1h" : 0,
  setHeaders: (res, f) => { if (PROD && /\.(jpg|png|webp|svg|gif|ico|woff2?)$/.test(f)) res.set("Cache-Control", "public, max-age=604800"); } }));
/* Admin-Seite liegt außerhalb von public/ und wird nur dem Inhaber ausgeliefert; alle anderen sehen „nicht gefunden“ */
app.get(["/admin", "/admin.html"], (req, res) => {
  res.set("Cache-Control", "no-store"); res.set("X-Robots-Tag", "noindex, nofollow");
  if (!isAdmin(req.user)) return res.status(404).type("text/plain").send("Not Found");
  res.sendFile(path.join(__dirname, "private", "admin.html"));
});

/* Offizielle Einlöse-Seite: /go/<produkt-id> → 302 auf die Seite der Marke. Nur Ziele aus redeemlinks.json (Allowlist), sonst 404. */
app.get("/go/:id", (req, res) => {
  const ru = redeemLink(CATALOG[String(req.params.id)]);
  res.set("X-Robots-Tag", "noindex, nofollow");
  if (!ru) return res.status(404).set("Cache-Control", "no-store").type("text/plain").send("Nicht gefunden");
  res.set("Cache-Control", "private, max-age=300").redirect(302, ru.url);
});
/* Kurzadressen: /steam → 301 /marke/steam (nur sichtbare Produkte, Groß-/Kleinschreibung egal, Suchparameter bleiben).
   Steht hinter allen festen Routen und Dateien; reservierte Seitennamen werden nie umgeleitet. */
const SHORT_SKIP = new Set(["api", "auth", "img", "mail", "cards", "admin", "go", "r", "marke", "kategorie", "kategorien", "aufladen", "angebote", "suche", "warenkorb", "kasse",
  "bestellung", "login", "konto", "hilfe", "abo", "kuendigen", "verifizieren", "passwort", "agb", "datenschutz", "widerruf", "abmelden", "newsletter", "logo", "brand", "pay", "fonts", "vid", "anim"]);
let shortIds = null;
app.get("/:id", (req, res, next) => {
  const id = String(req.params.id).toLowerCase();
  if (!/^[\w-]{1,80}$/.test(id) || SHORT_SKIP.has(id)) return next();
  const cat = shopCatalog(); if (!shortIds || shortIds.cat !== cat) shortIds = { cat, ids: new Set(cat.map(b => b.id)) };
  if (!shortIds.ids.has(id)) return next();
  const u = String(req.originalUrl || req.url || ""), q = u.indexOf("?");
  res.redirect(301, `/marke/${id}${q > -1 ? u.slice(q) : ""}`);
});
/* Alle Shop-Adressen (z. B. /marke/steam, /warenkorb, /bestellung/…) liefern die Seite aus; der Browser übernimmt das Routing */
app.use((req, res, next) => (req.method === "GET" && /^\/(?!api\/|auth\/|img\/|mail\/|cards\/|admin|__)[^.]*$/.test(req.path)) ? sendIndex(req, res) : next());
const PORT = E.PORT || 3000;
/* Aufräumen: abgelaufene Sitzungen und Codes, nie bezahlte Bestellungen, verwaiste Bilder; Datenbank optimieren */
function maintenance() {
  try {
    const t = now(), r = {};
    r.sessions = db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(t).changes;
    r.tokens = db.prepare("DELETE FROM tokens WHERE expires_at < ? OR (used = 1 AND expires_at < ?)").run(t - 864e5, t).changes;
    r.orders = db.prepare("DELETE FROM orders WHERE status = 'awaiting_payment' AND created_at < ?").run(t - 3 * 864e5).changes;
    r.canceled = db.prepare("DELETE FROM orders WHERE status = 'canceled' AND paid_at IS NULL AND created_at < ?").run(t - 30 * 864e5).changes;
    const keep = new Set(db.prepare("SELECT product_id, img FROM rl_catalog WHERE img IS NOT NULL").all().map(x => `${x.product_id}.${x.img}`));
    let files = 0; for (const f of fs.readdirSync(RL_IMG)) if (!keep.has(f)) { try { fs.unlinkSync(path.join(RL_IMG, f)); files++; } catch (e) {} }
    r.images = files;
    seoCache.clear(); markMiss.clear();
    db.pragma("optimize"); db.pragma("wal_checkpoint(TRUNCATE)");
    if (new Date().getDay() === 1) db.exec("VACUUM");
    console.log("Wartung:", JSON.stringify(r));
  } catch (e) { console.error("Wartung:", e.message); }
}

app.listen(PORT, () => {
  try { const n = rlInject(); if (n) console.log(`Reloadly-Katalog: ${n} Produkte geladen`); } catch (e) { console.error("Reloadly-Katalog laden:", e.message); }
  if (RL.ON) {
    const due = () => !(+kvGet("rl_import_v3") > now() - 20 * 36e5);
    if (due()) setTimeout(() => rlImport().catch(e => console.error("Reloadly-Import:", e.message)), 5000);
    setInterval(() => { if (due()) rlImport().catch(e => console.error("Reloadly-Import:", e.message)); }, 36e5).unref();
  }
  loadPayMethods(); setInterval(loadPayMethods, 6 * 3600e3).unref();
  setTimeout(maintenance, 60e3); setInterval(maintenance, 24 * 3600e3).unref();
  console.log(`instantcodes läuft auf ${BASE} (Port ${PORT})${stripe ? "" : " – Zahlungen deaktiviert, STRIPE_SECRET_KEY fehlt"}${E.RESEND_API_KEY ? "" : " – E-Mails werden nur im Log ausgegeben"}`);
  console.log(RL.ON ? `Reloadly: verbunden${RL.SANDBOX ? " (Sandbox)" : ""}${RL_USE ? "" : " – im Testmodus ohne RELOADLY_SANDBOX=1 deaktiviert"}` : "Reloadly: nicht eingerichtet (RELOADLY_CLIENT_ID fehlt)");
  console.log(LIVE ? "LIVE-Betrieb: Auslieferung nur aus dem Code-Lager, Testcode-Generator gesperrt."
    : `Testmodus: Testkäufe erhalten ${TEST_GEN ? "Testcodes (Generator aktiv)" : "nur Testcodes aus dem Lager"}.`);
  console.log(stripe ? (PK || DEVPAY ? "Expresszahlung (Apple Pay, Google Pay …) aktiv." : "Expresszahlung aus: STRIPE_PUBLISHABLE_KEY fehlt.") : "");
  console.log(AUTO ? `Automatische Auslieferung: bis ${AUTO_MAX / 100} € pro Bestellung, ${AUTO_DAY / 100} € pro Kunde und Tag, nur bei normalem Stripe-Risiko.` : "Automatische Auslieferung ist ausgeschaltet.");
});
