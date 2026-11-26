import { NextRequest, NextResponse } from "next/server";
import { languagesFor, saleCondition } from "@/lib/catalog";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return NextResponse.json(
        { error: "Server configuration missing." },
        { status: 500 }
      );
    }

    const supabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Check the logged-in user's access token.
    const header = request.headers.get("authorization");

    if (!header?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Please sign in." },
        { status: 401 }
      );
    }

    const token = header.slice(7);

    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: "Invalid login session." },
        { status: 401 }
      );
    }

    // Only users in admin_users can add products.
    const { data: admin, error: adminError } =
      await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

    if (adminError) {
      return NextResponse.json(
        { error: "Admin verification failed." },
        { status: 500 }
      );
    }

    if (!admin) {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const fields = [
      "name",
      "game",
      "set_name",
      "card_number",
      "rarity",
      "condition",
      "price",
      "image_url",
      "back_image_url",
    ];

    for (const field of fields) {
      if (
        typeof body[field] !== "string" ||
        body[field].length > 500
      ) {
        return NextResponse.json(
          { error: `Invalid ${field}.` },
          { status: 400 }
        );
      }
    }

    const name = body.name.trim();
    const game = body.game.trim();
    const setName = body.set_name.trim();
    const condition = saleCondition(body.condition.trim());
    if (!condition) {
      return NextResponse.json({ error: "Choose a condition." }, { status: 400 });
    }
    const price = body.price.trim();

    if (!name || !game || !setName || !condition) {
      return NextResponse.json(
        { error: "Complete all required card details." },
        { status: 400 }
      );
    }

    // Accept GBP prices with at most 2 decimal places.
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(price)) {
      return NextResponse.json(
        { error: "Enter a valid price in pounds." },
        { status: 400 }
      );
    }

    const [pounds, pennies = ""] = price.split(".");
    const pricePence =
      Number(pounds) * 100 +
      Number(pennies.padEnd(2, "0"));

    if (pricePence <= 0) {
      return NextResponse.json(
        { error: "Price must be greater than zero." },
        { status: 400 }
      );
    }

    if (
      !Number.isSafeInteger(body.stock) ||
      body.stock < 0 ||
      body.stock > 100000
    ) {
      return NextResponse.json(
        { error: "Enter a valid stock quantity." },
        { status: 400 }
      );
    }

    const imageUrl = body.image_url.trim();
    const backImageUrl = body.back_image_url.trim();

    if (!imageUrl || !backImageUrl) {
      return NextResponse.json(
        { error: "Add a front photo URL and a back photo URL." },
        { status: 400 }
      );
    }

    for (const photoUrl of [imageUrl, backImageUrl]) {
      try {
        const parsed = new URL(photoUrl);
        if (
          parsed.protocol !== "https:" &&
          parsed.protocol !== "http:"
        ) {
          throw new Error("Invalid protocol");
        }
      } catch {
        return NextResponse.json(
          { error: "Enter a valid front and back photo URL." },
          { status: 400 }
        );
      }
    }

    // Save the trading card in Supabase.
    const { data: product, error: insertError } =
      await supabase
        .from("products")
        .insert({
          name,
          game,
          set_name: setName,
          card_number: body.card_number.trim(),
          rarity: body.rarity.trim(),
          condition,
          price_pence: pricePence,
          stock: body.stock,
          image_url: imageUrl,
          back_image_url: backImageUrl,
          seller_business: true,
          language: languagesFor(game).find((language) => language === body.language) ?? languagesFor(game)[0] ?? null,
        })
        .select("id")
        .single();

    if (insertError && /seller_business|language/.test(insertError.message)) {
      const retry = await supabase.from("products").insert({
        name,
        game,
        set_name: setName,
        card_number: body.card_number.trim(),
        rarity: body.rarity.trim(),
        condition,
        price_pence: pricePence,
        stock: body.stock,
        image_url: imageUrl,
        back_image_url: backImageUrl
      }).select("id").single();
      if (retry.error || !retry.data) {
        return NextResponse.json({ error: "Unable to save product." }, { status: 500 });
      }
      return NextResponse.json({ success: true, product: retry.data }, { status: 201 });
    }

    if (insertError) {
      console.error("Product insert failed:", {
        code: insertError.code,
        message: insertError.message,
      });

      return NextResponse.json(
        { error: "Unable to save product." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, product },
      { status: 201 }
    );
  } catch (error) {
    console.error("Add product request failed:", error);

    return NextResponse.json(
      { error: "Unable to process request." },
      { status: 500 }
    );
  }
}
