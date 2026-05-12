import { approvedBrandsQuery, publishedProductsQuery, publishedProjectsQuery, safeData, supabase } from "./supabase.js";
import { slugify } from "./slugs.js";

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

export const getProducts = async ({ limit = 24, categorySlug, brandSlug } = {}) => {
  let query = publishedProductsQuery().order("created_at", { ascending: false }).limit(limit);
  if (categorySlug) query = query.ilike("category", `%${categorySlug.replace(/-/g, "%")}%`);
  if (brandSlug) query = query.ilike("brand_name", `%${brandSlug.replace(/-/g, "%")}%`);
  return safeData(await query);
};

export const getProductBySlug = async (slug) => {
  const cleanSlug = decodeURIComponent(slug || "");
  const direct = await publishedProductsQuery().eq("slug", cleanSlug).maybeSingle();
  if (direct.data || direct.error?.code !== "PGRST116") return direct.data || null;

  const { data } = await publishedProductsQuery().limit(80);
  return (data || []).find((product) => slugify(product.slug || product.name) === cleanSlug) || null;
};

export const getProductDetail = async (slug) => {
  const product = await getProductBySlug(slug);
  if (!product) return null;
  const [images, files, specs, variants, relatedProducts, relatedProjects] = await Promise.all([
    supabase.from("product_images").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    supabase.from("product_files").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    supabase.from("product_specs").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    supabase.from("product_variants").select("*").eq("product_id", product.id).order("sort_order", { ascending: true }),
    publishedProductsQuery().eq("brand_name", product.brand_name || "").neq("id", product.id).limit(8),
    supabase.from("project_products").select("project_id, projects(*)").eq("product_id", product.id).limit(6),
  ]);

  return {
    ...product,
    images: safeData(images),
    files: safeData(files),
    specs: safeData(specs),
    variants: safeData(variants),
    relatedProducts: safeData(relatedProducts),
    relatedProjects: safeData(relatedProjects).map((row) => row.projects).filter(Boolean),
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
