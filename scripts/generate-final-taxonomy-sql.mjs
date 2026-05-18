#!/usr/bin/env node
/**
 * Final taxonomy → sql/final_taxonomy_seed_2026.sql
 * Kaynak: data/archilink-final-taxonomy-v1.json
 * Canlı DB'ye uygulanmaz; dosya üretir.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const TAXONOMY_JSON = path.join(ROOT, "data/archilink-final-taxonomy-v1.json");
const OUT_SQL = path.join(ROOT, "sql/final_taxonomy_seed_2026.sql");
const OUT_CHECK_SQL = path.join(ROOT, "sql/final_taxonomy_readonly_check.sql");
const OUT_EXTRA_L3_CHECK_SQL = path.join(ROOT, "sql/final_taxonomy_extra_l3_check.sql");
const FINAL_L1_SLUGS = [
  "zemin-yuzey",
  "yapi-cephe",
  "ic-mekan-mobilya",
  "mutfak-banyo",
  "teknik-sistemler",
  "dis-mekan-peyzaj",
];
const STAIR_SLUG = "mer" + "diven-korkuluk";
const STAIR_LABEL = "Mer" + "diven & Korkuluk";
/** Yanlış slug: mer + motion + -korkuluk (kaynak dosyada birleşik yazılmaz). */
const FORBIDDEN_STAIR_SLUG = ["mer", "motion", "-korkuluk"].join("");

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function boolSql(value) {
  return value ? "true" : "false";
}

function collectRows() {
  const data = JSON.parse(readFileSync(TAXONOMY_JSON, "utf8"));
  const l2Rows = [];
  const l3Rows = [];

  for (const l1 of data.taxonomy || []) {
    if (l1.level !== 1) continue;
    let l2Order = 0;
    for (const l2 of l1.children || []) {
      if (l2.level !== 2) continue;
      l2Order += 10;
      const showHeader = l2.show_in_header_dropdown !== false;
      l2Rows.push({
        name: l2.name_tr,
        slug: l2.slug,
        l1_slug: l1.slug,
        l1_name: l1.name_tr,
        sort_order: l2Order,
        show_in_header_dropdown: showHeader,
        show_in_products_filter: true,
        show_in_brand_product_form: true,
        is_active: true,
      });

      let l3Order = 0;
      for (const l3 of l2.children || []) {
        if (l3.level !== 3) continue;
        l3Order += 1;
        l3Rows.push({
          parent_l2_slug: l2.slug,
          name: l3.name_tr,
          slug: l3.slug,
          sort_order: l3Order,
          show_in_products_filter: true,
          show_in_brand_product_form: true,
          is_active: true,
        });
      }
    }
  }

  return { l2Rows, l3Rows, generatedAt: data.generated_at || new Date().toISOString() };
}

function buildL2Upsert(row) {
  return `INSERT INTO public.product_categories (
  name,
  slug,
  l1_slug,
  l1_name,
  sort_order,
  show_in_header_dropdown,
  show_in_products_filter,
  show_in_brand_product_form,
  is_active
)
VALUES (
  ${sqlLiteral(row.name)},
  ${sqlLiteral(row.slug)},
  ${sqlLiteral(row.l1_slug)},
  ${sqlLiteral(row.l1_name)},
  ${row.sort_order},
  ${boolSql(row.show_in_header_dropdown)},
  ${boolSql(row.show_in_products_filter)},
  ${boolSql(row.show_in_brand_product_form)},
  ${boolSql(row.is_active)}
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  l1_slug = EXCLUDED.l1_slug,
  l1_name = EXCLUDED.l1_name,
  sort_order = EXCLUDED.sort_order,
  show_in_header_dropdown = EXCLUDED.show_in_header_dropdown,
  show_in_products_filter = EXCLUDED.show_in_products_filter,
  show_in_brand_product_form = EXCLUDED.show_in_brand_product_form,
  is_active = EXCLUDED.is_active;`;
}

function buildL3Upsert(row) {
  const parentSlug = sqlLiteral(row.parent_l2_slug);
  return `WITH parent AS (
  SELECT id FROM public.product_categories WHERE slug = ${parentSlug}
)
INSERT INTO public.product_subcategories (
  category_id,
  name,
  slug,
  sort_order,
  show_in_products_filter,
  show_in_brand_product_form,
  is_active
)
SELECT
  parent.id,
  ${sqlLiteral(row.name)},
  ${sqlLiteral(row.slug)},
  ${row.sort_order},
  ${boolSql(row.show_in_products_filter)},
  ${boolSql(row.show_in_brand_product_form)},
  ${boolSql(row.is_active)}
FROM parent
WHERE parent.id IS NOT NULL
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  sort_order = EXCLUDED.sort_order,
  show_in_products_filter = EXCLUDED.show_in_products_filter,
  show_in_brand_product_form = EXCLUDED.show_in_brand_product_form,
  is_active = EXCLUDED.is_active;`;
}

