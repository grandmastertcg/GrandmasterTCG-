export type Product = {
  id: string;
  name: string;
  game: string;
  set_name: string | null;
  condition: string;
  price_pence: number;
  image_url: string | null;
  back_image_url?: string | null;
  stock: number;
  card_number?: string | null;
  rarity?: string | null;
  description?: string | null;
  language?: string | null;
  finish?: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  postage_size?: string | null;
  bundle_size?: number | null;
  completed_parcels?: number;
  seller_business?: boolean | null;
  grader?: string | null;
  grade?: string | null;
  cert_number?: string | null;
};

export const SALE_GAMES = [
  "Pokémon",
  "Magic: The Gathering",
  "Yu-Gi-Oh!",
  "Yu-Gi-Oh! Rush Duel",
  "One Piece",
  "One Piece Carddass",
  "Lorcana",
  "Digimon",
  "Dragon Ball Super",
  "Flesh and Blood",
  "Star Wars Unlimited",
  "Weiss Schwarz",
  "Union Arena",
  "Riftbound",
  "Gundam",
  "Gundam Arsenal Base",
  "Final Fantasy",
  "MetaZoo",
  "Elestrals",
  "Cardfight!! Vanguard",
  "Bakugan",
  "Akora",
  "Munchkin",
  "Exodus",
  "Dragoborne",
  "Dice Masters",
  "Chrono Clash System",
  "Battle Spirits Saga",
  "Argent Saga",
  "Alpha Clash",
  "Zombie World Order",
  "World of Warcraft",
  "WIXOSS",
  "Warhammer",
  "Universus",
  "Transformers",
  "The Caster Chronicles",
  "Sorcery",
  "Shadowverse",
  "MetaX",
  "Lightseeker",
  "Kryptik",
  "Hololive",
  "Grand Archive",
  "Godzilla",
  "Gate Ruler",
  "Future Card Buddyfight",
  "Force of Will",
  "Vibe TCG",
  "Naruto Kayou",
  "Naruto Mythos",
  "Palworld",
  "KPop Demon Hunters",
  "My Little Pony Kayou",
  "Austin Powers CCG",
  "Cyberpunk TCG",
  "Kayou Demon Slayer",
  "Naruto CCG (2006-2013)",
  "Other"
] as const;

export const GAME_LANGUAGES: Partial<Record<(typeof SALE_GAMES)[number], readonly string[]>> = {
  "Pokémon": ["English", "Japanese", "Chinese", "Korean", "French", "German"],
  "Magic: The Gathering": ["English", "Japanese"],
  "One Piece": ["English", "Japanese"],
  "Lorcana": ["English", "Japanese"],
  "Digimon": ["English", "Japanese"],
  "Weiss Schwarz": ["English", "Japanese"],
  "Palworld": ["English", "Japanese"]
};

export const POKEMON_LANGUAGES = GAME_LANGUAGES["Pokémon"]!;

export function languagesFor(game: string) {
  return GAME_LANGUAGES[game as keyof typeof GAME_LANGUAGES] ?? [];
}

export function cardLanguage(game: string, value: string | null | undefined) {
  const options = languagesFor(game);
  if (!options.length) return null;
  return options.find((language) => language === value) ?? options[0];
}

export function pokemonLanguage(value: string | null | undefined) {
  return cardLanguage("Pokémon", value) ?? "English";
}

const SHORT_GAME: Record<string, string> = {
  "Magic: The Gathering": "Magic",
  "Star Wars Unlimited": "Star Wars",
  "Dragon Ball Super": "Dragon Ball",
  "Yu-Gi-Oh! Rush Duel": "Rush Duel",
  "One Piece Carddass": "Carddass",
  "Cardfight!! Vanguard": "Vanguard",
  "Chrono Clash System": "Chrono Clash",
  "Battle Spirits Saga": "Battle Spirits",
  "Zombie World Order": "Zombie World",
  "World of Warcraft": "Warcraft",
  "The Caster Chronicles": "Caster Chronicles",
  "Future Card Buddyfight": "Buddyfight",
  "Gundam Arsenal Base": "Arsenal Base",
  "My Little Pony Kayou": "My Little Pony",
  "KPop Demon Hunters": "KPop",
  "Naruto CCG (2006-2013)": "Naruto CCG",
  "Kayou Demon Slayer": "Demon Slayer",
  "Austin Powers CCG": "Austin Powers",
  "Cyberpunk TCG": "Cyberpunk"
};

