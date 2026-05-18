import { createClient } from "@supabase/supabase-js";

// TODO: Production’da Netlify ortam değişkenleri (PUBLIC_SUPABASE_*) kullanılmalı; hardcoded fallback ileride kaldırılacak.
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL || "https://dbcyoveyoqjlmybklovu.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_RhoIIO1nhGpyGqgU6MD3kw_sawB4_Zk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: { headers: { "x-application-name": "archilink-astro-public" } },
});

export const PUBLIC_PRODUCT_FIELDS = [
  "id",
  "brand_id",
  "brand_record_id",
  "brand_name",
  "brand_logo",
  "name",
  "slug",
  "sku",
  "category",
  "category_id",
  "subcategory_id",
  "summary",
  "description",
  "material",
  "thickness_mm",
  "fire_class",
  "color_family",
  "usage_area",
  "indoor_outdoor",
  "acoustic_rating",
  "dimensions",
  "country",
  "city",
  "company_roles",
  "technical",
  "spec",
  "image",
  "thumbnail_url",
  "card_image_url",
  "gallery_image_url",
  "original_image_url",
  "files",
  "has_pdf",
  "has_cad",
  "has_bim",
  "status",
  "created_at",
].join(",");

export const PRODUCT_FILTER_FIELDS = [
  "brand_name",
  "category",
  "material",
  "thickness_mm",
  "fire_class",
  "color_family",
  "usage_area",
  "indoor_outdoor",
  "country",
  "city",
  "company_roles",
  "has_pdf",
  "has_cad",
  "has_bim",
].join(",");

export const publishedProductsQuery = (options = {}) => supabase
  .from("products")
  .select(PUBLIC_PRODUCT_FIELDS, options)
  .eq("status", "published");

/** Public katalog: yalnızca brands.status = approved olan brand_record_id’lere bağlı published ürünler. */
const EMPTY_CATALOG_BRAND_SENTINEL = "00000000-0000-4000-8000-000000000000";

export const getApprovedBrandRecordIds = async () => {
  const { data, error } = await supabase.from("brands").select("id").eq("status", "approved");
  if (error) {
    console.warn("getApprovedBrandRecordIds:", error.message);
    return [];
  }
  return (data || []).map((row) => row.id).filter(Boolean);
};

/**
 * @param {string[]} approvedBrandIds brands.id listesi (status=approved)
 * @param {{ count?: string }} [options] PostgREST select seçenekleri
 */
export const publishedCatalogProductsQuery = (approvedBrandIds, options = {}) => {
  const q = supabase
    .from("products")
    .select(PUBLIC_PRODUCT_FIELDS, options)
    .eq("status", "published")
    .not("brand_record_id", "is", null);
  if (!approvedBrandIds?.length) {
    return q.eq("brand_record_id", EMPTY_CATALOG_BRAND_SENTINEL);
  }
  return q.in("brand_record_id", approvedBrandIds);
};

export const publishedProjectsQuery = () => supabase
  .from("projects")
  .select("*")
  .eq("status", "published");

export const approvedBrandsQuery = () => supabase
  .from("brands")
  .select("*")
  .eq("status", "approved");

export const safeData = (result, fallback = []) => {
  if (result?.error) {
    console.warn("Supabase public query failed:", result.error.message);
    return fallback;
  }
  return result?.data || fallback;
};
