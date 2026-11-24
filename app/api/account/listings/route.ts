import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sellerName, userFromRequest } from "@/lib/require-user";
import { SALE_CONDITIONS, SALE_GAMES } from "@/lib/catalog";
import { GRADERS, GRADES, gradeLabel } from "@/lib/grades";
import { ownCardPhoto } from "@/lib/photos";

const columns = "id,name,game,set_name,card_number,rarity,condition,price_pence,stock,image_url,active,created_at";

export async function GET(request: NextRequest) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const { data, error } = await supabaseAdmin()
      .from("products")
      .select(columns)
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ listings: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Listings could not be loaded.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const game = String(body.game ?? "").trim();
    const setName = String(body.set_name ?? "").trim();
    const cardNumber = String(body.card_number ?? "").trim();
    const rarity = String(body.rarity ?? "").trim();
    const price = String(body.price ?? "").trim();
    let stock = Number(body.stock);
    const graded = Boolean(body.graded);
    let condition = String(body.condition ?? "").trim();
    let grader: string | null = null;
    let grade: string | null = null;
    let certNumber: string | null = null;

    if (!name || name.length > 120 || !setName || setName.length > 120) {
      return NextResponse.json({ error: "Enter the card name and set." }, { status: 400 });
    }
    if (!SALE_GAMES.includes(game as (typeof SALE_GAMES)[number])) {
      return NextResponse.json({ error: "Choose a supported game." }, { status: 400 });
    }
    if (graded) {
      grader = String(body.grader ?? "").trim();
      grade = String(body.grade ?? "").trim();
      certNumber = String(body.cert_number ?? "").trim() || null;
      if (!GRADERS.includes(grader as (typeof GRADERS)[number]) || !GRADES.includes(grade as (typeof GRADES)[number])) {
        return NextResponse.json({ error: "Choose the grading company and grade." }, { status: 400 });
      }
      if (certNumber && !/^[A-Za-z0-9-]{4,24}$/.test(certNumber)) {
        return NextResponse.json({ error: "Enter the certificate number from the slab." }, { status: 400 });
      }
      condition = gradeLabel(grader, grade);
      stock = 1;
    } else if (!SALE_CONDITIONS.includes(condition as (typeof SALE_CONDITIONS)[number])) {
      return NextResponse.json({ error: "Choose a condition." }, { status: 400 });
    }
    const imageUrl = String(body.image_url ?? "").trim();
    const backImageUrl = String(body.back_image_url ?? "").trim();
    if (!imageUrl || !backImageUrl || !ownCardPhoto(imageUrl) || !ownCardPhoto(backImageUrl)) {
      return NextResponse.json({ error: "Add a photo of the front and the back." }, { status: 400 });
    }
    if (cardNumber.length > 40 || rarity.length > 40) {
      return NextResponse.json({ error: "Card number or rarity is too long." }, { status: 400 });
    }
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(price)) {
      return NextResponse.json({ error: "Enter a valid price in pounds." }, { status: 400 });
    }
    const [pounds, pennies = ""] = price.split(".");
    const pricePence = Number(pounds) * 100 + Number(pennies.padEnd(2, "0"));
    if (pricePence <= 0) {
      return NextResponse.json({ error: "Price must be greater than zero." }, { status: 400 });
    }
    if (!Number.isInteger(stock) || stock < 1 || stock > 99) {
      return NextResponse.json({ error: "Stock must be between 1 and 99." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin()
      .from("products")
      .insert({
        name,
        game,
        set_name: setName,
        card_number: cardNumber,
        rarity,
        condition,
        grader,
        grade,
        cert_number: certNumber,
        price_pence: pricePence,
        stock,
        image_url: imageUrl || null,
        back_image_url: backImageUrl || null,
        active: true,
        seller_id: user.id,
        seller_name: sellerName(user)
      })
      .select("id")
      .single();

    if (error) {
      const missingColumn = /seller_id|seller_name|grader|grade|cert_number|back_image_url/.test(error.message);
      return NextResponse.json(
        { error: missingColumn ? "Card photos and grades are not enabled in the database yet." : "Unable to save this listing." },
        { status: 500 }
      );
    }

    return NextResponse.json({ listing: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save this listing.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
