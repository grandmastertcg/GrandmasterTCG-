import { SALE_GAMES, languagesFor } from "@/lib/catalog";
import { GRADERS, GRADES, gradeLabel } from "@/lib/grades";

export type BatchCard = {
  name: string;
  game: string;
  set_name: string;
  card_number: string;
  rarity: string;
  condition: string;
  grader: string | null;
  grade: string | null;
  cert_number: string | null;
  price_pence: number;
  stock: number;
  image_url: string | null;
  back_image_url: string | null;
  language: string | null;
};

export type BatchIssue = { row: number; message: string };

const NAME_KEYS = ["productname", "cardname", "title", "name", "card", "itemtitle"];
const GAME_KEYS = ["productline", "game", "sport"];
const SET_KEYS = ["setname", "set", "expansion", "edition"];
const NUMBER_KEYS = ["cardnumber", "collectornumber", "number", "cardno"];
const RARITY_KEYS = ["rarity"];
const CONDITION_KEYS = ["cardcondition", "condition"];
const PRICE_KEYS = ["tcgmarketplaceprice", "price", "startprice", "buyitnowprice", "variantprice", "listingprice"];
const STOCK_KEYS = ["addtoquantity", "quantity", "qty", "stock", "variantinventoryqty", "totalquantity"];
const IMAGE_KEYS = ["picurl", "photourl", "pictureurl", "imageurl", "imagesrc", "imageurl1", "frontimage", "image1", "image"];
const BACK_KEYS = ["imageurl2", "backimageurl", "backimage", "image2"];
const GRADER_KEYS = ["grader", "gradingcompany"];
const GRADE_KEYS = ["grade"];
const CERT_KEYS = ["certnumber", "certificatenumber", "certificationnumber", "cert"];
const LANGUAGE_KEYS = ["language", "cardlanguage", "lang"];

function normHeader(value: string) {
  return value.trim().toLowerCase().replace(/^\*/, "").replace(/^c:/, "").replace(/[^a-z0-9]/g, "");
}

function detectDelimiter(text: string) {
  const line = text.split(/\r?\n/).find((entry) => entry.trim() && !entry.trim().startsWith("#")) ?? "";
  const counts: [string, number][] = [
    [",", line.split(",").length],
    [";", line.split(";").length],
    ["\t", line.split("\t").length]
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][0];
}

