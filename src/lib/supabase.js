import { createClient } from "@supabase/supabase-js";

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

export const publishedProductsQuery = () => supabase
  .from("products")
  .select(PUBLIC_PRODUCT_FIELDS)
  .eq("status", "published");

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
