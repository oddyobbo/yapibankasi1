(() => {
  let architectSession = null;
  let brandSession = null;
  try { architectSession = JSON.parse(localStorage.getItem("ag_architect_session_v1") || "null"); } catch {}
  try { brandSession = JSON.parse(localStorage.getItem("ag_brand_session_v1") || "null"); } catch {}

  if (!document.querySelector('link[data-ag-css="site"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/site.css";
    link.setAttribute("data-ag-css", "site");
    document.head.appendChild(link);
  }

  const current = document.body.dataset.page || "";

  const baseNavItems = [
    { id: "home",     href: "/mvp-taslak-v1.html", label: "Anasayfa" },
    { id: "products", href: "/urunler.html",        label: "Ürünler" },
    { id: "brands",   href: "/markalar.html",       label: "Markalar" },
    { id: "projects", href: "/projeler.html",       label: "Projeler" },
  ];

  const productMegaMenu = [
    {
      label: "Malzemeler",
      value: "Malzemeler",
      subs: [
        { label: "Zemin", value: "Zemin" },
        { label: "Cam", value: "Cam" },
        { label: "Deri", value: "Deri" },
        { label: "Yığma ve Taş", value: "Yığma ve Taş" },
        { label: "Metal", value: "Metal" },
        { label: "Boya", value: "Boya" },
        { label: "Panel", value: "Panel" },
        { label: "Yüzey Bitişi", value: "Yüzey Bitişi" },
        { label: "Reçine", value: "Reçine" },
        { label: "Yüzey", value: "Yüzey" },
        { label: "Tekstil", value: "Tekstil" },
        { label: "Seramik", value: "Seramik" },
        { label: "Duvar Kaplama", value: "Duvar Kaplama" },
      ],
    },
    {
      label: "Mobilya ve Donatı",
      value: "Mobilya ve Donatı",
      subs: [
        { label: "Akustik", value: "Akustik" },
        { label: "Elektrikli Cihazlar", value: "Elektrikli Cihazlar" },
        { label: "Banyo", value: "Banyo" },
        { label: "Dekor ve Aksesuar", value: "Dekor ve Aksesuar" },
        { label: "Mobilya", value: "Mobilya" },
        { label: "Donanım", value: "Donanım" },
        { label: "Mutfak", value: "Mutfak" },
        { label: "Aydınlatma", value: "Aydınlatma" },
        { label: "Dış Mekan", value: "Dış Mekan" },
        { label: "Pencere Sistemleri", value: "Pencere Sistemleri" },
      ],
    },
    {
      label: "Mimari",
      value: "Mimari",
      subs: [
        { label: "Tavan", value: "Tavan" },
        { label: "Deck Kaplama", value: "Decking" },
        { label: "Kapılar", value: "Kapılar" },
        { label: "Cephe", value: "Cephe" },
        { label: "Profil ve Trim", value: "Profil ve Trim" },
        { label: "Peyzaj ve Kaplama", value: "Peyzaj ve Kaplama" },
      ],
    },
  ];

  const iFloor = "<svg width='14' height='14' viewBox='0 0 16 16' aria-hidden='true'><path d='M2 13h12M2 10h12M2 7h12M3 4h10' stroke='#76767d' stroke-width='1.4' fill='none' stroke-linecap='round'/></svg>";
  const iSquare = "<svg width='14' height='14' viewBox='0 0 16 16' aria-hidden='true'><rect x='2.5' y='2.5' width='11' height='11' rx='1.5' stroke='#76767d' stroke-width='1.4' fill='none'/></svg>";
  const iGrid = "<svg width='14' height='14' viewBox='0 0 16 16' aria-hidden='true'><path d='M2.5 5.5h11M2.5 10.5h11M5.5 2.5v11M10.5 2.5v11' stroke='#76767d' stroke-width='1.3' fill='none'/><rect x='2.5' y='2.5' width='11' height='11' rx='1.5' stroke='#76767d' stroke-width='1.2' fill='none'/></svg>";
  const iDoor = "<svg width='14' height='14' viewBox='0 0 16 16' aria-hidden='true'><path d='M4 2.5h8v11H4zM9.7 8h.01' stroke='#76767d' stroke-width='1.4' fill='none' stroke-linecap='round'/></svg>";
  const iLight = "<svg width='14' height='14' viewBox='0 0 16 16' aria-hidden='true'><path d='M8 2.5v7M5.5 12h5M6.5 13.5h3' stroke='#76767d' stroke-width='1.4' fill='none' stroke-linecap='round'/></svg>";

  const subCategoryIcons = {
    "Zemin": iFloor,
    "Cam": iSquare,
    "Deri": iSquare,
    "Yığma ve Taş": iGrid,
    "Metal": iSquare,
    "Boya": iSquare,
    "Panel": iGrid,
    "Yüzey Bitişi": iSquare,
    "Reçine": iSquare,
    "Yüzey": iSquare,
    "Tekstil": iGrid,
    "Seramik": iGrid,
    "Duvar Kaplama": iSquare,
    "Akustik": iGrid,
    "Elektrikli Cihazlar": iSquare,
    "Banyo": iSquare,
    "Dekor ve Aksesuar": iSquare,
    "Mobilya": iGrid,
    "Donanım": iSquare,
    "Mutfak": iSquare,
    "Aydınlatma": iLight,
    "Dış Mekan": iSquare,
    "Pencere Sistemleri": iSquare,
    "Tavan": iFloor,
    "Decking": iFloor,
    "Kapılar": iDoor,
    "Cephe": iGrid,
    "Profil ve Trim": iFloor,
    "Peyzaj ve Kaplama": iGrid,
  };

  const headerTarget = document.getElementById("site-header");
  if (headerTarget) {
    const navItems = [...baseNavItems];

    const nav = navItems
      .map((item) => {
        const isActive = item.id === current;
        if (item.id === "products") {
          const megaCols = productMegaMenu.map(
              (col) => `
                <div class="px-6">
                  <a href="/urunler.html?category=${encodeURIComponent(col.value)}" class="inline-flex items-center gap-2 text-[19px] font-semibold text-black hover:text-[#6e6e73] transition-colors">
                    <span>${col.label}</span>
                    <span class="text-[15px] text-[#7a7a80]">›</span>
                  </a>
                  <div class="mt-2 space-y-1">
                    ${[...col.subs]
                      .sort((a, b) => a.label.localeCompare(b.label, "tr"))
                      .map(
                        (sub) =>
                          `<a href="/urunler.html?category=${encodeURIComponent(col.value)}&sub=${encodeURIComponent(
                            sub.value
                          )}" class="flex items-center gap-2 text-[18px] text-black hover:text-[#6e6e73] transition-colors">
                            <span class="w-4 h-4 inline-flex items-center justify-center">${subCategoryIcons[sub.value] || iSquare}</span>
                            <span>${sub.label}</span>
                          </a>`
                      )
                      .join("")}
                  </div>
                </div>`
            )
            .join("");
          return `
            <div class="relative">
              <button type="button" id="products-mega-toggle" class="px-3 py-2 rounded-full text-[15.5px] transition-colors ${
                isActive ? "text-black bg-[#eef0f4]" : "text-[#1f1f22] hover:text-black hover:bg-[#f1f1f3]"
              }">${item.label}
                <span class="inline-flex align-middle ml-1 -mt-[1px]">
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6.5l4 4 4-4" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
              </button>
              <div id="products-mega-panel" class="hidden fixed left-0 right-0 top-[72px] z-40">
                <div class="w-full border-x border-b border-black/[0.08] bg-white shadow-[0_30px_70px_rgba(0,0,0,0.16)] rounded-b-2xl overflow-hidden">
                  <div class="px-3 lg:px-6 pt-4 pb-1 grid grid-cols-3 items-center">
                    <div class="px-6">
                      <p class="text-[20px] font-semibold text-black leading-none">Ürünler</p>
                    </div>
                    <div class="flex justify-center">
                      <div class="inline-flex rounded-full bg-[#f1f1f3] p-1 gap-1">
                        <a href="/urunler.html" class="inline-flex items-center h-10 px-5 rounded-full bg-black text-white text-[15px] font-semibold hover:bg-[#2a2a2a] transition-colors">Tüm Ürünler</a>
                        <a href="/yeni-koleksiyonlar.html" class="inline-flex items-center h-10 px-5 rounded-full text-[15px] font-semibold text-black hover:text-[#6e6e73] transition-colors">Yeni Koleksiyonlar</a>
                      </div>
                    </div>
                    <div></div>
                  </div>
                  <div class="w-full border-t border-black/[0.08]"></div>
                  <div class="px-3 lg:px-6 py-5 grid grid-cols-3 divide-x divide-black/[0.06] gap-1">
                    ${megaCols}
                  </div>
                </div>
              </div>
            </div>`;
        }
        return `<a href="${item.href}" class="px-3 py-2 rounded-full text-[15px] transition-colors ${
          isActive ? "text-black bg-[#eef0f4]" : "text-[#1f1f22] hover:text-black hover:bg-[#f1f1f3]"
        }">${item.label}</a>`;
      })
      .join("");

    const mobileNav = navItems
      .map((item) => {
        const isActive = item.id === current;
        return `<a href="${item.href}" class="block px-1 py-3 text-[15px] border-b border-black/[0.06] ${
          isActive ? "text-black font-semibold" : "text-[#1f1f22]"
        }">${item.label}</a>`;
      })
      .join("");

    const profileIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
    const chevron = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6l4 4 4-4"/></svg>`;
    const logoutIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

    const archName  = architectSession ? (architectSession.name  || "Mimar").slice(0, 14) : "";
    const brandName = brandSession      ? (brandSession.name      || "Marka").slice(0, 14) : "";

    const desktopAuthLinks = architectSession
      ? `<div class="relative" id="arch-dropdown-wrap">
          <button id="arch-dropdown-btn" type="button" class="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-black/[0.12] text-[13px] hover:bg-black/[0.04] transition">
            ${profileIcon}<span class="max-w-[100px] truncate">${archName}</span>${chevron}
          </button>
          <div id="arch-dropdown-panel" class="hidden absolute right-0 top-full mt-2 w-52 rounded-2xl border border-black/[0.08] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.14)] z-50 py-1.5 overflow-hidden">
            <a href="/mimar-paneli.html" class="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7]">${profileIcon} Panelim</a>
            <a href="/mimar-paneli.html?tab=fav-products" class="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l7.78 7.78 7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              Favorilerim
            </a>
            <a href="/mimar-paneli.html?tab=moodboards" class="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
              Boardlarım
            </a>
            <div class="border-t border-black/[0.07] my-1"></div>
            <button id="arch-logout-btn" type="button" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7]">${logoutIcon} Çıkış Yap</button>
          </div>
        </div>`
      : brandSession
      ? `<div class="relative" id="brand-dropdown-wrap">
          <button id="brand-dropdown-btn" type="button" class="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-black/[0.12] text-[13px] hover:bg-black/[0.04] transition">
            ${profileIcon}<span class="max-w-[100px] truncate">${brandName}</span>${chevron}
          </button>
          <div id="brand-dropdown-panel" class="hidden absolute right-0 top-full mt-2 w-52 rounded-2xl border border-black/[0.08] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.14)] z-50 py-1.5 overflow-hidden">
            <a href="/marka-paneli.html" class="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7]">${profileIcon} Marka Paneli</a>
            <a href="/marka-paneli.html?tab=products" class="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Ürünlerim
            </a>
            <a href="/marka-paneli.html?tab=projects" class="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              Projeler
            </a>
            <a href="/marka-paneli.html?tab=profile" class="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Marka Profili
            </a>
            <div class="border-t border-black/[0.07] my-1"></div>
            <button id="brand-logout-btn" type="button" class="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-[#1d1d1f] hover:bg-[#f5f5f7]">${logoutIcon} Çıkış Yap</button>
          </div>
        </div>`
      : `<a href="/giris.html" class="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-black/[0.12] text-[13px] hover:bg-black/[0.04] transition">
          ${profileIcon} Giriş Yap
        </a>`;

    const mobileAuthLinks = architectSession
      ? `
        <a href="/marka-giris.html" class="flex-1 h-10 inline-flex items-center justify-center rounded-full border border-black/[0.10] text-[13px]">Marka Girişi</a>
        <a href="/mimar-paneli.html" class="flex-1 h-10 inline-flex items-center justify-center rounded-full border border-black/[0.10] text-[13px]">Mimar Paneli</a>
        <a href="/moodboard.html" class="flex-1 h-10 inline-flex items-center justify-center rounded-full bg-black text-white text-[13px] font-semibold">Moodboard</a>
      `
      : `
        <a href="/marka-giris.html" class="flex-1 h-10 inline-flex items-center justify-center rounded-full border border-black/[0.10] text-[13px]">Marka Girişi</a>
        <a href="/marka-basvuru.html" class="flex-1 h-10 inline-flex items-center justify-center rounded-full bg-black text-white text-[13px] font-semibold">Marka Başla</a>
      `;

    headerTarget.innerHTML = `
      <header class="border-b border-black/[0.06] sticky top-0 bg-white/85 backdrop-blur-xl z-30">
        <div class="h-[72px] px-4 sm:px-6 lg:px-10 flex items-center">
          <!-- Logo -->
          <a href="/mvp-taslak-v1.html" class="flex-shrink-0 mr-8 inline-flex items-baseline gap-0 leading-none select-none" style="font-size:22px;font-weight:600;letter-spacing:-0.3px;color:#1d1d1f;text-decoration:none;" aria-label="Archilink">
            <span>Arch</span><span style="position:relative;display:inline-block;"><span>il</span><svg style="position:absolute;bottom:-5px;left:-1px;right:-1px;width:calc(100% + 2px);overflow:visible;" height="6" viewBox="0 0 20 6" preserveAspectRatio="none"><path d="M0,1 Q10,6 20,1" stroke="#1d1d1f" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg></span><span>ink</span>
          </a>
          <!-- Nav -->
          <nav class="hidden lg:flex items-center gap-1 flex-shrink-0">${nav}</nav>
          <!-- Search (fills middle) -->
          <form id="header-search-form" action="/urunler.html" method="get" class="hidden lg:flex flex-1 relative mx-6 max-w-[520px]">
            <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8e8e93] pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input name="q" type="text" placeholder="Ürün ara..." autocomplete="off"
              class="w-full h-[38px] rounded-full border border-black/[0.12] bg-[#f5f5f7] pl-10 pr-4 text-[13.5px] outline-none focus:bg-white focus:border-black/25 transition-colors">
          </form>
          <!-- Spacer pushes profile to far right -->
          <div class="flex-1"></div>
          <!-- Profile (far right) -->
          <div class="hidden lg:flex items-center gap-2 flex-shrink-0">
            ${desktopAuthLinks}
          </div>
          <button id="mobile-menu-btn" class="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-full border border-black/[0.08] text-[18px]" aria-label="Menü">☰</button>
        </div>
        <div id="mobile-menu" class="lg:hidden hidden px-4 sm:px-6 pb-4">
          <div class="rounded-2xl border border-black/[0.08] bg-white px-4">
            ${mobileNav}
            <div class="py-4 flex gap-2">
              ${mobileAuthLinks}
            </div>
          </div>
        </div>
      </header>
    `;

    const menuBtn = document.getElementById("mobile-menu-btn");
    const mobileMenu = document.getElementById("mobile-menu");
    if (menuBtn && mobileMenu) {
      menuBtn.addEventListener("click", () => {
        mobileMenu.classList.toggle("hidden");
      });
    }

    const megaToggle = document.getElementById("products-mega-toggle");
    const megaPanel = document.getElementById("products-mega-panel");
    if (megaToggle && megaPanel) {
      const closeMega = () => megaPanel.classList.add("hidden");
      megaToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        megaPanel.classList.toggle("hidden");
      });
      megaPanel.addEventListener("click", (e) => e.stopPropagation());
      document.addEventListener("click", closeMega);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMega(); });

    }

    const archDropBtn = document.getElementById("arch-dropdown-btn");
    const archDropPanel = document.getElementById("arch-dropdown-panel");
    if (archDropBtn && archDropPanel) {
      archDropBtn.addEventListener("click", (e) => { e.stopPropagation(); archDropPanel.classList.toggle("hidden"); });
      archDropPanel.addEventListener("click", (e) => e.stopPropagation());
      document.addEventListener("click", () => archDropPanel.classList.add("hidden"));
      const archLogoutBtn = document.getElementById("arch-logout-btn");
      if (archLogoutBtn) {
        archLogoutBtn.addEventListener("click", async () => {
          await AG.logoutArchitect();
          location.href = "/";
        });
      }
    }

    const brandDropBtn = document.getElementById("brand-dropdown-btn");
    const brandDropPanel = document.getElementById("brand-dropdown-panel");
    if (brandDropBtn && brandDropPanel) {
      brandDropBtn.addEventListener("click", (e) => { e.stopPropagation(); brandDropPanel.classList.toggle("hidden"); });
      brandDropPanel.addEventListener("click", (e) => e.stopPropagation());
      document.addEventListener("click", () => brandDropPanel.classList.add("hidden"));
      const brandLogoutBtn = document.getElementById("brand-logout-btn");
      if (brandLogoutBtn) {
        brandLogoutBtn.addEventListener("click", async () => {
          try { localStorage.removeItem("ag_brand_session_v1"); } catch {}
          await AG.logoutBrand();
          location.href = "/";
        });
      }
    }
  }

  const footerTarget = document.getElementById("site-footer");
  if (footerTarget) {
    footerTarget.innerHTML = `
      <footer class="border-t border-black/[0.06] bg-white w-full">
        <div class="w-full px-6 lg:px-10 pt-16 pb-10 grid md:grid-cols-5 gap-10 text-[14px]">
          <div class="md:col-span-2">
            <p class="inline-flex items-baseline gap-0 leading-none" style="font-size:24px;font-weight:600;letter-spacing:-0.3px;color:#1d1d1f;">
              <span>Arch</span><span style="position:relative;display:inline-block;"><span>il</span><svg style="position:absolute;bottom:-5px;left:-1px;width:calc(100% + 2px);overflow:visible;" height="6" viewBox="0 0 20 6" preserveAspectRatio="none"><path d="M0,1 Q10,6 20,1" stroke="#1d1d1f" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg></span><span>ink</span>
            </p>
            <p class="text-[#6e6e73] mt-4 max-w-[42ch] leading-relaxed">Mimarların doğru ürünü bulduğu, markaların gerçek talebe ulaştığı Türkiye odaklı mimari malzeme platformu.</p>
            <div class="mt-5 flex gap-2">
              <a href="/marka-basvuru.html" class="px-4 py-2 rounded-full bg-black text-white text-[13px] font-semibold">Marka Başvur</a>
              <a href="/urunler.html" class="px-4 py-2 rounded-full border border-black/15 text-[13px] font-semibold">Ürünleri Keşfet</a>
            </div>
          </div>
          <div>
            <p class="font-semibold">Keşfet</p>
            <div class="mt-3 space-y-2 text-[#6e6e73]">
              <a href="/urunler.html" class="block hover:text-black">Ürünler</a>
              <a href="/markalar.html" class="block hover:text-black">Markalar</a>
              <a href="/projeler.html" class="block hover:text-black">Projeler</a>
              <a href="/nasil-calisir.html" class="block hover:text-black">Nasıl Çalışır</a>
            </div>
          </div>
          <div>
            <p class="font-semibold">Hesap</p>
            <div class="mt-3 space-y-2 text-[#6e6e73]">
              <a href="/marka-giris.html" class="block hover:text-black">Marka Girişi</a>
              <a href="/marka-basvuru.html" class="block hover:text-black">Marka Başvuru</a>
              <a href="/mimar-giris.html" class="block hover:text-black">Mimar Girişi</a>
            </div>
          </div>
          <div>
            <p class="font-semibold">İletişim</p>
            <div class="mt-3 space-y-2 text-[#6e6e73]">
              <p>hello@antigravity.com</p>
              <p>+90 212 000 00 00</p>
              <a href="/iletisim-v2.html" class="block hover:text-black">Form</a>
            </div>
          </div>
        </div>
        <div class="w-full px-6 lg:px-10 py-6 border-t border-black/[0.06] flex flex-wrap items-center justify-between gap-3 text-[12px] text-[#6e6e73]">
          <p>© 2026 Archilink. Tüm hakları saklıdır.</p>
          <p>İstanbul, Türkiye</p>
        </div>
      </footer>
    `;
  }

  // Floating ask pill (site-wide), hide on admin/login pages
  const noPillPages = new Set(["admin-login", "admin", "brand-login", "brand-panel", "architect-login", "architect-panel", "moodboard"]);
  if (!noPillPages.has(current)) {
    const pill = document.createElement("a");
    pill.href = "/urunler.html";
    pill.setAttribute("aria-label", "Ürün ara");
    pill.className =
      "fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-black text-white px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] hover:scale-[1.02] transition";
    pill.innerHTML = `
      <span class="w-6 h-6 rounded-full bg-white text-black text-[12px] font-bold flex items-center justify-center">↑</span>
      <span class="text-[13px] font-semibold">Ürün ara</span>
    `;
    document.body.appendChild(pill);
  }

  // Site-wide reveal animation (no-op on home which already wires it)
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    revealEls.forEach((el) => io.observe(el));
  }

})();