export function gameLabel(game: string) {
  return SHORT_GAME[game] ?? game;
}

export function sameListingLanguage(game: string, left: string | null | undefined, right: string | null | undefined) {
  if (languagesFor(game).length <= 1) return true;
  return cardLanguage(game, left) === cardLanguage(game, right);
}
export const SALE_CONDITIONS = ["Near Mint (NM)", "Lightly Played (LP)", "Moderately Played (MP)", "Heavily Played (HP)", "Damaged (DMG)"] as const;
export const POKEMON_NOTES = ["Off Centre (OC)", "Misprint/Error card"] as const;

const LEGACY_CONDITIONS: Record<string, (typeof SALE_CONDITIONS)[number]> = {
  "Near Mint": "Near Mint (NM)",
  Excellent: "Lightly Played (LP)",
  Good: "Moderately Played (MP)",
  Played: "Heavily Played (HP)",
  Poor: "Damaged (DMG)",
  "Lightly Played": "Lightly Played (LP)",
  "Moderately Played": "Moderately Played (MP)",
  "Heavily Played": "Heavily Played (HP)",
  Damaged: "Damaged (DMG)"
};

export function conditionsFor(game: string): string[] {
  return game === "Pokémon" ? [...SALE_CONDITIONS, ...POKEMON_NOTES] : [...SALE_CONDITIONS];
}

export function conditionNote(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return POKEMON_NOTES.find((note) => text === note || text.endsWith(` · ${note}`)) ?? "";
}

export function withConditionNote(base: string, note: string | null | undefined) {
  const chosen = conditionNote(note);
  const plain = base.replace(/ · (Off Centre \(OC\)|Misprint\/Error card)$/, "");
  return chosen ? `${plain} · ${chosen}` : plain;
}

export function saleCondition(value: string | null | undefined, game?: string) {
  const text = (value ?? "").trim();
  if ((SALE_CONDITIONS as readonly string[]).includes(text)) return text;
  if (LEGACY_CONDITIONS[text]) return LEGACY_CONDITIONS[text];
  if ((POKEMON_NOTES as readonly string[]).includes(text) && game !== "Pokémon" && game != null) return null;
  if ((POKEMON_NOTES as readonly string[]).includes(text)) return text;
  return null;
}

export function conditionLabel(value: string | null | undefined) {
  return saleCondition(value) ?? (value ?? "").trim();
}

export const GAMES = ["All games", ...SALE_GAMES.filter((game) => game !== "Other"), "Other"] as const;

export const CONDITIONS = ["Any condition", "Graded", ...SALE_CONDITIONS] as const;

