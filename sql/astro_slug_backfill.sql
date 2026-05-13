-- Archilink Astro slug backfill + automatic slug generation
-- Run this once in Supabase SQL Editor.
-- It keeps existing non-empty slugs and only fills missing slugs.

create or replace function public.slugify_tr(input text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(
        lower(translate(
          coalesce(input, ''),
          'ÇĞİÖŞÜçğıöşüÂÎÛâîû',
          'CGIOSUcgiosuAIUaiu'
        )),
        '[^a-z0-9]+',
        '-',
        'g'
      )),
      ''
    ),
    'kayit'
  );
$$;

create or replace function public.unique_slug_for(table_name regclass, base_slug text, row_id uuid)
returns text
language plpgsql
as $$
declare
  candidate text := coalesce(nullif(base_slug, ''), 'kayit');
  suffix integer := 1;
  slug_exists boolean;
begin
  loop
    execute format('select exists(select 1 from %s where slug = $1 and id <> $2)', table_name)
      into slug_exists
      using candidate, row_id;

    if not slug_exists then
      return candidate;
    end if;

    suffix := suffix + 1;
    candidate := coalesce(nullif(base_slug, ''), 'kayit') || '-' || suffix;
  end loop;
end;
$$;

create or replace function public.set_product_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.unique_slug_for('public.products', public.slugify_tr(new.name), new.id);
  else
    new.slug := public.slugify_tr(new.slug);
  end if;
  return new;
end;
$$;

create or replace function public.set_brand_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.unique_slug_for('public.brands', public.slugify_tr(new.name), new.id);
  else
    new.slug := public.slugify_tr(new.slug);
  end if;
  return new;
end;
$$;

create or replace function public.set_project_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.unique_slug_for('public.projects', public.slugify_tr(new.title), new.id);
  else
    new.slug := public.slugify_tr(new.slug);
  end if;
  return new;
end;
$$;

create or replace function public.set_category_slug()
returns trigger
language plpgsql
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := public.unique_slug_for('public.product_categories', public.slugify_tr(new.name), new.id);
  else
    new.slug := public.slugify_tr(new.slug);
  end if;
  return new;
end;
$$;

-- Backfill missing slugs for existing records. First item gets the clean slug;
-- duplicates or conflicts receive a short id suffix.
with rows as (
  select
    id,
    public.slugify_tr(name) as base_slug,
    row_number() over (partition by public.slugify_tr(name) order by created_at, id) as rn
  from public.products
  where slug is null or btrim(slug) = ''
),
candidates as (
  select
    rows.id,
    case
      when rows.rn = 1 and not exists (
        select 1 from public.products p
        where p.slug = rows.base_slug and p.id <> rows.id
      )
      then rows.base_slug
      else rows.base_slug || '-' || left(rows.id::text, 8)
    end as slug
  from rows
)
update public.products p
set slug = candidates.slug
from candidates
where p.id = candidates.id;

with rows as (
  select
    id,
    public.slugify_tr(name) as base_slug,
    row_number() over (partition by public.slugify_tr(name) order by created_at, id) as rn
  from public.brands
  where slug is null or btrim(slug) = ''
),
candidates as (
  select
    rows.id,
    case
      when rows.rn = 1 and not exists (
        select 1 from public.brands b
        where b.slug = rows.base_slug and b.id <> rows.id
      )
      then rows.base_slug
      else rows.base_slug || '-' || left(rows.id::text, 8)
    end as slug
  from rows
)
update public.brands b
set slug = candidates.slug
from candidates
where b.id = candidates.id;

with rows as (
  select
    id,
    public.slugify_tr(title) as base_slug,
    row_number() over (partition by public.slugify_tr(title) order by created_at, id) as rn
  from public.projects
  where slug is null or btrim(slug) = ''
),
candidates as (
  select
    rows.id,
    case
      when rows.rn = 1 and not exists (
        select 1 from public.projects p
        where p.slug = rows.base_slug and p.id <> rows.id
      )
      then rows.base_slug
      else rows.base_slug || '-' || left(rows.id::text, 8)
    end as slug
  from rows
)
update public.projects p
set slug = candidates.slug
from candidates
where p.id = candidates.id;

with rows as (
  select
    id,
    public.slugify_tr(name) as base_slug,
    row_number() over (partition by public.slugify_tr(name) order by sort_order, created_at, id) as rn
  from public.product_categories
  where slug is null or btrim(slug) = ''
),
candidates as (
  select
    rows.id,
    case
      when rows.rn = 1 and not exists (
        select 1 from public.product_categories c
        where c.slug = rows.base_slug and c.id <> rows.id
      )
      then rows.base_slug
      else rows.base_slug || '-' || left(rows.id::text, 8)
    end as slug
  from rows
)
update public.product_categories c
set slug = candidates.slug
from candidates
where c.id = candidates.id;

-- Keep future records slug-safe.
drop trigger if exists products_set_slug_trg on public.products;
create trigger products_set_slug_trg
  before insert or update of name, slug on public.products
  for each row execute function public.set_product_slug();

drop trigger if exists brands_set_slug_trg on public.brands;
create trigger brands_set_slug_trg
  before insert or update of name, slug on public.brands
  for each row execute function public.set_brand_slug();

drop trigger if exists projects_set_slug_trg on public.projects;
create trigger projects_set_slug_trg
  before insert or update of title, slug on public.projects
  for each row execute function public.set_project_slug();

drop trigger if exists product_categories_set_slug_trg on public.product_categories;
create trigger product_categories_set_slug_trg
  before insert or update of name, slug on public.product_categories
  for each row execute function public.set_category_slug();

create index if not exists idx_brands_slug on public.brands(slug);
create index if not exists idx_projects_slug on public.projects(slug);
create index if not exists idx_product_categories_slug on public.product_categories(slug);
