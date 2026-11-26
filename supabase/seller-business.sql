-- Say whether a member is selling as a private individual or as a business.
alter table public.products add column if not exists seller_business boolean not null default false;
