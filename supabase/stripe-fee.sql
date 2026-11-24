alter table public.orders add column if not exists stripe_fee_pence integer;
alter table public.shipments add column if not exists stripe_fee_pence integer;
