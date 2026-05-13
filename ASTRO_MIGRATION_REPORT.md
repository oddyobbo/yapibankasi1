# Archilink Astro Migration Report

Branch: `astro-migration`

## What was created

- Astro + Netlify architecture added.
- Supabase server-side public catalog client added.
- Astro public route layer added under `src/pages`.
- Reusable layout and component layer added under `src/layouts` and `src/components`.
- Legacy copy script added so old dashboard/auth/static `.html` pages can continue to exist after Astro build.

## Migrated public routes

- `/`
- `/products`
- `/products/[slug]`
- `/brands`
- `/brands/[slug]`
- `/projects`
- `/projects/[slug]`
- `/categories`
- `/categories/[slug]`

## Current completed migration steps

- Astro public shell and SEO-first routing are in place.
- `/products` now uses Supabase query-based filtering and URL state.
- `/products` pagination uses a default page size of 24.
- Product cards still fetch only lightweight public listing fields.
- `/products/[slug]` now enriches product detail data with brand, category/subcategory, files, specs, variants, related products and related projects.
- `sql/astro_slug_backfill.sql` prepares clean slug backfill and future automatic slug generation for products, brands, projects and categories.
- `/robots.txt` and `/sitemap.xml` endpoints now expose the public Astro catalog URLs for search engines and exclude legacy dashboard/panel routes from indexing.

## What remains legacy for Phase 2

- Brand dashboard pages: `marka-paneli*.html`
- Architect dashboard: `mimar-paneli.html`
- Admin panel: `admin-paneli.html`
- Login/auth flows: `marka-giris.html`, `mimar-giris.html`, `admin-giris.html`
- Moodboard: `moodboard.html`
- Existing legacy helpers: `core.js`, `layout.js`, old service modules

These are copied into `dist` during `npm run build` by `scripts/copy-legacy-static.mjs`.

## Supabase connection

- Astro uses `src/lib/supabase.js`.
- It uses the public anon/publishable key only.
- No service role key is used.
- Public pages query only:
  - `products.status = published`
  - `projects.status = published`
  - `brands.status = approved`
- Missing data renders clean empty states instead of fake content.

## SEO handling

- SEO is handled by `src/components/SEO.astro`.
- Discovery is handled by `src/pages/sitemap.xml.js` and `src/pages/robots.txt.js`.
- Metadata is rendered in the initial HTML for Astro pages.
- Supported fields:
  - title
  - meta description
  - canonical
  - Open Graph title
  - Open Graph description
  - Open Graph image
  - Twitter card/title/description/image
  - JSON-LD structured data

Structured data:
- Product detail: `Product`
- Brand detail: `Organization`
- Project detail: `CreativeWork`

## Rendering mode decision

Current setup uses Astro server output with Netlify adapter.

Why:
- Public catalog data will change through Supabase.
- Server rendering keeps SEO metadata in initial HTML without requiring a rebuild for every product/brand/project update.
- It avoids relying on client-side JavaScript for SEO.

Tradeoff:
- Static generation would be faster and CDN-friendlier, but needs rebuilds or a scheduled build pipeline when Supabase data changes.
- Server/hybrid rendering is better for setup phase and fast iteration.
- Later, high-traffic stable pages can be prerendered selectively.

## Manual review needed

- Run `sql/astro_slug_backfill.sql` in Supabase SQL Editor.
- Confirm Netlify environment variables:
  - `PUBLIC_SUPABASE_URL`
  - `PUBLIC_SUPABASE_ANON_KEY`
- Confirm Supabase RLS policies allow public SELECT for published/approved catalog data.
- Confirm brand records exist in `brands`; if not, brand detail pages may be empty until brand profiles are backfilled.
- Confirm all products have clean `slug` values.
- Confirm project records have clean `slug` values.
- Confirm category records exist in `product_categories`.

## Next recommended phase

1. Run and verify the slug backfill SQL in Supabase.
2. Add more precise facet counts or RPC-based filter options when catalog volume grows.
3. Move existing visual UI language into Astro components.
4. Backfill missing brand/category/project relations in Supabase.
5. Move dashboard/auth flows only after public catalog SEO layer is stable.
