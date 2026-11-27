import { NextResponse } from "next/server";
import { conditionLabel } from "@/lib/catalog";
import { supabaseAdmin } from "@/lib/supabase";

async function completedParcelCounts(db: ReturnType<typeof supabaseAdmin>) {
  const loaded = await db.from("shipments").select("seller_id,seller_key").is("refunded_at", null).or("received_at.not.is.null,delivered_at.not.is.null,transfer_id.not.is.null,released_at.not.is.null");
  if (loaded.error) return null;
  const counts = new Map<string, number>();
  for (const row of loaded.data ?? []) {
    const key = row.seller_id || (row.seller_key === "shop" ? "shop" : "");
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export async function GET() {
  try {
    const db = supabaseAdmin();
    const listed = "id,name,game,set_name,card_number,rarity,condition,grader,grade,cert_number,price_pence,image_url,back_image_url,stock,description,seller_id,seller_name,seller_business,language";
    const withBundle = await db.from("products").select(`${listed},postage_size,bundle_size`).eq("active", true).gt("stock", 0).order("created_at", { ascending: false });
    const withSeller = withBundle.error && /bundle_size|postage_size/.test(withBundle.error.message)
      ? await db.from("products").select(listed).eq("active", true).gt("stock", 0).order("created_at", { ascending: false })
      : withBundle;
    if (withSeller.error && /seller_id|seller_name|seller_business|grader|grade|cert_number|back_image_url|language/.test(withSeller.error.message)) {
      const fallback = await db.from("products").select("id,name,game,set_name,card_number,rarity,condition,price_pence,image_url,stock,description").eq("active", true).gt("stock", 0).order("created_at", { ascending: false });
      if (fallback.error) throw fallback.error;
      return NextResponse.json({ products: (fallback.data ?? []).map((product) => ({ ...product, condition: conditionLabel(product.condition) })) });
    }
    if (withSeller.error) throw withSeller.error;

    const counts = await completedParcelCounts(db);
    return NextResponse.json({
      products: (withSeller.data ?? []).map((product) => ({
        ...product,
        condition: conditionLabel(product.condition),
        ...(counts ? { completed_parcels: counts.get(("seller_id" in product && product.seller_id) || "shop") ?? 0 } : {})
      }))
    });
  } catch (error) {
    console.error("SUPABASE PRODUCTS ERROR:", error);

    return NextResponse.json(
      { products: [] },
      { status: 503 }
    );
  }
}
