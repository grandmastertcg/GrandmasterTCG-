-- Let sellers upload a card photo and list a graded copy.
insert into storage.buckets (id, name, public)
values ('card-photos', 'card-photos', true)
on conflict (id) do update set public = excluded.public;

alter table public.products drop constraint if exists products_condition_check;
alter table public.products add column if not exists grader text;
alter table public.products add column if not exists grade text;
alter table public.products add column if not exists cert_number text;

drop policy if exists "Public card photos" on storage.objects;
create policy "Public card photos" on storage.objects for select using (bucket_id = 'card-photos');
