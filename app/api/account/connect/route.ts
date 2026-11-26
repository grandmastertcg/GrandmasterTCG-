import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { stripeClient } from "@/lib/stripe";
import { userFromRequest } from "@/lib/require-user";
import { releaseSellerPayouts } from "@/lib/fulfillment";

export async function POST(request: NextRequest) {
  const user = await userFromRequest(request);
  if (!user?.email) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const db = supabaseAdmin();
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!base) return NextResponse.json({ error: "Site URL is not configured." }, { status: 500 });

  const { data: existing } = await db.from("seller_payout_accounts").select("stripe_account_id").eq("user_id", user.id).maybeSingle();
  const stripe = stripeClient();
  let accountId = existing?.stripe_account_id;

  try {
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        email: user.email,
        capabilities: { transfers: { requested: true } },
        business_type: "individual",
        metadata: { user_id: user.id }
      });
      accountId = account.id;
      const { error } = await db.from("seller_payout_accounts").insert({ user_id: user.id, stripe_account_id: accountId });
      if (error) throw new Error(error.message);
    }

    const onboarding = {
      account: accountId,
      refresh_url: `${base}/account?stripe=refresh`,
      return_url: `${base}/account?stripe=return`,
      type: "account_onboarding" as const
    };
    let link;
    if (existing) {
      try {
        link = await stripe.accounts.createLoginLink(accountId);
      } catch {
        link = await stripe.accountLinks.create(onboarding);
      }
    } else {
      link = await stripe.accountLinks.create(onboarding);
    }

    try {
      await releaseSellerPayouts(user.id);
    } catch {
      // Stripe can still be finishing the seller account. The next visit retries the payout.
    }

    return NextResponse.json({ url: link.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe payouts could not be started.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
