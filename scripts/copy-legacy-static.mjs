import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const legacyDist = path.join(dist, "legacy");

const rootLegacyFiles = [
  "admin-giris.html",
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
  "tasarim-panosu.html",
  "urunler.html",
  "uiHelpers.js",
  "urun-unica-baffle.html",
  "markalar.html",
  "yeni-koleksiyonlar.html",
];

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
  if (!(await exists(from))) return;
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
}

for (const file of rootLegacyFiles) {
  await copyIfExists(path.join(root, file), path.join(dist, file));
}

for (const dir of staticDirs) {
  await copyIfExists(path.join(root, dir), path.join(dist, dir));
}

await mkdir(legacyDist, { recursive: true });
await writeFile(
  path.join(legacyDist, "README.txt"),
  "Legacy dashboard/auth/static pages are preserved at their original root URLs during Astro builds.\n"
);

console.log("Legacy static files copied into dist.");
