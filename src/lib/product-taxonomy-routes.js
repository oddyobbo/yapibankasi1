/**
 * Archilink ürün kataloğu: taxonomy tabanlı temiz path (/urunler/[L1]/[L2]/[L3])
 * ve eski query parametreleriyle uyumluluk yardımcıları.
 */

import finalTaxonomy from "../../data/archilink-final-taxonomy-v1.json";

/** Public katalog ve ürün detay URL kökü (Türkçe path). */
export const PRODUCT_CATALOG_BASE = "/urunler";

/** @typedef {{ name_tr: string; slug: string; level: number; children?: TaxonomyNode[] }} TaxonomyNode */

/** @returns {TaxonomyNode[]} */
export function getTaxonomyTree() {
  return /** @type {TaxonomyNode[]} */ (finalTaxonomy.taxonomy ?? []);
}

/** Header chip, footer şerit ve products toolbar L1 sırası (final taxonomy). */
export const FINAL_TAXONOMY_L1_SLUG_ORDER = [
  "zemin-yuzey",
  "yapi-cephe",
  "ic-mekan-mobilya",
  "mutfak-banyo",
  "teknik-sistemler",
  "dis-mekan-peyzaj",
];

export function categorySlugAliases(slug) {
  const clean = String(slug || "").trim();
  const aliases = new Set([clean]);

  if (clean === "panel-ve-levha-yuzeyler") {
    aliases.add("panel-levha-yuzeyler");
  }
  return [...aliases];
}

/** Eski group/category URL'lerini yeni taxonomy slug'larına eşler (DB migration yok). */
export function normalizeLegacyTaxonomyFilters(raw) {
  let { group, category, subcategory } = raw;

  const groupMap = {
    "kaplama-yuzeyler": "zemin-yuzey",
    "zemin-ve-yuzey": "zemin-yuzey",
    "mobilya-ic-mekan": "ic-mekan-mobilya",
    "ic-mekan-ve-mobilya": "ic-mekan-mobilya",
    "mutfak-banyo-wellness": "mutfak-banyo",
    "dis-mekan-ve-peyzaj": "dis-mekan-peyzaj",
    "yapi-ve-cephe": "yapi-cephe",
    aydinlatma: "teknik-sistemler",
  };
  if (group && groupMap[group]) group = groupMap[group];

  const legacyLightingL2 = new Set([
    "ic-mekan-aydinlatmasi",
    "dis-mekan-aydinlatmasi",
    "teknik-aydinlatma",
    "aydinlatma-aksesuarlari",
  ]);
  if (legacyLightingL2.has(category)) {
    if (!subcategory) {
      subcategory = "";
    }
    category = "aydinlatma";
  }

  if (group === "yapi-cephe" && category === "yalitim") {
    group = "zemin-yuzey";
  }

  if (group === "dis-mekan-peyzaj" && category === "havuz") {
    group = "mutfak-banyo";
  }

  if (category === "cam-sistemleri" || category === "pencere-dograma") {
    category = "pencere-dograma-cam";
  }

  if (category === "dis-mekan-yasam-urunleri") {
    category = "dis-mekan-mobilyasi";
  }

  const catMap = {
    "wellness-havuz": { group: "mutfak-banyo", category: "spa-sauna", subcategory: null },
    "drenaj-altyapi-trafik": { category: "tesisat-drenaj", subcategory: null },
    "donanim-baglanti": { category: "yapi-donanimi", subcategory: null },
    "donanim-ve-baglanti-elemanlari": { category: "yapi-donanimi", subcategory: null },
    "panel-levha-yuzeyler": { group: "zemin-yuzey", category: "panel-levha-yuzeyler", subcategory: null },
    "panel-ve-levha-yuzeyler": { group: "zemin-yuzey", category: "panel-levha-yuzeyler", subcategory: null },
    "cati-sistemleri": { category: "cephe-sistemleri", subcategory: null },
    "elektrik-akilli-bina": { category: "elektrik-akilli-sistemler", subcategory: null },
    "isitma-sogutma-havalandirma": { category: "iklimlendirme", subcategory: null },
    aydinlatma: { category: "aydinlatma", subcategory: null },
    "peyzaj-elemanlari": { category: "peyzaj-bahce", subcategory: null },
    "kent-mobilyalari-kamusal-donatilar": { category: "kent-kamusal-donatilar", subcategory: null },
    "pergola-golgelendirme": { category: "golgelendirme-sistemleri", subcategory: null },
    "oturma-mobilyalari": { category: "koltuk-sandalye", subcategory: null },
    "masa-calisma-mobilyalari": { category: "masa-buro", subcategory: null },
    "bolme-kabin-sistemleri": { category: "bolme-sistemleri", subcategory: null },
    "aksesuar-tekstil": { category: "tekstil-hali", subcategory: null },
    "ofis-sistemleri": { category: "bolme-sistemleri", subcategory: null },
  };

  if (category && catMap[category]) {
    const r = catMap[category];
    if (r.group) group = r.group;
    if (r.category) category = r.category;
    if (r.subcategory !== undefined) {
      if (r.subcategory === null) subcategory = "";
      else subcategory = r.subcategory;
    }
  }

  return { group, category, subcategory };
}

