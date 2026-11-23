import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { userFromRequest } from "@/lib/require-user";

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
