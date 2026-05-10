-- ═══════════════════════════════════════════════════════════════════════════
-- Antigravity — Supabase Schema
-- Supabase SQL Editor'da bir kez çalıştır.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tables ────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default '',
  email text default '',
  website text default '',
  logo text default '',
  account_type text not null default 'brand',
  phone text not null default '',
  contact_name text not null default '',
  job_title text not null default '',
  primary_category text not null default '',
  office text not null default '',
  created_at timestamptz default now()
);

create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  brand_id uuid references public.profiles(id) on delete cascade,
  brand_name text not null default '',
  name text not null default '',
  sku text default '',
  category text default '',
  description text default '',
  technical jsonb default '{}',
  spec text default '',
  image text default '',
  files jsonb default '{}',
  has_pdf boolean default false,
  has_cad boolean default false,
  status text default 'draft' check (status in ('draft', 'published')),
  views integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  brand_id uuid references public.profiles(id) on delete cascade,
  brand_name text not null default '',
  title text not null default '',
  location text not null default '',
  architect text not null default '',
  year text not null default '',
  description text not null default '',
  image text not null default '',
  materials jsonb default '[]',
  status text default 'published' check (status in ('draft', 'published')),
  created_at timestamptz default now()
);

create table if not exists public.visits (
  id uuid default gen_random_uuid() primary key,
  visitor_id text,
  page text,
  referrer text,
  city text,
  region text,
  country text,
  ip text,
  ts bigint,
  user_id uuid references auth.users(id) on delete set null,
  visitor_kind text default 'anonymous',
  display_name text default '',
  created_at timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.projects enable row level security;
alter table public.visits enable row level security;

-- Profiles: herkese okunur, sadece sahibi yazar
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles
  for select using (true);

drop policy if exists "profiles_own_write" on public.profiles;
create policy "profiles_own_write" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Products: herkese okunur, marka kendi ürünlerini yönetir
drop policy if exists "products_all_read" on public.products;
create policy "products_all_read" on public.products
  for select using (true);

drop policy if exists "products_own_write" on public.products;
create policy "products_own_write" on public.products
  for all using (auth.uid() = brand_id) with check (auth.uid() = brand_id);

-- Projects: yayındaki projeler herkese okunur, marka kendi projelerini yönetir
drop policy if exists "projects_public_read" on public.projects;
create policy "projects_public_read" on public.projects
  for select using (status = 'published' or auth.uid() = brand_id);

drop policy if exists "projects_own_write" on public.projects;
create policy "projects_own_write" on public.projects
  for all using (auth.uid() = brand_id) with check (auth.uid() = brand_id);

-- Visits: herkes ekler, sadece admin okur
drop policy if exists "visits_insert" on public.visits;
create policy "visits_insert" on public.visits
  for insert with check (true);

drop policy if exists "visits_admin_read" on public.visits;
create policy "visits_admin_read" on public.visits
  for select using (auth.email() = 'onatderindere@icloud.com');

-- ── Migration: visits — kimlik alanları (bir kez çalıştır) ─────────────────

alter table public.visits add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.visits add column if not exists visitor_kind text default 'anonymous';
alter table public.visits add column if not exists display_name text default '';
update public.visits set visitor_kind = 'anonymous' where visitor_kind is null;

-- Giriş yapan kullanıcıyı ziyaret satırına yazar (JWT varsa)
create or replace function public.visits_set_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
  acc text;
  pname text;
  pemail text;
  uemail text;
begin
  uid := auth.uid();
  new.user_id := uid;

  if uid is null then
    new.visitor_kind := 'anonymous';
    new.display_name := '';
    return new;
  end if;

  select account_type, name, email into acc, pname, pemail
  from public.profiles
  where id = uid;

  if found then
    new.visitor_kind := coalesce(nullif(trim(acc), ''), 'brand');
    new.display_name := coalesce(nullif(trim(pname), ''), nullif(trim(pemail), ''), split_part(pemail, '@', 1), '');
  else
    select au.email into uemail from auth.users au where au.id = uid;
    new.visitor_kind := 'member';
    new.display_name := coalesce(nullif(trim(uemail), ''), '');
  end if;

  return new;
end;
$$;

drop trigger if exists visits_set_actor_trg on public.visits;
create trigger visits_set_actor_trg
  before insert on public.visits
  for each row execute function public.visits_set_actor();

-- ── Migration: mevcut projede profiles genişletme (bir kez çalıştır) ───────

alter table public.profiles add column if not exists account_type text default 'brand';
alter table public.profiles add column if not exists phone text default '';
alter table public.profiles add column if not exists contact_name text default '';
alter table public.profiles add column if not exists job_title text default '';
alter table public.profiles add column if not exists primary_category text default '';
alter table public.profiles add column if not exists office text default '';
update public.profiles set account_type = coalesce(nullif(trim(account_type), ''), 'brand') where account_type is null or trim(account_type) = '';

-- ── Migration: marka projeleri tablosu (bir kez çalıştır) ─────────────────

alter table public.projects add column if not exists brand_id uuid references public.profiles(id) on delete cascade;
alter table public.projects add column if not exists brand_name text not null default '';
alter table public.projects add column if not exists title text not null default '';
alter table public.projects add column if not exists location text not null default '';
alter table public.projects add column if not exists architect text not null default '';
alter table public.projects add column if not exists year text not null default '';
alter table public.projects add column if not exists description text not null default '';
alter table public.projects add column if not exists image text not null default '';
alter table public.projects add column if not exists materials jsonb default '[]';
alter table public.projects add column if not exists status text default 'published';
alter table public.projects add column if not exists created_at timestamptz default now();

create index if not exists idx_projects_brand_created on public.projects(brand_id, created_at desc);
create index if not exists idx_projects_status_created on public.projects(status, created_at desc);

-- ── Auto-profile on signup trigger ───────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, name, email, website, account_type,
    phone, contact_name, job_title, primary_category, office
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'website', ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'account_type'), ''), 'brand'),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'contact_name', ''),
    coalesce(new.raw_user_meta_data->>'job_title', ''),
    coalesce(new.raw_user_meta_data->>'primary_category', ''),
    coalesce(new.raw_user_meta_data->>'office', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── View increment RPC (bypasses RLS for anonymous visitors) ─────────────

create or replace function public.increment_product_view(product_id uuid)
returns void as $$
  update public.products set views = views + 1 where id = product_id;
$$ language sql security definer;

-- ── Marka paneli analitiği: ürün tıklama logu + favoriler ─────────────────

create table if not exists public.product_view_log (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  visitor_id text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_product_view_log_pid_created on public.product_view_log(product_id, created_at desc);

alter table public.product_view_log enable row level security;

drop policy if exists "pvl_insert_any" on public.product_view_log;
create policy "pvl_insert_any" on public.product_view_log
  for insert with check (exists (select 1 from public.products p where p.id = product_id));

drop policy if exists "pvl_select_brand" on public.product_view_log;
create policy "pvl_select_brand" on public.product_view_log
  for select using (
    exists (select 1 from public.products p where p.id = product_view_log.product_id and p.brand_id = auth.uid())
  );

create table if not exists public.product_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, product_id)
);
create index if not exists idx_product_favorites_pid on public.product_favorites(product_id);

