import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const legacyDist = path.join(dist, "legacy");

/** Daha spesifik yollar önce (legacyHtmlRoute ile uyumlu + moodboards → boardlar). */
const ROUTE_REPLACEMENTS = [
  [/\/mimar-paneli\.html\?tab=fav-products/gi, "/mimar-paneli/favoriler"],
  [/\/mimar-paneli\.html\?tab=fav-projects/gi, "/mimar-paneli/projeler"],
  [/\/mimar-paneli\.html\?tab=collections/gi, "/mimar-paneli/ayarlar"],
  [/\/mimar-paneli\.html\?tab=moodboards/gi, "/mimar-paneli/boardlar"],
  [/\/moodboard\.html/g, "/mimar-paneli/boardlar"],
  [/\/marka-paneli-urunler\.html/g, "/marka-paneli/urunler"],
  [/\/marka-paneli-projeler\.html/g, "/marka-paneli/projeler"],
  [/\/marka-paneli-proje\.html/g, "/marka-paneli/proje"],
  [/\/marka-paneli-analiz\.html/g, "/marka-paneli/analiz"],
  [/\/marka-paneli-iletisim\.html/g, "/marka-paneli/iletisim"],
  [/\/marka-paneli-talepler\.html/g, "/marka-paneli/talepler"],
  [/location\.href\s*=\s*["']\/mimar-giris\.html["']/gi, 'location.href = "/giris"'],
  [/location\.replace\(\s*["']\/mimar-giris\.html[^"']*["']\s*\)/gi, 'location.replace("/giris")'],
  [/location\.href\s*=\s*["']\/admin-giris\.html["']/gi, 'location.href = "/giris"'],
  [/location\.href\s*=\s*["']\/marka-giris\.html["']/gi, 'location.href = "/giris"'],
  [/\/admin-giris\.html/g, "/giris"],
  [/\/marka-giris\.html/g, "/giris"],
  [/\/mimar-giris\.html/g, "/kayit"],
  [/\/giris\.html/g, "/giris"],
  [/\/admin-paneli\.html/g, "/admin-paneli"],
  [/\/marka-paneli\.html/g, "/marka-paneli"],
  [/\/mimar-paneli\.html/g, "/mimar-paneli"],
];

function patchLegacyRoutes(content) {
  let out = content;
  for (const [pattern, target] of ROUTE_REPLACEMENTS) {
    out = out.replace(pattern, target);
  }
  return out;
}

const rootLegacyFiles = [
  "admin-giris.html",
  "admin-panel.js",
  "admin-paneli.html",
  "analyticsService.js",
  "architectService.js",
  "authService.js",
  "brandService.js",
  "core.js",
  "faq.html",
  "giris.html",
  "hakkimizda.html",
  "iletisim-v2.html",
  "layout.js",
  "marka-basvuru.html",
  "marka-giris.html",
  "marka-panel-chrome.css",
  "marka-panel.js",
  "marka-paneli.html",
  "marka-paneli-analiz.html",
  "marka-paneli-proje.html",
  "marka-paneli-projeler.html",
  "marka-paneli-urunler.html",
  "marka-paneli-iletisim.html",
  "marka-paneli-talepler.html",
  "mimar-giris.html",
  "mimar-paneli.html",
  "mimar-proje-ekle.html",
  "moodboard.html",
  "moodboardService.js",
  "mvp-taslak-v1.html",
  "nasil-calisir.html",
  "product-detail.html",
  "product-detail.js",
  "productService.js",
  "proje-detay.html",
  "projeler.html",
  "projectService.js",
  "seoHelpers.js",
  "site.css",
  "supabaseClient.js",
  "taxonomy-merge.js",
  "tasarim-panosu.html",
  "urunler.html",
  "uiHelpers.js",
  "urun-unica-baffle.html",
  "markalar.html",
  "yeni-koleksiyonlar.html",
];

const PATCH_EXTENSIONS = new Set([".html", ".js", ".mjs"]);

const staticDirs = ["logos", "brand_assets"];

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function copyIfExists(from, to) {
  if (!(await exists(from))) return false;
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
  return true;
}

async function patchDistFileIfNeeded(distPath) {
  const ext = path.extname(distPath).toLowerCase();
  if (!PATCH_EXTENSIONS.has(ext)) return;
  if (!(await exists(distPath))) return;
  const raw = await readFile(distPath, "utf-8");
  const patched = patchLegacyRoutes(raw);
  if (patched !== raw) {
    await writeFile(distPath, patched, "utf-8");
  }
}

let patchedCount = 0;
for (const file of rootLegacyFiles) {
  const from = path.join(root, file);
  const to = path.join(dist, file);
  if (await copyIfExists(from, to)) {
    await patchDistFileIfNeeded(to);
    if (PATCH_EXTENSIONS.has(path.extname(file).toLowerCase())) patchedCount += 1;
  }
}

for (const dir of staticDirs) {
  await copyIfExists(path.join(root, dir), path.join(dist, dir));
}

await copyIfExists(
  path.join(root, "data", "archilink-final-taxonomy-v1.json"),
  path.join(dist, "data", "archilink-final-taxonomy-v1.json"),
);

await mkdir(legacyDist, { recursive: true });
await writeFile(
  path.join(legacyDist, "README.txt"),
  "Legacy dashboard/auth/static pages are preserved at their original root URLs during Astro builds.\n"
);

console.log(`Legacy static files copied into dist (${patchedCount} text assets route-patched).`);
