-- Hold seller payouts until the buyer confirms a tracked parcel.
alter table public.orders add column if not exists buyer_id uuid;
alter table public.orders add column if not exists commission_pence integer not null default 0;
alter table public.orders add column if not exists charge_id text;
alter table public.orders add column if not exists stripe_fee_pence integer;
alter table public.orders add column if not exists stock_adjusted boolean not null default false;
alter table public.orders add column if not exists paid_at timestamptz;

alter table public.order_items add column if not exists seller_id uuid;
alter table public.order_items add column if not exists seller_name text;
alter table public.order_items add column if not exists commission_pence integer not null default 0;

create table if not exists public.seller_payout_accounts (
  user_id uuid primary key,
  stripe_account_id text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  seller_key text not null,
  seller_id uuid,
  seller_name text,
  carrier text,
  tracking_number text,
  shipped_at timestamptz,
  received_at timestamptz,
  delivered_at timestamptz,
  refunded_at timestamptz,
  stripe_refund_id text,
  tracking_status text,
  tracking_events jsonb,
  tracked_at timestamptz,
  arrival_asked_at timestamptz,
  hold_kind text,
  hold_reason text,
  hold_at timestamptz,
  released_at timestamptz,
  proceeds_pence integer not null check (proceeds_pence >= 0),
  commission_pence integer not null check (commission_pence >= 0),
  transfer_id text,
  payout_error text,
  stripe_fee_pence integer,
  created_at timestamptz not null default now(),
  unique (order_id, seller_key)
);

alter table public.seller_payout_accounts enable row level security;
alter table public.shipments enable row level security;

grant select, insert, update, delete on table public.shipments to service_role;
grant select, insert, update, delete on table public.seller_payout_accounts to service_role;
