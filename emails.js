"use strict";
/* E-Mails des Shops, verschickt über Resend (https://resend.com).
   Design: schwarz mit violettem Verlauf, animierte Kartenmotive (GIF aus /public/mail), Schriftzug als Bild.
   Absender: MAIL_FROM (Standard hallo@instacode.store). Antworten der Kunden gehen an SUPPORT_EMAIL (Strato-Postfach).
   Ohne RESEND_API_KEY werden Mails nur im Log ausgegeben. */
const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
/* Absendername ist immer „instantcodes“, egal was in MAIL_FROM als Name steht */
const FROM_ADDR = ((process.env.MAIL_FROM || "").match(/<([^>]+)>/) || [])[1] || (/@/.test(process.env.MAIL_FROM || "") ? process.env.MAIL_FROM.trim() : "hallo@instacode.store");
const FROM = `instantcodes <${FROM_ADDR}>`;
const REPLY = process.env.SUPPORT_EMAIL || "support@instacode.store";
const KEY = process.env.RESEND_API_KEY;
const FOOT = process.env.MAIL_FOOTER || "instacode.store";
const SELLER = (process.env.INVOICE_SELLER || "instacode.store").split(/\s*(?:\\n|\||·)\s*/).filter(Boolean);
const TAXNOTE = process.env.INVOICE_TAX_NOTE || "Alle Preise sind Endpreise.";
let CATALOG = {};
try { CATALOG = require("./catalog.json"); } catch (e) {}

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = c => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const first = n => esc(String(n || "").split(" ")[0]);
const orderLink = o => `${BASE}/bestellung/${o.id}?k=${o.access_key}`;
const isTest = codes => (codes || []).some(c => /^TEST-/.test(c));
const day = t => new Date(t || Date.now()).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });

/* ---------- Farben und Schrift (wie Template + Shop) ---------- */
/* Hell wie die Website: weiß, Glasflächen in Lavendel, violetter Verlauf für Buttons */
const C = { page: "#F3F2FA", blue: "#6D4BFF", btnA: "#7C5CFF", btnB: "#4F46E5", violet: "#5B3FE6", label: "#6D4BFF",
  white: "#0A0C1A", text: "#2A2F45", muted: "#636A85", card: "#F6F4FF", line: "#E7E3FA", code: "#F3F0FF", star: "#F7B23B", ok: "#3DDC97", warn: "#FFB86B", bad: "#FF7A70" };
const FONT = "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const T = () => `font-family:${FONT};`;

