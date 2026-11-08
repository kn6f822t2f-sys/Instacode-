"use strict";
/* KI-Agenten für den Shop-Betrieb (Claude über das offizielle Anthropic-SDK, Werkzeuge laufen hier auf dem Server).
   Die Agenten arbeiten dauerhaft im Hintergrund: Der Server prüft alle 5 Minuten, welcher Agent fällig ist, und
   startet ihn (immer nur einen gleichzeitig). Jeder Agent macht Vorschläge; was davon ohne Freigabe live geht,
   bestimmt der Modus im Admin unter „KI-Agenten“:
     - „Freigabe“ (Standard): Vorschläge warten auf einen Klick im Admin.
     - „Automatisch“: Vorschläge werden sofort übernommen (alles bleibt im Verlauf und lässt sich zurücknehmen).
   Agenten:
     - sortiment: findet neue Marken beim Lieferanten (Reloadly), recherchiert Trends im Netz, schreibt Produkttexte,
       markiert Bestseller, blendet Unpassendes aus. Bilder und Einkaufspreise kommen ausschließlich vom Lieferanten
       (lizenzierte Produktbilder), nie aus der Websuche.
     - design: entwirft Farbwelten und Startseiten-Texte im Rahmen von web/DESIGN.md (nur geprüfte Design-Tokens).
     - waechter: täglicher Shop-Check (offene Prüffälle, Bestand, Lieferanten-Guthaben, Zahlungsarten, Fehler)
       mit priorisierter Aufgabenliste.
   Schutz: Tages-Budget in US-Dollar (AGENT_DAILY_USD bzw. Admin), höchstens 14 Schritte pro Lauf, Eingaben aus
   Werkzeugen werden geprüft, Design-Werte nur aus einer Positivliste, Produkt-IDs müssen im Katalog existieren.
   Ohne ANTHROPIC_API_KEY ruhen die Agenten. ANTHROPIC_API_KEY=sk-ant-dev-attrappe: Probelauf ohne Internet
   mit festen Beispielvorschlägen (zum Testen der Oberfläche). */
const fs = require("fs");
const path = require("path");
const SDK = require("@anthropic-ai/sdk");
const Anthropic = SDK.default || SDK;

/* Preise pro 1 Mio. Tokens (US-Dollar) für die Kostenbremse; Websuche 10 $ pro 1.000 Suchen */
const PRICE = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5], "claude-fable-5-1": [10, 50], "claude-opus-5": [5, 25] };
const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
const MAX_STEPS = 14;

const AGENTS = {
  sortiment: { name: "Sortiment-Agent", every: 12, mode: "review", effort: "medium",
    what: "Sucht neue Marken beim Lieferanten, recherchiert Trends, schreibt Produkttexte, markiert Bestseller." },
  design: { name: "Design-Agent", every: 72, mode: "review", effort: "high",
    what: "Entwirft Farbwelten und Startseiten-Texte passend zu Saison und Sortiment (immer mit Vorschau)." },
  waechter: { name: "Shop-Wächter", every: 24, mode: "auto", effort: "low",
    what: "Prüft täglich Bestellungen, Bestand, Lieferanten-Guthaben und Zahlungsarten und schreibt eine Aufgabenliste." },
};

