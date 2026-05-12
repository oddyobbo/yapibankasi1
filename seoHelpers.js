(function () {
  function text(value, fallback = "") {
    return String(value || fallback || "").trim();
  }

  function cleanDescription(value, fallback) {
    const raw = text(value, fallback).replace(/\s+/g, " ");
    return raw.length > 160 ? `${raw.slice(0, 157).trim()}...` : raw;
  }

  function absoluteUrl(pathOrUrl) {
    const value = text(pathOrUrl);
    if (!value) return "";
    try {
      return new URL(value, window.location.origin).href;
    } catch (_) {
      return "";
    }
  }

  function ensureMeta(selector, attrs) {
    let tag = document.head.querySelector(selector);
    if (!tag) {
      tag = document.createElement("meta");
      Object.entries(attrs || {}).forEach(([key, value]) => tag.setAttribute(key, value));
      document.head.appendChild(tag);
    }
    return tag;
  }

  function setMeta(name, content) {
    ensureMeta(`meta[name="${name}"]`, { name }).setAttribute("content", content || "");
  }

  function setOg(property, content) {
    ensureMeta(`meta[property="${property}"]`, { property }).setAttribute("content", content || "");
  }

  function setCanonical(url) {
    let tag = document.head.querySelector('link[rel="canonical"]');
    if (!tag) {
      tag = document.createElement("link");
      tag.setAttribute("rel", "canonical");
      document.head.appendChild(tag);
    }
    tag.setAttribute("href", absoluteUrl(url) || window.location.href.split("#")[0]);
  }

  function setJsonLd(id, data) {
    if (!data) return;
    const old = document.getElementById(id);
    if (old) old.remove();
    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.id = id;
    tag.textContent = JSON.stringify(data);
    document.head.appendChild(tag);
  }

  function applyBaseSeo({ title, description, canonical, image, type = "website" }) {
    const safeTitle = text(title, "Archilink");
    const safeDescription = cleanDescription(description, "Archilink mimari ürün, marka ve proje keşif platformu.");
    const imageUrl = absoluteUrl(image);
    document.title = safeTitle;
    setMeta("description", safeDescription);
    setOg("og:title", safeTitle);
    setOg("og:description", safeDescription);
    setOg("og:type", type);
    setOg("og:url", absoluteUrl(canonical) || window.location.href.split("#")[0]);
    if (imageUrl) setOg("og:image", imageUrl);
    setCanonical(canonical);
    return { title: safeTitle, description: safeDescription, imageUrl };
  }

  function renderProductSeo(product, canonicalPath) {
    const name = text(product?.name, "Ürün Detayı");
    const brand = text(product?.brandName, "Archilink");
    const image = product?.galleryImageUrl || product?.cardImageUrl || product?.thumbnailUrl || product?.image || "";
    const base = applyBaseSeo({
      title: `${name} | ${brand} | Archilink`,
      description: product?.summary || product?.description || `${name} teknik bilgileri, dosyaları ve marka detayları.`,
      canonical: canonicalPath || window.location.href,
      image,
      type: "product",
    });
    setJsonLd("ag-product-jsonld", {
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      image: base.imageUrl ? [base.imageUrl] : undefined,
      description: base.description,
      brand: brand ? { "@type": "Brand", name: brand } : undefined,
      sku: product?.sku || undefined,
      category: product?.category || undefined,
    });
  }

  function renderBrandSeo(brand, canonicalPath, productCount = 0) {
    const name = text(brand?.name || brand?.brandName, "Marka");
    const description = cleanDescription(
      brand?.description || brand?.summary,
      `${name} ürünleri, kategori kapsamı ve marka bilgileri Archilink'te.`
    );
    const base = applyBaseSeo({
      title: `${name} | Marka | Archilink`,
      description,
      canonical: canonicalPath || window.location.href,
      image: brand?.logo || brand?.brandLogo || brand?.image || "",
      type: "profile",
    });
    setJsonLd("ag-brand-jsonld", {
      "@context": "https://schema.org",
      "@type": "Organization",
      name,
      description: base.description,
      url: brand?.website || undefined,
      logo: base.imageUrl || undefined,
      numberOfItems: productCount || undefined,
      knowsAbout: Array.isArray(brand?.brand_categories) ? brand.brand_categories : undefined,
    });
  }

  function renderProjectSeo(project, canonicalPath) {
    const title = text(project?.title, "Proje Detayı");
    const architect = text(project?.architect || project?.officeName || project?.brandName, "");
    const location = text(project?.location || [project?.city, project?.country].filter(Boolean).join(", "), "");
    const base = applyBaseSeo({
      title: `${title} | ${architect || "Proje"} | Archilink`,
      description: project?.description || `${title} proje detayları, kullanılan ürünler ve lokasyon bilgileri.`,
      canonical: canonicalPath || window.location.href,
      image: project?.image || "",
      type: "article",
    });
    setJsonLd("ag-project-jsonld", {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: title,
      description: base.description,
      image: base.imageUrl || undefined,
      creator: architect ? { "@type": "Organization", name: architect } : undefined,
      contentLocation: location ? { "@type": "Place", name: location } : undefined,
      about: Array.isArray(project?.materials)
        ? project.materials.map((item) => text(item.name)).filter(Boolean)
        : undefined,
    });
  }

  window.AG_SEO = {
    applyBaseSeo,
    renderProductSeo,
    renderBrandSeo,
    renderProjectSeo,
  };
})();
