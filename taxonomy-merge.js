/**
 * JSON taxonomy + DB visibility + admin custom L2/L3 append (shared: catalog SSR + productService client).
 */

export const FINAL_L1_SLUGS = new Set([
  "zemin-yuzey",
  "yapi-cephe",
  "ic-mekan-mobilya",
  "mutfak-banyo",
  "teknik-sistemler",
  "dis-mekan-peyzaj",
]);

const DEFAULT_SORT = 9999;

/** @param {Record<string, unknown> | null | undefined} row */
export function isRowArchived(row) {
  return Boolean(row && row.archived_at != null && row.archived_at !== "");
}

/** @param {Record<string, unknown> | null | undefined} row @param {"admin"|"public"|"brandForm"} [surface] */
export function isCustomEligibleRow(row, surface = "public") {
  if (!row) return false;
  if (row.source !== "admin" && row.is_custom !== true) return false;
  if (surface === "admin") return true;
  if (isRowArchived(row)) return false;
  return true;
}

/** @param {Record<string, unknown> | null | undefined} row @param {string} field @param {boolean} defaultValue */
export function visibilityFlag(row, field, defaultValue = true) {
  if (!row || row[field] == null) return defaultValue;
  return row[field] !== false;
}

/**
 * @param {string} slug
 * @param {Record<string, Record<string, unknown>>} bySlug
 * @param {(slug: string) => string[]} slugAliases
 */
export function visibilityRowForSlug(slug, bySlug, slugAliases) {
  if (!slug || !bySlug) return null;
  const aliases = slugAliases ? slugAliases(slug) : [slug];
  for (const alias of aliases) {
    if (bySlug[alias]) return bySlug[alias];
  }
  return null;
}

/** @param {Record<string, Record<string, unknown>>} bySlug @param {(slug: string) => string[]} slugAliases */
export function expandVisibilitySlugMap(bySlug, slugAliases) {
  const out = { ...bySlug };
  for (const [slug, row] of Object.entries(bySlug)) {
    for (const alias of slugAliases(slug)) {
      out[alias] = row;
    }
  }
  return out;
}

/** @param {{ sort_order?: number | null; name_tr?: string; name?: string }} a @param {{ sort_order?: number | null; name_tr?: string; name?: string }} b */
export function compareTaxonomySort(a, b) {
  const ao = a.sort_order ?? DEFAULT_SORT;
  const bo = b.sort_order ?? DEFAULT_SORT;
  if (ao !== bo) return ao - bo;
  const an = String(a.name_tr || a.name || "");
  const bn = String(b.name_tr || b.name || "");
  return an.localeCompare(bn, "tr");
}

/** @param {import("./src/lib/product-taxonomy-routes.js").TaxonomyNode[]} tree */
function indexJsonTreeSlugs(tree) {
  /** @type {Map<string, Set<string>>} */
  const l2SlugsByL1 = new Map();
  /** @type {Map<string, Set<string>>} */
  const l3SlugsByL2 = new Map();

  for (const l1 of tree) {
    const l1Slug = String(l1?.slug || "").trim();
    if (!l1Slug) continue;
    const l2Set = new Set();
    for (const l2 of l1.children || []) {
      if (l2.level !== 2) continue;
      const l2Slug = String(l2.slug || "").trim();
      if (!l2Slug) continue;
      l2Set.add(l2Slug);
      const l3Set = new Set();
      for (const l3 of l2.children || []) {
        if (l3.level === 3 && l3.slug) l3Set.add(String(l3.slug).trim());
      }
      l3SlugsByL2.set(l2Slug, l3Set);
    }
    l2SlugsByL1.set(l1Slug, l2Set);
  }

  return { l2SlugsByL1, l3SlugsByL2 };
}

/** @param {import("./src/lib/product-taxonomy-routes.js").TaxonomyNode} node */
function applyDbDefaultsToL2(node) {
  node.db_id = null;
  node.is_active = true;
  node.show_in_header_dropdown = true;
  node.show_in_products_filter = true;
  node.show_in_brand_product_form = true;
}

