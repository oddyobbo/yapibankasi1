(() => {
  let architectSession = null;
  try {
    architectSession = JSON.parse(localStorage.getItem("ag_architect_session_v1") || "null");
  } catch {}

  if (!document.querySelector('link[data-ag-css="site"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/site.css";
    link.setAttribute("data-ag-css", "site");
    document.head.appendChild(link);
  }

  const current = document.body.dataset.page || "";

  const baseNavItems = [
    { id: "home", href: "/mvp-taslak-v1.html", label: "Anasayfa" },
    { id: "products", href: "/urunler.html", label: "Ürünler" },
    { id: "brands", href: "/markalar.html", label: "Markalar" },
    { id: "projects", href: "/projeler.html", label: "Projeler" },
    { id: "how", href: "/nasil-calisir.html", label: "Nasıl Çalışır" },
    { id: "apply", href: "/marka-basvuru.html", label: "Marka Başvuru" },
  ];

  const productMegaMenu = [
    {
      name: "Malzemeler",
      subs: [
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
    },
    {
      name: "Mobilya ve Donatı",
      subs: [
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
    },
    {
      name: "Mimari",
      subs: ["Tavan", "Decking", "Kapılar", "Cephe", "Profil ve Trim", "Peyzaj ve Kaplama"],
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
    if (architectSession) {
      navItems.push({ id: "architect-panel", href: "/mimar-paneli.html", label: "Mimar Paneli" });
      navItems.push({ id: "moodboard", href: "/moodboard.html", label: "Moodboard" });
    } else {
      navItems.push({ id: "architect-login", href: "/mimar-giris.html", label: "Mimar Girişi" });
    }

    const nav = navItems
      .map((item) => {
        const isActive = item.id === current;
        if (item.id === "products") {
          const megaCols = productMegaMenu.map(
              (col) => `
                <div>
                  <a href="/urunler.html?category=${encodeURIComponent(col.name)}" class="inline-flex items-center gap-2 text-[17px] font-semibold text-black hover:opacity-80">
                    <span>${col.name}</span>
                    <span class="text-[15px] text-[#7a7a80]">›</span>
                  </a>
                  <div class="mt-2 space-y-1">
                    ${col.subs
                      .map(
                        (sub) =>
                          `<a href="/urunler.html?category=${encodeURIComponent(col.name)}&sub=${encodeURIComponent(
                            sub
                          )}" class="flex items-center gap-2 text-[15px] text-[#4a4a4f] hover:text-black">
                            <span class="w-4 h-4 inline-flex items-center justify-center">${subCategoryIcons[sub] || iSquare}</span>
                            <span>${sub}</span>
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
                <div class="w-full border-y border-black/[0.08] bg-white shadow-[0_30px_70px_rgba(0,0,0,0.16)]">
                  <div class="px-6 pt-4">
                    <div class="inline-flex rounded-full bg-[#f1f1f3] p-1">
                      <button data-products-tab="all" class="products-tab-btn h-9 px-4 rounded-full bg-[#2c2d3a] text-white text-[12px] font-semibold">Tüm Ürünler</button>
                      <button data-products-tab="new" class="products-tab-btn h-9 px-4 rounded-full text-[12px] font-semibold text-[#3a3a40]">Yeni Koleksiyonlar</button>
                    </div>
                  </div>
                  <div class="px-6 py-5 grid grid-cols-3 gap-6">
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

    const desktopAuthLinks = architectSession
      ? `
        <a href="/marka-giris.html" class="inline-flex items-center px-3 py-2 rounded-full text-[13px] hover:bg-black/[0.05]">Marka Girişi</a>
        <a href="/mimar-paneli.html" class="inline-flex items-center px-3 py-2 rounded-full text-[13px] hover:bg-black/[0.05]">Mimar Paneli</a>
        <a href="/marka-basvuru.html" class="px-4 py-2 rounded-full bg-black text-white text-[13px] font-semibold hover:bg-black/85 transition">Marka Başla</a>
      `
      : `
        <a href="/marka-giris.html" class="inline-flex items-center px-3 py-2 rounded-full text-[13px] hover:bg-black/[0.05]">Marka Girişi</a>
        <a href="/marka-basvuru.html" class="px-4 py-2 rounded-full bg-black text-white text-[13px] font-semibold hover:bg-black/85 transition">Marka Başla</a>
      `;

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
        <div class="h-[72px] px-4 sm:px-6 lg:px-10 flex items-center justify-between">
          <a href="/mvp-taslak-v1.html" class="text-[22px] font-semibold tracking-tight">Antigravity</a>
          <nav class="hidden lg:flex items-center gap-1">${nav}</nav>
          <div class="hidden lg:flex items-center gap-2">
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

      const tabs = megaPanel.querySelectorAll(".products-tab-btn");
      tabs.forEach((t) => {
        t.addEventListener("click", () => {
          tabs.forEach((x) => x.className = "products-tab-btn h-9 px-4 rounded-full text-[12px] font-semibold text-[#3a3a40]");
          t.className = "products-tab-btn h-9 px-4 rounded-full bg-[#2c2d3a] text-white text-[12px] font-semibold";
        });
      });
    }
  }

  const footerTarget = document.getElementById("site-footer");
  if (footerTarget) {
    footerTarget.innerHTML = `
      <footer class="border-t border-black/[0.06] bg-white w-full">
        <div class="w-full px-6 lg:px-10 pt-16 pb-10 grid md:grid-cols-5 gap-10 text-[14px]">
          <div class="md:col-span-2">
            <p class="text-[24px] font-semibold tracking-tight">Antigravity</p>
            <p class="text-[#6e6e73] mt-3 max-w-[42ch] leading-relaxed">Mimarların doğru ürünü bulduğu, markaların gerçek talebe ulaştığı Türkiye odaklı mimari malzeme platformu.</p>
            <div class="mt-5 flex gap-2">
              <a href="/marka-basvuru.html" class="px-4 py-2 rounded-full bg-black text-white text-[13px] font-semibold">Marka Başvur</a>
              <a href="/urunler.html" class="px-4 py-2 rounded-full border border-black/15 text-[13px] font-semibold">Ürünleri Keşfet</a>
            </div>
          </div>
          <div>
            <p class="font-semibold">Platform</p>
            <div class="mt-3 space-y-2 text-[#6e6e73]">
              <a href="/urunler.html" class="block hover:text-black">Ürünler</a>
              <a href="/markalar.html" class="block hover:text-black">Markalar</a>
              <a href="/projeler.html" class="block hover:text-black">Projeler</a>
              <a href="/nasil-calisir.html" class="block hover:text-black">Nasıl Çalışır</a>
            </div>
          </div>
          <div>
            <p class="font-semibold">Şirket</p>
            <div class="mt-3 space-y-2 text-[#6e6e73]">
              <a href="/hakkimizda.html" class="block hover:text-black">Hakkımızda</a>
              <a href="/iletisim-v2.html" class="block hover:text-black">İletişim</a>
              <a href="/faq.html" class="block hover:text-black">SSS</a>
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
          <p>© 2026 Antigravity. Tüm hakları saklıdır.</p>
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
