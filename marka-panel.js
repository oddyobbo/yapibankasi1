/** window.__MARKA_PANEL_PAGE__: "overview" | "products" | "analytics" | "project-new" | "projects" */
const PAGE = window.__MARKA_PANEL_PAGE__ || "overview";

    const countProducts = document.getElementById("count-products");
    const countFiles    = document.getElementById("count-files");
    const countDrafts   = document.getElementById("count-drafts");
    const countViews    = document.getElementById("count-views");

    let session = null;
    let selectMode = false;
    let selectedProductIds = new Set();
    let analyticsRange = 30;
    const PRODUCT_TAXONOMY = {
      "Malzemeler": [
        "Zemin",
        "Cam",
        "Deri",
        "Yığma ve Taş",
        "Metal",
        "Boya",
        "Panel",
        "Yüzey Bitişi",
        "Reçine",
        "Yüzey",
        "Tekstil",
        "Seramik",
        "Duvar Kaplama",
      ],
      "Mobilya ve Donatı": [
        "Akustik",
        "Elektrikli Cihazlar",
        "Banyo",
        "Dekor ve Aksesuar",
        "Mobilya",
        "Donanım",
        "Mutfak",
        "Aydınlatma",
        "Dış Mekan",
        "Pencere Sistemleri",
      ],
      "Mimari": ["Tavan", "Decking", "Kapılar", "Cephe", "Profil ve Trim", "Peyzaj ve Kaplama"],
    };

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
              <p class="text-[14px] text-[#6e6e73] mt-2">Marka hesabınla giriş yaparak ürünleri yönetebilir, yayınlayabilir ve performansı görebilirsin.</p>
              <a href="/marka-giris.html" class="inline-block mt-5 px-5 py-2.5 rounded-lg bg-[#1d1d1f] text-white text-[14px] font-semibold hover:bg-[#3a3a3c]">Marka girişi</a>
            </section>
          </main>`;
        }
        return;
      }

      setupBrandPanelNavActive();

      if (PAGE === "products") {
        setupCategorySelectors();
        attachHandlers();
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
      }
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

    function buildSpec(technical) {
      const parts = [];
      if (technical.acoustic)     parts.push(technical.acoustic);
      if (technical.fireClass)    parts.push(technical.fireClass);
      if (technical.certificates) parts.push(technical.certificates);
      return parts.join(" · ");
    }

    function setupCategorySelectors() {
      const categorySel = document.getElementById("manual-category");
      const subSel = document.getElementById("manual-subcategory");
      if (!categorySel || !subSel) return;
      const previewCategorySel = document.getElementById("prev-category");
      const categoryOptions = Object.keys(PRODUCT_TAXONOMY).map((c) => `<option value="${c}">${c}</option>`).join("");
      categorySel.innerHTML =
        '<option value="">Ana kategori seç *</option>' + categoryOptions;
      subSel.innerHTML = '<option value="">Alt kategori seç *</option>';
      if (previewCategorySel) {
        previewCategorySel.innerHTML = '<option value="">Kategori seç</option>' + categoryOptions;
      }

      categorySel.addEventListener("change", () => {
        const list = PRODUCT_TAXONOMY[categorySel.value] || [];
        subSel.innerHTML =
          '<option value="">Alt kategori seç *</option>' +
          list.map((s) => `<option value="${s}">${s}</option>`).join("");
      });
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

    function createProductFromForm(fd) {
      const mainCategory = fd.get("category")?.trim() || "";
      const subCategory = fd.get("subcategory")?.trim() || "";
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
        brandName:   session.name || session.email,
        name:        fd.get("name")?.trim(),
        sku:         fd.get("sku")?.trim(),
        category:    subCategory ? `${mainCategory} > ${subCategory}` : mainCategory,
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
        status: "published",
      };
    }

    async function render() {
      if (PAGE === "projects") {
        await renderProjects();
        return;
      }

      const items = await AG.getProducts({ brandId: session.id });
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
      if (pw && PAGE === "products") {
        pw.innerHTML = items.length
          ? items.map((p) => {
            const pv = ana.viewsByProduct[p.id] || 0;
            const pf = ana.favByProduct[p.id] || 0;
            return `
          <article class="panel-card-lift group rounded-xl overflow-hidden border border-black/[0.08] bg-white flex flex-col ${selectMode && selectedProductIds.has(p.id) ? "ring-2 ring-black/75" : ""}">
            <div class="relative h-28 sm:h-32 bg-[#f5f5f7] overflow-hidden shrink-0">
              <img src="${p.image || "https://images.unsplash.com/photo-1600607686527-6fb886090705?q=80&w=400&auto=format&fit=crop"}" class="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-300 ease-out" alt="${escAttr(p.name || "Ürün")}">
            </div>
            <div class="p-3 flex flex-col flex-1 min-h-0">
              ${selectMode ? `<label class="inline-flex items-center gap-2 text-[11px] mb-1.5 cursor-pointer text-[#1d1d1f]"><input type="checkbox" class="accent-black w-3.5 h-3.5 rounded border-black/20" data-select-product="${p.id}" ${selectedProductIds.has(p.id) ? "checked" : ""}> Seç</label>` : ""}
              <p class="text-[10px] sm:text-[11px] text-[#6e6e73] truncate">${p.category || "—"}</p>
              <h4 class="text-[12px] sm:text-[13px] font-semibold leading-snug text-[#1d1d1f] mt-0.5 line-clamp-2">${String(p.name || "").replace(/</g, "&lt;")}</h4>
              <p class="text-[11px] text-[#6e6e73] mt-1 line-clamp-2">${String(p.spec || "Teknik bilgi bekleniyor").replace(/</g, "&lt;")}</p>
              <p class="text-[11px] text-[#6e6e73] mt-1">${p.status === "published" ? "Yayında" : "Taslak"} · ${p.views || 0} gör.</p>
              <p class="text-[10px] text-[#1d1d1f] mt-1 font-medium line-clamp-2">${periodLabel}: ${pv} tık · ${pf} fav</p>
              <div class="mt-1.5 text-[10px] text-[#6e6e73]">
                ${p.files?.pdfUrl ? "<span>PDF</span>" : ""}
                ${p.files?.cadUrl ? " · <span>DWG</span>" : ""}
                ${p.files?.bimUrl ? " · <span>BIM</span>" : ""}
              </div>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <button data-publish="${p.id}" data-status="${p.status}" class="h-7 px-2 rounded-md border border-black/[0.08] text-[11px] font-medium text-[#1d1d1f] hover:border-black/20 bg-white">${p.status === "published" ? "Taslak" : "Yayınla"}</button>
                <button data-delete="${p.id}" class="h-7 px-2 rounded-md border border-black/[0.08] text-[11px] font-medium text-[#1d1d1f] hover:border-black/20 bg-white">Sil</button>
              </div>
            </div>
          </article>`;
          }).join("")
          : `<p class="text-[13px] text-[#6e6e73]">Henüz ürün eklenmedi.</p>`;

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

        pw.querySelectorAll("[data-publish]").forEach((btn) => {
          btn.onclick = async () => {
            const id     = btn.getAttribute("data-publish");
            const status = btn.getAttribute("data-status");
            btn.disabled = true;
            await AG.updateProduct(id, { status: status === "published" ? "draft" : "published" });
            await render();
          };
        });
        pw.querySelectorAll("[data-delete]").forEach((btn) => {
          btn.onclick = async () => {
            if (!confirm("Bu ürünü silmek istediğinden emin misin?")) return;
            btn.disabled = true;
            await AG.deleteProduct(btn.getAttribute("data-delete"));
            await render();
          };
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

      const MB = 1024 * 1024;
      const IMAGE_MAX_MB = 8;
      const PDF_MAX_MB = 25;
      const CAD_MAX_MB = 50;
      const BIM_MAX_MB = 100;

      const renderImageBadges = (urls) => {
        uploadedImageList.innerHTML = urls
          .map((u, i) => `<span class="px-2 py-1 rounded-full bg-[#f5f5f7] border border-black/10 text-[11px]">Görsel ${i + 1}</span>`)
          .join("");
      };

      uploadBtn?.addEventListener("click", () => fileInput?.click());
      fileInput?.addEventListener("change", async () => {
        const files = [...(fileInput.files || [])];
        if (!files.length) return;
        const tooBig = files.find((f) => f.size > IMAGE_MAX_MB * MB);
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
        renderImageBadges(uploaded);
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
          if (file.size > maxMb * MB) {
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

      document.getElementById("product-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const saveMsg = document.getElementById("manual-save-msg");
        const fd = new FormData(e.currentTarget);
        const required = ["name", "sku", "category", "subcategory", "description"];
        if (required.some((k) => !fd.get(k)?.toString().trim())) {
          saveMsg.textContent = "Lütfen ürün adı, SKU, ana kategori, alt kategori ve açıklama alanlarını doldur.";
          saveMsg.className = "md:col-span-2 text-[12px] text-red-600";
          return;
        }
        const btn = e.currentTarget.querySelector("button[type=submit], button:last-of-type");
        if (btn) { btn.disabled = true; btn.textContent = "Kaydediliyor…"; }
        const created = await AG.addProduct(createProductFromForm(fd));
        if (!created) {
          saveMsg.textContent = "Kaydedilemedi. Oturumunu yenileyip tekrar dene (çıkış yap/giriş yap).";
          saveMsg.className = "md:col-span-2 text-[12px] text-red-600";
          if (btn) { btn.disabled = false; btn.textContent = "Ürünü Kaydet (Yayında)"; }
          return;
        }
        e.currentTarget.reset();
        document.getElementById("custom-tech-rows").innerHTML = "";
        document.getElementById("manual-subcategory").innerHTML = '<option value="">Alt kategori seç *</option>';
        document.getElementById("uploaded-image-list").innerHTML = "";
        document.getElementById("upload-image-msg").textContent = "";
        document.getElementById("upload-pdf-msg").textContent = `Maks ${PDF_MAX_MB} MB`;
        document.getElementById("upload-cad-msg").textContent = `Maks ${CAD_MAX_MB} MB`;
        document.getElementById("upload-bim-msg").textContent = `Maks ${BIM_MAX_MB} MB`;
        saveMsg.textContent = "Ürün yayına alındı.";
        saveMsg.className = "md:col-span-2 text-[12px] text-green-600";
        if (btn) { btn.disabled = false; btn.textContent = "Ürünü Kaydet (Yayında)"; }
        await render();
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
          status: "published",
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
        const text = await file.text();
        const res = importCsv(text);
        if (!res.ok) { msg.textContent = res.message; return; }
        msg.textContent = `${res.added} ürün içeri aktarılıyor…`;
        for (const p of res.products) { await AG.addProduct(p); }
        msg.textContent = `${res.added} ürün yayına alındı.`;
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
        document.getElementById("prev-category").value = "Mobilya ve Donatı";

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
        await AG.addProduct({
          brandId:     session.id,
          brandName:   session.name || session.email,
          name,
          sku:         `URL-${Date.now()}`,
          category:    document.getElementById("prev-category").value.trim() || "Mobilya ve Donatı",
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
          status: "published",
        });
        saveBtn.disabled = false; saveBtn.textContent = "Ürünü Kaydet (Yayında)";
        document.getElementById("url-preview").classList.add("hidden");
        document.getElementById("url-input").value = "";
        const saveMsgEl = document.getElementById("url-save-msg");
        saveMsgEl.textContent = "Ürün Supabase'e kaydedildi!";
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
