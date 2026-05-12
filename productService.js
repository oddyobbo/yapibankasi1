import { getSB, ready } from "./supabaseClient.js";
import { ensureVisitorId, normalizeStringArray } from "./uiHelpers.js";

const slugify = (value) => String(value || "")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/ı/g, "i")
  .replace(/ğ/g, "g")
  .replace(/ü/g, "u")
  .replace(/ş/g, "s")
  .replace(/ö/g, "o")
  .replace(/ç/g, "c")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");

const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");

const numberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(String(value).replace(",", ".").match(/-?\d+(\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const toCamelTechnical = (row, technical) => ({
  ...technical,
  material: firstValue(row.material, technical.material),
  materialType: firstValue(row.material, technical.materialType),
  materialFamily: firstValue(row.material_family, technical.materialFamily),
  thickness_mm: firstValue(row.thickness_mm, technical.thickness_mm),
  thickness: firstValue(
    row.thickness_mm !== null && row.thickness_mm !== undefined ? `${row.thickness_mm} mm` : "",
    technical.thickness,
  ),
  fireClass: firstValue(row.fire_class, technical.fireClass),
  colorFamily: firstValue(row.color_family, technical.colorFamily),
  usageArea: firstValue(row.usage_area, technical.usageArea),
  usageScope: firstValue(row.usage_area, technical.usageScope),
  indoorOutdoor: firstValue(row.indoor_outdoor, technical.indoorOutdoor),
  acousticRating: firstValue(row.acoustic_rating, technical.acousticRating),
  acoustic: firstValue(row.acoustic_rating, technical.acoustic),
  acousticNrc: firstValue(row.acoustic_nrc, technical.acousticNrc),
  dimensions: firstValue(row.dimensions, technical.dimensions),
  certificates: Array.isArray(row.certificates) && row.certificates.length
    ? row.certificates.join(", ")
    : technical.certificates,
});

export const dbToProduct = (row) => {
  const technical = toCamelTechnical(row, row.technical || {});
  const gallery = row.gallery || technical.gallery || technical.galleryUrls || null;
  const files = row.files || {};
  return {
    id: row.id,
    brandId: row.brand_id,
    brandRecordId: row.brand_record_id,
    brandName: row.brand_name,
    brandLogo: row.brand_logo || "",
    brandCategories: normalizeStringArray(row.brand_categories),
    brandCompanyRoles: normalizeStringArray(row.brand_company_roles || row.company_roles),
    name: row.name,
    slug: row.slug,
    sku: row.sku,
    category: row.category,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    summary: row.summary || "",
    description: row.description,
    technical,
    spec: row.spec,
    image: row.image,
    gallery: Array.isArray(gallery) ? gallery : undefined,
    files,
    material: row.material || "",
    materialFamily: row.material_family || "",
    thicknessMm: row.thickness_mm,
    fireClass: row.fire_class || "",
    colorFamily: row.color_family || "",
    usageArea: row.usage_area || "",
    indoorOutdoor: row.indoor_outdoor || "",
    acousticRating: row.acoustic_rating || "",
    acousticNrc: row.acoustic_nrc,
    dimensions: row.dimensions || "",
    certificates: normalizeStringArray(row.certificates),
    country: row.country || "",
    city: row.city || "",
    companyRoles: normalizeStringArray(row.company_roles),
    hasPdf: row.has_pdf,
    hasCad: row.has_cad,
    hasBim: row.has_bim,
    status: row.status,
    views: row.views,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
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
  const hasBim = Boolean(
    product.hasBim || files.bimUrl || (Array.isArray(files.bims) && files.bims.length),
  );
  const thicknessMm = numberOrNull(firstValue(product.thicknessMm, technical.thickness_mm, technical.thickness));

  const row = {
    brand_id: product.brandId,
    brand_record_id: product.brandRecordId || null,
    brand_name: product.brandName || "",
    name: product.name || "",
    slug: product.slug || slugify(product.name),
    sku: product.sku || "",
    category: product.category || "",
    category_id: product.categoryId || null,
    subcategory_id: product.subcategoryId || null,
    summary: firstValue(product.summary, technical.summary, "") || "",
    description: product.description || "",
    material: firstValue(product.material, technical.material, technical.materialType) || "",
    material_family: firstValue(product.materialFamily, technical.materialFamily) || "",
    thickness_mm: thicknessMm,
    fire_class: firstValue(product.fireClass, technical.fireClass) || "",
    color_family: firstValue(product.colorFamily, technical.colorFamily) || "",
    usage_area: firstValue(product.usageArea, technical.usageArea, technical.usageScope) || "",
    indoor_outdoor: firstValue(product.indoorOutdoor, technical.indoorOutdoor) || "",
    acoustic_rating: firstValue(product.acousticRating, technical.acousticRating, technical.acoustic) || "",
    acoustic_nrc: numberOrNull(firstValue(product.acousticNrc, technical.acousticNrc)),
    dimensions: firstValue(product.dimensions, technical.dimensions) || "",
    certificates: normalizeStringArray(firstValue(product.certificates, technical.certificates)),
    country: firstValue(product.country, technical.country) || "",
    city: firstValue(product.city, technical.city) || "",
    company_roles: normalizeStringArray(firstValue(product.companyRoles, product.brandCompanyRoles)),
    technical,
    spec: product.spec || "",
    image: product.image || "",
    files,
    has_pdf: hasPdf,
    has_cad: hasCad,
    has_bim: hasBim,
    status: product.status || "draft",
  };
  const logo = String(product.brandLogo || "").trim();
  if (logo) row.brand_logo = logo;
  return row;
};

const applyProductFilters = (query, opts = {}) => {
  let q = query;
  if (opts.brandId) q = q.eq("brand_id", opts.brandId);
  else q = q.eq("status", opts.status || "published");
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts.subcategoryId) q = q.eq("subcategory_id", opts.subcategoryId);
  if (opts.material) q = q.eq("material", opts.material);
  if (opts.usageArea) q = q.eq("usage_area", opts.usageArea);
  if (opts.colorFamily) q = q.eq("color_family", opts.colorFamily);
  if (opts.fireClass) q = q.eq("fire_class", opts.fireClass);
  if (opts.indoorOutdoor) q = q.eq("indoor_outdoor", opts.indoorOutdoor);
  if (opts.country) q = q.eq("country", opts.country);
  if (opts.city) q = q.eq("city", opts.city);
  if (opts.hasPdf) q = q.eq("has_pdf", true);
  if (opts.hasCad) q = q.eq("has_cad", true);
  if (opts.hasBim) q = q.eq("has_bim", true);
  if (opts.companyRole) q = q.contains("company_roles", [opts.companyRole]);
  return q;
};

const buildProductPatch = (patch) => {
  const dbPatch = {};
  const directMap = {
    status: "status",
    name: "name",
    slug: "slug",
    sku: "sku",
    views: "views",
    technical: "technical",
    image: "image",
    spec: "spec",
    description: "description",
    summary: "summary",
    category: "category",
    categoryId: "category_id",
    subcategoryId: "subcategory_id",
    files: "files",
    brandName: "brand_name",
    brandLogo: "brand_logo",
    brandRecordId: "brand_record_id",
    material: "material",
    materialFamily: "material_family",
    fireClass: "fire_class",
    colorFamily: "color_family",
    usageArea: "usage_area",
    indoorOutdoor: "indoor_outdoor",
    acousticRating: "acoustic_rating",
    dimensions: "dimensions",
    country: "country",
    city: "city",
  };
  Object.entries(directMap).forEach(([apiKey, dbKey]) => {
    if (patch[apiKey] !== undefined) dbPatch[dbKey] = patch[apiKey];
  });
  if (patch.thicknessMm !== undefined) dbPatch.thickness_mm = numberOrNull(patch.thicknessMm);
  if (patch.acousticNrc !== undefined) dbPatch.acoustic_nrc = numberOrNull(patch.acousticNrc);
  if (patch.certificates !== undefined) dbPatch.certificates = normalizeStringArray(patch.certificates);
  if (patch.companyRoles !== undefined) dbPatch.company_roles = normalizeStringArray(patch.companyRoles);
  if (patch.hasPdf !== undefined) dbPatch.has_pdf = Boolean(patch.hasPdf);
  if (patch.hasCad !== undefined) dbPatch.has_cad = Boolean(patch.hasCad);
  if (patch.hasBim !== undefined) dbPatch.has_bim = Boolean(patch.hasBim);
  dbPatch.updated_at = new Date().toISOString();
  return dbPatch;
};

export const createProductService = () => {
  const getProducts = async (opts = {}) => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    const q = applyProductFilters(
      sb.from("products").select("*").order("created_at", { ascending: false }),
      opts,
    );
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
    if (!sb) throw new Error("Supabase baglantisi yok");
    const row = productToDB(product);
    const { data, error } = await sb.from("products").insert(row).select("*").single();
    if (error) throw error;
    return dbToProduct(data);
  };

  const updateProduct = async (id, patch) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    const dbPatch = buildProductPatch(patch);
    const { error } = await sb.from("products").update(dbPatch).eq("id", id);
    if (error) throw error;
  };

  const deleteProduct = async (id) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    const { error } = await sb.from("products").delete().eq("id", id);
    if (error) throw error;
  };

  const trackProductViewEvent = async (sb, id, sessionId) => {
    const sinceIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: existing } = await sb
      .from("analytics_events")
      .select("id")
      .eq("event_type", "product_view")
      .eq("product_id", id)
      .eq("session_id", sessionId)
      .gte("created_at", sinceIso)
      .limit(1);
    if (existing && existing.length) return;

    const { data: productRow } = await sb.from("products").select("brand_id").eq("id", id).maybeSingle();
    await sb.from("analytics_events").insert({
      event_type: "product_view",
      product_id: id,
      brand_id: productRow?.brand_id || null,
      session_id: sessionId,
      metadata: { source: "incrementView" },
    });
  };

  const incrementView = async (id) => {
    await ready;
    const sb = getSB();
    if (!sb || !id) return;
    const sessionId = ensureVisitorId();
    try {
      await sb.rpc("increment_product_view", { product_id: id });
    } catch {}
    try {
      const { data: userData } = await sb.auth.getUser();
      await sb.from("product_view_log").insert({
        product_id: id,
        visitor_id: sessionId,
        user_id: userData?.user?.id || null,
      });
    } catch {}
    try {
      await trackProductViewEvent(sb, id, sessionId);
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
