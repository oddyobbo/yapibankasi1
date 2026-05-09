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
  for select using (auth.email() = 'onatderindere@gmail.com');

-- ── Auto-profile on signup trigger ───────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, email, website)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'website', '')
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
--   Email:    onatderindere@gmail.com
--   Password: (Dashboard’da belirlediğin şifre)
-- Bu SQL ile oluşturamazsın — dashboard üzerinden yapılmalı.
