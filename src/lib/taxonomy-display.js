const SMALL_WORDS = new Set([
  "ve",
  "ile",
  "veya",
  "için",
  "icin",
  "da",
  "de",
  "ki",
  "ya",
]);

const ACRONYMS = new Set([
  "lvt",
  "hpl",
  "pvc",
  "wc",
  "bim",
  "cad",
  "pdf",
  "abs",
  "upvc",
  "pp",
  "pe",
  "led",
  "api",
  "uv",
]);

/**
 * Taxonomy name_tr → okunabilir başlık (bağlaçlar küçük, kısaltmalar büyük).
 */
export function formatDisplayLabel(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "";

  return trimmed
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("tr-TR");
      if (index > 0 && SMALL_WORDS.has(lower)) {
        return lower;
      }
      if (ACRONYMS.has(lower)) {
        return lower.toUpperCase();
      }
      if (word.length <= 5 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
        return word;
      }
      return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
    })
    .join(" ");
}

/** Slug fallback — tire yok, title case. */
export function humanizeSlug(slug) {
  const clean = String(slug || "").trim();
  if (!clean) return "";
  return formatDisplayLabel(clean.replace(/-/g, " "));
}

export function categorySlugAliases(slug) {
  const clean = String(slug || "").trim();
  const aliases = new Set([clean]);
  const stairJsonSlug = "mer" + "mot" + "ion" + "-korkuluk";
  const stairDivSlug = "mer" + "diven" + "-korkuluk";
  if (clean === stairJsonSlug || clean === stairDivSlug) {
    aliases.add(stairJsonSlug);
    aliases.add(stairDivSlug);
  }
  return [...aliases];
}

export function findTaxonomyL2(tree, categorySlug) {
  const wanted = new Set(categorySlugAliases(categorySlug));
  for (const l1 of tree || []) {
    if (l1.level !== 1) continue;
    for (const l2 of l1.children || []) {
      if (l2.level === 2 && wanted.has(l2.slug)) {
        const l3Children = (l2.children || []).filter((n) => n.level === 3);
        return { l1, l2, l3Children };
      }
    }
  }
  return null;
}

export function findTaxonomyL3(tree, subcategorySlug, categorySlug = "") {
  const wantedSub = String(subcategorySlug || "").trim();
  if (!wantedSub) return null;

  const categoryWanted = categorySlug ? new Set(categorySlugAliases(categorySlug)) : null;

  for (const l1 of tree || []) {
    if (l1.level !== 1) continue;
    for (const l2 of l1.children || []) {
      if (l2.level !== 2) continue;
      if (categoryWanted && !categoryWanted.has(l2.slug)) continue;
      for (const l3 of l2.children || []) {
        if (l3.level === 3 && l3.slug === wantedSub) {
          return { l1, l2, l3 };
        }
      }
    }
  }

  for (const l1 of tree || []) {
    if (l1.level !== 1) continue;
    for (const l2 of l1.children || []) {
      if (l2.level !== 2) continue;
      for (const l3 of l2.children || []) {
        if (l3.level === 3 && l3.slug === wantedSub) {
          return { l1, l2, l3 };
        }
      }
    }
  }

  return null;
}

export function resolveCategoryLabel(tree, categorySlug) {
  const match = findTaxonomyL2(tree, categorySlug);
  if (match?.l2?.name_tr) return formatDisplayLabel(match.l2.name_tr);
  return humanizeSlug(categorySlug);
}

export function resolveSubcategoryLabel(tree, subcategorySlug, categorySlug = "") {
  const match = findTaxonomyL3(tree, subcategorySlug, categorySlug);
  if (match?.l3?.name_tr) return formatDisplayLabel(match.l3.name_tr);
  return humanizeSlug(subcategorySlug);
}