/* Produktinfos aus dem Katalog: Farben, Logo-Text, Variante (z. B. „PS5-Key“) */
const PLAT_STORE = { steam: "in Steam", pc: "beim Hersteller", ea: "in der EA app", bnet: "in Battle.net", ubi: "in Ubisoft Connect", rockstar: "im Rockstar Games Launcher", ps5: "im PlayStation Store", xbox: "im Microsoft Store", xpc: "im Microsoft Store", switch: "im Nintendo eShop", switch2: "im Nintendo eShop" };
function prod(id, name) {
  const b = CATALOG[id] || {};
  const bg = b.bg || "linear-gradient(135deg,#0B00CF,#6B5BFF,#C6A8FF)";
  const solid = (String(bg).match(/#[0-9a-fA-F]{6}/g) || ["#3B2BD9"]);
  return { id, name: b.name || name || id, type: b.type, plat: b.plat, bg, solid: solid[Math.min(1, solid.length - 1)], fg: b.fg || "#FFFFFF",
    mark: (b.mark && b.mark.t) || b.name || name || id, labels: b.labels, amts: b.amts, img: b.img ? (/^https?:/.test(b.img) ? b.img : BASE + b.img) : null };
}
const variant = (i, P) => { const k = P.amts ? P.amts.indexOf(i.face / 100) : -1; return k >= 0 && P.labels && P.labels[k] ? P.labels[k] : eur(i.face); };
const redeemWhere = P => P.type === "key" ? (PLAT_STORE[P.plat] || "beim Hersteller") : `in ${esc(P.name)}`;

/* ---------- Produktempfehlungen (nur an Käufer, mit Abmeldelink, § 7 Abs. 3 UWG) ---------- */
let CFG = { optedOut: () => false, unsubLink: () => null, recs: true };
function recsFor(o) {
  if (!CFG.recs || !o || !o.email || CFG.optedOut(o.email)) return null;
  const bought = new Set((o.items || []).map(i => i.brand));
  const pool = Object.values(CATALOG).filter(b => b.img && b.rl && (b.region === "DE" || b.region === "AT") && !bought.has(b.id) && b.cat !== "topup");
  if (pool.length < 3) return null;
  const seed = [...String(o.id)].reduce((a, c) => a + c.charCodeAt(0), 0), pick = [];
  for (let k = 0; pick.length < 3 && k < 50; k++) { const b = pool[(seed * 31 + k * 97) % pool.length]; if (!pick.includes(b)) pick.push(b); }
  const img = b => /^https?:/.test(b.img) ? b.img : BASE + b.img, from = b => eur(Math.min(...b.amts.map(a => Math.round(Math.round((b.px ? b.px[String(a)] : a) * 100) * (100 + VATR) / 100))));
  const cell = b => `<td class="st" width="33%" valign="top" style="padding:0 6px"><a href="${BASE}/marke/${esc(b.id)}?utm_source=mail&utm_medium=recs" style="text-decoration:none;color:#0A0C1A">
    <img src="${img(b)}" width="160" alt="${esc(b.name)}" style="display:block;width:100%;max-width:160px;height:auto;border-radius:12px;border:0;margin:0 auto 8px;box-shadow:0 8px 20px rgba(60,40,160,.18)">
    <div style="${T()}font-size:13.5px;font-weight:700;line-height:1.3;color:#0A0C1A;text-align:center">${esc(b.name)}</div>
    <div style="${T()}font-size:12.5px;color:#636A85;text-align:center;margin-top:2px">ab ${from(b)}</div></a></td>`;
  return { html: `<div style="${T()}font-size:18px;font-weight:800;color:#0A0C1A;text-align:center;margin:0 0 4px">Das könnte dir auch gefallen</div><div style="${T()}font-size:13px;color:#636A85;text-align:center;margin:0 0 16px">Sofort per Code, wie deine Bestellung</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${pick.map(cell).join("")}</tr></table>
    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:18px auto 0"><tr><td style="border-radius:999px;border:1px solid #DCD5FF;background:#FFFFFF"><a href="${BASE}/kategorien?utm_source=mail&utm_medium=recs" style="display:inline-block;padding:11px 26px;${T()}font-size:14px;font-weight:700;color:#5B3FE6;text-decoration:none">Alle ${Object.keys(CATALOG).length.toLocaleString("de-DE")} Produkte ansehen</a></td></tr></table><!--t:Empfehlungen: ${pick.map(b => b.name).join(", ")}-->`, unsub: CFG.unsubLink(o.email) };
}

/* ---------- Bausteine ---------- */
const center = (inner, pad = "0 36px") => `<tr><td class="px" align="center" style="padding:${pad}">${inner}</td></tr>`;
const h1 = t => `<h1 class="h1" style="margin:0 0 14px;${T()}font-size:30px;line-height:1.18;font-weight:800;letter-spacing:-.6px;color:${C.white};text-align:center">${t}</h1>`;
const h2 = t => `<h2 style="margin:8px 0 18px;${T()}font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-.4px;color:${C.violet};text-align:center">${t}</h2>`;
const lead = t => `<p style="margin:0 0 24px;${T()}font-size:17px;line-height:1.55;color:${C.white};text-align:center">${t}</p>`;
const p = (t, s = "") => `<p style="margin:0 0 14px;${T()}font-size:15px;line-height:1.6;color:${C.text};${s}">${t}</p>`;
const small = (t, s = "") => `<p style="margin:0 0 12px;${T()}font-size:13px;line-height:1.55;color:${C.muted};${s}">${t}</p>`;
const pill = (t, col = C.ok) => `<div style="text-align:center;margin:0 0 14px"><span style="display:inline-block;padding:6px 13px;border-radius:999px;${T()}font-size:12px;font-weight:800;letter-spacing:.3px;color:${col};background:#FFFFFF;border:1px solid #E7E3FA">${t}</span></div><!--t:\n-->`;
/* Verlaufs-Button (Outlook bekommt eine volle Farbe) */
const btn = (href, t, dark) => `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 26px"><tr><td align="center" bgcolor="${dark ? "#000000" : C.btnA}" style="border-radius:999px;background:${dark ? "#000000" : C.btnA};${dark ? "" : `background-image:linear-gradient(90deg,${C.btnA},${C.btnB});box-shadow:0 10px 30px rgba(23,0,210,.35);`}"><a href="${href}" style="display:inline-block;padding:15px 38px;${T()}font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:999px">${t}</a></td></tr></table>`;
const gap = h => `<tr><td height="${h}" style="height:${h}px;line-height:${h}px;font-size:0">&nbsp;</td></tr>`;
/* Animierte Titelbilder (GIF, aus der iPhone-Animation der Website); Outlook zeigt das erste Bild */
const ANIM = { received: "checkout", delivered: "checkout", invoice: "checkout", gift: "checkout", failed: "checkout", verify: "verify", welcome: "verify", security: "security" };
const heroSrc = name => ANIM[name] ? `${BASE}/mail/${ANIM[name]}.gif?v=4` : `${BASE}/mail/${name}.jpg`;
const hero = name => `<tr><td align="center" style="padding:0"><img src="${heroSrc(name)}" width="540" alt="" style="display:block;width:100%;max-width:540px;height:auto;border:0;margin:0 auto"></td></tr>`;

/* Code-Feld zum Antippen und Kopieren */
/* Codes immer als EIN zusammenhängender Text (ohne Tabellenzellen/Leerzeichen dazwischen), damit Kopieren + Einfügen sauber klappt.
   Ein angehängter PIN („CODE · PIN 1234“) bekommt ein eigenes Feld, damit er nicht mitkopiert wird. */
const oneCode = (v, size) => `<div style="font-family:${MONO};font-size:${size}px;line-height:1.3;font-weight:800;letter-spacing:${size > 24 ? 8 : 2}px;color:#0A0C1A;word-break:break-all">${esc(v)}</div>`;
const codeBox = (c, label = "Dein Code") => {
  const m = String(c).match(/^(.*?)\s*·\s*PIN\s*(.+)$/), main = m ? m[1] : String(c), pin = m ? m[2] : null;
  const box = (lab, v, sz) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px"><tr><td align="center" bgcolor="${C.code}" style="background:${C.code};border:1.5px dashed #5B4BFF;border-radius:16px;padding:14px 12px">
  <div style="${T()}font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:${C.label};margin-bottom:9px">${lab}</div>${oneCode(v, sz)}
  <div style="${T()}font-size:11.5px;color:${C.label};margin-top:8px">Lange tippen zum Kopieren</div></td></tr></table>`;
  return box(label, main, 22) + (pin ? box("PIN", pin, 20) : "");
};
const bigCode = t => `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 22px"><tr><td align="center" bgcolor="${C.code}" style="background:${C.code};border:1.5px solid #CFC6FF;border-radius:16px;padding:16px 26px 12px">${oneCode(t, 32)}<div style="${T()}font-size:11.5px;color:${C.label};margin-top:6px">Lange auf den Code tippen › Kopieren</div></td></tr></table>`;

/* Markenkarte (klein als Vorschau, groß fürs Geschenk) */
const thumb = P => P.img ? `<img src="${P.img}" width="66" height="42" alt="" style="display:block;width:66px;height:42px;border-radius:9px;object-fit:cover;border:0">` : `<!--nt--><table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr><td width="66" height="42" align="center" valign="middle" bgcolor="${P.solid}" style="width:66px;height:42px;border-radius:9px;background:${P.solid};background-image:${P.bg};color:${P.fg};font:800 9px/1.1 ${FONT};padding:0 4px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)">${esc(String(P.mark).slice(0, 18))}</td></tr></table><!--/nt-->`;
const bigCard = (P, amt) => P.img ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:330px;margin:0 auto 22px"><tr><td align="center"><img src="${P.img}" width="330" alt="${esc(P.name)}" style="display:block;width:100%;max-width:330px;height:auto;border-radius:20px;border:0;box-shadow:0 24px 60px rgba(23,0,210,.45)">${amt ? `<div style="margin-top:12px;font:800 15px/1 ${FONT};color:#FFFFFF">${esc(amt)}</div>` : ""}</td></tr></table>` : `<!--nt--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:330px;margin:0 auto 22px"><tr><td height="186" valign="bottom" bgcolor="${P.solid}" style="height:186px;border-radius:20px;background:${P.solid};background-image:${P.bg};color:${P.fg};padding:20px 22px;box-shadow:0 24px 60px rgba(23,0,210,.45),inset 0 0 0 1.5px rgba(255,255,255,.2)">
  <div style="font:800 28px/1.1 ${FONT};letter-spacing:-.6px;margin-bottom:38px">${esc(P.mark)}</div>
  ${amt ? `<span style="display:inline-block;font:800 15px/1 ${FONT};padding:8px 13px;border-radius:999px;background:rgba(11,15,25,.45);color:#FFFFFF;border:1px solid rgba(255,255,255,.3)">${esc(amt)}</span>` : ""}
</td></tr></table><!--/nt--><!--t:${esc(P.name)} · ${esc(amt || "")}-->`;

const darkCard = (inner, s = "") => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px"><tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:18px;padding:16px;text-align:left;${s}">${inner}</td></tr></table>`;
const rows = (r, m = "4px 0 18px") => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:${m}">${r.map(([a, b, strong], k) => `<tr><td style="padding:10px 0;${k < r.length - 1 || m !== "0" ? `border-bottom:1px solid ${C.line};` : ""}${T()}font-size:${strong ? 17 : 14}px;font-weight:${strong ? 800 : 400};color:${strong ? C.white : C.muted};text-align:left">${a}  </td><td align="right" style="padding:10px 0;${k < r.length - 1 || m !== "0" ? `border-bottom:1px solid ${C.line};` : ""}${T()}font-size:${strong ? 17 : 14}px;font-weight:${strong ? 800 : 700};color:${C.white}">${b}</td></tr>`).join("")}</table>`;
const VATR = Number(process.env.VAT_RATE != null && process.env.VAT_RATE !== "" ? process.env.VAT_RATE : 0);
const totals = o => rows([["Zwischensumme", eur(o.subtotal)]].concat(o.discount ? [["Rabatt", "−" + eur(o.discount)]] : [], o.fee ? [["Servicegebühr", eur(o.fee)]] : [],
  [["Gesamt", eur(o.total), true]], VATR && o.vat ? [[`darin ${String(VATR).replace(".", ",")} % MwSt.`, eur(o.vat)]] : []));
const testNote = () => darkCard(`<div style="${T()}font-size:14px;line-height:1.5;color:${C.warn}"><b>Testbestellung:</b> Diese Codes stammen vom Testcode-Generator und sind nicht einlösbar.</div>`, `border-color:#5A3A12`);
const label = t => `<div style="${T()}font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${C.label};margin-bottom:6px">${t}</div>`;

/* Drei Schritte mit Kreisen wie im Template */
const steps = list => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px"><tr>${list.map((s, i) => `<td class="st" width="${Math.floor(100 / list.length)}%" align="center" valign="top" style="padding:0 6px">
  <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td align="center" valign="middle" style="width:44px;height:44px;border:2px solid #CFC6FF;background:#F6F4FF;border-radius:50%;${T()}font-size:18px;font-weight:800;color:#5B3FE6">${i + 1}</td></tr></table>
  <div style="${T()}font-size:13px;line-height:1.45;color:${C.white};margin-top:12px">${s}</div></td>`).join("")}</tr></table>`;

/* Artikel einer Bestellung, optional mit Codes */
const itemList = (o, withCodes) => o.items.map(i => {
  const P = prod(i.brand, i.name);
  const head = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="66" valign="middle">${thumb(P)}</td>
    <td valign="middle" style="padding-left:14px;text-align:left"><div style="${T()}font-size:15px;line-height:1.3;font-weight:700;color:${C.white}">${esc(P.name)}</div>
      <div style="${T()}font-size:13px;line-height:1.4;color:${C.muted};margin-top:2px">${esc(variant(i, P))} · Menge ${i.qty}${i.type === "topup" ? ` · ${esc(i.phone)}` : ""}${i.gift_to ? ` · Geschenk an ${esc(i.gift_to)}` : ""}</div></td>
    <td align="right" valign="middle" style="${T()}font-size:15px;font-weight:800;color:${C.white};white-space:nowrap">${eur(i.unit * i.qty)}</td></tr></table>`;
  let extra = "";
  if (withCodes && i.type === "code" && !i.gift_to && i.codes.length)
    extra = i.codes.map((c, k) => codeBox(c, i.codes.length > 1 ? `Code ${k + 1}` : P.type === "key" ? "Dein Key" : "Dein Code")).join("") +
      small(`Einlösen ${redeemWhere(P)} unter „Code einlösen“. <a href="${BASE}/marke/${esc(P.id)}" style="color:${C.label};font-weight:700">Anleitung</a>`, "margin:6px 0 0");
  else if (withCodes && i.gift_to) extra = small(`Der Code wurde direkt an ${esc(i.gift_to)} geschickt.`, "margin:10px 0 0");
  else if (withCodes && i.type === "topup") extra = small(`Das Guthaben wird auf ${esc(i.phone)} gebucht.`, "margin:10px 0 0");
  return darkCard(head + extra);
}).join("");

/* Bewertung mit Sternen, die direkt zum Formular führen */
const reviewAsk = o => darkCard(`<div style="text-align:center"><div style="${T()}font-size:16px;font-weight:700;color:${C.white};margin-bottom:8px">Wie zufrieden bist du?</div>
  <div>${[1, 2, 3, 4, 5].map(n => `<a href="${orderLink(o)}&bewerten=1&s=${n}" style="font-family:${FONT};font-size:32px;line-height:1;color:${C.star};text-decoration:none;padding:0 4px">★</a>`).join("")}</div>
  <!--t:Jetzt bewerten: ${orderLink(o)}&bewerten=1-->
  <div style="${T()}font-size:12px;line-height:1.5;color:${C.muted};margin-top:8px">Ein Klick genügt. Deine Bewertung erscheint als verifizierter Kauf.</div></div>`, "padding:20px 16px");

/* „Brauchst du Hilfe?“-Karte im Verlauf wie im Template */
const helpCard = () => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0"><tr><td align="center" bgcolor="${C.btnA}" style="border-radius:20px;background:${C.btnA};background-image:linear-gradient(135deg,${C.btnA},${C.btnB});padding:38px 28px 14px">
  <div style="${T()}font-size:28px;line-height:1.2;font-weight:800;letter-spacing:-.4px;color:#FFFFFF;margin-bottom:14px">Brauchst du Hilfe?</div>
  <div style="${T()}font-size:16px;line-height:1.55;color:#FFFFFF;margin:0 0 26px">Antworte einfach auf diese E-Mail, wir melden uns persönlich. Oder schau in unsere Hilfe – dort findest du Antworten auf die häufigsten Fragen.</div>
  ${btn(`${BASE}/hilfe`, "Zur Hilfe", true)}
</td></tr></table>`;

/* ---------- Grundgerüst ---------- */
const wordmark = () => `<a href="${BASE}/" style="text-decoration:none;display:inline-block"><table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr><td valign="middle"><img src="${BASE}/icon-512.png" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border-radius:12px;border:0"></td><td valign="middle" style="padding-left:10px;${T()}font-size:26px;letter-spacing:-1px;color:#0A0C1A"><span style="font-weight:800">instant</span><span style="font-weight:400">codes</span></td></tr></table></a>`;
const layout = m => `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="format-detection" content="telephone=no,date=no,address=no,email=no"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(m.subject)}</title>
<style>body{margin:0;padding:0}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
@media (max-width:599px){.wrap{width:100%!important}.px{padding-left:20px!important;padding-right:20px!important}.h1{font-size:26px!important}}
@media (max-width:420px){.st{display:block!important;width:100%!important;padding:0 0 18px!important}}</style></head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(m.pre)}${"&#8199;&#65279;&#847; ".repeat(30)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.page}" style="background:${C.page}"><tr><td align="center">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="width:600px;max-width:600px;background:#FFFFFF;border-radius:28px;overflow:hidden;border:1px solid #ECE9FA;margin:24px 0">
  <tr><td align="center" bgcolor="#FFFFFF" style="background:#FFFFFF;background-image:linear-gradient(180deg,#EEE9FF 0%,#F7F5FF 35%,#FFFFFF 70%);padding:30px 24px 0">
    <div style="${T()}font-size:14px;font-weight:700;color:${C.label};margin-bottom:6px">${esc(m.label || "instantcodes")}</div>
    ${wordmark()}
  </td></tr>
  ${m.hero ? hero(m.hero) : gap(20)}
  ${gap(10)}
  ${center(m.body)}
  ${m.help === false ? gap(10) : center(helpCard(), "18px 30px 0")}
  ${m.recs ? center(m.recs, "26px 30px 0") : ""}
  ${center(`<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>${[["Shop", "/"], ["Kategorien", "/kategorien"], ["Handy aufladen", "/aufladen"], ["Hilfe", "/hilfe"]].map(([t, u], i) => `<td style="padding:0 8px;${T()}font-size:13px;font-weight:700">${i ? `<span style="color:#C9CCDA;padding-right:16px">·</span>` : ""}<a href="${BASE}${u}?utm_source=mail&amp;utm_medium=nav" style="color:#4B36E8;text-decoration:none">${t}</a></td>`).join("")}</tr></table>`, "24px 20px 0")}
  <tr><td align="center" style="padding:40px 24px 0">${wordmark()}</td></tr>
  <tr><td class="px" align="center" style="padding:14px 30px 6px"><table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>${[["Visa","#1A1F71","#FFFFFF","#D6D9E6"],["Mastercard","#1A1A1A","#FFFFFF","#D6D9E6"],["Amex","#2E77BC","#FFFFFF","#D6D9E6"],["Apple Pay","#000000","#FFFFFF","#000000"],["Link","#00A34A","#FFFFFF","#D6D9E6"],["Klarna.","#0A0B09","#FFB3C7","#F59AB4"]].map(([n, c, bg, bd]) => `<td style="padding:3px"><span style="display:inline-block;min-width:44px;text-align:center;padding:7px 9px;border-radius:7px;background:${bg};border:1px solid ${bd};${T()}font-size:12px;font-weight:900;color:${c}">${n}</span></td>`).join("")}</tr></table><div style="${T()}font-size:11px;color:#636A85;margin-top:4px">Klarna: Rechnung · Raten · Sofort</div><table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr></tr></table><div style="${T()}font-size:11.5px;color:#636A85;margin-top:6px">SSL-verschlüsselt · 3-D Secure · Zahlung über Stripe</div></td></tr>
  <tr><td class="px" align="center" bgcolor="#FFFFFF" style="background:#FFFFFF;background-image:linear-gradient(180deg,#FFFFFF 0%,#F1EDFF 100%);padding:18px 44px 36px">
    <div style="${T()}font-size:12px;line-height:1.6;color:#636A85">${m.why || "Du erhältst diese E-Mail von instantcodes."}${m.unsub ? ` Produktempfehlungen kannst du jederzeit <a href="${m.unsub}" style="color:#636A85">abbestellen</a>.` : ""}</div>
    <div style="${T()}font-size:12px;line-height:1.6;margin:10px 0"><a href="${BASE}/hilfe" style="color:#2A2F45">Hilfe</a> &nbsp;·&nbsp; <a href="https://mein.online-impressum.de/instacode/" style="color:#2A2F45">Impressum</a> &nbsp;·&nbsp; <a href="${BASE}/agb" style="color:#2A2F45">AGB</a> &nbsp;·&nbsp; <a href="${BASE}/datenschutz" style="color:#2A2F45">Datenschutz</a></div>
    <div style="${T()}font-size:12px;line-height:1.6;color:#636A85">© ${new Date().getFullYear()} ${esc(FOOT)} · Zahlung sicher über Stripe</div>
  </td></tr>
</table>
</td></tr></table></body></html>`;

/* Textfassung für Mailprogramme ohne HTML (hilft auch gegen Spamfilter) */
const toText = m => (`${m.label ? m.label + "\n\n" : ""}` + m.body
  .replace(/<!--nt-->[\s\S]*?<!--\/nt-->/g, "").replace(/<!--t:([\s\S]*?)-->/g, (_, t) => t.replace(/\\n/g, "\n") + "\n")
  .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g, (_, h, t) => t && !/★/.test(t) ? `${t}: ${h}` : "")
  .replace(/<br\s*\/?>/g, "\n").replace(/<\/(p|h1|h2|tr|div|table)>/g, "\n").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .split("\n").map(s => s.trim()).filter((s, i, a) => s || a[i - 1]).join("\n").replace(/\n{3,}/g, "\n\n").trim())
  + `\n\nFragen? Antworte auf diese E-Mail oder schreib an ${REPLY}.\n${FOOT}\n${BASE}`;

async function deliver(m) {
  if (/@sms\.instacode\.store$/i.test(String(m.to || ""))) return; // SMS-Konto ohne E-Mail-Adresse
  const html = layout(m), text = toText(m);
  if (!KEY) { console.log(`[E-Mail, nicht gesendet] an ${m.to}: ${m.subject}`); return; }
  const headers = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
  if (m.once) headers["Idempotency-Key"] = m.once; // verhindert doppelte Mails, falls Stripe ein Ereignis zweimal schickt
  const body = JSON.stringify({ from: FROM, to: [m.to], reply_to: m.reply === false ? undefined : REPLY, subject: m.subject, html, text, tags: [{ name: "art", value: m.kind }] });
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
/* Abo-Bausteine */
const WHY_ABO = "Du erhältst diese E-Mail, weil du ein Abo bei instantcodes hast.";
const time = t => new Date(t || Date.now()).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const dtime = t => `${day(t)}, ${time(t)} Uhr`;
const aboTerm = n => n === 1 ? "pro Monat" : `für ${n} Monate`;
const aboItems = list => darkCard(list.map((i, k) => { const P = prod(i.brand, i.name);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${k ? `border-top:1px solid ${C.line};` : ""}"><tr><td width="66" valign="middle" style="padding:8px 0">${thumb(P)}</td>
    <td valign="middle" style="padding:8px 0 8px 14px;text-align:left"><div style="${T()}font-size:14.5px;line-height:1.3;font-weight:700;color:${C.white}">${esc(i.label || P.name)}</div>${i.note ? `<div style="${T()}font-size:12.5px;color:${C.muted};margin-top:2px">${esc(i.note)}</div>` : ""}</td>
    <td align="right" valign="middle" style="${T()}font-size:14px;font-weight:700;color:${C.white};white-space:nowrap">${eur(i.face)}</td></tr></table>`; }).join(""));
/* Laufzeit und Kündigung in einfachen Worten (gleiche Regeln wie in den AGB) */
const aboRules = (v, firstEnd, renewed) => darkCard(`${label("Laufzeit und Kündigung")}<div style="${T()}font-size:14px;line-height:1.6;color:${C.text}">${v.months === 1
  ? "Dein Abo verlängert sich jeden Monat automatisch. Du kannst jederzeit zum Ende des bezahlten Monats kündigen."
  : renewed ? `Dein Abo hat sich um ${v.months} Monate verlängert. Du kannst jetzt jederzeit mit einer Frist von einem Monat kündigen. Monate, die danach nicht mehr geliefert werden, erstatten wir anteilig.`
  : `Die erste Laufzeit geht ${v.months} Monate${firstEnd ? ` bis zum ${day(firstEnd)}` : ""}. Kündigst du bis dahin nicht, verlängert sich das Abo um jeweils ${v.months} Monate – dann kannst du jederzeit mit einer Frist von einem Monat kündigen und bekommst nicht mehr gelieferte Monate anteilig zurück.`}
  Kündigen geht ohne Anmeldung unter <a href="${v.cancelLink}" style="color:${C.label};font-weight:700">Verträge hier kündigen</a>.</div>`);
const M = {
  verify: (to, name, code) => ({ kind: "konto", to, label: "Dein Bestätigungscode", hero: "verify", why: WHY_ACC,
    subject: `${code} ist dein Bestätigungscode`, pre: "Gib den Code im Shop ein. Er ist 15 Minuten gültig.",
    body: h1(`Fast geschafft${name ? ", " + first(name) : ""}!`) + lead("Gib diesen Code im Shop ein, um deine E-Mail-Adresse zu bestätigen.") + bigCode(code) +
      small("Der Code ist 15 Minuten gültig. Wenn du kein Konto erstellt hast, kannst du diese E-Mail einfach ignorieren.", "text-align:center") }),

  orderCode: (to, code) => ({ kind: "bestellung", to, label: "Dein Bestellcode", hero: "verify", why: "Du erhältst diese E-Mail, weil diese Adresse bei einer Bestellung auf instantcodes angegeben wurde.",
    subject: `${code} ist dein Code für deine Bestellung`, pre: "Bestätige deine E-Mail, dann kannst du bezahlen. Der Code ist 15 Minuten gültig.",
    body: h1("Bestätige deine E-Mail") + lead("Gib diesen Code im Warenkorb ein. Danach kannst du bezahlen, und deine Codes kommen sicher an diese Adresse.") + bigCode(code) +
      small("Der Code ist 15 Minuten gültig. Wenn du nichts bestellen wolltest, kannst du diese E-Mail ignorieren.", "text-align:center") }),

  test: to => ({ kind: "konto", to, label: "Testmail", hero: "welcome", why: WHY_ACC,
    subject: "Testmail: Der E-Mail-Versand von instantcodes funktioniert", pre: "Wenn du das liest, kommen Bestellmails bei deinen Kunden an.",
    body: h1("E-Mail-Versand funktioniert") + lead("Diese Testmail kommt aus deinem Admin-Bereich. Bestellbestätigungen, Codes und Konto-E-Mails werden genauso zugestellt.") }),

  welcome: (to, name) => ({ kind: "konto", to, label: "Willkommen bei", hero: "welcome", why: WHY_ACC,
    subject: `Willkommen bei instantcodes${name ? ", " + String(name).split(" ")[0] : ""}`, pre: "Dein Konto ist bereit – und 10 % Rabatt warten auf dich.",
    body: h1(`Schön, dass du da bist${name ? ", " + first(name) : ""}!`) + lead("Gutscheine, Spiele-Keys und Guthaben – bezahlt mit einem Klick, der Code kommt in Sekunden.") +
      btn(`${BASE}/`, "Jetzt stöbern") + h2("So einfach geht’s") + steps(["Produkt und Betrag wählen", "Mit einem Klick sicher bezahlen", "Code sofort per E-Mail erhalten"]) +
      h2("Dein Willkommensgeschenk") + p("10 % Rabatt auf deine erste Bestellung. Einfach an der Kasse eingeben:", "text-align:center") + codeBox("WILLKOMMEN10", "Dein Rabattcode") }),

  loginAlert: (to, name, ua) => ({ kind: "sicherheit", to, label: "Neue Anmeldung", hero: "security", why: WHY_ACC,
    subject: "Neue Anmeldung bei deinem instantcodes-Konto", pre: "Warst du das? Dann musst du nichts tun.",
    body: h1("Neue Anmeldung") + lead(`Hallo ${first(name)}, gerade wurde dein Konto angemeldet.`) +
      darkCard(rows([["Zeitpunkt", new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })], ["Gerät", esc(String(ua || "").slice(0, 60) || "unbekannt")]], "0")) +
      p("Warst du das? Dann musst du nichts tun. Falls nicht, setze sofort dein Passwort zurück.", "text-align:center;margin-top:12px") + btn(`${BASE}/login`, "Passwort zurücksetzen") }),

  reset: (to, name, link) => ({ kind: "sicherheit", to, label: "Passwort zurücksetzen", hero: "security", why: WHY_ACC,
    subject: "Passwort zurücksetzen", pre: "Der Link ist 30 Minuten gültig.",
    body: h1("Neues Passwort festlegen") + lead(`Hallo ${first(name)}, tippe auf den Button, um ein neues Passwort für dein Konto zu wählen.`) + btn(link, "Neues Passwort festlegen") +
      small("Der Link ist 30 Minuten gültig. Wenn du das nicht angefragt hast, ignoriere diese E-Mail – dein Passwort bleibt unverändert.", "text-align:center") }),

  pwChanged: (to, name) => ({ kind: "sicherheit", to, label: "Sicherheitshinweis", hero: "security", why: WHY_ACC,
    subject: "Dein Passwort wurde geändert", pre: "Aus Sicherheitsgründen wurdest du überall abgemeldet.",
    body: pill("✓ Passwort geändert") + h1("Dein Passwort ist neu") + lead(`Hallo ${first(name)}, das Passwort für dein Konto wurde geändert. Aus Sicherheitsgründen wurdest du auf allen Geräten abgemeldet.`) +
      btn(`${BASE}/login`, "Anmelden") + small("Warst du das nicht? Dann antworte sofort auf diese E-Mail.", "text-align:center") }),

  deleted: (to, name) => ({ kind: "konto", to, label: "Konto gelöscht", hero: "refund", why: WHY_ACC,
    subject: "Dein instantcodes-Konto wurde gelöscht", pre: "Schade, dass du gehst.",
    body: h1("Dein Konto ist gelöscht") + lead(`Hallo ${first(name)}, dein Konto wurde gelöscht. Rechnungsdaten bewahren wir nur so lange auf, wie es gesetzlich vorgeschrieben ist.`) +
      btn(`${BASE}/`, "Ohne Konto weiter einkaufen") }),

  orderReceived: o => ({ ...(() => { const R = recsFor(o); return R ? { recs: R.html, unsub: R.unsub } : {}; })(), kind: "bestellung", to: o.email, label: `Bestellung ${o.id}`, hero: "received", once: `received-${o.id}`, why: WHY_ORDER,
    subject: `Zahlung erhalten – Bestellung ${o.id}`, pre: "Wir bereiten deine Codes vor und melden uns gleich wieder.",
    body: pill("Zahlung erhalten", C.label) + h1("Danke! Deine Zahlung ist da.") + lead("Wir bereiten deine Bestellung gerade vor. Sobald die Codes bereit sind, bekommst du eine zweite E-Mail.") +
      btn(orderLink(o), "Bestellstatus ansehen") + h2("Deine Bestellung") + itemList(o, false) + totals(o) }),

  delivered: o => { const onlyTop = o.items.every(i => i.type === "topup"), R = recsFor(o); return { recs: R && R.html, unsub: R && R.unsub, kind: "lieferung", to: o.email, label: `Bestellung ${o.id}`, hero: "delivered", once: `delivered-${o.id}`, why: WHY_ORDER,
    subject: onlyTop ? `Dein Guthaben ist gebucht – Bestellung ${o.id}` : `Deine Codes sind da – Bestellung ${o.id}`, pre: o.items.map(i => i.name).slice(0, 3).join(", ") + (onlyTop ? " · aufgeladen" : " · jetzt einlösen"),
    body: (o.items.some(i => isTest(i.codes)) ? testNote() : "") + pill("Geliefert") + h1(onlyTop ? "Dein Guthaben ist gebucht" : "Deine Codes sind da") +
      lead(onlyTop ? "Das Guthaben wurde auf die angegebene Nummer gebucht. Es ist in der Regel sofort verfügbar." : "Hier sind deine Codes. Sie liegen auch jederzeit in deiner Bestellübersicht.") + itemList(o, true) + totals(o) +
      btn(orderLink(o), "Bestellung ansehen") + (onlyTop ? "" : h2("So löst du ein") + steps(["Code antippen und kopieren", "Im Store „Code einlösen“ wählen", "Einfügen – fertig"])) + reviewAsk(o) +
      small(`Bestellnummer ${esc(o.id)} · Digitale Inhalte: Mit der sofortigen Lieferung ist dein Widerrufsrecht erloschen, da du dem beim Kauf ausdrücklich zugestimmt hast.`, "text-align:center;margin-top:18px") }; },

  gift: (o, i) => { const P = prod(i.brand, i.name);
    return { kind: "geschenk", to: i.gift_to, label: "Ein Geschenk für dich", hero: "gift", once: `gift-${o.id}-${i.id}`, why: `Diese E-Mail hat dir ${esc(i.gift_from || "jemand")} über instantcodes geschenkt.`,
      subject: `${i.gift_from || "Jemand"} hat dir einen ${P.name}-Gutschein geschenkt`, pre: i.gift_msg || "Ein Geschenk für dich",
      body: (isTest(i.codes) ? testNote() : "") + h1(`${esc(i.gift_from || "Jemand")} hat an dich gedacht`) +
        (i.gift_msg ? `<p style="margin:0 0 24px;${T()}font-size:19px;line-height:1.45;font-style:italic;font-weight:600;color:${C.white};text-align:center">„${esc(i.gift_msg)}“</p>` : "") +
        bigCard(P, variant(i, P)) + i.codes.map(c => codeBox(c, P.type === "key" ? "Dein Key" : "Dein Gutscheincode")).join("") +
        small(`Einlösen ${redeemWhere(P)} unter „Code einlösen“.`, "text-align:center") + btn(`${BASE}/marke/${esc(P.id)}`, "So löst du ein") }; },

  invoice: o => ({ kind: "rechnung", to: o.email, label: "Rechnung", hero: "invoice", once: `invoice-${o.id}`, why: WHY_ORDER,
    subject: `Deine Rechnung zu Bestellung ${o.id}`, pre: `Rechnung RE-${o.id} über ${eur(o.total)}`,
    body: h1("Deine Rechnung") + lead(`Danke für deinen Einkauf! Hier ist die Rechnung zu deiner Bestellung ${esc(o.id)}.`) +
      darkCard(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td valign="top" style="${T()}font-size:13px;line-height:1.6;color:${C.text};text-align:left">${label("Von")}${SELLER.map(esc).join("<br>")}</td>
        <td valign="top" align="right" style="${T()}font-size:13px;line-height:1.6;color:${C.text}">${label("An")}${esc(o.email)}</td></tr></table>`) +
      darkCard(rows([["Rechnungsnummer", `RE-${esc(o.id)}`], ["Rechnungsdatum", day(o.paid_at)], ["Lieferdatum", day(o.delivered_at || o.paid_at)], ["Zahlung", "bezahlt über Stripe"]], "0")) +
      h2("Positionen") + itemList(o, false) + totals(o) + small(esc(TAXNOTE), "text-align:center") + btn(orderLink(o), "Bestellung ansehen") }),

  refunded: (o, reason) => ({ kind: "bestellung", to: o.email, label: `Bestellung ${o.id}`, hero: "refund", once: `refund-${o.id}`, why: WHY_ORDER,
    subject: `Erstattung für Bestellung ${o.id}`, pre: `${eur(o.total)} sind auf dem Weg zurück zu dir.`,
    body: pill("Erstattet", C.label) + h1("Dein Geld ist unterwegs") + lead(`Wir konnten deine Bestellung leider nicht ausliefern und haben ${eur(o.total)} erstattet.`) +
      (reason ? darkCard(`${label("Grund")}<div style="${T()}font-size:15px;line-height:1.5;color:${C.white}">${esc(reason)}</div>`) : "") +
      p("Je nach Zahlungsart ist das Geld in wenigen Werktagen wieder auf deinem Konto.", "text-align:center;margin-top:8px") + h2("Erstattete Artikel") + itemList(o, false) }),

  paymentFailed: o => ({ kind: "bestellung", to: o.email, label: `Bestellung ${o.id}`, hero: "failed", once: `failed-${o.id}`, why: WHY_ORDER,
    subject: `Zahlung nicht abgeschlossen – Bestellung ${o.id}`, pre: "Es wurde nichts abgebucht. Du kannst es direkt nochmal versuchen.",
    body: pill("Nicht bezahlt", C.bad) + h1("Die Zahlung hat nicht geklappt") + lead("Deine Zahlung konnte leider nicht abgeschlossen werden, die Bestellung wurde storniert. Es wurde nichts abgebucht.") +
      btn(`${BASE}/warenkorb`, "Erneut versuchen") + itemList(o, false) }),

  adminNew: (to, o) => ({ kind: "admin", to, label: "Admin · Prüfung nötig", hero: "received", reply: false, help: false, once: `admin-${o.id}-${to}`, why: "Interne Benachrichtigung für das instantcodes-Team.",
    subject: `Prüfung nötig: ${o.id} (${eur(o.total)})`, pre: o.hold_reason || "Bitte manuell bearbeiten.",
    body: pill("Prüfung nötig", C.warn) + h1("Bestellung wartet auf dich") + lead(`${esc(o.email)} hat bezahlt. Die Bestellung wurde nicht automatisch ausgeliefert.`) +
      (o.hold_reason ? darkCard(`<div style="${T()}font-size:15px;line-height:1.5;color:${C.warn}"><b>Grund:</b> ${esc(o.hold_reason)}</div>`, "border-color:#5A3A12") : "") +
      itemList(o, false) + totals(o) + btn(`${BASE}/admin`, "Im Admin-Bereich öffnen") }),

  /* ---------- Abo ---------- */
  aboStarted: (v, per, plan) => ({ kind: "abo", to: v.email, label: `Abo ${v.planName}`, hero: "received", once: `abo-start-${v.id}`, why: WHY_ABO,
    subject: `Dein Abo ${v.planName} ist aktiv – ${v.id}`, pre: "Danke! Wir bereiten dein erstes Code-Paket vor.",
    body: pill("Abo aktiv", C.label) + h1(`Willkommen im Abo ${esc(v.planName)}`) +
      lead(`Danke${v.name ? ", " + first(v.name) : ""}! Deine Zahlung ist da. Ab jetzt bekommst du jeden Monat ein Paket mit Codes – das erste bereiten wir gerade vor.`) +
      darkCard(rows([["Vertragsnummer", esc(v.id)], ["Plan", `${esc(v.planName)} · ${eur(v.price)} ${aboTerm(v.months)}`], ["Bezahlt für", `${day(per.start)} – ${day(per.end)}`],
        ["Nächste Abbuchung", `${day(per.end)} · ${eur(v.price)}`], ["Kündbar zum", day(per.end)]], "0")) +
      (plan && plan.items && plan.items.length ? h2("Das steckt in deinem Abo") + aboItems(plan.items.map(i => ({ brand: i.brand, name: i.name, label: i.label, face: i.face, note: i.every > 1 ? `alle ${i.every} Monate` : "jeden Monat" }))) : "") +
      p("Jede Lieferung prüfen wir kurz von Hand, damit niemand dein Abo missbrauchen kann. Das dauert meist nur wenige Stunden. Danach kommen die Codes per E-Mail und liegen in deinem Abo.", "text-align:center;margin-top:8px") +
      btn(v.link, "Abo ansehen") + aboRules(v, per.end) +
      small(`Du hast zugestimmt, dass wir vor Ablauf der Widerrufsfrist mit der Lieferung beginnen. Dein Widerrufsrecht erlischt mit der ersten Lieferung der Codes. Es gelten unsere <a href="${BASE}/agb" style="color:${C.label}">AGB</a>.`, "text-align:center;margin-top:14px") }),

  aboRenewed: (v, per) => ({ kind: "abo", to: v.email, label: `Abo ${v.planName}`, hero: "invoice", once: `abo-renew-${v.id}-${per.no}`, why: WHY_ABO,
    subject: `Zahlung erhalten – dein Abo ${v.planName} läuft weiter`, pre: `${eur(per.amount)} für ${day(per.start)} – ${day(per.end)}`,
    body: pill("Zahlung erhalten", C.label) + h1("Dein Abo läuft weiter") +
      lead(`Wir haben ${eur(per.amount)} für ${v.months === 1 ? "den nächsten Monat" : `die nächsten ${v.months} Monate`} abgebucht. Deine Code-Pakete kommen weiter jeden Monat.`) +
      darkCard(rows([["Vertragsnummer", esc(v.id)], ["Zeitraum", `${day(per.start)} – ${day(per.end)}`], ["Betrag", eur(per.amount)], ["Nächste Abbuchung", v.cancel_at && v.cancel_at <= per.end + 6e4 ? "keine, Abo ist gekündigt" : day(per.end)]], "0")) +
      btn(v.link, "Abo ansehen") + aboRules(v, null, true) +
      (per.invoice ? small(`Den Beleg von Stripe findest du <a href="${esc(per.invoice)}" style="color:${C.label}">hier</a>.`, "text-align:center") : "") }),

  aboDelivery: (v, d) => { const all = d.items.flatMap(i => i.codes || []);
    return { kind: "abo", to: v.email, label: `Abo ${v.planName} · Monat ${d.month}`, hero: "delivered", once: `abo-del-${v.id}-${d.month}`, why: WHY_ABO,
      subject: `Deine Codes für Monat ${d.month} sind da – Abo ${v.id}`, pre: d.items.map(i => i.name).slice(0, 4).join(", ") + " · jetzt einlösen",
      body: (isTest(all) ? testNote() : "") + pill("Geliefert") + h1(`Dein Paket für Monat ${d.month}`) +
        lead("Hier sind deine Codes. Sie liegen auch jederzeit in deinem Abo.") +
        d.items.map(i => { const P = prod(i.brand, i.name);
          return darkCard(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="66" valign="middle">${thumb(P)}</td>
            <td valign="middle" style="padding-left:14px;text-align:left"><div style="${T()}font-size:15px;line-height:1.3;font-weight:700;color:${C.white}">${esc(i.label || P.name)}</div>
            <div style="${T()}font-size:13px;line-height:1.4;color:${C.muted};margin-top:2px">Wert ${eur(i.face)}</div></td></tr></table>` +
            (i.codes || []).map(c => codeBox(c, P.type === "key" ? "Dein Key" : "Dein Code")).join("") +
            small(`Einlösen ${redeemWhere(P)} unter „Code einlösen“ oder im Konto unter „Guthaben“. <a href="${BASE}/marke/${esc(P.id)}" style="color:${C.label};font-weight:700">Anleitung</a>`, "margin:6px 0 0")); }).join("") +
        btn(v.link, "Abo ansehen") + h2("So löst du ein") + steps(["Code antippen und kopieren", "Beim Dienst „Code einlösen“ wählen", "Einfügen – fertig"]) +
        small(`Vertragsnummer ${esc(v.id)} · Kündigen kannst du jederzeit online: <a href="${v.cancelLink}" style="color:${C.label}">Verträge hier kündigen</a>`, "text-align:center;margin-top:18px") }; },

  aboCanceled: (c, base) => { const B = base || BASE, res = c.results || [];
    return { kind: "abo", to: c.email, label: "Kündigungsbestätigung", hero: "security", once: `abo-cancel-${c.id}-${res.length}`, why: "Du erhältst diese E-Mail, weil über instantcodes eine Kündigung mit dieser Adresse eingegangen ist.",
      subject: `Kündigung erhalten – ${c.id}`, pre: res.length ? `Dein Vertrag endet am ${day(res[0].end)}.` : "Wir haben deine Kündigung erhalten und ordnen sie zu.",
      body: pill("Kündigung erhalten", C.label) + h1("Deine Kündigung ist eingegangen") +
        lead(`Hallo ${first(c.name)}, hiermit bestätigen wir den Eingang deiner Kündigung. Bitte bewahre diese E-Mail als Nachweis auf.`) +
        darkCard(rows([["Eingegangen am", dtime(c.received_at)], ["Eingangsnummer", esc(c.id)], ["Name", esc(c.name)], ["E-Mail", esc(c.email)], ["Vertragsnummer", esc(c.ref || "nicht angegeben")],
          ["Art", c.kind === "ausserordentlich" ? "Außerordentliche Kündigung" : "Ordentliche Kündigung"]].concat(c.reason ? [["Grund", esc(c.reason)]] : [],
          [["Gewünschter Zeitpunkt", c.wish === "date" && c.wish_date ? `zum ${day(c.wish_date)}` : "zum nächstmöglichen Zeitpunkt"]]), "0")) +
        (res.length ? h2(res.length > 1 ? "Deine Verträge" : "Dein Vertrag") + res.map(r => darkCard(`${label(`Abo ${esc(r.planName)} · ${esc(r.sub)}`)}
          <div style="${T()}font-size:17px;font-weight:800;color:${C.white};margin:2px 0 6px">Endet am ${day(r.end)}${r.end - Date.now() < 36e5 && r.end <= (c.received_at || 0) + 36e5 ? ` um ${time(r.end)} Uhr` : ""}</div>
          <div style="${T()}font-size:14px;line-height:1.55;color:${C.text}">${r.already ? "Dieser Vertrag war bereits zu diesem Termin gekündigt." : r.adjusted ? `Der gewünschte Termin liegt vor dem frühestmöglichen Ende. Wir haben die Kündigung deshalb zum ${day(r.end)} vorgemerkt.` : "Bis dahin bekommst du deine Code-Pakete wie gewohnt, danach buchen wir nichts mehr ab."}${r.refund > 0 ? ` Für Monate, die nicht mehr geliefert werden, erstatten wir dir anteilig <b>${eur(r.refund)}</b> über deine ursprüngliche Zahlungsart.` : ""}</div>`)).join("")
          : darkCard(`<div style="${T()}font-size:15px;line-height:1.55;color:${C.text}">Zu diesen Angaben haben wir noch keinen laufenden Vertrag gefunden. Wir prüfen deine Kündigung von Hand und melden uns bei dir. Du musst nichts weiter tun.</div>`)) +
        small(`Fragen? Antworte einfach auf diese E-Mail. Deine Kündigung kannst du jederzeit unter <a href="${B}/kuendigen" style="color:${C.label}">${esc(B.replace(/^https?:\/\//, ""))}/kuendigen</a> abgeben.`, "text-align:center;margin-top:14px") }; },

  aboPaymentFailed: (v, f) => ({ kind: "abo", to: v.email, label: `Abo ${v.planName}`, hero: "failed", once: `abo-failed-${f.id}`, why: WHY_ABO,
    subject: `Zahlung fehlgeschlagen – Abo ${v.id}`, pre: "Bitte prüfe deine Zahlungsart, damit dein Abo weiterläuft.",
    body: pill("Zahlung offen", C.bad) + h1("Die Abbuchung hat nicht geklappt") +
      lead(`Wir konnten ${eur(f.amount)} für dein Abo ${esc(v.planName)} nicht abbuchen. Bitte prüfe deine Karte oder wähle eine andere Zahlungsart.`) +
      btn(f.url || v.link, f.url ? "Jetzt bezahlen" : "Abo ansehen") +
      p(`Stripe versucht die Abbuchung in den nächsten Tagen automatisch erneut${f.next ? ` (nächster Versuch am ${day(f.next)})` : ""}. Solange die Zahlung offen ist, pausieren neue Lieferungen. Klappt die Zahlung nicht, endet das Abo automatisch.`, "text-align:center") +
      small(`Du möchtest das Abo nicht fortsetzen? <a href="${v.cancelLink}" style="color:${C.label}">Hier kündigen</a>`, "text-align:center") }),

  aboRefund: (v, amount, reason) => ({ kind: "abo", to: v.email, label: `Abo ${v.planName}`, hero: "refund", why: WHY_ABO,
    subject: `Erstattung für dein Abo ${v.id}`, pre: `${eur(amount)} sind auf dem Weg zurück zu dir.`,
    body: pill("Erstattet", C.label) + h1("Dein Geld ist unterwegs") + lead(`Wir haben dir ${eur(amount)} für dein Abo ${esc(v.planName)} erstattet.`) +
      (reason ? darkCard(`${label("Grund")}<div style="${T()}font-size:15px;line-height:1.5;color:${C.white}">${esc(reason)}</div>`) : "") +
      p("Je nach Zahlungsart ist das Geld in wenigen Werktagen wieder auf deinem Konto.", "text-align:center;margin-top:8px") + btn(v.link, "Abo ansehen") }),

  aboAdmin: (to, v, d) => ({ kind: "admin", to, label: "Admin · Abo-Freigabe", hero: "received", reply: false, help: false, once: `abo-admin-${v.id}-${d.month}-${to}`, why: "Interne Benachrichtigung für das instantcodes-Team.",
    subject: `Abo-Lieferung freigeben: ${v.id} Monat ${d.month} (${eur(d.value)})`, pre: `${v.email} · ${v.planName}`,
    body: pill("Freigabe nötig", C.warn) + h1("Abo-Lieferung wartet") + lead(`${esc(v.email)} · Abo ${esc(v.id)} (${esc(v.planName)}) · Monat ${d.month}`) +
      aboItems(d.items) + darkCard(rows([["Code-Wert", eur(d.value)], ["Abo-Preis", `${eur(v.price)} ${aboTerm(v.months)}`]], "0")) + btn(`${BASE}/admin`, "Im Admin freigeben") }),

  aboAdminCancel: (to, c) => ({ kind: "admin", to, label: "Admin · Kündigung", hero: "security", reply: false, help: false, once: `abo-admcancel-${c.id}-${to}`, why: "Interne Benachrichtigung für das instantcodes-Team.",
    subject: `${c.results && c.results.length ? "Kündigung" : "Kündigung ohne Zuordnung"}: ${c.id} (${c.email})`, pre: c.kind === "ausserordentlich" ? "Außerordentlich – Grund prüfen" : "Ordentliche Kündigung",
    body: pill(c.results && c.results.length ? "Kündigung" : "Bitte zuordnen", c.results && c.results.length ? C.label : C.warn) + h1("Neue Kündigung") +
      darkCard(rows([["Eingang", dtime(c.received_at)], ["Name", esc(c.name)], ["E-Mail", esc(c.email)], ["Vertragsnummer", esc(c.ref || "–")], ["Art", c.kind === "ausserordentlich" ? "außerordentlich" : "ordentlich"]]
        .concat(c.reason ? [["Grund", esc(c.reason)]] : [], (c.results || []).map(r => [esc(r.sub), `endet ${day(r.end)}${r.refund ? ` · Erstattung ${eur(r.refund)}` : ""}`])), "0")) +
      btn(`${BASE}/admin`, "Im Admin ansehen") })
};

module.exports = Object.fromEntries(Object.keys(M).map(k => [k, (...a) => deliver(M[k](...a))]));
/* Vorschau ohne Versand (für Tests und Screenshots) */
module.exports._render = (k, ...a) => { const m = M[k](...a); return { to: m.to, subject: m.subject, pre: m.pre, html: layout(m), text: toText(m) }; };
module.exports.configure = c => { CFG = Object.assign(CFG, c); };
