import { readFileSync } from "node:fs";
import { join } from "node:path";
import { patchLegacyHtml } from "./legacyHtmlRoute";

export type LegacyPanelParts = {
  headFragment: string;
  bodyHtml: string;
  bodyClass: string;
  bodyDataPage: string;
};

function readLegacyFile(filename: string): string {
  return readFileSync(join(process.cwd(), filename), "utf-8");
}

function extractHeadFragment(headInner: string): string {
  return headInner
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/<meta\s+charset=["'][^"']*["']\s*\/?>/gi, "")
    .replace(/<meta\s+name=["']viewport["'][^>]*>/gi, "")
    .trim();
}

function stripSiteChrome(bodyInner: string): string {
  return bodyInner
    .replace(/<div\s+id=["']site-header["'][^>]*>\s*<\/div>\s*/gi, "")
    .replace(/<div\s+id=["']site-footer["'][^>]*>\s*<\/div>\s*/gi, "")
    .replace(/<script\s+src=["']\/layout\.js["'][^>]*>\s*<\/script>\s*/gi, "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>\s*/gi, "")
    .trim();
}

export function getLegacyPanelParts(filename: string): LegacyPanelParts {
  const raw = readLegacyFile(filename);
  const html = patchLegacyHtml(raw);

  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headFragment = extractHeadFragment(headMatch?.[1] ?? "");

  const bodyOpen = html.match(/<body([^>]*)>/i);
  const bodyAttrs = bodyOpen?.[1] ?? "";
  const bodyClass =
    bodyAttrs.match(/\bclass=["']([^"']*)["']/i)?.[1] ??
    bodyAttrs.match(/\bclass=([^\s>]+)/i)?.[1]?.replace(/^["']|["']$/g, "") ??
    "";
  const bodyDataPage = bodyAttrs.match(/\bdata-page=["']([^"']*)["']/i)?.[1] ?? "";

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = stripSiteChrome(bodyMatch?.[1] ?? "");

  return { headFragment, bodyHtml, bodyClass, bodyDataPage };
}

export const ARCHITECT_PANEL_TAB_BY_SEGMENT: Record<string, string> = {
  favoriler: "fav-products",
  projeler: "fav-projects",
  ayarlar: "collections",
};

export const BRAND_PANEL_FILE_BY_SEGMENT: Record<string, string> = {
  "": "marka-paneli.html",
  urunler: "marka-paneli-urunler.html",
  iletisim: "marka-paneli-iletisim.html",
  ayarlar: "marka-paneli-iletisim.html",
  projeler: "marka-paneli-projeler.html",
  analiz: "marka-paneli-analiz.html",
  proje: "marka-paneli-proje.html",
  talepler: "marka-paneli-talepler.html",
};

/** marka-panel.js init — LegacyPanelShell inline script ile set edilir. */
export const BRAND_PANEL_PAGE_BY_SEGMENT: Record<string, string> = {
  "": "overview",
  urunler: "products",
  iletisim: "iletisim",
  ayarlar: "iletisim",
  projeler: "projects",
  analiz: "analytics",
  proje: "project-new",
  talepler: "talepler",
};

export function getBrandPanelFilename(segment = ""): string | null {
  const key = segment.replace(/^\/+|\/+$/g, "");
  return BRAND_PANEL_FILE_BY_SEGMENT[key] ?? null;
}

export function getBrandPanelPageId(segment = ""): string {
  const key = segment.replace(/^\/+|\/+$/g, "");
  return BRAND_PANEL_PAGE_BY_SEGMENT[key] ?? "overview";
}
