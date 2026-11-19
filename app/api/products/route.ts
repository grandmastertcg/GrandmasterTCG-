import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin()
      .from("products")
      .select("id,name,game,set_name,condition,price_pence,image_url,stock")
      .eq("active", true)
      .gt("stock", 0)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ products: data ?? [] });
  } catch (error) {
    console.error("SUPABASE PRODUCTS ERROR:", error);

    return NextResponse.json(
      { products: [] },
      { status: 503 }
    );
  }
}
