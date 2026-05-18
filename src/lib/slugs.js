import { PRODUCT_CATALOG_BASE } from "./product-taxonomy-routes.js";

export const slugify = (value) => String(value || "")
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

export const productPath = (product) =>
  `${PRODUCT_CATALOG_BASE}/${encodeURIComponent(product?.slug || slugify(product?.name || product?.id || "product"))}`;
export const brandPath = (brand) => `/brands/${encodeURIComponent(brand?.slug || slugify(brand?.name || brand?.brandName || "brand"))}`;
export const projectPath = (project) => `/projects/${encodeURIComponent(project?.slug || slugify(project?.title || project?.id || "project"))}`;
export const categoryPath = (category) => `/categories/${encodeURIComponent(category?.slug || slugify(category?.name || category || "category"))}`;
