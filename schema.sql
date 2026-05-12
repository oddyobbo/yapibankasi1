-- ═══════════════════════════════════════════════════════════════════════════
-- Archilink — Supabase Schema
-- Supabase SQL Editor'da çalıştırılabilir, idempotent migration dosyası.
-- Amaç: katalog verisini filtrelenebilir, sahiplik kontrollü ve ölçeklenebilir
-- domain tablolarına ayırmak. Eski frontend akışları için mevcut kolonlar korunur.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Helpers ───────────────────────────────────────────────────────────────

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select auth.email() = 'onatderindere@icloud.com';
$$;

-- ── Identity / accounts ──────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null default '',
  email text default '',
  website text default '',
  logo text default '',
  account_type text not null default 'brand' check (account_type in ('brand', 'architect', 'admin')),
  phone text not null default '',
  contact_name text not null default '',
  job_title text not null default '',
  primary_category text not null default '',
  office text not null default '',
  architect_profile_type text not null default 'individual' check (architect_profile_type in ('individual', 'office')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.brands (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default '',
  slug text unique,
  description text default '',
  website text default '',
  logo_url text default '',
  country text default '',
  city text default '',
  phone text default '',
  email text default '',
  verified boolean default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(profile_id)
);

create table if not exists public.architects (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null default '',
  office_name text default '',
  profile_type text not null default 'individual' check (profile_type in ('individual', 'office')),
  website text default '',
  city text default '',
  country text default '',
  bio text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(profile_id)
);

-- ── Catalog taxonomy ─────────────────────────────────────────────────────

create table if not exists public.product_categories (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  slug text not null unique,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.product_subcategories (
  id uuid default gen_random_uuid() primary key,
  category_id uuid not null references public.product_categories(id) on delete cascade,
  name text not null,
  slug text not null,
  sort_order integer default 0,
  created_at timestamptz default now(),
  unique(category_id, slug)
);

-- ── Products ──────────────────────────────────────────────────────────────
-- Not: Eski frontend için category, technical, files, has_pdf, has_cad kolonları
-- korunuyor. Yeni yapı filtrelenebilir alanları ayrı kolon/tablolara taşır.

create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  brand_id uuid references public.profiles(id) on delete cascade,
  brand_record_id uuid references public.brands(id) on delete set null,
  brand_name text not null default '',
  brand_logo text default '',
  name text not null default '',
  slug text unique,
  sku text default '',
  category text default '',
  category_id uuid references public.product_categories(id) on delete set null,
  subcategory_id uuid references public.product_subcategories(id) on delete set null,
  summary text default '',
  description text default '',

  -- Structured, filterable technical fields.
  material text default '',
  material_family text default '',
  thickness_mm numeric,
  fire_class text default '',
  color_family text default '',
  usage_area text default '',
  indoor_outdoor text default '' check (indoor_outdoor in ('', 'indoor', 'outdoor', 'both')),
  acoustic_rating text default '',
  acoustic_nrc numeric,
  dimensions text default '',
  certificates text[] default '{}',
  country text default '',
  city text default '',
  company_roles text[] default '{}',

  -- Legacy / flexible fields.
  technical jsonb default '{}',
  spec text default '',
  image text default '',
  thumbnail_url text default '',
  card_image_url text default '',
  gallery_image_url text default '',
  original_image_url text default '',
  files jsonb default '{}',
  has_pdf boolean default false,
  has_cad boolean default false,
  has_bim boolean default false,

  status text default 'draft' check (status in ('draft', 'pending_review', 'published', 'rejected', 'archived')),
  views integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.products add column if not exists brand_record_id uuid references public.brands(id) on delete set null;
alter table public.products add column if not exists brand_logo text default '';
alter table public.products add column if not exists slug text unique;
alter table public.products add column if not exists category_id uuid references public.product_categories(id) on delete set null;
alter table public.products add column if not exists subcategory_id uuid references public.product_subcategories(id) on delete set null;
alter table public.products add column if not exists summary text default '';
alter table public.products add column if not exists material text default '';
alter table public.products add column if not exists material_family text default '';
alter table public.products add column if not exists thickness_mm numeric;
alter table public.products add column if not exists fire_class text default '';
alter table public.products add column if not exists color_family text default '';
alter table public.products add column if not exists usage_area text default '';
alter table public.products add column if not exists indoor_outdoor text default '';
alter table public.products add column if not exists acoustic_rating text default '';
alter table public.products add column if not exists acoustic_nrc numeric;
alter table public.products add column if not exists dimensions text default '';
alter table public.products add column if not exists certificates text[] default '{}';
alter table public.products add column if not exists country text default '';
alter table public.products add column if not exists city text default '';
alter table public.products add column if not exists company_roles text[] default '{}';
alter table public.products add column if not exists has_bim boolean default false;
alter table public.products add column if not exists updated_at timestamptz default now();
alter table public.products add column if not exists thumbnail_url text default '';
alter table public.products add column if not exists card_image_url text default '';
alter table public.products add column if not exists gallery_image_url text default '';
alter table public.products add column if not exists original_image_url text default '';

create index if not exists idx_products_brand_id on public.products(brand_id);
create index if not exists idx_products_slug on public.products(slug);
create index if not exists idx_products_status on public.products(status);
create index if not exists idx_products_created_at on public.products(created_at desc);
create index if not exists idx_products_published_created_at on public.products(status, created_at desc);
create index if not exists idx_products_category on public.products(category_id, subcategory_id);
create index if not exists idx_products_filter_material on public.products(material);
create index if not exists idx_products_filter_usage on public.products(usage_area);
create index if not exists idx_products_filter_color on public.products(color_family);
create index if not exists idx_products_filter_fire on public.products(fire_class);

create table if not exists public.product_images (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  thumbnail_url text default '',
  card_url text default '',
  gallery_url text default '',
  original_url text default '',
  alt text default '',
  sort_order integer default 0,
  is_primary boolean default false,
  width integer,
  height integer,
  created_at timestamptz default now()
);
create index if not exists idx_product_images_product on public.product_images(product_id, sort_order);
alter table public.product_images add column if not exists thumbnail_url text default '';
alter table public.product_images add column if not exists card_url text default '';
alter table public.product_images add column if not exists gallery_url text default '';
alter table public.product_images add column if not exists original_url text default '';

create table if not exists public.product_files (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  file_type text not null check (file_type in ('pdf', 'cad', 'bim', '3d', 'catalog', 'datasheet', 'other')),
  label text not null default '',
  url text not null,
  file_size_bytes bigint,
  sort_order integer default 0,
  created_at timestamptz default now()
);
create index if not exists idx_product_files_product on public.product_files(product_id, file_type);

create table if not exists public.product_specs (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  spec_key text not null,
  label text not null,
  value_text text default '',
  value_number numeric,
  unit text default '',
  filterable boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  unique(product_id, spec_key)
);
create index if not exists idx_product_specs_filter on public.product_specs(spec_key, value_text, value_number) where filterable = true;

create table if not exists public.product_variants (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null default '',
  sku text default '',
  image_url text default '',
  color_family text default '',
  finish text default '',
  size text default '',
  material text default '',
  metadata jsonb default '{}',
  sort_order integer default 0,
  created_at timestamptz default now()
);
create index if not exists idx_product_variants_product on public.product_variants(product_id, sort_order);

-- ── Projects ─────────────────────────────────────────────────────────────

create table if not exists public.projects (
  id uuid default gen_random_uuid() primary key,
  brand_id uuid references public.profiles(id) on delete set null,
  architect_id uuid references public.profiles(id) on delete set null,
  brand_name text not null default '',
  title text not null default '',
  slug text unique,
  location text default '',
  city text default '',
  country text default '',
  architect text default '',
  office_name text default '',
  year text default '',
  description text default '',
  image text default '',
  materials text[] default '{}',
  status text default 'published' check (status in ('draft', 'pending_review', 'published', 'rejected', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.projects add column if not exists architect_id uuid references public.profiles(id) on delete set null;
alter table public.projects add column if not exists slug text unique;
alter table public.projects add column if not exists city text default '';
alter table public.projects add column if not exists country text default '';
alter table public.projects add column if not exists office_name text default '';
alter table public.projects add column if not exists updated_at timestamptz default now();

create index if not exists idx_projects_brand on public.projects(brand_id);
create index if not exists idx_projects_architect on public.projects(architect_id);
create index if not exists idx_projects_status on public.projects(status);

create table if not exists public.project_images (
  id uuid default gen_random_uuid() primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null,
  alt text default '',
  sort_order integer default 0,
  is_primary boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_project_images_project on public.project_images(project_id, sort_order);

create table if not exists public.project_products (
  project_id uuid not null references public.projects(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  note text default '',
  created_at timestamptz default now(),
  primary key (project_id, product_id)
);

-- ── Architect workspace ─────────────────────────────────────────────────

create table if not exists public.moodboards (
  id uuid default gen_random_uuid() primary key,
  architect_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Yeni Moodboard',
  canvas jsonb default '{"width": 1400, "height": 900}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_moodboards_architect on public.moodboards(architect_id);

create table if not exists public.moodboard_items (
  id uuid default gen_random_uuid() primary key,
  moodboard_id uuid not null references public.moodboards(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  item_type text not null default 'product' check (item_type in ('product', 'project', 'image', 'note')),
  name text default '',
  image_url text default '',
  x numeric default 0,
  y numeric default 0,
  w numeric default 220,
  h numeric default 190,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_moodboard_items_board on public.moodboard_items(moodboard_id);

create table if not exists public.collections (
  id uuid default gen_random_uuid() primary key,
  architect_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_collections_architect on public.collections(architect_id);

create table if not exists public.favorites (
  id uuid default gen_random_uuid() primary key,
  architect_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  favorite_type text not null check (favorite_type in ('product', 'project')),
  created_at timestamptz default now(),
  check (
    (favorite_type = 'product' and product_id is not null and project_id is null)
    or
    (favorite_type = 'project' and project_id is not null and product_id is null)
  )
);
create unique index if not exists idx_favorites_product_unique
  on public.favorites(architect_id, product_id)
  where favorite_type = 'product';
create unique index if not exists idx_favorites_project_unique
  on public.favorites(architect_id, project_id)
  where favorite_type = 'project';

-- Backward-compatible existing favorite table used by current frontend.
create table if not exists public.product_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, product_id)
);
create index if not exists idx_product_favorites_pid on public.product_favorites(product_id);

-- ── Leads / quote requests ───────────────────────────────────────────────

create table if not exists public.leads (
  id uuid default gen_random_uuid() primary key,
  lead_type text not null default 'quote' check (lead_type in ('quote', 'sample', 'contact')),
  product_id uuid references public.products(id) on delete set null,
  brand_id uuid references public.profiles(id) on delete set null,
  architect_id uuid references public.profiles(id) on delete set null,
  name text not null default '',
  email text not null default '',
  phone text default '',
  company text default '',
  message text default '',
  status text not null default 'new' check (status in ('new', 'open', 'answered', 'closed', 'spam')),
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_leads_brand_status on public.leads(brand_id, status, created_at desc);

create table if not exists public.lead_messages (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid not null references public.leads(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  message text not null default '',
  created_at timestamptz default now()
);
create index if not exists idx_lead_messages_lead on public.lead_messages(lead_id, created_at);

-- ── Analytics ────────────────────────────────────────────────────────────

create table if not exists public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  event_type text not null check (
    event_type in (
      'product_view',
      'brand_view',
      'save_to_favorites',
      'add_to_moodboard',
      'download_file',
      'request_quote',
      'request_sample',
      'contact_brand'
    )
  ),
  product_id uuid references public.products(id) on delete set null,
  brand_id uuid references public.profiles(id) on delete set null,
  architect_id uuid references public.profiles(id) on delete set null,
  session_id text not null default '',
  metadata jsonb default '{}',
  created_at timestamptz default now()
);
create index if not exists idx_analytics_events_type_created on public.analytics_events(event_type, created_at desc);
create index if not exists idx_analytics_events_product on public.analytics_events(product_id, created_at desc);
create index if not exists idx_analytics_events_brand on public.analytics_events(brand_id, created_at desc);
create index if not exists idx_analytics_events_architect on public.analytics_events(architect_id, created_at desc);
create index if not exists idx_analytics_product_view_session
  on public.analytics_events(event_type, product_id, session_id, created_at desc)
  where event_type = 'product_view' and product_id is not null and session_id <> '';

-- Backward-compatible product view table used by current brand dashboard.
create table if not exists public.product_view_log (
  id uuid default gen_random_uuid() primary key,
  product_id uuid not null references public.products(id) on delete cascade,
  visitor_id text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);
create index if not exists idx_product_view_log_pid_created on public.product_view_log(product_id, created_at desc);

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

create or replace view public.brand_product_analytics_daily as
select
  p.brand_id,
  e.product_id,
  date_trunc('day', e.created_at)::date as day,
  count(*) filter (where e.event_type = 'product_view') as product_views,
  count(*) filter (where e.event_type = 'save_to_favorites') as saves,
  count(*) filter (where e.event_type = 'add_to_moodboard') as moodboard_adds,
  count(*) filter (where e.event_type = 'download_file') as downloads,
  count(*) filter (where e.event_type in ('request_quote', 'request_sample', 'contact_brand')) as leads
from public.analytics_events e
left join public.products p on p.id = e.product_id
group by p.brand_id, e.product_id, date_trunc('day', e.created_at)::date;

create or replace view public.brand_product_analytics_summary as
select
  p.brand_id,
  e.product_id,
  count(*) filter (where e.event_type = 'product_view') as product_views,
  count(distinct coalesce(e.architect_id::text, nullif(e.session_id, ''))) filter (where e.event_type = 'product_view') as unique_viewers,
  count(*) filter (where e.event_type = 'save_to_favorites') as saves,
  count(*) filter (where e.event_type = 'add_to_moodboard') as moodboard_adds,
  count(*) filter (where e.event_type = 'download_file') as downloads,
  count(*) filter (where e.event_type = 'request_quote') as quote_requests,
  count(*) filter (where e.event_type = 'request_sample') as sample_requests,
  count(*) filter (where e.event_type = 'contact_brand') as contact_requests,
  max(e.created_at) as last_event_at
from public.analytics_events e
left join public.products p on p.id = e.product_id
group by p.brand_id, e.product_id;

-- ── Admin review queue ───────────────────────────────────────────────────

create table if not exists public.admin_reviews (
  id uuid default gen_random_uuid() primary key,
  target_type text not null check (target_type in ('product', 'project', 'brand', 'architect')),
  target_id uuid not null,
  submitted_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  notes text default '',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_admin_reviews_status on public.admin_reviews(status, created_at desc);

-- ── Existing project/profile migrations ──────────────────────────────────

alter table public.profiles add column if not exists account_type text default 'brand';
alter table public.profiles add column if not exists phone text default '';
alter table public.profiles add column if not exists contact_name text default '';
alter table public.profiles add column if not exists job_title text default '';
alter table public.profiles add column if not exists primary_category text default '';
alter table public.profiles add column if not exists office text default '';
alter table public.profiles add column if not exists architect_profile_type text default 'individual';
alter table public.profiles add column if not exists updated_at timestamptz default now();
update public.profiles
set account_type = coalesce(nullif(trim(account_type), ''), 'brand')
where account_type is null or trim(account_type) = '';

alter table public.products add column if not exists brand_record_id uuid references public.brands(id) on delete set null;
alter table public.products add column if not exists brand_logo text default '';
alter table public.products add column if not exists slug text unique;
alter table public.products add column if not exists category_id uuid references public.product_categories(id) on delete set null;
alter table public.products add column if not exists subcategory_id uuid references public.product_subcategories(id) on delete set null;
alter table public.products add column if not exists summary text default '';
alter table public.products add column if not exists material text default '';
alter table public.products add column if not exists material_family text default '';
alter table public.products add column if not exists thickness_mm numeric;
alter table public.products add column if not exists fire_class text default '';
alter table public.products add column if not exists color_family text default '';
alter table public.products add column if not exists usage_area text default '';
alter table public.products add column if not exists indoor_outdoor text default '';
alter table public.products add column if not exists acoustic_rating text default '';
alter table public.products add column if not exists acoustic_nrc numeric;
alter table public.products add column if not exists dimensions text default '';
alter table public.products add column if not exists certificates text[] default '{}';
alter table public.products add column if not exists country text default '';
alter table public.products add column if not exists city text default '';
alter table public.products add column if not exists company_roles text[] default '{}';
alter table public.products add column if not exists has_bim boolean default false;
alter table public.products add column if not exists updated_at timestamptz default now();

alter table public.projects add column if not exists architect_id uuid references public.profiles(id) on delete set null;
alter table public.projects add column if not exists slug text unique;
alter table public.projects add column if not exists city text default '';
alter table public.projects add column if not exists country text default '';
alter table public.projects add column if not exists office_name text default '';
alter table public.projects add column if not exists updated_at timestamptz default now();

do $$
begin
  alter table public.profiles drop constraint if exists profiles_account_type_check;
  alter table public.profiles
    add constraint profiles_account_type_check
    check (account_type in ('brand', 'architect', 'admin'));

  alter table public.profiles drop constraint if exists profiles_architect_profile_type_check;
  alter table public.profiles
    add constraint profiles_architect_profile_type_check
    check (architect_profile_type in ('individual', 'office'));

  alter table public.products drop constraint if exists products_status_check;
  alter table public.products
    add constraint products_status_check
    check (status in ('draft', 'pending_review', 'published', 'rejected', 'archived'));

  alter table public.products drop constraint if exists products_indoor_outdoor_check;
  alter table public.products
    add constraint products_indoor_outdoor_check
    check (indoor_outdoor in ('', 'indoor', 'outdoor', 'both'));

  alter table public.projects drop constraint if exists projects_status_check;
  alter table public.projects
    add constraint projects_status_check
    check (status in ('draft', 'pending_review', 'published', 'rejected', 'archived'));
exception
  when duplicate_object then null;
end $$;

-- ── Auto-profile on signup trigger ───────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (
    id, name, email, website, account_type,
    phone, contact_name, job_title, primary_category, office, architect_profile_type
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
    coalesce(new.raw_user_meta_data->>'office', ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'architect_profile_type'), ''), 'individual')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Visit actor trigger ──────────────────────────────────────────────────

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

-- ── View increment RPC (anonymous-safe) ──────────────────────────────────

create or replace function public.increment_product_view(product_id uuid)
returns void as $$
  update public.products set views = views + 1 where id = product_id;
$$ language sql security definer;

-- ── RLS policies ─────────────────────────────────────────────────────────
-- Public katalog verisi okunur. Yazma işlemleri authenticated sahipler veya
-- admin ile sınırlıdır. Frontend tarafında gizli sunucu anahtarı kullanılmaz.

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.architects enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_subcategories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_files enable row level security;
alter table public.product_specs enable row level security;
alter table public.product_variants enable row level security;
alter table public.projects enable row level security;
alter table public.project_images enable row level security;
alter table public.project_products enable row level security;
alter table public.moodboards enable row level security;
alter table public.moodboard_items enable row level security;
alter table public.collections enable row level security;
alter table public.favorites enable row level security;
alter table public.product_favorites enable row level security;
alter table public.leads enable row level security;
alter table public.lead_messages enable row level security;
alter table public.analytics_events enable row level security;
alter table public.product_view_log enable row level security;
alter table public.visits enable row level security;
alter table public.admin_reviews enable row level security;

-- Public catalog read.
drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles for select using (true);
drop policy if exists "brands_public_read" on public.brands;
create policy "brands_public_read" on public.brands for select using (status = 'approved' or profile_id = auth.uid() or public.is_admin());
drop policy if exists "architects_public_read" on public.architects;
create policy "architects_public_read" on public.architects for select using (true);
drop policy if exists "product_categories_public_read" on public.product_categories;
create policy "product_categories_public_read" on public.product_categories for select using (true);
drop policy if exists "product_subcategories_public_read" on public.product_subcategories;
create policy "product_subcategories_public_read" on public.product_subcategories for select using (true);
drop policy if exists "products_all_read" on public.products;
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products for select using (status = 'published' or brand_id = auth.uid() or public.is_admin());
drop policy if exists "projects_public_read" on public.projects;
create policy "projects_public_read" on public.projects for select using (status = 'published' or brand_id = auth.uid() or architect_id = auth.uid() or public.is_admin());

-- Child catalog tables read when parent is visible.
drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read" on public.product_images
  for select using (exists (select 1 from public.products p where p.id = product_images.product_id and (p.status = 'published' or p.brand_id = auth.uid() or public.is_admin())));
drop policy if exists "product_files_public_read" on public.product_files;
create policy "product_files_public_read" on public.product_files
  for select using (exists (select 1 from public.products p where p.id = product_files.product_id and (p.status = 'published' or p.brand_id = auth.uid() or public.is_admin())));
drop policy if exists "product_specs_public_read" on public.product_specs;
create policy "product_specs_public_read" on public.product_specs
  for select using (exists (select 1 from public.products p where p.id = product_specs.product_id and (p.status = 'published' or p.brand_id = auth.uid() or public.is_admin())));
drop policy if exists "product_variants_public_read" on public.product_variants;
create policy "product_variants_public_read" on public.product_variants
  for select using (exists (select 1 from public.products p where p.id = product_variants.product_id and (p.status = 'published' or p.brand_id = auth.uid() or public.is_admin())));
drop policy if exists "project_images_public_read" on public.project_images;
create policy "project_images_public_read" on public.project_images
  for select using (exists (select 1 from public.projects p where p.id = project_images.project_id and (p.status = 'published' or p.brand_id = auth.uid() or p.architect_id = auth.uid() or public.is_admin())));
drop policy if exists "project_products_public_read" on public.project_products;
create policy "project_products_public_read" on public.project_products
  for select using (exists (select 1 from public.projects p where p.id = project_products.project_id and (p.status = 'published' or p.brand_id = auth.uid() or p.architect_id = auth.uid() or public.is_admin())));

-- Owner writes.
drop policy if exists "profiles_own_write" on public.profiles;
create policy "profiles_own_write" on public.profiles for all using (auth.uid() = id or public.is_admin()) with check (auth.uid() = id or public.is_admin());
drop policy if exists "brands_own_write" on public.brands;
create policy "brands_own_write" on public.brands for all using (auth.uid() = profile_id or public.is_admin()) with check (auth.uid() = profile_id or public.is_admin());
drop policy if exists "architects_own_write" on public.architects;
create policy "architects_own_write" on public.architects for all using (auth.uid() = profile_id or public.is_admin()) with check (auth.uid() = profile_id or public.is_admin());
drop policy if exists "products_own_write" on public.products;
create policy "products_own_write" on public.products for all using (auth.uid() = brand_id or public.is_admin()) with check (auth.uid() = brand_id or public.is_admin());
drop policy if exists "projects_owner_write" on public.projects;
create policy "projects_owner_write" on public.projects for all using (auth.uid() = brand_id or auth.uid() = architect_id or public.is_admin()) with check (auth.uid() = brand_id or auth.uid() = architect_id or public.is_admin());
drop policy if exists "product_categories_admin_write" on public.product_categories;
create policy "product_categories_admin_write" on public.product_categories for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "product_subcategories_admin_write" on public.product_subcategories;
create policy "product_subcategories_admin_write" on public.product_subcategories for all using (public.is_admin()) with check (public.is_admin());

-- Child writes follow parent ownership.
drop policy if exists "product_images_owner_write" on public.product_images;
create policy "product_images_owner_write" on public.product_images for all
  using (exists (select 1 from public.products p where p.id = product_images.product_id and (p.brand_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.products p where p.id = product_images.product_id and (p.brand_id = auth.uid() or public.is_admin())));
drop policy if exists "product_files_owner_write" on public.product_files;
create policy "product_files_owner_write" on public.product_files for all
  using (exists (select 1 from public.products p where p.id = product_files.product_id and (p.brand_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.products p where p.id = product_files.product_id and (p.brand_id = auth.uid() or public.is_admin())));
drop policy if exists "product_specs_owner_write" on public.product_specs;
create policy "product_specs_owner_write" on public.product_specs for all
  using (exists (select 1 from public.products p where p.id = product_specs.product_id and (p.brand_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.products p where p.id = product_specs.product_id and (p.brand_id = auth.uid() or public.is_admin())));
drop policy if exists "product_variants_owner_write" on public.product_variants;
create policy "product_variants_owner_write" on public.product_variants for all
  using (exists (select 1 from public.products p where p.id = product_variants.product_id and (p.brand_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.products p where p.id = product_variants.product_id and (p.brand_id = auth.uid() or public.is_admin())));
drop policy if exists "project_images_owner_write" on public.project_images;
create policy "project_images_owner_write" on public.project_images for all
  using (exists (select 1 from public.projects p where p.id = project_images.project_id and (p.brand_id = auth.uid() or p.architect_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.projects p where p.id = project_images.project_id and (p.brand_id = auth.uid() or p.architect_id = auth.uid() or public.is_admin())));
drop policy if exists "project_products_owner_write" on public.project_products;
create policy "project_products_owner_write" on public.project_products for all
  using (exists (select 1 from public.projects p where p.id = project_products.project_id and (p.brand_id = auth.uid() or p.architect_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.projects p where p.id = project_products.project_id and (p.brand_id = auth.uid() or p.architect_id = auth.uid() or public.is_admin())));

-- Architect workspace.
drop policy if exists "moodboards_owner_all" on public.moodboards;
create policy "moodboards_owner_all" on public.moodboards for all using (auth.uid() = architect_id or public.is_admin()) with check (auth.uid() = architect_id or public.is_admin());
drop policy if exists "moodboard_items_owner_all" on public.moodboard_items;
create policy "moodboard_items_owner_all" on public.moodboard_items for all
  using (exists (select 1 from public.moodboards m where m.id = moodboard_items.moodboard_id and (m.architect_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.moodboards m where m.id = moodboard_items.moodboard_id and (m.architect_id = auth.uid() or public.is_admin())));
drop policy if exists "collections_owner_all" on public.collections;
create policy "collections_owner_all" on public.collections for all using (auth.uid() = architect_id or public.is_admin()) with check (auth.uid() = architect_id or public.is_admin());
drop policy if exists "favorites_owner_all" on public.favorites;
create policy "favorites_owner_all" on public.favorites for all using (auth.uid() = architect_id or public.is_admin()) with check (auth.uid() = architect_id or public.is_admin());

-- Leads: public insert, brand/architect/admin read/update.
drop policy if exists "leads_public_insert" on public.leads;
create policy "leads_public_insert" on public.leads for insert with check (true);
drop policy if exists "leads_owner_read" on public.leads;
create policy "leads_owner_read" on public.leads for select using (brand_id = auth.uid() or architect_id = auth.uid() or public.is_admin());
drop policy if exists "leads_owner_update" on public.leads;
create policy "leads_owner_update" on public.leads for update using (brand_id = auth.uid() or architect_id = auth.uid() or public.is_admin()) with check (brand_id = auth.uid() or architect_id = auth.uid() or public.is_admin());
drop policy if exists "lead_messages_owner_all" on public.lead_messages;
create policy "lead_messages_owner_all" on public.lead_messages for all
  using (exists (select 1 from public.leads l where l.id = lead_messages.lead_id and (l.brand_id = auth.uid() or l.architect_id = auth.uid() or public.is_admin())))
  with check (exists (select 1 from public.leads l where l.id = lead_messages.lead_id and (l.brand_id = auth.uid() or l.architect_id = auth.uid() or public.is_admin())));

-- Analytics.
drop policy if exists "analytics_public_insert" on public.analytics_events;
create policy "analytics_public_insert" on public.analytics_events for insert with check (true);
drop policy if exists "analytics_brand_read" on public.analytics_events;
create policy "analytics_brand_read" on public.analytics_events for select using (
  public.is_admin()
  or brand_id = auth.uid()
  or exists (select 1 from public.products p where p.id = analytics_events.product_id and p.brand_id = auth.uid())
);
drop policy if exists "visits_insert" on public.visits;
create policy "visits_insert" on public.visits for insert with check (true);
drop policy if exists "visits_admin_read" on public.visits;
create policy "visits_admin_read" on public.visits for select using (public.is_admin());
drop policy if exists "pvl_insert_any" on public.product_view_log;
create policy "pvl_insert_any" on public.product_view_log for insert with check (exists (select 1 from public.products p where p.id = product_id));
drop policy if exists "pvl_select_brand" on public.product_view_log;
create policy "pvl_select_brand" on public.product_view_log for select using (
  public.is_admin()
  or exists (select 1 from public.products p where p.id = product_view_log.product_id and p.brand_id = auth.uid())
);
drop policy if exists "pf_insert_own" on public.product_favorites;
create policy "pf_insert_own" on public.product_favorites for insert with check (auth.uid() = user_id);
drop policy if exists "pf_delete_own" on public.product_favorites;
create policy "pf_delete_own" on public.product_favorites for delete using (auth.uid() = user_id);
drop policy if exists "pf_select_own_or_brand" on public.product_favorites;
create policy "pf_select_own_or_brand" on public.product_favorites for select using (
  auth.uid() = user_id
  or public.is_admin()
  or exists (select 1 from public.products p where p.id = product_favorites.product_id and p.brand_id = auth.uid())
);

-- Admin review.
drop policy if exists "admin_reviews_admin_all" on public.admin_reviews;
create policy "admin_reviews_admin_all" on public.admin_reviews for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin_reviews_submitter_insert" on public.admin_reviews;
create policy "admin_reviews_submitter_insert" on public.admin_reviews for insert with check (auth.uid() = submitted_by or public.is_admin());
drop policy if exists "admin_reviews_submitter_read" on public.admin_reviews;
create policy "admin_reviews_submitter_read" on public.admin_reviews for select using (submitted_by = auth.uid() or public.is_admin());

-- Admin kullanıcısı:
-- Supabase Dashboard → Authentication → Users → Add User:
--   Email: onatderindere@icloud.com
--   Password: dashboard'da belirlediğin şifre
