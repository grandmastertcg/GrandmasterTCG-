-- Pay a tracked parcel 14 days after posting unless the buyer confirms it,
-- or opens a dispute or refund request.
alter table public.shipments add column if not exists hold_kind text;
alter table public.shipments add column if not exists hold_reason text;
alter table public.shipments add column if not exists hold_at timestamptz;
alter table public.shipments add column if not exists released_at timestamptz;
