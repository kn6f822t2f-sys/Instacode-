"use strict";
/* instantcodes Abo – Pläne Pro, Premium und Max als echte Stripe-Abos (Checkout im Modus „subscription“).
   - Abbuchung zu Beginn jeder Laufzeit im Voraus (Stripe), Lieferung jeden Monat als Code-Paket.
   - Jede Lieferung wartet auf Freigabe im Admin (Schutz vor Weiterverkauf), erst danach gehen die Codes raus.
   - Kündigung ohne Anmeldung über /kuendigen (§ 312k BGB), Laufzeitregeln nach § 309 Nr. 9 BGB,
     anteilige Erstattung nicht mehr gelieferter Monate per Klick im Admin.
   Eingebunden in server.js: require("./abo")(ctx). Die Datenbank ist die Quelle der Wahrheit für Kündigungen;
   Stripe ist die Quelle für Zahlungen (Rechnungen). Verpasste Ereignisse holt syncAll() nach. */
const crypto = require("crypto");

module.exports = function setupAbo(X) {
  const { app, db, mail, CATALOG, BASE, ADMINS } = X;
  const stripe = X.stripe;
  const T = X.clock;           // Uhrzeit für Abo-Logik (in der Vorschau per Test-Uhr verstellbar)
  const bad = X.bad;

  /* ---------- Datenbank ---------- */
  db.exec(`
CREATE TABLE IF NOT EXISTS subs(id TEXT PRIMARY KEY, access_key TEXT NOT NULL, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL, name TEXT, plan TEXT NOT NULL, price INTEGER NOT NULL, months INTEGER NOT NULL, status TEXT NOT NULL,
  stripe_session TEXT, stripe_sub TEXT, stripe_customer TEXT, created_at INTEGER, consent_at INTEGER, started_at INTEGER, paid_until INTEGER,
  cancel_at INTEGER, cancel_kind TEXT, cancel_reason TEXT, cancel_requested_at INTEGER, cancel_ref TEXT, cancel_via TEXT, cancel_synced INTEGER DEFAULT 1,
  ended_at INTEGER, refunded INTEGER NOT NULL DEFAULT 0, note TEXT);
CREATE INDEX IF NOT EXISTS ix_subs_email ON subs(email);
CREATE INDEX IF NOT EXISTS ix_subs_user ON subs(user_id);
CREATE INDEX IF NOT EXISTS ix_subs_status ON subs(status);
CREATE UNIQUE INDEX IF NOT EXISTS ix_subs_stripe ON subs(stripe_sub);
CREATE TABLE IF NOT EXISTS sub_periods(id INTEGER PRIMARY KEY, sub_id TEXT NOT NULL REFERENCES subs(id) ON DELETE CASCADE, no INTEGER,
  invoice_id TEXT UNIQUE, payment_intent TEXT, charge TEXT, amount INTEGER NOT NULL, start_at INTEGER NOT NULL, end_at INTEGER NOT NULL,
  paid_at INTEGER, refunded INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS ix_sub_periods ON sub_periods(sub_id, start_at);
CREATE TABLE IF NOT EXISTS sub_deliveries(id INTEGER PRIMARY KEY, sub_id TEXT NOT NULL REFERENCES subs(id) ON DELETE CASCADE, month INTEGER NOT NULL,
  due_at INTEGER, status TEXT NOT NULL, items TEXT NOT NULL, codes TEXT, value INTEGER NOT NULL DEFAULT 0, created_at INTEGER,
  delivered_at INTEGER, delivered_by TEXT, note TEXT, UNIQUE(sub_id, month));
CREATE INDEX IF NOT EXISTS ix_sub_deliv_status ON sub_deliveries(status);
CREATE TABLE IF NOT EXISTS sub_cancels(id TEXT PRIMARY KEY, received_at INTEGER NOT NULL, name TEXT, email TEXT, ref TEXT, kind TEXT, reason TEXT,
  wish TEXT, wish_date INTEGER, via TEXT, user_id INTEGER, result TEXT, matched INTEGER NOT NULL DEFAULT 0, handled_at INTEGER);
CREATE TABLE IF NOT EXISTS sub_events(id TEXT PRIMARY KEY, type TEXT, at INTEGER);`);

  /* ---------- Pläne und Inhalt ---------- */
  const PLANS = {
    pro: { id: "pro", name: "Pro", price: 3000, months: 1 },
    premium: { id: "premium", name: "Premium", price: 5000, months: 3 },
    max: { id: "max", name: "Max", price: 8000, months: 6 }
  };
  const PLAN_IDS = Object.keys(PLANS);
  const EVERY = [1, 2, 3, 6, 12];
  /* Standardpaket (im Admin änderbar). every = Abstand in Monaten: Codes, die länger als einen Monat gelten, nur in passenden Abständen. */
  const DEFAULT_ITEMS = [
    { brand: "netflix", a: 15, every: 1 },
    { brand: "disney", a: 15, every: 1 },
    { brand: "amazon", a: 10, every: 1, label: "Amazon-Guthaben 10 €" },
    { brand: "spotify", a: 10, every: 1 },
    { brand: "dazn", a: 15, every: 1 },
    { brand: "gpu", a: 26.99, every: 1 },
    { brand: "psplus-essential", a: 26.99, every: 3 },
    { brand: "nso", a: 7.99, every: 3 },
    { brand: "crunchyroll", a: 25, every: 3 }
  ];
  const hex = n => crypto.randomBytes(n).toString("hex").toUpperCase();
  const fc = X.fc;
  const euro = c => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  const defLabel = it => {
    const b = CATALOG[it.brand] || { name: it.brand }, ol = X.optLabel(b, it.a);
    if (b.type === "sub") return `${b.name} · ${ol}`;
    return `${b.name}${/[A-Za-z0-9]$/.test(b.name) ? "-" : " "}Guthaben ${ol}`;
  };
  const itemLabel = it => it.label || defLabel(it);
  function cleanItem(it) {
    const b = CATALOG[it && it.brand];
    if (!b || !X.isCodeBrand(b.id)) return null;
    const a = Number(it.a);
    if (!b.amts.includes(a)) return null;
    const every = EVERY.includes(+it.every) ? +it.every : 1;
    const label = String(it.label || "").replace(/\s+/g, " ").trim().slice(0, 60) || null;
    return { brand: b.id, a, every, label };
  }
  function rawContent() {
    let c = null; try { c = JSON.parse(X.kvGet("abo_content") || "null"); } catch (e) {}
    const out = {};
    for (const p of PLAN_IDS) out[p] = c && Array.isArray(c[p]) ? c[p] : DEFAULT_ITEMS;
    return out;
  }
  const content = () => { const r = rawContent(), out = {}; for (const p of PLAN_IDS) out[p] = r[p].map(cleanItem).filter(Boolean); return out; };
  const monthItems = (plan, month) => (content()[plan] || []).filter(it => (month - 1) % it.every === 0);
  const valueOf = items => items.reduce((s, it) => s + fc(it.a), 0);
  function planOut(id) {
    const P = PLANS[id], items = content()[id];
    let term = 0; for (let m = 1; m <= P.months; m++) term += valueOf(monthItems(id, m));
    return { id, name: P.name, price: P.price, months: P.months, perMonth: Math.round(P.price / P.months),
      avgValue: Math.round(items.reduce((s, it) => s + fc(it.a) / it.every, 0)), firstValue: valueOf(monthItems(id, 1)), termValue: term,
      items: items.map(it => ({ brand: it.brand, a: it.a, face: fc(it.a), every: it.every, label: itemLabel(it), name: (CATALOG[it.brand] || {}).name, card: X.cardOf(it.brand) })) };
  }

  /* ---------- Zeit ---------- */
  const addMonths = (ts, n) => { const d = new Date(ts), y = d.getUTCFullYear(), m = d.getUTCMonth() + n, last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return Date.UTC(y, m, Math.min(d.getUTCDate(), last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()); };
  const berlinOffset = ts => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Berlin", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(ts));
    const g = t => +p.find(x => x.type === t).value; return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - Math.floor(ts / 1000) * 1000; };
  /* 23:59:59 Uhr deutscher Zeit am angegebenen Tag */
  const dayEnd = (y, m, d) => { const u = Date.UTC(y, m - 1, d + 1); return u - berlinOffset(u) - 1000; };

  /* ---------- Lesen ---------- */
  const subById = id => id ? db.prepare("SELECT * FROM subs WHERE id=?").get(String(id)) : null;
  const subByStripe = sid => sid ? db.prepare("SELECT * FROM subs WHERE stripe_sub=?").get(String(sid)) : null;
  const periodsOf = id => db.prepare("SELECT * FROM sub_periods WHERE sub_id=? ORDER BY start_at").all(id);
  const deliveriesOf = id => db.prepare("SELECT * FROM sub_deliveries WHERE sub_id=? ORDER BY month").all(id);
  const RUNNING = ["active", "past_due"];
  const endOf = s => s.status === "ended" ? (s.ended_at || s.cancel_at) : s.cancel_at;
  const view = s => ({ id: s.id, key: s.access_key, email: s.email, name: s.name, plan: s.plan, planName: (PLANS[s.plan] || {}).name || s.plan, price: s.price, months: s.months,
    link: `${BASE}/abo/${s.id}?k=${encodeURIComponent(s.access_key)}`, cancelLink: `${BASE}/kuendigen?abo=${s.id}`, paid_until: s.paid_until, cancel_at: s.cancel_at });

  /* Frühestmögliches Vertragsende.
     Pro: Ende des bezahlten Monats. Premium/Max: Ende der ersten Laufzeit; nach einer Verlängerung jederzeit mit einem Monat Frist
     (höchstens bis zum Ende der bezahlten Laufzeit). Außerordentlich: sofort. Ein späterer Wunschtermin wird übernommen. */
  function cancelEnd(s, kind, wish, ps, at) {
    const t = at || T(); ps = ps || periodsOf(s.id);
    const cur = ps.find(p => p.start_at <= t && t < p.end_at) || ps[ps.length - 1];
    let earliest;
    if (kind === "ausserordentlich" || !cur) earliest = t;
    else if (s.months === 1 || cur.no === 1) earliest = cur.end_at;
    else earliest = Math.min(addMonths(t, 1), cur.end_at);
    earliest = Math.max(earliest, t, T());
    return { earliest, end: wish && wish > earliest ? wish : earliest, adjusted: !!wish && wish < earliest };
  }
  /* Anteilige Erstattung: Monate einer bezahlten Laufzeit, die erst nach Vertragsende beginnen würden */
  function refundCalc(s, ps) {
    const end = endOf(s); if (!end) return 0;
    let total = 0;
    for (const p of ps || periodsOf(s.id)) {
      let n = 0; for (let j = 0; j < s.months; j++) if (addMonths(p.start_at, j) >= end) n++;
      if (n) total += Math.round(p.amount * n / s.months);
    }
    return total;
  }
  const refundDue = (s, ps) => Math.max(0, refundCalc(s, ps) - (s.refunded || 0));
  const nextCharge = s => s.status === "active" && s.paid_until && (!s.cancel_at || s.cancel_at > s.paid_until + 60e3) ? s.paid_until : null;
  function nextDelivery(s, ps) {
    if (!RUNNING.includes(s.status) || !ps.length) return null;
    const t = T(), end = s.cancel_at;
    for (let k = 1; k < 600; k++) { const m = addMonths(ps[0].start_at, k); if (m > t) return end && m >= end ? null : m; }
    return null;
  }
  function deliveryOut(d, withCodes, admin) {
    const items = JSON.parse(d.items), codes = withCodes && d.codes && d.status === "delivered" ? JSON.parse(X.dec(d.codes)) : null;
    return { id: d.id, month: d.month, due_at: d.due_at, status: d.status, delivered_at: d.delivered_at, value: d.value, note: admin ? d.note : undefined, delivered_by: admin ? d.delivered_by : undefined,
      items: items.map((it, i) => ({ brand: it.brand, name: it.name, label: it.label, face: it.face, every: it.every, codes: codes ? (codes[i] || []) : [] })) };
  }
  function subOut(s, o = {}) {
    const ps = periodsOf(s.id), ds = deliveriesOf(s.id), P = PLANS[s.plan] || { name: s.plan };
    const out = { id: s.id, plan: s.plan, planName: P.name, price: s.price, months: s.months, status: s.status, created_at: s.created_at, started_at: s.started_at,
      paid_until: s.paid_until, next_charge: nextCharge(s), next_delivery: nextDelivery(s, ps), first_term_end: ps[0] ? ps[0].end_at : null, renewed: ps.length > 1,
      earliest_end: RUNNING.includes(s.status) && ps.length ? cancelEnd(s, "ordentlich", null, ps).earliest : null,
      cancel_at: s.cancel_at, cancel_kind: s.cancel_kind, cancel_requested_at: s.cancel_requested_at, cancel_ref: s.cancel_ref, ended_at: s.ended_at,
      refund_due: refundDue(s, ps), refunded: s.refunded || 0, key: o.key ? s.access_key : undefined,
      periods: ps.map(p => ({ no: p.no, start: p.start_at, end: p.end_at, amount: p.amount, paid_at: p.paid_at, refunded: o.admin ? p.refunded : undefined })),
      deliveries: ds.map(d => deliveryOut(d, o.codes, o.admin)).reverse() };
    if (o.admin) {
      const paid = ps.reduce((a, p) => a + p.amount, 0);
      Object.assign(out, { email: s.email, name: s.name, user_id: s.user_id, stripe_sub: s.stripe_sub, stripe_customer: s.stripe_customer, access_key: s.access_key,
        cancel_reason: s.cancel_reason, cancel_via: s.cancel_via, cancel_synced: !!s.cancel_synced, note: s.note, paid, revenue: paid - (s.refunded || 0),
        value_delivered: ds.filter(d => d.status === "delivered").reduce((a, d) => a + d.value, 0), value_pending: ds.filter(d => d.status === "pending").reduce((a, d) => a + d.value, 0) });
    }
    return out;
  }

  /* ---------- Lieferungen anlegen (jeden Monat, nur für bezahlte Laufzeiten, nie nach Vertragsende) ---------- */
  function tick() {
    const t = T(); let created = 0;
    const list = db.prepare("SELECT * FROM subs WHERE status IN ('active','past_due') OR (status='ended' AND ended_at>?)").all(t - 45 * 864e5);
    const ins = db.prepare("INSERT OR IGNORE INTO sub_deliveries(sub_id,month,due_at,status,items,value,created_at) VALUES(?,?,?,?,?,?,?)");
    for (const s of list) {
      const end = endOf(s);
      for (const p of periodsOf(s.id)) for (let j = 0; j < s.months; j++) {
        const start = addMonths(p.start_at, j), month = (p.no - 1) * s.months + j + 1;
        if (start > t + 60e3 || (end && start >= end)) continue;
        if (db.prepare("SELECT 1 FROM sub_deliveries WHERE sub_id=? AND month=?").get(s.id, month)) continue;
        const items = monthItems(s.plan, month).map(it => ({ brand: it.brand, a: it.a, face: fc(it.a), every: it.every, name: (CATALOG[it.brand] || {}).name || it.brand, label: itemLabel(it) }));
        if (ins.run(s.id, month, start, items.length ? "pending" : "empty", JSON.stringify(items), valueOf(items), X.now()).changes) {
          created++;
          if (items.length) { const d = db.prepare("SELECT * FROM sub_deliveries WHERE sub_id=? AND month=?").get(s.id, month); ADMINS.forEach(a => X.safe(mail.aboAdmin(a, view(s), deliveryOut(d, false)))); }
        }
      }
    }
    db.prepare("DELETE FROM subs WHERE status IN ('pending','expired') AND created_at<?").run(X.now() - 3 * 864e5);
    db.prepare("DELETE FROM sub_events WHERE at<?").run(X.now() - 90 * 864e5);
    if (created) console.log(`Abo: ${created} neue Lieferung(en) warten auf Freigabe`);
    return created;
  }
  const tickSafe = () => { try { tick(); } catch (e) { console.error("Abo-Lieferplan:", e.message); } };

  /* ---------- Stripe: Rechnungen, Abo-Status, Kündigung ---------- */
  const strId = v => v && (typeof v === "string" ? v : v.id) || null;
  const invSubId = inv => strId(inv.subscription) || (inv.parent && inv.parent.subscription_details && strId(inv.parent.subscription_details.subscription))
    || ((inv.lines && inv.lines.data) || []).map(l => strId(l.subscription) || (l.parent && l.parent.subscription_item_details && strId(l.parent.subscription_item_details.subscription))).find(Boolean) || null;
  const invMeta = inv => (inv.subscription_details && inv.subscription_details.metadata) || (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.metadata) || {};
  const subPeriodEnd = sub => sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end) || null;
  function link(s, stripeSub, customer) {
    if (!s) return null;
    try { db.prepare("UPDATE subs SET stripe_sub=COALESCE(stripe_sub,?), stripe_customer=COALESCE(stripe_customer,?) WHERE id=?").run(strId(stripeSub), strId(customer), s.id); }
    catch (e) { console.error("Abo verknüpfen:", e.message); }
    return subById(s.id);
  }
  async function subFromStripe(sid) {
    if (!sid) return null;
    const hit = subByStripe(sid); if (hit) return hit;
    const sub = await stripe.subscriptions.retrieve(sid);
    return sub && sub.metadata && sub.metadata.sub_id ? link(subById(sub.metadata.sub_id), sub.id, sub.customer) : null;
  }
  async function subForInvoice(inv) {
    const sid = invSubId(inv), meta = invMeta(inv);
    return subByStripe(sid) || (meta.sub_id && link(subById(meta.sub_id), sid, inv.customer)) || await subFromStripe(sid);
  }
  /* Zahlungsreferenz einer Rechnung (ältere API-Versionen: payment_intent/charge, neuere: payments) */
  async function invPay(inv) {
    let pi = strId(inv.payment_intent), ch = strId(inv.charge);
    const fromPayments = i => ((i.payments && i.payments.data) || []).map(p => p.payment && strId(p.payment.payment_intent)).find(Boolean);
    pi = pi || fromPayments(inv);
    if (!pi && !ch) {
      try { const full = await stripe.invoices.retrieve(inv.id, { expand: ["payments"] }, { apiVersion: X.STRIPE_V }); pi = fromPayments(full) || strId(full.payment_intent); ch = strId(full.charge); }
      catch (e) { console.error("Abo-Rechnung lesen:", e.message); }
    }
    return { pi, ch };
  }
  function renumber(id) { const st = db.prepare("UPDATE sub_periods SET no=? WHERE id=?"); periodsOf(id).forEach((p, i) => { if (p.no !== i + 1) st.run(i + 1, p.id); }); }
  /* Bezahlte Rechnung als Laufzeit speichern (doppelt gemeldete Rechnungen werden ignoriert) */
  async function recordInvoice(s, invIn) {
    if (!s) return false;
    let inv = invIn;
    if (typeof inv === "string" || !inv.lines) inv = await stripe.invoices.retrieve(strId(inv));
    if (inv.status !== "paid") return false;
    if (db.prepare("SELECT 1 FROM sub_periods WHERE invoice_id=?").get(inv.id)) return false;
    const lines = ((inv.lines && inv.lines.data) || []).filter(l => l.period && l.period.end > l.period.start);
    const line = lines.sort((a, b) => (b.period.end - b.period.start) - (a.period.end - a.period.start))[0];
    if (!line) { console.error("Abo-Rechnung ohne Zeitraum:", inv.id); return false; }
    const start = line.period.start * 1000, end = line.period.end * 1000, { pi, ch } = await invPay(inv);
    const paidAt = ((inv.status_transitions && inv.status_transitions.paid_at) || inv.created || Math.floor(T() / 1000)) * 1000;
    const r = db.prepare("INSERT OR IGNORE INTO sub_periods(sub_id,invoice_id,payment_intent,charge,amount,start_at,end_at,paid_at) VALUES(?,?,?,?,?,?,?,?)").run(s.id, inv.id, pi, ch, inv.amount_paid || 0, start, end, paidAt);
    if (!r.changes) return false;
    renumber(s.id);
    const no = db.prepare("SELECT no FROM sub_periods WHERE invoice_id=?").get(inv.id).no;
    db.prepare(`UPDATE subs SET status=CASE WHEN status IN ('pending','expired','past_due') THEN 'active' ELSE status END, started_at=COALESCE(started_at,?),
      paid_until=MAX(COALESCE(paid_until,0),?), stripe_customer=COALESCE(stripe_customer,?) WHERE id=?`).run(start, end, strId(inv.customer), s.id);
    const v = view(subById(s.id)), per = { no, start, end, amount: inv.amount_paid || 0, invoice: inv.hosted_invoice_url || null, pdf: inv.invoice_pdf || null };
    if (no === 1) X.safe(mail.aboStarted(v, per, planOut(s.plan)));
    else X.safe(mail.aboRenewed(v, per));
    console.log(`Abo ${s.id}: Laufzeit ${no} bezahlt (${euro(per.amount)})`);
    return true;
  }
  /* Unsere Kündigung an Stripe übertragen (Datenbank ist maßgeblich; bei Fehlern später erneut) */
  async function pushCancel(s) {
    if (!stripe || !s || !s.stripe_sub || !s.cancel_at) return true;
    try {
      const cur = periodsOf(s.id).find(p => p.start_at <= T() && T() < p.end_at);
      if (s.cancel_at <= T() + 60e3) {
        try { await stripe.subscriptions.cancel(s.stripe_sub, { prorate: false, invoice_now: false }); }
        catch (e) { if (!/already|canceled|No such subscription/i.test(e.message || "")) throw e; }
      } else if (cur && Math.abs(s.cancel_at - cur.end_at) < 120e3) await stripe.subscriptions.update(s.stripe_sub, { cancel_at_period_end: true });
      else await stripe.subscriptions.update(s.stripe_sub, { cancel_at: Math.floor(s.cancel_at / 1000), proration_behavior: "none" });
      db.prepare("UPDATE subs SET cancel_synced=1 WHERE id=?").run(s.id);
      return true;
    } catch (e) {
      console.error(`Abo ${s.id}: Kündigung bei Stripe nicht übertragen:`, e.message);
      db.prepare("UPDATE subs SET cancel_synced=0 WHERE id=?").run(s.id);
      return false;
    }
  }
  function markEnded(s, at) {
    if (!s || s.status === "ended") return;
    db.prepare("UPDATE subs SET status='ended', ended_at=COALESCE(ended_at,?) WHERE id=?").run(at || T(), s.id);
    console.log(`Abo ${s.id}: beendet`);
  }
  async function applyStripeSub(s, sub) {
    if (!s || !sub) return;
    const st = sub.status;
    if (st === "canceled") return markEnded(s, ((sub.ended_at || sub.canceled_at) * 1000) || T());
    if (st === "incomplete_expired") { if (s.status === "pending") db.prepare("UPDATE subs SET status='expired' WHERE id=?").run(s.id); return; }
    const sEnd = sub.cancel_at ? sub.cancel_at * 1000 : sub.cancel_at_period_end && subPeriodEnd(sub) ? subPeriodEnd(sub) * 1000 : null;
    if (s.cancel_at && (!sEnd || !s.cancel_synced)) await pushCancel(s);
    else if (!s.cancel_at && sEnd) db.prepare("UPDATE subs SET cancel_at=?, cancel_kind='ordentlich', cancel_via='stripe', cancel_requested_at=? WHERE id=?").run(sEnd, T(), s.id);
    if ((st === "past_due" || st === "unpaid") && s.status === "active") db.prepare("UPDATE subs SET status='past_due' WHERE id=?").run(s.id);
    if (st === "active" && s.status === "past_due" && s.paid_until > T()) db.prepare("UPDATE subs SET status='active' WHERE id=?").run(s.id);
  }
  async function onPaymentFailed(s, inv) {
    if (!s) return;
    if (s.status === "active") db.prepare("UPDATE subs SET status='past_due' WHERE id=?").run(s.id);
    if (s.status === "pending") return; // Erstzahlung: Stripe Checkout zeigt den Fehler direkt an
    X.safe(mail.aboPaymentFailed(view(subById(s.id)), { id: inv.id, amount: inv.amount_due || s.price, url: inv.hosted_invoice_url || null, next: inv.next_payment_attempt ? inv.next_payment_attempt * 1000 : null }));
  }
  /* Abgleich mit Stripe: Checkout-Sitzung, Abo-Status, alle bezahlten Rechnungen */
  async function syncSub(s) {
    const r = { id: s.id, periods: 0 };
    if (!stripe) return r;
    if (!s.stripe_sub && s.stripe_session) {
      const cs = await stripe.checkout.sessions.retrieve(s.stripe_session);
      if (cs && cs.subscription) s = link(s, cs.subscription, cs.customer);
      else if (cs && cs.status === "expired" && s.status === "pending") { db.prepare("UPDATE subs SET status='expired' WHERE id=?").run(s.id); return r; }
    }
    if (!s.stripe_sub) return r;
    const sub = await stripe.subscriptions.retrieve(s.stripe_sub);
    const inv = await stripe.invoices.list({ subscription: s.stripe_sub, status: "paid", limit: 36 });
    for (const i of (inv.data || []).slice().reverse()) if (await recordInvoice(subById(s.id), i)) r.periods++;
    const before = subById(s.id);
    await applyStripeSub(before, sub);
    const after = subById(s.id);
    r.changed = before.status !== after.status || before.cancel_at !== after.cancel_at;
    return r;
  }
  let syncing = null;
  async function syncAll() {
    if (syncing) return syncing;
    syncing = (async () => {
      const out = { checked: 0, periods: 0, changed: 0, errors: [] };
      const list = db.prepare("SELECT * FROM subs WHERE status IN ('active','past_due') OR (status='pending' AND stripe_session IS NOT NULL) OR (status='ended' AND stripe_sub IS NOT NULL AND ended_at>?)").all(T() - 45 * 864e5);
      for (const s of list) {
        try { const r = await syncSub(s); out.checked++; out.periods += r.periods; if (r.changed) out.changed++; }
        catch (e) { out.errors.push(`${s.id}: ${e.message}`); }
      }
      out.deliveries = tick();
      return out;
    })().finally(() => { syncing = null; });
    return syncing;
  }

  /* Webhook-Ereignisse (vom Stripe-Webhook in server.js weitergereicht) */
  const isEvent = ev => {
    const o = (ev && ev.data && ev.data.object) || {}, t = String(ev && ev.type);
    if (o.metadata && o.metadata.sub_id) return true;
    if (/^checkout\.session\./.test(t)) return o.mode === "subscription";
    return /^invoice\./.test(t) || /^customer\.subscription\./.test(t);
  };
  async function webhook(ev) {
    if (db.prepare("SELECT 1 FROM sub_events WHERE id=?").get(ev.id)) return;
    const o = ev.data.object, t = ev.type;
    if (t === "checkout.session.completed" || t === "checkout.session.async_payment_succeeded") {
      const s = subById(o.metadata && o.metadata.sub_id) || subById(o.client_reference_id);
      if (s) await syncSub(link(s, o.subscription, o.customer));
    } else if (t === "checkout.session.expired") {
      const s = subById(o.metadata && o.metadata.sub_id);
      if (s && s.status === "pending") db.prepare("UPDATE subs SET status='expired' WHERE id=?").run(s.id);
    } else if (t === "invoice.paid" || t === "invoice.payment_succeeded") {
      await recordInvoice(await subForInvoice(o), o.id);
    } else if (t === "invoice.payment_failed") {
      await onPaymentFailed(await subForInvoice(o), o);
    } else if (/^customer\.subscription\./.test(t)) {
      const s = subByStripe(o.id) || link(subById(o.metadata && o.metadata.sub_id), o.id, o.customer);
      if (s) await applyStripeSub(s, t === "customer.subscription.deleted" ? o : await stripe.subscriptions.retrieve(o.id));
    }
    db.prepare("INSERT OR IGNORE INTO sub_events(id,type,at) VALUES(?,?,?)").run(ev.id, t, X.now());
    tickSafe();
  }

  /* ---------- Kündigung ---------- */
  async function applyCancel(s, c) {
    const ps = periodsOf(s.id), plan = cancelEnd(s, c.kind, c.wish_date, ps, c.received_at), t = T();
    if (s.cancel_at && s.cancel_at <= plan.end) return { sub: s.id, plan: s.plan, planName: PLANS[s.plan].name, end: s.cancel_at, already: true, refund: refundDue(s, ps), earliest: plan.earliest };
    db.prepare("UPDATE subs SET cancel_at=?, cancel_kind=?, cancel_reason=?, cancel_requested_at=?, cancel_ref=?, cancel_via=?, cancel_synced=0 WHERE id=?")
      .run(plan.end, c.kind, c.reason || null, c.received_at, c.id, c.via, s.id);
    await pushCancel(subById(s.id));
    if (plan.end <= t + 60e3) markEnded(subById(s.id), plan.end);
    const f = subById(s.id);
    return { sub: s.id, plan: s.plan, planName: PLANS[s.plan].name, end: plan.end, earliest: plan.earliest, adjusted: plan.adjusted, refund: refundDue(f) };
  }
  const cancelOut = c => ({ id: c.id, received_at: c.received_at, name: c.name, email: c.email, ref: c.ref, kind: c.kind, reason: c.reason, wish: c.wish, wish_date: c.wish_date,
    matched: !!c.matched, results: JSON.parse(c.result || "[]") });
  async function processCancel(c, subs) {
    const results = [];
    for (const s of subs) results.push(await applyCancel(s, c));
    db.prepare("UPDATE sub_cancels SET result=?, matched=?, handled_at=? WHERE id=?").run(JSON.stringify(results), results.length ? 1 : 0, results.length ? X.now() : null, c.id);
    tickSafe();
    return db.prepare("SELECT * FROM sub_cancels WHERE id=?").get(c.id);
  }

  /* ---------- Auslieferung (nur nach Freigabe) ---------- */
  class Bad extends Error {}
  async function deliver(d, given, useRL, by, note) {
    const s = subById(d.sub_id), items = JSON.parse(d.items), ref = `${s.id}-M${d.month}`;
    const codes = items.map((it, i) => String((given && given[i]) || "").trim().slice(0, 200));
    for (const c of codes) if (c && (db.prepare("SELECT status FROM codes WHERE hash=?").get(X.codeHash(c)) || {}).status === "sold") throw new Bad(`Der Code ${c.slice(0, 6)}… wurde schon verkauft.`);
    if (new Set(codes.filter(Boolean)).size !== codes.filter(Boolean).length) throw new Bad("Ein Code steht doppelt in der Liste.");
    if (useRL) {
      if (!X.RL_USE()) throw new Bad("Reloadly ist nicht eingerichtet.");
      await X.supply({ id: ref, items: items.map((it, i) => ({ id: i + 1, brand: it.brand, face: it.face, qty: codes[i] ? 0 : 1, type: "code", name: it.name })).filter(x => x.qty) });
    }
    db.transaction(() => {
      const out = items.map((it, i) => {
        const c = codes[i];
        if (c) {
          const h = X.codeHash(c);
          if (!db.prepare("UPDATE codes SET status='sold', order_id=?, sold_at=? WHERE hash=? AND status='free'").run(ref, X.now(), h).changes)
            db.prepare("INSERT OR IGNORE INTO codes(brand,face,code,hash,status,is_test,order_id,added_at,sold_at) VALUES(?,?,?,?,'sold',?,?,?,?)").run(it.brand, it.face, X.enc(c), h, X.TESTMODE ? 1 : 0, ref, X.now(), X.now());
          return [c];
        }
        const got = X.takeCodes(it.brand, it.face, 1, ref, null);
        if (!got) throw new X.Stockout(`${it.name} ${X.optLabel(CATALOG[it.brand] || {}, it.face / 100)}`);
        return got;
      });
      db.prepare("UPDATE sub_deliveries SET status='delivered', codes=?, delivered_at=?, delivered_by=?, note=COALESCE(?,note) WHERE id=? AND status='pending'").run(X.enc(JSON.stringify(out)), T(), by, note || null, d.id);
    })();
    const fresh = db.prepare("SELECT * FROM sub_deliveries WHERE id=?").get(d.id);
    X.safe(mail.aboDelivery(view(s), deliveryOut(fresh, true)));
    return fresh;
  }

  /* ---------- Erstattung (über Stripe, verteilt auf die jüngsten Zahlungen) ---------- */
  async function refund(s, amount, reason) {
    const ps = periodsOf(s.id).slice().reverse();
    const max = ps.reduce((a, p) => a + p.amount - p.refunded, 0);
    if (!(amount > 0)) throw new Bad("Es gibt nichts zu erstatten.");
    if (amount > max) throw new Bad(`Höchstens ${euro(max)} können erstattet werden.`);
    let left = amount;
    for (const p of ps) {
      if (left <= 0) break;
      const take = Math.min(left, p.amount - p.refunded); if (take <= 0) continue;
      if (!p.payment_intent && !p.charge) throw new Bad(`Zur Zahlung ${p.no} fehlt die Stripe-Referenz. Bitte im Stripe-Dashboard erstatten.`);
      await stripe.refunds.create({ ...(p.payment_intent ? { payment_intent: p.payment_intent } : { charge: p.charge }), amount: take, reason: "requested_by_customer", metadata: { sub_id: s.id, period: String(p.no) } },
        { idempotencyKey: `abo-rf-${s.id}-${p.id}-${p.refunded}-${take}` });
      db.transaction(() => {
        db.prepare("UPDATE sub_periods SET refunded=refunded+? WHERE id=?").run(take, p.id);
        db.prepare("UPDATE subs SET refunded=refunded+? WHERE id=?").run(take, s.id);
      })();
      left -= take;
    }
    X.safe(mail.aboRefund(view(subById(s.id)), amount, reason));
    return subById(s.id);
  }

  /* ---------- Öffentliche Schnittstellen ---------- */
  const PM = (X.E.ABO_PAYMENT_METHODS || "card,link").split(",").map(x => x.trim()).filter(m => m && m !== "klarna"); // Klarna ist für Abos gesperrt
  const CONSENT = "Bitte bestätige die AGB und den Beginn der Lieferung (Widerrufsrecht erlischt), um fortzufahren.";

  app.get("/api/abo/plans", (req, res) => res.set("Cache-Control", "no-store").json({ plans: PLAN_IDS.map(planOut) }));

  app.post("/api/abo/checkout", X.wrap(async (req, res) => {
    if (!stripe) return bad(res, "Zahlungen sind noch nicht eingerichtet.", 503);
    const e = X.verifiedEmail(req);
    if (!e) return bad(res, X.EV_MSG, 403);
    const P = PLANS[String(req.body.plan || "")];
    if (!P) return bad(res, "Bitte wähle einen Plan.");
    if (req.body.consent !== true) return bad(res, CONSENT);
    const open = db.prepare("SELECT id FROM subs WHERE email=? AND status IN ('active','past_due') ORDER BY created_at DESC").get(e);
    if (open) return bad(res, `Für ${e} läuft schon ein Abo (${open.id}). Du findest es in deinem Konto unter „Abos“.`, 409);
    const id = "AB-" + hex(4), key = X.rnd(18);
    const name = String(req.body.name || (req.user && req.user.name) || "").trim().slice(0, 100) || null;
    db.prepare("INSERT INTO subs(id,access_key,user_id,email,name,plan,price,months,status,created_at,consent_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
      .run(id, key, req.user ? req.user.id : null, e, name, P.id, P.price, P.months, "pending", X.now(), X.now());
    const term = P.months === 1 ? "monatlich" : `alle ${P.months} Monate`;
    /* Feste Zahlungsarten (ohne Klarna). Lehnt Stripe eine davon ab (z. B. Link im Konto aus), noch einmal nur mit Karte (Apple Pay und Google Pay laufen über Karte). */
    const create = async pm => X.stripeCall((p, o) => stripe.checkout.sessions.create(p, o), Object.assign(params(), { payment_method_types: pm }), newer, { idempotencyKey: `abo-cs-${id}-${pm.join("-")}` });
    const params = () => ({
      mode: "subscription", locale: "de", customer_email: e, client_reference_id: id,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, billing_address_collection: "auto",
      metadata: { sub_id: id },
      subscription_data: { metadata: { sub_id: id }, description: `instantcodes Abo ${P.name} (${id})` },
      line_items: [{ quantity: 1, price_data: { currency: "eur", unit_amount: P.price, recurring: { interval: "month", interval_count: P.months },
        product_data: { name: `instantcodes Abo ${P.name}`, description: `Jeden Monat ein Paket mit Codes · Abbuchung ${term} im Voraus · Kündigung jederzeit online unter ${BASE.replace(/^https?:\/\/(www\.)?/, "")}/kuendigen`,
          images: [`${BASE}/icon-512.png`], metadata: { plan: P.id } } } }],
      custom_text: { submit: { message: `Das Abo verlängert sich automatisch um ${P.months === 1 ? "einen Monat" : P.months + " Monate"}, bis du kündigst. Die Codes kommen nach einer kurzen Prüfung per E-Mail.` } },
      success_url: `${BASE}/abo/${id}?k=${key}&neu=1`,
      cancel_url: `${BASE}/abo?abgebrochen=1`
    });
    const newer = {
      branding_settings: { display_name: "instantcodes", button_color: "#1700D2", background_color: "#FFFFFF", border_style: "rounded", font_family: "inter",
        icon: { type: "url", url: `${BASE}/icon-512.png` }, logo: { type: "url", url: `${BASE}/brand/checkout-logo.png` } }
    };
    let s;
    try { s = await create(PM); }
    catch (err) {
      if (PM.length > 1 && /payment_method_types|payment method type|link|paypal/i.test((err && err.message) || "")) { console.error("Abo-Checkout: Zahlungsart abgelehnt, nur Karte:", err.message); s = await create(["card"]); }
      else throw err;
    }
    db.prepare("UPDATE subs SET stripe_session=? WHERE id=?").run(s.id, id);
    res.json({ url: s.url, id, key });
  }));

  const owns = (req, s) => !!s && ((req.user && (s.user_id === req.user.id || (req.user.verified && s.email === req.user.email))) || X.isAdmin(req.user));
  app.get("/api/abo/mine", X.need, (req, res) => {
    const u = req.user;
    const rows = db.prepare("SELECT * FROM subs WHERE (user_id=? OR (email=? AND ?=1)) AND status NOT IN ('pending','expired') ORDER BY created_at DESC LIMIT 20").all(u.id, u.email, u.verified ? 1 : 0);
    res.json({ subs: rows.map(s => subOut(s, { codes: true })) });
  });
  app.get("/api/abo/vertrag/:id", (req, res) => {
    const s = subById(req.params.id), k = String(req.query.k || "");
    const ok = s && (owns(req, s) || (k && k.length === s.access_key.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(s.access_key))));
    if (!ok) return bad(res, "Abo nicht gefunden.", 404);
    res.set("Cache-Control", "no-store").json({ sub: subOut(s, { codes: true }), email: s.email });
  });

  /* Kündigung ohne Anmeldung (§ 312k BGB) – jede Erklärung wird gespeichert und sofort bestätigt, auch wenn kein Vertrag passt */
  const cancelLim = X.rateLimit({ windowMs: 60 * 60e3, limit: 15, standardHeaders: true, legacyHeaders: false, message: { error: "Zu viele Kündigungen von dieser Verbindung. Bitte warte etwas oder schreib uns eine E-Mail." } });
  app.post("/api/abo/kuendigen", cancelLim, X.wrap(async (req, res) => {
    const b = req.body || {};
    const name = String(b.name || "").replace(/\s+/g, " ").trim().slice(0, 100), email = X.norm(b.email);
    const ref = String(b.ref || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
    const kind = b.kind === "ausserordentlich" ? "ausserordentlich" : "ordentlich";
    const reason = String(b.reason || "").trim().slice(0, 1000);
    const wish = b.when === "date" ? "date" : "asap";
    if (name.length < 2) return bad(res, "Bitte gib deinen Namen an.");
    if (!X.emailOk(email)) return bad(res, "Bitte gib die E-Mail-Adresse an, mit der du das Abo abgeschlossen hast.");
    if (kind === "ausserordentlich" && reason.length < 3) return bad(res, "Bitte nenne den Grund für die außerordentliche Kündigung.");
    let wishDate = null;
    if (wish === "date") {
      const m = String(b.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return bad(res, "Bitte wähle das Datum, zu dem du kündigen möchtest.");
      wishDate = dayEnd(+m[1], +m[2], +m[3]);
      if (!(wishDate > T()) || wishDate > T() + 3 * 365 * 864e5) return bad(res, "Bitte wähle ein Datum in der Zukunft (höchstens drei Jahre).");
    }
    const c = { id: "KD-" + hex(4), received_at: T(), name, email, ref: ref || null, kind, reason: reason || null, wish, wish_date: wishDate, via: req.body.via === "konto" ? "konto" : "formular", user_id: req.user ? req.user.id : null };
    db.prepare("INSERT INTO sub_cancels(id,received_at,name,email,ref,kind,reason,wish,wish_date,via,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
      .run(c.id, c.received_at, c.name, c.email, c.ref, c.kind, c.reason, c.wish, c.wish_date, c.via, c.user_id);
    /* Zuordnung: Vertragsnummer + passende E-Mail (oder eigenes Konto), sonst alle laufenden Abos dieser E-Mail-Adresse */
    let subs = [];
    if (ref) { const s = subById(ref); if (s && (s.email === email || (req.user && s.user_id === req.user.id))) subs = [s]; }
    else subs = db.prepare("SELECT * FROM subs WHERE email=? AND status IN ('active','past_due') ORDER BY created_at").all(email);
    subs = subs.filter(s => RUNNING.includes(s.status));
    const row = cancelOut(await processCancel(c, subs));
    X.safe(mail.aboCanceled(row, BASE));
    ADMINS.forEach(a => X.safe(mail.aboAdminCancel(a, row)));
    res.json({ cancel: row });
  }));

  /* ---------- Admin ---------- */
  const adminProducts = () => Object.values(CATALOG).filter(b => !b.rl && X.isCodeBrand(b.id)).map(b => ({ id: b.id, name: b.name, cat: b.cat, type: b.type, amts: b.amts, labels: b.labels || null }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  const stockInfo = it => ({ free: X.freeCount(it.brand, it.face), gen: X.TEST_GEN, rl: !!X.rlHas(it.brand, it.face) });
  app.get("/api/admin/abos", X.admin, (req, res) => {
    const st = String(req.query.status || "all");
    const where = st === "running" ? "status IN ('active','past_due')" : st === "ended" ? "status='ended'" : st === "pending" ? "status IN ('pending','expired')" : "status NOT IN ('pending','expired')";
    const subs = db.prepare(`SELECT * FROM subs WHERE ${where} ORDER BY CASE WHEN status IN ('active','past_due') THEN 0 ELSE 1 END, created_at DESC LIMIT 300`).all();
    const pend = db.prepare("SELECT d.* FROM sub_deliveries d JOIN subs s ON s.id=d.sub_id WHERE d.status='pending' ORDER BY d.due_at").all()
      .map(d => { const s = subById(d.sub_id), o = deliveryOut(d, false, true); o.items.forEach(i => Object.assign(i, stockInfo(i))); return Object.assign(o, { sub: subOut(s, { admin: true }) }); });
    const tot = db.prepare(`SELECT (SELECT COUNT(*) FROM subs WHERE status IN ('active','past_due')) running,
      (SELECT COALESCE(SUM(amount),0) FROM sub_periods) paid, (SELECT COALESCE(SUM(refunded),0) FROM sub_periods) refunded,
      (SELECT COALESCE(SUM(value),0) FROM sub_deliveries WHERE status='delivered') delivered, (SELECT COALESCE(SUM(value),0) FROM sub_deliveries WHERE status='pending') pending`).get();
    const per = Object.fromEntries(db.prepare("SELECT plan, COUNT(*) n FROM subs WHERE status IN ('active','past_due') GROUP BY plan").all().map(r => [r.plan, r.n]));
    const all = db.prepare("SELECT * FROM subs WHERE status NOT IN ('pending','expired')").all();
    tot.refund_due = all.reduce((a, s) => a + refundDue(s), 0);
    const cancels = db.prepare("SELECT * FROM sub_cancels ORDER BY received_at DESC LIMIT 60").all().map(cancelOut);
    res.json({ plans: PLAN_IDS.map(id => Object.assign(planOut(id), { running: per[id] || 0 })), content: content(), products: adminProducts(), every: EVERY,
      subs: subs.map(s => subOut(s, { admin: true, codes: true })), pending: pend, totals: tot, cancels, testmode: X.TESTMODE, generator: X.TEST_GEN, reloadly: X.RL_USE(), stripe: !!stripe });
  });
  app.get("/api/admin/abos/pending", X.admin, (req, res) => {
    res.json({ count: db.prepare("SELECT COUNT(*) n FROM sub_deliveries WHERE status='pending'").get().n, unmatched: db.prepare("SELECT COUNT(*) n FROM sub_cancels WHERE matched=0").get().n });
  });
  app.post("/api/admin/abos/content", X.admin, (req, res) => {
    const plan = String(req.body.plan || ""); if (!PLANS[plan]) return bad(res, "Unbekannter Plan.");
    const raw = Array.isArray(req.body.items) ? req.body.items : [];
    if (raw.length > 30) return bad(res, "Höchstens 30 Codes pro Paket.");
    const items = [];
    for (const it of raw) {
      const c = cleanItem(it);
      if (!c) { const b = CATALOG[it && it.brand]; return bad(res, b ? `${b.name}: Betrag ${it.a} gibt es nicht.` : `Produkt „${String(it && it.brand)}“ gibt es nicht.`); }
      items.push(c);
    }
    if (!items.length) return bad(res, "Ein Paket braucht mindestens einen Code.");
    const cur = rawContent();
    (req.body.all ? PLAN_IDS : [plan]).forEach(p => { cur[p] = items; });
    X.kvSet("abo_content", JSON.stringify(cur));
    res.json({ plans: PLAN_IDS.map(planOut), content: content() });
  });
  app.post("/api/admin/abos/deliveries/:id/deliver", X.admin, X.wrap(async (req, res) => {
    const d = db.prepare("SELECT * FROM sub_deliveries WHERE id=?").get(Number(req.params.id));
    if (!d) return bad(res, "Lieferung nicht gefunden.", 404);
    if (d.status !== "pending") return bad(res, "Diese Lieferung ist schon erledigt.");
    const given = {}; (Array.isArray(req.body.items) ? req.body.items : []).forEach(x => { if (x && x.i != null) given[+x.i] = String(x.code || ""); });
    try { await deliver(d, given, !!req.body.reloadly, "admin", String(req.body.note || "").slice(0, 500) || null); }
    catch (err) {
      if (err instanceof X.Stockout) return bad(res, `Nicht genug Codes im Lager für ${err.message}. Bitte Code eintragen, das Lager auffüllen oder über Reloadly kaufen.`);
      if (err instanceof Bad || /Reloadly/.test(err.message || "")) return bad(res, err.message);
      throw err;
    }
    res.json({ ok: true, sub: subOut(subById(d.sub_id), { admin: true, codes: true }) });
  }));
  app.post("/api/admin/abos/deliveries/:id/skip", X.admin, (req, res) => {
    const d = db.prepare("SELECT * FROM sub_deliveries WHERE id=?").get(Number(req.params.id));
    if (!d || d.status !== "pending") return bad(res, "Diese Lieferung kann nicht übersprungen werden.");
    db.prepare("UPDATE sub_deliveries SET status='skipped', note=?, delivered_by='admin', delivered_at=? WHERE id=?").run(String(req.body.note || "Nicht geliefert").slice(0, 500), T(), d.id);
    res.json({ ok: true });
  });
  app.post("/api/admin/abos/:id/refund", X.admin, X.wrap(async (req, res) => {
    const s = subById(req.params.id); if (!s) return bad(res, "Abo nicht gefunden.", 404);
    if (!stripe) return bad(res, "Stripe ist nicht verbunden.");
    const amount = req.body.amount != null && req.body.amount !== "" ? Math.round(Number(req.body.amount)) : refundDue(s);
    try { await refund(s, amount, String(req.body.reason || "").slice(0, 300)); } catch (err) { if (err instanceof Bad) return bad(res, err.message); throw err; }
    res.json({ ok: true, sub: subOut(subById(s.id), { admin: true, codes: true }) });
  }));
  app.post("/api/admin/abos/cancels/:id/assign", X.admin, X.wrap(async (req, res) => {
    const c = db.prepare("SELECT * FROM sub_cancels WHERE id=?").get(String(req.params.id)); if (!c) return bad(res, "Kündigung nicht gefunden.", 404);
    const s = subById(String(req.body.sub || "").toUpperCase().trim()); if (!s) return bad(res, "Abo nicht gefunden. Bitte die Vertragsnummer (AB-…) eintragen.");
    if (!RUNNING.includes(s.status)) return bad(res, "Dieses Abo läuft nicht mehr.");
    const row = cancelOut(await processCancel(c, [s]));
    const v = Object.assign({}, row, { email: s.email });
    X.safe(mail.aboCanceled(v, BASE));
    res.json({ ok: true, cancel: row });
  }));
  app.post("/api/admin/abos/sync", X.admin, X.wrap(async (req, res) => { res.json(await syncAll()); }));

  setTimeout(tickSafe, 8000);
  setInterval(tickSafe, 15 * 60e3).unref();
  if (stripe) setInterval(() => syncAll().catch(e => console.error("Abo-Abgleich:", e.message)), 6 * 3600e3).unref();

  return { isEvent, webhook, tick, syncAll, PLANS, planOut };
};
