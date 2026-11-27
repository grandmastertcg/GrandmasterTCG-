alter table public.products add column if not exists bundle_size integer not null default 1 check (bundle_size between 1 and 40);