/** @param {import("./src/lib/product-taxonomy-routes.js").TaxonomyNode} node @param {string | null} parentDbId */
function applyDbDefaultsToL3(node, parentDbId) {
  node.db_id = null;
  node.parent_db_id = parentDbId ?? null;
  node.is_active = true;
  node.show_in_products_filter = true;
  node.show_in_brand_product_form = true;
}

/**
 * @param {import("./src/lib/product-taxonomy-routes.js").TaxonomyNode} node
 * @param {Record<string, Record<string, unknown>>} l2BySlug
 * @param {(slug: string) => string[]} slugAliases
 */
function applyArchiveMetaToNode(node, row) {
  if (!row) return;
  node.archived_at = row.archived_at ?? null;
  node.is_archived = isRowArchived(row);
  if (row.source != null) node.source = row.source;
  if (row.is_custom != null) node.is_custom = row.is_custom === true;
}

function mergeL2NodeFromDb(node, l2BySlug, slugAliases) {
  const row = visibilityRowForSlug(node.slug, l2BySlug, slugAliases);
  if (!row) {
    applyDbDefaultsToL2(node);
    node.archived_at = null;
    node.is_archived = false;
    return;
  }
  node.db_id = row.id ?? null;
  applyArchiveMetaToNode(node, row);
  node.is_active = visibilityFlag(row, "is_active");
  node.show_in_header_dropdown = visibilityFlag(row, "show_in_header_dropdown");
  node.show_in_products_filter = visibilityFlag(row, "show_in_products_filter");
  node.show_in_brand_product_form = visibilityFlag(row, "show_in_brand_product_form");
  if (node.is_archived || node.is_active === false) {
    node.is_active = false;
    node.show_in_header_dropdown = false;
    node.show_in_products_filter = false;
    node.show_in_brand_product_form = false;
  }
}

/**
 * @param {import("./src/lib/product-taxonomy-routes.js").TaxonomyNode} node
 * @param {Record<string, Record<string, unknown>>} l3BySlug
 * @param {string | null} parentDbId
 * @param {(slug: string) => string[]} slugAliases
 */
function mergeL3NodeFromDb(node, l3BySlug, parentDbId, slugAliases) {
  const row = visibilityRowForSlug(node.slug, l3BySlug, slugAliases);
  if (!row) {
    applyDbDefaultsToL3(node, parentDbId);
    node.archived_at = null;
    node.is_archived = false;
    return;
  }
  node.db_id = row.id ?? null;
  node.parent_db_id = row.category_id ?? parentDbId ?? null;
  applyArchiveMetaToNode(node, row);
  node.is_active = visibilityFlag(row, "is_active");
  node.show_in_products_filter = visibilityFlag(row, "show_in_products_filter");
  node.show_in_brand_product_form = visibilityFlag(row, "show_in_brand_product_form");
  if (node.is_archived || node.is_active === false) {
    node.is_active = false;
    node.show_in_products_filter = false;
    node.show_in_brand_product_form = false;
  }
}

/**
 * @param {Record<string, unknown>} row
 * @param {(p: { group?: string; category?: string; subcategory?: string }) => string} buildProductListPath
 */
function buildCustomL2Node(row, buildProductListPath) {
  const l1Slug = String(row.l1_slug || "").trim();
  const slug = String(row.slug || "").trim();
  const archived = isRowArchived(row);
  const isActive = !archived && visibilityFlag(row, "is_active");
  return {
    name_tr: String(row.name || "").trim() || slug,
    slug,
    level: 2,
    parent_slug: l1Slug,
    l1_slug: l1Slug,
    show_in_header_dropdown: isActive && visibilityFlag(row, "show_in_header_dropdown"),
    show_in_navigation: true,
    public_visible_rule: "always_show_l1_l2_in_navigation",
    selectable_in_brand_panel: true,
    canonical_product_category: false,
    source: row.source || "admin",
    products_path: buildProductListPath({ group: l1Slug, category: slug }),
    children: [],
    db_id: row.id ?? null,
    is_active: isActive,
    show_in_products_filter: isActive && visibilityFlag(row, "show_in_products_filter"),
    show_in_brand_product_form: isActive && visibilityFlag(row, "show_in_brand_product_form"),
    sort_order: row.sort_order ?? DEFAULT_SORT,
    is_custom: row.is_custom === true,
    archived_at: row.archived_at ?? null,
    is_archived: archived,
  };
}

