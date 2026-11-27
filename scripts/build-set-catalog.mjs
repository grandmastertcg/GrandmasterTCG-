const headers = { "User-Agent": "GrandmasterTCG/1.0", Accept: "application/json" };

async function json(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function clean(names) {
  return [...new Set(names.map((name) => String(name ?? "").trim()).filter((name) => name.length > 1 && name.length < 120 && !name.includes("?") && !name.includes("\uFFFD")))].sort((a, b) => a.localeCompare(b, "en"));
}

const pokemonLanguages = ["en", "ja", "fr", "de", "ko", "zh-cn"];
const pokemon = [];
for (const language of pokemonLanguages) {
  const sets = await json(`https://api.tcgdex.net/v2/${language}/sets`);
  for (const set of sets) pokemon.push(set.name);
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
