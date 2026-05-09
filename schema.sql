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
  created_at timestamptz default now()
);

-- ── Row Level Security ────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.products enable row level security;
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

-- Visits: herkes ekler, sadece admin okur
drop policy if exists "visits_insert" on public.visits;
create policy "visits_insert" on public.visits
  for insert with check (true);

drop policy if exists "visits_admin_read" on public.visits;
create policy "visits_admin_read" on public.visits
  for select using (auth.email() = 'onatderindere@icloud.com');

-- ── Migration: mevcut projede profiles genişletme (bir kez çalıştır) ───────

alter table public.profiles add column if not exists account_type text default 'brand';
alter table public.profiles add column if not exists phone text default '';
alter table public.profiles add column if not exists contact_name text default '';
alter table public.profiles add column if not exists job_title text default '';
alter table public.profiles add column if not exists primary_category text default '';
alter table public.profiles add column if not exists office text default '';
update public.profiles set account_type = coalesce(nullif(trim(account_type), ''), 'brand') where account_type is null or trim(account_type) = '';

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

-- ── Admin kullanıcısı ─────────────────────────────────────────────────────
-- Supabase Dashboard → Authentication → Users → Add User bölümünden oluştur:
--   Email:    onatderindere@icloud.com
--   Password: (Dashboard’da belirlediğin şifre)
-- Bu SQL ile oluşturamazsın — dashboard üzerinden yapılmalı.
