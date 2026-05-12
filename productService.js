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

const PRODUCT_LIST_FIELDS = [
  "id",
  "brand_id",
  "brand_name",
  "brand_logo",
  "name",
  "slug",
  "sku",
  "category",
  "category_id",
  "subcategory_id",
  "summary",
  "material",
  "material_family",
  "thickness_mm",
  "fire_class",
  "color_family",
  "usage_area",
  "indoor_outdoor",
  "acoustic_rating",
  "acoustic_nrc",
  "dimensions",
  "country",
  "city",
  "company_roles",
  "image",
  "thumbnail_url",
  "card_image_url",
  "gallery_image_url",
  "original_image_url",
  "has_pdf",
  "has_cad",
  "has_bim",
  "status",
  "views",
  "created_at",
].join(",");

const PRODUCT_FILTER_FIELDS = [
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
    thumbnailUrl: row.thumbnail_url || "",
    cardImageUrl: row.card_image_url || "",
    galleryImageUrl: row.gallery_image_url || "",
    originalImageUrl: row.original_image_url || "",
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
    thumbnail_url: product.thumbnailUrl || product.thumbnail_url || product.image || "",
    card_image_url: product.cardImageUrl || product.card_image_url || product.image || "",
    gallery_image_url: product.galleryImageUrl || product.gallery_image_url || product.image || "",
    original_image_url: product.originalImageUrl || product.original_image_url || product.image || "",
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
  const applyValues = (column, value) => {
    const values = Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean);
    if (!values.length) return;
    q = values.length === 1 ? q.eq(column, values[0]) : q.in(column, values);
  };
  if (opts.category) q = q.ilike("category", `%${opts.category}%`);
  if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
  if (opts.subcategoryId) q = q.eq("subcategory_id", opts.subcategoryId);
  applyValues("brand_name", opts.brandName);
  applyValues("material", opts.material);
  applyValues("usage_area", opts.usageArea);
  applyValues("color_family", opts.colorFamily);
  applyValues("thickness_mm", opts.thicknessMm);
  applyValues("fire_class", opts.fireClass);
  applyValues("indoor_outdoor", opts.indoorOutdoor);
  applyValues("country", opts.country);
  applyValues("city", opts.city);
  if (typeof opts.hasPdf === "boolean") q = q.eq("has_pdf", opts.hasPdf);
  if (typeof opts.hasCad === "boolean") q = q.eq("has_cad", opts.hasCad);
  if (typeof opts.hasBim === "boolean") q = q.eq("has_bim", opts.hasBim);
  const companyRoles = Array.isArray(opts.companyRole) ? opts.companyRole.filter(Boolean) : [opts.companyRole].filter(Boolean);
  companyRoles.forEach((role) => {
    q = q.contains("company_roles", [role]);
  });
  if (opts.search) {
    const term = String(opts.search).trim();
    q = q.or(`name.ilike.%${term}%,brand_name.ilike.%${term}%,category.ilike.%${term}%,material.ilike.%${term}%,usage_area.ilike.%${term}%`);
  }
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
    thumbnailUrl: "thumbnail_url",
    cardImageUrl: "card_image_url",
    galleryImageUrl: "gallery_image_url",
    originalImageUrl: "original_image_url",
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

const mapProductFiles = (rows = [], legacyFiles = {}) => {
  const files = { ...legacyFiles };
  rows.forEach((row) => {
    const item = {
      url: row.url,
      label: row.label || row.file_type || "Dosya",
      size: row.file_size_bytes || null,
    };
    if (row.file_type === "pdf" || row.file_type === "catalog" || row.file_type === "datasheet") {
      files.pdfs = [...(files.pdfs || []), item];
    } else if (row.file_type === "cad") {
      files.dwgs = [...(files.dwgs || []), item];
    } else if (row.file_type === "bim" || row.file_type === "3d") {
      files.models3d = [...(files.models3d || []), item];
    } else {
      files.other = [...(files.other || []), item];
    }
  });
  return files;
};

const mapProductVariant = (row) => ({
  id: row.id,
  name: row.name || "",
  code: row.sku || "",
  image: row.image_url || "",
  colorFamily: row.color_family || "",
  finish: row.finish || "",
  size: row.size || "",
  material: row.material || "",
  metadata: row.metadata || {},
});

const mapProductImage = (row) => ({
  id: row.id,
  url: row.url,
  thumbnailUrl: row.thumbnail_url || row.url,
  cardImageUrl: row.card_url || row.thumbnail_url || row.url,
  galleryImageUrl: row.gallery_url || row.url,
  originalImageUrl: row.original_url || row.url,
  alt: row.alt || "",
  width: row.width || null,
  height: row.height || null,
  isPrimary: Boolean(row.is_primary),
  sortOrder: row.sort_order || 0,
});

const mapProjectSummary = (row) => ({
  id: row.id,
  title: row.title || "",
  slug: row.slug || "",
  brandId: row.brand_id,
  architectId: row.architect_id,
  architect: row.architect || row.office_name || "",
  location: row.location || [row.city, row.country].filter(Boolean).join(", "),
  city: row.city || "",
  country: row.country || "",
  image: row.image || "",
  description: row.description || "",
  year: row.year || "",
});

