create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game text not null check (game in ('Pokémon','Yu-Gi-Oh!','One Piece','Magic: The Gathering','Lorcana','Other')),
  set_name text,
  card_number text,
  rarity text,
  condition text not null check (condition in ('Near Mint','Excellent','Good','Played','Poor')),
  price_pence integer not null check (price_pence >= 0),
  stock integer not null default 1 check (stock >= 0),
  image_url text,
  description text,
  active boolean not null default true,
  seller_id uuid,
  seller_name text,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
-- Public product reads are mediated by the server API using the service role key.
-- Do not expose SUPABASE_SERVICE_ROLE_KEY to browser code.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text unique not null,
  customer_email text,
  total_pence integer not null,
  status text not null default 'paid',
  shipping_name text,
  shipping_address jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_pence integer not null
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
