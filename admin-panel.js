(async () => {
      async function waitForAGFunction(name, timeoutMs = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          if (window.AG && typeof window.AG[name] === "function") {
            return window.AG[name];
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        throw new Error(`AG.${name} tanımlı değil`);
      }

      await AG.ready;
      const adminOk = await AG.isAdmin();
      if (!adminOk) { location.href = "/giris"; return; }

      document.getElementById("logout").addEventListener("click", async () => {
        await AG.logoutAdmin();
        location.href = "/giris";
      });

      const ADMIN_SECTION_IDS = ["ozet", "urunler", "markalar", "kategoriler", "leads", "ayarlar"];
      const ADMIN_SECTION_LABELS = {
        ozet: "Özet",
        urunler: "Ürünler",
        markalar: "Markalar",
        kategoriler: "Kategoriler",
        leads: "Lead / İletişim",
        ayarlar: "Ayarlar / Sistem",
      };

      const resolveAdminSection = () => {
        const hash = (location.hash || "").replace(/^#/, "").toLowerCase();
        return ADMIN_SECTION_IDS.includes(hash) ? hash : "ozet";
      };

      const setAdminSection = (id) => {
        document.querySelectorAll("[data-admin-section]").forEach((el) => {
          el.hidden = el.getAttribute("data-admin-section") !== id;
        });
        document.querySelectorAll("[data-admin-nav]").forEach((btn) => {
          const on = btn.getAttribute("data-admin-nav") === id;
          btn.classList.toggle("admin-nav-active", on);
          btn.setAttribute("aria-current", on ? "page" : "false");
        });
        const titleEl = document.getElementById("admin-section-title");
        if (titleEl) titleEl.textContent = ADMIN_SECTION_LABELS[id] || "Yönetim Paneli";
      };

      const initAdminSectionNav = () => {
        setAdminSection(resolveAdminSection());
        document.getElementById("admin-sidebar")?.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-admin-nav]");
          if (!btn) return;
          const id = btn.getAttribute("data-admin-nav");
          if (!ADMIN_SECTION_IDS.includes(id)) return;
          if (location.hash.replace(/^#/, "") !== id) location.hash = id;
          else setAdminSection(id);
        });
        window.addEventListener("hashchange", () => setAdminSection(resolveAdminSection()));
      };

      initAdminSectionNav();

      const [brandsInit, productsInit, visits] = await Promise.all([
        AG.getAllBrands(),
        AG.getAllProducts(),
        AG.getVisits(),
      ]);
      let brands = brandsInit;
      let products = productsInit;

      const productsByBrand = (id) => products.filter((p) => p.brandId === id).length;

      const visitorSessionKey = (v) => (v.user_id ? `u:${v.user_id}` : `v:${v.visitor_id || "unknown"}`);
      const uniqSessions = new Set(visits.map(visitorSessionKey));

      const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
      const escAttr = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      const btnClass = "px-2.5 py-1 rounded-lg border border-black/15 text-[12px] font-semibold hover:bg-black/[0.04] mr-1 mb-1";

      const setStatText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
      };

      let renderDashboard = () => {};

      document.getElementById("brands-count").textContent = `${brands.length} marka`;
      const brandsTbody = document.getElementById("brands-tbody");

      const brandStatusLabelTr = (s) =>
        ({
          pending: "Onay bekliyor",
          approved: "Onaylı",
          rejected: "Reddedildi",
          suspended: "Askıya alındı",
        }[s] || s);

      const brandStatusBadge = (b) => {
        const st = b.brand_status;
        if (st == null || st === "") {
          return `<span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-black/[0.08] text-[#6e6e73]">Marka kaydı yok</span>`;
        }
        const label = brandStatusLabelTr(st);
        const cls =
          st === "pending"
            ? "bg-amber-500/15 text-amber-950"
            : st === "approved"
              ? "bg-emerald-500/15 text-emerald-950"
              : st === "suspended"
                ? "bg-slate-500/15 text-slate-900"
                : "bg-red-500/12 text-red-900";
        return `<span class="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}">${esc(label)}</span>`;
      };

      const brandActionButtons = (b) => {
        if (!b.brand_record_id) return "—";
        const rid = escAttr(String(b.brand_record_id));
        if (b.brand_status === "pending") {
          return `<button type="button" class="${btnClass}" data-admin-brand-status data-brand-id="${rid}" data-status="approved">Onayla</button>`
            + `<button type="button" class="${btnClass}" data-admin-brand-status data-brand-id="${rid}" data-status="rejected">Reddet</button>`;
        }
        if (b.brand_status === "rejected") {
          return `<button type="button" class="${btnClass}" data-admin-brand-status data-brand-id="${rid}" data-status="approved">Onayla</button>`;
        }
        if (b.brand_status === "approved") {
          return `<button type="button" class="${btnClass}" data-admin-brand-status data-brand-id="${rid}" data-status="suspended">Askıya al</button>`;
        }
        if (b.brand_status === "suspended") {
          return `<button type="button" class="${btnClass}" data-admin-brand-status data-brand-id="${rid}" data-status="approved">Tekrar Onayla</button>`;
        }
        return "—";
      };

      const renderBrandsTable = () => {
        const displayName = (b) => b.brand_name || b.profile_name || b.name || "—";
        brandsTbody.innerHTML = brands.length
          ? brands.map((b) => `
            <tr class="hover:bg-black/[0.02]">
              <td class="px-5 py-3 font-medium">${esc(displayName(b))}</td>
              <td class="px-5 py-3 text-[#3a3a3c]">${esc(b.contact_name)}</td>
              <td class="px-5 py-3">${esc(b.phone)}</td>
              <td class="px-5 py-3 text-[#6e6e73]">${esc(b.primary_category)}</td>
              <td class="px-5 py-3 text-[#3a3a3c]">${esc(b.email)}</td>
              <td class="px-5 py-3">${brandStatusBadge(b)}</td>
              <td class="px-5 py-3">${productsByBrand(b.id)}</td>
              <td class="px-5 py-3 text-[#6e6e73]">${new Date(b.created_at).toLocaleString("tr-TR")}</td>
              <td class="px-5 py-3 whitespace-nowrap">${brandActionButtons(b)}</td>
            </tr>`).join("")
          : `<tr><td colspan="9" class="px-5 py-6 text-[#6e6e73] text-center">Henüz kayıtlı marka yok.</td></tr>`;
      };

      const brandMsgEl = document.getElementById("brand-admin-msg");
      let brandMsgTimer;
      const showBrandMsg = (text, isError) => {
        if (!brandMsgEl) return;
        clearTimeout(brandMsgTimer);
        brandMsgEl.textContent = text;
        brandMsgEl.classList.remove("hidden");
        brandMsgEl.classList.toggle("text-red-600", Boolean(isError));
        brandMsgEl.classList.toggle("text-green-700", !isError);
        brandMsgTimer = setTimeout(() => {
          brandMsgEl.classList.add("hidden");
          brandMsgEl.textContent = "";
        }, 4500);
      };

      brandsTbody.addEventListener("click", async (e) => {
        const btn = e.target.closest("button[data-admin-brand-status]");
        if (!btn) return;
        const id = btn.getAttribute("data-brand-id");
        const nextStatus = btn.getAttribute("data-status");
        if (!id || !nextStatus) return;
        btn.disabled = true;
        try {
          const res = await AG.adminSetBrandStatus(id, nextStatus);
          if (!res?.ok) {
            console.error("adminSetBrandStatus", res?.message);
            showBrandMsg(res?.message || "İşlem başarısız.", true);
            return;
          }
          showBrandMsg("Marka durumu güncellendi.", false);
          brands = await AG.getAllBrands();
          renderBrandsTable();
          renderDashboard();
        } catch (err) {
          console.error(err);
          showBrandMsg(err?.message || "Güncellenemedi.", true);
        } finally {
          btn.disabled = false;
        }
      });

      let productFilter = "all";

      const statusLabelTr = (s) =>
        ({
          draft: "Taslak",
          pending_review: "İncelemede",
          needs_revision: "Revize gerekli",
          published: "Yayında",
          unpublished: "Yayında Değil",
          archived: "Arşiv",
          rejected: "Reddedildi",
        }[s] || s);

      renderDashboard = () => {
        const countStatus = (status) => products.filter((p) => p.status === status).length;
        setStatText("dash-total-products", products.length);
        setStatText("dash-pending-products", countStatus("pending_review"));
        setStatText("dash-published-products", countStatus("published"));
        setStatText("dash-unpublished-products", products.filter((p) => p.status !== "published").length);
        setStatText("dash-pending-brands", brands.filter((b) => b.brand_status === "pending").length);
        setStatText("dash-total-brands", brands.length);
        setStatText("stat-brands", brands.length);
        setStatText("stat-products", countStatus("published"));
        setStatText("stat-visits", visits.length);
        setStatText("stat-uniq", uniqSessions.size);

        const recentTbody = document.getElementById("dash-recent-products-tbody");
        if (recentTbody) {
          const recent = [...products]
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 8);
          recentTbody.innerHTML = recent.length
            ? recent.map((p) => {
              const created = p.createdAt ? new Date(p.createdAt).toLocaleString("tr-TR") : "—";
              return `<tr class="hover:bg-black/[0.02]">
                <td class="px-5 py-3 font-medium">${esc(p.name || "—")}</td>
                <td class="px-5 py-3 text-[#3a3a3c]">${esc(p.brandName || "—")}</td>
                <td class="px-5 py-3">${esc(statusLabelTr(p.status))}</td>
                <td class="px-5 py-3 text-[#6e6e73] whitespace-nowrap">${esc(created)}</td>
              </tr>`;
            }).join("")
            : `<tr><td colspan="4" class="px-5 py-8 text-[#6e6e73] text-center">Henüz ürün yok.</td></tr>`;
        }
      };

      const syncProductFilterButtons = () => {
        document.querySelectorAll(".product-status-filter").forEach((b) => {
          const on = b.getAttribute("data-product-filter") === productFilter;
          b.classList.toggle("bg-black", on);
          b.classList.toggle("text-white", on);
          b.classList.toggle("bg-white", !on);
          b.classList.toggle("hover:bg-black/[0.04]", !on);
        });
      };

      const renderProductQueue = (list) => {
        const tbody = document.getElementById("product-approval-queue-tbody");
        if (!tbody) return;
        const rows = (list || [])
          .filter((p) => (productFilter === "all" ? true : p.status === productFilter))
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        const actions = (p) => {
          const id = String(p.id);
          if (p.status === "pending_review") {
            return `<button type="button" class="${btnClass}" data-admin-product-status data-id="${id}" data-status="published">Yayına Al</button>`
              + `<button type="button" class="${btnClass}" data-admin-product-status data-id="${id}" data-status="needs_revision">Revize İste</button>`;
          }
          if (p.status === "needs_revision") {
            return `<button type="button" class="${btnClass}" data-admin-product-status data-id="${id}" data-status="published">Yayına Al</button>`
              + `<button type="button" class="${btnClass}" data-admin-product-status data-id="${id}" data-status="pending_review">İncelemeye Al</button>`;
          }
          if (p.status === "published") {
            return `<button type="button" class="${btnClass}" data-admin-product-status data-id="${id}" data-status="archived">Arşivle</button>`;
          }
          if (p.status === "archived") {
            return `<button type="button" class="${btnClass}" data-admin-product-status data-action="unarchive_to_review" data-id="${id}" data-status="pending_review">İncelemeye Al</button>`;
          }
          if (p.status === "draft") {
            return `<button type="button" class="${btnClass}" data-admin-product-status data-id="${id}" data-status="pending_review">İncelemeye Al</button>`;
          }
          if (p.status === "rejected") {
            return `<button type="button" class="${btnClass}" data-admin-product-status data-id="${id}" data-status="pending_review">İncelemeye Al</button>`;
          }
          return "—";
        };
        tbody.innerHTML = rows.length
          ? rows.map((p) => {
            const slug = p.slug && String(p.slug).trim();
            const detail = slug
              ? `<a href="/urunler/${encodeURIComponent(slug)}" target="_blank" rel="noopener noreferrer" class="text-[13px] font-semibold text-black underline underline-offset-2">Katalog</a>`
              : "—";
            const created = p.createdAt ? new Date(p.createdAt).toLocaleString("tr-TR") : "—";
            return `<tr class="hover:bg-black/[0.02]">
              <td class="px-5 py-3 font-medium">${esc(p.name || "—")}</td>
              <td class="px-5 py-3 text-[#3a3a3c]">${esc(p.brandName || "—")}</td>
              <td class="px-5 py-3 text-[#6e6e73]">${esc(p.category || "—")}</td>
              <td class="px-5 py-3">${esc(statusLabelTr(p.status))}</td>
              <td class="px-5 py-3 text-[#6e6e73] whitespace-nowrap">${esc(created)}</td>
              <td class="px-5 py-3">${detail}</td>
              <td class="px-5 py-3">${actions(p)}</td>
            </tr>`;
          }).join("")
          : `<tr><td colspan="7" class="px-5 py-8 text-[#6e6e73] text-center">Bu filtrede ürün yok.</td></tr>`;
        syncProductFilterButtons();
      };

      const queueMsgEl = document.getElementById("admin-queue-msg");
      let queueMsgTimer;
      const showQueueMsg = (text, isError) => {
        if (!queueMsgEl) return;
        clearTimeout(queueMsgTimer);
        queueMsgEl.textContent = text;
        queueMsgEl.classList.remove("hidden");
        queueMsgEl.classList.toggle("text-red-600", Boolean(isError));
        queueMsgEl.classList.toggle("text-green-700", !isError);
        queueMsgTimer = setTimeout(() => {
          queueMsgEl.classList.add("hidden");
          queueMsgEl.textContent = "";
        }, 4500);
      };

      document.getElementById("product-approval-section")?.addEventListener("click", async (e) => {
        const filterBtn = e.target.closest("button[data-product-filter]");
        if (filterBtn) {
          productFilter = filterBtn.getAttribute("data-product-filter") || "all";
          renderProductQueue(products);
          return;
        }
        const btn = e.target.closest("button[data-admin-product-status]");
        if (!btn) return;
        const id = btn.getAttribute("data-id");
        const nextStatus = btn.getAttribute("data-status");
        if (!id || !nextStatus) return;
        btn.disabled = true;
        try {
          await AG.adminSetProductStatus(id, nextStatus);
          const unarchive = btn.getAttribute("data-action") === "unarchive_to_review";
          showQueueMsg(
            unarchive
              ? "Ürün inceleme kuyruğuna alındı. Yayına almak için İnceleme Bekleyen filtresinden onaylayın."
              : "Ürün durumu güncellendi.",
            false,
          );
          products = await AG.getAllProducts();
          renderBrandsTable();
          renderProductQueue(products);
          renderDashboard();
        } catch (err) {
          console.error(err);
          showQueueMsg(err?.message || "Güncellenemedi.", true);
        } finally {
          btn.disabled = false;
        }
      });

      renderBrandsTable();
      renderProductQueue(products);
      renderDashboard();

      const visitTs = (v) => Number(v.ts) || new Date(v.created_at).getTime();

      const groupVisits = (list) => {
        const m = new Map();
        for (const v of list) {
          const key = visitorSessionKey(v);
          if (!m.has(key)) m.set(key, []);
          m.get(key).push(v);
        }
        const rows = [];
        for (const [key, arr] of m) {
          const sorted = [...arr].sort((a, b) => visitTs(b) - visitTs(a));
          const latest = sorted[0];
          const kind = (latest.visitor_kind || "anonymous").toLowerCase();
          const anonLabel = `Ziyaretçi (${String(latest.visitor_id || "").slice(0, 10)}…)`;
          const name = (kind === "anonymous" || !latest.display_name)
            ? anonLabel
            : String(latest.display_name).trim() || anonLabel;
          const loc = [latest.city, latest.country].filter(Boolean).join(", ") || "—";
          rows.push({
            key,
            kind,
            name: esc(name),
            loc: esc(loc),
            lastPage: esc(latest.page || "—"),
            count: sorted.length,
            lastAt: visitTs(latest),
            visits: sorted,
            rawName: name,
          });
        }
        rows.sort((a, b) => b.lastAt - a.lastAt);
        return rows;
      };

      const kindMatchesFilter = (kind, filter) => {
        if (filter === "all") return true;
        if (filter === "architect") return kind === "architect";
        if (filter === "brand") return kind === "brand" || kind === "member";
        if (filter === "anonymous") return kind === "anonymous" || !kind;
        return true;
      };

      let visitFilter = "all";
      const visitGroupsTbody = document.getElementById("visit-groups-tbody");
      const modal = document.getElementById("visit-detail-modal");
      const modalTitle = document.getElementById("visit-detail-title");
      const modalSub = document.getElementById("visit-detail-sub");
      const modalTbody = document.getElementById("visit-detail-tbody");

      const renderVisitGroups = () => {
        const filtered = visits.filter((v) => kindMatchesFilter((v.visitor_kind || "anonymous").toLowerCase(), visitFilter));
        const groups = groupVisits(filtered);
        visitGroupsTbody.innerHTML = groups.length
          ? groups.map((g) => `
              <tr class="hover:bg-black/[0.02]">
                <td class="px-5 py-3 font-medium">${g.name}</td>
                <td class="px-5 py-3 text-[#3a3a3c]">${g.loc}</td>
                <td class="px-5 py-3">${g.lastPage}</td>
                <td class="px-5 py-3">${g.count}</td>
                <td class="px-5 py-3 text-[#6e6e73]">${new Date(g.lastAt).toLocaleString("tr-TR")}</td>
                <td class="px-5 py-3">
                  <button type="button" class="visit-detail-btn text-[13px] font-semibold text-black underline underline-offset-2" data-key="${encodeURIComponent(g.key)}">Detay</button>
                </td>
              </tr>`).join("")
          : `<tr><td colspan="6" class="px-5 py-8 text-[#6e6e73] text-center">Bu filtrede kayıt yok.</td></tr>`;

        visitGroupsTbody.querySelectorAll(".visit-detail-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            const key = decodeURIComponent(btn.getAttribute("data-key") || "");
            const g = groups.find((x) => x.key === key);
            if (!g) return;
            modalTitle.textContent = g.rawName;
            const kinds = [...new Set(g.visits.map((x) => x.visitor_kind || "anonymous"))];
            modalSub.textContent = `${g.count} kayıt · ${kinds.join(", ")}`;
            const chron = [...g.visits].sort((a, b) => visitTs(a) - visitTs(b));
            modalTbody.innerHTML = chron.map((v) => {
              const t = visitTs(v);
              const loc = [v.city, v.country].filter(Boolean).join(", ") || "—";
              return `<tr class="border-b border-black/5">
                <td class="py-2.5 pr-3">${esc(v.page || "—")}</td>
                <td class="py-2.5 pr-3 text-[#6e6e73] whitespace-nowrap">${new Date(t).toLocaleString("tr-TR")}</td>
                <td class="py-2.5 text-[#6e6e73]">${esc(loc)}</td>
              </tr>`;
            }).join("");
            modal.classList.remove("hidden");
            modal.classList.add("flex");
            modal.setAttribute("aria-hidden", "false");
          });
        });
      };

      document.querySelectorAll(".visit-filter").forEach((btn) => {
        btn.addEventListener("click", () => {
          visitFilter = btn.getAttribute("data-filter") || "all";
          document.querySelectorAll(".visit-filter").forEach((b) => {
            const on = b.getAttribute("data-filter") === visitFilter;
            b.classList.toggle("bg-black", on);
            b.classList.toggle("text-white", on);
            b.classList.toggle("bg-white", !on);
          });
          renderVisitGroups();
        });
      });

      document.getElementById("visit-detail-close").addEventListener("click", () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
        modal.setAttribute("aria-hidden", "true");
      });
      modal.addEventListener("click", (e) => { if (e.target === modal) document.getElementById("visit-detail-close").click(); });

      renderVisitGroups();

      const L1_ORDER = [
        "zemin-yuzey",
        "yapi-cephe",
        "ic-mekan-mobilya",
        "mutfak-banyo",
        "teknik-sistemler",
        "dis-mekan-peyzaj",
      ];
      const catVisRoot = document.getElementById("category-visibility-root");
      const catVisMsg = document.getElementById("category-visibility-msg");
      let catVisMsgTimer = null;
      let catSearchQuery = "";
      let catFilterType = "all";

      const showCatVisMsg = (text, isError = false) => {
        if (!catVisMsg) return;
        clearTimeout(catVisMsgTimer);
        catVisMsg.textContent = text;
        catVisMsg.classList.remove("hidden");
        catVisMsg.classList.toggle("text-red-600", isError);
        catVisMsg.classList.toggle("text-green-700", !isError);
        catVisMsgTimer = setTimeout(() => {
          catVisMsg.classList.add("hidden");
          catVisMsg.textContent = "";
        }, 4500);
      };

      const DB_SEED_MISSING_MSG = "DB seed eksik olduğu için bu kategori güncellenemiyor.";

      const catToggle = (table, dbId, field, label, checked) => {
        const hasDbId = Boolean(dbId);
        return `<label class="cat-vis-toggle-wrap inline-flex items-center gap-1.5 text-[11px] text-[#333] shrink-0" data-cat-toggle-wrap="1">
          <input type="checkbox" class="cat-vis-toggle rounded border-black/20" data-cat-table="${table}" data-cat-id="${escAttr(dbId || "")}" data-cat-field="${field}" ${checked ? "checked" : ""} ${hasDbId ? "" : "disabled"} title="${hasDbId ? "" : escAttr(DB_SEED_MISSING_MSG)}">
          <span>${label}</span>
        </label>`;
      };

      const customBadge = (node) =>
        node?.is_custom === true
          ? '<span class="ml-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[#0071e3]/10 text-[#0071e3]">Özel</span>'
          : "";

      const archivedBadge = (node) =>
        node?.is_archived || node?.archived_at
          ? '<span class="ml-1 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-amber-100 text-amber-900">Arşivli</span>'
          : "";

      const isCustomNode = (node) => node?.is_custom === true || node?.source === "admin";
      const isArchivedNode = (node) =>
        node?.is_archived === true || (node?.archived_at != null && node?.archived_at !== "");

      const normalizeCategorySearchText = (value) =>
        String(value || "")
          .trim()
          .toLocaleLowerCase("tr")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/ı/g, "i")
          .replace(/ğ/g, "g")
          .replace(/ü/g, "u")
          .replace(/ş/g, "s")
          .replace(/ö/g, "o")
          .replace(/ç/g, "c");

      const nodeMatchesCategorySearch = (node, level, queryNorm) => {
        if (!queryNorm || !node) return false;
        const fields = [];
        if (level === 1 || level === 2 || level === 3) {
          fields.push(node.name_tr, node.slug);
        }
        return fields
          .map((f) => normalizeCategorySearchText(f))
          .filter(Boolean)
          .some((f) => f.includes(queryNorm));
      };

      const passesCategoryTypeFilter = (node, filterType) => {
        switch (filterType) {
          case "active":
            return !isArchivedNode(node);
          case "archived":
            return isArchivedNode(node);
          case "custom":
            return isCustomNode(node);
          case "system":
            return !isCustomNode(node);
          case "all":
          default:
            return true;
        }
      };

      const filterAdminTaxonomyTree = (tree, queryRaw, filterType) => {
        const queryNorm = normalizeCategorySearchText(queryRaw);
        const bySlug = Object.fromEntries((tree || []).map((l1) => [l1.slug, l1]));
        const result = [];

        for (const l1Slug of L1_ORDER) {
          const l1 = bySlug[l1Slug];
          if (!l1) continue;

          const l1SearchMatch = queryNorm ? nodeMatchesCategorySearch(l1, 1, queryNorm) : false;
          const l2Out = [];

          for (const l2 of (l1.children || []).filter((n) => n.level === 2)) {
            const l2TypePass = passesCategoryTypeFilter(l2, filterType);
            const l2SearchMatch = queryNorm ? nodeMatchesCategorySearch(l2, 2, queryNorm) : false;

            const l3TypePassing = (l2.children || [])
              .filter((n) => n.level === 3)
              .filter((l3) => passesCategoryTypeFilter(l3, filterType));

            let l3Visible = l3TypePassing;
            if (queryNorm) {
              if (l1SearchMatch || l2SearchMatch) {
                l3Visible = l3TypePassing;
              } else {
                l3Visible = l3TypePassing.filter((l3) => nodeMatchesCategorySearch(l3, 3, queryNorm));
              }
            }

            if (!queryNorm) {
              if (l2TypePass || l3Visible.length > 0) {
                l2Out.push({ ...l2, children: l3Visible });
              }
              continue;
            }

            const showL2 = l1SearchMatch || l2SearchMatch || l3Visible.length > 0;
            if (!showL2) continue;

            if (l2TypePass || l3Visible.length > 0) {
              l2Out.push({ ...l2, children: l3Visible });
            }
          }

          if (l2Out.length > 0) {
            result.push({ ...l1, children: l2Out });
          }
        }

        return result;
      };

      const categoryActionBtns = (table, node) => {
        if (!node?.db_id) return "";
        const id = escAttr(node.db_id);
        const archived = isArchivedNode(node);
        const custom = isCustomNode(node);
        const parts = [];
        if (archived) {
          parts.push(
            `<button type="button" class="${btnClass} text-[11px] py-0.5" data-cat-custom-action="restore" data-cat-table="${table}" data-cat-id="${id}">Arşivden Çıkar</button>`,
          );
        } else {
          parts.push(
            `<button type="button" class="${btnClass} text-[11px] py-0.5" data-cat-custom-action="archive" data-cat-table="${table}" data-cat-id="${id}">Arşivle</button>`,
          );
        }
        if (custom) {
          parts.push(
            `<button type="button" class="${btnClass} text-[11px] py-0.5 text-red-700 border-red-200 hover:bg-red-50" data-cat-custom-action="delete" data-cat-table="${table}" data-cat-id="${id}">Kalıcı Sil</button>`,
          );
        }
        return `<span class="inline-flex flex-wrap gap-1 ml-1">${parts.join("")}</span>`;
      };

      const renderL3Row = (l3) => {
        const subInactive = l3.is_active === false || isArchivedNode(l3);
        return `<div class="cat-vis-l3 flex flex-wrap items-center justify-between gap-2 py-2 border-t border-black/[0.06] first:border-t-0 ${subInactive ? "opacity-60" : ""}">
          <p class="text-[12px] font-medium text-[#1d1d1f] min-w-0">${esc(l3.name_tr)}${customBadge(l3)}${archivedBadge(l3)}${categoryActionBtns("subcategory", l3)} <span class="text-[#6e6e73] font-normal">(${esc(l3.slug)})</span></p>
          <div class="flex flex-wrap gap-1 justify-end">
            ${catToggle("subcategory", l3.db_id, "is_active", "Aktif", l3.is_active !== false)}
            ${catToggle("subcategory", l3.db_id, "show_in_products_filter", "Filtre", l3.show_in_products_filter !== false)}
            ${catToggle("subcategory", l3.db_id, "show_in_brand_product_form", "Marka form", l3.show_in_brand_product_form !== false)}
          </div>
        </div>`;
      };

      const renderL2Block = (l2) => {
        const inactive = l2.is_active === false || isArchivedNode(l2);
        const l3Nodes = (l2.children || []).filter((n) => n.level === 3);
        const subs = l3Nodes.map(renderL3Row).join("");
        return `<div class="rounded-xl border border-black/10 p-4 ${inactive ? "opacity-70 bg-black/[0.02]" : "bg-white"}">
          <p class="text-[14px] font-semibold">${esc(l2.name_tr)}${customBadge(l2)}${archivedBadge(l2)}${categoryActionBtns("category", l2)} <span class="text-[#6e6e73] font-normal text-[12px]">(${esc(l2.slug)})</span></p>
          <div class="flex flex-wrap gap-1 mt-2">
            ${catToggle("category", l2.db_id, "is_active", "Aktif", l2.is_active !== false)}
            ${catToggle("category", l2.db_id, "show_in_header_dropdown", "Header dropdown", l2.show_in_header_dropdown !== false)}
            ${catToggle("category", l2.db_id, "show_in_products_filter", "Ürün filtreleri", l2.show_in_products_filter !== false)}
            ${catToggle("category", l2.db_id, "show_in_brand_product_form", "Marka ürün formu", l2.show_in_brand_product_form !== false)}
          </div>
          ${subs ? `<div class="mt-3 space-y-1">${subs}</div>` : ""}
        </div>`;
      };

      function wireCategoryVisibilityAccordion(root) {
        const container =
          root ||
          document.querySelector("[data-category-visibility-root]") ||
          document.getElementById("category-visibility-root");
        if (!container) return;

        const setAccordionOpen = (btn, panel, open) => {
          if (!btn || !panel) return;
          btn.setAttribute("aria-expanded", open ? "true" : "false");
          panel.hidden = !open;
        };

        container.addEventListener("click", (event) => {
          const toggle = event.target.closest("[data-cat-accordion-toggle]");
          if (!toggle || !container.contains(toggle)) return;
          if (event.target.closest("input, label, .cat-vis-toggle, .cat-vis-toggle-wrap")) return;

          const panelId = toggle.getAttribute("aria-controls");
          const panel = panelId ? document.getElementById(panelId) : null;
          const expanded = toggle.getAttribute("aria-expanded") === "true";
          setAccordionOpen(toggle, panel, !expanded);
        });

        container.querySelectorAll("[data-cat-accordion-toggle]").forEach((btn) => {
          const panelId = btn.getAttribute("aria-controls");
          const panel = panelId ? document.getElementById(panelId) : null;
          if (!panel) return;
          const expanded = btn.getAttribute("aria-expanded") === "true";
          setAccordionOpen(btn, panel, expanded);
        });
      }

      const renderCategoryVisibilityAdmin = (tree) => {
        const bySlug = Object.fromEntries((tree || []).map((l1) => [l1.slug, l1]));
        let html = "";
        for (const l1Slug of L1_ORDER) {
          const l1 = bySlug[l1Slug];
          if (!l1) continue;
          const l2Blocks = (l1.children || [])
            .filter((n) => n.level === 2)
            .map((l2) => renderL2Block(l2))
            .join("");
          if (!l2Blocks) continue;
          html += `<div class="rounded-2xl border border-black/10 overflow-hidden">
            <div class="px-5 py-3 bg-black/[0.03] border-b border-black/10">
              <h3 class="text-[16px] font-semibold">${esc(l1.name_tr)}</h3>
            </div>
            <div class="p-4 space-y-4 bg-white">${l2Blocks}</div>
          </div>`;
        }
        return html;
      };

      let adminTaxonomyTreeCache = [];

      const ensureAdminTaxonomyTree = async () => {
        const getMergedTaxonomyTree = await waitForAGFunction("getMergedTaxonomyTree");
        adminTaxonomyTreeCache = await getMergedTaxonomyTree({ surface: "admin" });
        return adminTaxonomyTreeCache;
      };

      const applyCategoryView = () => {
        if (!catVisRoot) return;
        const filtered = filterAdminTaxonomyTree(
          adminTaxonomyTreeCache,
          catSearchQuery,
          catFilterType,
        );
        const hasActiveFilter =
          Boolean(String(catSearchQuery || "").trim()) || catFilterType !== "all";
        const html = renderCategoryVisibilityAdmin(filtered);
        if (!html) {
          catVisRoot.innerHTML = hasActiveFilter
            ? '<p class="text-[13px] text-[#6e6e73]">Bu filtreyle eşleşen kategori bulunamadı.</p>'
            : '<p class="text-[13px] text-[#6e6e73]">Kategori bulunamadı.</p>';
          return;
        }
        catVisRoot.innerHTML = html;
        wireCategoryVisibilityAccordion(catVisRoot);
      };

      const initCategoryFilterBar = () => {
        const catSection = document.getElementById("category-visibility-section");
        if (!catVisRoot || !catSection || document.getElementById("category-filter-bar")) return;

        const bar = document.createElement("div");
        bar.id = "category-filter-bar";
        bar.className =
          "mt-4 flex flex-col gap-3 rounded-xl border border-black/10 bg-[#fafafa] px-4 py-3";
        bar.innerHTML = `
          <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
            <label class="flex-1 min-w-[200px] max-w-md">
              <span class="sr-only">Kategori ara</span>
              <input type="search" id="category-search-input" class="w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-[13px]" placeholder="Kategori ara…" autocomplete="off" value="${escAttr(catSearchQuery)}">
            </label>
            <div class="flex flex-wrap gap-1.5" role="group" aria-label="Kategori filtresi" id="category-filter-buttons">
              <button type="button" class="cat-filter-btn px-3 py-1.5 rounded-full text-[12px] font-semibold border border-black/15 bg-white" data-cat-filter="all">Tümü</button>
              <button type="button" class="cat-filter-btn px-3 py-1.5 rounded-full text-[12px] font-semibold border border-black/15 bg-white" data-cat-filter="active">Aktifler</button>
              <button type="button" class="cat-filter-btn px-3 py-1.5 rounded-full text-[12px] font-semibold border border-black/15 bg-white" data-cat-filter="archived">Arşivliler</button>
              <button type="button" class="cat-filter-btn px-3 py-1.5 rounded-full text-[12px] font-semibold border border-black/15 bg-white" data-cat-filter="custom">Özel kategoriler</button>
              <button type="button" class="cat-filter-btn px-3 py-1.5 rounded-full text-[12px] font-semibold border border-black/15 bg-white" data-cat-filter="system">Sistem kategorileri</button>
            </div>
          </div>
        `;

        catVisRoot.parentNode?.insertBefore(bar, catVisRoot);

        const syncFilterButtonStyles = () => {
          bar.querySelectorAll("[data-cat-filter]").forEach((btn) => {
            const on = btn.getAttribute("data-cat-filter") === catFilterType;
            btn.classList.toggle("bg-black", on);
            btn.classList.toggle("text-white", on);
            btn.classList.toggle("border-black", on);
            btn.classList.toggle("bg-white", !on);
            btn.setAttribute("aria-pressed", on ? "true" : "false");
          });
        };

        const searchInput = bar.querySelector("#category-search-input");
        let searchDebounce = null;
        searchInput?.addEventListener("input", () => {
          clearTimeout(searchDebounce);
          searchDebounce = setTimeout(() => {
            catSearchQuery = searchInput.value;
            applyCategoryView();
          }, 150);
        });
        searchInput?.addEventListener("keydown", (e) => {
          if (e.key === "Escape") {
            searchInput.value = "";
            catSearchQuery = "";
            applyCategoryView();
          }
        });

        bar.querySelector("#category-filter-buttons")?.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-cat-filter]");
          if (!btn) return;
          catFilterType = btn.getAttribute("data-cat-filter") || "all";
          syncFilterButtonStyles();
          applyCategoryView();
        });

        syncFilterButtonStyles();
      };

      const initCategoryCreateForms = () => {
        const catSection = document.getElementById("category-visibility-section");
        const headerRow = catSection?.querySelector(".flex.flex-col");
        if (!headerRow || document.getElementById("category-create-toolbar")) return;

        const toolbar = document.createElement("div");
        toolbar.id = "category-create-toolbar";
        toolbar.className = "flex flex-wrap gap-2 shrink-0";
        toolbar.innerHTML = `
          <button type="button" id="btn-new-l2" class="${btnClass} bg-[#0071e3] text-white border-[#0071e3] hover:bg-[#0077ed]">Yeni L2 Ekle</button>
          <button type="button" id="btn-new-l3" class="${btnClass}">Yeni L3 Ekle</button>
        `;
        headerRow.appendChild(toolbar);

        const panel = document.createElement("div");
        panel.id = "category-create-panel";
        panel.className = "hidden mt-4 rounded-2xl border border-black/10 bg-[#fafafa] p-5";
        if (catVisMsg) catSection.insertBefore(panel, catVisMsg);
        else catSection?.appendChild(panel);

        const fieldClass = "w-full rounded-lg border border-black/15 px-3 py-2 text-[13px]";
        const labelClass = "block text-[12px] font-semibold text-[#333] mb-1";

        const slugifyName = (value) => {
          if (typeof AG.slugifyAdminCategory === "function") return AG.slugifyAdminCategory(value);
          return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/&/g, " ve ")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        };

        const l1OptionsHtml = (selected = "") =>
          L1_ORDER.map((slug) => {
            const l1 = adminTaxonomyTreeCache.find((n) => n.slug === slug);
            const label = l1?.name_tr || slug;
            const sel = slug === selected ? " selected" : "";
            return `<option value="${escAttr(slug)}"${sel}>${esc(label)}</option>`;
          }).join("");

        const l2OptionsForL1 = (l1Slug, selectedDbId = "") => {
          const l1 = adminTaxonomyTreeCache.find((n) => n.slug === l1Slug);
          let html = '<option value="">L2 seçin</option>';
          for (const l2 of l1?.children || []) {
            if (l2.level !== 2) continue;
            const hasDb = Boolean(l2.db_id);
            const sel = String(l2.db_id) === String(selectedDbId) ? " selected" : "";
            const note = hasDb ? "" : " (DB seed eksik)";
            html += `<option value="${escAttr(l2.db_id || "")}"${sel}${hasDb ? "" : " disabled"}>${esc(l2.name_tr)}${esc(note)}</option>`;
          }
          return html;
        };

        const wireSlugAuto = (form) => {
          const nameInput = form.querySelector('[name="name"]');
          const slugInput = form.querySelector('[name="slug"]');
          if (!nameInput || !slugInput) return;
          let slugTouched = false;
          slugInput.addEventListener("input", () => {
            slugTouched = true;
          });
          nameInput.addEventListener("input", () => {
            if (slugTouched) return;
            slugInput.value = slugifyName(nameInput.value);
          });
        };

        const renderL2Form = () => {
          panel.innerHTML = `
            <h3 class="text-[15px] font-semibold mb-4">Yeni L2 Kategori</h3>
            <form id="form-create-l2" class="grid gap-3 sm:grid-cols-2">
              <label class="sm:col-span-2"><span class="${labelClass}">L1</span>
                <select name="l1_slug" required class="${fieldClass}">${l1OptionsHtml()}</select>
              </label>
              <label><span class="${labelClass}">Kategori adı</span>
                <input name="name" required class="${fieldClass}" autocomplete="off">
              </label>
              <label><span class="${labelClass}">Slug</span>
                <input name="slug" class="${fieldClass}" autocomplete="off" placeholder="otomatik üretilir">
              </label>
              <label><span class="${labelClass}">Sıra (sort_order)</span>
                <input name="sort_order" type="number" value="9999" class="${fieldClass}">
              </label>
              <div class="sm:col-span-2 flex flex-wrap gap-3 text-[12px]">
                <label class="inline-flex items-center gap-1.5"><input type="checkbox" name="is_active" checked> Aktif</label>
                <label class="inline-flex items-center gap-1.5"><input type="checkbox" name="show_in_header_dropdown" checked> Header dropdown</label>
                <label class="inline-flex items-center gap-1.5"><input type="checkbox" name="show_in_products_filter" checked> Ürün filtreleri</label>
                <label class="inline-flex items-center gap-1.5"><input type="checkbox" name="show_in_brand_product_form" checked> Marka formu</label>
              </div>
              <div class="sm:col-span-2 flex gap-2 pt-1">
                <button type="submit" class="px-4 py-2 rounded-lg bg-[#0071e3] text-white text-[13px] font-semibold hover:bg-[#0077ed]">Kaydet</button>
                <button type="button" data-cancel-create class="px-4 py-2 rounded-lg border border-black/15 text-[13px] font-semibold hover:bg-black/[0.04]">İptal</button>
              </div>
            </form>
          `;
          wireSlugAuto(panel.querySelector("#form-create-l2"));
        };

        const renderL3Form = (prefillL1 = L1_ORDER[1] || "") => {
          panel.innerHTML = `
            <h3 class="text-[15px] font-semibold mb-4">Yeni L3 Kategori</h3>
            <form id="form-create-l3" class="grid gap-3 sm:grid-cols-2">
              <label><span class="${labelClass}">L1</span>
                <select name="l1_slug" required class="${fieldClass}" id="create-l3-l1">${l1OptionsHtml(prefillL1)}</select>
              </label>
              <label><span class="${labelClass}">L2</span>
                <select name="category_id" required class="${fieldClass}" id="create-l3-l2">${l2OptionsForL1(prefillL1)}</select>
              </label>
              <label><span class="${labelClass}">Kategori adı</span>
                <input name="name" required class="${fieldClass}" autocomplete="off">
              </label>
              <label><span class="${labelClass}">Slug</span>
                <input name="slug" class="${fieldClass}" autocomplete="off" placeholder="otomatik üretilir">
              </label>
              <label><span class="${labelClass}">Sıra (sort_order)</span>
                <input name="sort_order" type="number" value="9999" class="${fieldClass}">
              </label>
              <div class="sm:col-span-2 flex flex-wrap gap-3 text-[12px]">
                <label class="inline-flex items-center gap-1.5"><input type="checkbox" name="is_active" checked> Aktif</label>
                <label class="inline-flex items-center gap-1.5"><input type="checkbox" name="show_in_products_filter" checked> Ürün filtreleri</label>
                <label class="inline-flex items-center gap-1.5"><input type="checkbox" name="show_in_brand_product_form" checked> Marka formu</label>
              </div>
              <div class="sm:col-span-2 flex gap-2 pt-1">
                <button type="submit" class="px-4 py-2 rounded-lg bg-[#0071e3] text-white text-[13px] font-semibold hover:bg-[#0077ed]">Kaydet</button>
                <button type="button" data-cancel-create class="px-4 py-2 rounded-lg border border-black/15 text-[13px] font-semibold hover:bg-black/[0.04]">İptal</button>
              </div>
            </form>
          `;
          const form = panel.querySelector("#form-create-l3");
          wireSlugAuto(form);
          const l1Sel = form.querySelector('[name="l1_slug"]');
          const l2Sel = form.querySelector('[name="category_id"]');
          l1Sel?.addEventListener("change", () => {
            l2Sel.innerHTML = l2OptionsForL1(l1Sel.value);
          });
        };

        const closePanel = () => {
          panel.classList.add("hidden");
          panel.innerHTML = "";
        };

        toolbar.querySelector("#btn-new-l2")?.addEventListener("click", async () => {
          try {
            await ensureAdminTaxonomyTree();
            panel.classList.remove("hidden");
            renderL2Form();
          } catch (err) {
            showCatVisMsg(err?.message || "Kategori ağacı yüklenemedi.", true);
          }
        });

        toolbar.querySelector("#btn-new-l3")?.addEventListener("click", async () => {
          try {
            await ensureAdminTaxonomyTree();
            panel.classList.remove("hidden");
            renderL3Form();
          } catch (err) {
            showCatVisMsg(err?.message || "Kategori ağacı yüklenemedi.", true);
          }
        });

        panel.addEventListener("click", (e) => {
          if (e.target.closest("[data-cancel-create]")) closePanel();
        });

        panel.addEventListener("submit", async (e) => {
          const form = e.target.closest("#form-create-l2, #form-create-l3");
          if (!form) return;
          e.preventDefault();
          const submitBtn = form.querySelector('[type="submit"]');
          if (submitBtn) submitBtn.disabled = true;
          try {
            const fd = new FormData(form);
            if (form.id === "form-create-l2") {
              const l1_slug = fd.get("l1_slug")?.toString().trim() || "";
              const l1 = adminTaxonomyTreeCache.find((n) => n.slug === l1_slug);
              await AG.createProductCategory({
                l1_slug,
                l1_name: l1?.name_tr || l1_slug,
                name: fd.get("name")?.toString().trim() || "",
                slug: fd.get("slug")?.toString().trim() || "",
                is_active: fd.get("is_active") === "on",
                show_in_header_dropdown: fd.get("show_in_header_dropdown") === "on",
                show_in_products_filter: fd.get("show_in_products_filter") === "on",
                show_in_brand_product_form: fd.get("show_in_brand_product_form") === "on",
                sort_order: fd.get("sort_order")?.toString().trim() || "9999",
              });
              showCatVisMsg("L2 kategori oluşturuldu.", false);
            } else {
              const category_id = fd.get("category_id")?.toString().trim() || "";
              if (!category_id) throw new Error("L2 seçimi zorunlu (DB seed eksik L2 seçilemez).");
              await AG.createProductSubcategory({
                category_id,
                name: fd.get("name")?.toString().trim() || "",
                slug: fd.get("slug")?.toString().trim() || "",
                is_active: fd.get("is_active") === "on",
                show_in_products_filter: fd.get("show_in_products_filter") === "on",
                show_in_brand_product_form: fd.get("show_in_brand_product_form") === "on",
                sort_order: fd.get("sort_order")?.toString().trim() || "9999",
              });
              showCatVisMsg("L3 kategori oluşturuldu.", false);
            }
            closePanel();
            await loadCategoryVisibilityAdmin();
          } catch (err) {
            console.error(err);
            showCatVisMsg(err?.message || "Kayıt başarısız.", true);
          } finally {
            if (submitBtn) submitBtn.disabled = false;
          }
        });
      };

      initCategoryFilterBar();
      initCategoryCreateForms();

      const loadCategoryVisibilityAdmin = async () => {
        if (!catVisRoot) return;
        try {
          await ensureAdminTaxonomyTree();
          const searchInput = document.getElementById("category-search-input");
          if (searchInput) catSearchQuery = searchInput.value;
          applyCategoryView();
        } catch (err) {
          console.error(err);
          const msg = String(err?.message || err || "");
          if (/column|does not exist|42703/i.test(msg)) {
            catVisRoot.innerHTML =
              '<p class="text-[13px] text-red-600">Veritabanında görünürlük kolonları bulunamadı. Migration uygulanmadan devam edilemez.</p>';
          } else {
            catVisRoot.innerHTML =
              '<p class="text-[13px] text-red-600">Admin kategori servisi yüklenemedi. Konsolu kontrol edin.</p>';
          }
        }
      };

      catVisRoot?.addEventListener("click", async (e) => {
        const actionBtn = e.target.closest("[data-cat-custom-action]");
        if (!actionBtn || !catVisRoot?.contains(actionBtn)) return;
        if (e.target.closest("input, label, .cat-vis-toggle, .cat-vis-toggle-wrap")) return;

        const action = actionBtn.getAttribute("data-cat-custom-action");
        const table = actionBtn.getAttribute("data-cat-table");
        const id = actionBtn.getAttribute("data-cat-id");
        if (!action || !table || !id) return;

        const confirmMsgs = {
          archive: "Bu kategori arşivlenecek ve public alanda görünmeyecek. Devam edilsin mi?",
          restore: "Bu kategori tekrar aktif edilecek. Devam edilsin mi?",
          delete:
            "Bu özel kategori kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?",
        };
        const confirmMsg = confirmMsgs[action];
        if (!confirmMsg || !window.confirm(confirmMsg)) return;

        actionBtn.disabled = true;
        try {
          if (action === "archive") {
            if (table === "category") await AG.archiveProductCategory(id);
            else if (table === "subcategory") await AG.archiveProductSubcategory(id);
            else throw new Error("Geçersiz tablo.");
            showCatVisMsg("Kategori arşivlendi.", false);
          } else if (action === "restore") {
            if (table === "category") await AG.restoreProductCategory(id);
            else if (table === "subcategory") await AG.restoreProductSubcategory(id);
            else throw new Error("Geçersiz tablo.");
            showCatVisMsg("Kategori arşivden çıkarıldı.", false);
          } else if (action === "delete") {
            if (table === "category") await AG.deleteCustomProductCategory(id);
            else if (table === "subcategory") await AG.deleteCustomProductSubcategory(id);
            else throw new Error("Geçersiz tablo.");
            showCatVisMsg("Kategori kalıcı olarak silindi.", false);
          } else {
            throw new Error("Geçersiz işlem.");
          }
          await loadCategoryVisibilityAdmin();
        } catch (err) {
          console.error(err);
          showCatVisMsg(err?.message || "İşlem başarısız.", true);
        } finally {
          actionBtn.disabled = false;
        }
      });

      catVisRoot?.addEventListener("change", async (e) => {
        const input = e.target.closest(".cat-vis-toggle");
        if (!input) return;
        const table = input.getAttribute("data-cat-table");
        const id = input.getAttribute("data-cat-id");
        const field = input.getAttribute("data-cat-field");
        if (!table || !field) return;
        if (!id) {
          showCatVisMsg(DB_SEED_MISSING_MSG, true);
          input.checked = !input.checked;
          return;
        }
        const patch = { [field]: input.checked };
        input.disabled = true;
        try {
          if (table === "category") {
            await AG.updateProductCategoryVisibility(id, patch);
          } else if (table === "subcategory") {
            await AG.updateProductSubcategoryVisibility(id, patch);
          } else {
            throw new Error("Geçersiz tablo.");
          }
          showCatVisMsg("Kategori görünürlüğü güncellendi.", false);
        } catch (err) {
          console.error(err);
          input.checked = !input.checked;
          showCatVisMsg(err?.message || "Güncellenemedi.", true);
        } finally {
          input.disabled = false;
        }
      });

      await loadCategoryVisibilityAdmin();
})();
