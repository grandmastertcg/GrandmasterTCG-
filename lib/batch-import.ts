import type { BatchCard } from "@/lib/batch-csv";
import { supabaseAdmin } from "@/lib/supabase";

const LIMIT = 200;

export async function saveBatchListings(cards: BatchCard[], owner: { userId: string | null; sellerName: string | null; business: boolean }) {
  if (!cards.length) return { saved: 0, error: "No cards in that file could be listed." };
  if (cards.length > LIMIT) return { saved: 0, error: `A batch can list ${LIMIT} cards. This file has ${cards.length}. Split it and upload the rest.` };

  const db = supabaseAdmin();
  let saved = 0;
  for (let index = 0; index < cards.length; index += 50) {
    const chunk = cards.slice(index, index + 50).map((card) => ({
      name: card.name,
      game: card.game,
      set_name: card.set_name,
      card_number: card.card_number,
      rarity: card.rarity,
      condition: card.condition,
      grader: card.grader,
      grade: card.grade,
      cert_number: card.cert_number,
      price_pence: card.price_pence,
      stock: card.stock,
      image_url: card.image_url,
      back_image_url: card.back_image_url,
      active: true,
      seller_id: owner.userId,
      seller_name: owner.sellerName,
      seller_business: owner.business,
      language: card.language
    }));
    let { error } = await db.from("products").insert(chunk);
    if (error && /seller_business|grader|grade|cert_number|back_image_url|seller_id|seller_name|language/.test(error.message)) {
      const plain = chunk.map((card) => ({
        name: card.name,
        game: card.game,
        set_name: card.set_name,
        card_number: card.card_number,
        rarity: card.rarity,
        condition: card.condition,
        price_pence: card.price_pence,
        stock: card.stock,
        image_url: card.image_url,
        active: true,
        seller_id: owner.userId,
        seller_name: owner.sellerName
      }));
      const retry = await db.from("products").insert(plain);
      error = retry.error;
    }
    if (error) return { saved, error: "Some cards could not be saved. Upload the rest of the file again after checking the skipped rows." };
    saved += chunk.length;
  }
  return { saved, error: "" };
}
