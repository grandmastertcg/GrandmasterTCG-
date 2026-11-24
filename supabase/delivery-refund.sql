-- Record a courier delivery scan, and a refund the shop has sent.
alter table public.shipments add column if not exists delivered_at timestamptz;
alter table public.shipments add column if not exists refunded_at timestamptz;
alter table public.shipments add column if not exists stripe_refund_id text;
