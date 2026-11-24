-- Record a courier delivery scan, and a refund the shop has sent.
alter table public.shipments add column if not exists delivered_at timestamptz;
alter table public.shipments add column if not exists refunded_at timestamptz;
alter table public.shipments add column if not exists stripe_refund_id text;
alter table public.shipments add column if not exists tracking_status text;
alter table public.shipments add column if not exists tracking_events jsonb;
alter table public.shipments add column if not exists tracked_at timestamptz;
