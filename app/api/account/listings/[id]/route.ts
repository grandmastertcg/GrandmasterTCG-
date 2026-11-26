import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { userFromRequest } from "@/lib/require-user";
import { languagesFor, saleCondition } from "@/lib/catalog";

function pricePence(price: string) {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(price)) return null;
  const [pounds, pennies = ""] = price.split(".");
  const pence = Number(pounds) * 100 + Number(pennies.padEnd(2, "0"));
  return pence > 0 ? pence : null;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Unknown listing." }, { status: 400 });
    }

    const body = await request.json();
    const pence = pricePence(String(body.price ?? "").trim());
    if (pence == null) return NextResponse.json({ error: "Enter a valid price in pounds." }, { status: 400 });

    const db = supabaseAdmin();
    const loaded = await db.from("products").select("id,active,condition,grader,stock,game").eq("id", id).eq("seller_id", user.id).maybeSingle();
    let existing = loaded.data;
    if (loaded.error && /grader/.test(loaded.error.message)) {
      const fallback = await db.from("products").select("id,active,condition,stock").eq("id", id).eq("seller_id", user.id).maybeSingle();
      if (fallback.error) throw fallback.error;
      existing = fallback.data ? { ...fallback.data, grader: null, game: "" } : null;
    } else if (loaded.error) {
      throw loaded.error;
    }
    if (!existing) return NextResponse.json({ error: "That listing is not yours." }, { status: 404 });
    if (!existing.active) return NextResponse.json({ error: "This listing has been removed." }, { status: 400 });

    const graded = Boolean(existing.grader) || !saleCondition(existing.condition);
    const update: { price_pence: number; stock?: number; condition?: string; seller_business?: boolean; language?: string } = { price_pence: pence };
    if (body.seller_business === "business" || body.seller_business === "private") {
      update.seller_business = body.seller_business === "business";
    }
    const languageOptions = languagesFor(String(existing.game ?? ""));
    if (languageOptions.length > 1 && languageOptions.includes(String(body.language ?? ""))) {
      update.language = String(body.language);
    }
    if (graded) {
      update.stock = 1;
    } else {
      const stock = Number(body.stock);
      const condition = saleCondition(String(body.condition ?? ""));
      if (!condition) {
        return NextResponse.json({ error: "Choose a condition." }, { status: 400 });
      }
      if (!Number.isInteger(stock) || stock < 1 || stock > 99) {
        return NextResponse.json({ error: "Stock must be between 1 and 99." }, { status: 400 });
      }
      update.stock = stock;
      update.condition = condition;
    }

    let saved = await db.from("products").update(update).eq("id", id).eq("seller_id", user.id).select("id").maybeSingle();
    if (saved.error && /seller_business|language/.test(saved.error.message)) {
      const retryUpdate = { ...update };
      if (/seller_business/.test(saved.error.message)) delete retryUpdate.seller_business;
      if (/language/.test(saved.error.message)) delete retryUpdate.language;
      saved = await db.from("products").update(retryUpdate).eq("id", id).eq("seller_id", user.id).select("id").maybeSingle();
    }
    if (saved.error) throw saved.error;
    const data = saved.data;
    if (!data) return NextResponse.json({ error: "That listing is not yours." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update this listing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const { id } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Unknown listing." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin()
      .from("products")
      .update({ active: false, stock: 0 })
      .eq("id", id)
      .eq("seller_id", user.id)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "That listing is not yours." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove this listing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
