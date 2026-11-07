"use strict";
/* ---------- Anmeldung und Konto-Erstellung über Anbieter ----------
   Apple, Google, PayPal, Microsoft (private Konten, z. B. Xbox), Discord, Twitch, Steam (OpenID 2.0), Amazon, SMS-Code (Twilio Verify).
   E-Mail-Code und Passkeys bleiben in server.js; hier nur der gemeinsame Teil (Konto anlegen, verknüpfen, zusammenführen).

   Regeln
   - Ein Anbieter-Konto (provider + sub) gehört genau einem Shop-Konto (Tabelle idents).
   - Mit einem bestehenden Konto zusammengeführt wird nur über eine vom Anbieter BESTÄTIGTE E-Mail
     (Apple, Google, PayPal mit email_verified, Discord mit verified, Twitch mit email_verified).
   - Ohne bestätigte E-Mail (Steam, Handy, Microsoft, Amazon, unbestätigte Discord/Twitch/PayPal-Adresse) entsteht ein Konto
     mit Platzhalter-Adresse (…@ohne-email.invalid, verified=0). Danach fragt der Shop nach der E-Mail und bestätigt sie mit
     dem E-Mail-Code; erst dann zählt sie für Bestellungen. Gehört die bestätigte Adresse schon zu einem Konto, werden beide
     zusammengeführt (der Code beweist den Zugriff aufs Postfach – derselbe Nachweis wie beim Anmelden per Code).
   - state (einmalig, an den Browser gebunden), nonce (OpenID Connect) und PKCE (wo der Anbieter es kann), exakte redirect_uri.
   - Keine Token, Codes oder Schlüssel in Logs; Schlüssel gehen nie an den Browser.

   Zugangsdaten: Umgebungsvariablen (Railway) haben Vorrang. Sonst trägt der Inhaber sie im Admin unter „Anmeldung“ ein;
   gespeichert in kv („auth:<anbieter>“) mit AES-256-GCM, Schlüssel per HKDF aus CODES_KEY (sonst SESSION_SECRET).
   Änderungen wirken sofort (kein Neustart).

   Vorschau (nie live): Ohne echte Zugangsdaten laufen alle Anbieter gegen einen eingebauten Simulator unter /__sim/auth/…
   (eigene Einwilligungsseite, Token-Endpunkt, JWKS, Steam-OpenID, SMS). Aktiv nur mit NODE_ENV≠production und Stripe-Attrappe
   (oder AUTH_SIM=1); AUTH_SIM=0 schaltet ihn ab. */
const crypto = require("crypto");

