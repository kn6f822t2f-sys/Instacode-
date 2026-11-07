/* Ermittelt die offiziellen Shop-Bilder (Steam, Nintendo, PlayStation, Minecraft) für die Spiele-Keys und trägt sie in covers.json ein:
   { id: { p: Hochformat-URL, l: Querformat-URL, h: Hintergrundbild (Steam-Bibliotheks-Hero), g: transparentes Spiel-Logo } }.
   h und g gibt es nur für Spiele mit Steam-App; alle Plattform-Varianten eines Spiels (gleiche grp) bekommen dieselben URLs.
   Die Bilder selbst liegen nicht im Repo – der Server lädt sie beim ersten Aufruf und speichert sie zwischen (nur die Hosts aus COVER_HOSTS).
   Jede h/g-URL wird vorher geprüft (HTTP 200, image/*, 2 KB – 6 MB), weil nicht jede App ein Logo hat.
   Einträge anderer IDs bleiben erhalten; geschrieben wird unter derselben Sperre wie beim Katalog-Merge (covers.json.lock).
   Aufruf: node tools/covers.js [--dry]   (--dry: nur Unterschiede zur aktuellen covers.json anzeigen) */
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), CAT = JSON.parse(fs.readFileSync(path.join(ROOT, "catalog.json"), "utf8")), DRY = process.argv.includes("--dry");
const get = u => { try { return execFileSync("curl", ["-sL", "-m", "30", "-A", "Mozilla/5.0", "-H", "Accept-Language: de-DE", u], { maxBuffer: 1e8 }).toString(); } catch (e) { return ""; } };
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
/* Steam-App je Spiel (grp oder id → App-ID), geprüft über die Steam-Suche und appdetails */
const STEAM = { fc26: 3405690, bo7: 3606480, bf6: 2807960, gta5: 271590, "rdr2-rockstar": 1174180, eldenring: 1245620, "cp2077-steam": 1091500,
  "bg3-steam": 1086940, hogwarts: 990080, "fh5-xpc": 1551360, "diablo4-bnet": 2344520, mhwilds: 2246340, acshadows: 3159330, "kcd2-steam": 1771300,
  splitfiction: 2001120, "silksong-steam": 1030300, "stardew-steam": 413150, helldivers2: 553850, "witcher3-steam": 292030, "palworld-steam": 1623730,
  "fs25-steam": 2300320, "ets2-steam": 227300, "civ7-steam": 1295660, "seaofthieves-xpc": 1172620, "cs2-steam": 730, "re4-steam": 2050650, sf6: 1364780,
  tekken8: 1778820, doomtda: 3017860, "indiana-xpc": 2677660, "ds2-ps5": 3280350, mgsdelta: 2417610, "wukong-steam": 2358720, "satisfactory-steam": 526870,
  "valheim-steam": 892970, "terraria-steam": 105600, "rust-steam": 252490, "dbd-steam": 381210, "ittakestwo-ea": 1426210,
  /* Sortimentserweiterung November 2026 (grp → App-ID) */
  fc27: 4080220, mw4: 4435490, bo6: 4384550, rerequiem: 3764200, expedition33: 1903340, arcraiders: 1808500, borderlands4: 1285190, nightreign: 2622380,
  mafiatoc: 1941540, dlbeast: 3008130, silenthillf: 2947440, spacemarine2: 2183900, nba2k27: 4356430, f125: 3059520, crimsondesert: 3321460,
  phantomblade: 4115450, mk1: 1971870, dbsz: 1790600, jedisurvivor: 1774580, acmirage: 3035570, swoutlaws: 2842040, motorfest: 2698940, dd2: 2054970,
  liesofp: 1627720, spiderman2: 2651280, gowr: 2322010, tlou2: 2531310, tsushima: 2215430, stellarblade: 3489700, ff7rebirth: 2909400,
  outerworlds2: 1449110, oblivionr: 2623190, rematch: 2138720, nfsunbound: 1846380, thps34: 2545710, fh6: 2483190, pragmata: 3357650, bond: 3768760,
  nioh3: 3681010, marathon: 3065800, gothic1r: 1297900, acbfresynced: 3751950, legobatman: 2215200, subnautica2: 1962700, mhstories3: 2852190,
  sts2: 2868840, mewgenics: 686060, planetzoo2: 3219030, transportfever3: 3493540, enshrouded: 1203620, fm26: 3551340, eu5: 3450310, anno117: 3274580,
  jwe3: 2958130, tarkov: 3932890, ck3: 1158310, hoi4: 394360, stellaris: 281990, twwh3: 1142710, aoe4: 1466860, aoe2de: 813780, civ6: 289070,
  anno1800: 916440, manorlords: 1363080, frostpunk2: 1601580, citiesskylines2: 949230, planetcoaster2: 2688950, planetzoo: 703080,
  twopointmuseum: 2185060, msfs2024: 2537590, ats: 270880, beamng: 284160, acc: 805550, wrc: 1849250, houseflipper2: 1190970, supermarketsim: 2670630,
  tcgshop: 3070070, powerwash: 1290000, schedule1: 3164500, sotf: 1326470, "7d2d": 251570, arksa: 2399830, dayz: 221100, raft: 648800,
  subnautica: 264710, greenhell: 815370, vrising: 1604030, lethalcompany: 1966720, phasmophobia: 739630, drg: 548430, repo: 3241660, peak: 3527290,
  dst: 322330, zomboid: 108600, thelongdark: 305620, nms: 275850, factorio: 427520, rimworld: 294100, readyornot: 1144200, hunt: 594650,
  outlasttrials: 1304930, armareforger: 1874880, grounded2: 2661300, dune: 1172710, sh2: 2124490, re2: 883710, revillage: 1196590, dmc5: 601150,
  mhworld: 582010, mhrise: 1446780, sekiro: 814380, ds3: 374320, ac6: 1888160, p3r: 2161700, p5r: 1687950, metaphor: 2679460, ladiw: 2072450,
  ff16: 2515020, gow2018: 1593500, tlou1: 1888930, daysgone: 1259420, detroit: 1222140, hfw: 2420110, kcd1: 379430, skyrim: 489830, fallout4: 377160,
  fallout76: 1151340, starfield: 1716740, doometernal: 782330, bl3: 397540, masseffectle: 1328670, deadspace: 1693980, acvalhalla: 2208920,
  farcry6: 2369390, legosw: 920210, arkhamknight: 208650, hitman: 1659040, stalker2: 1643320, avowed: 2457220, khazan: 2680010, atomfall: 801800,
  hades: 1145360, hades2: 1145350, hollowknight: 367520, celeste: 504230, deadcells: 588650, cuphead: 268910, balatro: 2379780,
  vampiresurvivors: 1794680, sts: 646570, ror2: 632360, brotato: 1942280, undertale: 391540, discoelysium: 632470, outerwilds: 753640,
  davethediver: 1868140, cultofthelamb: 1313140, littlenightmares3: 1392860, dredge: 1562430, seaofstars: 1244090, blueprince: 1569580,
  megabonk: 3405340, isaac: 250900, amongus: 945360, dispatch: 2592160, overcooked2: 728880, stray: 1332010 };