export const demoCatalog: Product[] = [
  { id: "demo-1", name: "Charizard ex", game: "Pokémon", set_name: "Obsidian Flames", card_number: "223/197", rarity: "Ultra Rare", condition: "Near Mint (NM)", price_pence: 2499, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-2", name: "Charizard ex", game: "Pokémon", set_name: "Obsidian Flames", card_number: "223/197", rarity: "Ultra Rare", condition: "Lightly Played (LP)", price_pence: 1899, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-3", name: "Charizard ex", game: "Pokémon", set_name: "Obsidian Flames", card_number: "223/197", rarity: "Ultra Rare", condition: "Moderately Played (MP)", price_pence: 1299, image_url: null, stock: 2, language: "English", finish: "Holofoil" },
  { id: "demo-4", name: "Umbreon VMAX", game: "Pokémon", set_name: "Evolving Skies", card_number: "215/203", rarity: "Secret Rare", condition: "Near Mint (NM)", price_pence: 3299, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-5", name: "Iono", game: "Pokémon", set_name: "Paldean Fates", card_number: "237/091", rarity: "Special Illustration", condition: "Near Mint (NM)", price_pence: 1499, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-6", name: "Pikachu", game: "Pokémon", set_name: "Paldea Evolved", card_number: "019/193", rarity: "Common", condition: "Near Mint (NM)", price_pence: 150, image_url: null, stock: 8, language: "English", finish: "Non-foil" },
  { id: "demo-7", name: "Eevee", game: "Pokémon", set_name: "151", card_number: "133/165", rarity: "Common", condition: "Near Mint (NM)", price_pence: 225, image_url: null, stock: 6, language: "English", finish: "Reverse Holo" },
  { id: "demo-8", name: "Mewtwo VSTAR", game: "Pokémon", set_name: "Pokémon GO", card_number: "031/078", rarity: "Rare", condition: "Near Mint (NM)", price_pence: 649, image_url: null, stock: 3, language: "English", finish: "Holofoil" },
  { id: "demo-9", name: "Gengar", game: "Pokémon", set_name: "Lost Origin", card_number: "066/196", rarity: "Rare", condition: "Lightly Played (LP)", price_pence: 899, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-10", name: "Sheoldred, the Apocalypse", game: "Magic: The Gathering", set_name: "Phyrexia: All Will Be One", card_number: "107", rarity: "Mythic", condition: "Near Mint (NM)", price_pence: 4299, image_url: null, stock: 1, language: "English", finish: "Non-foil" },
  { id: "demo-11", name: "Sol Ring", game: "Magic: The Gathering", set_name: "Commander Masters", card_number: "373", rarity: "Uncommon", condition: "Near Mint (NM)", price_pence: 189, image_url: null, stock: 4, language: "English", finish: "Non-foil" },
  { id: "demo-12", name: "Lightning Bolt", game: "Magic: The Gathering", set_name: "Modern Horizons 2", card_number: "142", rarity: "Common", condition: "Heavily Played (HP)", price_pence: 75, image_url: null, stock: 12, language: "English", finish: "Non-foil" },
  { id: "demo-13", name: "Blue-Eyes White Dragon", game: "Yu-Gi-Oh!", set_name: "Legend of Blue Eyes", card_number: "LOB-001", rarity: "Ultra Rare", condition: "Lightly Played (LP)", price_pence: 1899, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-14", name: "Blue-Eyes White Dragon", game: "Yu-Gi-Oh!", set_name: "Legend of Blue Eyes", card_number: "LOB-001", rarity: "Ultra Rare", condition: "Moderately Played (MP)", price_pence: 999, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-15", name: "Dark Magician", game: "Yu-Gi-Oh!", set_name: "25th Anniversary", card_number: "SDY-006", rarity: "Ultra Rare", condition: "Near Mint (NM)", price_pence: 799, image_url: null, stock: 2, language: "English", finish: "Holofoil" },
  { id: "demo-16", name: "Ash Blossom & Joyous Spring", game: "Yu-Gi-Oh!", set_name: "Maximum Gold", card_number: "MAGO-EN020", rarity: "Rare", condition: "Near Mint (NM)", price_pence: 450, image_url: null, stock: 3, language: "English", finish: "Holofoil" },
  { id: "demo-17", name: "Monkey D. Luffy", game: "One Piece", set_name: "Awakening of the New Era", card_number: "OP01-003", rarity: "Super Rare", condition: "Near Mint (NM)", price_pence: 649, image_url: null, stock: 2, language: "English", finish: "Holofoil" },
  { id: "demo-18", name: "Roronoa Zoro", game: "One Piece", set_name: "Paramount War", card_number: "OP02-049", rarity: "Super Rare", condition: "Near Mint (NM)", price_pence: 525, image_url: null, stock: 2, language: "English", finish: "Holofoil" },
  { id: "demo-19", name: "Nami", game: "One Piece", set_name: "Romance Dawn", card_number: "OP01-016", rarity: "Rare", condition: "Heavily Played (HP)", price_pence: 199, image_url: null, stock: 1, language: "English", finish: "Non-foil" },
  { id: "demo-20", name: "Elsa", game: "Lorcana", set_name: "The First Chapter", card_number: "46/204", rarity: "Legendary", condition: "Near Mint (NM)", price_pence: 1199, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-21", name: "Mickey Mouse", game: "Lorcana", set_name: "The First Chapter", card_number: "119/204", rarity: "Rare", condition: "Lightly Played (LP)", price_pence: 450, image_url: null, stock: 2, language: "English", finish: "Non-foil" }
];

export function gbp(pence: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export function gameHue(game: string) {
  if (game.startsWith("Pok")) return "pokemon";
  if (game.startsWith("Magic")) return "magic";
  if (game.startsWith("Yu-")) return "ygo";
  if (game.startsWith("One")) return "onepiece";
  return "lorcana";
}
