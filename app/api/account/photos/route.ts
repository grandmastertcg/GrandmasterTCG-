import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { userFromRequest } from "@/lib/require-user";
import { photoKind } from "@/lib/photos";

export async function POST(request: NextRequest) {
  const user = await userFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a photo of the card." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = photoKind(bytes, file.type);
  if (!kind) {
    return NextResponse.json({ error: "Use a JPG, PNG or WebP photo under 4 MB." }, { status: 400 });
  }

  const path = `${user.id}/${crypto.randomUUID()}.${kind}`;
  const { error } = await supabaseAdmin().storage.from("card-photos").upload(path, bytes, {
    contentType: file.type,
    upsert: false
  });
  if (error) {
    const missing = /bucket|not found/i.test(error.message);
    return NextResponse.json(
      { error: missing ? "Card photos are not ready yet." : "The photo could not be saved." },
      { status: 500 }
    );
  }

  const { data } = supabaseAdmin().storage.from("card-photos").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
