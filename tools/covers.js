/* Ermittelt die offiziellen Shop-Bilder (Steam, Nintendo, PlayStation, Minecraft) für die Spiele-Keys
   und schreibt sie nach covers.json: { id: { p: Hochformat-URL, l: Querformat-URL } }.
   Die Bilder selbst liegen nicht im Repo – der Server lädt sie beim ersten Aufruf und speichert sie zwischen.
   Aufruf: node tools/covers.js */
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), CAT = JSON.parse(fs.readFileSync(path.join(ROOT, "catalog.json"), "utf8"));
const get = u => execFileSync("curl", ["-sL", "-m", "20", "-A", "Mozilla/5.0", u], { maxBuffer: 2e7 }).toString();
/* Steam-App je Spiel (Name → App-ID), geprüft über die Steam-Suche */
const STEAM = { fc26: 3405690, bo7: 3606480, bf6: 2807960, gta5: 271590, "rdr2-rockstar": 1174180, eldenring: 1245620, "cp2077-steam": 1091500,
  "bg3-steam": 1086940, hogwarts: 990080, "fh5-xpc": 1551360, "diablo4-bnet": 2344520, mhwilds: 2246340, acshadows: 3159330, "kcd2-steam": 1771300,
  splitfiction: 2001120, "silksong-steam": 1030300, "stardew-steam": 413150, helldivers2: 553850, "witcher3-steam": 292030, "palworld-steam": 1623730,
  "fs25-steam": 2300320, "ets2-steam": 227300, "civ7-steam": 1295660, "seaofthieves-xpc": 1172620, "cs2-steam": 730, "re4-steam": 2050650, sf6: 1364780,
  tekken8: 1778820, doomtda: 3017860, "indiana-xpc": 2677660, "ds2-ps5": 3280350, mgsdelta: 2417610, "wukong-steam": 2358720, "satisfactory-steam": 526870,
  "valheim-steam": 892970, "terraria-steam": 105600, "rust-steam": 252490, "dbd-steam": 381210, "ittakestwo-ea": 1426210 };
/* Andere Shops: offizielles Vorschaubild der Produktseite */
const PAGES = { "mkworld-switch2": "https://www.nintendo.com/us/store/products/mario-kart-world-switch-2/",
  "zeldatotk-switch": "https://www.nintendo.com/us/store/products/the-legend-of-zelda-tears-of-the-kingdom-switch/",
  "pokemonza-switch": "https://www.nintendo.com/us/store/products/pokemon-legends-z-a-switch/",
  "acnh-switch": "https://www.nintendo.com/us/store/products/animal-crossing-new-horizons-switch/",
  "smbwonder-switch": "https://www.nintendo.com/us/store/products/super-mario-bros-wonder-switch/",
  "mpjamboree-switch": "https://www.nintendo.com/us/store/products/super-mario-party-jamboree-switch/",
  "dkbananza-switch2": "https://www.nintendo.com/us/store/products/donkey-kong-bananza-switch-2/",
  "ghostyotei-ps5": "https://www.playstation.com/en-us/games/ghost-of-yotei/",
  "minecraft-pc": "https://www.minecraft.net/en-us/store/minecraft-deluxe-collection-pc" };
const steamAssets = ids => {
  const q = encodeURIComponent(JSON.stringify({ ids: ids.map(appid => ({ appid })), context: { language: "english", country_code: "DE" }, data_request: { include_assets: true } }));
  const r = JSON.parse(get("https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=" + q));
  const out = {};
  for (const it of r.response.store_items || []) {
    const a = it.assets || {}; if (!a.asset_url_format) continue;
    const u = f => f ? "https://shared.akamai.steamstatic.com/store_item_assets/" + a.asset_url_format.replace("${FILENAME}", f) : null;
    out[it.appid] = { p: u(a.library_capsule_2x || a.library_capsule), l: u(a.main_capsule || a.header_2x || a.header) };
  }
  return out;
};
const res = {}, apps = [...new Set(Object.values(STEAM))];
const A = steamAssets(apps);
for (const b of Object.values(CAT)) {
  if (b.cat !== "keys") continue;
  const app = STEAM[b.grp] || STEAM[b.id];
  if (app && A[app] && (A[app].p || A[app].l)) { res[b.id] = { p: A[app].p || A[app].l, l: A[app].l || A[app].p }; continue; }
  const page = PAGES[b.id];
  if (page) {
    const m = get(page).match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/) || get(page).match(/content="([^"]+)"[^>]+property="og:image"/);
    if (m) {
      let u = m[1];
      if (/assets\.nintendo\.com/.test(u)) res[b.id] = { p: u.replace(/c_fill,w_1200/, "c_fill,w_600,h_900,g_center").replace("f_auto", "f_jpg").replace("dpr_2.0/", ""), l: u.replace("f_auto", "f_jpg").replace("dpr_2.0", "dpr_1.0") };
      else res[b.id] = { p: u, l: u };
      continue;
    }
  }
  console.log("ohne Bild:", b.id);
}
fs.writeFileSync(path.join(ROOT, "covers.json"), JSON.stringify(res, null, 1) + "\n");
console.log(Object.keys(res).length, "Spiele mit offiziellem Bild");
