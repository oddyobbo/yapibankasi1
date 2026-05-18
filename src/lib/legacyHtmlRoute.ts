import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Daha spesifik marka panel yolları önce eşleşmeli. */
const ROUTE_REPLACEMENTS: [RegExp, string][] = [
  [/\/mimar-paneli\.html\?tab=fav-products/gi, "/mimar-paneli/favoriler"],
  [/\/mimar-paneli\.html\?tab=fav-projects/gi, "/mimar-paneli/projeler"],
  [/\/mimar-paneli\.html\?tab=collections/gi, "/mimar-paneli/ayarlar"],
  [/\/mimar-paneli\.html\?tab=moodboards/gi, "/mimar-paneli"],
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

const BRAND_PANEL_HTML: Record<string, string> = {
  "": "marka-paneli.html",
  urunler: "marka-paneli-urunler.html",
  iletisim: "marka-paneli-iletisim.html",
  ayarlar: "marka-paneli-iletisim.html",
  projeler: "marka-paneli-projeler.html",
  analiz: "marka-paneli-analiz.html",
  proje: "marka-paneli-proje.html",
  talepler: "marka-paneli-talepler.html",
};

export function patchLegacyHtml(html: string): string {
  let out = html;
  for (const [pattern, target] of ROUTE_REPLACEMENTS) {
    out = out.replace(pattern, target);
  }
  return out;
}

export function legacyHtmlResponse(filename: string): Response {
  const html = readFileSync(join(process.cwd(), filename), "utf-8");
  return new Response(patchLegacyHtml(html), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export function brandPanelHtmlResponse(segment = ""): Response {
  const key = segment.replace(/^\/+|\/+$/g, "");
  const filename = BRAND_PANEL_HTML[key];
  if (!filename) {
    return new Response("Sayfa bulunamadı.", { status: 404 });
  }
  return legacyHtmlResponse(filename);
}
