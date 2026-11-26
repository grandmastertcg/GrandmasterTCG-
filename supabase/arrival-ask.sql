-- Ask once when a tracked parcel has no delivery scan, then pay if the buyer stays silent.
alter table public.shipments add column if not exists arrival_asked_at timestamptz;
