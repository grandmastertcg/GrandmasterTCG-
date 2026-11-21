import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function verifyAdmin(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return { error: "Server configuration missing", status: 500 };
  }

  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return { error: "Please sign in", status: 401 };
  }

  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const token = header.slice(7);

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { error: "Invalid login", status: 401 };
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (adminError) {
    return { error: "Admin check failed", status: 500 };
  }

  if (!admin) {
    return { error: "Access denied", status: 403 };
  }

  return { supabase };
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const auth = await verifyAdmin(request);

    if (!auth.supabase) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.status ?? 500 }
      );
    }

    const { id } = await context.params;

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      return NextResponse.json(
        { error: "Invalid product ID" },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { error: "Invalid product details" },
        { status: 400 }
      );
    }

    const keys = Object.keys(body);

    if (
      keys.length === 0 ||
      keys.some(
        (key) => !["price_pence", "stock"].includes(key)
      )
    ) {
      return NextResponse.json(
        { error: "Only price and stock can be changed" },
        { status: 400 }
      );
    }

    const updates: {
      price_pence?: number;
      stock?: number;
    } = {};

    if ("price_pence" in body) {
      if (
        !Number.isSafeInteger(body.price_pence) ||
        body.price_pence < 1 ||
        body.price_pence > 999999999
      ) {
        return NextResponse.json(
          { error: "Invalid price in pence" },
          { status: 400 }
        );
      }

      updates.price_pence = body.price_pence;
    }

    if ("stock" in body) {
      if (
        !Number.isSafeInteger(body.stock) ||
        body.stock < 0 ||
        body.stock > 100000
      ) {
        return NextResponse.json(
          { error: "Invalid stock quantity" },
          { status: 400 }
        );
      }

      updates.stock = body.stock;
    }

    const { data: product, error } = await auth.supabase
      .from("products")
      .update(updates)
      .eq("id", id)
      .select("id, name, price_pence, stock")
      .maybeSingle();

    if (error) {
      console.error("Product update failed:", error.message);

      return NextResponse.json(
        { error: "Unable to update product" },
        { status: 500 }
      );
    }

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Product update error:", error);

    return NextResponse.json(
      { error: "Unable to process request" },
      { status: 500 }
    );
  }
}
