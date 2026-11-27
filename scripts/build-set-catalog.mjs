const headers = { "User-Agent": "GrandmasterTCG/1.0", Accept: "application/json" };

async function json(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function clean(names) {
  return [...new Set(names.map((name) => String(name ?? "").trim()).filter((name) => name.length > 1 && name.length < 120 && !name.includes("?") && !name.includes("\uFFFD")))].sort((a, b) => a.localeCompare(b, "en"));
}

const pokemonLanguageLabels = { ja: "Japanese", fr: "French", de: "German", ko: "Korean", "zh-cn": "Chinese" };

function polish(name) {
  const words = String(name).replace(/\s+/g, " ").trim().replace(/\bpok[eé]mon\b/gi, "Pokémon").split(" ");
  return words.map((word, index) => {
    if (/^(ex|gx)$/i.test(word)) return word.toLowerCase();
    if (/^(vmax|vstar|vunion)$/i.test(word)) return word.toUpperCase();
    if (/^v$/i.test(word)) return "V";
    if (index > 0 && /^(of|the|a|an|and|in|to|for|on|from|vs)$/i.test(word)) return word.toLowerCase();
    if (/[A-Z]/.test(word.slice(1))) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
}

const fs = await import("node:fs");
const cachePath = new URL("./.set-translation-cache.json", import.meta.url);
const translationCache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : {};

async function translateOne(name, source) {
  const key = `${source}\n${name}`;
  if (translationCache[key]) return translationCache[key];
  const pair = `${source}|en`;
  const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(name)}&langpair=${encodeURIComponent(pair)}`, { headers: { "User-Agent": "GrandmasterTCG/1.0", Accept: "application/json" } });
  if (!response.ok) throw new Error(`${response.status} translate ${source}`);
  const data = await response.json();
  const text = data?.responseData?.translatedText;
  if (!text || data.responseStatus !== 200) throw new Error(`No translation for ${source}: ${name}`);
  translationCache[key] = text;
  fs.writeFileSync(cachePath, JSON.stringify(translationCache));
  return text;
}

async function translateAll(names, source) {
  const translated = [];
  for (const name of names) {
    translated.push(await translateOne(name, source));
  }
  return translated;
}

const nameOverrides = {
  "拡張パック": "Base Set",
  "ポケモンジャングル": "Jungle",
  "化石の秘密": "Mystery of the Fossils",
  "ポケモンカード★VS": "Pokémon VS",
  "ポケモンカード★web": "Pokémon Web",
  "ポケモンカード151": "151",
  "基本拡張パック": "Base Expansion Pack",
  "알로라의 햇빛": "Alolan Sunlight",
  "포켓몬 카드 151": "151",
  "横空出世 苍": "Storming Emergence: Verdant",
  "横空出世 赫": "Storming Emergence: Radiant",
  "横空出世 泽": "Storming Emergence: Abundant",
  "风暴涌现": "Storming Emergence",
  "战斗精英": "Battle Elite",
  "对战精英": "Battle Elite",
  "交相辉映 唤": "Shining Synergy: Summon",
  "交相辉映 沐": "Shining Synergy: Shower",
  "交相辉映 魁": "Shining Synergy: Supreme",
  "闪耀协同效应": "Shining Synergy",
  "炫奇争胜": "Striking Competition",
  "极巨争锋 焰": "Dynamax Clash: Flame",
  "极巨攻防": "Dynamax Tactics",
  "浓墨重彩 黎": "Vivid Portrayals: Obsidian",
  "浓墨重彩 靛": "Vivid Portrayals: Indigo",
  "璀璨反击": "Brilliant Counterattack",
  "洪荒演武 激": "Primordial Arts: Torrent",
  "洪荒演武 茂": "Primordial Arts: Overgrow",
  "怒炎灼天": "Scorching Skies",
  "九彩汇聚 源": "Polychromatic Gathering: Origin",
  "九彩汇聚 朋": "Polychromatic Gathering: Friends",
  "终末炎舞": "Flame Dance of the End",
  "勇魅群星 魅": "Gallant Galaxy: Charm",
  "勇魅群星 勇": "Gallant Galaxy: Brave",
  "暗影夺辉": "Overshadowed Radiance",
  "碧海暗影 逐": "Marine Shadow: Banish",
  "碧海暗影 啸": "Marine Shadow: Roar",
  "胜象星引": "Victory Lodestar",
  "亘古开来": "Ancient Times, Future Progress",
  "宝石包 第一卷": "Gem Pack Vol. 1",
  "奇迹启程": "Miracle Journey",
  "宝石包Vol.2": "Gem Pack Vol. 2",
  "无畏太晶": "Fearless Terastal",
  "嘉奖回合": "Bonus Round",
  "黑晶炽诚": "Ardent Obsidian",
  "宝石包Vol.3": "Gem Pack Vol. 3",
  "真实玄虚": "Arcane Truth",
  "利刃猛醒": "Blade Awakening",
  "宝石包 Vol.4": "Gem Pack Vol. 4",
  "璀璨诡幻": "Sparkling Fable",
  "宝石包 Vol.5": "Gem Pack Vol. 5",
  "星彩晶璃": "Stellar Crystal",
  "太晶盛聚": "Terastal Gathering",
  "熱風競技場": "Hot Wind Arena",
  "星晶奇跡": "Stellar Miracle",
  "太晶慶典ex": "Terastal Festival ex",
  "超電突圍": "Supercharged Breakthrough",
  "對戰搭檔": "Battle Partners",
  "火箭隊的榮耀": "Team Rocket's Glory",
  "樂園騰龍": "Paradise Dragona"
};

const englishSets = await json("https://api.tcgdex.net/v2/en/sets");
const englishById = new Map(englishSets.map((set) => [set.id, set.name]));
const pokemon = [];
const usedPokemonNames = new Set();
function addPokemonSet(name, id) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return;
  const unique = usedPokemonNames.has(trimmed) ? `${trimmed} · ${id}` : trimmed;
  usedPokemonNames.add(unique);
  pokemon.push(unique);
}
for (const set of englishSets) addPokemonSet(set.name, set.id);
for (const [code, label] of Object.entries(pokemonLanguageLabels)) {
  const sets = await json(`https://api.tcgdex.net/v2/${code}/sets`);
  const needsTranslation = sets.filter((set) => !englishById.has(set.id));
  const translated = await translateAll(needsTranslation.map((set) => set.name), code === "zh-cn" ? "zh-CN" : code);
  const translatedById = new Map(needsTranslation.map((set, index) => [set.id, translated[index]]));
  for (const set of sets) {
    const overridden = nameOverrides[set.name];
    const english = englishById.get(set.id);
    const name = overridden ? `${overridden} (${label})` : english ? `${english} (${label})` : `${polish(translatedById.get(set.id))} (${label})`;
    addPokemonSet(name, set.id);
  }
}

const magicTypes = new Set(["expansion", "core", "masters", "draft_innovation", "commander", "starter", "duel_deck", "masterpiece", "arsenal", "eternal", "funny", "planechase", "archenemy", "from_the_vault", "spellbook", "premium_deck", "alchemy"]);
const magicData = await json("https://api.scryfall.com/sets");
const magic = magicData.data.filter((set) => magicTypes.has(set.set_type) && !set.digital).map((set) => set.name);

const yugioh = (await json("https://db.ygoprodeck.com/api/v7/cardsets.php")).map((set) => set.set_name);

const onePiece = (await json("https://optcgapi.com/api/allSets/")).map((set) => set.set_name);
const lorcana = (await json("https://api.lorcana-api.com/bulk/sets")).map((set) => set.Name);
for (const extra of ["Hyperia City", "Into the Inkdark", "The Great Hunny Rescue", "Cosmic Quest"]) {
  if (!lorcana.includes(extra)) lorcana.push(extra);
}
const starWars = (await json("https://api.swu-db.com/sets"))
  .map((set) => set.fullName)
  .filter((name) => !/promo|judge|weekly|exclusive|gamegenic|convention|showdown|gift box|costco/i.test(name));
const fab = (await json("https://api.goagain.dev/v1/sets")).map((set) => set.name);

const catalog = {
  "Pokémon": clean(pokemon),
  "Magic: The Gathering": clean(magic),
  "Yu-Gi-Oh!": clean(yugioh),
  "One Piece": clean(onePiece),
  Lorcana: clean(lorcana),
  "Flesh and Blood": clean(fab),
  "Star Wars Unlimited": clean(starWars)
};

for (const [game, sets] of Object.entries(catalog)) console.log(game, sets.length);
await import("node:fs").then((fs) => fs.writeFileSync(new URL("../lib/set-catalog.json", import.meta.url), JSON.stringify(catalog)));