/* Design: nur diese Tokens aus web/css/01-base.css darf der Agent setzen */
const THEME_TOKENS = ["--lav", "--iris", "--iris-2", "--pink", "--mint", "--sky", "--volt", "--cyan", "--tint", "--pearl", "--brand-grad", "--bg", "--bg-3"];
const COLOR = "(#[0-9a-fA-F]{3,8}|rgba?\\(\\s*\\d{1,3}\\s*,\\s*\\d{1,3}\\s*,\\s*\\d{1,3}\\s*(,\\s*(0|1|0?\\.\\d+)\\s*)?\\))";
const STOP = "\\s*" + COLOR + "(\\s+\\d{1,3}%)?\\s*";
const GRAD = new RegExp(`^(linear|radial)-gradient\\(\\s*(\\d{1,3}deg\\s*,|circle\\s*,|ellipse\\s*,)?(${STOP},){1,5}${STOP}\\)$`);
const SOLID = new RegExp(`^${COLOR}$`);
const lum = hex => { const h = hex.replace("#", ""); const f = h.length <= 4 ? h.slice(0, 3).split("").map(c => c + c) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)];
  const [r, g, b] = f.map(x => { const v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
function checkTokens(t) {
  const out = {}, errs = [];
  for (const [k, v0] of Object.entries(t || {})) {
    const v = String(v0 || "").trim();
    if (!THEME_TOKENS.includes(k)) { errs.push(`${k} ist nicht erlaubt`); continue; }
    if (!(SOLID.test(v) || GRAD.test(v)) || v.length > 220) { errs.push(`${k}: ungültiger Wert`); continue; }
    if ((k === "--bg" || k === "--bg-3") && (!/^#[0-9a-f]{6}$/i.test(v) || lum(v) < 0.78)) { errs.push(`${k} muss ein heller Hex-Wert sein (Design „hell“)`); continue; }
    if (["--lav", "--iris", "--iris-2", "--pink", "--mint", "--sky", "--volt", "--cyan"].includes(k) && /^#[0-9a-f]{6}$/i.test(v) && lum(v) > 0.35) { errs.push(`${k} ist zu hell für Text auf hellem Grund`); continue; }
    out[k] = v;
  }
  return { tokens: out, errs };
}
const clean = (s, n) => String(s == null ? "" : s).replace(/[<>]/g, "").replace(/[\u0000-\u0009\u000B-\u001F]/g, "").trim().slice(0, n);

module.exports = function setupAgents(X) {
  const { app, db, E, admin, wrap, bad, kvGet, kvSet, CATALOG, RL } = X;
  const KEY = String(E.ANTHROPIC_API_KEY || "").trim();
  const MOCK = /attrappe$/i.test(KEY);
  const client = KEY && !MOCK ? new Anthropic({ apiKey: KEY, maxRetries: 2, timeout: 10 * 60e3 }) : null;
  const now = () => Date.now();

  db.exec(`CREATE TABLE IF NOT EXISTS agent_runs(id INTEGER PRIMARY KEY, agent TEXT NOT NULL, started_at INTEGER, finished_at INTEGER, status TEXT,
  summary TEXT, steps INTEGER DEFAULT 0, tokens_in INTEGER DEFAULT 0, tokens_out INTEGER DEFAULT 0, searches INTEGER DEFAULT 0, cost REAL DEFAULT 0, error TEXT, trigger TEXT);
CREATE TABLE IF NOT EXISTS agent_proposals(id INTEGER PRIMARY KEY, agent TEXT NOT NULL, run_id INTEGER, kind TEXT NOT NULL, target TEXT, title TEXT, reason TEXT,
  data TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER, decided_at INTEGER, decided_by TEXT, result TEXT);
CREATE INDEX IF NOT EXISTS ix_agent_prop ON agent_proposals(status, agent);
CREATE TABLE IF NOT EXISTS product_meta(id TEXT PRIMARY KEY, descr TEXT, tags TEXT, hot INTEGER, updated_at INTEGER, src TEXT);`);
  /* Läufe, die beim Neustart mitten drin waren */
  db.prepare("UPDATE agent_runs SET status='abgebrochen', finished_at=? WHERE status='läuft'").run(now());

  /* ---------- Einstellungen ---------- */
  const DEF_USD = Math.max(0, parseFloat(E.AGENT_DAILY_USD || "5") || 5);
  const DEF_MODEL = MODELS.includes(E.AGENT_MODEL) ? E.AGENT_MODEL : "claude-opus-5-5";
  function cfg() {
    let c = {}; try { c = JSON.parse(kvGet("agents_cfg") || "{}"); } catch (e) {}
    const out = { on: c.on !== false, daily_usd: c.daily_usd != null ? Number(c.daily_usd) : DEF_USD, model: MODELS.includes(c.model) ? c.model : DEF_MODEL, agents: {} };
    for (const [id, a] of Object.entries(AGENTS)) {
      const x = (c.agents || {})[id] || {};
      out.agents[id] = { on: x.on !== false, mode: x.mode === "auto" ? "auto" : x.mode === "review" ? "review" : a.mode, every: Math.min(720, Math.max(1, Number(x.every) || a.every)) };
    }
    return out;
  }
  const saveCfg = c => kvSet("agents_cfg", JSON.stringify(c));
  const dayStart = () => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" })); d.setHours(0, 0, 0, 0); return now() - (new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" })) - d); };
  const spentToday = () => db.prepare("SELECT COALESCE(SUM(cost),0) c FROM agent_runs WHERE started_at>=?").get(dayStart()).c;

  /* ---------- Produkt-Texte, Bestseller-Markierung ---------- */
  let metaCache = null;
  const metaRows = () => metaCache || (metaCache = Object.fromEntries(db.prepare("SELECT * FROM product_meta").all().map(r => [r.id, r])));
  function decorate(x) {
    const m = metaRows()[x.id]; if (!m) return x;
    if (m.descr) x.desc = m.descr;
    if (m.tags) { try { x.tags = [...new Set([].concat(x.tags || [], JSON.parse(m.tags)))].slice(0, 24); } catch (e) {} }
    if (m.hot === 1) x.hot = 1; else if (m.hot === 0) delete x.hot;
    return x;
  }
  const touched = () => { metaCache = null; X.resetCaches(); };

  /* ---------- Design ---------- */
  const liveTheme = () => { try { return JSON.parse(kvGet("design_live") || "null"); } catch (e) { return null; } };
  function themeCSS() {
    const t = liveTheme(); if (!t || !t.tokens) return "";
    const { tokens } = checkTokens(t.tokens);
    const body = Object.entries(tokens).map(([k, v]) => `${k}:${v}`).join(";");
    return body ? `<style id="ic-theme">:root{${body}}</style>` : "";
  }
  /* v ändert sich bei jeder Veröffentlichung, damit die zwischengespeicherte Startseite neu gebaut wird */
  const publicTheme = () => { const t = liveTheme(); return t ? { v: t.at || 0, hero: t.hero && (t.hero.h1 || t.hero.lead) ? t.hero : null } : null; };
  const baseTokens = (() => { let css = ""; try { css = fs.readFileSync(path.join(__dirname, "web", "css", "01-base.css"), "utf8"); } catch (e) {}
    const o = {}; for (const k of THEME_TOKENS) { const m = css.match(new RegExp(`${k.replace(/[-]/g, "\\-")}:([^;]+);`)); if (m) o[k] = m[1].trim(); } return o; })();
  const designRules = (() => { try { return fs.readFileSync(path.join(__dirname, "web", "DESIGN.md"), "utf8").slice(0, 3200); } catch (e) { return ""; } })();

  /* ---------- Vorschläge ---------- */
  const propRow = id => db.prepare("SELECT * FROM agent_proposals WHERE id=?").get(id);
  function propose(ctx, kind, target, title, reason, data) {
    const dup = db.prepare("SELECT id FROM agent_proposals WHERE kind=? AND COALESCE(target,'')=? AND status='pending'").get(kind, target || "");
    if (dup) return `Zu ${target || kind} gibt es schon einen offenen Vorschlag (#${dup.id}).`;
    const info = ["note", "report"].includes(kind);
    const r = db.prepare("INSERT INTO agent_proposals(agent,run_id,kind,target,title,reason,data,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(ctx.agent, ctx.runId, kind, target || null, clean(title, 160), clean(reason, 1200), JSON.stringify(data || {}), info ? "info" : "pending", now());
    const id = r.lastInsertRowid;
    ctx.proposals++;
    if (!info && cfg().agents[ctx.agent].mode === "auto") {
      try { const res = apply(id, "agent"); return `Übernommen (#${id}): ${res}`; } catch (e) { return `Vorschlag #${id} gespeichert, aber nicht übernommen: ${e.message}`; }
    }
    return info ? `Gespeichert (#${id}).` : `Vorschlag #${id} wartet auf Freigabe im Admin.`;
  }

  function apply(id, by) {
    const p = propRow(id); if (!p) throw new Error("Vorschlag nicht gefunden");
    if (p.status !== "pending") throw new Error("Vorschlag ist nicht mehr offen");
    const d = JSON.parse(p.data || "{}");
    let result = "";
    const up = db.prepare("INSERT INTO product_meta(id,descr,tags,hot,updated_at,src) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET descr=COALESCE(excluded.descr,product_meta.descr), tags=COALESCE(excluded.tags,product_meta.tags), hot=COALESCE(excluded.hot,product_meta.hot), updated_at=excluded.updated_at, src=excluded.src");
    const need = id => { if (!CATALOG[id]) throw new Error(`Produkt ${id} gibt es nicht (mehr)`); };
    switch (p.kind) {
      case "product_text": need(p.target); up.run(p.target, d.desc || null, d.tags && d.tags.length ? JSON.stringify(d.tags) : null, null, now(), "agent"); result = "Text gespeichert"; break;
      case "product_hot": need(p.target); up.run(p.target, null, null, d.hot ? 1 : 0, now(), "agent"); result = d.hot ? "Als beliebt markiert" : "Markierung entfernt"; break;
      case "product_hide": case "product_show":
        need(p.target);
        db.prepare("INSERT INTO products(id,active) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET active=excluded.active").run(p.target, p.kind === "product_show" ? 1 : 0);
        result = p.kind === "product_show" ? "Eingeblendet" : "Ausgeblendet"; break;
      case "brand_add": {
        const list = X.extraBrands();
        if (!list.includes(d.brand)) list.push(d.brand);
        X.setExtraBrands(list);
        if (RL.ON) { X.rlImport().then(r => console.log(`KI-Agent: Marke „${d.brand}“ übernommen, Katalog: ${r.products} Produkte`)).catch(e => console.error("KI-Agent Import:", e.message)); result = "Marke freigegeben, Produkte werden vom Lieferanten geladen"; }
        else result = "Marke freigegeben (erscheint, sobald Reloadly verbunden ist)";
        break; }
      case "design_theme": {
        const prev = kvGet("design_live"); if (prev) kvSet("design_prev", prev);
        kvSet("design_live", JSON.stringify({ id: p.id, name: d.name, tokens: d.tokens || {}, hero: d.hero || null, at: now() }));
        result = "Design veröffentlicht"; break; }
      default: throw new Error("Unbekannte Art");
    }
    db.prepare("UPDATE agent_proposals SET status='applied', decided_at=?, decided_by=?, result=? WHERE id=?").run(now(), by, result, id);
    touched();
    return result;
  }

  /* ---------- Werkzeuge: Daten ---------- */
  const PAID = "('delivered','processing','payment_pending')";
  function topSellers(days, n) {
    return db.prepare(`SELECT i.brand id, SUM(i.qty) qty, SUM(i.unit*i.qty) cents FROM items i JOIN orders o ON o.id=i.order_id WHERE o.status IN ${PAID} AND o.paid_at>=? GROUP BY i.brand ORDER BY qty DESC LIMIT ?`)
      .all(now() - days * 864e5, n).map(r => ({ id: r.id, name: (CATALOG[r.id] || {}).name || r.id, stueck: r.qty, umsatz_eur: Math.round(r.cents) / 100 }));
  }
  const decisions = agent => db.prepare("SELECT kind, target, title, status, decided_by FROM agent_proposals WHERE agent=? AND status IN ('applied','rejected') ORDER BY decided_at DESC LIMIT 25").all(agent)
    .map(r => `${r.status === "rejected" ? "ABGELEHNT" : "übernommen"}: ${r.title}`);
  let rlAll = null;
  async function supplierAll() {
    if (!RL.ON) throw new Error("Der Lieferant Reloadly ist noch nicht verbunden (RELOADLY_CLIENT_ID fehlt). Neue Marken kann ich erst danach finden.");
    if (!rlAll || rlAll.t < now() - 6 * 36e5) rlAll = { t: now(), list: await RL.allProducts() };
    return rlAll.list;
  }

  const T = {
    sortiment_overview: { d: "Überblick über das aktuelle Sortiment: Produkte pro Kategorie, Bestseller der letzten 30 Tage, Produkte ohne Text, zusätzlich freigegebene Lieferanten-Marken, frühere Entscheidungen des Inhabers.",
      s: {}, run: (ctx) => {
        const cat = X.shopCatalog(), per = {};
        cat.forEach(b => { per[b.cat] = (per[b.cat] || 0) + 1; });
        const meta = metaRows();
        return { produkte_im_shop: cat.length, pro_kategorie: per, vom_lieferanten: cat.filter(b => b.rl).length, ohne_text: cat.filter(b => !meta[b.id] || !meta[b.id].descr).length,
          bestseller_30_tage: topSellers(30, 15), zusaetzliche_marken: X.extraBrands(), lieferant_verbunden: RL.ON, fruehere_entscheidungen: decisions(ctx.agent) };
      } },
    supplier_brands: { d: "Marken, die der Lieferant (Reloadly) in EU-Ländern anbietet, die aber noch nicht im Shop sind. Optional mit Suchwort. Nur diese Marken können mit propose_brand ins Sortiment.",
      s: { query: { type: "string", description: "Optionales Suchwort, z. B. 'gaming' oder 'zalando'" }, limit: { type: "integer", description: "Höchstens so viele Marken (Standard 40)" } },
      run: async (ctx, i) => {
        const list = await supplierAll();
        const inShop = new Set(Object.values(CATALOG).map(b => String(b.brand || b.name).toLowerCase()));
        const q = String(i.query || "").toLowerCase().trim(), by = new Map();
        for (const p of list) {
          if (!X.EU27.has((p.country && p.country.isoName) || "") || X.rlAllowed(p)) continue;
          const brand = (p.brand && p.brand.brandName) || p.productName; if (!brand) continue;
          if (q && !`${brand} ${p.productName} ${(p.category && p.category.name) || ""}`.toLowerCase().includes(q)) continue;
          if (inShop.has(brand.toLowerCase())) continue;
          const g = by.get(brand) || { marke: brand, produkte: 0, laender: new Set(), waehrungen: new Set(), kategorie: (p.category && p.category.name) || "", mit_bild: 0, beispiel: p.productName };
          g.produkte++; g.laender.add(p.country.isoName); g.waehrungen.add(p.recipientCurrencyCode); if ((p.logoUrls || []).length) g.mit_bild++;
          by.set(brand, g);
        }
        const out = [...by.values()].sort((a, b) => (b.laender.has("DE") - a.laender.has("DE")) || b.produkte - a.produkte).slice(0, Math.min(80, i.limit || 40))
          .map(g => ({ ...g, laender: [...g.laender].slice(0, 10), waehrungen: [...g.waehrungen] }));
        return { anzahl: by.size, marken: out };
      } },
    products_without_text: { d: "Sichtbare Shop-Produkte ohne eigenen Beschreibungstext (für propose_product_text). Bestseller zuerst.",
      s: { limit: { type: "integer", description: "Standard 15, höchstens 30" } },
      run: (ctx, i) => {
        const meta = metaRows(), best = new Map(topSellers(90, 200).map((r, k) => [r.id, k]));
        return X.shopCatalog().filter(b => !(meta[b.id] && meta[b.id].descr) && b.cat !== "topup")
          .sort((a, b) => (best.has(a.id) ? best.get(a.id) : 999) - (best.has(b.id) ? best.get(b.id) : 999) || (b.region === "DE") - (a.region === "DE"))
          .slice(0, Math.min(30, i.limit || 15))
          .map(b => ({ id: b.id, name: b.name, kategorie: b.cat, art: b.type, plattform: b.plat || undefined, gueltig_in: b.regionName || b.region || "DE", betraege: b.labels || b.amts }));
      } },
    find_product: { d: "Shop-Produkte per Name suchen (liefert IDs für die Vorschlags-Werkzeuge).",
      s: { query: { type: "string" } }, req: ["query"],
      run: (ctx, i) => { const q = String(i.query || "").toLowerCase(); const meta = metaRows(), hidden = X.prodRows();
        return Object.values(CATALOG).filter(b => `${b.name} ${b.id}`.toLowerCase().includes(q)).slice(0, 20)
          .map(b => ({ id: b.id, name: b.name, kategorie: b.cat, gueltig_in: b.region, sichtbar: !(hidden[b.id] && hidden[b.id].active === 0), beliebt: !!b.hot || (meta[b.id] && meta[b.id].hot === 1), hat_text: !!(meta[b.id] && meta[b.id].descr) })); } },
    propose_product_text: { d: "Beschreibungstext (Deutsch, Du-Form, 2–3 Sätze, nur wahre Angaben: was es ist, wofür man es nutzt, wo man einlöst) und Suchbegriffe für ein Produkt vorschlagen.",
      s: { id: { type: "string" }, desc: { type: "string", description: "Höchstens 400 Zeichen, ohne Emoji, ohne Preise, ohne Versprechen zur Lieferzeit" }, tags: { type: "array", items: { type: "string" }, description: "Bis zu 10 Suchbegriffe, wie Kunden suchen" }, reason: { type: "string" } },
      req: ["id", "desc"], run: (ctx, i) => {
        if (!CATALOG[i.id]) return "Unbekannte Produkt-ID. Nutze find_product.";
        const desc = clean(i.desc, 400); if (desc.length < 40) return "Text zu kurz.";
        if (/\p{Extended_Pictographic}/u.test(desc)) return "Bitte ohne Emoji.";
        const tags = [].concat(i.tags || []).map(t => clean(t, 30).toLowerCase()).filter(Boolean).slice(0, 10);
        return propose(ctx, "product_text", i.id, `Text für ${CATALOG[i.id].name}`, i.reason, { desc, tags });
      } },
    propose_highlight: { d: "Produkt als „beliebt“ markieren (oder Markierung entfernen). Nur mit Begründung aus Verkaufszahlen oder klarer Trend-Recherche.",
      s: { id: { type: "string" }, hot: { type: "boolean" }, reason: { type: "string" } }, req: ["id", "hot", "reason"],
      run: (ctx, i) => CATALOG[i.id] ? propose(ctx, "product_hot", i.id, `${CATALOG[i.id].name} ${i.hot ? "als beliebt markieren" : "nicht mehr als beliebt markieren"}`, i.reason, { hot: !!i.hot }) : "Unbekannte Produkt-ID." },
    propose_visibility: { d: "Produkt aus- oder wieder einblenden (z. B. doppelt, für deutsche Kunden unbrauchbar, irreführend). Wird nie gelöscht.",
      s: { id: { type: "string" }, visible: { type: "boolean" }, reason: { type: "string" } }, req: ["id", "visible", "reason"],
      run: (ctx, i) => CATALOG[i.id] ? propose(ctx, i.visible ? "product_show" : "product_hide", i.id, `${CATALOG[i.id].name} ${i.visible ? "einblenden" : "ausblenden"}`, i.reason, {}) : "Unbekannte Produkt-ID." },
    propose_brand: { d: "Eine Marke des Lieferanten ins Sortiment aufnehmen. Nur Marken aus supplier_brands. Bilder, Beträge und Einkaufspreise kommen dann automatisch vom Lieferanten.",
      s: { brand: { type: "string", description: "Markenname genau wie in supplier_brands" }, reason: { type: "string", description: "Warum lohnt sich die Marke für deutsche Kunden? Quellen nennen." } }, req: ["brand", "reason"],
      run: async (ctx, i) => {
        const brand = clean(i.brand, 60); const list = await supplierAll().catch(() => []);
        const found = list.some(p => ((p.brand && p.brand.brandName) || "").toLowerCase() === brand.toLowerCase());
        if (!found) return "Diese Marke führt der Lieferant nicht. Nutze supplier_brands, oder note_sourcing_gap für Marken ohne Lieferanten.";
        const n = list.filter(p => ((p.brand && p.brand.brandName) || "").toLowerCase() === brand.toLowerCase() && X.EU27.has((p.country && p.country.isoName) || "")).length;
        return propose(ctx, "brand_add", brand.toLowerCase(), `Marke „${brand}“ ins Sortiment (${n} Produkte beim Lieferanten)`, i.reason, { brand });
      } },
    note_sourcing_gap: { d: "Notiz an den Inhaber: Ein gefragtes Produkt (Trend, neues Spiel) gibt es beim Lieferanten nicht – der Inhaber müsste es über einen Distributor einkaufen. Keine Bilder oder Codes aus dem Netz übernehmen.",
      s: { product: { type: "string" }, reason: { type: "string", description: "Warum gefragt (mit Quelle) und wie man es beziehen könnte" } }, req: ["product", "reason"],
      run: (ctx, i) => propose(ctx, "note", clean(i.product, 80).toLowerCase(), `Fehlt im Sortiment: ${clean(i.product, 80)}`, i.reason, {}) },
    design_state: { d: "Aktuelles Design: Designregeln (web/DESIGN.md), Standard-Werte der änderbaren Tokens, aktuell veröffentlichter Entwurf, Startseiten-Texte, frühere Entscheidungen, Datum und Bestseller.",
      s: {}, run: (ctx) => ({ datum: new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }),
        erlaubte_tokens_standard: baseTokens, live: liveTheme(), startseite_standard: { h1: "Digitale Codes.\nIn Sekunden bei dir.", lead: "Gutscheine, Spiele-Keys, Abos und Handy-Guthaben von vielen Marken – sicher bezahlt, dein Code kommt per E-Mail." },
        designregeln: designRules, bestseller: topSellers(30, 8), fruehere_entscheidungen: decisions(ctx.agent) }) },
    propose_design: { d: "Einen Design-Entwurf vorschlagen: neue Werte für erlaubte Tokens (Farben/Verläufe als Hex, rgba oder linear-gradient) und optional Startseiten-Überschrift (h1, Zeilenumbruch mit \\n, max. 60 Zeichen) und Untertitel (lead, max. 180 Zeichen). Der Inhaber sieht vorher eine Vorschau.",
      s: { name: { type: "string" }, rationale: { type: "string" }, tokens: { type: "object", additionalProperties: { type: "string" } }, h1: { type: "string" }, lead: { type: "string" } }, req: ["name", "rationale", "tokens"],
      run: (ctx, i) => {
        const { tokens, errs } = checkTokens(i.tokens);
        if (errs.length) return "Nicht gespeichert: " + errs.join("; ");
        const hero = i.h1 || i.lead ? { h1: clean(i.h1, 60) || null, lead: clean(i.lead, 180) || null } : null;
        if (!Object.keys(tokens).length && !hero) return "Leerer Entwurf.";
        return propose(ctx, "design_theme", "design:" + clean(i.name, 40).toLowerCase(), `Design-Entwurf „${clean(i.name, 60)}“`, i.rationale, { name: clean(i.name, 60), tokens, hero });
      } },
    shop_health: { d: "Zustand des Shops: offene Prüffälle, hängende Zahlungen, ausverkaufte Beträge, Lieferanten-Guthaben, aktive Zahlungsarten, Bewertungen, Fehler der Agenten.",
      s: {}, run: async () => {
        const h = await X.health();
        h.offene_agenten_vorschlaege = db.prepare("SELECT COUNT(*) n FROM agent_proposals WHERE status='pending'").get().n;
        h.agenten_fehler_7_tage = db.prepare("SELECT agent, error FROM agent_runs WHERE status='Fehler' AND started_at>? ORDER BY id DESC LIMIT 5").all(now() - 7 * 864e5);
        h.bestseller_7_tage = topSellers(7, 5);
        return h;
      } },
    write_report: { d: "Den Bericht für den Inhaber speichern: kurze, priorisierte Aufgabenliste (wichtigstes zuerst), jede Aufgabe mit konkretem nächsten Schritt im Admin.",
      s: { title: { type: "string" }, text: { type: "string" } }, req: ["title", "text"],
      run: (ctx, i) => propose(ctx, "report", "report:" + new Date().toISOString().slice(0, 10), clean(i.title, 120), clean(i.text, 1200), {}) },
  };
  const AGENT_TOOLS = {
    sortiment: ["sortiment_overview", "supplier_brands", "products_without_text", "find_product", "propose_product_text", "propose_highlight", "propose_visibility", "propose_brand", "note_sourcing_gap"],
    design: ["design_state", "propose_design"],
    waechter: ["shop_health", "write_report"],
  };
  const WEB = { sortiment: 5, design: 2, waechter: 0 };
  const toolDefs = agent => AGENT_TOOLS[agent].map(n => ({ name: n, description: T[n].d,
    input_schema: { type: "object", properties: T[n].s, ...(T[n].req ? { required: T[n].req } : {}) } }))
    .concat(WEB[agent] ? [{ type: "web_search_20260209", name: "web_search", max_uses: WEB[agent], user_location: { type: "approximate", country: "DE", timezone: "Europe/Berlin" } }] : []);

  const SHOP = `Du arbeitest als KI-Mitarbeiter im Online-Shop instantcodes (instacode.store): digitale Gutscheine, Guthabenkarten, Spiele-Keys, Abos und Handy-Aufladungen für Kunden in Deutschland (Du-Form, überwiegend iPhone-Nutzer). Der Inhaber prüft deine Vorschläge im Admin-Bereich.
Feste Regeln:
- Nur wahre Angaben. Keine erfundenen Bewertungen, Zahlen, Siegel, Rabatte oder „offizieller Partner“-Behauptungen.
- Produktbilder, Codes und Einkaufspreise kommen ausschließlich vom Lieferanten (Reloadly) oder vom Inhaber. Übernimm nie Bilder oder Texte aus der Websuche; die Websuche dient nur der Recherche.
- Klarna ist für Gutscheine gesperrt; mach keine Aussagen zu Zahlungsarten.
- Mach lieber wenige gute Vorschläge als viele mittelmäßige (höchstens 10 pro Lauf). Abgelehnte Vorschläge nicht wiederholen.
- Antworte am Ende mit 2–4 Sätzen Zusammenfassung auf Deutsch, was du getan hast.`;
  const TASK = {
    sortiment: `Aufgabe Sortiment: 1) Verschaff dir mit sortiment_overview einen Überblick. 2) Recherchiere per Websuche, welche Gutscheine, Guthabenkarten und Spiele in Deutschland gerade gefragt sind (Neuerscheinungen, Saison, Feiertage). 3) Prüfe mit supplier_brands, welche davon der Lieferant anbietet, und schlag passende Marken mit propose_brand vor (nur seriöse, bekannte Marken, die deutsche Kunden nutzen können). Was der Lieferant nicht hat, aber klar gefragt ist: note_sourcing_gap. 4) Schreib für bis zu 6 wichtige Produkte ohne Text eine Beschreibung (products_without_text, propose_product_text). 5) Markiere Bestseller oder Trend-Produkte als beliebt, wenn es Belege gibt.`,
    design: `Aufgabe Design: Lies design_state. Entwirf höchstens einen neuen Design-Entwurf, wenn es einen guten Anlass gibt (Saison, Feiertag, Aktion, Sortiments-Schwerpunkt) oder der aktuelle Entwurf älter als 4 Wochen ist. Halte dich streng an die Designregeln: hell, ruhig, vertrauenswürdig; Akzentfarben müssen auf hellem Grund lesbar sein; keine grellen Flächen. Überschrift kurz und ehrlich (kein „sofort“, wenn nicht alle Codes sofort kommen; keine Rabatt-Versprechen). Wenn kein Anlass besteht, schlag nichts vor und sag das.`,
    waechter: `Aufgabe Shop-Check: Lies shop_health und schreib mit write_report eine kurze, priorisierte Aufgabenliste für den Inhaber (höchstens 6 Punkte, wichtigstes zuerst: Kunden, die warten, Geld, Ausfälle). Wenn alles in Ordnung ist, schreib das in einem Satz.`,
  };

  /* ---------- Ein Lauf ---------- */
  let running = null;
  const costOf = (model, u) => { const [pi, po] = PRICE[model] || PRICE["claude-opus-5-5"];
    return ((u.input_tokens || 0) * pi + (u.cache_creation_input_tokens || 0) * pi * 1.25 + (u.cache_read_input_tokens || 0) * pi * 0.1 + (u.output_tokens || 0) * po) / 1e6
      + ((u.server_tool_use && u.server_tool_use.web_search_requests) || 0) * 0.01; };

  async function callModel(body) {
    /* Bei Ablehnung durch die Sicherheitsfilter springt automatisch ein anderes Modell ein (server-side fallback) */
    try { return await client.beta.messages.create({ ...body, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }); }
    catch (e) { if (e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message || "")) return client.messages.create(body); throw e; }
  }

  async function run(agent, trigger) {
    if (running) throw new Error(`${AGENTS[running.agent].name} arbeitet gerade`);
    const c = cfg();
    if (!KEY) throw new Error("ANTHROPIC_API_KEY fehlt");
    if (spentToday() >= c.daily_usd) throw new Error(`Tages-Budget von ${c.daily_usd} $ erreicht`);
    const runId = db.prepare("INSERT INTO agent_runs(agent,started_at,status,trigger) VALUES(?,?,'läuft',?)").run(agent, now(), trigger).lastInsertRowid;
    const ctx = { agent, runId, proposals: 0 };
    running = ctx;
    const st = { steps: 0, tin: 0, tout: 0, searches: 0, cost: 0 };
    let summary = "", status = "fertig", error = null;
    try {
      if (MOCK) summary = await mockRun(ctx);
      else {
        const budget = c.daily_usd - spentToday();
        const system = [{ type: "text", text: SHOP + "\n\n" + TASK[agent], cache_control: { type: "ephemeral" } }];
        const messages = [{ role: "user", content: `Neuer Lauf (${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}). Leg los.` }];
        const tools = toolDefs(agent);
        for (;;) {
          if (++st.steps > MAX_STEPS) { status = "Schrittlimit"; break; }
          if (st.cost >= budget) { status = "Budget"; break; }
          const r = await callModel({ model: c.model, max_tokens: 16000, thinking: { type: "adaptive" }, output_config: { effort: AGENTS[agent].effort }, system, tools, messages });
          const u = r.usage || {};
          st.tin += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0); st.tout += u.output_tokens || 0;
          st.searches += (u.server_tool_use && u.server_tool_use.web_search_requests) || 0; st.cost += costOf(r.model || c.model, u);
          const text = r.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
          if (text) summary = text;
          if (r.stop_reason === "refusal") { status = "abgelehnt"; break; }
          messages.push({ role: "assistant", content: r.content });
          if (r.stop_reason === "pause_turn") continue;
          if (r.stop_reason !== "tool_use") break;
          const results = [];
          for (const b of r.content.filter(x => x.type === "tool_use")) {
            let out;
            try { if (!T[b.name] || !AGENT_TOOLS[agent].includes(b.name)) throw new Error("Unbekanntes Werkzeug"); out = await T[b.name].run(ctx, b.input || {}); }
            catch (e) { results.push({ type: "tool_result", tool_use_id: b.id, content: String(e.message || e).slice(0, 500), is_error: true }); continue; }
            results.push({ type: "tool_result", tool_use_id: b.id, content: typeof out === "string" ? out : JSON.stringify(out).slice(0, 30000) });
          }
          messages.push({ role: "user", content: results });
        }
      }
    } catch (e) {
      status = "Fehler"; error = e instanceof Anthropic.APIError ? `Anthropic ${e.status}: ${e.message}`.slice(0, 400) : String(e.message || e).slice(0, 400);
      console.error(`KI-Agent ${agent}:`, error);
    } finally {
      db.prepare("UPDATE agent_runs SET finished_at=?, status=?, summary=?, steps=?, tokens_in=?, tokens_out=?, searches=?, cost=?, error=? WHERE id=?")
        .run(now(), status, clean(summary, 1500), st.steps, st.tin, st.tout, st.searches, Math.round(st.cost * 10000) / 10000, error, runId);
      kvSet("agent_last_" + agent, now());
      running = null;
    }
    console.log(`KI-Agent ${AGENTS[agent].name}: ${status}, ${ctx.proposals} Vorschläge, ${st.cost.toFixed(3)} $`);
    return { runId, status, proposals: ctx.proposals };
  }

  /* Probelauf ohne Internet (ANTHROPIC_API_KEY=sk-ant-dev-attrappe): feste Beispielvorschläge über dieselben Werkzeuge */
  async function mockRun(ctx) {
    const say = [];
    if (ctx.agent === "sortiment") {
      const l = T.products_without_text.run(ctx, { limit: 2 });
      for (const p of l) say.push(T.propose_product_text.run(ctx, { id: p.id, desc: `${p.name} ist ein digitaler Code, den du direkt nach dem Kauf per E-Mail bekommst. Einlösen kannst du ihn im Konto bzw. Store der Marke.`, tags: [p.name.toLowerCase()], reason: "Probelauf" }));
      const best = topSellers(30, 1)[0] || { id: Object.keys(CATALOG)[0] };
      say.push(T.propose_highlight.run(ctx, { id: best.id, hot: true, reason: "Probelauf: Bestseller" }));
      say.push(T.note_sourcing_gap.run(ctx, { product: "Beispiel-Spiel (Probelauf)", reason: "Probelauf ohne Internet" }));
    } else if (ctx.agent === "design") {
      say.push(T.propose_design.run(ctx, { name: "Winterlicht", rationale: "Probelauf: kühlere Akzente für den Winter.", tokens: { "--lav": "#5B5BD6", "--pink": "#C2366F", "--pearl": "linear-gradient(115deg,#E3E9FF 0%,#DCEBFF 40%,#D8F3F0 70%,#EDE3FF 100%)" }, h1: "Digitale Codes.\nAuch zum Verschenken.", lead: "Gutscheine, Spiele-Keys und Guthaben – sicher bezahlt, dein Code kommt per E-Mail." }));
    } else {
      const h = await T.shop_health.run(ctx, {});
      say.push(T.write_report.run(ctx, { title: "Shop-Check (Probelauf)", text: `Offene Prüffälle: ${h.pruefen ? h.pruefen.anzahl : 0}. Offene Agenten-Vorschläge: ${h.offene_agenten_vorschlaege}.` }));
    }
    return "Probelauf ohne KI: " + say.join(" ");
  }

  /* ---------- Zeitplan: alle 5 Minuten prüfen, wer fällig ist ---------- */
  const due = (id, c) => c.on && c.agents[id].on && !(+kvGet("agent_last_" + id) > now() - c.agents[id].every * 36e5);
  async function tick() {
    if (!KEY || running) return;
    const c = cfg(); if (!c.on || spentToday() >= c.daily_usd) return;
    const id = Object.keys(AGENTS).find(a => due(a, c));
    if (id) await run(id, "zeitplan").catch(e => console.error("KI-Agent:", e.message));
  }
  setTimeout(tick, 3 * 60e3).unref(); setInterval(tick, 5 * 60e3).unref();

  /* ---------- Admin ---------- */
  const pubProp = p => ({ id: p.id, agent: p.agent, kind: p.kind, target: p.target, title: p.title, reason: p.reason, data: JSON.parse(p.data || "{}"), status: p.status, created_at: p.created_at, decided_at: p.decided_at, decided_by: p.decided_by, result: p.result });
  app.get("/api/admin/agents", admin, (req, res) => {
    const c = cfg();
    res.json({ key: !!KEY, mock: MOCK, supplier: RL.ON, cfg: c, models: MODELS, spent: Math.round(spentToday() * 100) / 100, running: running ? running.agent : null, live: liveTheme(),
      agents: Object.entries(AGENTS).map(([id, a]) => { const last = +kvGet("agent_last_" + id) || null; const lr = db.prepare("SELECT * FROM agent_runs WHERE agent=? ORDER BY id DESC LIMIT 1").get(id);
        return { id, name: a.name, what: a.what, last, next: last ? last + c.agents[id].every * 36e5 : null, lastRun: lr || null }; }),
      pending: db.prepare("SELECT * FROM agent_proposals WHERE status='pending' ORDER BY id DESC LIMIT 200").all().map(pubProp),
      history: db.prepare("SELECT * FROM agent_proposals WHERE status NOT IN ('pending','info') ORDER BY COALESCE(decided_at,created_at) DESC LIMIT 60").all().map(pubProp),
      runs: db.prepare("SELECT * FROM agent_runs ORDER BY id DESC LIMIT 30").all() });
  });
  app.post("/api/admin/agents/cfg", admin, (req, res) => {
    const b = req.body || {}, c = cfg();
    if (b.on != null) c.on = !!b.on;
    if (b.daily_usd != null) c.daily_usd = Math.min(500, Math.max(0, Number(b.daily_usd) || 0));
    if (b.model && MODELS.includes(b.model)) c.model = b.model;
    for (const [id, x] of Object.entries(b.agents || {})) if (c.agents[id]) {
      if (x.on != null) c.agents[id].on = !!x.on;
      if (x.mode) c.agents[id].mode = x.mode === "auto" ? "auto" : "review";
      if (x.every) c.agents[id].every = Math.min(720, Math.max(1, Number(x.every) || 1));
    }
    saveCfg(c); res.json({ ok: true, cfg: cfg() });
  });
  app.post("/api/admin/agents/:id/run", admin, (req, res) => {
    const id = String(req.params.id); if (!AGENTS[id]) return bad(res, "Unbekannter Agent", 404);
    if (!KEY) return bad(res, "ANTHROPIC_API_KEY fehlt (in Railway unter Variables eintragen).");
    if (running) return bad(res, `${AGENTS[running.agent].name} arbeitet gerade. Bitte kurz warten.`);
    if (spentToday() >= cfg().daily_usd) return bad(res, "Tages-Budget erreicht.");
    run(id, "admin").catch(e => console.error("KI-Agent:", e.message));
    res.json({ ok: true });
  });
  app.post("/api/admin/agents/proposals/:pid", admin, wrap(async (req, res) => {
    const id = parseInt(req.params.pid, 10), p = propRow(id); if (!p) return bad(res, "Nicht gefunden", 404);
    const act = String((req.body || {}).action || "");
    if (act === "apply") { try { return res.json({ ok: true, result: apply(id, req.user.email) }); } catch (e) { return bad(res, e.message); } }
    if (act === "reject" || act === "done") {
      if (!["pending", "info"].includes(p.status)) return bad(res, "Vorschlag ist nicht mehr offen.");
      db.prepare("UPDATE agent_proposals SET status=?, decided_at=?, decided_by=? WHERE id=?").run(act === "reject" ? "rejected" : "done", now(), req.user.email, id);
      return res.json({ ok: true });
    }
    bad(res, "Unbekannte Aktion");
  }));
  app.get("/api/admin/agents/design/:pid/preview", admin, (req, res) => {
    const p = propRow(parseInt(req.params.pid, 10)); if (!p || p.kind !== "design_theme") return bad(res, "Nicht gefunden", 404);
    const d = JSON.parse(p.data || "{}"); res.json({ name: d.name, tokens: checkTokens(d.tokens).tokens, hero: d.hero || null });
  });
  app.post("/api/admin/agents/design/reset", admin, (req, res) => {
    const prev = kvGet("design_live"); if (prev) kvSet("design_prev", prev);
    kvSet("design_live", "null"); touched(); res.json({ ok: true });
  });
  app.post("/api/admin/agents/meta/:id/reset", admin, (req, res) => {
    db.prepare("DELETE FROM product_meta WHERE id=?").run(String(req.params.id)); touched(); res.json({ ok: true });
  });
  /* Infos-Einträge (Berichte, Sortimentslücken) erscheinen bei den offenen Vorschlägen */
  app.get("/api/admin/agents/info", admin, (req, res) => res.json({ items: db.prepare("SELECT * FROM agent_proposals WHERE status='info' ORDER BY id DESC LIMIT 50").all().map(pubProp) }));

  console.log(KEY ? `KI-Agenten: ${MOCK ? "Probelauf-Modus (Attrappe)" : "aktiv"}, Modell ${cfg().model}, Budget ${cfg().daily_usd} $/Tag${cfg().on ? "" : " – im Admin ausgeschaltet"}`
    : "KI-Agenten: ruhen (ANTHROPIC_API_KEY fehlt)");
  return { decorate, themeCSS, publicTheme, run, cfg };
};
module.exports._checkTokens = checkTokens;
