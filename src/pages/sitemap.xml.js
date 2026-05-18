import { getSitemapCatalogEntries } from "../lib/catalog.js";
import { brandPath, categoryPath, productPath, projectPath } from "../lib/slugs.js";

const xmlEscape = (value) => String(value || "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const toIsoDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const urlNode = ({ loc, lastmod, changefreq = "weekly", priority = "0.7" }) => `
  <url>
    <loc>${xmlEscape(loc)}</loc>
    <lastmod>${xmlEscape(toIsoDate(lastmod))}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;

export const GET = async ({ site, url }) => {
  const origin = site?.origin || url.origin || "https://cool-bienenstitch-6090eb.netlify.app";
  const { products, brands, projects, categories } = await getSitemapCatalogEntries();

  const staticUrls = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/urunler", priority: "0.9", changefreq: "daily" },
    { loc: "/brands", priority: "0.8", changefreq: "weekly" },
    { loc: "/projects", priority: "0.8", changefreq: "weekly" },
    { loc: "/categories", priority: "0.7", changefreq: "weekly" },
  ];

  const dynamicUrls = [
    ...products.map((item) => ({
      loc: productPath(item),
      lastmod: item.updated_at || item.created_at,
      priority: "0.8",
      changefreq: "weekly",
    })),
    ...brands.map((item) => ({
      loc: brandPath(item),
      lastmod: item.updated_at || item.created_at,
      priority: "0.7",
      changefreq: "weekly",
    })),
    ...projects.map((item) => ({
      loc: projectPath(item),
      lastmod: item.updated_at || item.created_at,
      priority: "0.7",
      changefreq: "weekly",
    })),
    ...categories.map((item) => ({
      loc: categoryPath(item),
      lastmod: item.updated_at || item.created_at,
      priority: "0.6",
      changefreq: "weekly",
    })),
  ];

  const urls = [...staticUrls, ...dynamicUrls]
    .filter((item) => item.loc)
    .map((item) => ({
      ...item,
      loc: new URL(item.loc, origin).href,
    }));

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(urlNode).join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900",
    },
  });
};