/**
 * @param {Record<string, unknown>} row
 * @param {import("./src/lib/product-taxonomy-routes.js").TaxonomyNode} parentL1
 * @param {import("./src/lib/product-taxonomy-routes.js").TaxonomyNode} parentL2
 * @param {(p: { group?: string; category?: string; subcategory?: string }) => string} buildProductListPath
 */
function buildCustomL3Node(row, parentL1, parentL2, buildProductListPath) {
  const slug = String(row.slug || "").trim();
  const archived = isRowArchived(row);
  const isActive = !archived && visibilityFlag(row, "is_active");
  return {
    name_tr: String(row.name || "").trim() || slug,
    slug,
    level: 3,
    parent_slug: parentL2.slug,
    show_in_header_dropdown: false,
    show_in_navigation: false,
    public_visible_rule: "show_if_has_published_products",
    selectable_in_brand_panel: true,
    canonical_product_category: true,
    source: row.source || "admin",
    products_path: buildProductListPath({
      group: parentL1.slug,
      category: parentL2.slug,
      subcategory: slug,
    }),
    children: [],
    db_id: row.id ?? null,
    category_id: row.category_id ?? null,
    parent_db_id: parentL2.db_id ?? row.category_id ?? null,
    is_active: isActive,
    show_in_products_filter: isActive && visibilityFlag(row, "show_in_products_filter"),
    show_in_brand_product_form: isActive && visibilityFlag(row, "show_in_brand_product_form"),
    sort_order: row.sort_order ?? DEFAULT_SORT,
    is_custom: row.is_custom === true,
    archived_at: row.archived_at ?? null,
    is_archived: archived,
  };
}

/** @param {import("./src/lib/product-taxonomy-routes.js").TaxonomyNode[]} tree */
function filterArchivedFromPublicTree(tree) {
  for (const l1 of tree) {
    const l2List = [];
    for (const l2 of l1.children || []) {
      if (l2.level !== 2 || l2.is_archived) continue;
      const l3List = (l2.children || []).filter((l3) => l3.level === 3 && !l3.is_archived);
      l2.children = l3List;
      l2List.push(l2);
    }
    l1.children = l2List;
  }
  return tree;
}

/**
 * @param {import("./src/lib/product-taxonomy-routes.js").TaxonomyNode[]} tree
 * @param {Record<string, unknown>[]} categoryRows
 * @param {Record<string, unknown>[]} subcategoryRows
 * @param {(p: { group?: string; category?: string; subcategory?: string }) => string} buildProductListPath
 * @param {(slug: string) => string[]} categorySlugAliases
 * @param {"admin"|"public"|"brandForm"} surface
 */