module.exports = X => {
  const { app, db, E, PROD, LIVE, DEVPAY, BASE, BASE_HOST, mail, now, sha, rnd, norm, emailOk, bad, wrap, need, admin, rateLimit,
    cookies, startSession, linkOrders, userById, userByEmail, safe, formBody, safePath, isPh, pub, pkRp } = X;

  /* ---------- Datenbank ---------- */
  db.exec(`CREATE TABLE IF NOT EXISTS auth_flows(id TEXT PRIMARY KEY, provider TEXT NOT NULL, bind TEXT NOT NULL, verifier TEXT, nonce TEXT,
    ret TEXT, mode TEXT NOT NULL DEFAULT 'login', uid INTEGER, created_at INTEGER NOT NULL);`);
  const idCols = db.prepare("PRAGMA table_info(idents)").all().map(c => c.name);
  if (!idCols.includes("email")) db.exec("ALTER TABLE idents ADD COLUMN email TEXT");
  if (!idCols.includes("email_verified")) db.exec("ALTER TABLE idents ADD COLUMN email_verified INTEGER DEFAULT 0");
  if (!idCols.includes("name")) db.exec("ALTER TABLE idents ADD COLUMN name TEXT");
  if (!idCols.includes("last_at")) db.exec("ALTER TABLE idents ADD COLUMN last_at INTEGER");
  /* Alte Google-Verknüpfung (users.google_sub) als Anbieter-Konto übernehmen */
  db.exec("INSERT OR IGNORE INTO idents(provider,sub,user_id,created_at) SELECT 'google', google_sub, id, created_at FROM users WHERE google_sub IS NOT NULL AND google_sub<>''");
  /* Frühere SMS-Konten hatten eine Kunstadresse und galten als bestätigt – Codes dürfen dort nie hingehen */
  db.exec("UPDATE users SET verified=0 WHERE email LIKE '%@sms.instacode.store' AND verified=1");

  const kvGet = k => (db.prepare("SELECT v FROM kv WHERE k=?").get(k) || {}).v;
  const kvSet = (k, v) => db.prepare("INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").run(k, String(v));
  const kvDel = k => db.prepare("DELETE FROM kv WHERE k=?").run(k);

  /* ---------- Verschlüsselte Zugangsdaten ---------- */
  const CK = Buffer.from(crypto.hkdfSync("sha256", Buffer.from(String(E.CODES_KEY || E.SESSION_SECRET || "nur-fuer-lokale-tests")),
    Buffer.from("instantcodes"), Buffer.from("auth-credentials-v1"), 32));
  const seal = (p, obj) => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", CK, iv); c.setAAD(Buffer.from("auth:" + p));
    const d = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()]); return "v1." + [iv, c.getAuthTag(), d].map(b => b.toString("base64url")).join("."); };
  const unseal = (p, s) => { const [v, iv, tag, d] = String(s).split("."); if (v !== "v1" || !d) throw new Error("Format");
    const c = crypto.createDecipheriv("aes-256-gcm", CK, Buffer.from(iv, "base64url")); c.setAAD(Buffer.from("auth:" + p)); c.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([c.update(Buffer.from(d, "base64url")), c.final()]).toString("utf8")); };

  /* ---------- Anbieter ---------- */
  const SIM = !PROD && !LIVE && (E.AUTH_SIM === "1" || (E.AUTH_SIM !== "0" && !!DEVPAY));
  const CB = p => `${BASE}/auth/${p}/callback`;
  const ORIGIN = (() => { try { return new URL(BASE).origin; } catch (e) { return BASE; } })();
  const ALT = (() => { try { const u = new URL(BASE); if (/^(localhost|127\.|\d+\.\d+\.\d+\.\d+$)/.test(u.hostname)) return null;
    u.hostname = u.hostname.startsWith("www.") ? u.hostname.slice(4) : "www." + u.hostname; return u.origin; } catch (e) { return null; } })();
  const cleanName = n => String(n || "").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  const jwtPart = s => { try { return JSON.parse(Buffer.from(String(s || ""), "base64url").toString("utf8")); } catch (e) { return null; } };
  class AuthErr extends Error { constructor(m, o = {}) { super(m); Object.assign(this, o); } }
  const RE_ID = /^[\w.\-:@/]{3,200}$/, RE_SECRET = /^[\x21-\x7e]{6,512}$/;

  /* Apple: client_secret ist ein ES256-JWT aus Team ID, Key ID und dem .p8-Schlüssel (höchstens 6 Monate gültig, hier 50 Minuten) */
  function appleSecret(c) {
    const b = o => Buffer.from(JSON.stringify(o)).toString("base64url"), n = Math.floor(Date.now() / 1000);
    const data = b({ alg: "ES256", kid: c.keyId }) + "." + b({ iss: c.teamId, iat: n, exp: n + 3000, aud: c.aud || "https://appleid.apple.com", sub: c.clientId });
    return data + "." + crypto.sign("sha256", Buffer.from(data), { key: c.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  }
  const appleKeyOk = pem => { try { const k = crypto.createPrivateKey(pem); return k.asymmetricKeyType === "ec" && (k.asymmetricKeyDetails || {}).namedCurve === "prime256v1"; } catch (e) { return false; } };
  const pemFix = v => { let s = String(v || "").replace(/\\n/g, "\n").replace(/\r/g, "").trim(); if (s && !/-----BEGIN/.test(s) && /^[A-Za-z0-9+/=\s]+$/.test(s)) s = `-----BEGIN PRIVATE KEY-----\n${s.replace(/\s+/g, "").replace(/(.{64})/g, "$1\n").trim()}\n-----END PRIVATE KEY-----`; return s; };

  /* Felder: k Schlüssel · env Umgebungsvariable (gewinnt) · secret nur schreiben · type switch/file · re Formatprüfung */
  const DEF = {
    google: { name: "Google", short: "Google",
      fields: [{ k: "clientId", env: "GOOGLE_CLIENT_ID", label: "Client-ID", ph: "1234-abc.apps.googleusercontent.com", re: /^[\w.-]{10,200}$/ },
        { k: "clientSecret", env: "GOOGLE_CLIENT_SECRET", label: "Clientschlüssel (Client Secret)", secret: true, opt: true }],
      ready: c => !!c.clientId, scope: "openid email profile", pkce: true, nonce: true, extra: { prompt: "select_account" }, iss: "https://accounts.google.com",
      urls: () => ({ auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", jwks: "https://www.googleapis.com/oauth2/v3/certs", iss: ["https://accounts.google.com", "accounts.google.com"] }),
      profile: async q => { const P = await idToken(q); return { sub: P.sub, email: P.email, verified: P.email_verified === true || P.email_verified === "true", name: P.name || [P.given_name, P.family_name].filter(Boolean).join(" ") }; } },
    apple: { name: "Apple", short: "Apple",
      fields: [{ k: "clientId", env: "APPLE_CLIENT_ID", label: "Services ID (Client ID)", ph: "de.instantcodes.login", re: RE_ID },
        { k: "teamId", env: "APPLE_TEAM_ID", label: "Team ID", ph: "A1B2C3D4E5", re: /^[A-Z0-9]{10}$/ },
        { k: "keyId", env: "APPLE_KEY_ID", label: "Key ID", ph: "F6G7H8I9J0", re: /^[A-Z0-9]{10}$/ },
        { k: "privateKey", env: "APPLE_PRIVATE_KEY", label: "Privater Schlüssel (.p8-Datei)", secret: true, type: "file", accept: ".p8" }],
      ready: c => !!(c.clientId && c.teamId && c.keyId && c.privateKey), scope: "name email", formPost: true, nonce: true, secret: appleSecret,
      urls: () => ({ auth: "https://appleid.apple.com/auth/authorize", token: "https://appleid.apple.com/auth/token", jwks: "https://appleid.apple.com/auth/keys", iss: "https://appleid.apple.com" }),
      profile: async q => { const P = await idToken(q); let name = "";
        try { const n = (JSON.parse(String(q.x.user || "{}")) || {}).name || {}; name = [n.firstName, n.lastName].filter(Boolean).join(" "); } catch (e) {}
        return { sub: P.sub, email: P.email, verified: P.email_verified === true || P.email_verified === "true", name, relay: P.is_private_email === true || P.is_private_email === "true" }; } },
    paypal: { name: "PayPal", short: "PayPal",
      fields: [{ k: "clientId", env: "PAYPAL_CLIENT_ID", label: "Client ID", ph: "AYsk…", re: /^[\w-]{10,200}$/ },
        { k: "clientSecret", env: "PAYPAL_CLIENT_SECRET", label: "Secret", secret: true },
        { k: "sandbox", env: "PAYPAL_SANDBOX", label: "Sandbox (Test-Konten von PayPal)", type: "switch" }],
      ready: c => !!(c.clientId && c.clientSecret), scope: "openid email profile", basic: true, extra: { flowEntry: "static" },
      urls: c => { const s = c.sandbox ? "sandbox." : ""; return { auth: `https://www.${s}paypal.com/connect`, token: `https://api-m.${s}paypal.com/v1/oauth2/token`,
        userinfo: `https://api-m.${s}paypal.com/v1/identity/openidconnect/userinfo?schema=openid`, userinfo2: `https://api-m.${s}paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1` }; },
      profile: async q => { let u = await getJson(q.U.userinfo, q.t.access_token);
        if (!u.email && q.U.userinfo2) { try { const v = await getJson(q.U.userinfo2, q.t.access_token), m = (v.emails || []).find(e => e.primary) || (v.emails || [])[0];
          if (m) u = Object.assign({}, u, { email: m.value, email_verified: !!m.confirmed, user_id: u.user_id || v.user_id, name: u.name || v.name }); } catch (e) {} }
        return { sub: u.user_id || u.sub || u.payer_id, email: u.email, verified: u.email_verified === true || u.email_verified === "true", name: u.name || [u.given_name, u.family_name].filter(Boolean).join(" ") }; } },
    microsoft: { name: "Microsoft", short: "Microsoft",
      fields: [{ k: "clientId", env: "MICROSOFT_CLIENT_ID", label: "Anwendungs-ID (Client-ID)", ph: "00000000-0000-0000-0000-000000000000", re: /^[0-9a-fA-F-]{36}$/ },
        { k: "clientSecret", env: "MICROSOFT_CLIENT_SECRET", label: "Geheimer Clientschlüssel (Wert)", secret: true }],
      ready: c => !!(c.clientId && c.clientSecret), scope: "openid email profile", pkce: true, nonce: true, extra: { prompt: "select_account", response_mode: "query" },
      urls: () => ({ auth: "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize", token: "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
        jwks: "https://login.microsoftonline.com/consumers/discovery/v2.0/keys", iss: "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0" }),
      /* Microsoft garantiert laut Doku nicht, dass die E-Mail im Token stimmt („isn't guaranteed to be correct“) → gilt als unbestätigt */
      profile: async q => { const P = await idToken(q); return { sub: P.sub, email: P.email || (/@/.test(P.preferred_username || "") ? P.preferred_username : null), verified: false, name: P.name }; } },
    discord: { name: "Discord", short: "Discord",
      fields: [{ k: "clientId", env: "DISCORD_CLIENT_ID", label: "Client ID", ph: "123456789012345678", re: /^\d{6,30}$/ },
        { k: "clientSecret", env: "DISCORD_CLIENT_SECRET", label: "Client Secret", secret: true }],
      ready: c => !!(c.clientId && c.clientSecret), scope: "identify email", pkce: true, extra: { prompt: "none" }, iss: "https://discord.com",
      urls: () => ({ auth: "https://discord.com/oauth2/authorize", token: "https://discord.com/api/oauth2/token", userinfo: "https://discord.com/api/users/@me" }),
      profile: async q => { const u = await getJson(q.U.userinfo, q.t.access_token); return { sub: u.id, email: u.email, verified: u.verified === true, name: u.global_name || u.username }; } },
    twitch: { name: "Twitch", short: "Twitch",
      fields: [{ k: "clientId", env: "TWITCH_CLIENT_ID", label: "Client-ID", ph: "abcd1234…", re: /^[a-z0-9]{10,60}$/ },
        { k: "clientSecret", env: "TWITCH_CLIENT_SECRET", label: "Geheimer Client-Schlüssel", secret: true }],
      ready: c => !!(c.clientId && c.clientSecret), scope: "openid user:read:email", pkce: true, nonce: true,
      extra: { claims: JSON.stringify({ id_token: { email: null, email_verified: null, preferred_username: null } }) },
      urls: () => ({ auth: "https://id.twitch.tv/oauth2/authorize", token: "https://id.twitch.tv/oauth2/token", jwks: "https://id.twitch.tv/oauth2/keys", iss: "https://id.twitch.tv/oauth2" }),
      profile: async q => { const P = await idToken(q); return { sub: P.sub, email: P.email, verified: P.email_verified === true || P.email_verified === "true", name: P.preferred_username }; } },
    steam: { name: "Steam", short: "Steam", openid2: true,
      fields: [{ k: "enabled", env: "STEAM_LOGIN", label: "Anmeldung mit Steam anbieten", type: "switch" },
        { k: "apiKey", env: "STEAM_API_KEY", label: "Steam Web API Key (optional, für den Spielernamen)", secret: true, opt: true, re: /^[0-9A-Fa-f]{32}$/ }],
      ready: c => !!c.enabled, urls: () => ({ op: "https://steamcommunity.com/openid/login", api: "https://api.steampowered.com" }) },
    amazon: { name: "Amazon", short: "Amazon",
      fields: [{ k: "clientId", env: "AMAZON_CLIENT_ID", label: "Client ID", ph: "amzn1.application-oa2-client.…", re: /^[\w.\-]{10,200}$/ },
        { k: "clientSecret", env: "AMAZON_CLIENT_SECRET", label: "Client Secret", secret: true }],
      ready: c => !!(c.clientId && c.clientSecret), scope: "profile", pkce: true,
      urls: () => ({ auth: "https://www.amazon.com/ap/oa", token: "https://api.amazon.co.uk/auth/o2/token", userinfo: "https://api.amazon.co.uk/user/profile" }),
      /* Login with Amazon nennt keinen Bestätigungsstatus der E-Mail → gilt als unbestätigt */
      profile: async q => { const u = await getJson(q.U.userinfo, q.t.access_token); return { sub: u.user_id, email: u.email, verified: false, name: u.name }; } },
    sms: { name: "Handy (SMS-Code)", short: "Handy",
      fields: [{ k: "accountSid", env: "TWILIO_ACCOUNT_SID", label: "Account SID", ph: "AC…", re: /^AC[0-9a-fA-F]{32}$/ },
        { k: "authToken", env: "TWILIO_AUTH_TOKEN", label: "Auth Token", secret: true, re: /^[0-9a-fA-F]{32}$/ },
        { k: "serviceSid", env: "TWILIO_VERIFY_SID", label: "Verify Service SID", ph: "VA…", re: /^VA[0-9a-fA-F]{32}$/ }],
      ready: c => !!(c.accountSid && c.authToken && c.serviceSid) },
  };
  /* Reihenfolge im Shop (auf Apple-Geräten zieht der Browser Apple nach vorn) */
  const ORDER = ["apple", "google", "paypal", "microsoft", "discord", "twitch", "steam", "amazon", "sms"];

  let STORE = {};
  const stored = p => { if (!(p in STORE)) { const raw = kvGet("auth:" + p); try { STORE[p] = raw ? unseal(p, raw) : {}; } catch (e) { STORE[p] = { __bad: true }; } } return STORE[p]; };
  const envVal = f => f.env && E[f.env] != null && String(E[f.env]).trim() !== "" ? String(E[f.env]).trim() : null;
  const onOff = v => v === true || v === 1 || /^(1|true|ja|on)$/i.test(String(v == null ? "" : v));
  function conf(p) {
    const D = DEF[p], s = stored(p), c = { src: {} };
    for (const f of D.fields) {
      const ev = envVal(f), sv = s[f.k];
      let v = ev != null ? ev : sv;
      c.src[f.k] = ev != null ? "env" : (sv != null && sv !== "" ? "admin" : null);
      c[f.k] = f.type === "switch" ? onOff(v) : (v == null ? "" : String(v));
    }
    if (p === "apple" && c.privateKey) c.privateKey = pemFix(c.privateKey);
    return c;
  }
  const real = p => { const c = conf(p); return DEF[p].ready(c) ? c : null; };
  const mode = p => real(p) ? "live" : SIM ? "sim" : null;

  /* ---------- Vorschau-Simulator: eigene Schlüssel ---------- */
  const SIMK = SIM ? (() => { const rsa = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }), ec = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    return { rsa, ec, ecPem: ec.privateKey.export({ type: "pkcs8", format: "pem" }), jwk: Object.assign(rsa.publicKey.export({ format: "jwk" }), { kid: "sim-1", alg: "RS256", use: "sig" }) }; })() : null;
  const simConf = p => ({ src: {}, clientId: `sim-${p}`, clientSecret: `sim-secret-${p}`, teamId: "SIMTEAM001", keyId: "SIMKEY0001", privateKey: SIMK && SIMK.ecPem,
    aud: `${BASE}/__sim/auth/apple`, sandbox: false, enabled: true, apiKey: "", accountSid: "AC" + "0".repeat(32), authToken: "0".repeat(32), serviceSid: "VA" + "0".repeat(32) });
  const simUrls = p => p === "steam" ? { op: `${BASE}/__sim/auth/steam/login`, api: null } :
    { auth: `${BASE}/__sim/auth/${p}/authorize`, token: `${BASE}/__sim/auth/${p}/token`, userinfo: `${BASE}/__sim/auth/${p}/userinfo`, jwks: `${BASE}/__sim/auth/jwks`, iss: `${BASE}/__sim/auth/${p}` };

  /* Laufzeit-Einstellung eines Anbieters (echt oder simuliert); null = nicht verfügbar */
  function rt(p) {
    const D = DEF[p], m = D && mode(p); if (!m) return null;
    if (m === "sim") return Object.assign({}, D, { p, sim: true, c: simConf(p), U: simUrls(p), iss: null });
    const c = conf(p); return Object.assign({}, D, { p, sim: false, c, U: D.urls ? D.urls(c) : {} });
  }
  /* Google ohne Clientschlüssel: Knopf von Google (GIS) statt Weiterleitung */
  const gisClientId = () => { const c = real("google"); return c && !c.clientSecret ? c.clientId : null; };
  const redirectable = p => { const R = rt(p); if (!R || p === "sms") return null; if (p === "google" && !R.sim && !R.c.clientSecret) return null; return R; };

  /* ---------- Status pro Anbieter (für den Admin) ---------- */
  const stGet = p => { try { return JSON.parse(kvGet("authst:" + p) || "null"); } catch (e) { return null; } };
  const stSet = (p, o) => { const old = stGet(p) || {}; kvSet("authst:" + p, JSON.stringify(Object.assign(old, o))); };
  const stOk = (p, msg) => { const o = stGet(p) || {}; if (!o.err && o.okAt > now() - 60e3) return; stSet(p, { okAt: now(), err: null, errAt: null, cfgErr: null, msg: msg || o.msg || null }); };
  /* cfg: der Anbieter hat unsere Zugangsdaten abgelehnt (vom Server selbst beobachtet, nicht von Kunden auslösbar) → Knopf ausblenden, bis sie stimmen */
  const stErr = (p, msg, cfg) => stSet(p, Object.assign({ err: String(msg).slice(0, 300), errAt: now() }, cfg ? { cfgErr: true } : {}));
  const hidden = p => { const o = stGet(p); return !!(o && o.cfgErr); };

  /* ---------- Hilfen für OAuth/OIDC ---------- */
  const s256 = v => crypto.createHash("sha256").update(v).digest("base64url");
  const jwksCache = new Map();
  async function jwk(url, kid) {
    let c = jwksCache.get(url);
    const stale = !c || c.at < now() - 6 * 36e5 || (kid && !c.keys.some(k => k.kid === kid) && c.at < now() - 60e3);
    if (stale) { const r = await fetch(url, { signal: AbortSignal.timeout(8000) }); if (!r.ok) throw new AuthErr("Schlüssel des Anbieters nicht erreichbar", { code: "jwks" });
      const j = await r.json(); c = { at: now(), keys: Array.isArray(j.keys) ? j.keys : [] }; jwksCache.set(url, c); }
    return c.keys.find(k => k.kid === kid) || (!kid && c.keys.length === 1 ? c.keys[0] : null);
  }
  /* ID-Token prüfen: Signatur (JWKS), Aussteller, Empfänger, Ablauf, nonce */
  async function idToken(q) {
    const tok = String(q.t.id_token || ""), [h, b, s] = tok.split(".");
    if (!s) throw new AuthErr("Kein ID-Token erhalten", { code: "no_id_token" });
    const H = jwtPart(h), P = jwtPart(b);
    if (!H || !P || !["RS256", "ES256"].includes(H.alg)) throw new AuthErr("ID-Token ungültig", { code: "id_token" });
    const k = await jwk(q.U.jwks, H.kid); if (!k) throw new AuthErr("Unbekannter Schlüssel im ID-Token", { code: "id_token" });
    let ok = false;
    try { const key = crypto.createPublicKey({ key: { kty: k.kty, n: k.n, e: k.e, crv: k.crv, x: k.x, y: k.y }, format: "jwk" });
      ok = crypto.verify("sha256", Buffer.from(h + "." + b), H.alg === "ES256" ? { key, dsaEncoding: "ieee-p1363" } : key, Buffer.from(s, "base64url")); } catch (e) { ok = false; }
    if (!ok) throw new AuthErr("Signatur des ID-Tokens stimmt nicht", { code: "id_token" });
    const iss = [].concat(q.U.iss); if (!iss.includes(P.iss)) throw new AuthErr("Falscher Aussteller im ID-Token", { code: "id_token" });
    const aud = q.c.clientId; if (!(Array.isArray(P.aud) ? P.aud.includes(aud) : P.aud === aud)) throw new AuthErr("ID-Token gehört zu einer anderen App", { code: "id_token" });
    const t = Date.now() / 1000; if (!(Number(P.exp) > t - 120)) throw new AuthErr("ID-Token abgelaufen", { code: "id_token" });
    if (P.iat && Number(P.iat) > t + 300) throw new AuthErr("ID-Token aus der Zukunft", { code: "id_token" });
    if (q.nonce && P.nonce !== q.nonce) throw new AuthErr("nonce stimmt nicht", { code: "id_token" });
    return P;
  }
  async function getJson(url, at) {
    const r = await fetch(url, { headers: { Authorization: "Bearer " + at, Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new AuthErr("Profil nicht abrufbar (HTTP " + r.status + ")", { code: "profile", status: r.status }); return j;
  }
  const isCfgErr = (status, j) => status === 401 || /invalid_client|unauthorized_client/.test(String(j.error || "")) || /client/i.test(String(j.message || "")) || (status === 403 && !j.error);
  async function tokenCall(R, params) {
    const body = new URLSearchParams(params), headers = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
    const secret = R.secret ? R.secret(R.c) : R.c.clientSecret;
    if (R.basic) headers.Authorization = "Basic " + Buffer.from(`${R.c.clientId}:${secret}`).toString("base64");
    else { body.set("client_id", R.c.clientId); if (secret) body.set("client_secret", secret); }
    const r = await fetch(R.U.token, { method: "POST", headers, body, signal: AbortSignal.timeout(12000) });
    return { status: r.status, j: await r.json().catch(() => ({})) };
  }
  async function exchange(R, code, verifier) {
    const { status, j } = await tokenCall(R, Object.assign({ grant_type: "authorization_code", code: String(code), redirect_uri: CB(R.p) }, verifier ? { code_verifier: verifier } : {}));
    if (status >= 300 || (!j.access_token && !j.id_token)) {
      const code_ = String(j.error || (j.message ? "message" : "http_" + status)).slice(0, 60);
      console.error(`Anmeldung ${R.name}: Token-Anfrage abgelehnt (HTTP ${status}, ${code_})`); // nie Token oder Codes loggen
      throw new AuthErr("Token-Anfrage abgelehnt", { code: code_, cfg: isCfgErr(status, j) });
    }
    return j;
  }
  function authorizeUrl(R, { state, nonce, challenge }) {
    const q = new URLSearchParams(Object.assign({ client_id: R.c.clientId, redirect_uri: CB(R.p), response_type: "code", scope: R.scope, state }, R.extra || {}));
    if (R.formPost) q.set("response_mode", "form_post");
    if (nonce) q.set("nonce", nonce);
    if (challenge) { q.set("code_challenge", challenge); q.set("code_challenge_method", "S256"); }
    return `${R.U.auth}?${q}`;
  }
  /* Steam (OpenID 2.0) */
  const STEAM_NS = "http://specs.openid.net/auth/2.0", STEAM_SEL = "http://specs.openid.net/auth/2.0/identifier_select";
  const steamUrl = (R, state) => `${R.U.op}?${new URLSearchParams({ "openid.ns": STEAM_NS, "openid.mode": "checkid_setup", "openid.return_to": `${CB("steam")}?state=${state}`,
    "openid.realm": ORIGIN, "openid.identity": STEAM_SEL, "openid.claimed_id": STEAM_SEL })}`;
  async function steamCheck(R, x) {
    const g = k => String(x["openid." + k] || "");
    if (g("mode") !== "id_res") throw new AuthErr(g("mode") === "cancel" ? "abgebrochen" : "Antwort unvollständig", { code: g("mode") === "cancel" ? "cancel" : "mode" });
    if (g("op_endpoint") !== R.U.op) throw new AuthErr("Falscher Anbieter", { code: "op" });
    if (g("return_to") !== `${CB("steam")}?state=${String(x.state || "")}`) throw new AuthErr("Rücksprung-Adresse passt nicht", { code: "return_to" });
    const m = g("claimed_id").match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/) || (R.sim && g("claimed_id").match(/\/__sim\/auth\/steam\/id\/(\d{17})$/));
    if (!m || g("identity") !== g("claimed_id")) throw new AuthErr("Steam-ID fehlt", { code: "claimed_id" });
    const signed = g("signed").split(","); for (const k of ["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce", "assoc_handle"]) if (!signed.includes(k)) throw new AuthErr("Signatur unvollständig", { code: "signed" });
    /* response_nonce: höchstens 5 Minuten alt und nur einmal (Schutz vor Wiederholung) */
    const rn = g("response_nonce"), ts = Date.parse(rn.slice(0, 20));
    if (!(ts > now() - 5 * 60e3 && ts < now() + 60e3)) throw new AuthErr("Antwort zu alt", { code: "nonce" });
    if (db.prepare("SELECT 1 FROM tokens WHERE kind='steam_nonce' AND hash=?").get(sha(rn))) throw new AuthErr("Antwort schon benutzt", { code: "nonce" });
    db.prepare("INSERT INTO tokens(user_id,kind,hash,expires_at,used) VALUES(NULL,'steam_nonce',?,?,1)").run(sha(rn), now() + 10 * 60e3);
    const body = new URLSearchParams(); for (const [k, v] of Object.entries(x)) if (k.startsWith("openid.")) body.set(k, String(v)); body.set("openid.mode", "check_authentication");
    const r = await fetch(R.U.op, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(10000) });
    const txt = await r.text(); if (!r.ok || !/(^|\n)is_valid\s*:\s*true/.test(txt)) throw new AuthErr("Steam hat die Anmeldung nicht bestätigt", { code: "is_valid" });
    const id = m[1]; let name = "";
    if (R.c.apiKey && R.U.api) { try { const j = await (await fetch(`${R.U.api}/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(R.c.apiKey)}&steamids=${id}`, { signal: AbortSignal.timeout(8000) })).json();
      name = (((j.response || {}).players || [])[0] || {}).personaname || ""; } catch (e) {} }
    if (R.sim && x.sim_name) name = String(x.sim_name);
    return { sub: id, email: null, verified: false, name: name || `Steam-Spieler ···${id.slice(-4)}` };
  }

  /* ---------- Konten ---------- */
  const PH = "ohne-email.invalid";
  const phEmail = () => `k${crypto.randomBytes(9).toString("hex")}@${PH}`;
  const mailable = u => !!u && !isPh(u.email);
  const NAMES = Object.fromEntries(Object.entries(DEF).map(([k, v]) => [k, v.short])); NAMES.sms = "Handy"; NAMES.google = "Google";
  const identsOf = uid => db.prepare("SELECT provider, email, email_verified, name, created_at, last_at FROM idents WHERE user_id=? ORDER BY created_at").all(uid);
  const addIdent = (p, sub, uid, prof) => db.prepare("INSERT OR IGNORE INTO idents(provider,sub,user_id,created_at,email,email_verified,name,last_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(p, sub, uid, now(), prof.email ? norm(prof.email).slice(0, 254) : null, prof.verified ? 1 : 0, cleanName(prof.name) || null, now());
  const touchIdent = (p, sub, prof) => db.prepare("UPDATE idents SET last_at=?, email=COALESCE(?, email), email_verified=?, name=COALESCE(?, name) WHERE provider=? AND sub=?")
    .run(now(), prof.email ? norm(prof.email).slice(0, 254) : null, prof.verified ? 1 : 0, cleanName(prof.name) || null, p, sub);
  /* Konto, das bisher unbestätigt war, wird über einen Anbieter oder Code bestätigt: ein dort gesetztes Passwort stammt von
     jemandem, der die Adresse nie nachgewiesen hat (Schutz vor vorab angelegten Konten) → Passwort verwerfen */
  const claimUnverified = u => { if (u && !u.verified) { db.prepare("UPDATE users SET verified=1, pw_hash=NULL WHERE id=? AND verified=0").run(u.id); db.prepare("DELETE FROM sessions WHERE user_id=?").run(u.id); } };
  /* Alle Daten von Konto „from“ nach „to“ übernehmen und „from“ löschen (Spalten user_id in allen Tabellen) */
  function mergeUsers(from, to) {
    if (from === to) return;
    const tabs = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('users','sessions','tokens','sqlite_sequence')").all().map(r => r.name)
      .filter(t => /^\w+$/.test(t) && db.prepare(`PRAGMA table_info(${t})`).all().some(c => c.name === "user_id"));
    db.transaction(() => {
      for (const t of tabs) { try { db.prepare(`UPDATE OR IGNORE ${t} SET user_id=? WHERE user_id=?`).run(to, from); } catch (e) { console.error("Zusammenführen", t, e.message); } }
      db.prepare("DELETE FROM users WHERE id=?").run(from);
    })();
  }
  /* Bestätigte E-Mail an ein Konto ohne E-Mail hängen; gehört sie schon einem anderen Konto, werden beide zusammengeführt */
  function attachEmail(u, email) {
    const e = norm(email), other = userByEmail(e);
    if (other && other.id !== u.id) { claimUnverified(other); mergeUsers(u.id, other.id); return { u: userById(other.id), merged: true }; }
    db.prepare("UPDATE users SET email=?, verified=1 WHERE id=?").run(e, u.id);
    return { u: userById(u.id), merged: false };
  }
  /* Kern: Anmeldung oder Konto-Erstellung mit einem Anbieter-Profil {sub, email, verified, name} */
  function providerLogin(p, prof, linkUid) {
    const sub = String(prof.sub || "").slice(0, 200); if (!sub) throw new AuthErr("Keine Konto-Kennung vom Anbieter", { code: "sub" });
    const e = prof.email ? norm(prof.email) : null, okMail = !!(e && prof.verified && emailOk(e));
    const hit = db.prepare("SELECT user_id FROM idents WHERE provider=? AND sub=?").get(p, sub);
    if (linkUid) {
      if (hit && hit.user_id !== linkUid) throw new AuthErr(`Dieses ${NAMES[p]}-Konto ist schon mit einem anderen instantcodes-Konto verbunden.`, { user: true });
      if (hit) touchIdent(p, sub, prof); else addIdent(p, sub, linkUid, prof);
      let u = userById(linkUid), merged = false;
      if (isPh(u.email) && okMail) { const r = attachEmail(u, e); u = r.u; merged = r.merged; }
      return { u, linked: !hit, merged };
    }
    let u = hit && userById(hit.user_id);
    if (u) {
      touchIdent(p, sub, prof);
      if (isPh(u.email) && okMail) { const r = attachEmail(u, e); return { u: r.u, merged: r.merged, attached: !r.merged }; }
      return { u };
    }
    let first = false, linkedExisting = false;
    if (okMail) {
      u = userByEmail(e);
      if (u) { claimUnverified(u); linkedExisting = true; }
      else { db.prepare("INSERT INTO users(email,name,verified,created_at) VALUES(?,?,1,?)").run(e, cleanName(prof.name) || e.split("@")[0].slice(0, 80), now()); u = userByEmail(e); first = true; }
    } else {
      const ph = phEmail(); db.prepare("INSERT INTO users(email,name,verified,created_at) VALUES(?,?,0,?)").run(ph, cleanName(prof.name) || "Kunde", now()); u = userByEmail(ph); first = true;
    }
    addIdent(p, sub, u.id, prof);
    return { u: userById(u.id), first, linkedExisting };
  }
  /* Nach einer Anmeldung: Sitzung, Gastbestellungen, Hinweis-Mails */
  function afterLogin(req, res, p, out, session = true) {
    const u = out.u;
    if (session) startSession(res, u.id);
    if (mailable(u)) {
      linkOrders(u.id, u.email);
      const ua = req.get("user-agent") || "";
      if (out.first || out.attached) safe(mail.welcome(u.email, u.name));
      else if (out.linkedExisting || out.linked || out.merged) safe(mail.loginLinked(u.email, u.name, NAMES[p] || p, ua));
      else if (u.login_alerts) safe(mail.loginAlert(u.email, u.name, ua));
    }
    return u;
  }
  const needsEmail = u => !!u && isPh(u.email);
  const hintOf = uid => { const r = db.prepare("SELECT email FROM idents WHERE user_id=? AND email IS NOT NULL ORDER BY last_at DESC LIMIT 1").get(uid); return r && r.email && !isPh(r.email) ? r.email : null; };
  /* Zusatzfelder für /api/me */
  const pubExtra = u => ({ needsEmail: needsEmail(u), emailHint: needsEmail(u) ? hintOf(u.id) : null, logins: identsOf(u.id).map(i => i.provider) });

  /* ---------- Weiterleitungs-Anmeldung: /auth/:p → Anbieter → /auth/:p/callback ---------- */
  const FLOW_TTL = 10 * 60e3;
  const authLim = rateLimit({ windowMs: 15 * 60e3, limit: 40, standardHeaders: true, legacyHeaders: false, handler: (req, res) => res.redirect(302, `/login?fehler=${encodeURIComponent("Zu viele Anmeldeversuche. Bitte warte ein paar Minuten.")}`) });
  const bindCookie = { name: "ic_oa", opts: () => ({ httpOnly: true, secure: PROD, sameSite: PROD ? "none" : "lax", maxAge: FLOW_TTL, path: "/auth" }) };
  /* Fehler zurück zur Anmeldung (bzw. beim Verbinden zurück in die Konto-Einstellungen) */
  const failTo = (res, msg, back, md) => md === "link" ? res.redirect(302, `/konto/einstellungen?fehler=${encodeURIComponent(msg)}`)
    : res.redirect(302, `/login?fehler=${encodeURIComponent(msg)}${back && back !== "/konto" ? "&r=" + encodeURIComponent(back) : ""}`);

  /* /auth/<anbieter> startet die Anmeldung; Dateien wie /auth/apple.svg (Markenzeichen) gehen an public/auth/ */
  app.get("/auth/:p", (req, res, next) => /^[a-z]+$/.test(req.params.p) ? authLim(req, res, () => authStart(req, res)) : next());
  function authStart(req, res) {
    const p = req.params.p, R = DEF[p] ? redirectable(p) : null, back = safePath(req.query.r);
    const md = req.query.probe === "1" ? "probe" : req.query.link === "1" ? "link" : "login";
    if (!R) return failTo(res, "Diese Anmeldung ist gerade nicht verfügbar. Bitte nimm eine andere.", back, md);
    /* Immer über die Hauptadresse: das Bindungs-Cookie muss beim Rücksprung auf derselben Adresse liegen */
    if (PROD && BASE_HOST && req.get("host") !== BASE_HOST) return res.redirect(302, BASE + req.originalUrl);
    if (md === "probe" && !X.isAdmin(req.user)) return failTo(res, "Nur für den Admin.", back);
    if (md === "link" && !req.user) return failTo(res, "Bitte melde dich zuerst an.", back);
    let bind = String(cookies(req).ic_oa || ""); if (!/^[\w-]{20,64}$/.test(bind)) bind = rnd(24);
    const state = rnd(24), verifier = R.pkce ? rnd(48) : null, nonce = R.nonce ? rnd(24) : null;
    db.prepare("DELETE FROM auth_flows WHERE created_at<?").run(now() - FLOW_TTL);
    db.prepare("INSERT INTO auth_flows(id,provider,bind,verifier,nonce,ret,mode,uid,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(sha("st|" + state), p, sha(bind), verifier, nonce, md === "probe" ? "/admin" : back, md, md === "login" ? null : req.user.id, now());
    res.cookie(bindCookie.name, bind, bindCookie.opts());
    res.set("Cache-Control", "no-store").set("Referrer-Policy", "no-referrer");
    res.redirect(302, R.openid2 ? steamUrl(R, state) : authorizeUrl(R, { state, nonce, challenge: verifier && s256(verifier) }));
  }
  function takeFlow(p, state, bind) {
    if (!/^[\w-]{20,64}$/.test(String(state || ""))) return null;
    const row = db.prepare("SELECT * FROM auth_flows WHERE id=?").get(sha("st|" + state));
    if (!row) return null;
    db.prepare("DELETE FROM auth_flows WHERE id=?").run(row.id); // nur einmal verwendbar
    if (row.provider !== p || row.created_at < now() - FLOW_TTL) return null;
    const a = Buffer.from(sha(String(bind || ""))), b = Buffer.from(row.bind);
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? row : null;
  }
  const callback = async (req, res, next) => {
    const p = req.params.p; if (!/^[a-z]+$/.test(p) || !DEF[p]) return next();
    let x = {}, flow = null;
    try {
      x = req.method === "POST" ? await formBody(req) : req.query;
      res.set("Cache-Control", "no-store").set("Referrer-Policy", "no-referrer");
      flow = takeFlow(p, x.state, cookies(req).ic_oa);
      if (!flow) return failTo(res, "Die Anmeldung ist abgelaufen. Bitte versuch es noch einmal.");
      const R = rt(p), back = flow.ret || "/konto", md = flow.mode;
      if (!R) return failTo(res, "Diese Anmeldung ist gerade nicht verfügbar.", back, md);
      const cancelled = x.error === "access_denied" || x.error === "user_cancelled_authorize" || x["openid.mode"] === "cancel";
      if (x.error || cancelled) {
        if (!cancelled) console.error(`Anmeldung ${R.name}: Anbieter meldet ${String(x.error).slice(0, 60)}`); // nur protokollieren: diese Antwort kann jeder selbst zusammenbauen
        if (md === "probe") { stSet(p, { probeAt: now(), probe: null, err: cancelled ? "Probe-Anmeldung abgebrochen." : `Probe-Anmeldung: ${R.name} meldet „${String(x.error).slice(0, 60)}“.`, errAt: now() }); return res.redirect(302, `/admin?tab=anmeldung&probe=${p}`); }
        return failTo(res, cancelled ? `Anmeldung mit ${R.name} abgebrochen.` : `${R.name} hat die Anmeldung abgelehnt. Bitte versuch es noch einmal.`, back, md);
      }
      if (R.iss && x.iss && String(x.iss) !== R.iss) return failTo(res, "Die Antwort kam vom falschen Anbieter.", back, md);
      let prof;
      if (R.openid2) prof = await steamCheck(R, x);
      else {
        if (!x.code) return failTo(res, `Anmeldung mit ${R.name} abgebrochen.`, back, md);
        const t = await exchange(R, x.code, flow.verifier);
        prof = await R.profile({ R, c: R.c, U: R.U, t, x, nonce: flow.nonce });
      }
      prof.name = cleanName(prof.name);
      if (flow.mode === "probe") {
        stSet(p, { probeAt: now(), probe: `Probe-Anmeldung erfolgreich · Konto-ID …${String(prof.sub).slice(-4)} · E-Mail ${prof.email ? (prof.verified ? "bestätigt" : "nicht bestätigt") : "nicht geliefert"}`, err: null, errAt: null });
        return res.redirect(302, `/admin?tab=anmeldung&probe=${p}`);
      }
      const out = providerLogin(p, prof, flow.mode === "link" ? flow.uid : null);
      const sess = flow.mode !== "link" || out.merged || !req.user || req.user.id !== out.u.id;
      const u = afterLogin(req, res, p, out, sess);
      if (!R.sim) stOk(p);
      if (flow.mode === "link") return res.redirect(302, `/konto/einstellungen?verbunden=${p}`);
      return res.redirect(302, needsEmail(u) ? `/konto/email?r=${encodeURIComponent(back)}` : back);
    } catch (e) {
      const R = DEF[p], back = (flow && flow.ret) || null, md = flow && flow.mode;
      if (e instanceof AuthErr && e.user) return failTo(res, e.message, back, md);
      if (e instanceof AuthErr && e.code === "cancel") return failTo(res, `Anmeldung mit ${R.name} abgebrochen.`, back, md);
      if (e instanceof AuthErr) { console.error(`Anmeldung ${R.name}: ${e.message} (${e.code || "-"})`); if (!(rt(p) || {}).sim) { if (e.cfg) stErr(p, `${R.name} lehnt die Zugangsdaten ab (${e.code}). Der Knopf ist im Shop ausgeblendet, bis Client-ID und Secret stimmen.`, true); else if (e.code === "id_token") stErr(p, `ID-Token abgelehnt: ${e.message}.`); } }
      else console.error(`Anmeldung ${R.name}:`, e && e.message);
      if (md === "probe") { stSet(p, { probeAt: now(), probe: null, err: `Probe-Anmeldung fehlgeschlagen: ${e.message}`.slice(0, 300), errAt: now() }); return res.redirect(302, `/admin?tab=anmeldung&probe=${p}`); }
      return failTo(res, `Die Anmeldung mit ${R.name} hat nicht geklappt. Bitte versuch es noch einmal oder nimm eine andere Anmeldung.`, back, md);
    }
  };
  app.get("/auth/:p/callback", authLim, callback);
  app.post("/auth/:p/callback", authLim, callback);

  /* ---------- Google-Knopf (GIS, nur Client-ID): ID-Token aus dem Browser, geprüft bei Google ---------- */
  const lim = X.lim;
  app.post("/api/auth/google", lim, wrap(async (req, res) => {
    const cid = gisClientId(); if (!cid) return bad(res, "Google-Login ist noch nicht eingerichtet.");
    const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(String(req.body.credential || "")), { signal: AbortSignal.timeout(10000) });
    const P = await r.json().catch(() => ({}));
    if (!r.ok || P.aud !== cid || !["accounts.google.com", "https://accounts.google.com"].includes(P.iss) || !(Number(P.exp) * 1000 > now())) return bad(res, "Google-Anmeldung fehlgeschlagen.");
    let out; try { out = providerLogin("google", { sub: P.sub, email: P.email, verified: String(P.email_verified) === "true", name: P.name }, null); }
    catch (e) { return bad(res, e.user ? e.message : "Google-Anmeldung fehlgeschlagen."); }
    if (P.sub) db.prepare("UPDATE users SET google_sub=? WHERE id=? AND (google_sub IS NULL OR google_sub='')").run(String(P.sub), out.u.id);
    const u = afterLogin(req, res, "google", out); stOk("google");
    res.json({ ok: true, user: pub(userById(u.id)), needsEmail: needsEmail(u) });
  }));

  /* ---------- SMS-Code (Twilio Verify) ---------- */
  const telNorm = t => { let d = String(t || "").replace(/[^\d+]/g, ""); if (d.startsWith("00")) d = "+" + d.slice(2); else if (d.startsWith("0")) d = "+49" + d.slice(1); else if (!d.startsWith("+")) d = "+" + d; return /^\+[1-9]\d{7,14}$/.test(d) ? d : null; };
  const simSms = [];
  async function twilio(R, path, body) {
    if (R.sim) {
      if (path === "Verifications") { const code = String(crypto.randomInt(100000, 1000000)); simSms.unshift({ to: body.To, code, at: now() }); simSms.length = Math.min(simSms.length, 50); return { ok: true, status: "pending" }; }
      const hit = simSms.find(s => s.to === body.To && s.at > now() - 10 * 60e3); return { ok: true, status: hit && hit.code === String(body.Code) ? "approved" : "pending" };
    }
    const r = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(R.c.serviceSid)}/${path}`, { method: "POST", signal: AbortSignal.timeout(12000),
      headers: { Authorization: "Basic " + Buffer.from(`${R.c.accountSid}:${R.c.authToken}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
    const j = await r.json().catch(() => ({})); return Object.assign({ ok: r.ok, httpStatus: r.status }, j);
  }
  const smsLim = rateLimit({ windowMs: 15 * 60e3, limit: 6, standardHeaders: true, legacyHeaders: false, message: { error: "Zu viele SMS angefordert. Bitte warte ein paar Minuten." } });
  app.post("/api/auth/sms/send", smsLim, wrap(async (req, res) => {
    const R = rt("sms"); if (!R) return bad(res, "Die Anmeldung per SMS ist noch nicht eingerichtet.");
    const to = telNorm(req.body.phone); if (!to) return bad(res, "Bitte gib eine gültige Handynummer ein, z. B. 0151 2345678.");
    /* pro Nummer: höchstens 3 SMS in 15 Minuten und 8 am Tag (Kosten, SMS-Pumping) */
    const h = sha("sms|" + to), day = db.prepare("SELECT COUNT(*) n FROM tokens WHERE kind='sms_sent' AND hash=? AND expires_at>?").get(h, now()).n,
      recent = db.prepare("SELECT COUNT(*) n FROM tokens WHERE kind='sms_sent' AND hash=? AND expires_at>?").get(h, now() + 864e5 - 15 * 60e3).n;
    if (recent >= 3 || day >= 8) return bad(res, "Für diese Nummer wurden schon mehrere Codes geschickt. Bitte warte etwas und versuch es dann noch einmal.", 429);
    const r = await twilio(R, "Verifications", { To: to, Channel: "sms", Locale: "de" });
    if (!r.ok) { console.error(`Twilio: Senden abgelehnt (HTTP ${r.httpStatus}, Fehler ${r.code || "-"})`); if ((r.httpStatus === 401 || r.httpStatus === 404) && !R.sim) stErr("sms", `Twilio lehnt ab (HTTP ${r.httpStatus}) – SID, Token und Verify Service SID prüfen. Der Knopf ist im Shop ausgeblendet, bis es stimmt.`, true);
      return bad(res, r.code === 60200 || r.code === 60205 ? "Diese Nummer kann keine SMS empfangen. Prüfe die Nummer." : "Die SMS konnte nicht gesendet werden. Prüfe die Nummer und versuch es noch einmal."); }
    db.prepare("INSERT INTO tokens(user_id,kind,hash,expires_at,used) VALUES(NULL,'sms_sent',?,?,1)").run(h, now() + 864e5);
    if (!R.sim) stOk("sms");
    res.json({ ok: true, phone: to });
  }));
  app.post("/api/auth/sms/verify", lim, wrap(async (req, res) => {
    const R = rt("sms"); if (!R) return bad(res, "Die Anmeldung per SMS ist noch nicht eingerichtet.");
    const to = telNorm(req.body.phone), code = String(req.body.code || "").replace(/\D/g, "");
    if (!to || code.length < 4 || code.length > 10) return bad(res, "Bitte gib den Code aus der SMS ein.");
    const r = await twilio(R, "VerificationCheck", { To: to, Code: code });
    if (!r.ok || r.status !== "approved") return bad(res, "Der Code stimmt nicht oder ist abgelaufen.");
    let out; try { out = providerLogin("sms", { sub: to, email: null, verified: false, name: `Kunde ···${to.slice(-4)}` }, req.user && req.body.link === true ? req.user.id : null); }
    catch (e) { return bad(res, e.user ? e.message : "Anmeldung fehlgeschlagen."); }
    const u = afterLogin(req, res, "sms", out, !(req.user && req.body.link === true && !out.merged));
    res.json({ ok: true, user: pub(userById(u.id)), needsEmail: needsEmail(u) });
  }));

  /* ---------- E-Mail nachtragen (Konten von Steam, Handy, Microsoft, Amazon …) ---------- */
  const mailLim = rateLimit({ windowMs: 15 * 60e3, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: "Zu viele Codes angefordert. Bitte warte ein paar Minuten." } });
  app.post("/api/auth/email/send", mailLim, need, wrap(async (req, res) => {
    if (!isPh(req.user.email)) return bad(res, "Deine E-Mail-Adresse ist schon bestätigt.");
    const e = norm(req.body.email); if (!emailOk(e)) return bad(res, "Bitte gib eine gültige E-Mail-Adresse ein.");
    const code = String(crypto.randomInt(100000, 1000000));
    db.prepare("UPDATE tokens SET used=1 WHERE user_id=? AND kind='addmail'").run(req.user.id);
    db.prepare("INSERT INTO tokens(user_id,kind,hash,expires_at) VALUES(?,?,?,?)").run(req.user.id, "addmail", `${sha(e)}:${sha(e + "|" + code)}`, now() + 15 * 60e3);
    await mail.verify(e, req.user.name, code);
    res.json({ ok: true });
  }));
  app.post("/api/auth/email/verify", lim, need, wrap(async (req, res) => {
    if (!isPh(req.user.email)) return res.json({ ok: true, user: pub(req.user) });
    const e = norm(req.body.email), code = String(req.body.code || "").replace(/\D/g, "");
    const t = db.prepare("SELECT * FROM tokens WHERE user_id=? AND kind='addmail' AND used=0 AND expires_at>? ORDER BY id DESC").get(req.user.id, now());
    if (!t || t.tries >= 5) return bad(res, "Der Code ist abgelaufen. Fordere einen neuen an.");
    if (!t.hash.startsWith(sha(e) + ":")) return bad(res, "Der Code gehört zu einer anderen Adresse. Fordere für diese Adresse einen neuen an.");
    if (t.hash !== `${sha(e)}:${sha(e + "|" + code)}`) { db.prepare("UPDATE tokens SET tries=tries+1 WHERE id=?").run(t.id); return bad(res, "Der Code stimmt nicht."); }
    db.prepare("UPDATE tokens SET used=1 WHERE id=?").run(t.id);
    const provs = identsOf(req.user.id).map(i => NAMES[i.provider] || i.provider), r = attachEmail(req.user, e);
    if (r.merged) startSession(res, r.u.id);
    linkOrders(r.u.id, r.u.email);
    safe(r.merged ? mail.loginLinked(r.u.email, r.u.name, provs.join(", ") || "Anmeldung", req.get("user-agent") || "") : mail.welcome(r.u.email, r.u.name));
    res.json({ ok: true, merged: r.merged, user: pub(r.u) });
  }));
  /* Bestell-E-Mail im Warenkorb bestätigt (server.js) → auch ins Konto ohne E-Mail übernehmen */
  function checkoutEmailVerified(req, res, e) {
    if (!req.user || !isPh(req.user.email)) return null;
    const r = attachEmail(req.user, e); if (r.merged) startSession(res, r.u.id); linkOrders(r.u.id, r.u.email);
    if (!r.merged) safe(mail.welcome(r.u.email, r.u.name));
    return r.u;
  }

  /* ---------- Konto › Einstellungen: verbundene Anmeldungen ---------- */
  app.get("/api/auth/links", need, (req, res) => res.set("Cache-Control", "no-store").json({ links: identsOf(req.user.id).map(i => ({ provider: i.provider, name: NAMES[i.provider] || i.provider,
    email: i.email && !isPh(i.email) ? i.email : null, created_at: i.created_at, last_at: i.last_at })), hasEmail: !isPh(req.user.email) }));
  app.delete("/api/auth/links/:p", lim, need, (req, res) => {
    const p = String(req.params.p), mine = identsOf(req.user.id);
    if (!mine.some(i => i.provider === p)) return bad(res, "Diese Anmeldung ist nicht verbunden.", 404);
    const pk = db.prepare("SELECT COUNT(*) n FROM passkeys WHERE user_id=?").get(req.user.id).n;
    if (isPh(req.user.email) && mine.length <= 1 && !pk) return bad(res, "Das ist deine einzige Anmeldung. Bestätige zuerst eine E-Mail-Adresse oder verbinde eine andere Anmeldung.");
    db.prepare("DELETE FROM idents WHERE user_id=? AND provider=?").run(req.user.id, p);
    if (p === "google") db.prepare("UPDATE users SET google_sub=NULL WHERE id=?").run(req.user.id);
    res.json({ ok: true, links: identsOf(req.user.id).map(i => i.provider) });
  });

  /* ---------- Öffentlich: welche Wege der Shop zeigt (nur eingerichtete bzw. in der Vorschau simulierte) ---------- */
  function methods() {
    const o = { code: !!E.RESEND_API_KEY || !PROD, passkey: pkRp() };
    for (const p of ORDER) o[p] = !hidden(p) && (p === "google" ? !!(redirectable("google") || gisClientId()) : !!mode(p));
    o.sim = SIM ? ORDER.filter(p => mode(p) === "sim") : [];
    return o;
  }

  /* ---------- Admin: Status, Speichern, Testen ---------- */
  const GUIDE = {
    google: { url: "https://console.cloud.google.com/apis/credentials", link: "Google Cloud Console › Anmeldedaten", cost: "kostenlos",
      note: "Liefert eine von Google bestätigte E-Mail. Ohne Clientschlüssel zeigt der Shop den Knopf von Google (nur Client-ID nötig).",
      steps: ["In der Google Cloud Console ein Projekt anlegen (oder auswählen).", "„Google Auth Platform“ › „Branding“: App-Name „instantcodes“, Support-E-Mail, Links zu Startseite, Datenschutz und AGB, autorisierte Domain „instantcodes.de“. Ein Logo ist freiwillig – mit Logo prüft Google die Marke (einige Tage).", "„Zielgruppe“: „Extern“ wählen und die App veröffentlichen („In Produktion“), sonst können sich nur Testnutzer anmelden. Für Name und E-Mail ist keine Google-Prüfung nötig.", "„Clients“ › „Client erstellen“ › Typ „Webanwendung“.", "Unter „Autorisierte JavaScript-Quellen“ beide Adressen unten eintragen.", "Unter „Autorisierte Weiterleitungs-URIs“ die Redirect-URI unten eintragen.", "Client-ID und Clientschlüssel kopieren, hier einfügen, speichern, „Testen“, dann „Probe-Anmeldung“."] },
    discord: { url: "https://discord.com/developers/applications", link: "Discord Developer Portal", cost: "kostenlos",
      note: "Liefert die E-Mail mit Bestätigungsstatus. Unbestätigte Adressen bestätigt der Kunde einmal per Code.",
      steps: ["Im Discord Developer Portal „New Application“ anlegen, Name „instantcodes“.", "Unter „General Information“ App-Symbol, Beschreibung sowie Links zu AGB und Datenschutz eintragen.", "Links „OAuth2“ öffnen.", "Unter „Redirects“ die Redirect-URI unten eintragen und speichern.", "„Client ID“ kopieren, bei „Client Secret“ auf „Reset Secret“ tippen und den Wert kopieren.", "Beides hier einfügen, speichern und „Testen“."] },
    microsoft: { url: "https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade", link: "Microsoft Entra › App-Registrierungen", cost: "kostenlos (Microsoft-Konto nötig)",
      note: "Für private Microsoft-Konten (auch Xbox). Microsoft bestätigt die E-Mail nicht verbindlich – Kunden bestätigen sie beim ersten Mal per Code. Der Clientschlüssel läuft ab (höchstens 24 Monate): rechtzeitig erneuern.",
      steps: ["Im Microsoft Entra Admin Center (entra.microsoft.com) mit einem Microsoft-Konto anmelden – falls Microsoft ein Verzeichnis verlangt, ein kostenloses Azure-Konto anlegen. Dann „App-Registrierungen“ › „Neue Registrierung“.", "Name „instantcodes“, unterstützte Kontotypen: „Nur persönliche Microsoft-Konten“.", "Umleitungs-URI: Plattform „Web“, die Redirect-URI unten eintragen, „Registrieren“.", "Die „Anwendungs-ID (Client)“ kopieren.", "„Zertifikate & Geheimnisse“ › „Neuer geheimer Clientschlüssel“, Laufzeit 24 Monate, den WERT (nicht die ID) kopieren.", "Unter „Branding & Eigenschaften“ Logo sowie Links zu AGB und Datenschutz eintragen.", "Beides hier einfügen, speichern, „Testen“. Erinnerung für das Ablaufdatum setzen."] },
    twitch: { url: "https://dev.twitch.tv/console/apps", link: "Twitch Developer Console", cost: "kostenlos (Zwei-Faktor-Anmeldung bei Twitch nötig)",
      note: "Liefert die E-Mail mit Bestätigungsstatus (OpenID Connect).",
      steps: ["Bei Twitch die Zwei-Faktor-Anmeldung einschalten (Pflicht für Entwickler).", "In der Twitch Developer Console „Register Your Application“ öffnen.", "Name „instantcodes“, OAuth Redirect URL: die Redirect-URI unten.", "Kategorie „Website Integration“, Client-Typ „Confidential“, „Create“.", "Die App über „Manage“ öffnen, „Client ID“ kopieren, „New Secret“ erzeugen und kopieren.", "Beides hier einfügen, speichern, „Testen“."] },
    paypal: { url: "https://developer.paypal.com/dashboard/applications/live", link: "PayPal Developer Dashboard", cost: "kostenlos, PayPal prüft die App (bis zu 7 Werktage)",
      note: "„Log in with PayPal“. Liefert die E-Mail mit Bestätigungsstatus. Erst die Sandbox testen, dann Live-App eintragen.",
      steps: ["Im PayPal Developer Dashboard oben auf „Live“ schalten und „Create App“ wählen (Typ „Merchant“).", "Client ID und Secret kopieren.", "In der App unter „Features“ „Log in with PayPal“ aktivieren und „Advanced Settings“ öffnen.", "Return URL: die Redirect-URI unten eintragen.", "Bei den Daten „Full name“ und „Email“ anhaken, Links zu Datenschutz und AGB eintragen, speichern.", "Die App zur Prüfung einreichen (Live). Bis zur Freigabe kann der Sandbox-Schalter hier mit Sandbox-Zugangsdaten testen.", "Client ID und Secret hier einfügen, speichern, „Testen“."] },
    amazon: { url: "https://developer.amazon.com/loginwithamazon/console/site/lwa/overview.html", link: "Login with Amazon Console", cost: "kostenlos (Amazon-Entwicklerkonto nötig)",
      note: "Amazon nennt keinen Bestätigungsstatus der E-Mail – Kunden bestätigen sie beim ersten Mal per Code.",
      steps: ["In der Login-with-Amazon-Konsole ein „Security Profile“ anlegen (Name, Beschreibung, Link zur Datenschutzerklärung, Logo).", "Das Profil öffnen › „Web Settings“ › „Edit“.", "„Allowed Origins“: die Shop-Adresse unten eintragen.", "„Allowed Return URLs“: die Redirect-URI unten eintragen, speichern.", "Client ID und Client Secret kopieren.", "Beides hier einfügen, speichern, „Testen“."] },
    steam: { url: "https://steamcommunity.com/dev/apikey", link: "Steam Web API Key (optional)", cost: "kostenlos, keine Anmeldung der App nötig",
      note: "Steam liefert keine E-Mail: Kunden bestätigen ihre E-Mail einmal per Code, erst dann zählt sie für Bestellungen. Der API-Schlüssel ist nur für den Spielernamen.",
      steps: ["Steam braucht keine App-Registrierung: Schalter „Anmeldung mit Steam anbieten“ einschalten und speichern.", "Optional für den Spielernamen: auf steamcommunity.com/dev/apikey mit einem Steam-Konto anmelden (mind. 5 $ ausgegeben).", "Als Domain „instantcodes.de“ eintragen, Bedingungen akzeptieren, „Registrieren“.", "Den Schlüssel kopieren, hier einfügen, speichern.", "„Testen“ prüft, ob Steam erreichbar ist (und den Schlüssel)."] },
    sms: { url: "https://console.twilio.com/us1/develop/verify/services", link: "Twilio Console › Verify", cost: "kostenpflichtig pro SMS (Twilio-Preise, Guthaben aufladen)",
      note: "Code per SMS über Twilio Verify (Betrugsschutz „Fraud Guard“ ist dort an). Handy-Konten bestätigen ihre E-Mail einmal per Code.",
      steps: ["Bei Twilio ein Konto anlegen und auf ein bezahltes Konto umstellen (Guthaben aufladen).", "In der Console „Verify“ › „Services“ › „Create new“: Name „instantcodes“, Kanal „SMS“ aktivieren.", "Die „Service SID“ (beginnt mit VA) kopieren.", "Auf der Startseite der Console „Account SID“ (AC…) und „Auth Token“ kopieren.", "Unter „Verify“ › „Settings“ › „Geo permissions“ Deutschland (und weitere Länder, aus denen Kunden kommen) erlauben.", "Alles hier einfügen, speichern, „Testen“ (prüft die Zugangsdaten, ohne SMS zu senden)."] },
    apple: { url: "https://developer.apple.com/account/resources/identifiers/list/serviceId", link: "Apple Developer › Identifiers", cost: "Apple Developer Program, 99 $ pro Jahr",
      note: "Liefert eine bestätigte E-Mail (auch „E-Mail verbergen“). Damit Mails an …@privaterelay.appleid.com ankommen: Absender-Domain unter „Sign in with Apple for Email Communication“ eintragen.",
      steps: ["Im Apple Developer Program (99 $/Jahr) unter „Identifiers“ eine App ID mit „Sign in with Apple“ anlegen (oder vorhandene nutzen).", "„Identifiers“ › „+“ › „Services IDs“: Beschreibung „instantcodes“, Kennung z. B. de.instantcodes.login.", "Die Services ID öffnen, „Sign in with Apple“ anhaken › „Configure“: App ID wählen, Domains und Return URL unten eintragen, speichern.", "„Keys“ › „+“: Name „instantcodes Login“, „Sign in with Apple“ anhaken, App ID wählen, registrieren.", "Die .p8-Datei herunterladen (geht nur einmal) und die Key ID notieren. Die Team ID steht oben rechts im Konto.", "Unter „Services“ › „Sign in with Apple for Email Communication“ die Absender-Domain und -Adresse der Shop-Mails eintragen (Apple prüft SPF/DKIM), sonst kommen Mails an „E-Mail verbergen“-Adressen nicht an.", "Services ID, Team ID, Key ID und .p8-Datei hier eintragen, speichern, „Testen“."] },
  };
  const ADMIN_ORDER = ["google", "discord", "microsoft", "twitch", "paypal", "amazon", "steam", "sms", "apple"];
  const lastN = (v, n = 4) => String(v || "").length >= 12 ? "…" + String(v).slice(-n) : "";
  function adminView(p) {
    const D = DEF[p], c = conf(p), s = stored(p), st = stGet(p) || {}, ok = D.ready(c), m = mode(p);
    const missing = D.fields.filter(f => !f.opt && f.type !== "switch" && !c[f.k]).map(f => f.label);
    const status = s.__bad ? "error" : ok ? (st.err && st.errAt > (st.okAt || 0) ? "error" : "ok") : "missing";
    const fields = D.fields.map(f => {
      const o = { k: f.k, label: f.label, type: f.type || (f.secret ? "secret" : "text"), secret: !!f.secret, opt: !!f.opt, ph: f.ph || "", accept: f.accept || "", env: c.src[f.k] === "env" ? f.env : null, envName: f.env || null, set: f.type === "switch" ? !!c[f.k] : !!c[f.k] };
      if (f.type === "switch") o.value = !!c[f.k];
      else if (f.secret) o.hint = c[f.k] ? (f.type === "file" ? "gesetzt" : (lastN(c[f.k]) ? "gesetzt · " + lastN(c[f.k]) : "gesetzt")) : "";
      else o.value = c[f.k] || "";
      return o;
    });
    const redirect = p === "sms" ? [] : p === "steam" ? [{ label: "Rücksprung (return_to) – nichts einzutragen", v: CB(p) }] : [{ label: p === "apple" ? "Return URL" : p === "amazon" ? "Allowed Return URL" : p === "microsoft" ? "Umleitungs-URI (Web)" : p === "twitch" ? "OAuth Redirect URL" : p === "paypal" ? "Return URL" : p === "discord" ? "Redirect" : "Autorisierte Weiterleitungs-URI", v: CB(p) }];
    const extra = p === "google" ? [{ label: "Autorisierte JavaScript-Quelle", v: ORIGIN }].concat(ALT ? [{ label: "Autorisierte JavaScript-Quelle", v: ALT }] : [])
      : p === "apple" ? [{ label: "Domain", v: new URL(ORIGIN).host }].concat(ALT ? [{ label: "Domain", v: new URL(ALT).host }] : [])
      : p === "amazon" ? [{ label: "Allowed Origin", v: ORIGIN }] : p === "steam" ? [{ label: "Realm (Domain)", v: ORIGIN }] : [];
    return { id: p, name: D.name, status, sim: m === "sim", gis: p === "google" && ok && !c.clientSecret, missing, decryptError: !!s.__bad, fields, redirect, origins: extra,
      guide: GUIDE[p], last: { okAt: st.okAt || null, err: st.err || null, errAt: st.errAt || null, test: st.test || null, testOk: st.testOk == null ? null : !!st.testOk, testAt: st.testAt || null, probe: st.probe || null, probeAt: st.probeAt || null },
      canProbe: !!redirectable(p) };
  }
  app.get("/api/admin/auth", admin, (req, res) => {
    res.set("Cache-Control", "no-store").json({ base: BASE, origin: ORIGIN, alt: ALT, sim: SIM, live: LIVE, mail: !!E.RESEND_API_KEY, passkey: pkRp(), providers: ADMIN_ORDER.map(adminView) });
  });
  app.post("/api/admin/auth/:p", admin, (req, res) => {
    const p = String(req.params.p), D = DEF[p]; if (!D) return bad(res, "Unbekannter Anbieter.", 404);
    const vals = (req.body && typeof req.body.values === "object" && req.body.values) || {}, clear = Array.isArray(req.body && req.body.clear) ? req.body.clear.map(String) : [];
    const s = Object.assign({}, stored(p)); delete s.__bad; const changed = [];
    for (const f of D.fields) {
      if (clear.includes(f.k)) { if (s[f.k] != null) { delete s[f.k]; changed.push(f.k); } continue; }
      if (!(f.k in vals)) continue;
      if (f.type === "switch") { const v = !!vals[f.k]; if (s[f.k] !== v) { s[f.k] = v; changed.push(f.k); } continue; }
      let v = String(vals[f.k] == null ? "" : vals[f.k]).trim();
      if (!v) { if (!f.secret && s[f.k] != null) { delete s[f.k]; changed.push(f.k); } continue; } // leeres Geheimfeld = unverändert
      if (f.k === "privateKey") { v = pemFix(v); if (v.length > 8000 || !appleKeyOk(v)) return bad(res, "Das ist kein gültiger Schlüssel aus einer .p8-Datei von Apple (EC P-256)."); }
      else if (f.re && !f.re.test(v)) return bad(res, `${f.label}: Das Format stimmt nicht. Bitte kopiere den Wert noch einmal ohne Leerzeichen.`);
      else if (f.secret && !RE_SECRET.test(v)) return bad(res, `${f.label}: Das Format stimmt nicht. Bitte kopiere den Wert noch einmal.`);
      else if (v.length > 512) return bad(res, `${f.label} ist zu lang.`);
      if (s[f.k] !== v) { s[f.k] = v; changed.push(f.k); }
    }
    if (Object.keys(s).length) kvSet("auth:" + p, seal(p, s)); else kvDel("auth:" + p);
    delete STORE[p]; jwksCache.clear();
    if (changed.length) { stSet(p, { err: null, errAt: null, cfgErr: null, test: null, testOk: null, testAt: null }); console.log(`Admin: Anmeldung ${D.name} geändert (${changed.join(", ")}) von ${req.user.email}`); }
    res.json({ ok: true, changed: changed.length, provider: adminView(p) });
  });
  app.delete("/api/admin/auth/:p", admin, (req, res) => {
    const p = String(req.params.p); if (!DEF[p]) return bad(res, "Unbekannter Anbieter.", 404);
    kvDel("auth:" + p); kvDel("authst:" + p); delete STORE[p];
    console.log(`Admin: gespeicherte Zugangsdaten für ${DEF[p].name} entfernt von ${req.user.email}`);
    res.json({ ok: true, provider: adminView(p) });
  });
  const testLim = rateLimit({ windowMs: 15 * 60e3, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Zu viele Tests. Bitte warte ein paar Minuten." } });
  /* Testen ohne Anmeldung: Authorize-Adresse bauen und beim Anbieter prüfen, ob Client-ID und Secret stimmen
     (Token-Anfrage mit einem absichtlich ungültigen Code: „invalid_grant“ = Zugangsdaten gültig, „invalid_client“ = falsch) */
  async function testProvider(p) {
    const D = DEF[p], R = rt(p);
    if (!R) { const c = conf(p); return { ok: false, msg: `Es fehlt noch: ${D.fields.filter(f => !f.opt && f.type !== "switch" && !c[f.k]).map(f => f.label).join(", ") || "Anbieter einschalten"}.` }; }
    if (p === "sms") {
      if (R.sim) return { ok: true, msg: "Simulation: SMS-Codes erscheinen unter /__sim/sms.json (nur Vorschau)." };
      const r = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(R.c.serviceSid)}`, { headers: { Authorization: "Basic " + Buffer.from(`${R.c.accountSid}:${R.c.authToken}`).toString("base64") }, signal: AbortSignal.timeout(10000) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) return { ok: true, msg: `Twilio Verify erreichbar: Dienst „${String(j.friendly_name || "").slice(0, 40)}“. Es wurde keine SMS gesendet.` };
      return { ok: false, msg: r.status === 401 ? "Twilio lehnt Account SID oder Auth Token ab." : r.status === 404 ? "Die Verify Service SID gibt es in diesem Twilio-Konto nicht." : `Twilio antwortet mit HTTP ${r.status}.` };
    }
    if (p === "steam") {
      const url = steamUrl(R, "test-" + rnd(8));
      if (R.sim) return { ok: true, msg: "Simulation: Steam-Anmeldung läuft gegen den Vorschau-Simulator.", url };
      const r = await fetch("https://steamcommunity.com/openid", { signal: AbortSignal.timeout(10000) }).catch(() => null);
      if (!r || !r.ok) return { ok: false, msg: "Steam ist gerade nicht erreichbar." };
      if (R.c.apiKey) { const k = await fetch(`${R.U.api}/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(R.c.apiKey)}&steamids=76561197960435530`, { signal: AbortSignal.timeout(10000) }).catch(() => null);
        if (!k || !k.ok) return { ok: false, msg: `Steam ist erreichbar, aber der Web API Key wird abgelehnt (HTTP ${k ? k.status : "–"}).`, url }; }
      return { ok: true, msg: `Steam-Anmeldung erreichbar${R.c.apiKey ? ", Web API Key gültig" : ""}.`, url };
    }
    if (p === "google" && !R.sim && !R.c.clientSecret) return { ok: true, msg: "Client-ID gesetzt: Der Shop zeigt den Knopf von Google. Für die Prüfung beim Anbieter und den einheitlichen Knopf bitte auch den Clientschlüssel eintragen." };
    if (p === "apple") { try { appleSecret(R.c); } catch (e) { return { ok: false, msg: "Mit dem .p8-Schlüssel lässt sich nicht signieren. Bitte die Datei neu hochladen." }; } }
    const state = "test-" + rnd(12), url = authorizeUrl(R, { state, nonce: R.nonce ? rnd(12) : null, challenge: R.pkce ? s256(rnd(32)) : null });
    let res;
    try { res = await tokenCall(R, Object.assign({ grant_type: "authorization_code", code: "instantcodes-verbindungstest", redirect_uri: CB(p) }, R.pkce ? { code_verifier: rnd(48) } : {})); }
    catch (e) { return { ok: false, msg: `${D.name} ist gerade nicht erreichbar (${e.name === "TimeoutError" ? "Zeitüberschreitung" : "Netzwerk"}).`, url }; }
    const { status, j } = res, err = String(j.error || j.message || "").slice(0, 80);
    if (isCfgErr(status, j)) return { ok: false, msg: `${D.name} lehnt die Zugangsdaten ab (${err || "HTTP " + status}). Client-ID und Secret prüfen.`, url };
    if (status === 400 || /invalid_grant|invalid_request|authorization code/i.test(err)) return { ok: true, msg: `${R.sim ? "Simulation: " : ""}Zugangsdaten gültig – ${D.name} hat den Test-Code wie erwartet abgelehnt (${err || "HTTP 400"}). Zum Schluss einmal „Probe-Anmeldung“ machen.`, url };
    return { ok: false, msg: `Unerwartete Antwort von ${D.name} (HTTP ${status}${err ? ", " + err : ""}).`, url };
  }
  app.post("/api/admin/auth/:p/test", admin, testLim, wrap(async (req, res) => {
    const p = String(req.params.p); if (!DEF[p]) return bad(res, "Unbekannter Anbieter.", 404);
    const r = await testProvider(p), R = rt(p);
    stSet(p, { test: r.msg, testOk: !!r.ok, testAt: now() });
    if (R && !R.sim) stSet(p, r.ok ? { err: null, errAt: null, cfgErr: null } : { err: r.msg, errAt: now() });
    res.json(Object.assign(r, { provider: adminView(p) }));
  }));

  /* ---------- Vorschau-Simulator (nie live) ---------- */
  if (SIM) {
    const sc = { codes: new Map(), tokens: new Map(), seen: new Set() };
    const H = s => String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    const signJwt = P => { const b = o => Buffer.from(JSON.stringify(o)).toString("base64url"), d = b({ alg: "RS256", kid: "sim-1", typ: "JWT" }) + "." + b(P);
      return d + "." + crypto.sign("sha256", Buffer.from(d), SIMK.rsa.privateKey).toString("base64url"); };
    const page = (title, inner) => `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${H(title)} · Simulation</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px 16px;font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0E1014;
background:repeating-linear-gradient(135deg,#FFF8E6 0 18px,#FFF2D1 18px 36px)}
.w{width:100%;max-width:420px;background:#fff;border-radius:22px;padding:22px 20px;box-shadow:0 0 0 1px rgba(14,16,20,.08),0 30px 60px -30px rgba(14,16,20,.35)}
.sim{display:flex;gap:8px;align-items:center;margin:0 0 16px;padding:9px 12px;border-radius:12px;background:#B86E00;color:#fff;font-weight:650;font-size:13px;letter-spacing:.02em}
.sim small{display:block;font-weight:450;opacity:.92;letter-spacing:0}.hd{display:flex;align-items:center;gap:12px;margin-bottom:6px}.hd img{width:40px;height:40px;object-fit:contain}
h1{font-size:20px;margin:0;letter-spacing:-.02em}p{margin:6px 0 14px;color:#474D59;font-size:14px}label{display:block;margin:12px 0 6px;font-size:13px;color:#474D59;font-weight:550}
input[type=text],input[type=email]{width:100%;min-height:44px;padding:0 14px;border-radius:12px;border:1px solid rgba(14,16,20,.16);font:inherit}
.chk{display:flex;gap:8px;align-items:center;margin-top:12px;font-weight:500;color:#0E1014}.row{display:flex;gap:8px;margin-top:18px}
button{flex:1;min-height:46px;border-radius:999px;border:0;font:inherit;font-weight:600;cursor:pointer}.ok{background:#0E1014;color:#fff}.no{background:#F1F2F4;color:#0E1014}
.fine{margin-top:14px;font-size:12px;color:#656B78}</style></head><body><main class="w">
<div class="sim" role="note"><span>SIMULATION<small>Nur Vorschau – keine echte Verbindung zum Anbieter</small></span></div>${inner}</main></body></html>`;
    const LOGO = p => `/auth/${p === "apple" ? "apple" : p}.svg`;
    /* Einwilligungsseite wie beim Anbieter: E-Mail, Bestätigt, Name, Konto-ID */
    app.get("/__sim/auth/:p/authorize", (req, res) => {
      const p = String(req.params.p), D = DEF[p], q = req.query;
      if (!D || p === "steam" || p === "sms") return res.status(404).end();
      if (q.client_id !== `sim-${p}` || q.redirect_uri !== CB(p) || !q.state) return res.status(400).type("text/plain").send("Simulation: client_id oder redirect_uri stimmt nicht (" + H(q.redirect_uri) + ")");
      const em = String(q.sim_email || `kunde.${p}@example.com`), noVerFlag = ["microsoft", "amazon"].includes(p);
      const keep = ["state", "nonce", "code_challenge", "code_challenge_method", "response_mode", "redirect_uri", "client_id"].map(k => q[k] ? `<input type="hidden" name="${k}" value="${H(q[k])}">` : "").join("");
      if (q.sim_auto === "1") return simApprove(req, res, p, Object.assign({}, q, { decision: "ok", email: em, verified: q.sim_verified == null ? "1" : q.sim_verified, name: q.sim_name || `Sim ${D.short}`, sub: q.sim_sub || "" }));
      res.set("Cache-Control", "no-store").type("html").send(page(D.name, `<div class="hd"><img src="${LOGO(p)}" alt=""><h1>Mit ${H(D.short)} anmelden</h1></div>
<p><b>instantcodes</b> möchte deinen Namen und deine E-Mail-Adresse von ${H(D.short)} erhalten.</p>
<form method="post" action="/__sim/auth/${p}/authorize">${keep}
<label for="em">E-Mail beim Anbieter</label><input type="email" id="em" name="email" value="${H(em)}">
${noVerFlag ? `<p class="fine">${H(D.short)} meldet nicht, ob die E-Mail bestätigt ist. Der Shop fragt danach einmal nach einem Code.</p>` : `<label class="chk"><input type="checkbox" name="verified" value="1" checked> E-Mail ist bei ${H(D.short)} bestätigt</label>`}
<label for="nm">Name</label><input type="text" id="nm" name="name" value="Sim ${H(D.short)}">
<label for="sb">Konto-ID beim Anbieter (leer = aus der E-Mail)</label><input type="text" id="sb" name="sub" value="">
<div class="row"><button class="no" name="decision" value="no" type="submit">Abbrechen</button><button class="ok" name="decision" value="ok" type="submit">Zulassen</button></div></form>
<p class="fine">Diese Seite gibt es nur in der Vorschau. Live öffnet sich hier ${H(D.name)}.</p>`));
    });
    function simApprove(req, res, p, b) {
      const back = new URL(CB(p));
      if (b.decision !== "ok") { back.searchParams.set("error", p === "apple" ? "user_cancelled_authorize" : "access_denied"); back.searchParams.set("state", String(b.state || "")); return sendBack(res, p, back, b); }
      const email = norm(b.email || ""), sub = String(b.sub || "").trim() || "sim-" + sha(p + "|" + email).slice(0, 16), code = rnd(24);
      sc.codes.set(code, { p, at: now(), redirect: String(b.redirect_uri || ""), challenge: b.code_challenge || null, nonce: b.nonce || null,
        prof: { sub, email: email || null, verified: ["microsoft", "amazon"].includes(p) ? false : String(b.verified) === "1", name: cleanName(b.name) } });
      back.searchParams.set("code", code); back.searchParams.set("state", String(b.state || ""));
      if (p === "discord") back.searchParams.set("iss", "https://discord.com"); // wie RFC 9207
      if (p === "apple" && !sc.seen.has(sub)) { sc.seen.add(sub); const [fn, ...ln] = cleanName(b.name).split(" "); back.searchParams.set("user", JSON.stringify({ name: { firstName: fn || "", lastName: ln.join(" ") }, email })); }
      return sendBack(res, p, back, b);
    }
    /* Apple: form_post (selbst abschickendes Formular), sonst Weiterleitung mit Parametern */
    function sendBack(res, p, back, b) {
      if (p === "apple" && b.response_mode === "form_post") {
        const f = [...back.searchParams].map(([k, v]) => `<input type="hidden" name="${H(k)}" value="${H(v)}">`).join("");
        return res.set("Cache-Control", "no-store").type("html").send(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Weiter …</title></head><body onload="document.forms[0].submit()"><form method="post" action="${H(back.origin + back.pathname)}">${f}<noscript><button>Weiter</button></noscript></form></body></html>`);
      }
      res.redirect(302, back.toString());
    }
    app.post("/__sim/auth/:p/authorize", wrap(async (req, res) => { const p = String(req.params.p); if (!DEF[p]) return res.status(404).end(); simApprove(req, res, p, await formBody(req)); }));
    app.post("/__sim/auth/:p/token", wrap(async (req, res) => {
      const p = String(req.params.p), b = await formBody(req), D = DEF[p]; if (!D) return res.status(404).end();
      let cid = b.client_id, sec = b.client_secret; const au = String(req.get("authorization") || "");
      if (/^Basic /.test(au)) { const [a, s] = Buffer.from(au.slice(6), "base64").toString().split(":"); cid = a; sec = s; }
      if (cid !== `sim-${p}`) return res.status(401).json({ error: "invalid_client" });
      if (p === "apple") { const [h, pl, sg] = String(sec || "").split("."), P = jwtPart(pl), Hh = jwtPart(h);
        const ok = !!(P && Hh && Hh.alg === "ES256" && Hh.kid === "SIMKEY0001" && P.iss === "SIMTEAM001" && P.sub === "sim-apple" && P.aud === `${BASE}/__sim/auth/apple` && P.exp > Date.now() / 1000
          && crypto.verify("sha256", Buffer.from(h + "." + pl), { key: SIMK.ec.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(sg || "", "base64url")));
        if (!ok) return res.status(400).json({ error: "invalid_client" }); }
      else if (sec !== `sim-secret-${p}`) return res.status(401).json({ error: "invalid_client" });
      const c = sc.codes.get(String(b.code || "")); sc.codes.delete(String(b.code || ""));
      if (!c || c.p !== p || c.at < now() - 5 * 60e3) return res.status(400).json({ error: "invalid_grant", error_description: "code ungültig" });
      if (c.redirect !== b.redirect_uri) return res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri stimmt nicht" });
      if (c.challenge && s256(String(b.code_verifier || "")) !== c.challenge) return res.status(400).json({ error: "invalid_grant", error_description: "PKCE stimmt nicht" });
      if (DEF[p].pkce && !c.challenge) return res.status(400).json({ error: "invalid_request", error_description: "PKCE fehlt" });
      const at = rnd(24); sc.tokens.set(at, { p, prof: c.prof, at: now() });
      const out = { access_token: at, token_type: "Bearer", expires_in: 3600 };
      if (["google", "apple", "microsoft", "twitch"].includes(p)) {
        const t = Math.floor(Date.now() / 1000), P = { iss: `${BASE}/__sim/auth/${p}`, aud: `sim-${p}`, sub: c.prof.sub, iat: t, exp: t + 600 };
        if (c.nonce) P.nonce = c.nonce;
        if (p === "google") Object.assign(P, { email: c.prof.email, email_verified: c.prof.verified, name: c.prof.name });
        if (p === "apple") Object.assign(P, { email: c.prof.email, email_verified: "true", is_private_email: /privaterelay/.test(c.prof.email || "") ? "true" : "false" });
        if (p === "microsoft") Object.assign(P, { email: c.prof.email, name: c.prof.name, preferred_username: c.prof.email, tid: "9188040d-6c67-4c5b-b112-36a304b66dad" });
        if (p === "twitch") Object.assign(P, { email: c.prof.email, email_verified: c.prof.verified, preferred_username: c.prof.name });
        out.id_token = signJwt(P);
      }
      res.json(out);
    }));
    app.get("/__sim/auth/:p/userinfo", (req, res) => {
      const p = String(req.params.p), t = sc.tokens.get(String(req.get("authorization") || "").replace(/^Bearer /, ""));
      if (!t || t.p !== p) return res.status(401).json({ error: "invalid_token" });
      const f = t.prof;
      if (p === "discord") return res.json({ id: f.sub, username: (f.name || "sim").toLowerCase().replace(/\W+/g, "_"), global_name: f.name, email: f.email, verified: f.verified });
      if (p === "paypal") return res.json({ user_id: `https://www.paypal.com/webapps/auth/identity/user/${f.sub}`, sub: f.sub, name: f.name, email: f.email, email_verified: f.verified, verified_account: true });
      if (p === "amazon") return res.json({ user_id: "amzn1.account." + f.sub, name: f.name, email: f.email });
      res.json({ sub: f.sub, email: f.email, name: f.name });
    });
    app.get("/__sim/auth/jwks", (req, res) => res.json({ keys: [SIMK.jwk] }));
    /* Steam (OpenID 2.0) */
    app.get("/__sim/auth/steam/login", (req, res) => {
      const q = req.query, rt_ = String(q["openid.return_to"] || "");
      if (q["openid.mode"] !== "checkid_setup" || !rt_.startsWith(CB("steam") + "?state=") || q["openid.realm"] !== ORIGIN) return res.status(400).type("text/plain").send("Simulation: OpenID-Anfrage ungültig");
      const keep = ["openid.return_to"].map(k => `<input type="hidden" name="${k}" value="${H(q[k])}">`).join(""), id = q.sim_id || "7656119" + String(crypto.randomInt(1e9, 1e10));
      if (q.sim_auto === "1") return steamBack(res, rt_, "ok", String(id), q.sim_name);
      res.set("Cache-Control", "no-store").type("html").send(page("Steam", `<div class="hd"><img src="${LOGO("steam")}" alt=""><h1>Über Steam anmelden</h1></div>
<p>Die Seite <b>${H(ORIGIN)}</b> möchte deine Steam-ID erhalten. Steam gibt keine E-Mail-Adresse weiter.</p>
<form method="post" action="/__sim/auth/steam/login">${keep}<label for="sid">SteamID (17 Ziffern)</label><input type="text" id="sid" name="steamid" value="${H(id)}" inputmode="numeric">
<label for="nm">Spielername</label><input type="text" id="nm" name="sim_name" value="Sim Steam">
<div class="row"><button class="no" name="decision" value="no" type="submit">Abbrechen</button><button class="ok" name="decision" value="ok" type="submit">Anmelden</button></div></form>`));
    });
    const steamNonce = () => new Date().toISOString().replace(/\.\d+Z$/, "Z") + rnd(6);
    const steamSigned = {}; // assoc_handle → signierte Parameter
    function steamBack(res, rt_, decision, id, name) {
      const back = new URL(rt_);
      if (decision !== "ok") { back.searchParams.set("openid.ns", STEAM_NS); back.searchParams.set("openid.mode", "cancel"); return res.redirect(302, back.toString()); }
      if (!/^\d{17}$/.test(id)) return res.status(400).type("text/plain").send("SteamID braucht 17 Ziffern");
      const cid = `${BASE}/__sim/auth/steam/id/${id}`, handle = rnd(12), o = { "openid.ns": STEAM_NS, "openid.mode": "id_res", "openid.op_endpoint": `${BASE}/__sim/auth/steam/login`,
        "openid.claimed_id": cid, "openid.identity": cid, "openid.return_to": rt_, "openid.response_nonce": steamNonce(), "openid.assoc_handle": handle,
        "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle" };
      o["openid.sig"] = crypto.createHmac("sha256", SIMK.ecPem).update(JSON.stringify(o)).digest("base64");
      steamSigned[handle] = o["openid.sig"];
      for (const [k, v] of Object.entries(o)) back.searchParams.set(k, v);
      if (name) back.searchParams.set("sim_name", cleanName(name));
      res.redirect(302, back.toString());
    }
    app.post("/__sim/auth/steam/login", wrap(async (req, res) => {
      const b = await formBody(req);
      if (b["openid.mode"] === "check_authentication") {
        const o = {}; for (const k of ["openid.ns", "openid.mode", "openid.op_endpoint", "openid.claimed_id", "openid.identity", "openid.return_to", "openid.response_nonce", "openid.assoc_handle", "openid.signed"]) o[k] = String(b[k] || "");
        o["openid.mode"] = "id_res"; const sig = crypto.createHmac("sha256", SIMK.ecPem).update(JSON.stringify(o)).digest("base64");
        const ok = sig === b["openid.sig"] && steamSigned[o["openid.assoc_handle"]] === sig; delete steamSigned[o["openid.assoc_handle"]];
        return res.type("text/plain").send(`ns:${STEAM_NS}\nis_valid:${ok ? "true" : "false"}\n`);
      }
      steamBack(res, String(b["openid.return_to"] || ""), b.decision, String(b.steamid || "").trim(), b.sim_name);
    }));
    app.get("/__sim/sms.json", (req, res) => res.set("Cache-Control", "no-store").json(simSms));
    console.log("Anmeldung: Vorschau-Simulation aktiv (alle Anbieter ohne echte Zugangsdaten laufen gegen /__sim/auth/…)");
  }
  setInterval(() => { try { db.prepare("DELETE FROM auth_flows WHERE created_at<?").run(now() - FLOW_TTL); } catch (e) {} }, 15 * 60e3).unref();

  return { methods, gisClientId, pubExtra, needsEmail, checkoutEmailVerified, SIM, ORDER, isPh };
};
