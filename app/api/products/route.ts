import { NextResponse } from "next/server";
import { conditionLabel } from "@/lib/catalog";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const db = supabaseAdmin();
    const withSeller = await db.from("products").select("id,name,game,set_name,card_number,rarity,condition,grader,grade,cert_number,price_pence,image_url,back_image_url,stock,description,seller_name,seller_business,language").eq("active", true).gt("stock", 0).order("created_at", { ascending: false });
    if (withSeller.error && /seller_name|seller_business|grader|grade|cert_number|back_image_url|language/.test(withSeller.error.message)) {
      const fallback = await db.from("products").select("id,name,game,set_name,card_number,rarity,condition,price_pence,image_url,stock,description").eq("active", true).gt("stock", 0).order("created_at", { ascending: false });
      if (fallback.error) throw fallback.error;
      return NextResponse.json({ products: (fallback.data ?? []).map((product) => ({ ...product, condition: conditionLabel(product.condition) })) });
    }
    if (withSeller.error) throw withSeller.error;

    return NextResponse.json({ products: (withSeller.data ?? []).map((product) => ({ ...product, condition: conditionLabel(product.condition) })) });
  } catch (error) {
    console.error("SUPABASE PRODUCTS ERROR:", error);

    return NextResponse.json(
      { products: [] },
      { status: 503 }
    );
  }
}