const L1_SEGMENT_ALIASES = {
  "kaplama-yuzeyler": "zemin-yuzey",
  "zemin-ve-yuzey": "zemin-yuzey",
  "mobilya-ic-mekan": "ic-mekan-mobilya",
  "ic-mekan-ve-mobilya": "ic-mekan-mobilya",
  "mutfak-banyo-wellness": "mutfak-banyo",
  "dis-mekan-ve-peyzaj": "dis-mekan-peyzaj",
  "yapi-ve-cephe": "yapi-cephe",
  aydinlatma: "teknik-sistemler",
};

/**
 * @param {string} slug
 * @returns {string}
 */

/**
 * @param {{ group?: string; category?: string; subcategory?: string }} p
 */
export function buildProductListPath(p) {
  const g = String(p.group || "").trim();
  const c = String(p.category || "").trim();
  const s = String(p.subcategory || "").trim();
  if (!g && !c && !s) return PRODUCT_CATALOG_BASE;
  if (!c) return `${PRODUCT_CATALOG_BASE}/${g}`;
  if (!s) return `${PRODUCT_CATALOG_BASE}/${g}/${c}`;
  return `${PRODUCT_CATALOG_BASE}/${g}/${c}/${s}`;
}

/** @param {TaxonomyNode[]} tree @param {string} groupSlug */
export function findGroupBySlug(tree, groupSlug) {
  const clean = String(groupSlug || "").trim();
  if (!clean || !tree?.length) return null;
  const canon = L1_SEGMENT_ALIASES[clean] || clean;
  for (const node of tree) {
    if (node.level === 1 && node.slug === canon) return node;
  }
  return null;
}

/**
 * L1 group filtresi için alt L2/L3 düğümlerini ve slug setlerini toplar.
 * @param {TaxonomyNode[]} tree
 * @param {string} groupSlug
 */
export function collectTaxonomyScopeForL1(tree, groupSlug) {
  const l1 = findGroupBySlug(tree, groupSlug);
  if (!l1) return null;

  const l2Nodes = (l1.children ?? []).filter((n) => n.level === 2);
  const l3Nodes = [];
  const l2Slugs = new Set();

  for (const l2 of l2Nodes) {
    for (const alias of categorySlugAliases(l2.slug)) {
      l2Slugs.add(alias);
    }
    for (const l3 of l2.children ?? []) {
      if (l3.level === 3) l3Nodes.push(l3);
    }
  }

  const l3Slugs = [...new Set(l3Nodes.map((n) => String(n.slug || "").trim()).filter(Boolean))];

  return { l1, l2Nodes, l3Nodes, l2Slugs, l3Slugs };
}

/** @param {TaxonomyNode} l1 @param {string} categorySlug */
export function findCategoryUnderGroup(l1, categorySlug) {
  const wanted = new Set(categorySlugAliases(categorySlug));
  for (const l2 of l1.children ?? []) {
    if (l2.level === 2 && wanted.has(l2.slug)) return l2;
  }
  return null;
}

/** @param {TaxonomyNode} l2 @param {string} subSlug */
export function findSubcategoryUnderCategory(l2, subSlug) {
  const clean = String(subSlug || "").trim();
  for (const l3 of l2.children ?? []) {
    if (l3.level === 3 && l3.slug === clean) return l3;
  }
  return null;
}

