(function () {
  const COMPANY_ROLE_LABELS = {
    manufacturer: "Üretici",
    applicator: "Uygulama & montaj",
    integrator: "Sistem entegratörü",
    distributor: "Distribütör",
    seller: "Satıcı",
  };

  const $ = (id) => document.getElementById(id);

  function slugify(value) {
    return String(value || "")
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
  }

  const STATIC_COMPAT_PRODUCTS = [
    { id: "s1", name: "Unica Baffle Tavan Paneli", brandName: "Unica Acoustic", category: "Mobilya ve Donatı > Akustik", spec: "NRC 0.85 · B-s1,d0", image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?q=80&w=800&auto=format&fit=crop", hasPdf: true, hasCad: true, status: "published", views: 142 },
    { id: "s2", name: "Akustik Keçe Duvar Paneli", brandName: "Unica Acoustic", category: "Malzemeler > Duvar Kaplama", spec: "NRC 0.75 · A2-s1,d0", image: "https://images.unsplash.com/photo-1616594039964-3f7f89d7a5d8?q=80&w=800&auto=format&fit=crop", hasPdf: true, hasCad: false, status: "published", views: 98 },
    { id: "s3", name: "V-Cut Akustik Bulut Panel", brandName: "Unica Acoustic", category: "Mimari > Tavan", spec: "NRC 0.90 · B-s1,d0", image: "https://images.unsplash.com/photo-1617104551722-3b2d51366443?q=80&w=800&auto=format&fit=crop", hasPdf: true, hasCad: true, status: "published", views: 76 },
    { id: "s4", name: "Ahşap Lamel Tavan Sistemi", brandName: "WoodTech", category: "Mimari > Tavan", spec: "C-s2,d0 · CE Belgeli", image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?q=80&w=800&auto=format&fit=crop", hasPdf: true, hasCad: true, status: "published", views: 54 },
    { id: "s5", name: "Alüminyum Cephe Paneli", brandName: "AlüForm", category: "Mimari > Cephe", spec: "A1 · EN 13501-1", image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800&auto=format&fit=crop", hasPdf: true, hasCad: false, status: "published", views: 211 },
    { id: "s6", name: "Doğal Taş Kompozit Kaplama", brandName: "StoneBase", category: "Malzemeler > Yığma ve Taş", spec: "CE · ISO 9001", image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=800&auto=format&fit=crop", hasPdf: false, hasCad: false, status: "published", views: 33 },
    { id: "s7", name: "Lineer LED Aydınlatma Profili", brandName: "LightForm", category: "Mobilya ve Donatı > Aydınlatma", spec: "IP54 · CE", image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=800&auto=format&fit=crop", hasPdf: true, hasCad: true, status: "published", views: 189 },
    { id: "s8", name: "PET Felt Akustik Bölücü", brandName: "Unica Acoustic", category: "Mobilya ve Donatı > Akustik", spec: "NRC 0.70 · Geri Dönüştürülmüş", image: "https://images.unsplash.com/photo-1493666438817-866a91353ca9?q=80&w=800&auto=format&fit=crop", hasPdf: true, hasCad: false, status: "published", views: 67 },
    { id: "s9", name: "Seramik Zemin Karosu 60x60", brandName: "CeraStone", category: "Malzemeler > Zemin", spec: "R11 · A1 · CE", image: "https://images.unsplash.com/photo-1507089947368-19c1da9775ae?q=80&w=800&auto=format&fit=crop", hasPdf: false, hasCad: false, status: "published", views: 45 },
  ].map((product) => ({
    ...product,
    slug: slugify(product.name),
    summary: product.spec,
    description: "",
    relatedProducts: [],
    relatedProjects: [],
    variants: [],
    technical: {
      acoustic: product.spec.match(/NRC\s?[\d.,]+/i)?.[0] || "",
      fireClass: product.spec.match(/[ABC][0-9]?-s\d,?d\d|A1|CE/i)?.[0] || "",
    },
  }));

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function textOrEmpty(value) {
    return value == null || String(value).trim() === "" ? "" : String(value).trim();
  }

  function valOrBelirtilmedi(value) {
    const v = textOrEmpty(value);
    return v || "Belirtilmedi";
  }

  function productHref(product) {
    const brandSlug = slugify(product?.brandName || "brand");
    const productSlug = slugify(product?.slug || product?.name || product?.id || "product");
    const productId = String(product?.id || productSlug);
    return `/tr/p/${encodeURIComponent(brandSlug)}/${encodeURIComponent(`${productSlug}-${productId}`)}`;
  }

  function routeProductParams() {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const slug = params.get("slug");
    if (id || slug) return { id, slug };

    const parts = location.pathname.split("/").filter(Boolean);
    const pIndex = parts.indexOf("p");
    if (pIndex >= 0 && parts[pIndex + 2]) {
      const productPart = decodeURIComponent(parts[pIndex + 2]);
      const uuidMatch = productPart.match(/^(.+)-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
      if (uuidMatch) return { id: uuidMatch[2], slug: uuidMatch[1] };
      const shortIdMatch = productPart.match(/^(.+)-([a-z]+\d+|\d+)$/i);
      if (shortIdMatch) return { id: shortIdMatch[2], slug: shortIdMatch[1] };
      return { id: "", slug: productPart };
    }
    return { id: "", slug: "" };
  }

  function contactHref(extra) {
    const u = new URL("/iletisim-v2.html", location.origin);
    Object.entries(extra || {}).forEach(([key, value]) => {
      if (value != null && value !== "") u.searchParams.set(key, String(value));
    });
    return u.pathname + u.search;
  }

  function setMeta(product) {
    const title = `${product.name || "Ürün Detayı"} | ${product.brandName || "Archilink"} | Archilink`;
    const description = product.summary || product.description || `${product.name || "Ürün"} teknik bilgileri ve marka detayları.`;
    const canonical = `${location.origin}${productHref(product)}`;
    const metaImage = product.galleryImageUrl || product.cardImageUrl || product.thumbnailUrl || product.image || "";
    document.title = title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:image"]')?.setAttribute("content", metaImage);
    document.querySelector('link[rel="canonical"]')?.setAttribute("href", canonical);

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name || "",
      image: metaImage ? [metaImage] : undefined,
      description,
      brand: product.brandName ? { "@type": "Brand", name: product.brandName } : undefined,
      sku: product.sku || undefined,
    };
    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.textContent = JSON.stringify(jsonLd);
    document.head.appendChild(tag);
  }

  function renderBreadcrumb(el, category) {
    const parts = String(category || "Kategori")
      .split(">")
      .map((x) => x.trim())
      .filter(Boolean);
    el.innerHTML = parts.length
      ? parts.map((part, index) => {
        const current = index === parts.length - 1 ? " is-current" : "";
        return `<span class="product-detail-breadcrumb-item${current}">${esc(part)}</span>`;
      }).join('<span class="product-detail-breadcrumb-separator">•</span>')
      : `<span class="product-detail-breadcrumb-item is-current">Kategori belirtilmedi</span>`;
  }

  function productGalleryUrls(product) {
    if (Array.isArray(product.images) && product.images.length) {
      return product.images
        .map((img) => img.galleryImageUrl || img.gallery_url || img.url)
        .filter(Boolean);
    }
    const t = product.technical || {};
    const gallery = product.gallery || t.gallery || t.galleryUrls;
    if (Array.isArray(gallery) && gallery.length) return gallery.map(String).filter(Boolean);
    return [product.galleryImageUrl || product.gallery_image_url || product.image].filter(Boolean);
  }

  function productCardImage(product) {
    return product.cardImageUrl || product.card_image_url || product.thumbnailUrl || product.thumbnail_url || product.image || "";
  }

  function wireGallery(images, productName) {
    const stage = $("gallery-stage");
    const empty = $("gallery-empty");
    const main = $("gallery-main-img");
    const prevImg = $("gallery-prev-img");
    const nextImg = $("gallery-next-img");
    const thumbs = $("gallery-thumbs");
    const prev = $("gallery-prev");
    const next = $("gallery-next");
    let idx = 0;
    const n = images.length;

    if (!n) {
      stage.classList.add("hidden");
      empty.classList.remove("hidden");
      thumbs.innerHTML = "";
      prev.style.display = "none";
      next.style.display = "none";
      return;
    }

    function setGalleryImage(img, src, alt) {
      if (!img) return;
      img.src = src;
      img.alt = alt || "";
    }

    function renderThumbs() {
      thumbs.innerHTML = images.map((src, i) => `
        <button type="button" data-i="${i}" class="product-detail-gallery-thumb${i === idx ? " is-active" : ""}" aria-label="Görsel ${i + 1}">
          <img src="${esc(src)}" alt="" loading="${i > 2 ? "lazy" : "eager"}" decoding="async">
        </button>
      `).join("");
      thumbs.querySelectorAll(".product-detail-gallery-thumb").forEach((btn) => {
        btn.addEventListener("click", () => {
          idx = Number(btn.getAttribute("data-i") || 0);
          update();
        });
      });
    }

    function update() {
      const prevIndex = (idx - 1 + n) % n;
      const nextIndex = (idx + 1) % n;
      setGalleryImage(main, images[idx], productName || "Ürün görseli");
      setGalleryImage(prevImg, images[prevIndex], "");
      setGalleryImage(nextImg, images[nextIndex], "");
      prevImg.closest(".product-detail-gallery-frame").hidden = n <= 1;
      nextImg.closest(".product-detail-gallery-frame").hidden = n <= 1;
      prev.style.display = n <= 1 ? "none" : "";
      next.style.display = n <= 1 ? "none" : "";
      renderThumbs();
    }

    prev.addEventListener("click", () => {
      idx = (idx - 1 + n) % n;
      update();
    });
    next.addEventListener("click", () => {
      idx = (idx + 1) % n;
      update();
    });
    update();
  }

  function parseOtherSpecs(product) {
    if (Array.isArray(product.specRows) && product.specRows.length) {
      return product.specRows.map((row) => ({
        label: row.label || row.key,
        value: [row.value, row.unit].filter(Boolean).join(" "),
      }));
    }
    const other = product.technical?.other;
    if (Array.isArray(other)) return other.filter(Boolean);
    if (other && typeof other === "object") {
      return Object.entries(other).map(([label, value]) => ({ label, value }));
    }
    return [];
  }

  function buildTechnicalSection(product) {
    const t = product.technical || {};
    const primaryRows = [
      ["Malzeme", product.material || t.material || t.materialType],
      ["Akustik performans", product.acousticRating || t.acousticRating || t.acoustic],
      ["Yangın sınıfı", product.fireClass || t.fireClass],
      ["Kalınlık", product.thicknessMm ? `${product.thicknessMm} mm` : t.thickness],
      ["Ölçü", product.dimensions || t.dimensions],
      ["Renk ailesi", product.colorFamily || t.colorFamily],
      ["Kullanım", product.usageArea || t.usageArea || t.usageScope],
      ["Sertifikalar", Array.isArray(product.certificates) ? product.certificates.join(", ") : t.certificates],
    ];
    const otherRows = parseOtherSpecs(product)
      .filter((row) => row.label && row.value)
      .map((row) => [row.label, row.value]);
    const allRows = [...primaryRows, ...otherRows]
      .filter(([, value]) => textOrEmpty(value));
    const rowsHtml = allRows.length
      ? allRows.map(([label, value]) => `
        <div class="product-detail-info-row">
          <div class="product-detail-info-label">${esc(label)}</div>
          <div class="product-detail-info-value">${esc(value)}</div>
        </div>
      `).join("")
      : `<p class="product-detail-muted">Bu ürün için teknik bilgi henüz eklenmedi.</p>`;

    return `<article class="product-detail-section ag-card">
      <div class="product-detail-description-block">
        <h2 class="product-detail-section-title">Ürün Açıklaması</h2>
        <p class="product-detail-lead">${esc(product.description || product.summary || "Bu ürün için açıklama henüz eklenmedi.")}</p>
      </div>
      <h2 class="product-detail-section-title">Teknik Bilgiler</h2>
      ${allRows.length ? `<div class="product-detail-info-table">${rowsHtml}</div>` : rowsHtml}
    </article>`;
  }

  function buildVariantsSection(product) {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (!variants.length) {
      return `<article class="product-detail-section ag-card">
        <div class="product-detail-section-title-row">
          <h2 class="product-detail-section-title">Varyantlar</h2>
          <span class="product-detail-count-pill">0</span>
        </div>
        <p class="product-detail-muted">Bu ürün için varyant bilgisi henüz eklenmedi.</p>
      </article>`;
    }
    const cards = variants.map((variant, i) => `
      <div class="product-detail-variant-card">
        ${variant.image ? `<span class="product-detail-variant-thumb"><img src="${esc(variant.image)}" alt="" loading="lazy" decoding="async"></span>` : ""}
        <span class="product-detail-variant-copy">
          <span class="product-detail-variant-name">${esc(variant.name || `Varyant ${i + 1}`)}</span>
          ${variant.code ? `<span class="product-detail-variant-meta">${esc(variant.code)}</span>` : ""}
          ${variant.finish ? `<span class="product-detail-variant-meta">${esc(variant.finish)}</span>` : ""}
          ${variant.size ? `<span class="product-detail-variant-meta">${esc(variant.size)}</span>` : ""}
        </span>
      </div>
    `).join("");
    return `<article class="product-detail-section ag-card">
      <div class="product-detail-section-title-row">
        <h2 class="product-detail-section-title">Varyantlar</h2>
        <span class="product-detail-count-pill">${variants.length}</span>
      </div>
      <div class="product-detail-variant-grid">${cards}</div>
    </article>`;
  }

  function collectFilesByType(product) {
    const files = product.files || {};
    return {
      pdf: [...(files.pdfs || [])],
      cad: [...(files.dwgs || [])],
      model: [...(files.models3d || []), ...(files.other || [])],
    };
  }

  function fileItemHref(file, eventType, product) {
    const href = typeof file === "string" ? file : file.url || file.href || "";
    const label = typeof file === "string" ? "Dosya" : file.label || file.name || "Dosya";
    if (!href) return "";
    return `<li><a data-file-event="${eventType}" class="product-detail-file-item" href="${esc(href)}" target="_blank" rel="noopener noreferrer"><span>${esc(label)}</span><span class="product-detail-file-item-chevron" aria-hidden="true">›</span></a></li>`;
  }

  function renderFileGroup(title, rows, eventType, product) {
    if (!rows.length) {
      return `<div class="product-detail-file-group">
        <div class="product-detail-file-group-head"><p class="product-detail-file-title">${esc(title)}</p></div>
        <span class="product-detail-file-placeholder">Henüz dosya eklenmedi</span>
      </div>`;
    }
    return `<div class="product-detail-file-group">
      <div class="product-detail-file-group-head"><p class="product-detail-file-title">${esc(title)}</p></div>
      <ul class="product-detail-file-list">${rows.map((row) => fileItemHref(row, eventType, product)).join("")}</ul>
    </div>`;
  }

  function buildFilesColumn(product) {
    const files = collectFilesByType(product);
    return (
      renderFileGroup("PDF Dosyaları", files.pdf, "download_file", product) +
      renderFileGroup("CAD / BIM Dosyaları", files.cad, "download_file", product) +
      renderFileGroup("3D / Diğer Dosyalar", files.model, "download_file", product)
    );
  }

  function usageItems(product) {
    const t = product.technical || {};
    const values = [
      product.usageArea,
      t.usageArea,
      t.usageScope,
      product.indoorOutdoor,
      product.category,
    ].filter(Boolean);
    const split = values.flatMap((value) => String(value).split(/[,/|>]/).map((x) => x.trim()));
    return [...new Set(split.filter(Boolean))];
  }

  function renderBrandChips(product) {
    const categories = Array.isArray(product.brandCategories) && product.brandCategories.length
      ? product.brandCategories
      : String(product.category || "").split(">").map((x) => x.trim()).filter(Boolean);
    $("brand-category-chips").innerHTML = categories.map((item) => `<span class="product-detail-brand-chip">${esc(item)}</span>`).join("");

    const roles = product.companyRoles || product.brandCompanyRoles || [];
    $("brand-role-tags").innerHTML = roles.map((key) => {
      const label = COMPANY_ROLE_LABELS[String(key).toLowerCase()] || key;
      return `<span class="product-detail-brand-role-pill">${esc(label)}</span>`;
    }).join("");
  }

  function renderBrandVariants(product) {
    const el = $("brand-card-variants");
    const variants = Array.isArray(product.variants) ? product.variants.slice(0, 5) : [];
    if (!variants.length) {
      el.setAttribute("hidden", "");
      return;
    }
    el.removeAttribute("hidden");
    el.innerHTML = `<p>Varyantlar</p><div>${variants.map((variant, i) => (
      variant.image
        ? `<span class="product-detail-brand-variant-dot" title="${esc(variant.name || `Varyant ${i + 1}`)}"><img src="${esc(variant.image)}" alt=""></span>`
        : `<span class="product-detail-brand-variant-dot" title="${esc(variant.name || `Varyant ${i + 1}`)}"></span>`
    )).join("")}</div>`;
  }

  function renderRelatedProducts(product) {
    const el = $("brand-preview-strip");
    const products = Array.isArray(product.relatedProducts) ? product.relatedProducts : [];
    if (!products.length) {
      el.innerHTML = `<p class="product-detail-brand-preview-empty">Bu markaya ait başka ürün bulunmuyor.</p>`;
      $("brand-preview-next").hidden = true;
      return;
    }
    el.innerHTML = products.map((item) => {
      const img = productGalleryUrls(item)[0] || "";
      return `<a class="product-detail-brand-preview-item" href="${productHref(item)}">
        <span class="product-detail-brand-preview-thumb">${img ? `<img src="${esc(productCardImage(item) || img)}" alt="" width="160" height="120" loading="lazy" decoding="async">` : ""}</span>
        <span class="product-detail-brand-preview-name">${esc(item.name || "")}</span>
      </a>`;
    }).join("");
    const nextBtn = $("brand-preview-next");
    nextBtn.hidden = products.length < 4;
    nextBtn.onclick = () => el.scrollBy({ left: 224, behavior: "smooth" });
  }

  function renderRelatedProjects(product) {
    const projects = Array.isArray(product.relatedProjects) ? product.relatedProjects : [];
    const el = $("related-projects");
    if (!projects.length) {
      el.innerHTML = `<p class="product-detail-muted">Bu ürünle ilişkilendirilmiş proje henüz eklenmedi.</p>`;
      return;
    }
    el.innerHTML = `<div class="product-detail-related-grid">${projects.map((project) => `
      <a class="product-detail-related-card" href="/proje-detay.html?id=${encodeURIComponent(project.id)}">
        ${project.image ? `<img src="${esc(project.image)}" alt="" width="360" height="220" loading="lazy" decoding="async">` : ""}
        <span>${esc(project.title || "Proje")}</span>
      </a>
    `).join("")}</div>`;
  }

  async function track(eventType, product, metadata = {}) {
    try {
      await AG.trackEvent({
        eventType,
        productId: product.id,
        brandId: product.brandId,
        metadata,
      });
    } catch (_) {}
  }

  function wireActions(product) {
    $("btn-save-product").addEventListener("click", async () => {
      try {
        const res = await AG.toggleFavoriteProduct(product);
        await track("save_to_favorites", product);
        $("btn-save-product").textContent = res?.active === false ? "Kaydet" : "Kaydedildi";
      } catch (_) {
        location.href = "/mimar-giris.html";
      }
    });

    $("btn-moodboard").addEventListener("click", async (event) => {
      event.preventDefault();
      try {
        const res = await AG.addProductToMoodboard({ moodboardName: "Kaydedilen Ürünler", product });
        if (!res?.ok) throw new Error(res?.message || "Moodboard'a eklenemedi");
        await track("add_to_moodboard", product);
        location.href = "/mimar-paneli.html?tab=moodboards";
      } catch (_) {
        location.href = "/mimar-giris.html";
      }
    });

    document.querySelectorAll("[data-file-event]").forEach((link) => {
      link.addEventListener("click", () => track("download_file", product, { href: link.href }));
    });

    $("quote-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      await track("request_quote", product);
      location.href = contactHref({
        konu: "urun",
        talep: "teklif",
        urun: product.name || "",
        marka: product.brandName || "",
        urunId: product.id || "",
      });
    });

    $("btn-teklif").addEventListener("click", () => track("request_quote", product));
    $("btn-iletisim").addEventListener("click", () => track("contact_brand", product));
  }

  async function init() {
    const { id, slug } = routeProductParams();
    await AG.ready;

    if (!id && !slug) {
      $("product-detail-loading").classList.add("hidden");
      $("product-detail-missing").classList.remove("hidden");
      return;
    }

    let product = await AG.getProductDetail({ id, slug });
    if (!product && id) {
      product = STATIC_COMPAT_PRODUCTS.find((item) => String(item.id) === String(id)) || null;
      if (product) {
        product.relatedProducts = STATIC_COMPAT_PRODUCTS
          .filter((item) => item.id !== product.id && item.brandName === product.brandName)
          .slice(0, 8);
      }
    }
    $("product-detail-loading").classList.add("hidden");
    if (!product) {
      $("product-detail-missing").classList.remove("hidden");
      return;
    }

    $("product-detail-root").classList.remove("hidden");
    setMeta(product);
    AG.incrementView(product.id).catch(() => {});

    renderBreadcrumb($("hero-category"), product.category);
    $("hero-title").textContent = product.name || "Ürün";
    $("brand-card-product-title").textContent = product.name || "Ürün";
    $("brand-card-summary").textContent = product.description || product.summary || "Teklif ve teknik konularda bu marka ile doğrudan iletişime geçebilirsiniz.";
    $("brand-name").textContent = product.brandName || "-";

    const brandLogo = textOrEmpty(product.brandLogo);
    if (brandLogo) {
      $("brand-logo").src = brandLogo;
      $("brand-logo").alt = product.brandName || "Marka";
      $("brand-logo").classList.remove("is-hidden");
      $("brand-avatar").classList.add("is-hidden");
    } else {
      $("brand-avatar").textContent = (product.brandName || "M").trim().charAt(0).toUpperCase();
    }

    const query = {
      konu: "urun",
      urun: product.name || "",
      marka: product.brandName || "",
      urunId: product.id || "",
    };
    $("btn-teklif").href = contactHref({ ...query, talep: "teklif" });
    $("btn-iletisim").href = contactHref({ ...query, talep: "iletisim" });
    $("brand-more-products").href = `/urunler.html?brand=${encodeURIComponent(product.brandName || "")}`;

    wireGallery(productGalleryUrls(product), product.name);
    $("inject-technical").innerHTML = buildTechnicalSection(product);
    $("inject-variants").innerHTML = buildVariantsSection(product);
    $("inject-files").innerHTML = buildFilesColumn(product);
    $("usage-list").innerHTML = usageItems(product).length
      ? usageItems(product).map((item) => `<li>${esc(item)}</li>`).join("")
      : `<li>Kullanım alanı henüz eklenmedi.</li>`;

    renderBrandChips(product);
    renderBrandVariants(product);
    renderRelatedProducts(product);
    renderRelatedProjects(product);
    wireActions(product);
  }

  init().catch(() => {
    $("product-detail-loading").classList.add("hidden");
    $("product-detail-missing").classList.remove("hidden");
  });
})();
