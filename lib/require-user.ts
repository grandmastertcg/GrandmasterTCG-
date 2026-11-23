import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";

export async function userFromRequest(request: NextRequest): Promise<User | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(header.slice(7));
  if (error || !data.user) return null;
  return data.user;
}

export function sellerName(user: User) {
  const raw = user.user_metadata?.display_name;
  const name = typeof raw === "string" ? raw.trim() : "";
  if (name) return name.slice(0, 40);
  return (user.email ?? "Seller").split("@")[0].slice(0, 40) || "Seller";
}
