import { NextRequest, NextResponse } from "next/server";
import { parseBatchCsv } from "@/lib/batch-csv";
import { saveBatchListings } from "@/lib/batch-import";
import { sellerName, userFromRequest } from "@/lib/require-user";

export async function POST(request: NextRequest) {
  try {
    const user = await userFromRequest(request);
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    const selling = form.get("seller_business") === "business" ? "business" : form.get("seller_business") === "private" ? "private" : "";
    if (!selling) return NextResponse.json({ error: "Say whether you are a private seller or a business." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose the CSV file from Card Uploader or the other shop." }, { status: 400 });
    if (file.size > 2_000_000) return NextResponse.json({ error: "That file is too large. Split it into smaller CSV files." }, { status: 400 });
    if (!/\.csv$|\.txt$/i.test(file.name)) return NextResponse.json({ error: "Save the batch as a CSV file." }, { status: 400 });

    const parsed = parseBatchCsv(await file.text(), String(form.get("game") ?? "Pokémon"), String(form.get("language") ?? "English"));
    if (!parsed.cards.length) {
      const first = parsed.issues[0]?.message || "No cards in that file could be listed.";
      return NextResponse.json({ error: first, skipped: parsed.issues.slice(0, 20) }, { status: 400 });
    }
    const saved = await saveBatchListings(parsed.cards, {
      userId: user.id,
      sellerName: sellerName(user),
      business: selling === "business"
    });
    if (!saved.saved) return NextResponse.json({ error: saved.error, skipped: parsed.issues.slice(0, 20) }, { status: 400 });
    return NextResponse.json({ saved: saved.saved, skipped: parsed.issues.slice(0, 20), error: saved.error || undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The batch could not be listed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
