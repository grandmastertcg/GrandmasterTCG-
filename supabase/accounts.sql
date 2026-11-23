-- Run this once in the Supabase SQL editor so members can sell cards.
alter table public.products add column if not exists seller_id uuid;
alter table public.products add column if not exists seller_name text;