function appendCustomDbNodes(tree, categoryRows, subcategoryRows, buildProductListPath, surface) {
  const { l2SlugsByL1, l3SlugsByL2 } = indexJsonTreeSlugs(tree);

  /** @type {Map<string, import("./src/lib/product-taxonomy-routes.js").TaxonomyNode>} */
  const l2ByDbId = new Map();
  for (const l1 of tree) {
    for (const l2 of l1.children || []) {
      if (l2.level === 2 && l2.db_id) l2ByDbId.set(String(l2.db_id), l2);
    }
  }

  const customL2 = (categoryRows || [])
    .filter((row) => isCustomEligibleRow(row, surface))
    .filter((row) => {
      const l1Slug = String(row.l1_slug || "").trim();
      const slug = String(row.slug || "").trim();
      if (!l1Slug || !slug || !FINAL_L1_SLUGS.has(l1Slug)) return false;
      const jsonL2 = l2SlugsByL1.get(l1Slug);
      return !(jsonL2 && jsonL2.has(slug));
    })
    .sort(compareTaxonomySort);

  for (const row of customL2) {
    const l1Slug = String(row.l1_slug).trim();
    const l1 = tree.find((n) => n.slug === l1Slug);
    if (!l1) continue;
    if (!l1.children) l1.children = [];
    const node = buildCustomL2Node(row, buildProductListPath);
    l1.children.push(node);
    const l2Slug = node.slug;
    if (!l2SlugsByL1.has(l1Slug)) l2SlugsByL1.set(l1Slug, new Set());
    l2SlugsByL1.get(l1Slug).add(l2Slug);
    if (!l3SlugsByL2.has(l2Slug)) l3SlugsByL2.set(l2Slug, new Set());
    if (node.db_id) l2ByDbId.set(String(node.db_id), node);
  }

  const customL3 = (subcategoryRows || [])
    .filter((row) => isCustomEligibleRow(row, surface))
    .filter((row) => {
      const slug = String(row.slug || "").trim();
      const categoryId = row.category_id ? String(row.category_id) : "";
      if (!slug || !categoryId) return false;
      const parentL2 = l2ByDbId.get(categoryId);
      if (!parentL2) return false;
      const l3Set = l3SlugsByL2.get(parentL2.slug) || new Set();
      return !l3Set.has(slug);
    })
    .sort(compareTaxonomySort);

  for (const row of customL3) {
    const parentL2 = l2ByDbId.get(String(row.category_id));
    if (!parentL2) continue;
    const parentL1 = tree.find((l1) =>
      (l1.children || []).some((l2) => l2 === parentL2 || l2.slug === parentL2.slug),
    );
    if (!parentL1) continue;
    if (!parentL2.children) parentL2.children = [];
    const node = buildCustomL3Node(row, parentL1, parentL2, buildProductListPath);
    parentL2.children.push(node);
    const l3Set = l3SlugsByL2.get(parentL2.slug) || new Set();
    l3Set.add(node.slug);
    l3SlugsByL2.set(parentL2.slug, l3Set);
  }

  for (const l1 of tree) {
    const l2List = (l1.children || []).filter((n) => n.level === 2);
    l2List.sort(compareTaxonomySort);
    l1.children = l2List;
    for (const l2 of l2List) {
      const l3List = (l2.children || []).filter((n) => n.level === 3);
      l3List.sort(compareTaxonomySort);
      l2.children = l3List;
    }
  }
}

/**
 * @param {{
 *   rawTree: import("./src/lib/product-taxonomy-routes.js").TaxonomyNode[];
 *   categoryRows: Record<string, unknown>[];
 *   subcategoryRows: Record<string, unknown>[];
 *   buildProductListPath: (p: { group?: string; category?: string; subcategory?: string }) => string;
 *   categorySlugAliases: (slug: string) => string[];
 *   surface?: "admin"|"public"|"brandForm";
 * }} input
 * @returns {import("./src/lib/product-taxonomy-routes.js").TaxonomyNode[]}
 */
export function mergeTaxonomyTreeWithDatabase({
  rawTree,
  categoryRows,
  subcategoryRows,
  buildProductListPath,
  categorySlugAliases,
  surface = "public",
}) {
  const l2BySlug = {};
  for (const row of categoryRows || []) {
    if (row?.slug) l2BySlug[String(row.slug)] = row;
  }
  const l3BySlug = {};
  for (const row of subcategoryRows || []) {
    if (row?.slug) l3BySlug[String(row.slug)] = row;
  }

  const expandedL2 = expandVisibilitySlugMap(l2BySlug, categorySlugAliases);
  const expandedL3 = expandVisibilitySlugMap(l3BySlug, categorySlugAliases);

  const tree = structuredClone(rawTree).filter((l1) => FINAL_L1_SLUGS.has(l1?.slug));

  for (const l1 of tree) {
    for (const l2 of l1.children || []) {
      if (l2.level !== 2) continue;
      mergeL2NodeFromDb(l2, expandedL2, categorySlugAliases);
      for (const l3 of l2.children || []) {
        if (l3.level !== 3) continue;
        mergeL3NodeFromDb(l3, expandedL3, l2.db_id, categorySlugAliases);
      }
    }
  }

  appendCustomDbNodes(tree, categoryRows, subcategoryRows, buildProductListPath, surface);

  if (surface !== "admin") {
    filterArchivedFromPublicTree(tree);
  }

  return tree;
}