function buildSql({ l2Rows, l3Rows, generatedAt }) {
  const l2Slugs = l2Rows.map((r) => r.slug);
  const l3Slugs = l3Rows.map((r) => r.slug);

  const header = `-- ═══════════════════════════════════════════════════════════════════════════
-- Final taxonomy seed — product_categories (32 L2) + product_subcategories (259 L3)
-- Üretim: ${generatedAt}
-- Kaynak: data/archilink-final-taxonomy-v1.json
-- Üretici: node scripts/generate-final-taxonomy-sql.mjs
--
-- UYARI: Bu dosya canlı Supabase'e otomatik uygulanmaz.
-- SQL Editor'da manuel çalıştırın. Eski satırlar silinmez / pasifleştirilmez.
-- L2 upsert: ${l2Rows.length} | L3 upsert: ${l3Rows.length}
-- ═══════════════════════════════════════════════════════════════════════════

`;

  const alterCategories = `-- ── A) product_categories — visibility + L1 metadata ───────────────────────

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS l1_slug text,
  ADD COLUMN IF NOT EXISTS l1_name text,
  ADD COLUMN IF NOT EXISTS show_in_header_dropdown boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_products_filter boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_brand_product_form boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

`;

  const alterSubcategories = `-- ── B) product_subcategories — visibility ───────────────────────────────────

ALTER TABLE public.product_subcategories
  ADD COLUMN IF NOT EXISTS show_in_products_filter boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_brand_product_form boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

`;

  const l2Section = `-- ── C) L2 upsert (${l2Rows.length}) ───────────────────────────────────────────

${l2Rows.map(buildL2Upsert).join("\n\n")}

`;

  const l3Section = `-- ── D) L3 upsert (${l3Rows.length}) ──────────────────────────────────────────

${l3Rows.map(buildL3Upsert).join("\n\n")}

`;

  const footer = `-- ── E) Eski satırlar ─────────────────────────────────────────────────────────
-- Bu migration eski product_categories / product_subcategories satırlarını
-- silmez ve pasifleştirmez. Temizlik ayrı fazda yapılacak.

-- Final L2 slug referansı (kontrol):
-- ${l2Slugs.join(", ")}

-- Final L3 slug sayısı: ${l3Slugs.length}
`;

  return header + alterCategories + alterSubcategories + l2Section + l3Section + footer;
}

function assertNoForbiddenStairSlug(sql, context) {
  if (sql.includes(FORBIDDEN_STAIR_SLUG)) {
    throw new Error(`${context}: forbidden stair slug typo (use ${STAIR_SLUG})`);
  }
}

function validateSeedSql(sql) {
  assertNoForbiddenStairSlug(sql, "Seed SQL");
  if (!sql.includes(STAIR_SLUG)) {
    throw new Error(`Generated SQL missing required slug "${STAIR_SLUG}"`);
  }
  if (!sql.includes(STAIR_LABEL)) {
    throw new Error(`Generated SQL missing required label "${STAIR_LABEL}"`);
  }
}

function valuesTuple(slug, parentL2 = null) {
  if (parentL2) return `(${sqlLiteral(slug)}, ${sqlLiteral(parentL2)})`;
  return `(${sqlLiteral(slug)})`;
}

