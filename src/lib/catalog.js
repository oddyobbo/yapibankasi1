import {
  PRODUCT_FILTER_FIELDS,
  approvedBrandsQuery,
  getApprovedBrandRecordIds,
  publishedCatalogProductsQuery,
  publishedProjectsQuery,
  safeData,
  supabase,
} from "./supabase.js";
import { slugify } from "./slugs.js";
import { mergeTaxonomyTreeWithDatabase } from "../../taxonomy-merge.js";
import {
  buildProductListPath,
  categorySlugAliases,
  collectTaxonomyScopeForL1,
  getTaxonomyTree,
} from "./product-taxonomy-routes.js";

export const PRODUCT_PAGE_SIZE = 24;

export const imageForProduct = (product) => (
  product?.card_image_url ||
  product?.thumbnail_url ||
  product?.gallery_image_url ||
  product?.image ||
  ""
);

export const galleryForProduct = (product, images = []) => {
  const structured = images
    .map((img) => img.gallery_url || img.url)
    .filter(Boolean);
  const legacy = [product?.gallery_image_url, product?.image].filter(Boolean);
  return structured.length ? structured : legacy;
};

const compact = (value) => String(value || "").trim();
const isMissingRow = (error) => !error || error.code === "PGRST116";

const uniqueSorted = (values) => [...new Set(values.map(compact).filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, "tr"));

/** PostgREST ilike metninde % ve virgül kırılmasını azaltır. */
const safeIlikeToken = (value) => compact(value).replace(/%/g, "").replace(/,/g, "").slice(0, 120);

const EMPTY_UUID = "00000000-0000-0000-0000-000000000000";

function dbCategoryMatchesL2Slug(dbCategory, l2SlugSet) {
  const slug = compact(dbCategory?.slug);
  if (!slug) return false;
  if (l2SlugSet.has(slug)) return true;
  for (const alias of categorySlugAliases(slug)) {
    if (l2SlugSet.has(alias)) return true;
  }
  return false;
}

/**
 * L1 path için taxonomy altındaki L2/L3 → DB id + category string token'ları.
 * @param {string} groupSlug
 */
async function resolveL1GroupFilterScope(groupSlug) {
  const tree = await getPublicTaxonomyTree();
  const scope = collectTaxonomyScopeForL1(tree, groupSlug);
  if (!scope) return null;

  const { l1, l2Nodes, l3Nodes, l2Slugs, l3Slugs } = scope;

  const allCategories = await getCategories();
  const categoryIds = allCategories
    .filter((row) => dbCategoryMatchesL2Slug(row, l2Slugs))
    .map((row) => row.id)
    .filter(Boolean);

  let subcategoryIds = [];
  if (l3Slugs.length) {
    const subs = safeData(
      await supabase.from("product_subcategories").select("id,slug").in("slug", l3Slugs),
    );
    subcategoryIds = subs.map((row) => row.id).filter(Boolean);
  }

  const ilikeTokens = uniqueSorted([
    l1.name_tr,
    ...l2Nodes.map((n) => n.name_tr),
    ...l3Nodes.map((n) => n.name_tr),
    ...[...l2Slugs].map((s) => s.replace(/-/g, " ")),
    compact(l1.slug).replace(/-/g, " "),
  ]);

  return { categoryIds, subcategoryIds, ilikeTokens };
}

/** @param {object} groupScope */
function applyL1GroupScopeFilter(query, groupScope) {
  if (!groupScope) return query;

  const orParts = [];
  if (groupScope.categoryIds.length) {
    orParts.push(`category_id.in.(${groupScope.categoryIds.join(",")})`);
  }
  if (groupScope.subcategoryIds.length) {
    orParts.push(`subcategory_id.in.(${groupScope.subcategoryIds.join(",")})`);
  }
  const hasIdScope = groupScope.categoryIds.length > 0 || groupScope.subcategoryIds.length > 0;
  if (!hasIdScope) {
    for (const token of groupScope.ilikeTokens.slice(0, 14)) {
      const t = safeIlikeToken(token);
      if (t) orParts.push(`category.ilike.%${t}%`);
    }
  }

  if (!orParts.length) {
    return query.eq("id", EMPTY_UUID);
  }
  return query.or(orParts.join(","));
}