alter table public.product_favorites enable row level security;

drop policy if exists "pf_insert_own" on public.product_favorites;
create policy "pf_insert_own" on public.product_favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "pf_delete_own" on public.product_favorites;
create policy "pf_delete_own" on public.product_favorites
  for delete using (auth.uid() = user_id);

drop policy if exists "pf_select_own_or_brand" on public.product_favorites;
create policy "pf_select_own_or_brand" on public.product_favorites
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.products p where p.id = product_favorites.product_id and p.brand_id = auth.uid())
  );

-- ── Storage bucket'ları ve dosya erişim kuralları ─────────────────────────
-- Ürün görselleri/dokümanları public okunur; markalar sadece kendi klasörlerine
-- yükleme yapar. Kod dosyaları brand_id/benzersiz-dosya-adı şeklinde kaydeder.

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('product-documents', 'product-documents', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists "product_documents_public_read" on storage.objects;
create policy "product_documents_public_read" on storage.objects
  for select using (bucket_id = 'product-documents');

drop policy if exists "product_images_brand_upload" on storage.objects;
create policy "product_images_brand_upload" on storage.objects
  for insert with check (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "product_documents_brand_upload" on storage.objects;
create policy "product_documents_brand_upload" on storage.objects
  for insert with check (
    bucket_id = 'product-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "product_images_brand_update" on storage.objects;
create policy "product_images_brand_update" on storage.objects
  for update using (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "product_documents_brand_update" on storage.objects;
create policy "product_documents_brand_update" on storage.objects
  for update using (
    bucket_id = 'product-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  ) with check (
    bucket_id = 'product-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "product_images_brand_delete" on storage.objects;
create policy "product_images_brand_delete" on storage.objects
  for delete using (
    bucket_id = 'product-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "product_documents_brand_delete" on storage.objects;
create policy "product_documents_brand_delete" on storage.objects
  for delete using (
    bucket_id = 'product-documents'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ── Admin kullanıcısı ─────────────────────────────────────────────────────
-- Supabase Dashboard → Authentication → Users → Add User bölümünden oluştur:
--   Email:    onatderindere@icloud.com
--   Password: (Dashboard’da belirlediğin şifre)
-- Bu SQL ile oluşturamazsın — dashboard üzerinden yapılmalı.