function buildReadonlyCheck({ l2Rows, l3Rows, generatedAt }) {
  const l2Values = l2Rows.map((r) => valuesTuple(r.slug)).join(",\n  ");
  const l3Values = l3Rows.map((r) => valuesTuple(r.slug, r.parent_l2_slug)).join(",\n  ");

  return `-- Salt okuma — final taxonomy DB kontrolü (SELECT only)
-- Üretim: ${generatedAt}
-- Kaynak: data/archilink-final-taxonomy-v1.json

WITH final_l2(slug) AS (
  VALUES
  ${l2Values}
)
SELECT 'product_categories' AS section, 'final_l2_matched' AS metric, count(*)::bigint AS value
FROM final_l2 f
INNER JOIN public.product_categories c ON c.slug = f.slug;

WITH final_l2(slug) AS (
  VALUES
  ${l2Values}
)
SELECT f.slug AS missing_l2_slug
FROM final_l2 f
LEFT JOIN public.product_categories c ON c.slug = f.slug
WHERE c.id IS NULL
ORDER BY f.slug;

WITH final_l2(slug) AS (
  VALUES
  ${l2Values}
)
SELECT c.slug, c.name, c.l1_slug
FROM public.product_categories c
LEFT JOIN final_l2 f ON f.slug = c.slug
WHERE f.slug IS NULL OR c.l1_slug IS NULL
ORDER BY c.slug;

WITH final_l3(slug, parent_l2_slug) AS (
  VALUES
  ${l3Values}
)
SELECT 'product_subcategories' AS section, 'final_l3_matched_parent' AS metric, count(*)::bigint AS value
FROM final_l3 f
INNER JOIN public.product_categories c ON c.slug = f.parent_l2_slug
INNER JOIN public.product_subcategories s ON s.slug = f.slug AND s.category_id = c.id;

WITH final_l3(slug, parent_l2_slug) AS (
  VALUES
  ${l3Values}
)
SELECT f.slug AS missing_l3_slug, f.parent_l2_slug
FROM final_l3 f
LEFT JOIN public.product_categories c ON c.slug = f.parent_l2_slug
LEFT JOIN public.product_subcategories s ON s.slug = f.slug AND s.category_id = c.id
WHERE s.id IS NULL
ORDER BY f.parent_l2_slug, f.slug;

WITH final_l3(slug, parent_l2_slug) AS (
  VALUES
  ${l3Values}
)
SELECT s.slug AS l3_slug, c.slug AS actual_parent_l2_slug, f.parent_l2_slug AS expected_parent_l2_slug
FROM final_l3 f
INNER JOIN public.product_subcategories s ON s.slug = f.slug
INNER JOIN public.product_categories c ON c.id = s.category_id
WHERE c.slug IS DISTINCT FROM f.parent_l2_slug
ORDER BY f.parent_l2_slug, f.slug;

SELECT 'products' AS section, 'total_rows' AS metric, count(*)::bigint AS value FROM public.products;
SELECT 'products' AS section, 'category_nonempty' AS metric, count(*)::bigint AS value
FROM public.products WHERE category IS NOT NULL AND btrim(category) <> '';
SELECT 'products' AS section, 'category_id_not_null' AS metric, count(*)::bigint AS value
FROM public.products WHERE category_id IS NOT NULL;
SELECT 'products' AS section, 'subcategory_id_not_null' AS metric, count(*)::bigint AS value
FROM public.products WHERE subcategory_id IS NOT NULL;
SELECT 'products' AS section, 'category_text_only_no_category_id' AS metric, count(*)::bigint AS value
FROM public.products
WHERE category IS NOT NULL AND btrim(category) <> '' AND category_id IS NULL;
`;
}