const applyProductFilters = (query, filters = {}, resolution = {}) => {
  const search = compact(filters.search);
  const brand = compact(filters.brand);
  const category = compact(filters.category);
  const subcategory = compact(filters.subcategory);
  const { categoryRow, subcategoryRow, brandRow, groupScope } = resolution;
  const material = compact(filters.material);
  const usageArea = compact(filters.usageArea);
  const colorFamily = compact(filters.colorFamily);
  const fireClass = compact(filters.fireClass);
  const indoorOutdoor = compact(filters.indoorOutdoor);
  const country = compact(filters.country);
  const city = compact(filters.city);
  const role = compact(filters.role);

  let next = query;
  if (search) {
    const t = `%${safeIlikeToken(search)}%`;
    next = next.or(`name.ilike.${t},summary.ilike.${t},description.ilike.${t},brand_name.ilike.${t},category.ilike.${t}`);
  }
  if (brandRow?.id) {
    next = next.eq("brand_record_id", brandRow.id);
  } else if (brand) {
    next = next.ilike("brand_name", `%${safeIlikeToken(brand)}%`);
  }
  if (categoryRow?.id) {
    next = next.eq("category_id", categoryRow.id);
  } else if (category) {
    next = next.ilike("category", `%${category.replace(/-/g, " ")}%`);
  }
  if (subcategoryRow?.id) {
    next = next.eq("subcategory_id", subcategoryRow.id);
  } else if (
    !category &&
    !categoryRow?.id &&
    !subcategory &&
    !subcategoryRow?.id &&
    groupScope
  ) {
    next = applyL1GroupScopeFilter(next, groupScope);
  }
  if (material) next = next.eq("material", material);
  if (usageArea) next = next.ilike("usage_area", `%${usageArea}%`);
  if (colorFamily) next = next.eq("color_family", colorFamily);
  if (fireClass) next = next.eq("fire_class", fireClass);
  if (indoorOutdoor) next = next.eq("indoor_outdoor", indoorOutdoor);
  if (country) next = next.eq("country", country);
  if (city) next = next.eq("city", city);
  if (role) next = next.contains("company_roles", [role]);
  if (filters.hasPdf) next = next.eq("has_pdf", true);
  if (filters.hasCad) next = next.eq("has_cad", true);
  if (filters.hasBim) next = next.eq("has_bim", true);
  return next;
};

const applyProductSort = (query, sort = "created_desc") => {
  switch (sort) {
    case "name_asc":
      return query.order("name", { ascending: true });
    case "name_desc":
      return query.order("name", { ascending: false });
    case "brand_asc":
      return query.order("brand_name", { ascending: true }).order("name", { ascending: true });
    case "brand_desc":
      return query.order("brand_name", { ascending: false }).order("name", { ascending: true });
    case "created_asc":
      return query.order("created_at", { ascending: true });
    case "created_desc":
    default:
      return query.order("created_at", { ascending: false });
  }
};

export const getProducts = async ({ limit = PRODUCT_PAGE_SIZE, categorySlug, brandSlug } = {}) => {
  const approvedIds = await getApprovedBrandRecordIds();
  let query = publishedCatalogProductsQuery(approvedIds).order("created_at", { ascending: false }).limit(limit);
  if (categorySlug) query = query.ilike("category", `%${categorySlug.replace(/-/g, "%")}%`);
  if (brandSlug) query = query.ilike("brand_name", `%${brandSlug.replace(/-/g, "%")}%`);
  return safeData(await query);
};

export const getProductFilterOptions = async () => {
  const approvedIds = await getApprovedBrandRecordIds();
  const [facets, brandsRes, categories] = await Promise.all([
    publishedCatalogProductsQuery(approvedIds).select(PRODUCT_FILTER_FIELDS).limit(1000),
    supabase.from("brands").select("id,name,slug").eq("status", "approved").order("name", { ascending: true }),
    getCategories(),
  ]);
  const rows = safeData(facets);
  const brandRows = safeData(brandsRes);
  const roles = rows.flatMap((row) => Array.isArray(row.company_roles) ? row.company_roles : []);
  const brandsTaxonomy = brandRows.map((b) => ({
    id: b.id,
    name: b.name,
    slug: compact(b.slug) || slugify(b.name),
  }));
  return {
    brandsTaxonomy,
    categoriesTaxonomy: categories,
    brands: uniqueSorted([
      ...brandRows.map((brand) => brand.name),
      ...rows.map((row) => row.brand_name),
    ]),
    categories: uniqueSorted([
      ...categories.map((category) => category.name),
      ...rows.map((row) => String(row.category || "").split(">")[0]),
    ]),
    materials: uniqueSorted(rows.map((row) => row.material)),
    usageAreas: uniqueSorted(rows.map((row) => row.usage_area)),
    colorFamilies: uniqueSorted(rows.map((row) => row.color_family)),
    fireClasses: uniqueSorted(rows.map((row) => row.fire_class)),
    countries: uniqueSorted(rows.map((row) => row.country)),
    cities: uniqueSorted(rows.map((row) => row.city)),
    roles: uniqueSorted(roles),
  };
};