/**
 * @param {TaxonomyNode[]} tree
 * @param {string} categorySlug
 * @returns {{ group: string; category: string } | null}
 */
export function findPathByCategorySlug(tree, categorySlug) {
  const wanted = new Set(categorySlugAliases(categorySlug));
  for (const l1 of tree) {
    if (l1.level !== 1) continue;
    for (const l2 of l1.children ?? []) {
      if (l2.level === 2 && wanted.has(l2.slug)) {
        return { group: l1.slug, category: l2.slug };
      }
    }
  }
  return null;
}

/**
 * @param {TaxonomyNode[]} tree
 * @param {string} subcategorySlug
 * @returns {{ group: string; category: string; subcategory: string } | null}
 */
export function findPathBySubcategorySlug(tree, subcategorySlug) {
  const clean = String(subcategorySlug || "").trim();
  if (!clean) return null;
  for (const l1 of tree) {
    if (l1.level !== 1) continue;
    for (const l2 of l1.children ?? []) {
      if (l2.level !== 2) continue;
      for (const l3 of l2.children ?? []) {
        if (l3.level === 3 && l3.slug === clean) {
          return { group: l1.slug, category: l2.slug, subcategory: l3.slug };
        }
      }
    }
  }
  return null;
}

/**
 * @param {TaxonomyNode[]} nodes
 * @param {string} slug
 * @returns {TaxonomyNode | null}
 */
export function findTaxonomyNodeBySlug(nodes, slug) {
  const clean = String(slug || "").trim();
  if (!clean) return null;
  for (const node of nodes) {
    if (node.slug === clean) return node;
    const child = findTaxonomyNodeBySlug(node.children ?? [], clean);
    if (child) return child;
  }
  return null;
}

export function findTaxonomyL2(tree, categorySlug) {
  const wanted = new Set(categorySlugAliases(categorySlug));
  for (const l1 of tree) {
    if (l1.level !== 1) continue;
    for (const l2 of l1.children ?? []) {
      if (l2.level === 2 && wanted.has(l2.slug)) {
        const l3Children = (l2.children ?? []).filter((n) => n.level === 3);
        return { l1, l2, l3Children };
      }
    }
  }
  return null;
}

/**
 * @param {TaxonomyNode[]} tree
 * @param {string[]} segments decoded path segments (1..3)
 */
export function resolveTaxonomyPathFromSegments(tree, segments) {
  if (!segments?.length) {
    return { ok: true, group: "", category: "", subcategory: "", canonicalPath: PRODUCT_CATALOG_BASE };
  }
  if (segments.length > 3) {
    return { ok: false };
  }

  const a = L1_SEGMENT_ALIASES[segments[0]] || segments[0];
  const b = segments[1] ? segments[1] : "";
  const c = segments[2] ? segments[2] : "";

  if (segments.length === 1) {
    const l1 = findGroupBySlug(tree, a);
    if (!l1) return { ok: false };
    const path = buildProductListPath({ group: l1.slug, category: "", subcategory: "" });
    return { ok: true, group: l1.slug, category: "", subcategory: "", canonicalPath: path };
  }

  if (segments.length === 2) {
    const l1 = findGroupBySlug(tree, a);
    if (!l1) return { ok: false };
    const l2 = findCategoryUnderGroup(l1, b);
    if (!l2) return { ok: false };
    const path = buildProductListPath({ group: l1.slug, category: l2.slug, subcategory: "" });
    return { ok: true, group: l1.slug, category: l2.slug, subcategory: "", canonicalPath: path };
  }

  const l1 = findGroupBySlug(tree, a);
  if (!l1) return { ok: false };
  const l2 = findCategoryUnderGroup(l1, b);
  if (!l2) return { ok: false };
  const l3 = findSubcategoryUnderCategory(l2, c);
  if (!l3) return { ok: false };
  const path = buildProductListPath({ group: l1.slug, category: l2.slug, subcategory: l3.slug });
  return { ok: true, group: l1.slug, category: l2.slug, subcategory: l3.slug, canonicalPath: path };
}

/**
 * Eski ?group=&category=&subcategory= ile gelen istekleri temiz path + kalan facet query'ye çevirir.
 * @param {URL} url
 * @returns {string | null} redirect hedefi veya null
 */