function buildExtraL3Check({ l3Rows, generatedAt }) {
  const l3Values = l3Rows
    .map((r) => `(${sqlLiteral(r.slug)}, ${sqlLiteral(r.parent_l2_slug)})`)
    .join(",\n  ");
  const l1InList = FINAL_L1_SLUGS.map((s) => sqlLiteral(s)).join(",\n    ");

  return `-- Salt okuma — final taxonomy dışı L3 tespiti (SELECT only)
-- Üretim: ${generatedAt}
-- Kaynak: data/archilink-final-taxonomy-v1.json
-- Üretici: node scripts/generate-final-taxonomy-sql.mjs
--
-- Beklenen final L3: ${l3Rows.length}
-- DB final_l3_count > ${l3Rows.length} ise extra_l3 listesi fazla satırları gösterir.

WITH expected_l3(slug, parent_slug) AS (
  VALUES
  ${l3Values}
),
actual_l3 AS (
  SELECT
    ps.id,
    ps.name,
    ps.slug,
    pc.slug AS parent_slug,
    pc.name AS parent_name,
    pc.l1_slug,
    pc.l1_name
  FROM public.product_subcategories ps
  JOIN public.product_categories pc ON pc.id = ps.category_id
  WHERE pc.l1_slug IN (
    ${l1InList}
  )
),
extra_l3 AS (
  SELECT *
  FROM actual_l3 a
  WHERE NOT EXISTS (
    SELECT 1
    FROM expected_l3 e
    WHERE e.slug = a.slug
      AND e.parent_slug = a.parent_slug
  )
)
SELECT
  'summary' AS section,
  'expected_l3_count' AS metric,
  (SELECT count(*)::bigint FROM expected_l3) AS value
UNION ALL
SELECT
  'summary',
  'actual_l3_in_final_l1',
  (SELECT count(*)::bigint FROM actual_l3)
UNION ALL
SELECT
  'summary',
  'extra_l3_count',
  (SELECT count(*)::bigint FROM extra_l3);

-- ── Fazla / eski L3 satırları (final taxonomy dışı) ───────────────────────

WITH expected_l3(slug, parent_slug) AS (
  VALUES
  ${l3Values}
),
actual_l3 AS (
  SELECT
    ps.id,
    ps.name,
    ps.slug,
    pc.slug AS parent_slug,
    pc.name AS parent_name,
    pc.l1_slug,
    pc.l1_name
  FROM public.product_subcategories ps
  JOIN public.product_categories pc ON pc.id = ps.category_id
  WHERE pc.l1_slug IN (
    ${l1InList}
  )
),
extra_l3 AS (
  SELECT *
  FROM actual_l3 a
  WHERE NOT EXISTS (
    SELECT 1
    FROM expected_l3 e
    WHERE e.slug = a.slug
      AND e.parent_slug = a.parent_slug
  )
)
SELECT *
FROM extra_l3
ORDER BY l1_slug, parent_slug, slug;

-- ── Extra L3 → ürün kullanımı ───────────────────────────────────────────────

WITH expected_l3(slug, parent_slug) AS (
  VALUES
  ${l3Values}
),
actual_l3 AS (
  SELECT
    ps.id,
    ps.name,
    ps.slug,
    pc.slug AS parent_slug,
    pc.name AS parent_name,
    pc.l1_slug,
    pc.l1_name
  FROM public.product_subcategories ps
  JOIN public.product_categories pc ON pc.id = ps.category_id
  WHERE pc.l1_slug IN (
    ${l1InList}
  )
),
extra_l3 AS (
  SELECT *
  FROM actual_l3 a
  WHERE NOT EXISTS (
    SELECT 1
    FROM expected_l3 e
    WHERE e.slug = a.slug
      AND e.parent_slug = a.parent_slug
  )
)
SELECT
  x.id,
  x.name,
  x.slug,
  x.parent_slug,
  x.parent_name,
  x.l1_slug,
  x.l1_name,
  count(p.id)::bigint AS product_count
FROM extra_l3 x
LEFT JOIN public.products p ON p.subcategory_id = x.id
GROUP BY
  x.id,
  x.name,
  x.slug,
  x.parent_slug,
  x.parent_name,
  x.l1_slug,
  x.l1_name
ORDER BY product_count DESC, x.parent_slug, x.slug;
`;
}

function main() {
  const { l2Rows, l3Rows, generatedAt } = collectRows();

  if (l2Rows.length !== 32) {
    console.warn(`Warning: expected 32 L2 rows, got ${l2Rows.length}`);
  }
  if (l3Rows.length !== 259) {
    console.warn(`Warning: expected 259 L3 rows, got ${l3Rows.length}`);
  }

  const l2Slugs = new Set(l2Rows.map((r) => r.slug));
  if (l2Slugs.size !== l2Rows.length) {
    throw new Error("Duplicate L2 slug in taxonomy JSON");
  }

  const l3Global = new Set();
  for (const row of l3Rows) {
    if (l3Global.has(row.slug)) {
      throw new Error(`Duplicate L3 slug across parents: ${row.slug}`);
    }
    l3Global.add(row.slug);
  }

  const sql = buildSql({ l2Rows, l3Rows, generatedAt });
  const checkSql = buildReadonlyCheck({ l2Rows, l3Rows, generatedAt });
  const extraL3CheckSql = buildExtraL3Check({ l3Rows, generatedAt });
  validateSeedSql(sql);
  assertNoForbiddenStairSlug(checkSql, "Readonly check SQL");
  assertNoForbiddenStairSlug(extraL3CheckSql, "Extra L3 check SQL");

  writeFileSync(OUT_SQL, sql, "utf8");
  writeFileSync(OUT_CHECK_SQL, checkSql, "utf8");
  writeFileSync(OUT_EXTRA_L3_CHECK_SQL, extraL3CheckSql, "utf8");
  console.log(`Wrote ${OUT_SQL}`);
  console.log(`Wrote ${OUT_CHECK_SQL}`);
  console.log(`Wrote ${OUT_EXTRA_L3_CHECK_SQL}`);
  console.log(`L2 upserts: ${l2Rows.length}`);
  console.log(`L3 upserts: ${l3Rows.length}`);
  console.log(`Expected L3 in extra check: ${l3Rows.length}`);
}

main();
