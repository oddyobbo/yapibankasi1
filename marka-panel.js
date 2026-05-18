/** window.__MARKA_PANEL_PAGE__: "overview" | "products" | "analytics" | "project-new" | "projects" | "iletisim" | "talepler" */
function detectMarkaPanelPage() {
  if (typeof window !== "undefined" && window.__MARKA_PANEL_PAGE__) {
    return window.__MARKA_PANEL_PAGE__;
  }
  if (typeof document === "undefined") return "overview";
  if (document.getElementById("panel-urunler") || document.getElementById("brand-products")) return "products";
  if (document.getElementById("panel-analiz")) return "analytics";
  if (document.getElementById("panel-projeler")) return "projects";
  if (document.getElementById("panel-proje-form")) return "project-new";
  if (document.getElementById("brand-contact-form")) return "iletisim";
  if (document.getElementById("brand-leads-list")) return "talepler";
  return "overview";
}
const PAGE = detectMarkaPanelPage();

const MB_BYTES = 1024 * 1024;
const IMAGE_MAX_MB = 8;
const PDF_MAX_MB = 25;
const CAD_MAX_MB = 50;
const BIM_MAX_MB = 100;
const IMAGE_MAX_BYTES = IMAGE_MAX_MB * MB_BYTES;
const PDF_MAX_BYTES = PDF_MAX_MB * MB_BYTES;
const CAD_MAX_BYTES = CAD_MAX_MB * MB_BYTES;
const BIM_MAX_BYTES = BIM_MAX_MB * MB_BYTES;

    const countProducts = document.getElementById("count-products");
    const countFiles    = document.getElementById("count-files");
    const countDrafts   = document.getElementById("count-drafts");
    const countViews    = document.getElementById("count-views");

    let session = null;
    /** Tam brands satırı (status dahil); tüm panel sayfaları için init’te doldurulur. */
    let brandRecordGlobal = null;
    let brandRecordIdCached = null;
    let selectMode = false;
    let selectedProductIds = new Set();
    let analyticsRange = 30;
    let mergedTaxonomyTree = null;
    let brandProductsCache = [];
    let editingProductId = null;
    let isEditMode = false;
    let editingProductStatus = null;
    let renderProductImageBadges = () => {};

    const FINAL_L1_SLUG_ORDER = [
      "zemin-yuzey",
      "yapi-cephe",
      "ic-mekan-mobilya",
      "mutfak-banyo",
      "teknik-sistemler",
      "dis-mekan-peyzaj",
    ];
    const FINAL_L1_SLUGS = new Set(FINAL_L1_SLUG_ORDER);

    const KNOWN_BRAND_STATUSES = new Set(["pending", "approved", "rejected", "suspended"]);
    const KNOWN_FORM_TECH_KEYS = new Set([
      "fireClass",
      "acoustic",
      "dimensions",
      "thickness",
      "certificates",
      "usageScope",
      "materialType",
      "material",
      "materialType",
      "materialFamily",
      "summary",
      "gallery",
      "galleryUrls",
    ]);

    async function loadMergedTaxonomyTree(force = false) {
      if (mergedTaxonomyTree && !force) return mergedTaxonomyTree;
      if (force) mergedTaxonomyTree = null;
      if (typeof AG.getMergedTaxonomyTree !== "function") {
        throw new Error("AG.getMergedTaxonomyTree tanımlı değil.");
      }
      mergedTaxonomyTree = await AG.getMergedTaxonomyTree({ surface: "brandForm" });
      return mergedTaxonomyTree;
    }

    function findTaxonomyL1(slug) {
      return (mergedTaxonomyTree || []).find((n) => n.slug === slug) || null;
    }

    function findTaxonomyL2(l1Slug, l2Slug) {
      const l1 = findTaxonomyL1(l1Slug);
      return (l1?.children || []).find((n) => n.slug === l2Slug) || null;
    }

    function findTaxonomyL3(l1Slug, l2Slug, l3Slug) {
      const l2 = findTaxonomyL2(l1Slug, l2Slug);
      return (l2?.children || []).find((n) => n.slug === l3Slug) || null;
    }

    function resetTaxonomySelect(sel, placeholder, disabled = true, clearOptions = true) {
      if (!sel) return;
      if (clearOptions) {
        sel.innerHTML = `<option value="">${placeholder}</option>`;
      } else {
        sel.value = "";
      }
      sel.disabled = disabled;
    }

    function categorySlugAliasesForBrandForm(slug) {
      const clean = String(slug || "").trim();
      const aliases = new Set([clean]);
      if (clean === "panel-ve-levha-yuzeyler") {
        aliases.add("panel-levha-yuzeyler");
      }
      return [...aliases];
    }

    function visibilityRowForBrandForm(slug, bySlug) {
      if (!slug || !bySlug) return null;
      for (const alias of categorySlugAliasesForBrandForm(slug)) {
        if (bySlug[alias]) return bySlug[alias];
      }
      return null;
    }

    /** Ürün kaydı sonrası form/taxonomy/medya alanlarını güvenli temizler (await sonrası event.currentTarget null olabilir). */
    function resetProductFormAfterSubmit(form) {
      if (form && typeof form.reset === "function") {
        form.reset();
      }
      const customTech = document.getElementById("custom-tech-rows");
      if (customTech) customTech.innerHTML = "";
      const l1Sel = document.getElementById("manual-l1");
      const l2Sel = document.getElementById("manual-category");
      const l3Sel = document.getElementById("manual-subcategory");
      if (l1Sel) l1Sel.value = "";
      resetTaxonomySelect(l2Sel, "Kategori seç *", true);
      resetTaxonomySelect(l3Sel, "Ürün ailesi seç *", true);
      const imageList = document.getElementById("uploaded-image-list");
      if (imageList) imageList.innerHTML = "";
      const imageMsg = document.getElementById("upload-image-msg");
      if (imageMsg) imageMsg.textContent = "";
      const pdfMsg = document.getElementById("upload-pdf-msg");
      if (pdfMsg) pdfMsg.textContent = `Maks ${PDF_MAX_MB} MB`;
      const cadMsg = document.getElementById("upload-cad-msg");
      if (cadMsg) cadMsg.textContent = `Maks ${CAD_MAX_MB} MB`;
      const bimMsg = document.getElementById("upload-bim-msg");
      if (bimMsg) bimMsg.textContent = `Maks ${BIM_MAX_MB} MB`;
    }

    function brandFormShowsL2(l2) {
      if (!l2) return false;
      if (l2.is_active === false) return false;
      if (l2.show_in_brand_product_form === false) return false;
      return true;
    }

    function brandFormShowsL3(l3) {
      if (!l3) return false;
      if (l3.is_active === false) return false;
      if (l3.show_in_brand_product_form === false) return false;
      return true;
    }

    function brandFormShowsL1(l1) {
      if (!l1?.slug || !FINAL_L1_SLUGS.has(l1.slug)) return false;
      const children = l1.children || [];
      if (!children.length) return true;
      return children.some((l2) => l2.level === 2 && brandFormShowsL2(l2));
    }

    async function fillTaxonomyL1Options(l1Sel) {
      if (!l1Sel) return;
      await loadMergedTaxonomyTree();
      resetTaxonomySelect(l1Sel, "Ana kategori seç *", false, true);
      for (const slug of FINAL_L1_SLUG_ORDER) {
        const l1 = findTaxonomyL1(slug);
        if (!l1 || !brandFormShowsL1(l1)) continue;
        const opt = document.createElement("option");
        opt.value = l1.slug;
        opt.textContent = l1.name_tr;
        l1Sel.appendChild(opt);
      }
    }

    async function fillTaxonomyL2Options(l1Slug, l2Sel) {
      resetTaxonomySelect(l2Sel, "Kategori seç *", !l1Slug);
      if (!l1Slug) return;
      await loadMergedTaxonomyTree();
      const l1 = findTaxonomyL1(l1Slug);
      for (const l2 of l1?.children || []) {
        if (l2.level !== 2 || !brandFormShowsL2(l2)) continue;
        const opt = document.createElement("option");
        opt.value = l2.slug;
        opt.textContent = l2.name_tr;
        l2Sel.appendChild(opt);
      }
      l2Sel.disabled = false;
    }

    async function fillTaxonomyL3Options(l1Slug, l2Slug, l3Sel) {
      resetTaxonomySelect(l3Sel, "Ürün ailesi seç *", !l2Slug);
      if (!l1Slug || !l2Slug) return;
      await loadMergedTaxonomyTree();
      const l2 = findTaxonomyL2(l1Slug, l2Slug);
      for (const l3 of l2?.children || []) {
        if (l3.level !== 3 || !brandFormShowsL3(l3)) continue;
        const opt = document.createElement("option");
        opt.value = l3.slug;
        opt.textContent = l3.name_tr;
        l3Sel.appendChild(opt);
      }
      l3Sel.disabled = false;
    }

    async function resolveTaxonomyDbIds(l2Slug, l3Slug) {
      let categoryId = null;
      let subcategoryId = null;
      try {
        await loadMergedTaxonomyTree();
        for (const l1 of mergedTaxonomyTree || []) {
          const l2 = (l1.children || []).find((n) => n.level === 2 && n.slug === l2Slug);
          if (!l2) continue;
          if (l2.db_id) categoryId = l2.db_id;
          if (l3Slug) {
            const l3 = (l2.children || []).find((n) => n.level === 3 && n.slug === l3Slug);
            if (l3?.db_id) subcategoryId = l3.db_id;
          }
          break;
        }
      } catch (_) {}
      return { categoryId, subcategoryId };
    }

    function taxonomyCategoryLabel(l1Slug, l2Slug, l3Slug) {
      const l1 = findTaxonomyL1(l1Slug);
      const l2 = findTaxonomyL2(l1Slug, l2Slug);
      const l3 = findTaxonomyL3(l1Slug, l2Slug, l3Slug);
      return [l1?.name_tr, l2?.name_tr, l3?.name_tr].filter(Boolean).join(" > ");
    }

    function wireTaxonomyCascade(l1Sel, l2Sel, l3Sel) {
      if (!l1Sel || !l2Sel || !l3Sel) return;
      l1Sel.addEventListener("change", () => {
        void fillTaxonomyL2Options(l1Sel.value, l2Sel);
        resetTaxonomySelect(l3Sel, "Ürün ailesi seç *", true);
      });
      l2Sel.addEventListener("change", () => {
        void fillTaxonomyL3Options(l1Sel.value, l2Sel.value, l3Sel);
      });
    }

    function normalizeBrandStatus(row) {
      if (!row) return { kind: "missing", status: null };
      const s = String(row.status || "").trim();
      if (!KNOWN_BRAND_STATUSES.has(s)) return { kind: "unknown", status: s };
      return { kind: "ok", status: s };
    }

    function canSubmitCatalogProducts() {
      const n = normalizeBrandStatus(brandRecordGlobal);
      return n.kind === "ok" && n.status === "approved";
    }

    function injectStatusBanner() {
      const layout = document.getElementById("brand-panel-layout");
      if (!layout) return;
      const main = layout.querySelector("main");
      if (!main) return;
      document.getElementById("brand-panel-status-banner")?.remove();
      const n = normalizeBrandStatus(brandRecordGlobal);
      if (n.kind === "ok" && n.status === "approved") return;

      let text = "";
      let boxClass =
        "rounded-xl border px-4 py-3 text-[13px] leading-snug mb-6";
      if (n.kind === "missing") {
        text = "Marka kaydı bulunamadı. Lütfen yönetici ile iletişime geçin.";
        boxClass += " border-neutral-200 bg-neutral-50 text-neutral-900";
      } else if (n.kind === "unknown") {
        text =
          "Marka hesabınızın durumu doğrulanamadı. Ürün gönderimi geçici olarak kapalı. Sorun devam ederse yönetici ile iletişime geçin.";
        boxClass += " border-neutral-200 bg-neutral-50 text-neutral-900";
      } else if (n.status === "pending") {
        text =
          "Markanız onay bekliyor. Onaylandıktan sonra ürünlerinizi incelemeye gönderebilirsiniz.";
        boxClass += " border-amber-200 bg-amber-50 text-amber-950";
      } else if (n.status === "rejected") {
        text = "Marka başvurunuz reddedildi. Detay için yönetici ile iletişime geçin.";
        boxClass += " border-red-200 bg-red-50 text-red-950";
      } else if (n.status === "suspended") {
        text = "Markanız askıya alındı. Ürünleriniz public katalogda görünmez.";
        boxClass += " border-slate-300 bg-slate-50 text-slate-900";
      } else {
        text =
          "Marka hesabınızın durumu ürün gönderimine uygun değil. Yönetici ile iletişime geçin.";
        boxClass += " border-neutral-200 bg-neutral-50 text-neutral-900";
      }
      const el = document.createElement("div");
      el.id = "brand-panel-status-banner";
      el.className = boxClass;
      el.setAttribute("role", "status");
      el.textContent = text;
      main.insertBefore(el, main.firstChild);
    }

    function applyCatalogProductGuard() {
      if (PAGE !== "products") return;
      const panel = document.getElementById("panel-urunler");
      if (!panel) return;
      const allowed = canSubmitCatalogProducts();
      let guard = document.getElementById("brand-catalog-product-guard");
      if (!guard) {
        guard = document.createElement("p");
        guard.id = "brand-catalog-product-guard";
        guard.className =
          "text-[13px] mb-4 rounded-lg px-3 py-2 border border-amber-200 bg-amber-50 text-amber-950";
        panel.insertBefore(guard, panel.firstChild);
      }
      if (allowed) {
        guard.classList.add("hidden");
        guard.textContent = "";
      } else {
        guard.classList.remove("hidden");
        guard.textContent = "Ürün gönderebilmek için markanızın onaylanması gerekir.";
      }
      const dis = !allowed;
      panel.querySelectorAll(".mode-tab").forEach((b) => {
        b.disabled = dis;
      });
      ["product-submit-review", "save-product-draft-btn", "import-csv", "btn-save-url-product"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = dis;
      });
    }

    async function init() {
      await AG.ready;
      session = await AG.getSessionBrand();

      if (!session) {
        const layout = document.getElementById("brand-panel-layout");
        if (layout) {
          layout.innerHTML = `
          <main class="flex-1 w-full px-5 py-10">
            <section class="rounded-2xl border border-black/[0.08] p-6 max-w-2xl mx-auto bg-white">
              <h1 class="text-[24px] sm:text-[28px] font-semibold tracking-tight text-[#1d1d1f]">Marka paneline erişim için giriş yapmalısın.</h1>
              <p class="text-[14px] text-[#6e6e73] mt-2">Marka hesabınla giriş yaparak ürünleri yönetebilir, incelemeye gönderebilir ve performansı görebilirsin.</p>
              <a href="/giris" class="inline-block mt-5 px-5 py-2.5 rounded-lg bg-[#1d1d1f] text-white text-[14px] font-semibold hover:bg-[#3a3a3c]">Giriş yap</a>
            </section>
          </main>`;
        }
        return;
      }

      try {
        brandRecordGlobal = await AG.getBrandRecordForProfile(session.id);
      } catch (err) {
        console.error("Marka paneli: getBrandRecordForProfile", err);
        brandRecordGlobal = null;
      }
      brandRecordIdCached = brandRecordGlobal?.id || null;

      setupBrandPanelNavActive();
      injectStatusBanner();

      if (PAGE === "products") {
        await setupCategorySelectors();
        attachHandlers();
        applyCatalogProductGuard();
        closeProductFormShell();
        await render();
      } else if (PAGE === "analytics") {
        setupAnalyticsRange();
        await render();
      } else if (PAGE === "overview") {
        await render();
      } else if (PAGE === "project-new") {
        attachHandlers();
        await hydrateProjectMaterialOptions();
      } else if (PAGE === "projects") {
        await render();
      } else if (PAGE === "iletisim") {
        await setupContactForm();
      } else if (PAGE === "talepler") {
        await setupBrandLeadsPage();
      }
    }

    const LEAD_STATUS_OPTIONS = ["new", "open", "answered", "closed", "spam"];

    function leadStatusLabelTr(s) {
      if (s === "new") return "Yeni";
      if (s === "open") return "Görüşülüyor";
      if (s === "answered") return "Yanıtlandı";
      if (s === "closed") return "Kapatıldı";
      if (s === "spam") return "Spam";
      return s || "—";
    }

    function leadTypeLabelTr(t) {
      if (t === "quote") return "Teklif";
      if (t === "sample") return "Numune";
      if (t === "contact") return "İletişim";
      return t || "—";
    }

    function pickProductFromLead(lead) {
      const p = lead?.products;
      if (!p) return null;
      return Array.isArray(p) ? p[0] || null : p;
    }

    async function setupBrandLeadsPage() {
      const listEl = document.getElementById("brand-leads-list");
      const emptyEl = document.getElementById("brand-leads-empty");
      const msg = document.getElementById("brand-leads-msg");
      if (!listEl || !session) return;

      const showMsg = (text, ok) => {
        if (!msg) return;
        msg.textContent = text;
        msg.className = ok
          ? "mt-2 text-[13px] rounded-lg px-3 py-2 border border-emerald-200 bg-emerald-50 text-emerald-900"
          : "mt-2 text-[13px] rounded-lg px-3 py-2 border border-red-200 bg-red-50 text-red-900";
        msg.classList.remove("hidden");
      };
      const hideMsg = () => {
        if (!msg) return;
        msg.textContent = "";
        msg.classList.add("hidden");
      };

      const updateLeadSummaryStats = (leads) => {
        const set = (id, n) => {
          const el = document.getElementById(id);
          if (el) el.textContent = String(n);
        };
        const st = (l) => String(l.status || "new").trim();
        set("brand-leads-stat-total", leads.length);
        set("brand-leads-stat-new", leads.filter((l) => st(l) === "new").length);
        set("brand-leads-stat-open", leads.filter((l) => st(l) === "open").length);
        set("brand-leads-stat-answered", leads.filter((l) => st(l) === "answered").length);
        set("brand-leads-stat-closed", leads.filter((l) => st(l) === "closed").length);
      };

      const renderLeadCard = (lead) => {
        const prod = pickProductFromLead(lead);
        const slug = String(prod?.slug || "").trim();
        const pname = String(prod?.name || "—").trim();
        const href = slug ? `/urunler/${encodeURIComponent(slug)}` : "";
        const productLine = href
          ? `<a href="${escAttr(href)}" class="text-[15px] font-semibold text-[#0071e3] hover:underline" target="_blank" rel="noopener noreferrer">${escAttr(pname)}</a>`
          : `<span class="text-[15px] font-semibold text-[#1d1d1f]">${escAttr(pname)}</span>`;
        const created = lead.created_at ? new Date(lead.created_at).toLocaleString("tr-TR") : "—";
        const status = String(lead.status || "new");
        const opts = LEAD_STATUS_OPTIONS.map(
          (v) =>
            `<option value="${v}"${v === status ? " selected" : ""}>${escAttr(leadStatusLabelTr(v))}</option>`,
        ).join("");
        const intent = escAttr(String(lead.request_intent || "—").trim() || "—");
        return `<article class="rounded-xl border border-black/[0.1] bg-white p-4 sm:p-5 shadow-sm" role="listitem" data-lead-id="${escAttr(lead.id)}">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-black/[0.06] pb-3 mb-3">
            <div class="min-w-0 flex-1 space-y-1">
              <p class="text-[11px] font-medium uppercase tracking-wide text-[#6e6e73]">Ürün</p>
              ${productLine}
              <p class="text-[12px] text-[#6e6e73] mt-1"><span class="font-medium text-[#424245]">Talep türü:</span> ${escAttr(leadTypeLabelTr(lead.lead_type))}</p>
            </div>
            <div class="flex flex-col items-start sm:items-end gap-1 shrink-0">
              <p class="text-[11px] text-[#6e6e73] whitespace-nowrap">${escAttr(created)}</p>
              <label class="text-[11px] text-[#6e6e73] font-medium">Durum</label>
              <select data-lead-status-select="1" data-lead-id="${escAttr(lead.id)}" data-prev-status="${escAttr(status)}" class="rounded-lg border border-black/[0.12] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[#1d1d1f] min-w-[10rem]">${opts}</select>
            </div>
          </div>
          <p class="text-[12px] text-[#6e6e73] mb-2"><span class="font-semibold text-[#424245]">Talep niyeti:</span> ${intent}</p>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
            <div><dt class="text-[11px] uppercase tracking-wide text-[#6e6e73] font-medium">Ad soyad</dt><dd class="text-[#1d1d1f] mt-0.5 break-words">${escAttr(lead.name || "—")}</dd></div>
            <div><dt class="text-[11px] uppercase tracking-wide text-[#6e6e73] font-medium">Şirket</dt><dd class="text-[#1d1d1f] mt-0.5 break-words">${escAttr(lead.company || "—")}</dd></div>
            <div><dt class="text-[11px] uppercase tracking-wide text-[#6e6e73] font-medium">E-posta</dt><dd class="text-[#1d1d1f] mt-0.5 break-all">${
              lead.email
                ? `<a href="mailto:${escAttr(String(lead.email).trim())}" class="text-[#0071e3] hover:underline">${escAttr(String(lead.email).trim())}</a>`
                : escAttr("—")
            }</dd></div>
            <div><dt class="text-[11px] uppercase tracking-wide text-[#6e6e73] font-medium">Telefon</dt><dd class="text-[#1d1d1f] mt-0.5">${escAttr(lead.phone || "—")}</dd></div>
          </dl>
          <div class="mt-3 pt-3 border-t border-black/[0.06]">
            <p class="text-[11px] uppercase tracking-wide text-[#6e6e73] font-medium">Mesaj</p>
            <p class="text-[13px] text-[#1d1d1f] mt-1 whitespace-pre-wrap break-words leading-relaxed">${escAttr(lead.message || "—")}</p>
          </div>
          <p class="mt-3 text-[11px] text-[#86868b]"><span class="font-medium text-[#6e6e73]">Durum:</span> ${escAttr(leadStatusLabelTr(status))}</p>
        </article>`;
      };

      async function loadLeads() {
        hideMsg();
        let res;
        try {
          res = await AG.listLeadsForBrand(session.id);
        } catch (err) {
          console.error("Talepler yüklenemedi", err);
          showMsg("Talepler yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.", false);
          listEl.innerHTML = "";
          listEl.classList.add("hidden");
          if (emptyEl) emptyEl.classList.add("hidden");
          updateLeadSummaryStats([]);
          return;
        }
        if (!res?.ok) {
          showMsg(res?.message || "Talepler alınamadı. Lütfen tekrar deneyin.", false);
          console.error("listLeadsForBrand", res);
          listEl.innerHTML = "";
          listEl.classList.add("hidden");
          if (emptyEl) emptyEl.classList.add("hidden");
          updateLeadSummaryStats([]);
          return;
        }
        const leads = res.leads || [];
        updateLeadSummaryStats(leads);
        if (leads.length === 0) {
          listEl.innerHTML = "";
          listEl.classList.add("hidden");
          if (emptyEl) emptyEl.classList.remove("hidden");
          return;
        }
        if (emptyEl) emptyEl.classList.add("hidden");
        listEl.classList.remove("hidden");
        listEl.innerHTML = leads.map((lead) => renderLeadCard(lead)).join("");
      }

      listEl.addEventListener("change", async (e) => {
        const sel = e.target;
        if (!sel?.matches?.("[data-lead-status-select]")) return;
        const leadId = sel.getAttribute("data-lead-id");
        const next = sel.value;
        const prev = sel.getAttribute("data-prev-status") || "";
        if (!leadId || prev === next) return;
        sel.disabled = true;
        try {
          const r = await AG.updateBrandLeadStatus(session.id, leadId, next);
          if (!r?.ok) {
            showMsg(r?.message || "Durum güncellenemedi.", false);
            console.error("updateBrandLeadStatus", r);
            await loadLeads();
            return;
          }
          showMsg("Talep durumu güncellendi.", true);
          sel.setAttribute("data-prev-status", next);
        } catch (err) {
          showMsg("Durum güncellenirken bir hata oluştu.", false);
          console.error("updateBrandLeadStatus", err);
          await loadLeads();
        } finally {
          sel.disabled = false;
        }
      });

      await loadLeads();
    }

    async function setupContactForm() {
      const form = document.getElementById("brand-contact-form");
      const msg = document.getElementById("brand-contact-msg");
      if (!form || !session) return;
      if (form.dataset.contactBound === "1") return;
      form.dataset.contactBound = "1";

      const submitBtn = form.querySelector('button[type="submit"]');
      const defaultBtnText = (submitBtn?.textContent || "Kaydet").trim() || "Kaydet";

      let brandRow = null;
      try {
        brandRow = await AG.getBrandRecordForProfile(session.id);
      } catch (err) {
        console.error("Marka iletişim: getBrandRecordForProfile", err);
        brandRow = null;
      }

      if (brandRow) {
        form.elements.website.value = brandRow.website || "";
        form.elements.email.value = brandRow.email || "";
        form.elements.phone.value = brandRow.phone || "";
        form.elements.whatsapp_number.value = brandRow.whatsapp_number || "";
        form.elements.address.value = brandRow.address || "";
        form.elements.city.value = brandRow.city || "";
        form.elements.country.value = brandRow.country || "";
      }

      const showErr = (text) => {
        if (msg) {
          msg.textContent = text;
          msg.className = "text-[13px] text-red-600 mt-3";
          msg.classList.remove("hidden");
        }
      };
      const showOk = (text) => {
        if (msg) {
          msg.textContent = text;
          msg.className = "text-[13px] text-green-600 mt-3";
          msg.classList.remove("hidden");
        }
      };

      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!brandRow) {
          showErr("Marka kaydı bulunamadı. Lütfen yönetici ile iletişime geçin.");
          console.error("Marka iletişim: brands satırı yok (profile_id)", session.id);
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Kaydediliyor...";
        }
        try {
          if (msg) {
            msg.textContent = "";
            msg.classList.add("hidden");
          }
          const fd = new FormData(form);
          const patch = {
            website: fd.get("website")?.toString() ?? "",
            email: fd.get("email")?.toString() ?? "",
            phone: fd.get("phone")?.toString() ?? "",
            whatsapp_number: fd.get("whatsapp_number")?.toString() ?? "",
            address: fd.get("address")?.toString() ?? "",
            city: fd.get("city")?.toString() ?? "",
            country: fd.get("country")?.toString() ?? "",
          };
          const emailTrim = patch.email.trim();
          if (emailTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
            showErr("Geçerli bir e-posta girin veya alanı boş bırakın.");
            console.error("Marka iletişim: geçersiz e-posta", emailTrim);
            return;
          }
          patch.whatsapp_number = String(patch.whatsapp_number || "").replace(/\s/g, "");
          const r = await AG.updateBrandContactFields(session.id, patch);
          if (!r?.ok) {
            showErr(r?.message || "Güncelleme sırasında bir hata oluştu. Lütfen tekrar deneyin.");
            console.error("Marka iletişim güncelleme hatası", r);
            return;
          }
          showOk("İletişim bilgileri güncellendi.");
          const refreshed = await AG.getBrandRecordForProfile(session.id);
          if (refreshed && form) {
            form.elements.website.value = refreshed.website || "";
            form.elements.email.value = refreshed.email || "";
            form.elements.phone.value = refreshed.phone || "";
            form.elements.whatsapp_number.value = refreshed.whatsapp_number || "";
            form.elements.address.value = refreshed.address || "";
            form.elements.city.value = refreshed.city || "";
            form.elements.country.value = refreshed.country || "";
          }
        } catch (err) {
          showErr("Güncelleme sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.");
          console.error("Marka iletişim submit", err);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = defaultBtnText;
          }
        }
      });
    }

    function setupBrandPanelNavActive() {
      const key = document.body.getAttribute("data-brand-nav");
      if (!key) return;
      document.querySelectorAll("[data-brand-nav-link]").forEach((a) => {
        a.classList.toggle("active", a.getAttribute("data-brand-nav-link") === key);
      });
    }

    function setupAnalyticsRange() {
      const wrap = document.getElementById("analytics-range-btns");
      if (!wrap) return;
      wrap.querySelectorAll(".analytics-range").forEach((btn) => {
        btn.addEventListener("click", () => {
          const r = btn.getAttribute("data-range");
          analyticsRange = r === "all" ? "all" : Number(r);
          wrap.querySelectorAll(".analytics-range").forEach((b) => {
            const br = b.getAttribute("data-range");
            const on = br === "all" ? analyticsRange === "all" : Number(br) === analyticsRange;
            b.classList.toggle("bg-black", on);
            b.classList.toggle("text-white", on);
            b.classList.toggle("bg-white", !on);
          });
          render();
        });
      });
    }

    function escAttr(s) {
      return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;");
    }

    function normalizeProductStatus(status) {
      return String(status || "draft").trim().toLowerCase();
    }

    function getProductStatus(product) {
      const raw =
        product?.status ??
        product?.productStatus ??
        product?.product_status ??
        "";
      const normalized = normalizeProductStatus(raw);
      if (!raw && product?.id) {
        if (!getProductStatus._warned) getProductStatus._warned = new Set();
        if (getProductStatus._warned.size < 8 && !getProductStatus._warned.has(product.id)) {
          console.warn(
            "[marka-panel] Ürün status alanı boş; taslak varsayıldı:",
            product.id,
            product.name,
          );
          getProductStatus._warned.add(product.id);
        }
      }
      return normalized;
    }

    function statusLabel(status) {
      const s = normalizeProductStatus(status);
      if (s === "published") return "Yayında";
      if (s === "unpublished") return "Yayında Değil";
      if (s === "pending_review") return "İncelemede";
      if (s === "draft") return "Taslak";
      if (s === "needs_revision") return "Revize gerekli";
      if (s === "rejected") return "Reddedildi";
      if (s === "archived") return "Arşivde";
      return "Taslak";
    }

    function statusBadgeClass(status) {
      const s = normalizeProductStatus(status);
      const map = {
        draft: "brand-product-status--draft",
        pending_review: "brand-product-status--pending",
        published: "brand-product-status--published",
        unpublished: "brand-product-status--unpublished",
        needs_revision: "brand-product-status--revision",
        rejected: "brand-product-status--rejected",
        archived: "brand-product-status--archived",
      };
      return map[s] || "brand-product-status--draft";
    }

    function formatProductDate(product) {
      const raw =
        product?.updatedAt ??
        product?.updated_at ??
        product?.createdAt ??
        product?.created_at ??
        null;
      if (raw == null || raw === "") return "";
      const d = typeof raw === "number" ? new Date(raw) : new Date(String(raw));
      if (Number.isNaN(d.getTime())) return "";
      return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
    }

    function productCatalogHref(product) {
      const slug = String(product?.slug || "").trim();
      if (!slug || getProductStatus(product) !== "published") return "";
      return `/urunler/${encodeURIComponent(slug)}`;
    }

    function productCardHtml(p, ana) {
      const status = getProductStatus(p);
      const name = String(p.name || "—").replace(/</g, "&lt;");
      const sku = String(p.sku || "—").replace(/</g, "&lt;");
      const category = String(p.category || "—").replace(/</g, "&lt;");
      const id = escAttr(p.id);
      const thumb =
        (p.image && String(p.image).trim()) ||
        "https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=120&auto=format&fit=crop";
      const dateStr = formatProductDate(p);
      const dateLabel = dateStr
        ? p.updatedAt || p.updated_at
          ? `Güncellendi: ${dateStr}`
          : `Oluşturuldu: ${dateStr}`
        : "";
      const catalogHref = productCatalogHref(p);
      const catalogLink = catalogHref
        ? `<a href="${escAttr(catalogHref)}" class="text-[11px] font-medium text-[#0071e3] hover:underline" target="_blank" rel="noopener noreferrer">Katalogda görüntüle</a>`
        : "";
      const pv = ana?.viewsByProduct?.[p.id] || 0;
      const selectHtml = selectMode
        ? `<label class="inline-flex items-center gap-1.5 text-[11px] shrink-0 cursor-pointer text-[#1d1d1f]"><input type="checkbox" class="accent-black w-3.5 h-3.5 rounded border-black/20" data-select-product="${id}" ${selectedProductIds.has(p.id) ? "checked" : ""}> Seç</label>`
        : "";

      return `<article class="brand-product-row rounded-xl border border-black/[0.08] bg-white p-3 ${selectMode && selectedProductIds.has(p.id) ? "ring-2 ring-black/75" : ""}">
        <div class="flex gap-3">
          <img src="${escAttr(thumb)}" alt="" width="56" height="56" class="w-14 h-14 shrink-0 rounded-lg object-cover bg-[#f5f5f7] border border-black/[0.06]" loading="lazy" decoding="async">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-start justify-between gap-2">
              <h4 class="text-[13px] font-semibold text-[#1d1d1f] leading-snug line-clamp-2">${name}</h4>
              <span class="brand-product-status-badge ${statusBadgeClass(status)}">${statusLabel(status)}</span>
            </div>
            <p class="text-[11px] text-[#6e6e73] mt-0.5 truncate" title="${escAttr(category)}">${category}</p>
            <p class="text-[11px] text-[#6e6e73] mt-0.5">SKU: ${sku}${dateLabel ? ` · ${dateLabel.replace(/</g, "&lt;")}` : ""}${pv ? ` · ${pv} görüntülenme` : ""}</p>
            ${catalogLink ? `<p class="mt-1">${catalogLink}</p>` : ""}
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              ${selectHtml}
              ${productCardActionsHtml(p)}
            </div>
          </div>
        </div>
      </article>`;
    }

    function productCardActionsHtml(p) {
      const s = getProductStatus(p);
      const id = escAttr(p.id);
      const btn = "brand-product-action-btn";
      const btnDanger = "brand-product-action-btn brand-product-action-btn-danger";
      const btnPassive = "brand-product-action-passive";
      const parts = [];

      parts.push(
        `<button type="button" class="${btn}" data-action="edit" data-id="${id}">Düzenle</button>`,
      );

      if (s === "published") {
        parts.push(
          `<button type="button" class="${btn}" data-action="unpublish" data-id="${id}">Yayından Kaldır</button>`,
        );
      } else if (s === "unpublished") {
        parts.push(
          `<button type="button" class="${btn}" data-action="republish" data-id="${id}">Tekrar Yayına Al</button>`,
        );
      } else if (s === "pending_review") {
        parts.push(`<span class="${btnPassive}" aria-disabled="true">İncelemede</span>`);
      } else if (s === "draft" || s === "needs_revision") {
        const reviewDisabled = canSubmitCatalogProducts() ? "" : " disabled";
        parts.push(
          `<button type="button" class="${btn}" data-action="submit-review" data-id="${id}"${reviewDisabled}>İncelemeye Gönder</button>`,
        );
      }

      if (s === "draft") {
        parts.push(
          `<button type="button" class="${btnDanger}" data-action="delete" data-id="${id}">Sil</button>`,
        );
      }

      return parts.join("");
    }

    function showProductListToast(message) {
      const el = document.getElementById("product-list-action-msg");
      if (!el) {
        alert(message);
        return;
      }
      el.textContent = message;
      el.className = "mt-2 text-[12px] font-medium text-green-700";
      el.classList.remove("hidden");
      clearTimeout(showProductListToast._timer);
      showProductListToast._timer = setTimeout(() => {
        el.classList.add("hidden");
        el.textContent = "";
      }, 4500);
    }

    async function handleProductListActionClick(ev) {
      const btn = ev.target.closest("[data-action][data-id]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      if (!id) return;

      if (action === "edit") {
        const product = brandProductsCache.find((p) => String(p.id) === String(id));
        if (!product) {
          alert("Ürün bulunamadı. Sayfayı yenileyip tekrar deneyin.");
          return;
        }
        openProductEdit(product);
        return;
      }

      if (action === "unpublish") {
        if (!confirm("Bu ürün katalogdan kaldırılacak. Devam edilsin mi?")) return;
        btn.disabled = true;
        try {
          await AG.updateProduct(id, { status: "unpublished" });
          showProductListToast("Ürün yayından kaldırıldı.");
          await render();
        } catch (err) {
          alert(err?.message || "Ürün yayından kaldırılamadı.");
        } finally {
          btn.disabled = false;
        }
        return;
      }

      if (action === "republish") {
        btn.disabled = true;
        try {
          await AG.updateProduct(id, { status: "published" });
          showProductListToast("Ürün tekrar yayına alındı.");
          await render();
        } catch (err) {
          alert(err?.message || "Ürün tekrar yayına alınamadı.");
        } finally {
          btn.disabled = false;
        }
        return;
      }

      if (action === "submit-review") {
        if (!canSubmitCatalogProducts()) {
          alert("Ürün gönderebilmek için markanızın onaylanması gerekir.");
          return;
        }
        btn.disabled = true;
        try {
          await AG.updateProduct(id, { status: "pending_review" });
          showProductListToast("Ürün incelemeye gönderildi.");
          await render();
        } catch (err) {
          alert(err?.message || "Durum güncellenemedi.");
        } finally {
          btn.disabled = false;
        }
        return;
      }

      if (action === "delete") {
        if (!confirm("Bu ürünü silmek istediğinden emin misin?")) return;
        btn.disabled = true;
        try {
          await AG.deleteProduct(id);
          showProductListToast("Ürün silindi.");
          await render();
        } catch (err) {
          alert(err?.message || "Ürün silinemedi.");
        } finally {
          btn.disabled = false;
        }
      }
    }

    function wireProductListActions(pw) {
      if (!pw || pw.dataset.productActionsWired === "1") return;
      pw.dataset.productActionsWired = "1";
      pw.addEventListener("click", handleProductListActionClick);
    }

    function buildSpec(technical) {
      const parts = [];
      if (technical.acoustic)     parts.push(technical.acoustic);
      if (technical.fireClass)    parts.push(technical.fireClass);
      if (technical.certificates) parts.push(technical.certificates);
      return parts.join(" · ");
    }

    function setFormFieldValue(form, name, value) {
      if (!form) return;
      const el = form.elements.namedItem(name);
      if (!el) return;
      if (el instanceof RadioNodeList) {
        [...el].forEach((node) => {
          if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
            node.value = value ?? "";
          }
        });
        return;
      }
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
        el.value = value ?? "";
      }
    }

    function productFormShellEl() {
      return document.getElementById("product-form-shell");
    }

    function openProductFormShell() {
      const shell = productFormShellEl();
      if (!shell) return;
      shell.classList.remove("hidden");
      shell.classList.add("is-open");
    }

    function closeProductFormShell() {
      const shell = productFormShellEl();
      if (!shell) return;
      shell.classList.add("hidden");
      shell.classList.remove("is-open");
    }

    async function openProductAddForm() {
      editingProductId = null;
      isEditMode = false;
      editingProductStatus = null;
      const form = document.getElementById("product-form");
      const statusField = document.getElementById("product-status-field");
      if (statusField) statusField.value = "pending_review";
      resetProductFormAfterSubmit(form);
      const l1Sel = document.getElementById("manual-l1");
      if (l1Sel && l1Sel.options.length <= 1) {
        await fillTaxonomyL1Options(l1Sel);
      }
      activateManualProductTab();
      updateProductFormUi();
      openProductFormShell();
      productFormShellEl()?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function scrollToBrandProductsSection() {
      const target =
        document.getElementById("brand-products-list-section") ||
        document.getElementById("panel-urunler") ||
        document.getElementById("brand-products");
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function closeProductForm() {
      exitProductEditMode(document.getElementById("product-form"));
      closeProductFormShell();
      scrollToBrandProductsSection();
    }

    function updateProductFormUi() {
      const heading = document.getElementById("product-form-heading");
      const subtitle = document.getElementById("product-form-subtitle");
      const submitBtn = document.getElementById("product-submit-review");
      const draftBtn = document.getElementById("save-product-draft-btn");
      const cancelBtn = document.getElementById("product-edit-cancel-btn");
      if (isEditMode) {
        if (heading) heading.textContent = "Ürünü Düzenle";
        if (subtitle) {
          subtitle.textContent =
            "Değişiklikler kaydedildiğinde ürün admin incelemesine gönderilir.";
        }
        if (submitBtn) submitBtn.textContent = "Değişiklikleri İncelemeye Gönder";
        draftBtn?.classList.add("hidden");
        cancelBtn?.classList.remove("hidden");
      } else {
        if (heading) heading.textContent = "Yeni Ürün Ekle";
        if (subtitle) {
          subtitle.textContent = "Ürün bilgilerini doldurup incelemeye gönderebilir veya taslak olarak kaydedebilirsiniz.";
        }
        if (submitBtn) submitBtn.textContent = "İncelemeye Gönder";
        draftBtn?.classList.remove("hidden");
        cancelBtn?.classList.remove("hidden");
      }
    }

    function exitProductEditMode(form) {
      editingProductId = null;
      isEditMode = false;
      editingProductStatus = null;
      const statusField = document.getElementById("product-status-field");
      if (statusField) statusField.value = "pending_review";
      resetProductFormAfterSubmit(form || document.getElementById("product-form"));
      updateProductFormUi();
      const saveMsg = document.getElementById("manual-save-msg");
      if (saveMsg) {
        saveMsg.textContent = "";
        saveMsg.className = "md:col-span-2 text-[12px] text-[#6e6e73]";
      }
    }

    function activateManualProductTab() {
      document.querySelectorAll(".mode-panel").forEach((p) => p.classList.add("hidden"));
      document.getElementById("mode-manual")?.classList.remove("hidden");
      document.querySelectorAll(".mode-tab").forEach((b) => {
        const on = b.dataset.mode === "manual";
        b.className = on
          ? "mode-tab h-8 px-3 rounded-lg text-[12px] font-medium border border-black/[0.08] bg-[#1d1d1f] text-white"
          : "mode-tab h-8 px-3 rounded-lg text-[12px] font-medium border border-black/[0.08] bg-white text-[#1d1d1f] hover:border-black/20";
      });
    }

    function findSlugsByCategoryLabel(categoryLabel) {
      const parts = String(categoryLabel || "")
        .split(">")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length < 2) return null;
      const l1Name = parts[0];
      const l2Name = parts[1];
      const l3Name = parts.length >= 3 ? parts[2] : "";
      for (const l1 of mergedTaxonomyTree || []) {
        if (l1.name_tr !== l1Name && l1.slug !== l1Name) continue;
        for (const l2 of l1.children || []) {
          if (l2.name_tr !== l2Name && l2.slug !== l2Name) continue;
          const l3 = l3Name
            ? (l2.children || []).find((n) => n.name_tr === l3Name || n.slug === l3Name)
            : null;
          return { l1Slug: l1.slug, l2Slug: l2.slug, l3Slug: l3?.slug || "" };
        }
      }
      return null;
    }

    async function resolveTaxonomySlugsFromProduct(product) {
      await loadMergedTaxonomyTree();
      let l1Slug = "";
      let l2Slug = "";
      let l3Slug = "";

      if (product.categoryId) {
        try {
          const cats = await AG.listProductCategories();
          const catRow = (cats || []).find((c) => String(c.id) === String(product.categoryId));
          l2Slug = catRow?.slug || "";
        } catch (_) {}
      }
      if (product.categoryId && product.subcategoryId) {
        try {
          const subs = await AG.listProductSubcategories(product.categoryId);
          const subRow = (subs || []).find((s) => String(s.id) === String(product.subcategoryId));
          l3Slug = subRow?.slug || "";
        } catch (_) {}
      }
      if (l2Slug) {
        for (const l1 of mergedTaxonomyTree || []) {
          if ((l1.children || []).some((l2) => l2.slug === l2Slug)) {
            l1Slug = l1.slug;
            break;
          }
        }
      }
      if (!l1Slug || !l2Slug) {
        const fromLabel = findSlugsByCategoryLabel(product.category);
        if (fromLabel) return fromLabel;
      }
      return { l1Slug, l2Slug, l3Slug };
    }

    async function setTaxonomySelectValues(l1Slug, l2Slug, l3Slug) {
      const l1Sel = document.getElementById("manual-l1");
      const l2Sel = document.getElementById("manual-category");
      const l3Sel = document.getElementById("manual-subcategory");
      if (!l1Sel || !l2Sel || !l3Sel) return;

      if (l1Slug) {
        l1Sel.value = l1Slug;
        await fillTaxonomyL2Options(l1Slug, l2Sel);
      } else {
        resetTaxonomySelect(l2Sel, "Kategori seç *", true);
        resetTaxonomySelect(l3Sel, "Ürün ailesi seç *", true);
        return;
      }

      if (l2Slug) {
        l2Sel.value = l2Slug;
        await fillTaxonomyL3Options(l1Slug, l2Slug, l3Sel);
      } else {
        resetTaxonomySelect(l3Sel, "Ürün ailesi seç *", true);
        return;
      }

      if (l3Slug) l3Sel.value = l3Slug;
    }

    function appendCustomTechRow(key = "", value = "") {
      const customRowsWrap = document.getElementById("custom-tech-rows");
      if (!customRowsWrap) return;
      const row = document.createElement("div");
      row.className = "custom-tech-row grid md:grid-cols-[1fr_1fr_auto] gap-2";
      row.innerHTML = `
          <input name="customTechKey" class="h-10 rounded-lg border border-black/10 px-3 text-[13px]" placeholder="Teknik başlık" value="${escAttr(key)}">
          <input name="customTechValue" class="h-10 rounded-lg border border-black/10 px-3 text-[13px]" placeholder="Değer" value="${escAttr(value)}">
          <button type="button" class="remove-tech-row h-10 px-3 rounded-lg border border-black/15 text-[12px]">Sil</button>`;
      row.querySelector(".remove-tech-row")?.addEventListener("click", () => row.remove());
      customRowsWrap.appendChild(row);
    }

    function fillCustomTechnicalRows(technical) {
      const wrap = document.getElementById("custom-tech-rows");
      if (!wrap) return;
      wrap.innerHTML = "";
      Object.entries(technical || {}).forEach(([key, value]) => {
        if (KNOWN_FORM_TECH_KEYS.has(key)) return;
        if (value === undefined || value === null || String(value).trim() === "") return;
        appendCustomTechRow(key, String(value));
      });
    }

    function collectProductImageUrls(product) {
      const urls = [];
      const gallery =
        product.gallery ||
        product.technical?.gallery ||
        product.files?.imageGallery ||
        product.technical?.galleryUrls;
      if (Array.isArray(gallery)) {
        gallery.forEach((u) => {
          if (u && !urls.includes(u)) urls.push(u);
        });
      }
      if (product.image && !urls.includes(product.image)) urls.unshift(product.image);
      return urls;
    }

    async function fillProductEditForm(product) {
      const form = document.getElementById("product-form");
      if (!form) return;

      setFormFieldValue(form, "name", product.name || "");
      setFormFieldValue(form, "sku", product.sku || "");
      setFormFieldValue(form, "description", product.description || "");

      const tech = product.technical || {};
      setFormFieldValue(form, "fireClass", tech.fireClass || product.fireClass || "");
      setFormFieldValue(form, "acoustic", tech.acoustic || product.acousticRating || "");
      setFormFieldValue(form, "dimensions", tech.dimensions || product.dimensions || "");
      setFormFieldValue(
        form,
        "thickness",
        tech.thickness || (product.thicknessMm != null ? `${product.thicknessMm} mm` : ""),
      );
      const certs = tech.certificates || product.certificates;
      setFormFieldValue(
        form,
        "certificates",
        Array.isArray(certs) ? certs.join(", ") : certs || "",
      );
      setFormFieldValue(form, "usageScope", tech.usageScope || product.usageArea || "");
      setFormFieldValue(form, "materialType", tech.materialType || product.material || "");

      fillCustomTechnicalRows(tech);

      const imageUrls = collectProductImageUrls(product);
      setFormFieldValue(form, "image", imageUrls[0] || "");
      setFormFieldValue(form, "imageGallery", JSON.stringify(imageUrls));
      renderProductImageBadges(imageUrls);
      const uploadImageMsg = document.getElementById("upload-image-msg");
      if (uploadImageMsg) {
        uploadImageMsg.textContent = imageUrls.length
          ? `${imageUrls.length} mevcut görsel yüklü. Yeni görsel seçerek değiştirebilirsin.`
          : "";
        uploadImageMsg.className = "text-[12px] text-[#6e6e73] mt-2";
      }

      const files = product.files || {};
      setFormFieldValue(form, "pdfUrl", files.pdfUrl || "");
      setFormFieldValue(form, "cadUrl", files.cadUrl || "");
      setFormFieldValue(form, "bimUrl", files.bimUrl || "");

      const { l1Slug, l2Slug, l3Slug } = await resolveTaxonomySlugsFromProduct(product);
      await setTaxonomySelectValues(l1Slug, l2Slug, l3Slug);
    }

    async function openProductEdit(product) {
      if (!product?.id) return;
      editingProductId = product.id;
      isEditMode = true;
      editingProductStatus = getProductStatus(product);

      activateManualProductTab();
      updateProductFormUi();
      await fillProductEditForm(product);
      openProductFormShell();
      productFormShellEl()?.scrollIntoView({ behavior: "smooth", block: "start" });

      const saveMsg = document.getElementById("manual-save-msg");
      if (saveMsg) {
        saveMsg.textContent = "";
        saveMsg.className = "md:col-span-2 text-[12px] text-[#6e6e73]";
      }
    }

    async function buildProductUpdatePayload(fd) {
      const data = await createProductFromForm(fd);
      return {
        name: data.name,
        sku: data.sku,
        description: data.description,
        category: data.category,
        categoryId: data.categoryId,
        subcategoryId: data.subcategoryId,
        technical: data.technical,
        spec: data.spec,
        image: data.image,
        thumbnailUrl: data.thumbnailUrl,
        cardImageUrl: data.cardImageUrl,
        galleryImageUrl: data.galleryImageUrl,
        originalImageUrl: data.originalImageUrl,
        files: data.files,
        hasPdf: data.hasPdf,
        hasCad: data.hasCad,
        hasBim: Boolean(data.files?.bimUrl),
        status: "pending_review",
      };
    }

    async function setupCategorySelectors() {
      const l1Sel = document.getElementById("manual-l1");
      const l2Sel = document.getElementById("manual-category");
      const l3Sel = document.getElementById("manual-subcategory");
      if (!l1Sel || !l2Sel || !l3Sel) return;

      await fillTaxonomyL1Options(l1Sel);
      resetTaxonomySelect(l2Sel, "Kategori seç *", true);
      resetTaxonomySelect(l3Sel, "Ürün ailesi seç *", true);
      wireTaxonomyCascade(l1Sel, l2Sel, l3Sel);

      const prevL1 = document.getElementById("prev-l1");
      const prevL2 = document.getElementById("prev-category");
      const prevL3 = document.getElementById("prev-subcategory");
      if (prevL1 && prevL2 && prevL3) {
        await fillTaxonomyL1Options(prevL1);
        resetTaxonomySelect(prevL2, "Kategori seç", true);
        resetTaxonomySelect(prevL3, "Ürün ailesi seç", true);
        wireTaxonomyCascade(prevL1, prevL2, prevL3);
      }
    }

    function collectCustomTechnical(fd) {
      const rows = document.querySelectorAll(".custom-tech-row");
      const extras = {};
      rows.forEach((row) => {
        const k = row.querySelector('input[name="customTechKey"]')?.value?.trim();
        const v = row.querySelector('input[name="customTechValue"]')?.value?.trim();
        if (k && v) extras[k] = v;
      });
      return extras;
    }

    async function createProductFromForm(fd) {
      const l1Slug = fd.get("taxonomy_l1")?.toString().trim() || "";
      const l2Slug = fd.get("taxonomy_l2")?.toString().trim() || "";
      const l3Slug = fd.get("taxonomy_l3")?.toString().trim() || "";
      const { categoryId, subcategoryId } = await resolveTaxonomyDbIds(l2Slug, l3Slug);
      const category = taxonomyCategoryLabel(l1Slug, l2Slug, l3Slug);
      const customTechnical = collectCustomTechnical(fd);
      const technical = {
        fireClass:    fd.get("fireClass")?.trim()    || "",
        acoustic:     fd.get("acoustic")?.trim()     || "",
        dimensions:   fd.get("dimensions")?.trim()   || "",
        thickness:    fd.get("thickness")?.trim()    || "",
        certificates: fd.get("certificates")?.trim() || "",
        usageScope:   fd.get("usageScope")?.trim()   || "",
        materialType: fd.get("materialType")?.trim() || "",
        ...customTechnical,
      };
      const imageUrl = fd.get("image")?.trim() || "";
      return {
        brandId:     session.id,
        brandRecordId: brandRecordIdCached || null,
        brandName:   session.name || session.email,
        name:        fd.get("name")?.trim(),
        sku:         fd.get("sku")?.trim(),
        categoryId:  categoryId || null,
        subcategoryId: subcategoryId || null,
        category,
        description: fd.get("description")?.trim(),
        technical,
        spec:  buildSpec(technical),
        image: imageUrl,
        thumbnailUrl: imageUrl,
        cardImageUrl: imageUrl,
        galleryImageUrl: imageUrl,
        originalImageUrl: imageUrl,
        files: {
          pdfUrl: fd.get("pdfUrl")?.trim() || "",
          cadUrl: fd.get("cadUrl")?.trim() || "",
          bimUrl: fd.get("bimUrl")?.trim() || "",
          imageGallery: (() => {
            try { return JSON.parse(fd.get("imageGallery") || "[]"); } catch { return []; }
          })(),
        },
        hasPdf: Boolean(fd.get("pdfUrl")?.trim()),
        hasCad: Boolean(fd.get("cadUrl")?.trim()),
        hasBim: Boolean(fd.get("bimUrl")?.trim()),
        status: fd.get("productStatus") === "draft" ? "draft" : "pending_review",
      };
    }

    async function render() {
      if (PAGE === "projects") {
        await renderProjects();
        return;
      }

      const items = await AG.getProducts({ brandId: session.id });
      brandProductsCache = items;
      const rangeDays = analyticsRange === "all" ? null : analyticsRange;
      const needAna = PAGE === "products" || PAGE === "analytics";
      const ana = needAna
        ? await AG.getBrandProductAnalytics(session.id, rangeDays, items)
        : { totals: { views: 0, favorites: 0, uniqueVisitors: 0 }, viewsByProduct: {}, favByProduct: {} };

      if (countProducts) countProducts.textContent = String(items.length);
      if (countFiles) countFiles.textContent = String(items.reduce((n, i) => n + (i.hasPdf ? 1 : 0) + (i.hasCad ? 1 : 0) + (i.files?.bimUrl ? 1 : 0), 0));
      if (countDrafts) countDrafts.textContent = String(items.filter((p) => p.status !== "published").length);
      if (countViews) countViews.textContent = String(items.reduce((n, i) => n + (i.views || 0), 0));

      const av = document.getElementById("ana-views");
      const af = document.getElementById("ana-fav");
      const au = document.getElementById("ana-uniq");
      const atb = document.getElementById("analytics-tbody");
      if (av) av.textContent = String(ana.totals.views);
      if (af) af.textContent = String(ana.totals.favorites);
      if (au) au.textContent = String(ana.totals.uniqueVisitors);
      if (atb) {
        const sorted = [...items].sort((a, b) => (ana.viewsByProduct[b.id] || 0) - (ana.viewsByProduct[a.id] || 0));
        const fallbackThumb = "https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=96&auto=format&fit=crop";
        atb.innerHTML = sorted.length
          ? sorted.map((p) => {
            const nameStr = String(p.name || "—").replace(/</g, "&lt;");
            const thumbRaw = (p.image && String(p.image).trim()) ? String(p.image).trim() : fallbackThumb;
            const thumbSrc = escAttr(thumbRaw);
            return `
            <tr>
              <td class="px-3 py-2 min-w-0">
                <div class="flex items-center gap-2.5 min-w-0 max-w-[240px] sm:max-w-xs">
                  <img src="${thumbSrc}" alt="" width="36" height="36" class="w-9 h-9 shrink-0 rounded-md object-cover bg-[#f5f5f7] border border-black/[0.06]" loading="lazy" decoding="async">
                  <span class="font-medium text-[#1d1d1f] truncate">${nameStr}</span>
                </div>
              </td>
              <td class="px-4 py-2.5 text-[#6e6e73] whitespace-nowrap">${String(p.sku || "—").replace(/</g, "&lt;")}</td>
              <td class="px-4 py-2.5 whitespace-nowrap">${ana.viewsByProduct[p.id] || 0}</td>
              <td class="px-4 py-2.5 whitespace-nowrap">${ana.favByProduct[p.id] || 0}</td>
              <td class="px-4 py-2.5 text-[#6e6e73] whitespace-nowrap">${p.views || 0}</td>
            </tr>`;
          }).join("")
          : `<tr><td colspan="5" class="px-4 py-6 text-center text-[#6e6e73]">Ürün yok</td></tr>`;
      }

      const periodLabel = analyticsRange === "all" ? "Tüm zamanlar" : `Son ${analyticsRange} gün`;
      const pw = document.getElementById("brand-products");
      const isProductsListPage = PAGE === "products" || Boolean(pw);
      if (pw && isProductsListPage) {
        pw.innerHTML = items.length
          ? items.map((p) => productCardHtml(p, ana)).join("")
          : `<div class="rounded-xl border border-dashed border-black/15 bg-[#fafafa] px-6 py-10 text-center">
              <p class="text-[14px] font-medium text-[#1d1d1f]">Henüz ürün eklenmedi</p>
              <p class="text-[12px] text-[#6e6e73] mt-1">İlk ürününüzü ekleyerek katalogda görünür hale getirin.</p>
              <button type="button" class="mt-4 h-9 px-4 rounded-lg bg-[#1d1d1f] text-white text-[13px] font-semibold hover:bg-[#333]" data-open-product-add>Yeni Ürün Ekle</button>
            </div>`;

        const toggleBtn = document.getElementById("toggle-select-mode");
        const deleteSelectedBtn = document.getElementById("delete-selected-products");
        const bulkMsg = document.getElementById("bulk-delete-msg");
        if (toggleBtn && deleteSelectedBtn && bulkMsg) {
          toggleBtn.textContent = selectMode ? "Seçimi Kapat" : "Seç";
          deleteSelectedBtn.classList.toggle("hidden", !selectMode);
          const count = selectedProductIds.size;
          bulkMsg.classList.toggle("hidden", !selectMode);
          bulkMsg.textContent = selectMode ? `${count} ürün seçildi.` : "";
        }

        wireProductListActions(pw);

        pw.querySelectorAll("[data-open-product-add]").forEach((btn) => {
          btn.addEventListener("click", (ev) => {
            ev.preventDefault();
            openProductAddForm();
          });
        });

        pw.querySelectorAll("[data-select-product]").forEach((cb) => {
          cb.addEventListener("change", () => {
            const id = cb.getAttribute("data-select-product");
            if (!id) return;
            if (cb.checked) selectedProductIds.add(id);
            else selectedProductIds.delete(id);
            const bulkMsg2 = document.getElementById("bulk-delete-msg");
            if (bulkMsg2 && selectMode) bulkMsg2.textContent = `${selectedProductIds.size} ürün seçildi.`;
          });
        });
      }

      const projWrap = document.getElementById("brand-projects");
      if (projWrap) await renderProjects();
      applyCatalogProductGuard();
    }

    async function renderProjects() {
      const wrap = document.getElementById("brand-projects");
      const countEl = document.getElementById("projects-count");
      if (!wrap || !countEl) return;
      const projects = await AG.getProjects({ brandId: session.id });
      countEl.textContent = `${projects.length} proje`;
      wrap.innerHTML = projects.length
        ? projects.map((pr) => `
          <a href="/proje-detay.html?id=${encodeURIComponent(pr.id)}" class="block panel-card-lift group rounded-xl overflow-hidden border border-black/[0.08] bg-white flex flex-col h-full">
            <div class="relative h-28 sm:h-32 bg-[#f5f5f7] overflow-hidden shrink-0">
              <img src="${pr.image || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=400&auto=format&fit=crop"}" class="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300 ease-out" alt="">
            </div>
            <div class="p-3 flex flex-col flex-1 min-h-0">
              <p class="text-[10px] sm:text-[11px] text-[#6e6e73] truncate">${pr.location || "Lokasyon yok"}${pr.year ? ` · ${pr.year}` : ""}</p>
              <h4 class="text-[12px] sm:text-[13px] font-semibold leading-snug text-[#1d1d1f] mt-0.5 line-clamp-2">${pr.title}</h4>
              <p class="text-[11px] text-[#6e6e73] mt-1 line-clamp-2">${pr.description || "Açıklama yok."}</p>
              <p class="text-[11px] text-[#6e6e73] mt-1.5">Malzeme: ${(pr.materials || []).length}</p>
              <span class="mt-2 w-full h-7 flex items-center justify-center bg-[#1d1d1f] text-white text-[11px] font-medium rounded-md group-hover:bg-[#3a3a3c] transition">Detay</span>
            </div>
          </a>`).join("")
        : `<p class="text-[13px] text-[#6e6e73]">Henüz proje eklenmedi.</p>`;
    }

    function attachHandlers() {
      if (document.getElementById("mode-tabs")) {
      const customRowsWrap = document.getElementById("custom-tech-rows");
      const addTechBtn = document.getElementById("add-tech-row");
      addTechBtn?.addEventListener("click", () => {
        const row = document.createElement("div");
        row.className = "custom-tech-row grid md:grid-cols-[1fr_1fr_auto] gap-2";
        row.innerHTML = `
          <input name="customTechKey" class="h-10 rounded-lg border border-black/10 px-3 text-[13px]" placeholder="Teknik başlık (örn: Işık Yansıtma)">
          <input name="customTechValue" class="h-10 rounded-lg border border-black/10 px-3 text-[13px]" placeholder="Değer (örn: %78)">
          <button type="button" class="remove-tech-row h-10 px-3 rounded-lg border border-black/15 text-[12px]">Sil</button>`;
        row.querySelector(".remove-tech-row").addEventListener("click", () => row.remove());
        customRowsWrap.appendChild(row);
      });

      const uploadBtn = document.getElementById("upload-image-btn");
      const uploadMsg = document.getElementById("upload-image-msg");
      const imageInput = document.querySelector('input[name="image"]');
      const imageGalleryInput = document.querySelector('input[name="imageGallery"]');
      const fileInput = document.getElementById("manual-image-file");
      const uploadedImageList = document.getElementById("uploaded-image-list");

      const pdfInputHidden = document.querySelector('input[name="pdfUrl"]');
      const cadInputHidden = document.querySelector('input[name="cadUrl"]');
      const bimInputHidden = document.querySelector('input[name="bimUrl"]');

      const uploadPdfBtn = document.getElementById("upload-pdf-btn");
      const uploadCadBtn = document.getElementById("upload-cad-btn");
      const uploadBimBtn = document.getElementById("upload-bim-btn");
      const manualPdfFile = document.getElementById("manual-pdf-file");
      const manualCadFile = document.getElementById("manual-cad-file");
      const manualBimFile = document.getElementById("manual-bim-file");
      const pdfMsg = document.getElementById("upload-pdf-msg");
      const cadMsg = document.getElementById("upload-cad-msg");
      const bimMsg = document.getElementById("upload-bim-msg");

      renderProductImageBadges = (urls) => {
        if (!uploadedImageList) return;
        const list = (urls || []).filter(Boolean);
        uploadedImageList.innerHTML = list.length
          ? list
              .map(
                (u, i) =>
                  `<span class="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-[#f5f5f7] border border-black/10 text-[11px] max-w-full">
                    <img src="${escAttr(u)}" alt="" class="w-7 h-7 rounded object-cover shrink-0" loading="lazy" decoding="async">
                    <span>Görsel ${i + 1}</span>
                  </span>`,
              )
              .join("")
          : "";
      };

      uploadBtn?.addEventListener("click", () => fileInput?.click());
      fileInput?.addEventListener("change", async () => {
        const files = [...(fileInput.files || [])];
        if (!files.length) return;
        const tooBig = files.find((f) => f.size > IMAGE_MAX_BYTES);
        if (tooBig) {
          uploadMsg.textContent = `Görsel boyutu ${IMAGE_MAX_MB} MB sınırını aşıyor: ${tooBig.name}`;
          uploadMsg.className = "text-[12px] text-red-600 mt-2";
          fileInput.value = "";
          return;
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = "Yükleniyor…";
        uploadMsg.textContent = `${files.length} görsel yükleniyor...`;
        uploadMsg.className = "text-[12px] text-[#6e6e73] mt-2";

        const uploaded = [];
        for (const f of files) {
          const res = await AG.uploadBrandImage(f, session?.id);
          if (!res?.ok) {
            uploadMsg.textContent = res?.message || "Görsel yüklenemedi.";
            uploadMsg.className = "text-[12px] text-red-600 mt-2";
            uploadBtn.disabled = false;
            uploadBtn.textContent = "Görsel Yükle";
            return;
          }
          uploaded.push(res.url);
        }
        imageInput.value = uploaded[0] || "";
        imageGalleryInput.value = JSON.stringify(uploaded);
        renderProductImageBadges(uploaded);
        uploadMsg.textContent = `${uploaded.length} görsel yüklendi.`;
        uploadMsg.className = "text-[12px] text-green-600 mt-2";
        fileInput.value = "";
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Görsel Yükle";
      });

      const wireDocUpload = (triggerBtn, fileInputEl, hiddenInput, msgEl, maxMb, bucketName, label) => {
        triggerBtn?.addEventListener("click", () => fileInputEl?.click());
        fileInputEl?.addEventListener("change", async () => {
          const file = fileInputEl.files?.[0];
          if (!file) return;
          if (file.size > maxMb * MB_BYTES) {
            msgEl.textContent = `${label} dosyası ${maxMb} MB sınırını aşıyor.`;
            msgEl.className = "text-[11px] text-red-600 mt-2";
            fileInputEl.value = "";
            return;
          }
          triggerBtn.disabled = true;
          triggerBtn.textContent = "Yükleniyor…";
          msgEl.textContent = `${label} yükleniyor...`;
          msgEl.className = "text-[11px] text-[#6e6e73] mt-2";

          const res = await AG.uploadBrandAsset(file, session?.id, bucketName);
          if (!res?.ok) {
            msgEl.textContent = res?.message || `${label} yüklenemedi.`;
            msgEl.className = "text-[11px] text-red-600 mt-2";
            triggerBtn.disabled = false;
            triggerBtn.textContent = `${label} Yükle`;
            fileInputEl.value = "";
            return;
          }
          hiddenInput.value = res.url;
          msgEl.textContent = `${label} yüklendi.`;
          msgEl.className = "text-[11px] text-green-600 mt-2";
          triggerBtn.disabled = false;
          triggerBtn.textContent = `${label} Yükle`;
          fileInputEl.value = "";
        });
      };

      wireDocUpload(uploadPdfBtn, manualPdfFile, pdfInputHidden, pdfMsg, PDF_MAX_MB, "product-documents", "PDF");
      wireDocUpload(uploadCadBtn, manualCadFile, cadInputHidden, cadMsg, CAD_MAX_MB, "product-documents", "CAD");
      wireDocUpload(uploadBimBtn, manualBimFile, bimInputHidden, bimMsg, BIM_MAX_MB, "product-documents", "BIM");

      document.getElementById("open-product-add-btn")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        openProductAddForm();
      });

      document.getElementById("product-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const saveMsg = document.getElementById("manual-save-msg");
        if (!canSubmitCatalogProducts()) {
          if (saveMsg) {
            saveMsg.textContent = "Ürün gönderebilmek için markanızın onaylanması gerekir.";
            saveMsg.className = "md:col-span-2 text-[12px] text-amber-800";
          }
          return;
        }
        const fd = new FormData(form);
        const required = ["name", "sku", "taxonomy_l1", "taxonomy_l2", "taxonomy_l3", "description"];
        if (required.some((k) => !fd.get(k)?.toString().trim())) {
          if (saveMsg) {
            saveMsg.textContent = "Lütfen ürün adı, SKU, ana kategori, kategori, ürün ailesi ve açıklama alanlarını doldur.";
            saveMsg.className = "md:col-span-2 text-[12px] text-red-600";
          }
          return;
        }
        if (!brandRecordIdCached) {
          if (saveMsg) {
            saveMsg.textContent = "Ürün eklemek için önce marka profilinizin tamamlanması gerekiyor.";
            saveMsg.className = "md:col-span-2 text-[12px] text-red-600";
          }
          return;
        }
        const submitBtn = document.getElementById("product-submit-review");
        const statusField = document.getElementById("product-status-field");
        const isDraft = fd.get("productStatus") === "draft";
        const resetSubmitUi = () => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = isEditMode
              ? "Değişiklikleri İncelemeye Gönder"
              : "İncelemeye Gönder";
          }
          if (statusField && !isEditMode) statusField.value = "pending_review";
        };
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Kaydediliyor…";
        }
        try {
          if (isEditMode && editingProductId) {
            await AG.updateProduct(editingProductId, await buildProductUpdatePayload(fd));
            closeProductForm();
            showProductListToast(
              "Değişiklikler incelemeye gönderildi. Admin onayından sonra katalogda yayınlanacaktır.",
            );
          } else {
            const created = await AG.addProduct(await createProductFromForm(fd));
            if (!created) {
              if (saveMsg) {
                saveMsg.textContent = "Kaydedilemedi. Oturumunu yenileyip tekrar dene (çıkış yap/giriş yap).";
                saveMsg.className = "md:col-span-2 text-[12px] text-red-600";
              }
              return;
            }
            closeProductForm();
            showProductListToast(
              isDraft
                ? "Ürün taslak olarak kaydedildi."
                : "Ürün incelemeye gönderildi. Admin onayından sonra katalogda yayınlanacaktır.",
            );
          }
          try {
            await render();
          } catch (renderErr) {
            console.error(renderErr);
          }
        } catch (err) {
          console.error(err);
          if (saveMsg) {
            saveMsg.textContent = err?.message || "Kaydedilemedi. Oturumunu yenileyip tekrar dene.";
            saveMsg.className = "md:col-span-2 text-[12px] text-red-600";
          }
        } finally {
          resetSubmitUi();
        }
      });

      document.getElementById("save-product-draft-btn")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (isEditMode) return;
        const sf = document.getElementById("product-status-field");
        if (sf) sf.value = "draft";
        document.getElementById("product-form")?.requestSubmit();
      });

      document.getElementById("product-edit-cancel-btn")?.addEventListener("click", (ev) => {
        ev.preventDefault();
        closeProductForm();
      });

    function parseCsvLine(line) {
      const out = [];
      let cur = "";
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuote = !inQuote;
        } else if (ch === "," && !inQuote) {
          out.push(cur.trim());
          cur = "";
        } else {
          cur += ch;
        }
      }
      out.push(cur.trim());
      return out.map((v) => v.replace(/^"|"$/g, ""));
    }

    function importCsv(text) {
      const lines = text.split(/\r?\n/).filter(Boolean);
      if (lines.length < 2) return { ok: false, message: "CSV boş görünüyor." };
      const headers = parseCsvLine(lines[0]);
      const idx = (name) => headers.indexOf(name);
        const required = ["name", "sku", "category", "description"];
      for (const field of required) {
        if (idx(field) === -1) return { ok: false, message: `Eksik başlık: ${field}` };
      }
      const products = [];
      for (let i = 1; i < lines.length; i++) {
        const row = parseCsvLine(lines[i]);
        if (!row.length) continue;
        const get = (k) => (idx(k) > -1 ? row[idx(k)] || "" : "");
        const name = get("name").trim();
        const sku = get("sku").trim();
        const category = get("category").trim();
        const subcategory = get("subcategory").trim();
        const description = get("description").trim();
        if (!name || !sku || !category || !description) continue;
        const technical = {
          fireClass:    get("fireClass").trim(),
          acoustic:     get("acoustic").trim(),
          dimensions:   get("dimensions").trim(),
          thickness:    get("thickness").trim(),
          certificates: get("certificates").trim(),
          usageScope:   get("usageScope").trim(),
          materialType: get("materialType").trim(),
        };
        const imageUrl = get("image").trim();
        products.push({
          brandId:     session.id,
          brandRecordId: brandRecordIdCached || null,
          brandName:   session.name || session.email,
          name, sku, category: subcategory ? `${category} > ${subcategory}` : category, description,
          technical,
          spec:  buildSpec(technical),
          image: imageUrl,
          thumbnailUrl: imageUrl,
          cardImageUrl: imageUrl,
          galleryImageUrl: imageUrl,
          originalImageUrl: imageUrl,
          files: { pdfUrl: get("pdfUrl").trim(), cadUrl: get("cadUrl").trim(), bimUrl: get("bimUrl").trim() },
          hasPdf: Boolean(get("pdfUrl").trim()),
          hasCad: Boolean(get("cadUrl").trim()),
          status: "pending_review",
        });
      }
      return { ok: true, added: products.length, products };
    }

    document.getElementById("download-template").addEventListener("click", () => {
      const sample = [
        "name,sku,category,subcategory,description,usageScope,materialType,fireClass,acoustic,dimensions,thickness,certificates,image,pdfUrl,cadUrl,bimUrl",
        "\"Unica Baffle Tavan\",\"UNI-BAF-1200\",\"Mobilya ve Donatı\",\"Akustik\",\"Yüksek akustik performanslı tavan paneli\",\"iç mekan; tavan\",\"akustik panel\",\"B-s1,d0\",\"NRC 0.85\",\"40x1200 mm\",\"40 mm\",\"EPD;CE\",\"https://images.unsplash.com/photo-1615874959474-d609969a20ed?q=80&w=1200&auto=format&fit=crop\",\"https://example.com/datasheet.pdf\",\"https://example.com/detail.dwg\",\"https://example.com/revit.rfa\"",
      ].join("\n");
      const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "antigravity-urun-sablonu.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    });

      document.getElementById("import-csv").addEventListener("click", async () => {
        const file = document.getElementById("csv-file").files[0];
        const msg = document.getElementById("csv-msg");
        if (!file) { msg.textContent = "Önce bir CSV dosyası seç."; return; }
        if (!canSubmitCatalogProducts()) {
          msg.textContent = "Ürün gönderebilmek için markanızın onaylanması gerekir.";
          return;
        }
        if (!brandRecordIdCached) {
          msg.textContent = "Ürün eklemek için önce marka profilinizin tamamlanması gerekiyor.";
          return;
        }
        const text = await file.text();
        const res = importCsv(text);
        if (!res.ok) { msg.textContent = res.message; return; }
        msg.textContent = `${res.added} ürün içeri aktarılıyor…`;
        for (const p of res.products) { await AG.addProduct(p); }
        msg.textContent = `${res.added} ürün incelemeye gönderildi.`;
        await render();
      });

      document.getElementById("clear-products").addEventListener("click", async () => {
        if (!confirm("Tüm ürünleri silmek istediğinden emin misin?")) return;
        const items = await AG.getProducts({ brandId: session.id });
        for (const p of items) { await AG.deleteProduct(p.id); }
        selectedProductIds.clear();
        await render();
      });

      document.getElementById("toggle-select-mode")?.addEventListener("click", async () => {
        selectMode = !selectMode;
        if (!selectMode) selectedProductIds.clear();
        await render();
      });

      document.getElementById("delete-selected-products")?.addEventListener("click", async () => {
        if (!selectedProductIds.size) return;
        if (!confirm(`${selectedProductIds.size} ürünü silmek istediğine emin misin?`)) return;
        const ids = [...selectedProductIds];
        for (const id of ids) {
          await AG.deleteProduct(id);
        }
        selectedProductIds.clear();
        await render();
      });

    // --- URL Import ---
    document.getElementById("btn-fetch-url").addEventListener("click", async () => {
      const urlInput = document.getElementById("url-input");
      const rawUrl = urlInput.value.trim();
      const loadingEl = document.getElementById("url-loading");
      const errorEl = document.getElementById("url-error");
      const previewEl = document.getElementById("url-preview");
      const saveMsgEl = document.getElementById("url-save-msg");

      errorEl.classList.add("hidden");
      previewEl.classList.add("hidden");
      saveMsgEl.classList.add("hidden");

      if (!rawUrl) {
        errorEl.textContent = "Lütfen bir URL girin.";
        errorEl.classList.remove("hidden");
        return;
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        errorEl.textContent = "Geçersiz URL. Lütfen https:// ile başlayan tam adresi girin.";
        errorEl.classList.remove("hidden");
        return;
      }

      loadingEl.classList.remove("hidden");

      try {
        const encoded = encodeURIComponent(rawUrl);
        const proxies = [
          () => fetch(`https://corsproxy.io/?${encoded}`).then(async r => { if(!r.ok) throw new Error(r.status); return { contents: await r.text() }; }),
          () => fetch(`https://api.allorigins.win/get?url=${encoded}`).then(async r => { if(!r.ok) throw new Error(r.status); return r.json(); }),
          () => fetch(`https://api.codetabs.com/v1/proxy?quest=${encoded}`).then(async r => { if(!r.ok) throw new Error(r.status); return { contents: await r.text() }; }),
        ];
        let data = null;
        for (const tryProxy of proxies) {
          try { data = await tryProxy(); if (data?.contents) break; } catch(e) { continue; }
        }
        if (!data?.contents) throw new Error("Sayfa alınamadı.");

        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, "text/html");

        const h1 = doc.querySelector("h1")?.textContent?.trim();
        const title = h1 || doc.title?.trim() || "";

        const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
        const firstPara = [...doc.querySelectorAll("p")]
          .map((p) => p.textContent.trim())
          .find((t) => t.length > 40) || "";
        const description = metaDesc || firstPara;

        const bodyText = doc.body?.textContent || "";

        const nrcMatch = bodyText.match(/NRC[\s:]*([0-9]\.[0-9]{1,2})/i);
        const fireMatch = bodyText.match(/([A-Ea-e]-s[0-2],d[0-2])/);
        const enFireMatch = bodyText.match(/(EN\s*13501-1\s*[/\-]\s*[A-Ea-e]-s[0-2],d[0-2])/i);
        const thicknessMatch = bodyText.match(/([0-9]+(?:\s*[/,]\s*[0-9]+)*)\s*mm/i);
        const dimsMatch = bodyText.match(/([0-9]+\s*[xX×]\s*[0-9]+(?:\s*[xX×]\s*[0-9]+)?\s*(?:mm|cm))/i);
        const certMatches = [];
        if (/OEKO-TEX/i.test(bodyText)) certMatches.push("OEKO-TEX");
        if (/EPD/i.test(bodyText)) certMatches.push("EPD");
        if (/\bCE\b/.test(bodyText)) certMatches.push("CE");
        if (/ISO\s*\d+/i.test(bodyText)) certMatches.push(bodyText.match(/ISO\s*\d+/i)[0]);

        const origin = parsedUrl.origin;
        const pageImages = [...doc.querySelectorAll("img")]
          .map((img) => {
            let src = img.getAttribute("src") || "";
            if (!src || src.startsWith("data:")) return null;
            if (src.startsWith("//")) src = "https:" + src;
            else if (src.startsWith("/")) src = origin + src;
            else if (!src.startsWith("http")) return null;
            const w = parseInt(img.getAttribute("width") || "0", 10);
            const h = parseInt(img.getAttribute("height") || "0", 10);
            if ((w > 0 && w < 50) || (h > 0 && h < 50)) return null;
            return src;
          })
          .filter((src) => {
            if (!src) return false;
            const lower = src.toLowerCase();
            if (lower.includes("logo") || lower.includes("icon") ||
                lower.includes("sprite") || lower.includes("placeholder") ||
                lower.endsWith(".svg") || lower.includes(".svg?")) return false;
            return lower.endsWith(".jpg") || lower.endsWith(".jpeg") ||
               lower.endsWith(".png") || lower.endsWith(".webp") ||
               lower.includes(".jpg?") || lower.includes(".jpeg?") ||
               lower.includes(".png?") || lower.includes(".webp?") ||
               lower.includes("wixstatic") || lower.includes("cloudinary") ||
               lower.includes("imgix") || lower.includes("cdn");
          })
          .filter((v, i, a) => a.indexOf(v) === i)
          .slice(0, 12);

        const pageHeadings = [...doc.querySelectorAll("h2,h3,h4")]
          .map(el => el.textContent.trim())
          .filter(t => t.length > 1 && t.length < 40)
          .filter((v, i, a) => a.indexOf(v) === i)
          .slice(0, 10);

        document.getElementById("prev-name").value = title;
        document.getElementById("prev-desc").value = description;
        document.getElementById("prev-acoustic").value = nrcMatch ? `NRC ${nrcMatch[1]}` : "";
        document.getElementById("prev-fire").value = enFireMatch ? enFireMatch[1] : (fireMatch ? fireMatch[1] : "");
        document.getElementById("prev-thickness").value = thicknessMatch ? `${thicknessMatch[1]} mm` : "";
        document.getElementById("prev-dimensions").value = dimsMatch ? dimsMatch[1] : "";
        document.getElementById("prev-certs").value = certMatches.join(", ");
        document.getElementById("prev-image").value = pageImages[0] || "";
        document.getElementById("prev-source-url").value = rawUrl;
        const prevL1 = document.getElementById("prev-l1");
        const prevL2 = document.getElementById("prev-category");
        const prevL3 = document.getElementById("prev-subcategory");
        if (prevL1 && prevL1.options.length > 1) {
          prevL1.selectedIndex = 1;
          void fillTaxonomyL2Options(prevL1.value, prevL2);
          if (prevL2 && prevL2.options.length > 1) {
            prevL2.selectedIndex = 1;
            void fillTaxonomyL3Options(prevL1.value, prevL2.value, prevL3);
            if (prevL3 && prevL3.options.length > 1) prevL3.selectedIndex = 1;
          }
        }

        const imgPreview = document.getElementById("prev-img-preview");
        const imgStrip = document.getElementById("prev-img-strip");
        const imageUrlInput = document.getElementById("prev-image");

        if (pageImages[0]) {
          imgPreview.src = pageImages[0];
          imgPreview.classList.remove("hidden");
        } else {
          imgPreview.classList.add("hidden");
        }

        imgStrip.innerHTML = "";
        if (pageImages.length > 1) {
          imgStrip.classList.remove("hidden");
          pageImages.forEach((src) => {
            const thumb = document.createElement("img");
            thumb.src = src;
            thumb.className = "w-20 h-20 object-cover rounded-lg cursor-pointer border-2 flex-shrink-0 " +
              (src === pageImages[0] ? "border-black" : "border-transparent hover:border-black");
            thumb.title = src;
            thumb.addEventListener("click", () => {
              imgStrip.querySelectorAll("img").forEach(t => {
                t.className = "w-20 h-20 object-cover rounded-lg cursor-pointer border-2 flex-shrink-0 border-transparent hover:border-black";
              });
              thumb.className = "w-20 h-20 object-cover rounded-lg cursor-pointer border-2 flex-shrink-0 border-black";
              imageUrlInput.value = src;
              imgPreview.src = src;
              imgPreview.classList.remove("hidden");
            });
            thumb.onerror = () => thumb.style.display = "none";
            imgStrip.appendChild(thumb);
          });
        } else {
          imgStrip.classList.add("hidden");
        }

        const headingsSection = document.getElementById("prev-headings-section");
        const headingsContainer = document.getElementById("prev-headings");
        headingsContainer.innerHTML = "";
        if (pageHeadings.length > 0) {
          headingsSection.classList.remove("hidden");
          const nameInput = document.getElementById("prev-name");
          const descInput = document.getElementById("prev-desc");
          pageHeadings.forEach((text) => {
            const chip = document.createElement("span");
            chip.textContent = text;
            chip.className = "px-3 py-1 rounded-full border border-black/15 text-sm cursor-pointer hover:bg-black hover:text-white transition-colors";
            chip.addEventListener("click", () => {
              if (!nameInput.value || nameInput.value === title) {
                nameInput.value = text;
              } else {
                const cur = descInput.value;
                descInput.value = cur ? cur + "\n" + text : text;
              }
            });
            headingsContainer.appendChild(chip);
          });
        } else {
          headingsSection.classList.add("hidden");
        }

        previewEl.classList.remove("hidden");
      } catch (err) {
        errorEl.textContent = `Veri çekilemedi: Sayfa CORS kısıtlaması veya ağ hatası nedeniyle erişilemiyor olabilir. (${err.message})`;
        errorEl.classList.remove("hidden");
      } finally {
        loadingEl.classList.add("hidden");
      }
    });

      document.getElementById("btn-save-url-product").addEventListener("click", async () => {
        const name        = document.getElementById("prev-name").value.trim();
        const description = document.getElementById("prev-desc").value.trim();
        if (!name) { alert("Ürün adı zorunlu."); return; }
        if (!canSubmitCatalogProducts()) {
          alert("Ürün gönderebilmek için markanızın onaylanması gerekir.");
          return;
        }
        if (!brandRecordIdCached) {
          alert("Ürün eklemek için önce marka profilinizin tamamlanması gerekiyor.");
          return;
        }
        const prevL1 = document.getElementById("prev-l1");
        const prevL2 = document.getElementById("prev-category");
        const prevL3 = document.getElementById("prev-subcategory");
        const l1Slug = prevL1?.value?.trim() || "";
        const l2Slug = prevL2?.value?.trim() || "";
        const l3Slug = prevL3?.value?.trim() || "";
        if (!l1Slug || !l2Slug || !l3Slug) {
          alert("Lütfen ana kategori, kategori ve ürün ailesi seç.");
          return;
        }
        const { categoryId, subcategoryId } = await resolveTaxonomyDbIds(l2Slug, l3Slug);
        const category = taxonomyCategoryLabel(l1Slug, l2Slug, l3Slug);
        const saveBtn = document.getElementById("btn-save-url-product");
        saveBtn.disabled = true; saveBtn.textContent = "Kaydediliyor…";
        const technical = {
          fireClass:    document.getElementById("prev-fire").value.trim(),
          acoustic:     document.getElementById("prev-acoustic").value.trim(),
          dimensions:   document.getElementById("prev-dimensions").value.trim(),
          thickness:    document.getElementById("prev-thickness").value.trim(),
          certificates: document.getElementById("prev-certs").value.trim(),
        };
        const imageUrl = document.getElementById("prev-image").value.trim();
        try {
          await AG.addProduct({
            brandId:     session.id,
            brandRecordId: brandRecordIdCached,
            brandName:   session.name || session.email,
            name,
            sku:         `URL-${Date.now()}`,
            categoryId,
            subcategoryId,
            category,
            description,
            technical,
            spec:  buildSpec(technical),
            image: imageUrl,
            thumbnailUrl: imageUrl,
            cardImageUrl: imageUrl,
            galleryImageUrl: imageUrl,
            originalImageUrl: imageUrl,
            files: { pdfUrl: document.getElementById("prev-source-url").value.trim(), cadUrl: "", bimUrl: "" },
            hasPdf: Boolean(document.getElementById("prev-source-url").value.trim()),
            hasCad: false,
            status: "pending_review",
          });
        } catch (err) {
          alert(err?.message || "Kayıt başarısız.");
          saveBtn.disabled = false;
          saveBtn.textContent = "İncelemeye Gönder";
          return;
        }
        saveBtn.disabled = false; saveBtn.textContent = "İncelemeye Gönder";
        document.getElementById("url-preview").classList.add("hidden");
        document.getElementById("url-input").value = "";
        const saveMsgEl = document.getElementById("url-save-msg");
        saveMsgEl.textContent = "Ürün incelemeye gönderildi.";
        saveMsgEl.classList.remove("hidden");
        setTimeout(() => saveMsgEl.classList.add("hidden"), 4000);
        await render();
      });

    // update image preview when URL field changes
    document.getElementById("prev-image").addEventListener("input", (e) => {
      const imgPreview = document.getElementById("prev-img-preview");
      const val = e.target.value.trim();
      if (val) {
        imgPreview.src = val;
        imgPreview.classList.remove("hidden");
      } else {
        imgPreview.classList.add("hidden");
      }
    });

      document.querySelectorAll(".mode-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          const mode = btn.dataset.mode;
          document.querySelectorAll(".mode-tab").forEach((b) => b.className = "mode-tab h-8 px-3 rounded-lg text-[12px] font-medium border border-black/[0.08] bg-white text-[#1d1d1f] hover:border-black/20");
          btn.className = "mode-tab h-8 px-3 rounded-lg text-[12px] font-medium border border-black/[0.08] bg-[#1d1d1f] text-white";
          document.querySelectorAll(".mode-panel").forEach((p) => p.classList.add("hidden"));
          document.getElementById(`mode-${mode}`).classList.remove("hidden");
        });
      });
      } // end mode-tabs block

      const projectFormEl = document.getElementById("project-form");
      if (projectFormEl) {
        projectFormEl.addEventListener("submit", async (e) => {
          e.preventDefault();
          const msg = document.getElementById("project-save-msg");
          const fd = new FormData(e.currentTarget);
          const title = fd.get("title")?.toString().trim();
          if (!title) return;
          const sel = document.getElementById("project-materials");
          const chosenIds = [...sel.selectedOptions].map((o) => o.value);
          const ownProducts = await AG.getProducts({ brandId: session.id });
          const materials = ownProducts
            .filter((p) => chosenIds.includes(String(p.id)))
            .map((p) => ({ id: p.id, name: p.name, image: p.image || "", category: p.category || "" }));

          const created = await AG.addProject({
            brandId: session.id,
            brandName: session.name || session.email,
            title,
            location: fd.get("location")?.toString().trim() || "",
            year: fd.get("year")?.toString().trim() || "",
            architect: fd.get("architect")?.toString().trim() || "",
            image: fd.get("image")?.toString().trim() || "",
            description: fd.get("description")?.toString().trim() || "",
            materials,
            status: "published",
          });
          if (!created) {
            msg.textContent = "Proje kaydedilemedi.";
            msg.className = "md:col-span-2 text-[12px] text-red-600";
            return;
          }
          e.currentTarget.reset();
          [...sel.options].forEach((o) => (o.selected = false));
          msg.textContent = "Proje başarıyla eklenmiştir.";
          msg.className = "md:col-span-2 text-[12px] text-green-600";
          await renderProjects();
        });
      }
    } // end attachHandlers

    async function hydrateProjectMaterialOptions() {
      const sel = document.getElementById("project-materials");
      if (!sel || !session) return;
      const ownProducts = await AG.getProducts({ brandId: session.id });
      sel.innerHTML = ownProducts.length
        ? ownProducts.map((p) => `<option value="${p.id}">${p.name} (${p.category || "-"})</option>`).join("")
        : `<option disabled>Önce Ürünlerim sayfasından ürün ekle</option>`;
    }

    init();