export function legacyTaxonomyQueryRedirect(url) {
  const sp = url.searchParams;
  const rawG = sp.get("group") || "";
  const rawC = sp.get("category") || "";
  const rawS = sp.get("subcategory") || "";
  if (!rawG && !rawC && !rawS) return null;

  const norm = normalizeLegacyTaxonomyFilters({
    group: rawG,
    category: rawC,
    subcategory: rawS,
  });

  let group = norm.group.trim();
  let category = norm.category.trim();
  let subcategory = norm.subcategory.trim();

  const tree = getTaxonomyTree();

  if (!group && category && subcategory) {
    const bySub = findPathBySubcategorySlug(tree, subcategory);
    if (bySub) {
      group = bySub.group;
      category = bySub.category;
      subcategory = bySub.subcategory;
    }
  }

  if (!group && category) {
    const hit = findPathByCategorySlug(tree, category);
    if (hit) {
      group = hit.group;
      category = hit.category;
    }
  }

  if (!group && category && subcategory) {
    const hit = findTaxonomyL2(tree, category);
    if (hit) {
      group = hit.l1.slug;
    }
  }

  if (category && subcategory) {
    const hit = findTaxonomyL2(tree, category);
    if (hit) {
      const okL3 = hit.l3Children.some((n) => n.slug === subcategory);
      if (!okL3) subcategory = "";
    }
  }

  const path = buildProductListPath({ group, category, subcategory });

  const next = new URLSearchParams(sp);
  next.delete("group");
  next.delete("category");
  next.delete("subcategory");
  const qs = next.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * Path + query'den katalog filtreleri (taxonomy path üzerinden).
 * @param {URL} url
 * @param {{ group: string; category: string; subcategory: string }} pathFilters
 */
export function facetParamsFromUrl(url, pathFilters) {
  const sp = new URLSearchParams(url.searchParams);
  sp.delete("group");
  sp.delete("category");
  sp.delete("subcategory");
  return {
    search: sp.get("q") || "",
    brand: sp.get("brand") || "",
    group: pathFilters.group || "",
    category: pathFilters.category || "",
    subcategory: pathFilters.subcategory || "",
    material: sp.get("material") || "",
    usageArea: sp.get("usageArea") || "",
    colorFamily: sp.get("colorFamily") || "",
    fireClass: sp.get("fireClass") || "",
    indoorOutdoor: sp.get("indoorOutdoor") || "",
    country: sp.get("country") || "",
    city: sp.get("city") || "",
    role: sp.get("role") || "",
    sort: sp.get("sort") || "created_desc",
    hasPdf: sp.get("hasPdf") === "1",
    hasCad: sp.get("hasCad") === "1",
    hasBim: sp.get("hasBim") === "1",
  };
}

/**
 * @param {URL} url
 * @param {Record<string, string | boolean>} filters getProductListPage filters
 */
export function buildFacetQueryString(url, filters) {
  const next = new URLSearchParams();
  const setIf = (k, v) => {
    if (v === "" || v == null || v === false) return;
    next.set(k, String(v));
  };
  setIf("q", filters.search);
  setIf("brand", filters.brand);
  setIf("material", filters.material);
  setIf("usageArea", filters.usageArea);
  setIf("colorFamily", filters.colorFamily);
  setIf("fireClass", filters.fireClass);
  setIf("indoorOutdoor", filters.indoorOutdoor);
  setIf("country", filters.country);
  setIf("city", filters.city);
  setIf("role", filters.role);
  setIf("sort", filters.sort && filters.sort !== "created_desc" ? filters.sort : "");
  if (filters.hasPdf) next.set("hasPdf", "1");
  if (filters.hasCad) next.set("hasCad", "1");
  if (filters.hasBim) next.set("hasBim", "1");
  return next.toString();
}

/**
 * @param {string} listingPath
 * @param {URL} url
 * @param {(prev: URLSearchParams) => void} mutator
 */
export function buildListingHref(listingPath, url, mutator) {
  const next = new URLSearchParams(url.searchParams);
  next.delete("group");
  next.delete("category");
  next.delete("subcategory");
  mutator(next);
  const qs = next.toString();
  return qs ? `${listingPath}?${qs}` : listingPath;
}