const applyDetailRows = (product, detail) => {
  const images = detail.images || [];
  if (images.length) {
    product.images = images.map(mapProductImage);
    product.gallery = product.images.map((img) => img.galleryImageUrl).filter(Boolean);
    const primary = product.images.find((img) => img.isPrimary) || product.images[0];
    product.image = primary?.galleryImageUrl || product.gallery[0] || product.image;
    product.thumbnailUrl = primary?.thumbnailUrl || product.thumbnailUrl;
    product.cardImageUrl = primary?.cardImageUrl || product.cardImageUrl;
    product.galleryImageUrl = primary?.galleryImageUrl || product.galleryImageUrl;
    product.originalImageUrl = primary?.originalImageUrl || product.originalImageUrl;
  }
  if (detail.files) product.files = mapProductFiles(detail.files, product.files || {});
  if (detail.specs) {
    product.specRows = detail.specs.map((row) => ({
      key: row.spec_key,
      label: row.label || row.spec_key,
      value: row.value_text || row.value_number || "",
      unit: row.unit || "",
      filterable: Boolean(row.filterable),
    }));
    product.technical = {
      ...(product.technical || {}),
      other: product.specRows.map((row) => ({
        label: row.label,
        value: [row.value, row.unit].filter(Boolean).join(" "),
      })),
    };
  }
  if (detail.variants) product.variants = detail.variants.map(mapProductVariant);
  product.relatedProducts = (detail.relatedProducts || []).map(dbToProduct);
  product.relatedProjects = (detail.relatedProjects || []).map(mapProjectSummary);
  return product;
};

export const createProductService = () => {
  const getProductList = async (opts = {}) => {
    await ready;
    const sb = getSB();
    if (!sb) return { items: [], total: 0, page: 1, pageSize: 24, hasMore: false };
    const pageSize = Math.min(Math.max(Number(opts.pageSize) || 24, 1), 60);
    const page = Math.max(Number(opts.page) || 1, 1);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sortMap = {
      name_asc: ["name", true],
      name_desc: ["name", false],
      brand_asc: ["brand_name", true],
      views_desc: ["views", false],
      newest: ["created_at", false],
    };
    const [sortColumn, ascending] = sortMap[opts.sortBy] || sortMap.name_asc;
    const query = applyProductFilters(
      sb
        .from("products")
        .select(PRODUCT_LIST_FIELDS, { count: "exact" })
        .order(sortColumn, { ascending })
        .range(from, to),
      opts,
    );
    const { data, count, error } = await query;
    if (error) return { items: [], total: 0, page, pageSize, hasMore: false, error };
    const total = count || 0;
    return {
      items: (data || []).map(dbToProduct),
      total,
      page,
      pageSize,
      hasMore: from + (data || []).length < total,
    };
  };

  const getProductFilterOptions = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    const { data } = await sb
      .from("products")
      .select(PRODUCT_FILTER_FIELDS)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(5000);
    return data || [];
  };

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

  const getProductDetail = async ({ id, slug } = {}) => {
    await ready;
    const sb = getSB();
    if (!sb) return null;
    let q = sb.from("products").select("*").limit(1);
    if (id) q = q.eq("id", id);
    else if (slug) q = q.eq("slug", slug);
    else return null;

    const { data: rows, error } = await q;
    if (error || !rows?.length) return null;

    const base = dbToProduct(rows[0]);
    const productId = base.id;
    const [imagesRes, filesRes, specsRes, variantsRes, projectLinksRes, relatedRes] = await Promise.all([
      sb.from("product_images").select("*").eq("product_id", productId).order("sort_order", { ascending: true }),
      sb.from("product_files").select("*").eq("product_id", productId).order("sort_order", { ascending: true }),
      sb.from("product_specs").select("*").eq("product_id", productId).order("sort_order", { ascending: true }),
      sb.from("product_variants").select("*").eq("product_id", productId).order("sort_order", { ascending: true }),
      sb.from("project_products").select("project_id").eq("product_id", productId),
      base.brandId
        ? sb
          .from("products")
          .select("*")
          .eq("status", "published")
          .eq("brand_id", base.brandId)
          .neq("id", productId)
          .limit(8)
        : Promise.resolve({ data: [] }),
    ]);

    let relatedProjects = [];
    const projectIds = (projectLinksRes.data || []).map((row) => row.project_id).filter(Boolean);
    if (projectIds.length) {
      const { data } = await sb.from("projects").select("*").in("id", projectIds).eq("status", "published");
      relatedProjects = data || [];
    }

    return applyDetailRows(base, {
      images: imagesRes.data || [],
      files: filesRes.data || [],
      specs: specsRes.data || [],
      variants: variantsRes.data || [],
      relatedProducts: relatedRes.data || [],
      relatedProjects,
    });
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
    getProductList,
    getProductFilterOptions,
    getProducts,
    getProductDetail,
    getAllProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    incrementView,
  };
};
