alter table public.products add column if not exists postage_size text not null default 'large-letter';