/* Bisherige Steam-Spiele wurden mit englischem Store-Kontext ermittelt; neue mit deutschem (lokalisierte Kapseln, z. B. LEGO Batman) */
const STEAM_EN = new Set([3405690, 3606480, 2807960, 271590, 1174180, 1245620, 1091500, 1086940, 990080, 1551360, 2344520, 2246340, 3159330, 1771300, 2001120,
  1030300, 413150, 553850, 292030, 1623730, 2300320, 227300, 1295660, 1172620, 730, 2050650, 1364780, 1778820, 3017860, 2677660, 3280350, 2417610, 2358720,
  526870, 892970, 105600, 252490, 381210, 1426210]);
/* Andere Shops: offizielles Bild der Produktseite (Nintendo: og:image, zugeschnitten; PlayStation: og:image oder Konzept-Bilder) */
const PAGES = { "mkworld-switch2": "https://www.nintendo.com/us/store/products/mario-kart-world-switch-2/",
  "zeldatotk-switch": "https://www.nintendo.com/us/store/products/the-legend-of-zelda-tears-of-the-kingdom-switch/",
  "pokemonza-switch": "https://www.nintendo.com/us/store/products/pokemon-legends-z-a-switch/",
  "acnh-switch": "https://www.nintendo.com/us/store/products/animal-crossing-new-horizons-switch/",
  "smbwonder-switch": "https://www.nintendo.com/us/store/products/super-mario-bros-wonder-switch/",
  "mpjamboree-switch": "https://www.nintendo.com/us/store/products/super-mario-party-jamboree-switch/",
  "dkbananza-switch2": "https://www.nintendo.com/us/store/products/donkey-kong-bananza-switch-2/",
  "ghostyotei-ps5": "https://www.playstation.com/en-us/games/ghost-of-yotei/",
  "minecraft-pc": "https://www.minecraft.net/en-us/store/minecraft-deluxe-collection-pc",
  "gt7-ps5": "https://www.playstation.com/de-de/games/gran-turismo-7/",
  "astrobot-ps5": "https://www.playstation.com/de-de/games/astro-bot/",
  "mk8d-switch": "https://www.nintendo.com/us/store/products/mario-kart-8-deluxe-switch/",
  "smashu-switch": "https://www.nintendo.com/us/store/products/super-smash-bros-ultimate-switch/",
  "zeldabotw-switch": "https://www.nintendo.com/us/store/products/the-legend-of-zelda-breath-of-the-wild-switch/",
  "smo-switch": "https://www.nintendo.com/us/store/products/super-mario-odyssey-switch/",
  "pokemonkarmesin-switch": "https://www.nintendo.com/us/store/products/pokemon-scarlet-switch/",
  "pokemonpurpur-switch": "https://www.nintendo.com/us/store/products/pokemon-violet-switch/",
  "splatoon3-switch": "https://www.nintendo.com/us/store/products/splatoon-3-switch/",
  "luigismansion3-switch": "https://www.nintendo.com/us/store/products/luigis-mansion-3-switch/",
  "kirbyfl-switch": "https://www.nintendo.com/us/store/products/kirby-and-the-forgotten-land-switch/",
  "switchsports-switch": "https://www.nintendo.com/us/store/products/nintendo-switch-sports-switch/",
  "zeldaeow-switch": "https://www.nintendo.com/us/store/products/the-legend-of-zelda-echoes-of-wisdom-switch/",
  "pikmin4-switch": "https://www.nintendo.com/us/store/products/pikmin-4-switch/",
  "metroidprime4-switch": "https://www.nintendo.com/us/store/products/metroid-prime-4-beyond-switch/",
  "sm3dw-switch": "https://www.nintendo.com/us/store/products/super-mario-3d-world-plus-bowsers-fury-switch/",
  "kirbyairriders-switch2": "https://www.nintendo.com/us/store/products/kirby-air-riders-switch-2/",
  "hyrulewarriorsaoi-switch2": "https://www.nintendo.com/us/store/products/hyrule-warriors-age-of-imprisonment-switch-2/",
  "pokopia-switch2": "https://www.nintendo.com/us/store/products/pokemon-pokopia-switch-2/",
  "mariotennisfever-switch2": "https://www.nintendo.com/us/store/products/mario-tennis-fever-switch-2/" };
