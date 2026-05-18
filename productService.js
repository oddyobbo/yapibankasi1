import { getSB, ready } from "./supabaseClient.js";
import { ensureVisitorId, normalizeStringArray } from "./uiHelpers.js";
import { mergeTaxonomyTreeWithDatabase } from "./taxonomy-merge.js?v=category-admin-9";

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

/** Admin kategori formu: & → ve, Türkçe karakter dönüşümü. */
const slugifyAdminCategory = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " ve ")
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

const simplifyCategoryDbError = (error) => {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  if (code === "23505" || /duplicate key|unique constraint/i.test(msg)) {
    return new Error("Bu slug zaten kullanılıyor. Farklı bir slug seçin.");
  }
  return new Error(msg || "Kayıt başarısız.");
};

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
    slug: slugify(product.name || ""),
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

  const productSlugTaken = async (sb, candidate) => {
    const { data, error } = await sb.from("products").select("id").eq("slug", candidate).limit(1).maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    return Boolean(data?.id);
  };

  const allocateUniqueProductSlug = async (sb, productName) => {
    const base = slugify(productName || "") || "urun";
    const maxAttempts = 50;
    for (let n = 0; n < maxAttempts; n++) {
      const candidate = n === 0 ? base : `${base}-${n + 1}`;
      const taken = await productSlugTaken(sb, candidate);
      if (!taken) return candidate;
    }
    return null;
  };

  const bumpSlugAfterRace = (slug) => {
    const m = /^(.+)-(\d+)$/.exec(slug);
    if (m) return `${m[1]}-${parseInt(m[2], 10) + 1}`;
    return `${slug}-2`;
  };

  const addProduct = async (product) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    const row = productToDB(product);
    // Marka paneli veya istemci published gönderemesin; katalog yayını ayrı onay akışıyla (TODO: admin + RLS).
    if (row.status === "published") row.status = "pending_review";
    let slug = await allocateUniqueProductSlug(sb, row.name || product.name || "");
    const friendlySlugMsg = "Ürün bağlantısı oluşturulurken çakışma oluştu. Lütfen ürün adını değiştirip tekrar deneyin.";
    if (!slug) throw new Error(friendlySlugMsg);

    for (let insertAttempt = 0; insertAttempt < 3; insertAttempt++) {
      row.slug = slug;
      const { data, error } = await sb.from("products").insert(row).select("*").single();
      if (!error) return dbToProduct(data);

      const msg = `${error?.message || ""} ${error?.details || ""}`;
      const isSlugUniqueViolation = error?.code === "23505" && /slug/i.test(msg);
      if (isSlugUniqueViolation && insertAttempt < 2) {
        slug = bumpSlugAfterRace(slug);
        continue;
      }
      if (isSlugUniqueViolation) throw new Error(friendlySlugMsg);
      throw error;
    }
    throw new Error(friendlySlugMsg);
  };

  const brandSetProductVisibility = async (productId, nextStatus) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    const target = String(nextStatus || "").trim();
    if (target !== "published" && target !== "unpublished") {
      throw new Error("Gecersiz yayin durumu.");
    }
    const { data: row, error: fetchErr } = await sb
      .from("products")
      .select("status")
      .eq("id", productId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!row) throw new Error("Urun bulunamadi.");
    const current = String(row.status || "").trim();
    if (target === "unpublished" && current !== "published") {
      throw new Error("Yalnizca yayindaki urunler yayından kaldirilabilir.");
    }
    if (target === "published" && current !== "unpublished") {
      throw new Error("Yalnizca yayından kaldirilmis urunler tekrar yayina alinabilir.");
    }
    const { error } = await sb
      .from("products")
      .update({ status: target, updated_at: new Date().toISOString() })
      .eq("id", productId);
    if (error) throw error;
  };

  // Marka paneli: yayin durumu (published/unpublished) ve icerik guncellemeleri ayri akislardir.
  const updateProduct = async (id, patch) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    const patchKeys = Object.keys(patch || {});
    const onlyStatus = patchKeys.length === 1 && patchKeys[0] === "status";
    const requestedStatus = String(patch?.status || "").trim();

    if (onlyStatus && requestedStatus === "unpublished") {
      await brandSetProductVisibility(id, "unpublished");
      return;
    }
    if (onlyStatus && requestedStatus === "published") {
      await brandSetProductVisibility(id, "published");
      return;
    }

    const dbPatch = buildProductPatch(patch);
    const contentFieldCount = Object.keys(dbPatch).filter((k) => k !== "status").length;
    if (contentFieldCount > 0) {
      const { data: row, error: fetchErr } = await sb
        .from("products")
        .select("status")
        .eq("id", id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      const current = String(row?.status || "").trim();
      if (current === "published" || current === "unpublished") {
        dbPatch.status = "pending_review";
      }
    }

    if (dbPatch.status === "published") dbPatch.status = "pending_review";

    const { error } = await sb.from("products").update(dbPatch).eq("id", id);
    if (error) throw error;
  };

  const ADMIN_SETTABLE_STATUSES = new Set(["published", "needs_revision", "archived", "pending_review"]);

  const adminSetProductStatus = async (productId, status) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    if (!productId) throw new Error("Urun ID zorunlu.");
    const s = String(status || "").trim();
    if (!ADMIN_SETTABLE_STATUSES.has(s)) {
      throw new Error("Gecersiz durum. Izin verilenler: published, needs_revision, archived, pending_review");
    }
    const updatePayload = { status: s, updated_at: new Date().toISOString() };

    if (s === "published") {
      const { data: row, error: fetchErr } = await sb
        .from("products")
        .select("brand_record_id, brand_id")
        .eq("id", productId)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (row && !row.brand_record_id && row.brand_id) {
        const { data: brand } = await sb
          .from("brands")
          .select("id")
          .eq("profile_id", row.brand_id)
          .maybeSingle();
        if (brand?.id) updatePayload.brand_record_id = brand.id;
      }
    }

    const { data, error } = await sb
      .from("products")
      .update(updatePayload)
      .eq("id", productId)
      .select("*")
      .single();
    if (error) throw error;
    return dbToProduct(data);
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

  const buildProductListPath = ({ group, category, subcategory }) => {
    const base = "/urunler";
    const g = String(group || "").trim();
    const c = String(category || "").trim();
    const s = String(subcategory || "").trim();
    if (!g && !c && !s) return base;
    if (!c) return `${base}/${g}`;
    if (!s) return `${base}/${g}/${c}`;
    return `${base}/${g}/${c}/${s}`;
  };

  const categorySlugAliasesForVisibility = (slug) => {
    const clean = String(slug || "").trim();
    const aliases = new Set([clean]);
    const jsonSlug = "mer" + "mot" + "ion" + "-korkuluk";
    const merdivenSlug = "mer" + "diven" + "-korkuluk";
    if (clean === jsonSlug || clean === merdivenSlug) {
      aliases.add(jsonSlug);
      aliases.add(merdivenSlug);
      aliases.add("merdiven-korkuluk");
    }
    if (clean === "panel-ve-levha-yuzeyler") {
      aliases.add("panel-levha-yuzeyler");
    }
    return [...aliases];
  };

  const MERGED_TAXONOMY_JSON_URL = "/data/archilink-final-taxonomy-v1.json";

  const TAXONOMY_CATEGORY_SELECT =
    "id,name,slug,l1_slug,sort_order,is_active,show_in_header_dropdown,show_in_products_filter,show_in_brand_product_form,source,is_custom,archived_at";
  const TAXONOMY_SUBCATEGORY_SELECT =
    "id,name,slug,category_id,sort_order,is_active,show_in_products_filter,show_in_brand_product_form,source,is_custom,archived_at";

  const getMergedTaxonomyTree = async (options = {}) => {
    const surface =
      options.surface === "admin" || options.surface === "brandForm" ? options.surface : "public";
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");

    const taxRes = await fetch(MERGED_TAXONOMY_JSON_URL, { cache: "no-cache" });
    if (!taxRes.ok) throw new Error("Taxonomy JSON yuklenemedi.");
    const taxJson = await taxRes.json();
    const rawTree = Array.isArray(taxJson?.taxonomy) ? taxJson.taxonomy : [];

    const [catsRes, subsRes] = await Promise.all([
      sb.from("product_categories").select(TAXONOMY_CATEGORY_SELECT),
      sb.from("product_subcategories").select(TAXONOMY_SUBCATEGORY_SELECT),
    ]);
    if (catsRes.error) throw catsRes.error;
    if (subsRes.error) throw subsRes.error;

    return mergeTaxonomyTreeWithDatabase({
      rawTree,
      categoryRows: catsRes.data || [],
      subcategoryRows: subsRes.data || [],
      buildProductListPath,
      categorySlugAliases: categorySlugAliasesForVisibility,
      surface,
    });
  };

  const CATEGORY_VISIBILITY_FIELDS =
    "id,name,slug,sort_order,l1_slug,is_active,show_in_header_dropdown,show_in_products_filter,show_in_brand_product_form";
  const SUBCATEGORY_VISIBILITY_FIELDS =
    "id,name,slug,sort_order,category_id,is_active,show_in_products_filter,show_in_brand_product_form";

  const listProductCategories = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    const { data, error } = await sb
      .from("product_categories")
      .select(CATEGORY_VISIBILITY_FIELDS)
      .order("sort_order", { ascending: true });
    if (error) return [];
    return data || [];
  };

  const listProductSubcategories = async (categoryId) => {
    if (!categoryId) return [];
    await ready;
    const sb = getSB();
    if (!sb) return [];
    const { data, error } = await sb
      .from("product_subcategories")
      .select(SUBCATEGORY_VISIBILITY_FIELDS)
      .eq("category_id", categoryId)
      .order("sort_order", { ascending: true });
    if (error) return [];
    return data || [];
  };

  const getAdminCategoryVisibilityTree = async () => {
    const tree = await getMergedTaxonomyTree({ surface: "admin" });
    return { tree };
  };

  const updateProductCategoryVisibility = async (categoryId, patch) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    if (!categoryId) throw new Error("Kategori ID zorunlu.");
    const allowed = new Set([
      "is_active",
      "show_in_header_dropdown",
      "show_in_products_filter",
      "show_in_brand_product_form",
    ]);
    const dbPatch = {};
    for (const [key, value] of Object.entries(patch || {})) {
      if (allowed.has(key)) dbPatch[key] = Boolean(value);
    }
    if (!Object.keys(dbPatch).length) throw new Error("Guncellenecek alan yok.");
    const { data, error } = await sb
      .from("product_categories")
      .update(dbPatch)
      .eq("id", categoryId)
      .select(CATEGORY_VISIBILITY_FIELDS)
      .single();
    if (error) throw error;
    return data;
  };

  const getCategoryVisibilityMaps = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return { l2BySlug: {}, l3BySlug: {} };
    const [catsRes, subsRes] = await Promise.all([
      sb.from("product_categories").select("slug,is_active,show_in_brand_product_form"),
      sb.from("product_subcategories").select("slug,is_active,show_in_brand_product_form"),
    ]);
    const l2BySlug = {};
    for (const row of catsRes.data || []) {
      if (row?.slug) l2BySlug[row.slug] = row;
    }
    const l3BySlug = {};
    for (const row of subsRes.data || []) {
      if (row?.slug) l3BySlug[row.slug] = row;
    }
    return { l2BySlug, l3BySlug };
  };

  const CATEGORY_ADMIN_FIELDS =
    "id,name,slug,l1_slug,source,is_custom,archived_at,is_active,show_in_header_dropdown,show_in_products_filter,show_in_brand_product_form";
  const SUBCATEGORY_ADMIN_FIELDS =
    "id,name,slug,category_id,source,is_custom,archived_at,is_active,show_in_products_filter,show_in_brand_product_form";

  const SYSTEM_CATEGORY_PROTECT_MSG =
    "Sistem kategorileri kalıcı olarak silinemez. Arşivleyebilirsiniz.";
  const PRODUCT_LINKED_DELETE_MSG =
    "Bu kategoriye bağlı ürün olduğu için kalıcı silinemez. Arşivleyebilirsiniz.";

  const isAdminCustomCategoryRow = (row) =>
    Boolean(row && (row.is_custom === true || row.source === "admin"));

  const fetchCategoryAdminRow = async (sb, categoryId) => {
    const { data, error } = await sb
      .from("product_categories")
      .select(CATEGORY_ADMIN_FIELDS)
      .eq("id", categoryId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const fetchSubcategoryAdminRow = async (sb, subcategoryId) => {
    const { data, error } = await sb
      .from("product_subcategories")
      .select(SUBCATEGORY_ADMIN_FIELDS)
      .eq("id", subcategoryId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  const assertAdminCustomCategoryRow = (row) => {
    if (!row) throw new Error("Kategori bulunamadı.");
    if (!isAdminCustomCategoryRow(row)) throw new Error(SYSTEM_CATEGORY_PROTECT_MSG);
  };

  const countProductsForCategory = async (categoryId) => {
    await ready;
    const sb = getSB();
    if (!sb || !categoryId) return 0;

    const { data: subs, error: subsErr } = await sb
      .from("product_subcategories")
      .select("id")
      .eq("category_id", categoryId);
    if (subsErr) throw subsErr;

    const subIds = (subs || []).map((row) => row.id).filter(Boolean);
    const orParts = [`category_id.eq.${categoryId}`];
    if (subIds.length) orParts.push(`subcategory_id.in.(${subIds.join(",")})`);

    const { count, error } = await sb
      .from("products")
      .select("id", { count: "exact", head: true })
      .or(orParts.join(","));
    if (error) throw error;
    return count || 0;
  };

  const countProductsForSubcategory = async (subcategoryId) => {
    await ready;
    const sb = getSB();
    if (!sb || !subcategoryId) return 0;
    const { count, error } = await sb
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("subcategory_id", subcategoryId);
    if (error) throw error;
    return count || 0;
  };

  const archiveProductSubcategory = async (subcategoryId) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    if (!subcategoryId) throw new Error("Alt kategori ID zorunlu.");

    const row = await fetchSubcategoryAdminRow(sb, subcategoryId);
    if (!row) throw new Error("Kategori bulunamadı.");

    const now = new Date().toISOString();
    const { data, error } = await sb
      .from("product_subcategories")
      .update({
        archived_at: now,
        is_active: false,
        show_in_products_filter: false,
        show_in_brand_product_form: false,
        updated_at: now,
      })
      .eq("id", subcategoryId)
      .select(SUBCATEGORY_VISIBILITY_FIELDS)
      .single();
    if (error) throw simplifyCategoryDbError(error);
    return data;
  };

  const restoreProductSubcategory = async (subcategoryId) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    if (!subcategoryId) throw new Error("Alt kategori ID zorunlu.");

    const row = await fetchSubcategoryAdminRow(sb, subcategoryId);
    if (!row) throw new Error("Kategori bulunamadı.");

    const now = new Date().toISOString();
    const { data, error } = await sb
      .from("product_subcategories")
      .update({
        archived_at: null,
        is_active: true,
        show_in_products_filter: true,
        show_in_brand_product_form: true,
        updated_at: now,
      })
      .eq("id", subcategoryId)
      .select(SUBCATEGORY_VISIBILITY_FIELDS)
      .single();
    if (error) throw simplifyCategoryDbError(error);
    return data;
  };

  const archiveProductCategory = async (categoryId) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    if (!categoryId) throw new Error("Kategori ID zorunlu.");

    const row = await fetchCategoryAdminRow(sb, categoryId);
    if (!row) throw new Error("Kategori bulunamadı.");

    const now = new Date().toISOString();
    const { data, error } = await sb
      .from("product_categories")
      .update({
        archived_at: now,
        is_active: false,
        show_in_header_dropdown: false,
        show_in_products_filter: false,
        show_in_brand_product_form: false,
        updated_at: now,
      })
      .eq("id", categoryId)
      .select(CATEGORY_VISIBILITY_FIELDS)
      .single();
    if (error) throw simplifyCategoryDbError(error);
    return data;
  };

  const restoreProductCategory = async (categoryId) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    if (!categoryId) throw new Error("Kategori ID zorunlu.");

    const row = await fetchCategoryAdminRow(sb, categoryId);
    if (!row) throw new Error("Kategori bulunamadı.");

    const now = new Date().toISOString();
    const { data, error } = await sb
      .from("product_categories")
      .update({
        archived_at: null,
        is_active: true,
        show_in_header_dropdown: true,
        show_in_products_filter: true,
        show_in_brand_product_form: true,
        updated_at: now,
      })
      .eq("id", categoryId)
      .select(CATEGORY_VISIBILITY_FIELDS)
      .single();
    if (error) throw simplifyCategoryDbError(error);
    return data;
  };

  const deleteCustomProductSubcategory = async (subcategoryId) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    if (!subcategoryId) throw new Error("Alt kategori ID zorunlu.");

    const row = await fetchSubcategoryAdminRow(sb, subcategoryId);
    assertAdminCustomCategoryRow(row);

    const linked = await countProductsForSubcategory(subcategoryId);
    if (linked > 0) throw new Error(PRODUCT_LINKED_DELETE_MSG);

    const { error } = await sb.from("product_subcategories").delete().eq("id", subcategoryId);
    if (error) throw simplifyCategoryDbError(error);
    return { ok: true };
  };

  const deleteCustomProductCategory = async (categoryId) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    if (!categoryId) throw new Error("Kategori ID zorunlu.");

    const row = await fetchCategoryAdminRow(sb, categoryId);
    assertAdminCustomCategoryRow(row);

    const linked = await countProductsForCategory(categoryId);
    if (linked > 0) throw new Error(PRODUCT_LINKED_DELETE_MSG);

    const { data: subs, error: subsErr } = await sb
      .from("product_subcategories")
      .select("id,source,is_custom")
      .eq("category_id", categoryId);
    if (subsErr) throw subsErr;

    for (const sub of subs || []) {
      if (!isAdminCustomCategoryRow(sub)) continue;
      const subLinked = await countProductsForSubcategory(sub.id);
      if (subLinked > 0) throw new Error(PRODUCT_LINKED_DELETE_MSG);
      const { error: delSubErr } = await sb.from("product_subcategories").delete().eq("id", sub.id);
      if (delSubErr) throw simplifyCategoryDbError(delSubErr);
    }

    const { error } = await sb.from("product_categories").delete().eq("id", categoryId);
    if (error) throw simplifyCategoryDbError(error);
    return { ok: true };
  };

  const createProductCategory = async (payload = {}) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");

    const l1_slug = String(payload.l1_slug || "").trim();
    const l1_name = String(payload.l1_name || "").trim();
    const name = String(payload.name || "").trim();
    const slug = slugifyAdminCategory(payload.slug || payload.name);

    if (!l1_slug || !l1_name) throw new Error("L1 seçimi zorunlu.");
    if (!name) throw new Error("Kategori adı zorunlu.");
    if (!slug) throw new Error("Geçerli bir slug girin.");

    const tree = await getMergedTaxonomyTree({ surface: "admin" });
    const l1Node = (tree || []).find((n) => n.slug === l1_slug);
    if (!l1Node) throw new Error("Geçersiz L1 seçimi.");
    const l2Exists = (l1Node.children || []).some((n) => n.level === 2 && n.slug === slug);
    if (l2Exists) throw new Error("Bu L1 altında aynı slug'a sahip kategori var.");

    const { data: slugRow } = await sb
      .from("product_categories")
      .select("id,slug,l1_slug")
      .eq("slug", slug)
      .maybeSingle();
    if (slugRow) {
      if (slugRow.l1_slug === l1_slug) {
        throw new Error("Bu L1 altında aynı slug'a sahip kategori var.");
      }
      throw new Error("Bu slug başka bir kategoride kullanılıyor. Farklı bir slug seçin.");
    }

    const insertRow = {
      name,
      slug,
      l1_slug,
      l1_name,
      is_active: payload.is_active !== false,
      show_in_header_dropdown: payload.show_in_header_dropdown !== false,
      show_in_products_filter: payload.show_in_products_filter !== false,
      show_in_brand_product_form: payload.show_in_brand_product_form !== false,
      sort_order: Number.isFinite(Number(payload.sort_order)) ? Number(payload.sort_order) : 9999,
      source: "admin",
      is_custom: true,
      archived_at: null,
    };

    const { data, error } = await sb
      .from("product_categories")
      .insert(insertRow)
      .select(CATEGORY_VISIBILITY_FIELDS)
      .single();
    if (error) throw simplifyCategoryDbError(error);
    return data;
  };

  const createProductSubcategory = async (payload = {}) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");

    const category_id = String(payload.category_id || "").trim();
    const name = String(payload.name || "").trim();
    const slug = slugifyAdminCategory(payload.slug || payload.name);

    if (!category_id) throw new Error("L2 seçimi zorunlu.");
    if (!name) throw new Error("Kategori adı zorunlu.");
    if (!slug) throw new Error("Geçerli bir slug girin.");

    const tree = await getMergedTaxonomyTree({ surface: "admin" });
    let parentL2 = null;
    for (const l1 of tree || []) {
      parentL2 = (l1.children || []).find((n) => n.level === 2 && String(n.db_id) === category_id);
      if (parentL2) break;
    }
    if (!parentL2) throw new Error("Seçilen L2 bulunamadı veya DB kaydı yok.");
    if (!parentL2.db_id) {
      throw new Error("DB seed eksik olduğu için bu L2 altına kategori eklenemiyor.");
    }

    const l3Exists = (parentL2.children || []).some((n) => n.level === 3 && n.slug === slug);
    if (l3Exists) throw new Error("Bu L2 altında aynı slug'a sahip alt kategori var.");

    const { data: slugRow } = await sb
      .from("product_subcategories")
      .select("id,slug,category_id")
      .eq("category_id", category_id)
      .eq("slug", slug)
      .maybeSingle();
    if (slugRow) throw new Error("Bu L2 altında aynı slug'a sahip alt kategori var.");

    const insertRow = {
      category_id,
      name,
      slug,
      is_active: payload.is_active !== false,
      show_in_products_filter: payload.show_in_products_filter !== false,
      show_in_brand_product_form: payload.show_in_brand_product_form !== false,
      sort_order: Number.isFinite(Number(payload.sort_order)) ? Number(payload.sort_order) : 9999,
      source: "admin",
      is_custom: true,
      archived_at: null,
    };

    const { data, error } = await sb
      .from("product_subcategories")
      .insert(insertRow)
      .select(SUBCATEGORY_VISIBILITY_FIELDS)
      .single();
    if (error) throw simplifyCategoryDbError(error);
    return data;
  };

  const updateProductSubcategoryVisibility = async (subcategoryId, patch) => {
    await ready;
    const sb = getSB();
    if (!sb) throw new Error("Supabase baglantisi yok");
    if (!subcategoryId) throw new Error("Alt kategori ID zorunlu.");
    const allowed = new Set(["is_active", "show_in_products_filter", "show_in_brand_product_form"]);
    const dbPatch = {};
    for (const [key, value] of Object.entries(patch || {})) {
      if (allowed.has(key)) dbPatch[key] = Boolean(value);
    }
    if (!Object.keys(dbPatch).length) throw new Error("Guncellenecek alan yok.");
    const { data, error } = await sb
      .from("product_subcategories")
      .update(dbPatch)
      .eq("id", subcategoryId)
      .select(SUBCATEGORY_VISIBILITY_FIELDS)
      .single();
    if (error) throw error;
    return data;
  };

  const getBrandRecordForProfile = async (profileId) => {
    if (!profileId) return null;
    await ready;
    const sb = getSB();
    if (!sb) return null;
    const { data, error } = await sb
      .from("brands")
      .select("id, profile_id, name, slug, status")
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  };

  return {
    getProductList,
    getProductFilterOptions,
    getProducts,
    getProductDetail,
    getAllProducts,
    addProduct,
    updateProduct,
    adminSetProductStatus,
    deleteProduct,
    incrementView,
    listProductCategories,
    listProductSubcategories,
    getMergedTaxonomyTree,
    getAdminCategoryVisibilityTree,
    getCategoryVisibilityMaps,
    updateProductCategoryVisibility,
    updateProductSubcategoryVisibility,
    createProductCategory,
    createProductSubcategory,
    slugifyAdminCategory,
    countProductsForCategory,
    countProductsForSubcategory,
    archiveProductCategory,
    archiveProductSubcategory,
    restoreProductCategory,
    restoreProductSubcategory,
    deleteCustomProductCategory,
    deleteCustomProductSubcategory,
    getBrandRecordForProfile,
  };
};
