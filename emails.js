"use strict";
/* E-Mails des Shops, verschickt über Resend (https://resend.com).
   Design „Chrome & Glas – hell“ (web/DESIGN.md): Porzellan-Grund, weiße Karte mit Haarlinie, Tinte, Akzent Lavendel,
   Chrom-Ring als Logo, schlanke Knöpfe (ein dunkler Hauptknopf pro Mail, sonst Linkknöpfe).
   Technik: Tabellen-Layout (Outlook, Gmail, Apple Mail), 600 px, mobile Schriftgrößen, Dark Mode (prefers-color-scheme
   und Outlook.com), Vorschautext, Textfassung. Titelbilder: /public/mail/h-*.jpg (Chrom-Ring auf Porzellan, 1200 × 400), Logo /public/mail/logo-ring.png.
   Absender: MAIL_FROM (Standard hallo@instacode.store). Antworten der Kunden gehen an SUPPORT_EMAIL.
   Ohne RESEND_API_KEY werden Mails nur im Log ausgegeben.
   Werbung (Newsletter, Aktionen, Bewertungsanfrage) nur mit Einwilligung, immer mit Abmeldelink und List-Unsubscribe-Kopfzeilen. */
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
/* Absendername ist immer „instantcodes“, egal was in MAIL_FROM als Name steht */
const FROM_ADDR = ((process.env.MAIL_FROM || "").match(/<([^>]+)>/) || [])[1] || (/@/.test(process.env.MAIL_FROM || "") ? process.env.MAIL_FROM.trim() : "hallo@instacode.store");
const FROM = `instantcodes <${FROM_ADDR}>`;
const REPLY = process.env.SUPPORT_EMAIL || "support@instacode.store";
const KEY = process.env.RESEND_API_KEY;
const FOOT = process.env.MAIL_FOOTER || "instacode.store";
const SELLER = (process.env.INVOICE_SELLER || "instacode.store").split(/\s*(?:\\n|\||·)\s*/).filter(Boolean);
const TAXNOTE = process.env.INVOICE_TAX_NOTE || "Alle Preise sind Endpreise.";
const IMPRESSUM = "https://mein.online-impressum.de/instacode/";
const HV = "6"; // Version der Titelbilder (Cache)
let CATALOG = {};
try { CATALOG = require("./catalog.json"); } catch (e) {}

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = c => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const first = n => esc(String(n || "").trim().split(" ")[0]);
const hi = n => String(n || "").trim() ? `Hallo ${first(n)}, ` : "";
const orderLink = o => `${BASE}/bestellung/${o.id}?k=${o.access_key}`;
const isTest = codes => (codes || []).some(c => /^TEST-/.test(c));
const day = t => new Date(t || Date.now()).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
const time = t => new Date(t || Date.now()).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const dtime = t => `${day(t)}, ${time(t)} Uhr`;

/* ---------- Farben und Schrift (Tokens aus web/css/01-base.css) ---------- */
const C = { page: "#F3F4F6", card: "#FFFFFF", ink: "#0E1014", ink2: "#474D59", ink3: "#656B78", line: "#E6E8EC", well: "#F6F7F9",
  lav: "#7D5CF0", iris: "#6A4FE0", ok: "#0E9F6E", rose: "#D9364C", amber: "#B86E00", star: "#E8A317" };
/* Dark Mode (Apple Mail, iOS, Outlook für Mac/Outlook.com): eigene Farben statt automatischer Umkehrung */
const DK = { page: "#0B0C0F", card: "#15171C", ink: "#F2F3F5", ink2: "#C9CDD4", ink3: "#9AA0AB", line: "#2A2E36", well: "#1D2026", link: "#B9A6FF" };
/* Statusfarben: Text kräftig genug für 4.5:1 auf der getönten Fläche */
const TONE = { ok: ["#E7F6EF", "#0A7A55", C.ok], lav: ["#F0ECFF", "#5A3FD0", C.lav], amber: ["#FFF3E0", "#8A5300", "#E39A1F"], rose: ["#FDECEE", "#B42335", C.rose], ink: ["#EEF0F3", "#30343C", "#656B78"] };
const FONT = "Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "'Geist Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";
const F = (size, color, weight = 400, lh) => `font-family:${FONT};font-size:${size}px;line-height:${lh || Math.round(size * 1.55)}px;font-weight:${weight};color:${color};`;