export const getProductBySlug = async (slug, preloadedApprovedBrandIds) => {
  const approvedIds = preloadedApprovedBrandIds ?? (await getApprovedBrandRecordIds());
  const cleanSlug = decodeURIComponent(slug || "");
  const base = publishedCatalogProductsQuery(approvedIds);
  const direct = await base.eq("slug", cleanSlug).maybeSingle();
  if (direct.data || direct.error?.code !== "PGRST116") return direct.data || null;

  const { data } = await base.limit(80);
  return (data || []).find((product) => slugify(product.slug || product.name) === cleanSlug) || null;
};

const getBrandForProduct = async (product) => {
  if (!product) return null;
  if (product.brand_record_id) {
    const byId = await approvedBrandsQuery().eq("id", product.brand_record_id).maybeSingle();
    if (byId.data || !isMissingRow(byId.error)) return byId.data || null;
  }
  const brandSlug = slugify(product.brand_name);
  if (brandSlug) {
    const bySlug = await approvedBrandsQuery().eq("slug", brandSlug).maybeSingle();
    if (bySlug.data || !isMissingRow(bySlug.error)) return bySlug.data || null;
  }
  if (product.brand_name) {
    const byName = await approvedBrandsQuery().eq("name", product.brand_name).maybeSingle();
    if (byName.data || !isMissingRow(byName.error)) return byName.data || null;
  }
  return null;
};

