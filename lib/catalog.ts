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
  seller_name?: string | null;
  seller_business?: boolean | null;
  grader?: string | null;
  grade?: string | null;
  cert_number?: string | null;
};

export const SALE_GAMES = ["Pokémon", "Magic: The Gathering", "Yu-Gi-Oh!", "One Piece", "Lorcana", "Other"] as const;
export const SALE_CONDITIONS = ["Near Mint", "Excellent", "Good", "Played", "Poor"] as const;

export const GAMES = [
  "All games",
  "Pokémon",
  "Magic: The Gathering",
  "Yu-Gi-Oh!",
  "One Piece",
  "Lorcana"
] as const;

export const CONDITIONS = ["Any condition", "Graded", "Near Mint", "Excellent", "Good", "Played", "Poor"] as const;

export const demoCatalog: Product[] = [
  { id: "demo-1", name: "Charizard ex", game: "Pokémon", set_name: "Obsidian Flames", card_number: "223/197", rarity: "Ultra Rare", condition: "Near Mint", price_pence: 2499, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-2", name: "Charizard ex", game: "Pokémon", set_name: "Obsidian Flames", card_number: "223/197", rarity: "Ultra Rare", condition: "Excellent", price_pence: 1899, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-3", name: "Charizard ex", game: "Pokémon", set_name: "Obsidian Flames", card_number: "223/197", rarity: "Ultra Rare", condition: "Good", price_pence: 1299, image_url: null, stock: 2, language: "English", finish: "Holofoil" },
  { id: "demo-4", name: "Umbreon VMAX", game: "Pokémon", set_name: "Evolving Skies", card_number: "215/203", rarity: "Secret Rare", condition: "Near Mint", price_pence: 3299, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-5", name: "Iono", game: "Pokémon", set_name: "Paldean Fates", card_number: "237/091", rarity: "Special Illustration", condition: "Near Mint", price_pence: 1499, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-6", name: "Pikachu", game: "Pokémon", set_name: "Paldea Evolved", card_number: "019/193", rarity: "Common", condition: "Near Mint", price_pence: 150, image_url: null, stock: 8, language: "English", finish: "Non-foil" },
  { id: "demo-7", name: "Eevee", game: "Pokémon", set_name: "151", card_number: "133/165", rarity: "Common", condition: "Near Mint", price_pence: 225, image_url: null, stock: 6, language: "English", finish: "Reverse Holo" },
  { id: "demo-8", name: "Mewtwo VSTAR", game: "Pokémon", set_name: "Pokémon GO", card_number: "031/078", rarity: "Rare", condition: "Near Mint", price_pence: 649, image_url: null, stock: 3, language: "English", finish: "Holofoil" },
  { id: "demo-9", name: "Gengar", game: "Pokémon", set_name: "Lost Origin", card_number: "066/196", rarity: "Rare", condition: "Excellent", price_pence: 899, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-10", name: "Sheoldred, the Apocalypse", game: "Magic: The Gathering", set_name: "Phyrexia: All Will Be One", card_number: "107", rarity: "Mythic", condition: "Near Mint", price_pence: 4299, image_url: null, stock: 1, language: "English", finish: "Non-foil" },
  { id: "demo-11", name: "Sol Ring", game: "Magic: The Gathering", set_name: "Commander Masters", card_number: "373", rarity: "Uncommon", condition: "Near Mint", price_pence: 189, image_url: null, stock: 4, language: "English", finish: "Non-foil" },
  { id: "demo-12", name: "Lightning Bolt", game: "Magic: The Gathering", set_name: "Modern Horizons 2", card_number: "142", rarity: "Common", condition: "Played", price_pence: 75, image_url: null, stock: 12, language: "English", finish: "Non-foil" },
  { id: "demo-13", name: "Blue-Eyes White Dragon", game: "Yu-Gi-Oh!", set_name: "Legend of Blue Eyes", card_number: "LOB-001", rarity: "Ultra Rare", condition: "Excellent", price_pence: 1899, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-14", name: "Blue-Eyes White Dragon", game: "Yu-Gi-Oh!", set_name: "Legend of Blue Eyes", card_number: "LOB-001", rarity: "Ultra Rare", condition: "Good", price_pence: 999, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-15", name: "Dark Magician", game: "Yu-Gi-Oh!", set_name: "25th Anniversary", card_number: "SDY-006", rarity: "Ultra Rare", condition: "Near Mint", price_pence: 799, image_url: null, stock: 2, language: "English", finish: "Holofoil" },
  { id: "demo-16", name: "Ash Blossom & Joyous Spring", game: "Yu-Gi-Oh!", set_name: "Maximum Gold", card_number: "MAGO-EN020", rarity: "Rare", condition: "Near Mint", price_pence: 450, image_url: null, stock: 3, language: "English", finish: "Holofoil" },
  { id: "demo-17", name: "Monkey D. Luffy", game: "One Piece", set_name: "Awakening of the New Era", card_number: "OP01-003", rarity: "Super Rare", condition: "Near Mint", price_pence: 649, image_url: null, stock: 2, language: "English", finish: "Holofoil" },
  { id: "demo-18", name: "Roronoa Zoro", game: "One Piece", set_name: "Paramount War", card_number: "OP02-049", rarity: "Super Rare", condition: "Near Mint", price_pence: 525, image_url: null, stock: 2, language: "English", finish: "Holofoil" },
  { id: "demo-19", name: "Nami", game: "One Piece", set_name: "Romance Dawn", card_number: "OP01-016", rarity: "Rare", condition: "Played", price_pence: 199, image_url: null, stock: 1, language: "English", finish: "Non-foil" },
  { id: "demo-20", name: "Elsa", game: "Lorcana", set_name: "The First Chapter", card_number: "46/204", rarity: "Legendary", condition: "Near Mint", price_pence: 1199, image_url: null, stock: 1, language: "English", finish: "Holofoil" },
  { id: "demo-21", name: "Mickey Mouse", game: "Lorcana", set_name: "The First Chapter", card_number: "119/204", rarity: "Rare", condition: "Excellent", price_pence: 450, image_url: null, stock: 2, language: "English", finish: "Non-foil" }
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
