#!/usr/bin/env node
/**
 * Archilink final taxonomy v1 — single source for Header groups (L1/L2) + category/form L3.
 * Tree: scripts/archilink-taxonomy-v2-tree.mjs (6 L1 / 32 L2 / L3).
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HEADER_TAXONOMY } from "./archilink-taxonomy-v2-tree.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "data");

const OUT_JSON = path.join(DATA, "archilink-final-taxonomy-v1.json");
const OUT_PUBLIC_JSON = path.join(ROOT, "public", "data", "archilink-final-taxonomy-v1.json");
const OUT_REPORT = path.join(DATA, "archilink-final-taxonomy-v1-report.md");

const GLOBAL_FILTERS = [
  { key: "material", label_tr: "Malzeme", source: "product_attributes", dynamic: true },
  { key: "color", label_tr: "Renk / renk ailesi", source: "product_attributes", dynamic: true },
  { key: "pattern", label_tr: "Doku / pattern", source: "product_attributes", dynamic: true },
  { key: "usage", label_tr: "Kullanım alanı", source: "product_attributes", dynamic: true },
  { key: "properties", label_tr: "Özellikler", source: "product_attributes", dynamic: true },
  { key: "indoor_outdoor", label_tr: "İç / dış mekan", source: "product_attributes", dynamic: true },
  { key: "residential_commercial", label_tr: "Konut / ticari", source: "product_attributes", dynamic: true },
  { key: "documentation", label_tr: "Dokümantasyon", source: "product_documents", dynamic: true },
];

function slugify(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/İ/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildNode(input, level, parentSlug = null, ctx = { l1Slug: null, l2Slug: null }) {
  const slug = input.slug || slugify(input.name_tr);
  const showInHeader = level <= 2;
  const publicRule =
    level <= 2 ? "always_show_l1_l2_in_navigation" : "show_if_has_published_products";

  const l1Slug = level === 1 ? slug : ctx.l1Slug;
  const l2Slug = level === 2 ? slug : ctx.l2Slug;
  const childCtx = {
    l1Slug: level === 1 ? slug : ctx.l1Slug,
    l2Slug: level === 2 ? slug : ctx.l2Slug,
  };

  const children = (input.children || []).map((child) => buildNode(child, level + 1, slug, childCtx));

  const catalogBase = "/urunler";
  let products_path = catalogBase;
  if (level === 1) {
    products_path = `${catalogBase}/${slug}`;
  } else if (level === 2 && l1Slug) {
    products_path = `${catalogBase}/${l1Slug}/${slug}`;
  } else if (level === 3 && l1Slug && l2Slug) {
    products_path = `${catalogBase}/${l1Slug}/${l2Slug}/${slug}`;
  }

  return {
    name_tr: input.name_tr,
    slug,
    level,
    parent_slug: parentSlug,
    show_in_header_dropdown: showInHeader,
    show_in_navigation: level <= 2,
    public_visible_rule: publicRule,
    selectable_in_brand_panel: true,
    canonical_product_category: level === 3,
    source: level === 1 ? "header_mega_group" : level === 2 ? "header_mega_link" : "archilink_curated_l3",
    products_path,
    children,
  };
}

function flatten(nodes, acc = []) {
  for (const node of nodes) {
    acc.push(node);
    if (node.children?.length) flatten(node.children, acc);
  }
  return acc;
}

function validate(tree) {
  const issues = [];
  const slugs = new Set();
  const flat = flatten(tree);

  const l1 = tree.filter((n) => n.level === 1);
  if (l1.length !== 6) issues.push(`L1 count is ${l1.length}, expected 6`);

  for (const node of flat) {
    if (!node.name_tr?.trim()) issues.push(`Empty name_tr: slug ${node.slug}`);
    if (slugs.has(node.slug)) issues.push(`Duplicate slug: ${node.slug}`);
    slugs.add(node.slug);

    if (node.level === 1) {
      if (!node.children?.length) issues.push(`L1 "${node.name_tr}" has no L2 children`);
    }
    if (node.level === 2) {
      if (!node.children?.length) issues.push(`L2 "${node.name_tr}" has no L3 children`);
      if (node.show_in_header_dropdown !== true) {
        issues.push(`L2 "${node.slug}" must show_in_header_dropdown=true`);
      }
    }
    if (node.level === 3) {
      if (node.show_in_header_dropdown) issues.push(`L3 "${node.slug}" must not show in header`);
      if (!node.canonical_product_category) {
        issues.push(`L3 "${node.slug}" must be canonical_product_category`);
      }
    }
    if (node.parent_slug && node.level > 1) {
      const parent = flat.find((p) => p.slug === node.parent_slug);
      if (!parent) issues.push(`Missing parent for ${node.slug}: ${node.parent_slug}`);
    }
  }

  const l2Count = flat.filter((n) => n.level === 2).length;
  const l3Count = flat.filter((n) => n.level === 3).length;
  if (l2Count !== 32) issues.push(`L2 count is ${l2Count}, expected 32`);

  return { issues, flat, l1Count: l1.length, l2Count, l3Count, slugCount: slugs.size };
}

function buildReport(tree, validation, meta) {
  const l1List = tree
    .map(
      (l1) =>
        `- **${l1.name_tr}** (\`${l1.slug}\`) — ${l1.children.length} L2, ${l1.children.reduce((s, l2) => s + l2.children.length, 0)} L3`
    )
    .join("\n");

  return `# Archilink — Final Taxonomy V1

Üretim: ${meta.generatedAt}

## Özet

| Metrik | Değer |
|--------|-------|
| L1 (Header mega grup) | ${validation.l1Count} |
| L2 (Header dropdown link) | ${validation.l2Count} |
| L3 (ürün ailesi / canonical) | ${validation.l3Count} |
| Toplam düğüm | ${validation.flat.length} |
| Benzersiz slug | ${validation.slugCount} |
| Validation | ${validation.issues.length === 0 ? "Geçti" : `**${validation.issues.length} sorun**`} |

## Kaynak

- **Ağaç:** \`scripts/archilink-taxonomy-v2-tree.mjs\`
- **L3:** Kürasyonlu ürün aileleri (Header’da L3 render edilmez)

## Hiyerarşi kuralları

| Seviye | Rol | Header’da görünür | Canonical ürün kategorisi |
|--------|-----|-------------------|---------------------------|
| L1 | Mega menü grup başlığı | Evet (grup) | Hayır |
| L2 | Header dropdown kategori linki | Evet | Hayır |
| L3 | Kategori sayfası + ürün ekleme formu | Hayır | **Evet** (tek canonical) |

## URL / path kuralları

- **L1:** \`/urunler/<l1.slug>\`
- **L2:** \`/urunler/<l1.slug>/<l2.slug>\`
- **L3:** \`/urunler/<l1.slug>/<l2.slug>/<l3.slug>\`

## L1 listesi

${l1List}

${validation.issues.length ? `## Validation sorunları\n\n${validation.issues.map((i) => `- ${i}`).join("\n")}\n` : ""}
`;
}

async function main() {
  await mkdir(DATA, { recursive: true });

  const tree = HEADER_TAXONOMY.map((l1) => buildNode(l1, 1));
  const validation = validate(tree);

  const output = {
    version: "final-taxonomy-v1",
    generated_at: new Date().toISOString(),
    purpose: "Single source: Header mega menu L1/L2 + category page & brand form L3",
    source: {
      header: "scripts/archilink-taxonomy-v2-tree.mjs",
      l3: "archilink final curated product families",
    },
    rules: {
      header_dropdown_levels: [1, 2],
      category_page_levels: [2, 3],
      brand_form_selectable_levels: [2, 3],
      canonical_product_category_level: 3,
      one_canonical_category_per_product: true,
      filters_not_in_category_tree: true,
      l3_may_hide_when_no_products: true,
    },
    global_filters: GLOBAL_FILTERS,
    taxonomy: tree,
    validation: {
      passed: validation.issues.length === 0,
      l1_count: validation.l1Count,
      l2_count: validation.l2Count,
      l3_count: validation.l3Count,
      issues: validation.issues,
    },
  };

  const report = buildReport(tree, validation, { generatedAt: output.generated_at });

  const jsonContent = `${JSON.stringify(output, null, 2)}\n`;
  await writeFile(OUT_JSON, jsonContent, "utf8");
  await mkdir(path.dirname(OUT_PUBLIC_JSON), { recursive: true });
  await writeFile(OUT_PUBLIC_JSON, jsonContent, "utf8");
  await writeFile(OUT_REPORT, report, "utf8");

  console.log("Archilink final taxonomy v1");
  console.log(`L1: ${validation.l1Count}`);
  console.log(`L2: ${validation.l2Count}`);
  console.log(`L3: ${validation.l3Count}`);
  console.log(`Validation: ${validation.issues.length === 0 ? "PASSED" : "FAILED"}`);
  if (validation.issues.length) {
    for (const i of validation.issues) console.log(`  - ${i}`);
    process.exitCode = 1;
  }
  console.log(`Wrote: ${OUT_JSON}`);
  console.log(`Wrote: ${OUT_PUBLIC_JSON}`);
  console.log(`Wrote: ${OUT_REPORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