/* Produktinfos aus dem Katalog */
const PLAT_STORE = { steam: "in Steam", pc: "beim Hersteller", ea: "in der EA app", bnet: "in Battle.net", ubi: "in Ubisoft Connect", rockstar: "im Rockstar Games Launcher", ps5: "im PlayStation Store", xbox: "im Microsoft Store", xpc: "im Microsoft Store", switch: "im Nintendo eShop", switch2: "im Nintendo eShop" };
const absUrl = u => /^https?:/.test(u) ? u : BASE + u;
function prod(id, name) {
  const b = CATALOG[id] || {};
  const bg = b.bg || "linear-gradient(135deg,#1A1C21,#474D59)";
  const solid = (String(bg).match(/#[0-9a-fA-F]{6}/g) || ["#1A1C21"]);
  /* Bild: Reloadly-Originalbild, sonst die gestaltete Karte aus /public/cards (gibt es für alle Katalogprodukte) */
  const img = b.img ? absUrl(b.img) : CATALOG[id] && !b.rl ? `${BASE}/cards/${id}.jpg` : null;
  return { id, name: b.name || name || id, type: b.type, plat: b.plat, cat: b.cat, bg, solid: solid[Math.min(1, solid.length - 1)], fg: b.fg || "#FFFFFF",
    mark: (b.mark && b.mark.t) || b.name || name || id, labels: b.labels, amts: b.amts, img };
}
const variant = (i, P) => { const k = P.amts ? P.amts.indexOf(i.face / 100) : -1; return k >= 0 && P.labels && P.labels[k] ? P.labels[k] : eur(i.face); };
const redeemWhere = P => P.type === "key" ? (PLAT_STORE[P.plat] || "beim Hersteller") : `bei ${esc(P.name)}`;
const VATR = Number(process.env.VAT_RATE != null && process.env.VAT_RATE !== "" ? process.env.VAT_RATE : 0);
const fromPrice = b => eur(Math.min(...(b.amts || [0]).map(a => Math.round(Math.round((b.px && b.px[String(a)] != null ? b.px[String(a)] : a) * 100) * (100 + VATR) / 100))));

/* Einstellungen aus server.js (configure): Abmeldung Produktempfehlungen, offizielle Einlöse-Seiten (/go/<id>) */
let CFG = { optedOut: () => false, unsubLink: () => null, recs: true, redeem: () => null };
/* Einlösen: offizielle Seite über /go/<id>, falls bekannt, sonst unsere Produktseite mit Anleitung */
const redeemOf = P => { let r = null; try { r = CFG.redeem(P.id); } catch (e) {} return r ? { url: `${BASE}/go/${encodeURIComponent(P.id)}`, label: r.label || null, official: true } : { url: `${BASE}/marke/${encodeURIComponent(P.id)}`, official: false }; };

/* ---------- Bausteine ---------- */
const row = (inner, pad = "0 40px") => `<tr><td class="px" style="padding:${pad}">${inner}</td></tr>`;
const gap = h => `<tr><td height="${h}" style="height:${h}px;line-height:${h}px;font-size:0">&nbsp;</td></tr>`;
const h1 = t => `<h1 class="h1 ink" style="margin:0 0 12px;${F(28, C.ink, 600, 34)}letter-spacing:-0.6px;text-align:center">${t}</h1>`;
const h2 = t => `<h2 class="h2 ink" style="margin:30px 0 14px;${F(18, C.ink, 600, 24)}letter-spacing:-0.2px">${t}</h2>`;
const lead = t => `<p class="lead ink2" style="margin:0 0 24px;${F(16, C.ink2, 400, 25)}text-align:center">${t}</p>`;
const p = (t, s = "") => `<p class="p ink2" style="margin:0 0 14px;${F(15, C.ink2, 400, 24)}${s}">${t}</p>`;
const small = (t, s = "") => `<p class="mut" style="margin:0 0 12px;${F(13, C.ink3, 400, 20)}${s}">${t}</p>`;
const lnk = (href, t, s = "") => `<a class="lnk" href="${href}" style="color:${C.iris};font-weight:600;text-decoration:underline;text-underline-offset:3px;${s}">${t}</a>`;
/* Status unter der Überschrift: farbiger Punkt + Wort, daneben z. B. die Bestellnummer (keine Labels über Überschriften) */
const meta = (t, tone = "ok", extra) => { const [bg, fg, dot] = TONE[tone] || TONE.ok;
  return `<!--nt--><div style="text-align:center;margin:0 0 22px"><span class="pill" style="display:inline-block;padding:5px 12px 5px 10px;border-radius:999px;background:${bg};${F(13, fg, 600, 18)}"><span style="display:inline-block;width:7px;height:7px;border-radius:4px;background:${dot};vertical-align:1px;margin-right:7px"></span>${t}</span>${extra ? `<span class="mut" style="${F(13, C.ink3, 400, 18)}padding-left:10px">${extra}</span>` : ""}</div><!--/nt--><!--t:${t}${extra ? " · " + extra : ""}-->`; };
/* Hauptknopf: dunkle Tinte, schlanke Pille (Outlook: Fläche über bgcolor/mso-padding-alt). Pro Mail höchstens einer. */
const btn = (href, t, m = "4px auto 26px") => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:${m};border-collapse:separate"><tr><td class="btn-ink" align="center" bgcolor="${C.ink}" style="border-radius:999px;background:${C.ink};mso-padding-alt:13px 30px"><a class="btn-a" href="${href}" style="display:inline-block;padding:13px 30px;${F(15, "#FFFFFF", 600, 20)}text-decoration:none;border-radius:999px">${t}</a></td></tr></table>`;
/* Linkknopf: für alle Nebenaktionen */
const linkBtn = (href, t, align = "center", m = "0 0 22px") => `<p style="margin:${m};text-align:${align};${F(15, C.iris, 600, 22)}">${lnk(href, t)}</p>`;
/* Kasten mit Haarlinie */
const box = (inner, s = "", pad = "16px 18px") => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;border-collapse:separate"><tr><td class="card ln" bgcolor="#FFFFFF" style="background:#FFFFFF;border:1px solid ${C.line};border-radius:16px;padding:${pad};${s}">${inner}</td></tr></table>`;
const note = (t, tone = "amber") => { const [bg, fg] = TONE[tone] || TONE.amber; return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;border-collapse:separate"><tr><td class="pill" style="background:${bg};border-radius:14px;padding:12px 16px;${F(14, fg, 400, 21)}">${t}</td></tr></table>`; };
const label = t => `<div class="mut" style="${F(12, C.ink3, 500, 16)}margin:0 0 6px">${t}</div>`;
/* Zeilen „Bezeichnung … Wert“ mit Haarlinien */
const rows = (r, m = "0") => `<!--nt--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:${m}">${r.map(([a, b, strong], k) => {
  const bd = k < r.length - 1 ? `border-bottom:1px solid ${C.line};` : "";
  return `<tr><td class="ln ${strong ? "ink" : "mut"}" style="padding:9px 12px 9px 0;${bd}${F(strong ? 16 : 14, strong ? C.ink : C.ink3, strong ? 600 : 400, 20)}text-align:left;vertical-align:top">${a}</td><td class="ln ink" align="right" style="padding:9px 0;${bd}${F(strong ? 16 : 14, C.ink, strong ? 600 : 500, 20)}text-align:right;vertical-align:top">${b}</td></tr>`; }).join("")}</table><!--/nt--><!--t:${r.map(([a, b]) => `${a}: ${b}`).join("\\n")}-->`;
const totals = o => rows([["Zwischensumme", eur(o.subtotal)]].concat(o.discount ? [["Rabatt", "−" + eur(o.discount)]] : [], o.fee ? [["Servicegebühr", eur(o.fee)]] : [],
  [["Gesamt", eur(o.total), true]], VATR && o.vat ? [[`darin ${String(VATR).replace(".", ",")} % MwSt.`, eur(o.vat)]] : []));
const testNote = () => note("<b>Testbestellung:</b> Diese Codes stammen vom Testcode-Generator und sind nicht einlösbar.");
/* Nummerierte Schritte (untereinander, lesbar auf dem Handy) */
const steps = list => `<!--nt--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px">${list.map((s, i) => `<tr><td width="34" valign="top" style="padding:0 0 12px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr><td class="ln ink" align="center" valign="middle" width="24" height="24" style="width:24px;height:24px;border:1px solid ${C.line};border-radius:12px;${F(12, C.ink, 600, 22)}">${i + 1}</td></tr></table></td><td valign="top" class="ink2" style="padding:2px 0 12px;${F(15, C.ink2, 400, 21)}">${s}</td></tr>`).join("")}</table><!--/nt--><!--t:${list.map((s, i) => `${i + 1}. ${String(s).replace(/<[^>]+>/g, "")}`).join("\\n")}-->`;
const legalLinks = () => small(`Es gelten unsere ${lnk(`${BASE}/agb`, "AGB", "font-weight:400")} und die ${lnk(`${BASE}/widerruf`, "Widerrufsbelehrung", "font-weight:400")}.`, "text-align:center;margin:0 0 8px");

/* Codes immer als EIN zusammenhängender Text, damit Kopieren + Einfügen sauber klappt.
   Ein angehängter PIN („CODE · PIN 1234“) bekommt ein eigenes Feld, damit er nicht mitkopiert wird. */
const oneCode = (v, size, spacing) => `<div class="code ink" style="font-family:${MONO};font-size:${size}px;line-height:${Math.round(size * 1.3)}px;font-weight:600;letter-spacing:${spacing}px;color:${C.ink};word-break:break-all">${esc(v)}</div>`;
const codeBox = (c, lab = "Dein Code") => {
  const m = String(c).match(/^(.*?)\s*·\s*PIN\s*(.+)$/), main = m ? m[1] : String(c), pin = m ? m[2] : null;
  const one = (l, v) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 0;border-collapse:separate"><tr><td class="well" bgcolor="${C.well}" style="background:${C.well};border:1px solid ${C.line};border-radius:14px;padding:13px 16px">${label(l)}${oneCode(v, 20, 1.5)}</td></tr></table>`;
  return one(lab, main) + (pin ? one("PIN", pin) : "");
};
const bigCode = t => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 10px;border-collapse:separate"><tr><td class="well" align="center" bgcolor="${C.well}" style="background:${C.well};border:1px solid ${C.line};border-radius:16px;padding:16px 28px">${oneCode(t, 34, 8).replace("word-break:break-all", "white-space:nowrap")}</td></tr></table>
<!--nt--><p class="mut" style="margin:0 0 22px;${F(12, C.ink3, 400, 18)}text-align:center">Lange auf den Code tippen, um ihn zu kopieren</p><!--/nt-->`;

/* Produktbild (Karte) – klein als Vorschau, groß fürs Geschenk; ohne Bild eine Fläche in Markenfarbe */
const thumb = (P, w = 64) => { const h = Math.round(w / 1.47);
  return P.img ? `<img src="${P.img}" width="${w}" height="${h}" alt="" style="display:block;width:${w}px;height:${h}px;border:0;border-radius:8px;object-fit:cover">`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr><td width="${w}" height="${h}" align="center" valign="middle" bgcolor="${P.solid}" style="width:${w}px;height:${h}px;border-radius:8px;background:${P.solid};background-image:${P.bg};color:${P.fg};font:600 9px/1.1 ${FONT};padding:0 4px">${esc(String(P.mark).slice(0, 18))}</td></tr></table>`; };
const bigCard = (P, amt) => `<!--nt--><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 20px"><tr><td align="center">${P.img
  ? `<img src="${P.img}" width="300" alt="${esc(P.name)}" style="display:block;width:100%;max-width:300px;height:auto;border:0;border-radius:18px;margin:0 auto">`
  : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate"><tr><td width="300" height="190" valign="bottom" bgcolor="${P.solid}" style="width:300px;height:190px;border-radius:18px;background:${P.solid};background-image:${P.bg};color:${P.fg};padding:18px 20px;font:600 26px/1.1 ${FONT};letter-spacing:-0.5px">${esc(P.mark)}</td></tr></table>`}
  ${amt ? `<div class="ink" style="${F(15, C.ink, 600, 20)}margin-top:12px">${esc(amt)}</div>` : ""}</td></tr></table><!--/nt--><!--t:${esc(P.name)}${amt ? " · " + esc(amt) : ""}-->`;

/* Kopf einer Artikelzeile */
const itemHead = (P, sub, price, name) => `<!--nt--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td width="64" valign="middle">${thumb(P)}</td>
    <td valign="middle" style="padding-left:14px;text-align:left"><div class="ink" style="${F(15, C.ink, 600, 20)}">${esc(name || P.name)}</div><div class="mut" style="${F(13, C.ink3, 400, 19)}margin-top:2px">${sub}</div></td>
    ${price != null ? `<td align="right" valign="middle" class="ink" style="${F(15, C.ink, 600, 20)}white-space:nowrap;padding-left:10px">${price}</td>` : ""}</tr></table><!--/nt--><!--t:${esc(name || P.name)} · ${String(sub).replace(/<[^>]+>/g, "")}${price != null ? " · " + price : ""}-->`;
/* Einlösen: Code-Felder, kurze Anleitung, Link zur offiziellen Seite (oder Hauptknopf, wenn es nur einen Code gibt) */
const redeemBlock = (P, codes, main) => {
  if (!codes || !codes.length) return "";
  const r = redeemOf(P), how = `Einlösen ${redeemWhere(P)} unter „Code einlösen“${P.type === "key" ? " bzw. „Produkt aktivieren“" : ""}.`;
  return codes.map((c, k) => codeBox(c, codes.length > 1 ? `Code ${k + 1} von ${codes.length}` : P.type === "key" ? "Dein Key" : "Dein Code")).join("") +
    `<p class="mut" style="margin:10px 0 0;${F(13, C.ink3, 400, 20)}">${how} ${r.official ? "Der Link führt direkt zur offiziellen Seite." : ""}</p>` +
    (main ? btn(r.url, r.official ? "Jetzt einlösen" : "So löst du ein", "16px 0 2px") : `<p style="margin:10px 0 0;${F(14, C.iris, 600, 20)}">${lnk(r.url, r.official ? `Jetzt bei ${esc(P.name)} einlösen` : "Anleitung zum Einlösen")}</p>`);
};

/* Artikel einer Bestellung, optional mit Codes. main = der einzige Code bekommt den Hauptknopf „Jetzt einlösen“ */
const itemList = (o, withCodes, main) => o.items.map(i => {
  const P = prod(i.brand, i.name);
  const sub = `${esc(variant(i, P))} · Menge ${i.qty}${i.type === "topup" ? ` · ${esc(i.phone)}` : ""}${i.gift_to ? ` · Geschenk an ${esc(i.gift_to)}` : ""}`;
  let extra = "";
  if (withCodes && i.type === "code" && !i.gift_to && i.codes.length) extra = redeemBlock(P, i.codes, main);
  else if (withCodes && i.gift_to) extra = small(`Der Code wurde direkt an ${esc(i.gift_to)} geschickt.`, "margin:12px 0 0");
  else if (withCodes && i.type === "topup") extra = small(`Das Guthaben wurde auf ${esc(i.phone)} gebucht.${i.codes && i.codes[0] && !/^aufgeladen$/i.test(i.codes[0]) ? ` Referenz: ${esc(i.codes[0])}` : ""}`, "margin:12px 0 0");
  return box(itemHead(P, sub, eur(i.unit * i.qty)) + extra);
}).join("");

/* Beleg: Eckdaten der Bestellung + Summen */
const receipt = (o, extra = []) => box(rows([["Bestellnummer", esc(o.id)], ["Datum", day(o.paid_at || o.created_at)]].concat(extra, [["E-Mail", esc(o.email)]])) +
  `<div style="height:6px;line-height:6px;font-size:0">&nbsp;</div>` + totals(o));

/* Produktempfehlungen (nur an Käufer, mit Abmeldelink, § 7 Abs. 3 UWG) */
function recsFor(o) {
  if (!CFG.recs || !o || !o.email || CFG.optedOut(o.email)) return null;
  const bought = new Set((o.items || []).map(i => i.brand));
  const pool = Object.values(CATALOG).filter(b => b.img && b.rl && (b.region === "DE" || b.region === "AT") && !bought.has(b.id) && b.cat !== "topup");
  if (pool.length < 3) return null;
  const seed = [...String(o.id)].reduce((a, c) => a + c.charCodeAt(0), 0), pick = [];
  for (let k = 0; pick.length < 3 && k < 50; k++) { const b = pool[(seed * 31 + k * 97) % pool.length]; if (!pick.includes(b)) pick.push(b); }
  return { html: h2("Das könnte dir auch gefallen").replace("margin:30px 0 14px", "margin:6px 0 4px;text-align:center") + small("Sofort per Code, wie deine Bestellung", "text-align:center;margin:0 0 16px") +
    tiles(pick, "recs") + linkBtn(`${BASE}/kategorien?utm_source=mail&utm_medium=recs`, `Alle ${Object.keys(CATALOG).length.toLocaleString("de-DE")} Produkte ansehen`, "center", "18px 0 0") +
    `<!--t:Empfehlungen: ${pick.map(b => b.name).join(", ")}-->`, unsub: CFG.unsubLink(o.email) };
}
/* Produktkacheln (Empfehlungen, Werbemails): drei nebeneinander, auf dem Handy untereinander */
const tiles = (list, utm) => `<!--nt--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${list.map(b => { const P = prod(b.id, b.name);
  return `<td class="stack" width="${Math.floor(100 / list.length)}%" valign="top" style="padding:0 6px 14px"><a href="${BASE}/marke/${esc(b.id)}?utm_source=mail&amp;utm_medium=${utm}" style="text-decoration:none;display:block">
    ${P.img ? `<img src="${P.img}" width="160" alt="${esc(P.name)}" style="display:block;width:100%;max-width:160px;height:auto;border:0;border-radius:12px;margin:0 auto 8px">` : `<div style="height:8px"></div>`}
    <div class="ink" style="${F(14, C.ink, 600, 19)}text-align:center">${esc(P.name)}</div><div class="mut" style="${F(13, C.ink3, 400, 18)}text-align:center;margin-top:2px">ab ${fromPrice(b)}</div></a></td>`; }).join("")}</tr></table><!--/nt--><!--t:${list.map(b => `${esc(b.name)} (ab ${fromPrice(b)}): ${BASE}/marke/${esc(b.id)}`).join("\\n")}-->`;

/* Bewertung mit Sternen, die direkt zum Formular führen (nur in der Bewertungsanfrage, also nur mit Einwilligung) */
const stars = o => `<!--nt--><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 10px;border-collapse:separate"><tr>${[1, 2, 3, 4, 5].map(n => `<td style="padding:0 3px"><a href="${orderLink(o)}&amp;bewerten=1&amp;s=${n}" aria-label="${n} von 5 Sternen" style="display:inline-block;width:44px;height:44px;line-height:42px;text-align:center;border-radius:22px;border:1px solid ${C.line};font-family:${FONT};font-size:24px;color:${C.star};text-decoration:none" class="ln">★</a></td>`).join("")}</tr></table><!--/nt--><!--t:Jetzt bewerten: ${orderLink(o)}&bewerten=1-->`;

/* Hilfe-Zeile unten in der Karte */
const helpRow = () => `<tr><td class="px" style="padding:6px 40px 34px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="ln" style="border-top:1px solid ${C.line};padding-top:22px;text-align:center">
  <p class="ink" style="margin:0 0 4px;${F(15, C.ink, 600, 22)}">Brauchst du Hilfe?</p>
  <p class="ink2" style="margin:0;${F(14, C.ink2, 400, 22)}">Antworte einfach auf diese E-Mail, wir melden uns persönlich. Oder schau in die ${lnk(`${BASE}/hilfe`, "Hilfe und FAQ")}.</p></td></tr></table></td></tr>`;

/* ---------- Grundgerüst ---------- */
/* Logo: Chrom-Ring (aus icon-512.png, mit abgerundeten Ecken für Mails) + Wortmarke „instant“ kräftig, „codes“ leicht */
const wordmark = (size = 22) => `<a href="${BASE}/" style="text-decoration:none;display:inline-block"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td valign="middle"><img src="${BASE}/mail/logo-ring.png?v=${HV}" width="${Math.round(size * 1.6)}" height="${Math.round(size * 1.6)}" alt="instantcodes" style="display:block;width:${Math.round(size * 1.6)}px;height:${Math.round(size * 1.6)}px;border:0"></td><td valign="middle" class="ink" style="padding-left:9px;font-family:${FONT};font-size:${size}px;line-height:${size + 4}px;letter-spacing:-0.8px;color:${C.ink}"><span style="font-weight:700">instant</span><span style="font-weight:300">codes</span></td></tr></table></a>`;
const heroSrc = name => `${BASE}/mail/h-${name}.jpg?v=${HV}`;
const STYLE_FONT = `@font-face{font-family:'Geist';font-style:normal;font-weight:100 900;font-display:swap;src:url(${BASE}/fonts/geist.woff2) format('woff2')}
@font-face{font-family:'Geist Mono';font-style:normal;font-weight:100 900;font-display:swap;src:url(${BASE}/fonts/geist-mono.woff2) format('woff2')}`;
const STYLE = `:root{color-scheme:light dark;supported-color-schemes:light dark}
body{margin:0!important;padding:0!important;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table{mso-table-lspace:0pt;mso-table-rspace:0pt}img{-ms-interpolation-mode:bicubic}
a[x-apple-data-detectors],u+#body a,#MessageViewBody a{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}
@media (max-width:620px){.wrap{width:100%!important}.px{padding-left:22px!important;padding-right:22px!important}.outer{padding:16px 10px 28px!important}
.h1{font-size:25px!important;line-height:31px!important}.lead{font-size:17px!important;line-height:26px!important}.p{font-size:16px!important;line-height:25px!important}
.code{font-size:19px!important;letter-spacing:1px!important}.nav{padding:0 3px!important;font-size:12.5px!important}.navd{padding-right:6px!important}.stack{display:block!important;width:100%!important;max-width:100%!important;padding:0 0 16px!important}.stack img{max-width:190px!important}}`;
const STYLE_DARK = `@media (prefers-color-scheme:dark){.bg{background:${DK.page}!important}.card{background:${DK.card}!important;border-color:${DK.line}!important}.ink{color:${DK.ink}!important}.ink2{color:${DK.ink2}!important}.mut{color:${DK.ink3}!important}
.ln{border-color:${DK.line}!important}.well{background:${DK.well}!important;border-color:${DK.line}!important}.pill{background:${DK.well}!important;color:${DK.ink2}!important}
.btn-ink{background:${DK.ink}!important}.btn-a{color:#0E1014!important}.lnk{color:${DK.link}!important}.hero{background:${DK.card}!important}}`;
const STYLE_OL = `[data-ogsc] .ink{color:${DK.ink}!important}[data-ogsc] .ink2{color:${DK.ink2}!important}[data-ogsc] .mut{color:${DK.ink3}!important}[data-ogsc] .lnk{color:${DK.link}!important}[data-ogsc] .btn-a{color:#0E1014!important}
[data-ogsb] .bg{background:${DK.page}!important}[data-ogsb] .card{background:${DK.card}!important}[data-ogsb] .well,[data-ogsb] .pill{background:${DK.well}!important}[data-ogsb] .btn-ink{background:${DK.ink}!important}`;

const layout = m => `<!doctype html><html lang="de" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(m.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>td,th,div,p,a,h1,h2{font-family:Arial,sans-serif!important}</style><![endif]-->
<style>${STYLE}</style><style>${STYLE_DARK}</style><style>${STYLE_OL}</style><style>${STYLE_FONT}</style></head>
<body id="body" class="bg" style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${esc(m.pre)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg" bgcolor="${C.page}" style="background:${C.page}"><tr><td class="outer" align="center" style="padding:26px 12px 40px">
<!--[if mso]><table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;border-collapse:separate">
  <tr><td align="center" style="padding:4px 0 20px">${wordmark()}</td></tr>
  <tr><td class="card" bgcolor="#FFFFFF" style="background:#FFFFFF;border:1px solid ${C.line};border-radius:24px;overflow:hidden">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:#E9E4FF;background-image:linear-gradient(115deg,#FFD7EB 0%,#DCE3FF 34%,#C8F5EA 66%,#F0DDFF 100%)">&nbsp;</td></tr>
      ${m.hero ? `<tr><td class="hero" align="center" style="padding:0;background:#FFFFFF"><img src="${heroSrc(m.hero)}" width="598" alt="" style="display:block;width:100%;max-width:598px;height:auto;border:0"></td></tr>` : gap(34)}
      ${gap(m.hero ? 6 : 0)}
      ${row(m.body)}
      ${m.help === false ? gap(22) : helpRow()}
    </table>
  </td></tr>
  ${m.recs ? `${gap(16)}<tr><td class="card" bgcolor="#FFFFFF" style="background:#FFFFFF;border:1px solid ${C.line};border-radius:24px;padding:28px 24px 24px">${m.recs}</td></tr>` : ""}
  <tr><td align="center" style="padding:26px 20px 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${[["Shop", "/"], ["Kategorien", "/kategorien"], ["Handy aufladen", "/aufladen"], ["Abo", "/abo"]].map(([t, u], i) => `<td class="nav" style="padding:0 8px;white-space:nowrap;${F(13, C.ink, 500, 18)}">${i ? `<span class="mut navd" style="color:#B5BAC3;padding-right:16px">·</span>` : ""}<a class="ink" href="${BASE}${u}?utm_source=mail&amp;utm_medium=nav" style="color:${C.ink};text-decoration:none">${t}</a></td>`).join("")}</tr></table>
  </td></tr>
  <tr><td class="px" align="center" style="padding:18px 34px 0;text-align:center">
    <p class="mut" style="margin:0 0 10px;${F(12, C.ink3, 400, 19)}">${m.why || "Du erhältst diese E-Mail von instantcodes."}${m.unsub ? ` ${m.unsubText || "Produktempfehlungen kannst du jederzeit"} <a class="mut" href="${m.unsub}" style="color:${C.ink3};text-decoration:underline">${m.unsubLabel || "abbestellen"}</a>.` : ""}</p>
    <p class="mut" style="margin:0 0 10px;${F(12, C.ink3, 400, 19)}">Fragen? <a class="mut" href="mailto:${REPLY}" style="color:${C.ink3};text-decoration:underline">${REPLY}</a></p>
    <p style="margin:0 0 10px;${F(12, C.ink2, 500, 19)}"><a class="ink2" href="${BASE}/hilfe" style="color:${C.ink2};text-decoration:none">Hilfe</a> &nbsp;·&nbsp; <a class="ink2" href="${IMPRESSUM}" style="color:${C.ink2};text-decoration:none">Impressum</a> &nbsp;·&nbsp; <a class="ink2" href="${BASE}/agb" style="color:${C.ink2};text-decoration:none">AGB</a> &nbsp;·&nbsp; <a class="ink2" href="${BASE}/datenschutz" style="color:${C.ink2};text-decoration:none">Datenschutz</a></p>
    <p class="mut" style="margin:0;${F(12, C.ink3, 400, 19)}">© ${new Date().getFullYear()} ${esc(FOOT)} · Zahlung sicher über Stripe</p>
  </td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;

/* Textfassung für Mailprogramme ohne HTML (hilft auch gegen Spamfilter) */
const toText = m => (m.body + (m.recs ? "\n" + m.recs : ""))
  .replace(/<!--nt-->[\s\S]*?<!--\/nt-->/g, "").replace(/<!--t:([\s\S]*?)-->/g, (_, t) => "\n" + t.replace(/\\n/g, "\n") + "\n")
  .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, (_, h, t) => t && !/★/.test(t) ? `${t}: ${h}` : "")
  .replace(/<br\s*\/?>/g, "\n").replace(/<\/(p|h1|h2|tr|div|table)>/g, "\n").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#847;|&zwnj;/g, "")
  .split("\n").map(s => s.replace(/\s+/g, " ").trim()).filter((s, i, a) => s || a[i - 1]).join("\n").replace(/\n{3,}/g, "\n\n").trim()
  + `\n\n${m.help === false ? "" : `Fragen? Antworte auf diese E-Mail oder schreib an ${REPLY}.\n`}${String(m.why || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")}${m.unsub ? `\nAbmelden: ${m.unsub}` : ""}\nImpressum: ${IMPRESSUM}\n${FOOT}\n${BASE}`;

async function deliver(m) {
  if (/@sms\.instacode\.store$/i.test(String(m.to || ""))) return; // SMS-Konto ohne E-Mail-Adresse
  const html = layout(m), text = toText(m);
  if (!KEY) { console.log(`[E-Mail, nicht gesendet] an ${m.to}: ${m.subject}`); return; }
  const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
  if (m.once) headers["Idempotency-Key"] = m.once; // verhindert doppelte Mails, falls Stripe ein Ereignis zweimal schickt
  /* Werbung: Ein-Klick-Abmeldung nach RFC 8058 (Gmail, Apple Mail, Yahoo zeigen dafür „Abmelden“ an) */
  const mh = m.listUnsub ? { "List-Unsubscribe": `<${m.listUnsub}>, <mailto:${REPLY}?subject=${encodeURIComponent("Abmelden " + m.to)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined;
  const body = JSON.stringify({ from: FROM, to: [m.to], reply_to: m.reply === false ? undefined : REPLY, subject: m.subject, html, text, headers: mh, tags: [{ name: "art", value: m.kind }] });
  for (let t = 0; t < 3; t++) {
    const r = await fetch("https://api.resend.com/emails", { method: "POST", headers, body });
    if (r.ok) return;
    if (r.status === 429 || r.status >= 500) { await new Promise(ok => setTimeout(ok, 1500 * (t + 1))); continue; }
    throw new Error(`Resend ${r.status}: ${await r.text()}`);
  }
  throw new Error("Resend nicht erreichbar");
}

/* ---------- Die einzelnen Mails ---------- */
const WHY_ORDER = "Du erhältst diese E-Mail, weil du bei instantcodes bestellt hast.";
const WHY_ACC = "Du erhältst diese E-Mail, weil es um dein instantcodes-Konto geht.";
const WHY_SEC = "Sicherheitshinweis zu deinem instantcodes-Konto. Diese Hinweise schicken wir immer, damit niemand unbemerkt etwas ändert.";
const WHY_ABO = "Du erhältst diese E-Mail, weil du ein Abo bei instantcodes hast.";
const WHY_ADMIN = "Interne Benachrichtigung für das instantcodes-Team.";
const withRecs = o => { const R = recsFor(o); return R ? { recs: R.html, unsub: R.unsub } : {}; };
/* Gerät aus dem User-Agent, gut lesbar („iPhone · Safari“) */
const device = ua => { ua = String(ua || ""); const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Macintosh|Mac OS X/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "Chromebook" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return [os, br].filter(Boolean).join(" · ") || (ua ? esc(ua.slice(0, 60)) : "unbekannt"); };
/* Abo-Bausteine */
const aboTerm = n => n === 1 ? "pro Monat" : `für ${n} Monate`;
const aboItems = list => box(list.map((i, k) => { const P = prod(i.brand, i.name);
  return `<!--nt--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ln" style="${k ? `border-top:1px solid ${C.line};` : ""}"><tr><td width="64" valign="middle" style="padding:9px 0">${thumb(P)}</td>
    <td valign="middle" style="padding:9px 0 9px 14px;text-align:left"><div class="ink" style="${F(14, C.ink, 600, 19)}">${esc(i.label || P.name)}</div>${i.note ? `<div class="mut" style="${F(12.5, C.ink3, 400, 18)}margin-top:2px">${esc(i.note)}</div>` : ""}</td>
    <td align="right" valign="middle" class="ink" style="${F(14, C.ink, 600, 19)}white-space:nowrap">${eur(i.face)}</td></tr></table><!--/nt--><!--t:${esc(i.label || P.name)}${i.note ? " (" + esc(i.note) + ")" : ""} · ${eur(i.face)}-->`; }).join(""), "", "6px 18px");
/* Laufzeit und Kündigung in einfachen Worten (gleiche Regeln wie in den AGB) */
const aboRules = (v, firstEnd, renewed) => box(`${label("Laufzeit und Kündigung")}<div class="ink2" style="${F(14, C.ink2, 400, 22)}">${v.months === 1
  ? "Dein Abo verlängert sich jeden Monat automatisch. Du kannst jederzeit zum Ende des bezahlten Monats kündigen."
  : renewed ? `Dein Abo hat sich um ${v.months} Monate verlängert. Du kannst jetzt jederzeit mit einer Frist von einem Monat kündigen. Monate, die danach nicht mehr geliefert werden, erstatten wir anteilig.`
  : `Die erste Laufzeit geht ${v.months} Monate${firstEnd ? ` bis zum ${day(firstEnd)}` : ""}. Kündigst du bis dahin nicht, verlängert sich das Abo um jeweils ${v.months} Monate – dann kannst du jederzeit mit einer Frist von einem Monat kündigen und bekommst nicht mehr gelieferte Monate anteilig zurück.`}
  Kündigen geht ohne Anmeldung unter ${lnk(v.cancelLink, "Verträge hier kündigen")}.</div>`);
const SOFORT = "Digitale Inhalte: Mit der sofortigen Lieferung ist dein Widerrufsrecht erloschen, da du dem beim Kauf ausdrücklich zugestimmt hast.";

const M = {
  /* ===== Konto ===== */
  verify: (to, name, code) => ({ kind: "konto", to, hero: "code", why: WHY_ACC,
    subject: `${code} ist dein Bestätigungscode`, pre: "Gib den Code im Shop ein. Er ist 15 Minuten gültig.",
    body: h1(`Fast geschafft${name ? ", " + first(name) : ""}!`) + lead("Gib diesen Code im Shop ein, um deine E-Mail-Adresse zu bestätigen.") + bigCode(code) +
      small("Der Code ist 15 Minuten gültig. Wenn du kein Konto erstellt hast, kannst du diese E-Mail einfach ignorieren.", "text-align:center") }),

  loginCode: (to, name, code) => ({ kind: "konto", to, hero: "code", why: WHY_ACC,
    subject: `${code} ist dein Anmeldecode`, pre: "Gib den Code zum Anmelden ein. Er ist 15 Minuten gültig.",
    body: h1("Dein Anmeldecode") + lead(`${hi(name)}gib diesen Code ein, um dich bei instantcodes anzumelden.`) + bigCode(code) +
      small("Der Code ist 15 Minuten gültig und funktioniert nur einmal. Du hast keinen Code angefordert? Dann ignoriere diese E-Mail – ohne den Code kommt niemand in dein Konto.", "text-align:center") }),

  orderCode: (to, code) => ({ kind: "bestellung", to, hero: "code", why: "Du erhältst diese E-Mail, weil diese Adresse bei einer Bestellung auf instantcodes angegeben wurde.",
    subject: `${code} ist dein Code für deine Bestellung`, pre: "Bestätige deine E-Mail, dann kannst du bezahlen. Der Code ist 15 Minuten gültig.",
    body: h1("Bestätige deine E-Mail") + lead("Gib diesen Code im Warenkorb ein. Danach kannst du bezahlen, und deine Codes kommen sicher an diese Adresse.") + bigCode(code) +
      small("Der Code ist 15 Minuten gültig. Wenn du nichts bestellen wolltest, kannst du diese E-Mail ignorieren.", "text-align:center") }),

  test: to => ({ kind: "konto", to, hero: "check", why: WHY_ACC,
    subject: "Testmail: Der E-Mail-Versand von instantcodes funktioniert", pre: "Wenn du das liest, kommen Bestellmails bei deinen Kunden an.",
    body: h1("E-Mail-Versand funktioniert") + meta("Zugestellt", "ok") + lead("Diese Testmail kommt aus deinem Admin-Bereich. Bestellbestätigungen, Codes und Konto-E-Mails werden genauso zugestellt.") }),

  welcome: (to, name) => ({ kind: "konto", to, hero: "welcome", why: WHY_ACC,
    subject: `Willkommen bei instantcodes${name ? ", " + String(name).split(" ")[0] : ""}`, pre: "Dein Konto ist bereit – und 10 % Rabatt warten auf dich.",
    body: h1(`Schön, dass du da bist${name ? ", " + first(name) : ""}!`) + lead("Gutscheine, Spiele-Keys, Abos und Handy-Guthaben – bezahlt in Sekunden, der Code kommt direkt per E-Mail.") +
      btn(`${BASE}/`, "Jetzt stöbern") + h2("So einfach geht’s") + steps(["Produkt und Betrag wählen", "Sicher bezahlen, zum Beispiel mit Apple Pay", "Code sofort auf dem Bildschirm und per E-Mail erhalten"]) +
      h2("Dein Willkommensgeschenk") + p("10 % Rabatt auf deine erste Bestellung. Gib den Code einfach an der Kasse ein:") + codeBox("WILLKOMMEN10", "Dein Rabattcode") +
      small(`Tipp: Mit einem Passkey meldest du dich per Face ID oder Touch ID an – ohne Passwort. Einrichten kannst du ihn in deinem ${lnk(`${BASE}/konto/einstellungen`, "Konto", "font-weight:400")}.`, "margin:16px 0 4px") }),

  loginAlert: (to, name, ua) => ({ kind: "sicherheit", to, hero: "shield", why: WHY_SEC,
    subject: "Neue Anmeldung bei deinem instantcodes-Konto", pre: "Warst du das? Dann musst du nichts tun.",
    body: h1("Neue Anmeldung") + lead(`${hi(name)}gerade hat sich jemand bei deinem Konto angemeldet.`) +
      box(rows([["Zeitpunkt", dtime()], ["Gerät", device(ua)]])) +
      p("Warst du das? Dann musst du nichts tun. Falls nicht, setze sofort ein neues Passwort und entferne unbekannte Passkeys in deinem Konto.", "text-align:center;margin-top:16px") +
      btn(`${BASE}/login`, "Passwort zurücksetzen") + small(`Diese Hinweise kannst du in deinem ${lnk(`${BASE}/konto/einstellungen`, "Konto unter Einstellungen", "font-weight:400")} abschalten.`, "text-align:center") }),

  reset: (to, name, link) => ({ kind: "sicherheit", to, hero: "shield", why: WHY_SEC,
    subject: "Passwort zurücksetzen", pre: "Der Link ist 30 Minuten gültig.",
    body: h1("Neues Passwort festlegen") + lead(`${hi(name)}tippe auf den Knopf, um ein neues Passwort für dein Konto zu wählen.`) + btn(link, "Neues Passwort festlegen") +
      small("Der Link ist 30 Minuten gültig. Wenn du das nicht angefragt hast, ignoriere diese E-Mail – dein Passwort bleibt unverändert.", "text-align:center") }),

  pwChanged: (to, name) => ({ kind: "sicherheit", to, hero: "shield", why: WHY_SEC,
    subject: "Dein Passwort wurde geändert", pre: "Aus Sicherheitsgründen wurdest du überall abgemeldet.",
    body: h1("Dein Passwort ist neu") + meta("Passwort geändert", "ok", dtime()) + lead(`${hi(name)}das Passwort für dein Konto wurde geändert. Aus Sicherheitsgründen wurdest du auf allen Geräten abgemeldet.`) +
      btn(`${BASE}/login`, "Anmelden") + small(`Warst du das nicht? Dann antworte sofort auf diese E-Mail oder schreib an ${esc(REPLY)}.`, "text-align:center") }),

  emailChanged: (to, name, newEmail) => ({ kind: "sicherheit", to, hero: "shield", why: WHY_SEC,
    subject: "Deine E-Mail-Adresse wurde geändert", pre: `Ab jetzt schreiben wir an ${newEmail}.`,
    body: h1("Neue E-Mail-Adresse") + meta("Geändert", "ok", dtime()) + lead(`${hi(name)}die E-Mail-Adresse deines Kontos wurde geändert. Bestellungen, Codes und Hinweise gehen ab jetzt an die neue Adresse.`) +
      box(rows([["Bisher", esc(to)], ["Neu", esc(newEmail)]])) +
      p(`Warst du das nicht? Dann antworte sofort auf diese E-Mail oder schreib an ${esc(REPLY)} – wir sperren das Konto, bis alles geklärt ist.`, "text-align:center;margin-top:16px"),
    help: false }),

  passkeyAdded: (to, name, pk, ua) => ({ kind: "sicherheit", to, hero: "shield", why: WHY_SEC,
    subject: "Neuer Passkey für dein instantcodes-Konto", pre: "Warst du das? Dann musst du nichts tun.",
    body: h1("Neuer Passkey hinzugefügt") + lead(`${hi(name)}für dein Konto wurde ein Passkey eingerichtet. Damit kannst du dich ab jetzt per Face ID, Touch ID oder Windows Hello anmelden – ohne Passwort.`) +
      box(rows([["Passkey", esc((pk && pk.name) || "Passkey")], ["Hinzugefügt", dtime(pk && pk.created_at)], ["Gerät", device(ua)]])) +
      p("Warst du das nicht? Entferne den Passkey sofort in deinem Konto und antworte auf diese E-Mail.", "text-align:center;margin-top:16px") +
      btn(`${BASE}/konto/einstellungen`, "Passkeys verwalten") }),

  passkeyRemoved: (to, name, pk) => ({ kind: "sicherheit", to, hero: "shield", why: WHY_SEC,
    subject: "Ein Passkey wurde aus deinem Konto entfernt", pre: "Mit diesem Passkey ist keine Anmeldung mehr möglich.",
    body: h1("Passkey entfernt") + lead(`${hi(name)}aus deinem Konto wurde ein Passkey entfernt. Mit ihm ist keine Anmeldung mehr möglich.`) +
      box(rows([["Passkey", esc((pk && pk.name) || "Passkey")], ["Entfernt", dtime()]])) +
      p("Warst du das nicht? Dann setze sofort ein neues Passwort, prüfe deine übrigen Passkeys und antworte auf diese E-Mail.", "text-align:center;margin-top:16px") +
      btn(`${BASE}/konto/einstellungen`, "Konto prüfen") }),

  deleted: (to, name) => ({ kind: "konto", to, hero: "bye", why: WHY_ACC,
    subject: "Dein instantcodes-Konto wurde gelöscht", pre: "Schade, dass du gehst.",
    body: h1("Dein Konto ist gelöscht") + meta("Gelöscht", "ink", dtime()) + lead(`${hi(name)}dein Konto wurde gelöscht. Rechnungsdaten bewahren wir nur so lange auf, wie es gesetzlich vorgeschrieben ist.`) +
      btn(`${BASE}/`, "Ohne Konto weiter einkaufen") + small("Du hast das nicht veranlasst? Antworte bitte sofort auf diese E-Mail.", "text-align:center") }),

  /* ===== Kauf ===== */
  /* Bestellung eingegangen, Zahlung läuft noch (z. B. Lastschrift, PayPal in Prüfung) */
  orderPending: o => ({ kind: "bestellung", to: o.email, hero: "clock", once: `pending-${o.id}`, why: WHY_ORDER,
    subject: `Bestellung eingegangen – ${o.id}`, pre: "Sobald deine Zahlung bestätigt ist, geht es weiter.",
    body: h1("Danke für deine Bestellung") + meta("Zahlung wird bestätigt", "amber", `Bestellung ${esc(o.id)}`) +
      lead("Deine Zahlungsart braucht etwas länger. Sobald die Zahlung bestätigt ist, bekommst du die nächste E-Mail – bei Sofortlieferung direkt mit deinen Codes.") +
      btn(orderLink(o), "Bestellstatus ansehen") + h2("Deine Bestellung") + itemList(o, false) + receipt(o) +
      small("Es wurde noch nichts ausgeliefert. Klappt die Zahlung nicht, stornieren wir die Bestellung automatisch.", "text-align:center;margin-top:14px") + legalLinks() }),

  /* Zahlung bestätigt, Bestellung wird noch geprüft (nicht automatisch ausgeliefert) */
  orderReceived: o => ({ ...withRecs(o), kind: "bestellung", to: o.email, hero: "clock", once: `received-${o.id}`, why: WHY_ORDER,
    subject: `Zahlung erhalten – Bestellung ${o.id}`, pre: "Wir bereiten deine Codes vor und melden uns gleich wieder.",
    body: h1("Danke! Deine Zahlung ist da.") + meta("Zahlung erhalten", "lav", `Bestellung ${esc(o.id)}`) +
      lead("Wir bereiten deine Bestellung vor und sehen sie uns kurz an, bevor die Codes rausgehen. Sobald alles bereit ist, bekommst du eine zweite E-Mail mit deinen Codes.") +
      btn(orderLink(o), "Bestellstatus ansehen") + h2("Deine Bestellung") + itemList(o, false) + receipt(o, [["Zahlung", "bezahlt über Stripe"]]) +
      small("Du hast beim Kauf zugestimmt, dass wir sofort liefern. Dein Widerrufsrecht erlischt mit der Lieferung der Codes.", "text-align:center;margin-top:14px") + legalLinks() }),

  delivered: o => {
    if (o.items.every(i => i.type === "topup")) return M.topupDone(o);
    if (o.items.some(i => i.gift_to) && !o.items.some(i => i.type === "code" && !i.gift_to)) return M.giftSent(o);
    const own = o.items.filter(i => i.type === "code" && !i.gift_to && i.codes.length), single = own.length === 1 && own[0].codes.length === 1;
    return { ...withRecs(o), kind: "lieferung", to: o.email, hero: "check", once: `delivered-${o.id}`, why: WHY_ORDER,
      subject: `Deine Codes sind da – Bestellung ${o.id}`, pre: o.items.map(i => i.name).slice(0, 3).join(", ") + " · jetzt einlösen",
      body: (o.items.some(i => isTest(i.codes)) ? testNote() : "") + h1("Deine Codes sind da") + meta("Geliefert", "ok", `Bestellung ${esc(o.id)}`) +
        lead("Hier sind deine Codes. Sie liegen auch jederzeit in deiner Bestellübersicht.") + itemList(o, true, single) +
        (single ? linkBtn(orderLink(o), "Bestellung ansehen", "center", "16px 0 6px") : btn(orderLink(o), "Bestellung ansehen", "16px auto 6px")) +
        h2("So löst du ein") + steps(["Code antippen und kopieren", "„Jetzt einlösen“ öffnet die offizielle Seite – dort „Code einlösen“ wählen", "Code einfügen, fertig"]) +
        h2("Beleg") + receipt(o, [["Zahlung", "bezahlt über Stripe"]]) +
        small(`Bestellnummer ${esc(o.id)} · ${SOFORT}`, "text-align:center;margin-top:14px") + legalLinks() }; },

  topupDone: o => ({ ...withRecs(o), kind: "lieferung", to: o.email, hero: "phone", once: `delivered-${o.id}`, why: WHY_ORDER,
    subject: `Dein Guthaben ist gebucht – Bestellung ${o.id}`, pre: o.items.map(i => `${i.name} ${eur(i.face)}`).slice(0, 3).join(", ") + " · aufgeladen",
    body: h1("Dein Guthaben ist gebucht") + meta("Aufgeladen", "ok", `Bestellung ${esc(o.id)}`) +
      lead("Wir haben das Guthaben auf die angegebene Nummer gebucht. Es ist in der Regel sofort verfügbar.") + itemList(o, true) +
      small("Noch nicht da? Warte ein paar Minuten und frag dein Guthaben beim Anbieter ab (zum Beispiel in der App deines Anbieters). Hilft das nicht, antworte uns einfach.", "text-align:center;margin:14px 0 4px") +
      btn(orderLink(o), "Bestellung ansehen", "14px auto 6px") + h2("Beleg") + receipt(o, [["Zahlung", "bezahlt über Stripe"]]) +
      small(`Bestellnummer ${esc(o.id)} · Mit der vollständigen Ausführung ist dein Widerrufsrecht erloschen, da du dem beim Kauf ausdrücklich zugestimmt hast.`, "text-align:center;margin-top:14px") + legalLinks() }),

  /* Bestätigung an den Käufer, wenn die Bestellung nur Geschenke enthält (Codes gingen direkt an die Beschenkten) */
  giftSent: o => { const g = o.items.filter(i => i.gift_to), to = [...new Set(g.map(i => i.gift_to))];
    return { ...withRecs(o), kind: "geschenk", to: o.email, hero: "gift", once: `delivered-${o.id}`, why: WHY_ORDER,
      subject: `Dein Geschenk ist verschickt – Bestellung ${o.id}`, pre: `Zugestellt an ${to.slice(0, 2).join(", ")}${to.length > 2 ? " …" : ""}`,
      body: h1(g.length > 1 ? "Deine Geschenke sind verschickt" : "Dein Geschenk ist verschickt") + meta("Zugestellt", "ok", `Bestellung ${esc(o.id)}`) +
        lead(`Wir haben ${g.length > 1 ? "die Codes" : "den Code"} per E-Mail an ${to.map(esc).join(", ")} geschickt${g.some(i => i.gift_msg) ? " – zusammen mit deiner Nachricht" : ""}.`) +
        o.items.map(i => { const P = prod(i.brand, i.name);
          return box(itemHead(P, `${esc(variant(i, P))} · Menge ${i.qty}${i.gift_to ? ` · an ${esc(i.gift_to)}` : i.type === "topup" ? ` · ${esc(i.phone)}` : ""}`, eur(i.unit * i.qty)) +
            (i.gift_msg ? `<p class="ink2" style="margin:12px 0 0;${F(14, C.ink2, 400, 21)}font-style:italic">„${esc(i.gift_msg)}“</p>` : "") +
            (i.type === "topup" ? small(`Das Guthaben wurde auf ${esc(i.phone)} gebucht.`, "margin:12px 0 0") : "")); }).join("") +
        small("Aus Sicherheitsgründen zeigen wir den Code hier nicht. Ist die E-Mail nicht angekommen? Die beschenkte Person sollte im Spam-Ordner nachsehen – oder du antwortest uns, wir helfen.", "text-align:center;margin:14px 0 4px") +
        btn(orderLink(o), "Bestellung ansehen", "14px auto 6px") + h2("Beleg") + receipt(o, [["Zahlung", "bezahlt über Stripe"]]) +
        small(`Bestellnummer ${esc(o.id)} · ${SOFORT}`, "text-align:center;margin-top:14px") + legalLinks() }; },

  /* An die beschenkte Person */
  gift: (o, i) => { const P = prod(i.brand, i.name), from = i.gift_from || "Jemand";
    return { kind: "geschenk", to: i.gift_to, hero: "gift", once: `gift-${o.id}-${i.id}`, why: `Du erhältst diese E-Mail, weil ${esc(from)} dir über instantcodes ein Geschenk geschickt hat. Deine Adresse nutzen wir nur für diese Zustellung.`,
      subject: P.type === "key" ? `${from} hat dir ${P.name} geschenkt` : `${from} hat dir einen ${P.name}-Gutschein geschenkt`, pre: i.gift_msg || "Ein Geschenk für dich",
      body: (isTest(i.codes) ? testNote() : "") + h1(`${esc(from)} hat an dich gedacht`) +
        (i.gift_msg ? `<p class="ink" style="margin:0 0 24px;${F(19, C.ink, 500, 28)}font-style:italic;text-align:center">„${esc(i.gift_msg)}“</p>` : lead("Für dich ist ein Geschenk angekommen.")) +
        bigCard(P, variant(i, P)) + redeemBlock(P, i.codes, i.codes.length === 1) +
        (i.codes.length === 1 ? "" : btn(redeemOf(P).url, redeemOf(P).official ? "Jetzt einlösen" : "So löst du ein", "18px auto 4px")) +
        h2("So löst du ein") + steps(["Code antippen und kopieren", `„Jetzt einlösen“ öffnen und ${redeemWhere(P)} „Code einlösen“ wählen`, "Code einfügen, fertig"]) }; },

  invoice: o => ({ kind: "rechnung", to: o.email, hero: "receipt", once: `invoice-${o.id}`, why: WHY_ORDER,
    subject: `Deine Rechnung zu Bestellung ${o.id}`, pre: `Rechnung RE-${o.id} über ${eur(o.total)}`,
    body: h1("Deine Rechnung") + lead(`Danke für deinen Einkauf! Hier ist die Rechnung zu deiner Bestellung ${esc(o.id)}.`) +
      box(`<!--nt--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td class="stack ink2" valign="top" style="${F(13, C.ink2, 400, 20)}text-align:left;padding-right:10px">${label("Von")}${SELLER.map(esc).join("<br>")}</td>
        <td class="stack ink2" valign="top" style="${F(13, C.ink2, 400, 20)}text-align:left">${label("An")}${esc(o.email)}</td></tr></table><!--/nt--><!--t:Von: ${SELLER.map(esc).join(", ")}\\nAn: ${esc(o.email)}-->`) +
      box(rows([["Rechnungsnummer", `RE-${esc(o.id)}`], ["Rechnungsdatum", day(o.paid_at)], ["Lieferdatum", day(o.delivered_at || o.paid_at)], ["Zahlung", "bezahlt über Stripe"]])) +
      h2("Positionen") + itemList(o, false) + box(totals(o)) + small(esc(TAXNOTE), "text-align:center") + btn(orderLink(o), "Bestellung ansehen", "8px auto 10px") }),

  refunded: (o, reason) => ({ kind: "bestellung", to: o.email, hero: "refund", once: `refund-${o.id}`, why: WHY_ORDER,
    subject: `Erstattung für Bestellung ${o.id}`, pre: `${eur(o.total)} sind auf dem Weg zurück zu dir.`,
    body: h1("Dein Geld ist unterwegs") + meta("Erstattet", "lav", `Bestellung ${esc(o.id)}`) + lead(`Wir konnten deine Bestellung leider nicht ausliefern und haben ${eur(o.total)} erstattet.`) +
      (reason ? box(`<!--nt-->${label("Grund")}<div class="ink" style="${F(15, C.ink, 400, 22)}">${esc(reason)}</div><!--/nt--><!--t:Grund: ${esc(reason)}-->`) : "") +
      p("Je nach Zahlungsart ist das Geld in wenigen Werktagen wieder auf deinem Konto.", "text-align:center;margin-top:8px") + h2("Erstattete Artikel") + itemList(o, false) + box(totals(o)) }),

  paymentFailed: o => ({ kind: "bestellung", to: o.email, hero: "alert", once: `failed-${o.id}`, why: WHY_ORDER,
    subject: `Zahlung nicht abgeschlossen – Bestellung ${o.id}`, pre: "Es wurde nichts abgebucht. Du kannst es direkt nochmal versuchen.",
    body: h1("Die Zahlung hat nicht geklappt") + meta("Nicht bezahlt", "rose", `Bestellung ${esc(o.id)}`) + lead("Deine Zahlung konnte leider nicht abgeschlossen werden, die Bestellung wurde storniert. Es wurde nichts abgebucht.") +
      btn(`${BASE}/warenkorb`, "Erneut versuchen") + itemList(o, false) }),

  /* Bewertungsanfrage: Werbung im Sinne des UWG – nur mit ausdrücklicher Einwilligung (Konto oder Bestellseite), mit Abmeldelink */
  reviewRequest: (o, unsub) => ({ kind: "bewertung", to: o.email, hero: "star", once: `review-${o.id}`, unsub, listUnsub: unsub, unsubText: "Keine Bewertungsanfragen mehr?", unsubLabel: "Hier abmelden",
    why: "Du erhältst diese E-Mail, weil du zugestimmt hast, dass wir dich nach einem Kauf um eine Bewertung bitten.",
    subject: "Wie zufrieden bist du mit deiner Bestellung?", pre: "Ein Klick genügt – deine Bewertung erscheint als verifizierter Kauf.",
    body: h1("Wie war dein Einkauf?") + lead(`Du hast vor ein paar Tagen bei uns bestellt (${esc(o.id)}). Wie zufrieden bist du? Ein Klick auf die Sterne genügt.`) + stars(o) +
      small("Deine Bewertung erscheint im Shop als verifizierter Kauf. Wir zeigen alle Bewertungen, auch kritische.", "text-align:center;margin:6px 0 22px") +
      o.items.slice(0, 3).map(i => { const P = prod(i.brand, i.name); return box(itemHead(P, esc(variant(i, P)), null)); }).join(""), help: false }),

  adminNew: (to, o) => ({ kind: "admin", to, hero: "clock", reply: false, help: false, once: `admin-${o.id}-${to}`, why: WHY_ADMIN,
    subject: `Prüfung nötig: ${o.id} (${eur(o.total)})`, pre: o.hold_reason || "Bitte manuell bearbeiten.",
    body: h1("Bestellung wartet auf dich") + meta("Prüfung nötig", "amber", esc(o.id)) + lead(`${esc(o.email)} hat bezahlt. Die Bestellung wurde nicht automatisch ausgeliefert.`) +
      (o.hold_reason ? note(`<b>Grund:</b> ${esc(o.hold_reason)}`) : "") + itemList(o, false) + box(totals(o)) + btn(`${BASE}/admin`, "Im Admin-Bereich öffnen", "8px auto 10px") }),

  /* ===== Newsletter und Werbung (nur an bestätigte Abonnenten) ===== */
  /* Double-Opt-in: enthält bewusst keine Werbung, nur die Bitte um Bestätigung */
  newsletterConfirm: (to, link) => ({ kind: "newsletter", to, hero: "mail", why: "Du erhältst diese E-Mail, weil diese Adresse für den Newsletter von instantcodes eingetragen wurde. Ohne deine Bestätigung schicken wir dir keinen Newsletter.",
    subject: "Bitte bestätige deine Anmeldung zum Newsletter", pre: "Ein Klick, dann bist du dabei. Ohne Bestätigung schicken wir dir nichts.",
    body: h1("Bitte bestätige deine Anmeldung") + lead("Du hast dich für den Newsletter von instantcodes angemeldet. Bitte bestätige das mit einem Klick – erst dann tragen wir dich ein.") +
      btn(link, "Anmeldung bestätigen") +
      small("Der Link ist 7 Tage gültig. Wenn du dich nicht angemeldet hast, ignoriere diese E-Mail einfach – dann bekommst du nichts weiter von uns.", "text-align:center") +
      box(`${label("Was du bekommst")}<div class="ink2" style="${F(14, C.ink2, 400, 22)}">Neuigkeiten zu neuen Marken, Angeboten und Aktionen von instantcodes per E-Mail. Abmelden kannst du dich jederzeit mit einem Klick am Ende jeder E-Mail. Mehr dazu in der ${lnk(`${BASE}/datenschutz`, "Datenschutzerklärung", "font-weight:400")}.</div>`, "margin-top:10px"), help: false }),

  /* Aktion / Werbemail. c = { subject, pre, title, text, brands:[ids], cta, url, code, codeNote, img } */
  promo: (to, c, unsub) => { const list = (c.brands || []).map(id => CATALOG[id]).filter(Boolean).slice(0, 6);
    const url = c.url && /^https:\/\/|^\//.test(c.url) ? absUrl(c.url) : `${BASE}/`;
    return { kind: "werbung", to, hero: c.img ? null : "sparkle", unsub, listUnsub: unsub, unsubText: "Keine Newsletter mehr?", unsubLabel: "Mit einem Klick abmelden", help: false,
      why: "Du erhältst diese E-Mail, weil du den Newsletter von instantcodes abonniert und bestätigt hast.",
      subject: c.subject || "Neu bei instantcodes", pre: c.pre || "",
      body: (c.img && /^https:\/\//.test(c.img) ? `<img src="${esc(c.img)}" width="520" alt="" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:16px;margin:0 auto 24px">` : "") +
        h1(esc(c.title || c.subject || "Neu bei instantcodes")) + String(c.text || "").split(/\n\s*\n/).filter(Boolean).map(t => lead(esc(t).replace(/\n/g, "<br>"))).join("") +
        (list.length ? `<div style="height:4px"></div>` + [0, 3].map(k => list.slice(k, k + 3)).filter(x => x.length).map(x => tiles(x, "newsletter")).join("") : "") +
        (c.code ? `<div style="height:6px"></div>` + codeBox(c.code, "Dein Aktionscode") + (c.codeNote ? small(esc(c.codeNote), "margin:8px 0 0") : "") : "") +
        btn(url, esc(c.cta || "Jetzt ansehen"), "24px auto 8px") }; },

  /* ===== Abo ===== */
  aboStarted: (v, per, plan) => ({ kind: "abo", to: v.email, hero: "repeat", once: `abo-start-${v.id}`, why: WHY_ABO,
    subject: `Dein Abo ${v.planName} ist aktiv – ${v.id}`, pre: "Danke! Wir bereiten dein erstes Code-Paket vor.",
    body: h1(`Willkommen im Abo ${esc(v.planName)}`) + meta("Abo aktiv", "lav", esc(v.id)) +
      lead(`Danke${v.name ? ", " + first(v.name) : ""}! Deine Zahlung ist da. Ab jetzt bekommst du jeden Monat ein Paket mit Codes – das erste bereiten wir gerade vor.`) +
      box(rows([["Vertragsnummer", esc(v.id)], ["Plan", `${esc(v.planName)} · ${eur(v.price)} ${aboTerm(v.months)}`], ["Bezahlt für", `${day(per.start)} – ${day(per.end)}`],
        ["Nächste Abbuchung", `${day(per.end)} · ${eur(v.price)}`], ["Kündbar zum", day(per.end)]])) +
      (plan && plan.items && plan.items.length ? h2("Das steckt in deinem Abo") + aboItems(plan.items.map(i => ({ brand: i.brand, name: i.name, label: i.label, face: i.face, note: i.every > 1 ? `alle ${i.every} Monate` : "jeden Monat" }))) : "") +
      p("Jede Lieferung prüfen wir kurz von Hand, damit niemand dein Abo missbrauchen kann. Das dauert meist nur wenige Stunden. Danach kommen die Codes per E-Mail und liegen in deinem Abo.", "text-align:center;margin-top:16px") +
      btn(v.link, "Abo ansehen") + aboRules(v, per.end) +
      small(`Du hast zugestimmt, dass wir vor Ablauf der Widerrufsfrist mit der Lieferung beginnen. Dein Widerrufsrecht erlischt mit der ersten Lieferung der Codes. Es gelten unsere ${lnk(`${BASE}/agb`, "AGB", "font-weight:400")}.`, "text-align:center;margin-top:14px") }),

  aboRenewed: (v, per) => ({ kind: "abo", to: v.email, hero: "receipt", once: `abo-renew-${v.id}-${per.no}`, why: WHY_ABO,
    subject: `Zahlung erhalten – dein Abo ${v.planName} läuft weiter`, pre: `${eur(per.amount)} für ${day(per.start)} – ${day(per.end)}`,
    body: h1("Dein Abo läuft weiter") + meta("Zahlung erhalten", "lav", esc(v.id)) +
      lead(`Wir haben ${eur(per.amount)} für ${v.months === 1 ? "den nächsten Monat" : `die nächsten ${v.months} Monate`} abgebucht. Deine Code-Pakete kommen weiter jeden Monat.`) +
      box(rows([["Vertragsnummer", esc(v.id)], ["Zeitraum", `${day(per.start)} – ${day(per.end)}`], ["Betrag", eur(per.amount)], ["Nächste Abbuchung", v.cancel_at && v.cancel_at <= per.end + 6e4 ? "keine, Abo ist gekündigt" : day(per.end)]])) +
      btn(v.link, "Abo ansehen", "16px auto 22px") + aboRules(v, null, true) +
      (per.invoice ? small(`Den Beleg von Stripe findest du ${lnk(esc(per.invoice), "hier", "font-weight:400")}.`, "text-align:center") : "") }),

  aboDelivery: (v, d) => { const all = d.items.flatMap(i => i.codes || []);
    return { kind: "abo", to: v.email, hero: "check", once: `abo-del-${v.id}-${d.month}`, why: WHY_ABO,
      subject: `Deine Codes für Monat ${d.month} sind da – Abo ${v.id}`, pre: d.items.map(i => i.name).slice(0, 4).join(", ") + " · jetzt einlösen",
      body: (isTest(all) ? testNote() : "") + h1(`Dein Paket für Monat ${d.month}`) + meta("Geliefert", "ok", `Abo ${esc(v.planName)}`) +
        lead("Hier sind deine Codes. Sie liegen auch jederzeit in deinem Abo.") +
        d.items.map(i => { const P = prod(i.brand, i.name);
          return box(itemHead(P, `Wert ${eur(i.face)}`, null, i.label) + redeemBlock(P, i.codes || [], false)); }).join("") +
        btn(v.link, "Abo ansehen", "16px auto 6px") + h2("So löst du ein") + steps(["Code antippen und kopieren", "„Jetzt einlösen“ öffnet die offizielle Seite – dort „Code einlösen“ wählen", "Code einfügen, fertig"]) +
        small(`Vertragsnummer ${esc(v.id)} · Kündigen kannst du jederzeit online: ${lnk(v.cancelLink, "Verträge hier kündigen", "font-weight:400")}`, "text-align:center;margin-top:14px") }; },

  aboCanceled: (c, base) => { const B = base || BASE, res = c.results || [];
    return { kind: "abo", to: c.email, hero: "receipt", once: `abo-cancel-${c.id}-${res.length}`, why: "Du erhältst diese E-Mail, weil über instantcodes eine Kündigung mit dieser Adresse eingegangen ist.",
      subject: `Kündigung erhalten – ${c.id}`, pre: res.length ? `Dein Vertrag endet am ${day(res[0].end)}.` : "Wir haben deine Kündigung erhalten und ordnen sie zu.",
      body: h1("Deine Kündigung ist eingegangen") + meta("Kündigung erhalten", "lav", esc(c.id)) +
        lead(`${hi(c.name)}hiermit bestätigen wir den Eingang deiner Kündigung. Bitte bewahre diese E-Mail als Nachweis auf.`) +
        box(rows([["Eingegangen am", dtime(c.received_at)], ["Eingangsnummer", esc(c.id)], ["Name", esc(c.name)], ["E-Mail", esc(c.email)], ["Vertragsnummer", esc(c.ref || "nicht angegeben")],
          ["Art", c.kind === "ausserordentlich" ? "Außerordentliche Kündigung" : "Ordentliche Kündigung"]].concat(c.reason ? [["Grund", esc(c.reason)]] : [],
          [["Gewünschter Zeitpunkt", c.wish === "date" && c.wish_date ? `zum ${day(c.wish_date)}` : "zum nächstmöglichen Zeitpunkt"]]))) +
        (res.length ? h2(res.length > 1 ? "Deine Verträge" : "Dein Vertrag") + res.map(r => box(`${label(`Abo ${esc(r.planName)} · ${esc(r.sub)}`)}
          <div class="ink" style="${F(17, C.ink, 600, 24)}margin:2px 0 6px">Endet am ${day(r.end)}${r.end - Date.now() < 36e5 && r.end <= (c.received_at || 0) + 36e5 ? ` um ${time(r.end)} Uhr` : ""}</div>
          <div class="ink2" style="${F(14, C.ink2, 400, 22)}">${r.already ? "Dieser Vertrag war bereits zu diesem Termin gekündigt." : r.adjusted ? `Der gewünschte Termin liegt vor dem frühestmöglichen Ende. Wir haben die Kündigung deshalb zum ${day(r.end)} vorgemerkt.` : "Bis dahin bekommst du deine Code-Pakete wie gewohnt, danach buchen wir nichts mehr ab."}${r.refund > 0 ? ` Für Monate, die nicht mehr geliefert werden, erstatten wir dir anteilig <b>${eur(r.refund)}</b> über deine ursprüngliche Zahlungsart.` : ""}</div>`)).join("")
          : box(`<div class="ink2" style="${F(15, C.ink2, 400, 23)}">Zu diesen Angaben haben wir noch keinen laufenden Vertrag gefunden. Wir prüfen deine Kündigung von Hand und melden uns bei dir. Du musst nichts weiter tun.</div>`)) +
        small(`Fragen? Antworte einfach auf diese E-Mail. Deine Kündigung kannst du jederzeit unter ${lnk(`${B}/kuendigen`, `${esc(B.replace(/^https?:\/\//, ""))}/kuendigen`, "font-weight:400")} abgeben.`, "text-align:center;margin-top:14px") }; },

  aboPaymentFailed: (v, f) => ({ kind: "abo", to: v.email, hero: "alert", once: `abo-failed-${f.id}`, why: WHY_ABO,
    subject: `Zahlung fehlgeschlagen – Abo ${v.id}`, pre: "Bitte prüfe deine Zahlungsart, damit dein Abo weiterläuft.",
    body: h1("Die Abbuchung hat nicht geklappt") + meta("Zahlung offen", "rose", esc(v.id)) +
      lead(`Wir konnten ${eur(f.amount)} für dein Abo ${esc(v.planName)} nicht abbuchen. Bitte prüfe deine Karte oder wähle eine andere Zahlungsart.`) +
      btn(f.url || v.link, f.url ? "Jetzt bezahlen" : "Abo ansehen") +
      p(`Stripe versucht die Abbuchung in den nächsten Tagen automatisch erneut${f.next ? ` (nächster Versuch am ${day(f.next)})` : ""}. Solange die Zahlung offen ist, pausieren neue Lieferungen. Klappt die Zahlung nicht, endet das Abo automatisch.`, "text-align:center") +
      small(`Du möchtest das Abo nicht fortsetzen? ${lnk(v.cancelLink, "Hier kündigen", "font-weight:400")}`, "text-align:center") }),

  aboRefund: (v, amount, reason) => ({ kind: "abo", to: v.email, hero: "refund", why: WHY_ABO,
    subject: `Erstattung für dein Abo ${v.id}`, pre: `${eur(amount)} sind auf dem Weg zurück zu dir.`,
    body: h1("Dein Geld ist unterwegs") + meta("Erstattet", "lav", esc(v.id)) + lead(`Wir haben dir ${eur(amount)} für dein Abo ${esc(v.planName)} erstattet.`) +
      (reason ? box(`<!--nt-->${label("Grund")}<div class="ink" style="${F(15, C.ink, 400, 22)}">${esc(reason)}</div><!--/nt--><!--t:Grund: ${esc(reason)}-->`) : "") +
      p("Je nach Zahlungsart ist das Geld in wenigen Werktagen wieder auf deinem Konto.", "text-align:center;margin-top:8px") + btn(v.link, "Abo ansehen") }),

  aboEnded: v => ({ kind: "abo", to: v.email, hero: "repeat", once: `abo-end-${v.id}`, why: WHY_ABO,
    subject: `Dein Abo ${v.planName} ist beendet – ${v.id}`, pre: "Wir buchen nichts mehr ab. Deine Codes bleiben gültig.",
    body: h1("Dein Abo ist beendet") + meta("Beendet", "ink", esc(v.id)) +
      lead(`${hi(v.name)}dein Abo ${esc(v.planName)} ist ausgelaufen. Wir buchen nichts mehr ab. Bereits gelieferte Codes bleiben gültig und liegen weiter in deinem Abo.`) +
      btn(v.link, "Abo ansehen") + small("Ist das ein Irrtum? Antworte einfach auf diese E-Mail.", "text-align:center") }),

  aboAdmin: (to, v, d) => ({ kind: "admin", to, hero: "clock", reply: false, help: false, once: `abo-admin-${v.id}-${d.month}-${to}`, why: WHY_ADMIN,
    subject: `Abo-Lieferung freigeben: ${v.id} Monat ${d.month} (${eur(d.value)})`, pre: `${v.email} · ${v.planName}`,
    body: h1("Abo-Lieferung wartet") + meta("Freigabe nötig", "amber", `Monat ${d.month}`) + lead(`${esc(v.email)} · Abo ${esc(v.id)} (${esc(v.planName)})`) +
      aboItems(d.items) + box(rows([["Code-Wert", eur(d.value)], ["Abo-Preis", `${eur(v.price)} ${aboTerm(v.months)}`]])) + btn(`${BASE}/admin`, "Im Admin freigeben", "8px auto 10px") }),

  aboAdminCancel: (to, c) => ({ kind: "admin", to, hero: "receipt", reply: false, help: false, once: `abo-admcancel-${c.id}-${to}`, why: WHY_ADMIN,
    subject: `${c.results && c.results.length ? "Kündigung" : "Kündigung ohne Zuordnung"}: ${c.id} (${c.email})`, pre: c.kind === "ausserordentlich" ? "Außerordentlich – Grund prüfen" : "Ordentliche Kündigung",
    body: h1("Neue Kündigung") + meta(c.results && c.results.length ? "Kündigung" : "Bitte zuordnen", c.results && c.results.length ? "lav" : "amber", esc(c.id)) +
      box(rows([["Eingang", dtime(c.received_at)], ["Name", esc(c.name)], ["E-Mail", esc(c.email)], ["Vertragsnummer", esc(c.ref || "–")], ["Art", c.kind === "ausserordentlich" ? "außerordentlich" : "ordentlich"]]
        .concat(c.reason ? [["Grund", esc(c.reason)]] : [], (c.results || []).map(r => [esc(r.sub), `endet ${day(r.end)}${r.refund ? ` · Erstattung ${eur(r.refund)}` : ""}`])))) +
      btn(`${BASE}/admin`, "Im Admin ansehen", "8px auto 10px") })
};

/* ---------- Übersicht für die Admin-Vorschau: Gruppe, Auslöser, Beispieldaten ---------- */
function samples() {
  const t0 = Date.now() - 36e5, o = { id: "IC-7F3A21C9", access_key: "beispiel", email: "lena@example.com", subtotal: 12497, discount: 0, fee: 499, vat: 0, total: 12996, created_at: t0, paid_at: t0, delivered_at: Date.now(),
    hold_reason: "Bestellwert über 50 €", items: [
      { id: 1, brand: "steam", name: "Steam", face: 2000, unit: 2000, qty: 1, type: "code", codes: ["7HQ2K-9XW4P-M3ZRT"] },
      { id: 2, brand: "fc26-ps5", name: "EA SPORTS FC 26", face: 6999, unit: 6999, qty: 1, type: "code", codes: ["XK4D-92PL-QR7M"] },
      { id: 3, brand: "netflix", name: "Netflix", face: 2500, unit: 2500, qty: 1, type: "code", gift_to: "max@example.com", gift_from: "Lena", gift_msg: "Alles Gute zum Geburtstag, Max!", codes: ["NFX-4821-7763-0091"] },
      { id: 4, brand: "vodafone", name: "Vodafone", face: 1500, unit: 1500, qty: 1, type: "topup", phone: "+49 151 2345678", codes: ["aufgeladen"] }] };
  const one = { ...o, id: "IC-2B81D0E4", subtotal: 2000, total: 2499, items: [o.items[0]] };
  const codes = { ...o, items: o.items.slice(0, 3), subtotal: 11499, total: 11998 };
  const top = { ...o, id: "IC-5C0FFEE1", subtotal: 1500, total: 1999, items: [o.items[3]] };
  const gifts = { ...o, id: "IC-61F7A0B2", subtotal: 2500, total: 2999, items: [o.items[2]] };
  const v = { id: "AB-4E2A91C7", key: "beispiel", email: "lena@example.com", name: "Lena Hoffmann", plan: "premium", planName: "Premium", price: 5000, months: 3,
    link: `${BASE}/abo/AB-4E2A91C7?k=beispiel`, cancelLink: `${BASE}/kuendigen?abo=AB-4E2A91C7`, cancel_at: null };
  const per = { no: 1, start: t0, end: t0 + 92 * 864e5, amount: 5000, invoice: null };
  const plan = { items: [{ brand: "netflix", name: "Netflix", label: "Netflix 15 €", face: 1500, every: 1 }, { brand: "spotify", name: "Spotify", label: "Spotify 10 €", face: 1000, every: 1 }, { brand: "psplus-essential", name: "PlayStation Plus", label: "PlayStation Plus Essential 1 Monat", face: 899, every: 3 }] };
  const del = { month: 1, value: 2500, items: [{ brand: "netflix", name: "Netflix", label: "Netflix 15 €", face: 1500, codes: ["NFX-1180-5523-7731"] }, { brand: "spotify", name: "Spotify", label: "Spotify 10 €", face: 1000, codes: ["SPOT-77QX-21MN"] }] };
  const cancel = { id: "KD-91B3E0A2", received_at: Date.now(), name: "Lena Hoffmann", email: "lena@example.com", ref: "AB-4E2A91C7", kind: "ordentlich", wish: "next", results: [{ sub: "AB-4E2A91C7", planName: "Premium", end: per.end, refund: 0 }] };
  const promo = { subject: "Neu im Sortiment: Spotify, Netflix und mehr", pre: "Die neuen Marken auf einen Blick.", title: "Neu bei instantcodes", text: "Ab sofort findest du neue Marken im Shop – wie immer sofort per Code.\n\nSchau dich um und finde dein nächstes Geschenk.", brands: ["spotify", "netflix", "apple"], cta: "Neuheiten ansehen", url: "/kategorien" };
  const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const U = `${BASE}/newsletter/abmelden?e=lena%40example.com&s=beispiel`;
  return [
    ["Konto", "welcome", "Willkommen", "Erste Bestätigung eines Kontos (Code, Google, Apple …)", ["lena@example.com", "Lena Hoffmann"]],
    ["Konto", "verify", "E-Mail bestätigen (Code)", "Registrierung, Anmeldung mit Passwort oder Code bei unbestätigter Adresse", ["lena@example.com", "Lena Hoffmann", "482913"]],
    ["Konto", "loginCode", "Anmelde-Code", "Anmeldung ohne Passwort bei bestätigtem Konto", ["lena@example.com", "Lena Hoffmann", "731904"]],
    ["Konto", "reset", "Passwort zurücksetzen", "„Passwort vergessen?“", ["lena@example.com", "Lena", `${BASE}/passwort?t=beispiel`]],
    ["Konto", "pwChanged", "Passwort geändert", "Neues Passwort über den Link gesetzt", ["lena@example.com", "Lena"]],
    ["Konto", "emailChanged", "E-Mail geändert", "Vorlage bereit – der Shop hat noch keine Funktion zum Ändern der E-Mail", ["lena@example.com", "Lena", "lena.neu@example.com"]],
    ["Konto", "loginAlert", "Neue Anmeldung", "Anmeldung (abschaltbar im Konto)", ["lena@example.com", "Lena", ua]],
    ["Konto", "passkeyAdded", "Passkey hinzugefügt", "Passkey im Konto angelegt", ["lena@example.com", "Lena", { name: "iCloud-Schlüsselbund · iPhone", created_at: Date.now() }, ua]],
    ["Konto", "passkeyRemoved", "Passkey entfernt", "Passkey im Konto gelöscht", ["lena@example.com", "Lena", { name: "iCloud-Schlüsselbund · iPhone" }]],
    ["Konto", "deleted", "Konto gelöscht", "Konto im Konto-Bereich gelöscht", ["lena@example.com", "Lena"]],
    ["Kauf", "orderCode", "Bestell-E-Mail bestätigen", "Code im Warenkorb vor der Zahlung", ["lena@example.com", "590172"]],
    ["Kauf", "orderPending", "Bestellung eingegangen", "Zahlung läuft noch (z. B. Lastschrift, PayPal in Prüfung)", [one]],
    ["Kauf", "orderReceived", "Zahlung erhalten, in Prüfung", "Bezahlt, aber nicht automatisch ausgeliefert", [o]],
    ["Kauf", "delivered", "Codes geliefert", "Auslieferung (automatisch oder im Admin)", [codes]],
    ["Kauf", "delivered", "Codes geliefert (ein Code)", "Auslieferung mit genau einem Code: Hauptknopf „Jetzt einlösen“", [one]],
    ["Kauf", "topupDone", "Handy-Aufladung gebucht", "Auslieferung einer Bestellung nur mit Aufladungen", [top]],
    ["Kauf", "giftSent", "Geschenk verschickt (an Käufer)", "Auslieferung einer Bestellung nur mit Geschenken", [gifts]],
    ["Kauf", "gift", "Geschenk (an Empfänger)", "Auslieferung, pro Geschenk an die beschenkte Person", [o, o.items[2]]],
    ["Kauf", "invoice", "Rechnung", "Auslieferung, nur mit INVOICE_MAIL=1", [codes]],
    ["Kauf", "refunded", "Erstattung", "Erstattung im Admin", [one, "Artikel derzeit nicht verfügbar"]],
    ["Kauf", "paymentFailed", "Zahlung fehlgeschlagen", "Verzögerte Zahlung fehlgeschlagen (Stripe)", [one]],
    ["Werbung", "reviewRequest", "Bewertungsanfrage", "3 Tage nach Lieferung, nur mit Einwilligung (Konto oder Bestellseite)", [codes, U]],
    ["Werbung", "newsletterConfirm", "Newsletter bestätigen (Double-Opt-in)", "Anmeldung in der Fußzeile", ["lena@example.com", `${BASE}/newsletter/bestaetigen?t=beispiel`]],
    ["Werbung", "promo", "Aktion / Newsletter", "Versand im Admin, nur an bestätigte Abonnenten", ["lena@example.com", promo, U]],
    ["Abo", "aboStarted", "Abo aktiv", "Erste Zahlung eines Abos", [v, per, plan]],
    ["Abo", "aboDelivery", "Abo-Lieferung", "Freigabe einer Monatslieferung", [v, del]],
    ["Abo", "aboRenewed", "Abo verlängert", "Folgezahlung", [v, { ...per, no: 2 }]],
    ["Abo", "aboPaymentFailed", "Abo-Zahlung fehlgeschlagen", "Fehlgeschlagene Folgezahlung", [v, { id: "in_beispiel", amount: 5000, url: null, next: Date.now() + 3 * 864e5 }]],
    ["Abo", "aboCanceled", "Kündigung erhalten", "Kündigung im Konto oder über /kuendigen", [cancel]],
    ["Abo", "aboRefund", "Abo-Erstattung", "Anteilige Erstattung im Admin", [v, 1667, "Anteilige Erstattung nach Kündigung"]],
    ["Abo", "aboEnded", "Abo beendet", "Abo ist ausgelaufen", [v]],
    ["Intern", "adminNew", "Admin: Prüfung nötig", "Bestellung wartet auf Freigabe", ["admin@example.com", o]],
    ["Intern", "aboAdmin", "Admin: Abo-Freigabe", "Abo-Lieferung wartet auf Freigabe", ["admin@example.com", v, { ...del, value: 2500 }]],
    ["Intern", "aboAdminCancel", "Admin: Kündigung", "Neue Kündigung", ["admin@example.com", cancel]],
    ["Intern", "test", "Testmail", "Admin › Übersicht › Testmail", ["admin@example.com"]]
  ].map(([group, key, name, trigger, args], i) => ({ id: `${i + 1}`.padStart(2, "0") + "-" + key, group, key, name, trigger, args }));
}

module.exports = Object.fromEntries(Object.keys(M).map(k => [k, (...a) => deliver(M[k](...a))]));
/* Vorschau ohne Versand (für Tests, Screenshots und die Admin-Vorschau) */
module.exports._render = (k, ...a) => { const m = M[k](...a); return { to: m.to, subject: m.subject, pre: m.pre, html: layout(m), text: toText(m), kind: m.kind, listUnsub: m.listUnsub || null }; };
module.exports._samples = samples;
/* Beispiel-Mail aus der Admin-Vorschau an eine Adresse schicken (Betreff mit „[Vorschau]“, ohne Idempotenz-Schlüssel) */
module.exports._sendSample = (id, to) => { const s = samples().find(x => x.id === id); if (!s) throw new Error("Unbekannte Vorlage");
  const m = M[s.key](...s.args); return deliver(Object.assign(m, { to, once: undefined, subject: "[Vorschau] " + m.subject })); };
module.exports._keys = Object.keys(M);
module.exports.configure = c => { CFG = Object.assign(CFG, c); };
