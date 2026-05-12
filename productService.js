import { getSB, ready } from "./supabaseClient.js";
import { ensureVisitorId, normalizeStringArray } from "./uiHelpers.js";

export const dbToProduct = (row) => {
  const technical = row.technical || {};
  const gallery = row.gallery || technical.gallery || technical.galleryUrls || null;
  return {
    id: row.id,
    brandId: row.brand_id,
    brandName: row.brand_name,
    brandLogo: row.brand_logo || "",
    brandCategories: normalizeStringArray(row.brand_categories),
    brandCompanyRoles: normalizeStringArray(row.brand_company_roles),
    name: row.name,
    sku: row.sku,
    category: row.category,
    description: row.description,
    technical,
    spec: row.spec,
    image: row.image,
    gallery: Array.isArray(gallery) ? gallery : undefined,
    files: row.files || {},
    hasPdf: row.has_pdf,
    hasCad: row.has_cad,
    status: row.status,
    views: row.views,
    createdAt: new Date(row.created_at).getTime(),
  };
};

export const productToDB = (product) => {
  const technical = { ...(product.technical || {}) };
  if (Array.isArray(product.gallery) && product.gallery.length) technical.gallery = product.gallery;
  const files = product.files || {};
  const hasPdf = Boolean(
    product.hasPdf || files.pdfUrl || (Array.isArray(files.pdfs) && files.pdfs.length),
  );
  const hasCad = Boolean(
    product.hasCad || files.cadUrl || (Array.isArray(files.dwgs) && files.dwgs.length),
  );
  const row = {
    brand_id: product.brandId,
    brand_name: product.brandName || "",
    name: product.name || "",
    sku: product.sku || "",
    category: product.category || "",
    description: product.description || "",
    technical,
    spec: product.spec || "",
    image: product.image || "",
    files,
    has_pdf: hasPdf,
    has_cad: hasCad,
    status: product.status || "draft",
  };
  const logo = String(product.brandLogo || "").trim();
  if (logo) row.brand_logo = logo;
  const brandCategories = normalizeStringArray(product.brandCategories);
  if (brandCategories.length) row.brand_categories = brandCategories;
  const brandRoles = normalizeStringArray(product.brandCompanyRoles);
  if (brandRoles.length) row.brand_company_roles = brandRoles;
  return row;
};

export const createProductService = () => {
  const getProducts = async (opts = {}) => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    let q = sb.from("products").select("*").order("created_at", { ascending: false });
    if (opts.brandId) {
      q = q.eq("brand_id", opts.brandId);
    } else {
      q = q.eq("status", "published");
    }
    if (opts.category) q = q.eq("category", opts.category);
    const { data } = await q;
    return (data || []).map(dbToProduct);
  };

  const getAllProducts = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    const { data } = await sb.from("products").select("*").order("created_at", { ascending: false });
    return (data || []).map(dbToProduct);
  };

  const addProduct = async (product) => {
    await ready;
    const sb = getSB();
    if (!sb) return null;
    const { data, error } = await sb.from("products").insert(productToDB(product)).select().single();
    if (error) {
      console.error("addProduct:", error.message);
      return null;
    }
    return dbToProduct(data);
  };

  const updateProduct = async (id, patch) => {
    await ready;
    const sb = getSB();
    if (!sb) return;
    const dbPatch = {};
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.views !== undefined) dbPatch.views = patch.views;
    if (patch.technical !== undefined) dbPatch.technical = patch.technical;
    if (patch.image !== undefined) dbPatch.image = patch.image;
    if (patch.spec !== undefined) dbPatch.spec = patch.spec;
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.files !== undefined) dbPatch.files = patch.files;
    if (patch.brandName !== undefined) dbPatch.brand_name = patch.brandName;
    if (patch.hasPdf !== undefined) dbPatch.has_pdf = Boolean(patch.hasPdf);
    if (patch.hasCad !== undefined) dbPatch.has_cad = Boolean(patch.hasCad);
    await sb.from("products").update(dbPatch).eq("id", id);
  };

  const deleteProduct = async (id) => {
    await ready;
    const sb = getSB();
    if (!sb) return;
    await sb.from("products").delete().eq("id", id);
  };

  const incrementView = async (id) => {
    await ready;
    const sb = getSB();
    if (!sb || !id) return;
    try {
      await sb.rpc("increment_product_view", { product_id: id });
    } catch {}
    try {
      const { data: { user } } = await sb.auth.getUser();
      await sb.from("product_view_log").insert({
        product_id: id,
        visitor_id: ensureVisitorId(),
        user_id: user?.id || null,
      });
    } catch {}
  };

  return {
    getProducts,
    getAllProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    incrementView,
  };
};
