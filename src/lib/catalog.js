import { PRODUCT_FILTER_FIELDS, approvedBrandsQuery, publishedProductsQuery, publishedProjectsQuery, safeData, supabase } from "./supabase.js";
import { slugify } from "./slugs.js";

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

const applyProductFilters = (query, filters = {}) => {
  const search = compact(filters.search);
  const brand = compact(filters.brand);
  const category = compact(filters.category);
  const material = compact(filters.material);
  const usageArea = compact(filters.usageArea);
  const colorFamily = compact(filters.colorFamily);
  const fireClass = compact(filters.fireClass);
  const indoorOutdoor = compact(filters.indoorOutdoor);
  const country = compact(filters.country);
  const city = compact(filters.city);
  const role = compact(filters.role);

  let next = query;
  if (search) next = next.or(`name.ilike.%${search}%,summary.ilike.%${search}%,description.ilike.%${search}%`);
  if (brand) next = next.ilike("brand_name", `%${brand}%`);
  if (category) next = next.ilike("category", `%${category.replace(/-/g, " ")}%`);
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

export const getProducts = async ({ limit = PRODUCT_PAGE_SIZE, categorySlug, brandSlug } = {}) => {
  let query = publishedProductsQuery().order("created_at", { ascending: false }).limit(limit);
  if (categorySlug) query = query.ilike("category", `%${categorySlug.replace(/-/g, "%")}%`);
  if (brandSlug) query = query.ilike("brand_name", `%${brandSlug.replace(/-/g, "%")}%`);
  return safeData(await query);
};

export const getProductListPage = async ({ filters = {}, page = 1, pageSize = PRODUCT_PAGE_SIZE } = {}) => {
  const currentPage = Math.max(1, Number(page) || 1);
  const from = (currentPage - 1) * pageSize;
  const to = from + pageSize - 1;
  const query = applyProductFilters(
    publishedProductsQuery({ count: "exact" }).order("created_at", { ascending: false }),
    filters,
  ).range(from, to);
  const result = await query;
  return {
    products: safeData(result),
    count: result.count || 0,
    page: currentPage,
    pageSize,
    hasPrevious: currentPage > 1,
    hasNext: (result.count || 0) > currentPage * pageSize,
  };
};

export const getProductFilterOptions = async () => {
  const [facets, brands, categories] = await Promise.all([
    supabase.from("products").select(PRODUCT_FILTER_FIELDS).eq("status", "published").limit(1000),
    approvedBrandsQuery().order("name", { ascending: true }),
    getCategories(),
  ]);
  const rows = safeData(facets);
  const brandRows = safeData(brands);
  const roles = rows.flatMap((row) => Array.isArray(row.company_roles) ? row.company_roles : []);
  return {
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

export const getProductBySlug = async (slug) => {
  const cleanSlug = decodeURIComponent(slug || "");
  const direct = await publishedProductsQuery().eq("slug", cleanSlug).maybeSingle();
  if (direct.data || direct.error?.code !== "PGRST116") return direct.data || null;

  const { data } = await publishedProductsQuery().limit(80);
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

const getRelatedProductsForProduct = async (product) => {
  if (!product?.id) return [];
  const base = publishedProductsQuery().neq("id", product.id).limit(8);
  if (product.brand_record_id) {
    const byBrandRecord = await base.eq("brand_record_id", product.brand_record_id);
    if (!byBrandRecord.error && byBrandRecord.data?.length) return byBrandRecord.data;
  }
  if (product.brand_name) {
    const byBrandName = await publishedProductsQuery()
      .neq("id", product.id)
      .eq("brand_name", product.brand_name)
      .limit(8);
    if (!byBrandName.error && byBrandName.data?.length) return byBrandName.data;
  }
  if (product.category_id) {
    const byCategory = await publishedProductsQuery()
      .neq("id", product.id)
      .eq("category_id", product.category_id)
      .limit(8);
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
  const product = await getProductBySlug(slug);
  if (!product) return null;
  const [images, files, specs, variants, brand, categoryInfo, relatedProducts, relatedProjects] = await Promise.all([
    supabase.from("product_images").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    supabase.from("product_files").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    supabase.from("product_specs").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    supabase.from("product_variants").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    getBrandForProduct(product),
    getCategoryForProduct(product),
    getRelatedProductsForProduct(product),
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
  const [products, projects] = await Promise.all([
    publishedProductsQuery().or(`brand_record_id.eq.${brand.id},brand_name.eq.${brand.name}`).limit(24),
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

export const getCategoryDetail = async (slug) => {
  const category = await getCategoryBySlug(slug);
  if (!category) return null;
  const products = safeData(await publishedProductsQuery().or(`category_id.eq.${category.id},category.ilike.%${category.name}%`).limit(24));
  return { ...category, products };
};

export const getSitemapCatalogEntries = async () => {
  const [products, brands, projects, categories] = await Promise.all([
    safeData(await publishedProductsQuery().select("slug,name,updated_at,created_at").limit(5000)),
    safeData(await approvedBrandsQuery().select("slug,name,updated_at,created_at").limit(2000)),
    safeData(await publishedProjectsQuery().select("slug,title,updated_at,created_at").limit(3000)),
    getCategories(),
  ]);
  return { products, brands, projects, categories };
};