export function parseCsv(text: string) {
  const source = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === "\"" && source[i + 1] === "\"") {
        cell += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function columns(headers: string[], keys: string[]) {
  return keys.flatMap((key) => {
    const index = headers.indexOf(key);
    return index >= 0 ? [index] : [];
  });
}

function firstFilled(row: string[], indexes: number[]) {
  for (const index of indexes) {
    const value = (row[index] ?? "").trim();
    if (value) return value;
  }
  return "";
}

const GAME_RULES: [RegExp, string][] = [
  [/pokemon|pokémon/, "Pokémon"],
  [/rush duel/, "Yu-Gi-Oh! Rush Duel"],
  [/one piece carddass/, "One Piece Carddass"],
  [/gundam arsenal/, "Gundam Arsenal Base"],
  [/naruto kayou/, "Naruto Kayou"],
  [/naruto mythos/, "Naruto Mythos"],
  [/naruto ccg/, "Naruto CCG (2006-2013)"],
  [/kayou demon|demon slayer/, "Kayou Demon Slayer"],
  [/k-?pop demon/, "KPop Demon Hunters"],
  [/my little pony/, "My Little Pony Kayou"],
  [/magic|gathering|\bmtg\b/, "Magic: The Gathering"],
  [/yugioh|yu-gi-oh|yu gi oh/, "Yu-Gi-Oh!"],
  [/one piece/, "One Piece"],
  [/lorcana/, "Lorcana"],
  [/digimon/, "Digimon"],
  [/dragon ball/, "Dragon Ball Super"],
  [/flesh and blood|\bfab\b/, "Flesh and Blood"],
  [/star wars/, "Star Wars Unlimited"],
  [/weiss|weiß/, "Weiss Schwarz"],
  [/union arena/, "Union Arena"],
  [/riftbound/, "Riftbound"],
  [/gundam/, "Gundam"],
  [/final fantasy/, "Final Fantasy"],
  [/metazoo/, "MetaZoo"],
  [/elestrals/, "Elestrals"],
  [/vanguard/, "Cardfight!! Vanguard"],
  [/bakugan/, "Bakugan"],
  [/akora/, "Akora"],
  [/munchkin/, "Munchkin"],
  [/exodus/, "Exodus"],
  [/dragoborne/, "Dragoborne"],
  [/dice masters/, "Dice Masters"],
  [/chrono clash/, "Chrono Clash System"],
  [/battle spirits/, "Battle Spirits Saga"],
  [/argent saga/, "Argent Saga"],
  [/alpha clash/, "Alpha Clash"],
  [/zombie world/, "Zombie World Order"],
  [/warcraft/, "World of Warcraft"],
  [/wixoss/, "WIXOSS"],
  [/warhammer/, "Warhammer"],
  [/universus|uni versus/, "Universus"],
  [/transformers/, "Transformers"],
  [/caster chronicles/, "The Caster Chronicles"],
  [/sorcery/, "Sorcery"],
  [/shadowverse/, "Shadowverse"],
  [/metax/, "MetaX"],
  [/lightseeker/, "Lightseeker"],
  [/kryptik/, "Kryptik"],
  [/hololive/, "Hololive"],
  [/grand archive/, "Grand Archive"],
  [/godzilla/, "Godzilla"],
  [/gate ruler/, "Gate Ruler"],
  [/buddyfight/, "Future Card Buddyfight"],
  [/force of will/, "Force of Will"],
  [/\bvibe\b/, "Vibe TCG"],
  [/palworld/, "Palworld"],
  [/austin powers/, "Austin Powers CCG"],
  [/cyberpunk/, "Cyberpunk TCG"]
];

function mapGame(value: string, fallback: string) {
  const text = value.toLowerCase();
  if (!text || /^\d+$/.test(text)) return fallback;
  for (const [pattern, game] of GAME_RULES) {
    if (pattern.test(text)) return game;
  }
  const known = SALE_GAMES.find((game) => game.toLowerCase() === text);
  return known ?? "Other";
}

function mapCondition(value: string) {
  const text = value.toLowerCase();
  if (!text) return "";
  if (/\b(heavily played|hp|played|poor)\b/.test(text) && !/lightly|moderately|near|excellent|good/.test(text)) {
    return /\b(poor|damaged)\b/.test(text) ? "Poor" : "Played";
  }
  if (/\b(damaged|poor|dmg)\b/.test(text)) return "Poor";
  if (/\b(heavily played|heavilyplayed)\b/.test(text) || /\bhp\b/.test(text)) return "Played";
  if (/\b(moderately played|moderatelyplayed)\b/.test(text) || /\bmp\b/.test(text) || /\bgood\b/.test(text)) return "Good";
  if (/\b(lightly played|lightlyplayed|excellent)\b/.test(text) || /\blp\b/.test(text) || /\bex\b/.test(text)) return "Excellent";
  if (/\b(near mint|nearmint|mint|nm)\b/.test(text) || text === "new") return "Near Mint";
  return "";
}

function mapLanguage(value: string, gameText: string, fallbackGame: string, fallbackLanguage: string) {
  const game = mapGame(gameText, fallbackGame);
  const options = languagesFor(game);
  if (!options.length) return null;
  const blob = `${value} ${gameText}`.toLowerCase();
  const fromText = /french/.test(blob) ? "French"
    : /german/.test(blob) ? "German"
    : /chinese/.test(blob) ? "Chinese"
    : /korean/.test(blob) ? "Korean"
    : /japan/.test(blob) ? "Japanese"
    : /english/.test(blob) ? "English"
    : "";
  if (fromText && options.includes(fromText)) return fromText;
  if (options.includes(fallbackLanguage)) return fallbackLanguage;
  return options[0];
}

function pricePence(value: string) {
  const cleaned = value.trim().replace(/[£$€,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,4})?$/.test(cleaned)) return null;
  const pence = Math.round(Number(cleaned) * 100);
  if (!Number.isSafeInteger(pence) || pence <= 0 || pence > 999999900) return null;
  return pence;
}

function photoLink(value: string) {
  const links = value.split("|").map((part) => part.trim()).filter(Boolean);
  const usable = links.flatMap((link) => {
    try {
      const url = new URL(link);
      if (url.protocol !== "https:" || link.length > 500) return [];
      return [url.toString()];
    } catch {
      return [];
    }
  });
  return { front: usable[0] ?? "", back: usable[1] ?? "" };
}

function slab(graderValue: string, gradeValue: string, conditionValue: string) {
  const combined = `${graderValue} ${gradeValue}`.trim() || conditionValue;
  const match = combined.match(/\b(PSA|BGS|CGC|ACE|SGC|TAG)\s*(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4|3|2|1)\b/i);
  if (!match) return null;
  const grader = match[1].toUpperCase();
  const grade = match[2];
  if (!GRADERS.includes(grader as (typeof GRADERS)[number]) || !GRADES.includes(grade as (typeof GRADES)[number])) return null;
  return { grader, grade };
}