const getCategoryForProduct = async (product) => {
  if (!product?.category_id) return { category: null, subcategory: null };
  const [category, subcategory] = await Promise.all([
    supabase.from("product_categories").select("*").eq("id", product.category_id).maybeSingle(),
    product.subcategory_id
      ? supabase.from("product_subcategories").select("*").eq("id", product.subcategory_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    category: category.data || null,
    subcategory: subcategory.data || null,
  };
};

const getRelatedProductsForProduct = async (product, approvedBrandIds) => {
  if (!product?.id) return [];
  const base = () => publishedCatalogProductsQuery(approvedBrandIds).neq("id", product.id).limit(8);
  if (
    product.brand_record_id
    && approvedBrandIds.includes(product.brand_record_id)
  ) {
    const byBrandRecord = await base().eq("brand_record_id", product.brand_record_id);
    if (!byBrandRecord.error && byBrandRecord.data?.length) return byBrandRecord.data;
  }
  if (product.category_id) {
    const byCategory = await base().eq("category_id", product.category_id);
    return safeData(byCategory);
  }
  return [];
};

const getRelatedProjectsForProduct = async (product) => {
  if (!product?.id) return [];
  const linkRows = safeData(await supabase
    .from("project_products")
    .select("project_id")
    .eq("product_id", product.id)
    .limit(12));
  const linkedIds = linkRows.map((row) => row.project_id).filter(Boolean);
  if (linkedIds.length) {
    return safeData(await publishedProjectsQuery().in("id", linkedIds).limit(8));
  }

  const productName = compact(product.name);
  if (!productName) return [];
  const materialMatches = safeData(await publishedProjectsQuery().contains("materials", [productName]).limit(8));
  return materialMatches;
};

export const getProductDetail = async (slug) => {
  const approvedIds = await getApprovedBrandRecordIds();
  const product = await getProductBySlug(slug, approvedIds);
  if (!product) return null;
  const [images, files, specs, variants, brand, categoryInfo, relatedProducts, relatedProjects] = await Promise.all([
    supabase.from("product_images").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    supabase.from("product_files").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    supabase.from("product_specs").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    supabase.from("product_variants").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    getBrandForProduct(product),
    getCategoryForProduct(product),
    getRelatedProductsForProduct(product, approvedIds),
    getRelatedProjectsForProduct(product),
  ]);

  return {
    ...product,
    brand,
    categoryRecord: categoryInfo.category,
    subcategoryRecord: categoryInfo.subcategory,
    images: safeData(images),
    files: safeData(files),
    specs: safeData(specs),
    variants: safeData(variants),
    relatedProducts,
    relatedProjects,
  };
};

export const getBrands = async () => safeData(await approvedBrandsQuery().order("name", { ascending: true }));

export const getBrandBySlug = async (slug) => {
  const cleanSlug = decodeURIComponent(slug || "");
  const direct = await approvedBrandsQuery().eq("slug", cleanSlug).maybeSingle();
  if (direct.data || direct.error?.code !== "PGRST116") return direct.data || null;
  const brands = await getBrands();
  return brands.find((brand) => slugify(brand.slug || brand.name) === cleanSlug) || null;
};

export const getBrandDetail = async (slug) => {
  const brand = await getBrandBySlug(slug);
  if (!brand) return null;
  const approvedIds = await getApprovedBrandRecordIds();
  const [products, projects] = await Promise.all([
    publishedCatalogProductsQuery(approvedIds).eq("brand_record_id", brand.id).limit(24),
    publishedProjectsQuery().eq("brand_id", brand.profile_id).limit(12),
  ]);
  return {
    ...brand,
    products: safeData(products),
    projects: safeData(projects),
  };
};

export const getProjects = async ({ limit = 24 } = {}) => safeData(await publishedProjectsQuery().order("created_at", { ascending: false }).limit(limit));

export const getProjectBySlug = async (slug) => {
  const cleanSlug = decodeURIComponent(slug || "");
  const direct = await publishedProjectsQuery().eq("slug", cleanSlug).maybeSingle();
  if (direct.data || direct.error?.code !== "PGRST116") return direct.data || null;
  const { data } = await publishedProjectsQuery().limit(80);
  return (data || []).find((project) => slugify(project.slug || project.title) === cleanSlug) || null;
};

export const imageForProject = (project, images = []) => (
  images.find((image) => image.is_primary)?.url ||
  images[0]?.url ||
  project?.image ||
  ""
);

export const getProjectDetail = async (slug) => {
  const project = await getProjectBySlug(slug);
  if (!project) return null;

  const [imagesRes, productLinksRes] = await Promise.all([
    supabase.from("project_images").select("*").eq("project_id", project.id).order("sort_order", { ascending: true }),
    supabase.from("project_products").select("product_id,note").eq("project_id", project.id),
  ]);

  const images = safeData(imagesRes);
  const productLinks = safeData(productLinksRes);
  const linkedIds = productLinks.map((row) => row.product_id).filter(Boolean);
  const approvedIds = await getApprovedBrandRecordIds();
  const products = linkedIds.length ? safeData(await publishedCatalogProductsQuery(approvedIds).in("id", linkedIds)) : [];

  return {
    ...project,
    images,
    products,
    productLinks,
    heroImage: imageForProject(project, images),
  };
};

export const getCategories = async () => safeData(await supabase
  .from("product_categories")
  .select("*")
  .order("sort_order", { ascending: true }));

export const getCategoryBySlug = async (slug) => {
  const cleanSlug = decodeURIComponent(slug || "");
  const direct = await supabase.from("product_categories").select("*").eq("slug", cleanSlug).maybeSingle();
  if (direct.data || direct.error?.code !== "PGRST116") return direct.data || null;
  const categories = await getCategories();
  return categories.find((category) => slugify(category.slug || category.name) === cleanSlug) || null;
};

export const listSubcategoriesByCategoryId = async (categoryId) => {
  if (!categoryId) return [];
  const { data, error } = await supabase
    .from("product_subcategories")
    .select("id,name,slug,category_id,sort_order")
    .eq("category_id", categoryId)
    .order("sort_order", { ascending: true });
  if (error) return [];
  return data || [];
};

export const resolveProductListFilters = async (filters = {}) => {
  const groupRaw = compact(filters.group);
  const categoryRaw = compact(filters.category);
  const subcategoryRaw = compact(filters.subcategory);
  let categoryRow = null;
  let subcategories = [];
  let subcategoryRow = null;
  let groupScope = null;

  if (categoryRaw) {
    categoryRow = await getCategoryBySlug(categoryRaw);
    if (categoryRow?.id) {
      subcategories = await listSubcategoriesByCategoryId(categoryRow.id);
      if (subcategoryRaw) {
        subcategoryRow = subcategories.find((s) => compact(s.slug) === subcategoryRaw) || null;
      }
    }
  } else if (groupRaw && !subcategoryRaw) {
    groupScope = await resolveL1GroupFilterScope(groupRaw);
  }

  const brandRaw = compact(filters.brand);
  let brandRow = null;
  if (brandRaw) {
    brandRow = await getBrandBySlug(brandRaw);
  }
  return { categoryRow, subcategoryRow, brandRow, subcategories, groupScope };
};

/**
 * Public katalogda görünür L2/L3 için yayınlanmış ürün sayıları (slug anahtarlı).
 * L3: products.subcategory_id; L2: alt L3 + doğrudan category_id.
 * @returns {Promise<{ l2: Record<string, number>, l3: Record<string, number> }>}
 */
export const getVisibleProductCounts = async () => {
  const approvedIds = await getApprovedBrandRecordIds();
  const [categories, subcategoriesRes] = await Promise.all([
    getCategories(),
    supabase.from("product_subcategories").select("id,slug,category_id"),
  ]);
  const subcategories = safeData(subcategoriesRes);

  const categoryIdToSlug = new Map(
    categories.map((row) => [row.id, compact(row.slug)]).filter(([, slug]) => slug),
  );
  const subcategoryIdToSlug = new Map(
    subcategories.map((row) => [row.id, compact(row.slug)]).filter(([, slug]) => slug),
  );
  const subcategoryIdToCategoryId = new Map(
    subcategories.map((row) => [row.id, row.category_id]).filter(([id, catId]) => id && catId),
  );

  const l2 = {};
  const l3 = {};
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    const batchResult = await publishedCatalogProductsQuery(approvedIds)
      .select("category_id,subcategory_id")
      .range(from, from + pageSize - 1);
    const batch = safeData(batchResult);
    for (const row of batch) {
      if (row.subcategory_id) {
        const l3Slug = subcategoryIdToSlug.get(row.subcategory_id);
        if (l3Slug) l3[l3Slug] = (l3[l3Slug] || 0) + 1;
        const parentCategoryId = subcategoryIdToCategoryId.get(row.subcategory_id);
        const l2Slug = parentCategoryId ? categoryIdToSlug.get(parentCategoryId) : "";
        if (l2Slug) l2[l2Slug] = (l2[l2Slug] || 0) + 1;
      } else if (row.category_id) {
        const l2Slug = categoryIdToSlug.get(row.category_id);
        if (l2Slug) l2[l2Slug] = (l2[l2Slug] || 0) + 1;
      }
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return { l2, l3 };
};

export const getProductListPage = async ({ filters = {}, page = 1, pageSize = PRODUCT_PAGE_SIZE } = {}) => {
  const approvedIds = await getApprovedBrandRecordIds();
  const filterResolution = await resolveProductListFilters(filters);
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  const query = applyProductFilters(
    applyProductSort(publishedCatalogProductsQuery(approvedIds, { count: "exact" }), filters.sort),
    filters,
    filterResolution,
  ).range(from, to);
  const result = await query;
  return {
    products: safeData(result),
    count: result.count || 0,
    page: currentPage,
    pageSize,
    hasPrevious: currentPage > 1,
    hasNext: (result.count || 0) > currentPage * pageSize,
    filterResolution,
  };
};

export const getCategoryDetail = async (slug) => {
  const category = await getCategoryBySlug(slug);
  if (!category) return null;
  const approvedIds = await getApprovedBrandRecordIds();
  const products = safeData(
    await publishedCatalogProductsQuery(approvedIds)
      .or(`category_id.eq.${category.id},category.ilike.%${category.name}%`)
      .limit(24),
  );
  return { ...category, products };
};

export const getSitemapCatalogEntries = async () => {
  const approvedIds = await getApprovedBrandRecordIds();
  const [products, brands, projects, categories] = await Promise.all([
    safeData(await publishedCatalogProductsQuery(approvedIds).select("slug,name,updated_at,created_at").limit(5000)),
    safeData(await approvedBrandsQuery().select("slug,name,updated_at,created_at").limit(2000)),
    safeData(await publishedProjectsQuery().select("slug,title,updated_at,created_at").limit(3000)),
    getCategories(),
  ]);
  return { products, brands, projects, categories };
};

const TAXONOMY_CATEGORY_SELECT =
  "id,name,slug,l1_slug,sort_order,is_active,show_in_header_dropdown,show_in_products_filter,show_in_brand_product_form,source,is_custom,archived_at";
const TAXONOMY_SUBCATEGORY_SELECT =
  "id,name,slug,category_id,sort_order,is_active,show_in_products_filter,show_in_brand_product_form,source,is_custom,archived_at";

async function loadTaxonomyCategoryRows() {
  const [catsRes, subsRes] = await Promise.all([
    supabase.from("product_categories").select(TAXONOMY_CATEGORY_SELECT),
    supabase.from("product_subcategories").select(TAXONOMY_SUBCATEGORY_SELECT),
  ]);
  return {
    categoryRows: safeData(catsRes),
    subcategoryRows: safeData(subsRes),
  };
}

/** JSON taxonomy + DB visibility + admin custom L2/L3 (public header, products filters, routes). */
export async function getPublicTaxonomyTree() {
  const rawTree = getTaxonomyTree();
  const { categoryRows, subcategoryRows } = await loadTaxonomyCategoryRows();
  return mergeTaxonomyTreeWithDatabase({
    rawTree,
    categoryRows,
    subcategoryRows,
    buildProductListPath,
    categorySlugAliases,
    surface: "public",
  });
}