/* Nintendo-Hochformat: Motiverkennung (g_auto) statt Bildmitte, damit das Logo nicht abgeschnitten wird */
const NIN_AUTO = new Set(["mk8d-switch", "smashu-switch", "zeldabotw-switch", "smo-switch", "pokemonkarmesin-switch", "pokemonpurpur-switch", "splatoon3-switch",
  "kirbyfl-switch", "zeldaeow-switch", "pikmin4-switch", "metroidprime4-switch", "sm3dw-switch", "kirbyairriders-switch2", "hyrulewarriorsaoi-switch2",
  "pokopia-switch2", "mariotennisfever-switch2"]);
/* PlayStation: Hochformat- und Querformat-Bild aus den Konzept-Daten der playstation.com-Seite statt og:image */
const PS_MEDIA = new Set(["gt7-ps5", "astrobot-ps5"]);
const HOST = "https://shared.akamai.steamstatic.com/store_item_assets/";
function head(u) {
  try {
    const t = execFileSync("curl", ["-sIL", "-m", "30", "-A", "Mozilla/5.0", u], { maxBuffer: 1e7 }).toString();
    const blocks = t.split(/\r?\n\r?\n/).filter(b => /^HTTP\//m.test(b)), last = blocks[blocks.length - 1] || "";
    const code = +((last.match(/^HTTP\/[\d.]+ (\d+)/m) || [])[1] || 0), type = ((last.match(/^content-type:\s*([^\r\n;]+)/mi) || [])[1] || "").trim(),
      len = +((last.match(/^content-length:\s*(\d+)/mi) || [])[1] || 0), moved = /^location:/mi.test(t);
    return code === 200 && /^image\//.test(type) && !moved && (!len || (len >= 2000 && len <= 6e6));
  } catch (e) { return false; }
}
/* Steam: Store-Assets (p, l, h) über IStoreBrowseService/GetItems; Logo (g) aus den Bibliotheks-Assets der App-Info (library_assets_full) */
const steamAssets = (ids, language) => {
  const out = {};
  for (let i = 0; i < ids.length; i += 25) {
    const q = encodeURIComponent(JSON.stringify({ ids: ids.slice(i, i + 25).map(appid => ({ appid })), context: { language, country_code: "DE" }, data_request: { include_assets: true } }));
    let items = []; try { items = JSON.parse(get("https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=" + q)).response.store_items || []; } catch (e) {}
    for (const it of items) {
      const a = it.assets || {}; if (!a.asset_url_format) continue;
      const app = it.appid, t = (a.asset_url_format.match(/\?t=\d+/) || [""])[0];
      const u = f => f ? HOST + a.asset_url_format.replace("${FILENAME}", f) : null;
      let lib = {};
      for (let k = 0; k < 3; k++) { try { lib = ((((JSON.parse(get("https://api.steamcmd.net/v1/info/" + app)).data || {})[app] || {}).common || {}).library_assets_full) || {}; break; } catch (e) { sleep(1500); } }
      const one = o => { const x = (o || {}).image || {}; return x.german || x.english || Object.values(x)[0] || null; };
      const pu = f => f ? HOST + "steam/apps/" + app + "/" + f + t : null;
      const first = list => list.filter(Boolean).find(head) || null;
      out[app] = { p: u(a.library_capsule_2x || a.library_capsule), l: u(a.main_capsule || a.header_2x || a.header),
        h: first([u(a.library_hero), pu(one(lib.library_hero))]), g: first([pu(one(lib.library_logo)), HOST + "steam/apps/" + app + "/logo.png"]) };
    }
  }
  return out;
};
function pageImage(id, url) {
  const html = get(url);
  if (PS_MEDIA.has(id)) {
    const media = [];
    for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
      const s = m[1].trim(); if (!s.startsWith("{") || !s.includes('"cache"')) continue;
      try { for (const v of Object.values(JSON.parse(s).cache || {})) if (v.__typename === "Concept") media.push(...(v.media || [])); } catch (e) {}
    }
    const by = r => (media.find(x => x.type === "IMAGE" && x.role === r) || {}).url;
    const p = by("PORTRAIT_BANNER"), l = by("MASTER") || by("GAMEHUB_COVER_ART");
    if (p && l) return { p: p + "?w=720&thumb=false", l: l + "?w=1280&thumb=false" };
  }
  const m = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) || html.match(/content="([^"]+)"[^>]+property="og:image"/);
  if (!m) return null;
  const u = m[1];
  if (/assets\.nintendo\.com/.test(u)) return { p: u.replace(/c_fill,w_1200/, "c_fill,w_600,h_900," + (NIN_AUTO.has(id) ? "g_auto" : "g_center")).replace("f_auto", "f_jpg").replace("dpr_2.0/", ""), l: u.replace("f_auto", "f_jpg").replace("dpr_2.0", "dpr_1.0") };
  return { p: u, l: u };
}
const apps = [...new Set(Object.values(STEAM))];
const A = { ...steamAssets(apps.filter(a => STEAM_EN.has(a)), "english"), ...steamAssets(apps.filter(a => !STEAM_EN.has(a)), "german") };
const res = {};
for (const b of Object.values(CAT)) {
  if (b.cat !== "keys") continue;
  const app = STEAM[b.grp] || STEAM[b.id], a = app && A[app];
  if (a && (a.p || a.l)) { const e = res[b.id] = { p: a.p || a.l, l: a.l || a.p }; if (a.h) e.h = a.h; if (a.g) e.g = a.g; continue; }
  const page = PAGES[b.id], img = page && pageImage(b.id, page);
  if (img) { res[b.id] = img; continue; }
  console.log("ohne Bild:", b.id);
}
/* Unter Sperre neu einlesen, eigene IDs ersetzen, alle übrigen Einträge behalten; Format (1 Leerzeichen Einzug) bleibt */
const tgt = path.join(ROOT, "covers.json"), lock = tgt + ".lock";
if (DRY) {
  const cur = JSON.parse(fs.readFileSync(tgt, "utf8")); let d = 0;
  for (const [id, e] of Object.entries(res)) for (const k of ["p", "l", "h", "g"]) if ((cur[id] || {})[k] !== e[k]) { d++; console.log("anders:", id, k, (cur[id] || {})[k] || "–", "→", e[k] || "–"); }
  console.log(Object.keys(res).length, "Spiele mit offiziellem Bild,", d, "Unterschiede (nichts geschrieben)");
  process.exit(0);
}
for (let i = 0; ; i++) { try { fs.mkdirSync(lock); break; } catch (e) { if (i > 900) { console.error("Sperre hängt: " + lock); process.exit(1); } sleep(100); } }
try {
  const cur = JSON.parse(fs.readFileSync(tgt, "utf8"));
  for (const [id, e] of Object.entries(res)) cur[id] = e;
  const out = JSON.stringify(cur, null, 1) + "\n"; JSON.parse(out);
  fs.writeFileSync(tgt + ".tmp", out); fs.renameSync(tgt + ".tmp", tgt);
} finally { fs.rmdirSync(lock); }
console.log(Object.keys(res).length, "Spiele mit offiziellem Bild");