export function parseBatchCsv(text: string, fallbackGame: string, fallbackLanguage = "English") {
  const gameDefault = mapGame(fallbackGame, "Pokémon");
  const table = parseCsv(text);
  let headerIndex = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(table.length, 30); i += 1) {
    const candidate = table[i].map(normHeader);
    if (columns(candidate, NAME_KEYS).length && columns(candidate, PRICE_KEYS).length) {
      headerIndex = i;
      headers = candidate;
      break;
    }
  }
  if (headerIndex < 0) {
    return { cards: [] as BatchCard[], issues: [{ row: 1, message: "This file needs a header row with a card name and a price. Export Basic, eBay, TCGplayer, Shopify and Whatnot files all have one." }] };
  }

  const nameAt = columns(headers, NAME_KEYS);
  const gameAt = columns(headers, GAME_KEYS);
  const setAt = columns(headers, SET_KEYS);
  const numberAt = columns(headers, NUMBER_KEYS);
  const rarityAt = columns(headers, RARITY_KEYS);
  const conditionAt = columns(headers, CONDITION_KEYS);
  const priceAt = columns(headers, PRICE_KEYS);
  const stockAt = columns(headers, STOCK_KEYS);
  const imageAt = columns(headers, IMAGE_KEYS);
  const backAt = columns(headers, BACK_KEYS);
  const graderAt = columns(headers, GRADER_KEYS);
  const gradeAt = columns(headers, GRADE_KEYS);
  const certAt = columns(headers, CERT_KEYS);
  const languageAt = columns(headers, LANGUAGE_KEYS);
  const cards: BatchCard[] = [];
  const issues: BatchIssue[] = [];

  if (!imageAt.length && !backAt.length) {
    return { cards, issues: [{ row: headerIndex + 1, message: "This file has no photo column. Use Card Uploader’s Export Basic, eBay or Shopify file, which includes the photo link." }] };
  }

  for (let i = headerIndex + 1; i < table.length; i += 1) {
    const row = table[i];
    const line = i + 1;
    const name = firstFilled(row, nameAt);
    const photos = photoLink(firstFilled(row, imageAt));
    const extraBack = photoLink(firstFilled(row, backAt)).front;
    if (!name && (photos.front || extraBack) && cards.length) {
      const previous = cards[cards.length - 1];
      if (!previous.back_image_url) previous.back_image_url = photos.front || extraBack;
      continue;
    }
    if (!name) continue;
    const pence = pricePence(firstFilled(row, priceAt));
    if (!pence) {
      issues.push({ row: line, message: `${name} has no price in pounds.` });
      continue;
    }
    const front = photos.front;
    if (!front) {
      issues.push({ row: line, message: `${name} has no front photo link.` });
      continue;
    }
    const rawStock = firstFilled(row, stockAt);
    let stock = rawStock ? Math.floor(Number(rawStock)) : 1;
    if (!Number.isFinite(stock) || stock < 1) {
      issues.push({ row: line, message: `${name} has no quantity.` });
      continue;
    }
    if (stock > 99) {
      stock = 99;
      issues.push({ row: line, message: `${name} was listed with 99 copies. A listing holds at most 99.` });
    }
    const graded = slab(firstFilled(row, graderAt), firstFilled(row, gradeAt), firstFilled(row, conditionAt));
    const condition = graded ? gradeLabel(graded.grader, graded.grade) : mapCondition(firstFilled(row, conditionAt)) || (!conditionAt.length ? "Near Mint" : "");
    if (!condition) {
      issues.push({ row: line, message: `${name} has a condition this shop does not use.` });
      continue;
    }
    const cert = firstFilled(row, certAt).replace(/\s/g, "");
    cards.push({
      name: name.slice(0, 120),
      game: mapGame(firstFilled(row, gameAt), gameDefault),
      set_name: (firstFilled(row, setAt) || "Unknown set").slice(0, 120),
      card_number: firstFilled(row, numberAt).slice(0, 40),
      rarity: firstFilled(row, rarityAt).slice(0, 40),
      condition,
      grader: graded?.grader ?? null,
      grade: graded?.grade ?? null,
      cert_number: cert && /^[A-Za-z0-9-]{4,24}$/.test(cert) ? cert : null,
      price_pence: pence,
      stock: graded ? 1 : stock,
      image_url: front,
      back_image_url: extraBack || photos.back || null,
      language: mapLanguage(firstFilled(row, languageAt), firstFilled(row, gameAt), gameDefault, fallbackLanguage)
    });
  }

  return { cards, issues };
}
