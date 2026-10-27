/* Reloadly-Anbindung: Geschenkkarten-Codes und Handy-Aufladungen automatisch einkaufen.
   Zugang über RELOADLY_CLIENT_ID und RELOADLY_CLIENT_SECRET (Reloadly-Dashboard › Developers › API Settings).
   RELOADLY_SANDBOX=1 nutzt die Testumgebung von Reloadly. */
const E = process.env;
const SANDBOX = E.RELOADLY_SANDBOX === "1";
const ON = !!(E.RELOADLY_CLIENT_ID && E.RELOADLY_CLIENT_SECRET);
const API = {
  gift: { base: SANDBOX ? "https://giftcards-sandbox.reloadly.com" : "https://giftcards.reloadly.com", accept: "application/com.reloadly.giftcards-v1+json" },
  topup: { base: SANDBOX ? "https://topups-sandbox.reloadly.com" : "https://topups.reloadly.com", accept: "application/com.reloadly.topups-v1+json" },
};
const tokens = {};

async function token(kind) {
  const t = tokens[kind];
  if (t && t.exp > Date.now() + 60e3) return t.v;
  const r = await fetch("https://auth.reloadly.com/oauth/token", {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: E.RELOADLY_CLIENT_ID, client_secret: E.RELOADLY_CLIENT_SECRET, grant_type: "client_credentials", audience: API[kind].base }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Reloadly-Anmeldung fehlgeschlagen (${r.status}): ${j.message || j.error_description || j.error || "unbekannt"}`);
  tokens[kind] = { v: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return j.access_token;
}

async function call(kind, method, p, body) {
  const r = await fetch(API[kind].base + p, {
    method, headers: { Authorization: `Bearer ${await token(kind)}`, Accept: API[kind].accept, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let j; try { j = txt ? JSON.parse(txt) : {}; } catch { j = { message: txt.slice(0, 200) }; }
  if (!r.ok) {
    console.error(`Reloadly-Fehler ${method} ${p} (${r.status}):`, JSON.stringify({ errorCode: j.errorCode, message: j.message, details: j.details, path: j.path }).slice(0, 600));
    const DE = { INSUFFICIENT_BALANCE: "Reloadly-Guthaben reicht nicht. Bitte das Reloadly-Konto aufladen.", PRODUCT_NOT_FOUND: "Dieses Produkt gibt es bei Reloadly nicht (mehr). Bitte im Admin neu zuordnen.",
      INVALID_UNIT_PRICE: "Diesen Betrag bietet Reloadly für das Produkt nicht an.", ACCOUNT_NOT_ACTIVE: "Das Reloadly-Konto ist für echte Käufe noch nicht freigeschaltet." };
    const e = new Error(`Reloadly: ${DE[j.errorCode] || j.message || j.errorCode || r.status}${j.errorCode && !DE[j.errorCode] ? ` (${j.errorCode})` : ""}`); e.status = r.status; e.code = j.errorCode; throw e;
  }
  return j;
}

/* Alle Geschenkkarten-Produkte eines Landes (seitenweise) */
async function products(country) {
  const out = [];
  for (let page = 1; page <= 20; page++) {
    const j = await call("gift", "GET", `/countries/${country}/products?page=${page}&size=200`).catch(async e => {
      if (e.status === 404) return { content: [] };
      throw e;
    });
    const list = Array.isArray(j) ? j : j.content || [];
    out.push(...list);
    if (Array.isArray(j) || !j.totalPages || page >= j.totalPages) break;
  }
  return out;
}

const norm = s => String(s || "").toLowerCase().replace(/®|™/g, "").replace(/[^a-z0-9]+/g, " ").trim();
/* Passendes Reloadly-Produkt für eine Shop-Marke suchen (Name + Euro-Beträge) */
function match(brand, list) {
  const n = norm(brand.name), alias = (brand.rl || []).map(norm);
  const score = p => {
    const pn = norm(p.productName), bn = norm(p.brand && p.brand.brandName);
    let s = 0;
    if (bn === n || alias.includes(bn)) s += 10; else if (bn.includes(n) || n.includes(bn) && bn.length > 2) s += 5; else if (pn.includes(n)) s += 3; else return 0;
    if (p.recipientCurrencyCode === "EUR") s += 4;
    const fixed = p.fixedRecipientDenominations || [];
    const fits = brand.amts.filter(a => fixed.includes(a) || (p.denominationType === "RANGE" && a >= p.minRecipientDenomination && a <= p.maxRecipientDenomination)).length;
    s += fits * 2;
    return s;
  };
  let best = null, bs = 0;
  for (const p of list) { const s = score(p); if (s > bs) { bs = s; best = p; } }
  return bs >= 9 ? best : null;
}

/* Codes kaufen. Gibt eine Liste lesbarer Codes zurück (Code bzw. „Code · PIN …“). */
async function buyCards({ productId, country, face, qty, ref, email }) {
  const o = await call("gift", "POST", "/orders", {
    productId: Number(productId), countryCode: country, quantity: qty, unitPrice: face, customIdentifier: ref,
    senderName: "instacode", recipientEmail: email || undefined,
  });
  const id = o.transactionId;
  if (!id) throw new Error("Reloadly hat keine Transaktions-ID geliefert");
  for (let i = 0; i < 10; i++) {
    const cards = await call("gift", "GET", `/orders/transactions/${id}/cards`).catch(e => { if (e.status === 404 || e.status === 400) return null; throw e; });
    if (Array.isArray(cards) && cards.length) {
      return { tx: id, codes: cards.map(c => [c.cardNumber, c.pinCode && c.pinCode !== c.cardNumber ? `PIN ${c.pinCode}` : ""].filter(Boolean).join(" · ")) };
    }
    await new Promise(r => setTimeout(r, 1500 + i * 1000));
  }
  const e = new Error(`Reloadly-Bestellung ${id} ist noch in Bearbeitung`); e.pending = id; throw e;
}

const DIAL = { "49": "DE", "43": "AT", "41": "CH", "90": "TR", "31": "NL", "32": "BE", "33": "FR", "39": "IT", "34": "ES", "48": "PL", "44": "GB", "1": "US" };
function phoneCountry(phone, fallback) {
  const d = String(phone || "").replace(/\D/g, "");
  if (String(phone).trim().startsWith("+") || String(phone).trim().startsWith("00")) {
    const x = d.replace(/^00/, "");
    for (const len of [3, 2, 1]) if (DIAL[x.slice(0, len)]) return { iso: DIAL[x.slice(0, len)], intl: "+" + x };
  }
  const iso = fallback || "DE";
  const code = Object.keys(DIAL).find(k => DIAL[k] === iso) || "49";
  return { iso, intl: "+" + code + d.replace(/^0+/, "") };
}

/* Handy aufladen (Betrag in Euro, Betreiber automatisch erkennen) */
async function topup({ phone, country, amount, ref }) {
  const pc = phoneCountry(phone, country);
  const op = await call("topup", "GET", `/operators/auto-detect/phone/${encodeURIComponent(pc.intl)}/countries/${pc.iso}?suggestedAmountsMap=true`);
  if (!op || !op.operatorId) throw new Error("Netzbetreiber für diese Nummer nicht gefunden");
  const t = await call("topup", "POST", "/topups", {
    operatorId: op.operatorId, amount, useLocalAmount: op.destinationCurrencyCode === "EUR" && op.supportsLocalAmounts !== false,
    customIdentifier: ref, recipientPhone: { countryCode: pc.iso, number: pc.intl },
  });
  if (t.status && !["SUCCESSFUL", "PROCESSING"].includes(t.status)) throw new Error(`Aufladung abgelehnt (${t.status})`);
  return { tx: t.transactionId, label: `Aufgeladen bei ${op.name || "Netzbetreiber"} · Ref ${t.transactionId}` };
}

async function operators(country) {
  const j = await call("topup", "GET", `/operators/countries/${country}?includeBundles=false&includeData=false&includePin=false`);
  return Array.isArray(j) ? j : j.content || [];
}
function matchOperator(brand, ops) {
  const n = norm(brand.name);
  return ops.find(o => norm(o.name).replace(/ germany| deutschland| de$/g, "").trim() === n) || ops.find(o => norm(o.name).startsWith(n + " ") || norm(o.name) === n) || null;
}

/* Gesamter Katalog über alle Länder (seitenweise) */
async function allProducts() {
  const out = [];
  for (let page = 1; page <= 60; page++) {
    const j = await call("gift", "GET", `/products?page=${page}&size=200&includeRange=true&includeFixed=true`);
    const list = Array.isArray(j) ? j : j.content || [];
    out.push(...list);
    if (Array.isArray(j) || !j.totalPages || page >= j.totalPages || !list.length) break;
  }
  return out;
}

async function balance() {
  const g = await call("gift", "GET", "/accounts/balance").catch(e => ({ error: e.message }));
  return g.error ? { error: g.error } : { amount: g.balance, currency: g.currencyCode };
}

module.exports = { ON, SANDBOX, products, allProducts, match, buyCards, topup, balance, operators, matchOperator };
