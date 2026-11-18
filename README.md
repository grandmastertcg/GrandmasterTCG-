# GrandmasterTCG custom shop

A custom Next.js + Supabase + Stripe starter for a UK trading-card singles shop.

## Included
- Responsive GrandmasterTCG storefront (black/gold)
- Search and game filters
- Product catalogue API backed by Supabase
- SQL schema for products, orders and order items
- Stripe Checkout session endpoint restricted to GB shipping
- `.env.example` with server-side configuration

## Important launch status
This is a deployable application starter, **not yet a live store**. It does not accept real orders until you create and connect the required accounts, configure secrets, deploy it, configure the Stripe webhook/order fulfilment, add real stock and test the complete checkout. Demo cards are display examples and are deliberately blocked from checkout.

## Requirements
- Node.js 20+
- Supabase project
- Stripe account
- Hosting account that supports Next.js (e.g. Vercel)

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Create a Supabase project and run `supabase/schema.sql` in its SQL editor.
3. Fill in the Supabase URL, anon key and service role key in `.env.local`. Keep the service role key secret.
4. Create a Stripe account, use test mode first, and add the secret key.
5. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
6. Run `npm install` then `npm run dev`.

## Before launch — essential remaining work
- Implement authenticated admin login and product CRUD (not included in this starter).
- Add Stripe webhook verification and transactional stock decrement/order creation. Do not mark orders paid from a browser redirect.
- Add image upload storage and product image management.
- Add shipping prices, returns, privacy, terms, contact details and business information.
- Configure domain DNS and HTTPS at your registrar/host.
- Test successful, failed and refunded payments, stock contention, order emails and shipping.
- Replace demo data with actual cards and accurate condition/photos.

## Security
Never commit `.env.local`. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` to the browser. Use Stripe webhooks as the source of truth for payment status. Add authenticated admin routes before allowing product edits.
