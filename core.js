(() => {
  const SUPABASE_URL = "https://dbcyoveyoqjlmybklovu.supabase.co";
  const SUPABASE_KEY = "sb_publishable_RhoIIO1nhGpyGqgU6MD3kw_sawB4_Zk";
  const ADMIN_EMAIL  = "onatderindere@icloud.com";

  const CATEGORIES = ["Akustik", "Aydınlatma", "Dış Cephe", "Zemin", "Tavan Sistemleri", "Mobilya"];
  const LS_PROJECTS_KEY = "ag_projects_v1";
  const LS_ARCHITECT_SESSION_KEY = "ag_architect_session_v1";
  const LS_BRAND_SESSION_KEY = "ag_brand_session_v1";

  // ── localStorage cache helpers ──────────────────────────────────────────
  const lsRead  = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
  const lsWrite = (k, v)  => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  // ── Cookie helpers ──────────────────────────────────────────────────────
  const setCookie = (name, val, days = 365) => {
    const d = new Date(); d.setTime(d.getTime() + days * 86400000);
    document.cookie = `${name}=${encodeURIComponent(val)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
  };
  const getCookie = (name) => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  };

  // ── Supabase lazy init ──────────────────────────────────────────────────
  let _sb = null;
  const getSB = () => {
    if (!_sb && window.supabase?.createClient) {
      _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return _sb;
  };

  // ready: resolves after Supabase JS is loaded
  const ready = new Promise((resolve) => {
    if (window.supabase) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload  = () => resolve();
    s.onerror = () => resolve(); // fallback — won't crash, ops will fail gracefully
    document.head.appendChild(s);
  });

  const ensureOwnProfile = async (row) => {
    const sb = getSB();
    if (!sb || !row?.id) return;
    try {
      await sb.from("profiles").upsert(row, { onConflict: "id" });
    } catch {}
  };

  /** Kayıtta Auth metadata'ya yazılan mimar tipi/ofis adı, trigger gecikmesi veya eski şema yüzünden profiles'ta yanlış kalabiliyor; girişte düzelt. */
  const syncArchitectProfileFromMetadata = async (user, profile) => {
    if (!user?.id || !profile || profile.account_type !== "architect") return profile;
    const meta = user.user_metadata || {};
    const hasExplicitType = meta.architect_profile_type != null && String(meta.architect_profile_type).trim() !== "";
    const nextType = hasExplicitType
      ? (String(meta.architect_profile_type).toLowerCase().trim() === "office" ? "office" : "individual")
      : ((profile.architect_profile_type || "individual") === "office" ? "office" : "individual");
    const fromMetaOffice = (meta.office || "").trim();
    const dbOffice = (profile.office || "").trim();
    const nextOffice = nextType === "office" && fromMetaOffice ? fromMetaOffice : dbOffice;
    const fromMetaName = (meta.name || "").trim();
    const nextName = fromMetaName || (profile.name || "").trim() || (user.email || "").split("@")[0];
    const dbType = (profile.architect_profile_type || "individual") === "office" ? "office" : "individual";
    const changed =
      nextType !== dbType
      || nextOffice !== dbOffice
      || nextName !== (profile.name || "").trim();
    if (!changed) return profile;
    const merged = {
      ...profile,
      id: user.id,
      name: nextName,
      email: profile.email || user.email || "",
      account_type: "architect",
      office: nextOffice,
      architect_profile_type: nextType,
    };
    await ensureOwnProfile(merged);
    const sb = getSB();
    if (!sb) return merged;
    const { data: refreshed } = await sb.from("profiles").select("*").eq("id", user.id).single();
    if (!refreshed) return merged;
    const refType = (refreshed.architect_profile_type || "individual") === "office" ? "office" : "individual";
    if (refType === nextType && (nextOffice || "") === ((refreshed.office || "").trim())) return refreshed;
    return merged;
  };

  // ── Visitor ID ──────────────────────────────────────────────────────────
  const ensureVisitorId = () => {
    let id = getCookie("ag_visitor_id") || lsRead("ag_visitor_id_v1", null);
    if (!id) {
      id = `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      lsWrite("ag_visitor_id_v1", id);
      setCookie("ag_visitor_id", id);
    }
    return id;
  };

  // ── Brand auth ──────────────────────────────────────────────────────────
  const loginBrand = async ({ email, password }) => {
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: "E-posta veya şifre hatalı." };
    if (data.user?.email === ADMIN_EMAIL) {
      await sb.auth.signOut();
      return { ok: false, message: "Marka hesabıyla giriş yapın. Admin paneli için /admin-giris.html adresini kullanın." };
    }
    // Brand ve architect oturumları aynı anda aktif olmasın.
    setArchitectSession(null);
    lsWrite(LS_BRAND_SESSION_KEY, null);
    const { data: profile } = await sb.from("profiles").select("*").eq("id", data.user.id).single();
    if (profile?.account_type === "architect") {
      await sb.auth.signOut();
      return { ok: false, message: "Bu hesap mimar hesabı. Mimar girişi için /mimar-giris.html sayfasını kullanın." };
    }
    return { ok: true, brand: { id: data.user.id, email: data.user.email, ...(profile || {}) } };
  };

  const registerBrand = async ({
    name, email, password, website,
    contactName, jobTitle, phone, primaryCategory,
  }) => {
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };
    const { data, error } = await sb.auth.signUp({
      email: (email || "").trim(),
      password,
      options: {
        data: {
          name: (name || "").trim(),
          website: (website || "").trim(),
          account_type: "brand",
          contact_name: (contactName || "").trim(),
          job_title: (jobTitle || "").trim(),
          phone: (phone || "").trim(),
          primary_category: (primaryCategory || "").trim(),
        },
      },
    });
    if (error) return { ok: false, message: error.message };
    if (!data.user) return { ok: false, message: "Kayıt başarısız. Lütfen tekrar dene." };
    return { ok: true, brand: { id: data.user.id, email: data.user.email, name: (name || "").trim() } };
  };

  const logoutBrand = async () => {
    await ready;
    const sb = getSB();
    if (sb) await sb.auth.signOut();
    lsWrite(LS_BRAND_SESSION_KEY, null);
  };

  const getSessionBrand = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return null;
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email === ADMIN_EMAIL) return null;
    const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
    if (profile?.account_type === "architect") return null;
    if (profile) return { id: user.id, email: user.email, ...profile };
    return { id: user.id, email: user.email, name: user.email.split("@")[0] };
  };

  // ── Admin auth ──────────────────────────────────────────────────────────
  const loginAdmin = async ({ email, password }) => {
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || data.user?.email !== ADMIN_EMAIL) {
      if (data?.session) await sb.auth.signOut();
      return { ok: false, message: "Admin girişi başarısız." };
    }
    lsWrite("ag_session_admin_v1", true);
    return { ok: true };
  };

  const logoutAdmin = async () => {
    lsWrite("ag_session_admin_v1", null);
    await ready;
    const sb = getSB();
    if (sb) await sb.auth.signOut();
  };

  const isAdmin = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return false;
    const { data: { user } } = await sb.auth.getUser();
    return user?.email === ADMIN_EMAIL;
  };

  // ── Products ────────────────────────────────────────────────────────────
  const getProducts = async (opts = {}) => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    let q = sb.from("products").select("*").order("created_at", { ascending: false });
    if (opts.brandId) {
      q = q.eq("brand_id", opts.brandId);
    } else {
      q = q.eq("status", "published");
    }
    if (opts.category) q = q.eq("category", opts.category);
    const { data } = await q;
    return (data || []).map(dbToProduct);
  };

  const getAllProducts = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    const { data } = await sb.from("products").select("*").order("created_at", { ascending: false });
    return (data || []).map(dbToProduct);
  };

  const addProduct = async (product) => {
    await ready;
    const sb = getSB();
    if (!sb) return null;
    const { data, error } = await sb.from("products").insert(productToDB(product)).select().single();
    if (error) { console.error("addProduct:", error.message); return null; }
    return dbToProduct(data);
  };

  const updateProduct = async (id, patch) => {
    await ready;
    const sb = getSB();
    if (!sb) return;
    const dbPatch = {};
    if (patch.status    !== undefined) dbPatch.status    = patch.status;
    if (patch.name      !== undefined) dbPatch.name      = patch.name;
    if (patch.views     !== undefined) dbPatch.views     = patch.views;
    if (patch.technical !== undefined) dbPatch.technical = patch.technical;
    if (patch.image     !== undefined) dbPatch.image     = patch.image;
    if (patch.spec      !== undefined) dbPatch.spec      = patch.spec;
    await sb.from("products").update(dbPatch).eq("id", id);
  };

  const deleteProduct = async (id) => {
    await ready;
    const sb = getSB();
    if (!sb) return;
    await sb.from("products").delete().eq("id", id);
  };

  const incrementView = async (id) => {
    await ready;
    const sb = getSB();
    if (!sb || !id) return;
    try { await sb.rpc("increment_product_view", { product_id: id }); } catch {}
    try {
      const { data: { user } } = await sb.auth.getUser();
      await sb.from("product_view_log").insert({
        product_id: id,
        visitor_id: ensureVisitorId(),
        user_id:    user?.id || null,
      });
    } catch {}
  };

  /** Marka paneli: dönem içinde ürün başına tıklama / favori sayıları (rangeDays null = tümü) */
  const getBrandProductAnalytics = async (brandId, rangeDays = null, productsIn = null) => {
    await ready;
    const sb = getSB();
    const empty = {
      viewsByProduct: {},
      favByProduct:   {},
      totals:         { views: 0, favorites: 0, uniqueVisitors: 0 },
    };
    if (!sb || !brandId) return empty;

    const products = productsIn || await getProducts({ brandId });
    const ids = products.map((p) => p.id).filter(Boolean);
    if (!ids.length) return { ...empty, products };

    const sinceIso = rangeDays != null && rangeDays > 0
      ? new Date(Date.now() - rangeDays * 86400000).toISOString()
      : null;

    let vq = sb.from("product_view_log").select("product_id, visitor_id, user_id, created_at").in("product_id", ids);
    if (sinceIso) vq = vq.gte("created_at", sinceIso);
    const { data: vrows, error: ve } = await vq;
    if (ve) return { ...empty, products };

    let fq = sb.from("product_favorites").select("product_id, user_id, created_at").in("product_id", ids);
    if (sinceIso) fq = fq.gte("created_at", sinceIso);
    const { data: frows, error: fe } = await fq;
    if (fe) return { ...empty, products };

    const viewsByProduct = {};
    const favByProduct = {};
    const uniq = new Set();

    (vrows || []).forEach((r) => {
      viewsByProduct[r.product_id] = (viewsByProduct[r.product_id] || 0) + 1;
      uniq.add(r.user_id ? `u:${r.user_id}` : `v:${r.visitor_id || "?"}`);
    });
    (frows || []).forEach((r) => {
      favByProduct[r.product_id] = (favByProduct[r.product_id] || 0) + 1;
    });

    return {
      viewsByProduct,
      favByProduct,
      totals: {
        views: (vrows || []).length,
        favorites: (frows || []).length,
        uniqueVisitors: uniq.size,
      },
      products,
    };
  };

  const uploadBrandAsset = async (file, brandId, bucket = "product-images") => {
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };
    if (!file) return { ok: false, message: "Lütfen bir dosya seçin." };

    const safeName = (file.name || "file.bin").replace(/[^a-zA-Z0-9._-]/g, "-");
    const ext = safeName.includes(".") ? safeName.split(".").pop() : "jpg";
    const path = `${brandId || "unknown"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await sb.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });
    if (upErr) {
      return { ok: false, message: `Dosya yüklenemedi: ${upErr.message}` };
    }

    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    if (!data?.publicUrl) {
      return { ok: false, message: "Dosya yüklendi ama URL alınamadı." };
    }
    return { ok: true, url: data.publicUrl };
  };

  const uploadBrandImage = async (file, brandId) => uploadBrandAsset(file, brandId, "product-images");
  const uploadBrandDocument = async (file, brandId) => uploadBrandAsset(file, brandId, "product-documents");

  // ── Projects (Supabase first, local fallback) ───────────────────────────
  const dbToProject = (row) => ({
    id: row.id,
    brandId: row.brand_id,
    brandName: row.brand_name || "",
    title: row.title || "",
    location: row.location || "",
    architect: row.architect || "",
    year: row.year || "",
    description: row.description || "",
    image: row.image || "",
    materials: row.materials || [],
    status: row.status || "published",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  });

  const projectToDB = (p) => ({
    brand_id: p.brandId,
    brand_name: p.brandName || "",
    title: p.title || "",
    location: p.location || "",
    architect: p.architect || "",
    year: p.year || "",
    description: p.description || "",
    image: p.image || "",
    materials: p.materials || [],
    status: p.status || "published",
  });

  const getProjects = async (opts = {}) => {
    await ready;
    const sb = getSB();
    if (sb) {
      try {
        let q = sb.from("projects").select("*").order("created_at", { ascending: false });
        if (opts.brandId) q = q.eq("brand_id", opts.brandId);
        const { data, error } = await q;
        if (!error) return (data || []).map(dbToProject);
      } catch {}
    }
    const local = lsRead(LS_PROJECTS_KEY, []);
    if (opts.brandId) return local.filter((p) => p.brandId === opts.brandId);
    return local;
  };

  const addProject = async (project) => {
    await ready;
    const sb = getSB();
    if (sb) {
      try {
        const { data, error } = await sb.from("projects").insert(projectToDB(project)).select().single();
        if (!error && data) return dbToProject(data);
      } catch {}
    }
    const local = lsRead(LS_PROJECTS_KEY, []);
    const created = { ...project, id: `p-${Date.now()}`, createdAt: Date.now() };
    local.unshift(created);
    lsWrite(LS_PROJECTS_KEY, local);
    return created;
  };

  // ── Architect auth (Supabase) + moodboard verisi (localStorage / kullanıcı id) ─
  let _architectSessionCache = null;
  let _architectSessionInflight = null;
  const ARCH_SESSION_CACHE_MS = 90_000;

  const clearArchitectSessionCache = () => {
    _architectSessionCache = null;
    _architectSessionInflight = null;
  };

  const setArchitectSession = (session) => {
    clearArchitectSessionCache();
    lsWrite(LS_ARCHITECT_SESSION_KEY, session || null);
  };
  const nsKey = (suffix, architectId) => `ag_architect_${suffix}_${architectId}`;

  const getSessionArchitect = async () => {
    await ready;
    const now = Date.now();
    if (_architectSessionCache && _architectSessionCache.exp > Date.now()) {
      return _architectSessionCache.val;
    }
    if (_architectSessionInflight) return _architectSessionInflight;

    _architectSessionInflight = (async () => {
      const sb = getSB();
      if (!sb) return null;
      const { data: { user } } = await sb.auth.getUser();
      if (!user || user.email === ADMIN_EMAIL) {
        _architectSessionCache = { val: null, exp: now + 15_000 };
        return null;
      }
      const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
      if (!profile || profile.account_type !== "architect") {
        _architectSessionCache = { val: null, exp: now + 15_000 };
        return null;
      }
      const synced = await syncArchitectProfileFromMetadata(user, profile);
      const t = (synced.architect_profile_type || "individual") === "office" ? "office" : "individual";
      const val = {
        id: user.id,
        email: user.email,
        name: synced.name || user.email.split("@")[0],
        office: synced.office || "",
        architectProfileType: t,
      };
      _architectSessionCache = { val, exp: Date.now() + ARCH_SESSION_CACHE_MS };
      return val;
    })().finally(() => {
      _architectSessionInflight = null;
    });

    return _architectSessionInflight;
  };

  const registerArchitect = async ({ name, email, password, office, architectProfileType }) => {
    const safeEmail = (email || "").trim().toLowerCase();
    const safeName = (name || "").trim();
    const safeProfileType = architectProfileType === "office" ? "office" : "individual";
    const safeOffice = (office || "").trim();
    if (!safeName || !safeEmail || !password) {
      return { ok: false, message: "Ad, e-posta ve şifre zorunludur." };
    }
    if (safeProfileType === "office" && !safeOffice) {
      return { ok: false, message: "Mimarlık ofisi olarak kayıt için ofis/stüdyo adını yazın." };
    }

    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };

    const meta = {
      name: safeName,
      account_type: "architect",
      office: safeOffice,
      architect_profile_type: safeProfileType,
    };

    const { data, error } = await sb.auth.signUp({
      email: safeEmail,
      password,
      options: { data: meta },
    });
    if (error) return { ok: false, message: error.message };
    if (!data.user) return { ok: false, message: "Kayıt başarısız. Lütfen tekrar dene." };

    await ensureOwnProfile({
      id: data.user.id,
      name: safeName,
      email: data.user.email || safeEmail,
      website: "",
      account_type: "architect",
      phone: "",
      contact_name: "",
      job_title: "",
      primary_category: "",
      office: safeOffice,
      architect_profile_type: safeProfileType,
    });

    lsWrite(LS_BRAND_SESSION_KEY, null);
    const sessionReady = Boolean(data.session);
    const architect = {
      id: data.user.id,
      name: safeName,
      email: safeEmail,
      office: safeOffice,
      architectProfileType: safeProfileType,
    };
    if (sessionReady) setArchitectSession(architect);
    else setArchitectSession(null);

    return {
      ok: true,
      sessionReady,
      architect,
    };
  };

  const loginArchitect = async ({ email, password }) => {
    await ready;
    const safeEmail = (email || "").trim().toLowerCase();
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };

    const { data, error } = await sb.auth.signInWithPassword({ email: safeEmail, password });
    if (error) return { ok: false, message: "E-posta veya şifre hatalı." };

    const { data: profile } = await sb.from("profiles").select("*").eq("id", data.user.id).single();
    if (profile?.account_type !== "architect") {
      await sb.auth.signOut();
      if (!profile || profile.account_type === "brand" || !profile.account_type) {
        return { ok: false, message: "Bu hesap marka hesabı. Marka girişi için /marka-giris.html sayfasını kullanın." };
      }
      return { ok: false, message: "Bu e-posta ile mimar hesabı bulunamadı." };
    }

    const synced = await syncArchitectProfileFromMetadata(data.user, profile);
    const t = (synced.architect_profile_type || "individual") === "office" ? "office" : "individual";

    lsWrite(LS_BRAND_SESSION_KEY, null);
    const session = {
      id: data.user.id,
      name: synced.name || data.user.email.split("@")[0],
      email: data.user.email,
      office: synced.office || "",
      architectProfileType: t,
    };
    // Header (layout.js) ve eski akışlar localStorage'dan okuyor; Supabase oturumuyla senkron tut.
    setArchitectSession(session);
    return { ok: true, architect: session };
  };

  const logoutArchitect = async () => {
    await ready;
    const sb = getSB();
    if (sb) {
      try { await sb.auth.signOut(); } catch {}
    }
    setArchitectSession(null);
  };

  /** Mimarlık ofisi hesabı: `projects.brand_id` = mimarın `profiles.id` (auth uid). */
  const getArchitectOfficeProjects = async () => {
    const session = await getSessionArchitect();
    if (!session || session.architectProfileType !== "office") return [];
    return getProjects({ brandId: session.id });
  };

  const addArchitectOfficeProject = async (fields) => {
    const session = await getSessionArchitect();
    if (!session || session.architectProfileType !== "office") {
      return { ok: false, message: "Bu özellik yalnızca mimarlık ofisi hesapları içindir." };
    }
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };
    const title = (fields.title || "").trim();
    if (!title) return { ok: false, message: "Proje başlığı zorunludur." };
    const row = projectToDB({
      brandId: session.id,
      brandName: (session.office || session.name || "").trim(),
      title,
      location: (fields.location || "").trim(),
      architect: (fields.architectName || session.name || "").trim(),
      year: (fields.year || "").trim(),
      description: (fields.description || "").trim(),
      image: (fields.image || "").trim(),
      materials: Array.isArray(fields.materials) ? fields.materials : [],
      status: "published",
    });
    try {
      const { data, error } = await sb.from("projects").insert(row).select().single();
      if (error) return { ok: false, message: error.message };
      if (!data) return { ok: false, message: "Proje oluşturulamadı." };
      return { ok: true, project: dbToProject(data) };
    } catch {
      return { ok: false, message: "Proje kaydedilemedi." };
    }
  };

  const deleteArchitectOfficeProject = async (projectId) => {
    const session = await getSessionArchitect();
    if (!session || session.architectProfileType !== "office") {
      return { ok: false, message: "Bu işlem yalnızca mimarlık ofisi hesapları içindir." };
    }
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };
    try {
      const { error } = await sb.from("projects").delete().eq("id", projectId).eq("brand_id", session.id);
      if (error) return { ok: false, message: error.message };
      return { ok: true };
    } catch {
      return { ok: false, message: "Proje silinemedi." };
    }
  };

  const getArchitectArray = (suffix, architectId, fallback = []) => {
    if (!architectId) return fallback;
    return lsRead(nsKey(suffix, architectId), fallback);
  };
  const setArchitectArray = (suffix, architectId, value) => {
    if (!architectId) return;
    lsWrite(nsKey(suffix, architectId), value);
  };

  const getFavoriteProducts = async () => {
    const session = await getSessionArchitect();
    if (!session) return [];
    return getArchitectArray("favorite_products", session.id, []);
  };

  const getFavoriteProjects = async () => {
    const session = await getSessionArchitect();
    if (!session) return [];
    return getArchitectArray("favorite_projects", session.id, []);
  };

  const toggleFavoriteProduct = async (item) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Favori eklemek için mimar girişi yapın." };
    const list = getArchitectArray("favorite_products", session.id, []);
    const idx = list.findIndex((x) => x.id === item.id);
    const sb = getSB();
    if (idx >= 0) {
      list.splice(idx, 1);
      setArchitectArray("favorite_products", session.id, list);
      if (sb && session.id && item.id) {
        try { await sb.from("product_favorites").delete().eq("user_id", session.id).eq("product_id", item.id); } catch {}
      }
      return { ok: true, active: false };
    }
    list.unshift({
      id: item.id,
      name: item.name || "",
      image: item.image || "",
      category: item.category || "",
      url: item.url || `/urun-unica-baffle.html?id=${encodeURIComponent(item.id || "")}`,
      savedAt: Date.now(),
    });
    setArchitectArray("favorite_products", session.id, list);
    if (sb && session.id && item.id) {
      try { await sb.from("product_favorites").insert({ user_id: session.id, product_id: item.id }); } catch {}
    }
    return { ok: true, active: true };
  };

  const toggleFavoriteProject = async (item) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Favori eklemek için mimar girişi yapın." };
    const list = getArchitectArray("favorite_projects", session.id, []);
    const idx = list.findIndex((x) => x.id === item.id);
    if (idx >= 0) {
      list.splice(idx, 1);
      setArchitectArray("favorite_projects", session.id, list);
      return { ok: true, active: false };
    }
    list.unshift({
      id: item.id,
      name: item.name || "",
      image: item.image || "",
      location: item.location || "",
      url: item.url || `/proje-detay.html?id=${encodeURIComponent(item.id || "")}`,
      savedAt: Date.now(),
    });
    setArchitectArray("favorite_projects", session.id, list);
    return { ok: true, active: true };
  };

  const createCollection = async (name) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Koleksiyon oluşturmak için giriş yapın." };
    const safeName = (name || "").trim();
    if (!safeName) return { ok: false, message: "Koleksiyon adı zorunludur." };
    const list = getArchitectArray("collections", session.id, []);
    const created = { id: `col-${Date.now()}`, name: safeName, items: [], createdAt: Date.now() };
    list.unshift(created);
    setArchitectArray("collections", session.id, list);
    return { ok: true, collection: created };
  };

  const getCollections = async () => {
    const session = await getSessionArchitect();
    if (!session) return [];
    return getArchitectArray("collections", session.id, []);
  };

  const addCollectionItem = async ({ collectionId, item }) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Giriş yapın." };
    const list = getArchitectArray("collections", session.id, []);
    const target = list.find((x) => x.id === collectionId);
    if (!target) return { ok: false, message: "Koleksiyon bulunamadı." };
    const itemType = item.type || "product";
    if (!target.items.some((x) => x.id === item.id && x.type === itemType)) {
      target.items.unshift({ ...item, type: itemType, addedAt: Date.now() });
    }
    setArchitectArray("collections", session.id, list);
    return { ok: true };
  };

  const removeCollectionItem = async ({ collectionId, itemId, type }) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Giriş yapın." };
    const list = getArchitectArray("collections", session.id, []);
    const target = list.find((x) => x.id === collectionId);
    if (!target) return { ok: false, message: "Koleksiyon bulunamadı." };
    target.items = target.items.filter((x) => !(x.id === itemId && (!type || x.type === type)));
    setArchitectArray("collections", session.id, list);
    return { ok: true };
  };

  const createMoodboard = async ({ name }) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Moodboard oluşturmak için giriş yapın." };
    const list = getArchitectArray("moodboards", session.id, []);
    const created = {
      id: `mb-${Date.now()}`,
      name: (name || "Yeni Moodboard").trim(),
      items: [],
      canvas: { width: 1400, height: 900 },
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };
    list.unshift(created);
    setArchitectArray("moodboards", session.id, list);
    return { ok: true, moodboard: created };
  };

  const getMoodboards = async () => {
    const session = await getSessionArchitect();
    if (!session) return [];
    return getArchitectArray("moodboards", session.id, []);
  };

  const getMoodboard = async (id) => {
    const list = await getMoodboards();
    return list.find((x) => x.id === id) || null;
  };

  const updateMoodboard = async (id, patch) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Giriş yapın." };
    const list = getArchitectArray("moodboards", session.id, []);
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return { ok: false, message: "Moodboard bulunamadı." };
    list[idx] = {
      ...list[idx],
      ...patch,
      items: Array.isArray(patch.items) ? patch.items : list[idx].items,
      updatedAt: Date.now(),
    };
    setArchitectArray("moodboards", session.id, list);
    return { ok: true, moodboard: list[idx] };
  };

  const addProductToMoodboard = async ({ moodboardId, moodboardName, product }) => {
    const session = await getSessionArchitect();
    if (!session) return { ok: false, message: "Lütfen mimar girişi yapın." };
    const list = getArchitectArray("moodboards", session.id, []);
    let idx = list.findIndex((x) => x.id === moodboardId);

    if (idx < 0 && moodboardName) {
      const created = {
        id: `mb-${Date.now()}`,
        name: moodboardName.trim() || "Yeni Moodboard",
        items: [],
        canvas: { width: 1400, height: 900 },
        updatedAt: Date.now(),
        createdAt: Date.now(),
      };
      list.unshift(created);
      idx = 0;
    }
    if (idx < 0) return { ok: false, message: "Moodboard bulunamadı." };

    const board = list[idx];
    const count = Array.isArray(board.items) ? board.items.length : 0;
    const created = {
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      productId: product.id,
      name: product.name || "Ürün",
      image: product.image || "",
      x: 30 + (count % 6) * 220,
      y: 30 + Math.floor(count / 6) * 170,
      w: 220,
      h: 190,
    };
    board.items = Array.isArray(board.items) ? board.items : [];
    board.items.push(created);
    board.updatedAt = Date.now();
    list[idx] = board;
    setArchitectArray("moodboards", session.id, list);
    return { ok: true, moodboard: board };
  };

  // ── Admin data queries ──────────────────────────────────────────────────
  const getAllBrands = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    const { data } = await sb.from("profiles").select("*").order("created_at", { ascending: false });
    return (data || []).filter((row) => row.account_type !== "architect");
  };

  const getVisits = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    const { data } = await sb.from("visits").select("*").order("created_at", { ascending: false }).limit(2500);
    return data || [];
  };

  // ── DB mapping ──────────────────────────────────────────────────────────
  const dbToProduct = (row) => ({
    id:          row.id,
    brandId:     row.brand_id,
    brandName:   row.brand_name,
    name:        row.name,
    sku:         row.sku,
    category:    row.category,
    description: row.description,
    technical:   row.technical  || {},
    spec:        row.spec,
    image:       row.image,
    files:       row.files      || {},
    hasPdf:      row.has_pdf,
    hasCad:      row.has_cad,
    status:      row.status,
    views:       row.views,
    createdAt:   new Date(row.created_at).getTime(),
  });

  const productToDB = (p) => ({
    brand_id:    p.brandId,
    brand_name:  p.brandName  || "",
    name:        p.name       || "",
    sku:         p.sku        || "",
    category:    p.category   || "",
    description: p.description || "",
    technical:   p.technical  || {},
    spec:        p.spec       || "",
    image:       p.image      || "",
    files:       p.files      || {},
    has_pdf:     Boolean(p.hasPdf || p.files?.pdfUrl),
    has_cad:     Boolean(p.hasCad || p.files?.cadUrl),
    status:      p.status     || "draft",
  });

  // ── Visit tracking ──────────────────────────────────────────────────────
  const trackVisit = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return;
    const entry = {
      visitor_id: ensureVisitorId(),
      page:       location.pathname || "/",
      referrer:   document.referrer  || "(direct)",
      ts:         Date.now(),
    };
    try {
      const res = await fetch("https://ipapi.co/json/", { credentials: "omit" });
      if (res.ok) {
        const geo = await res.json();
        entry.city    = geo.city         || null;
        entry.region  = geo.region       || null;
        entry.country = geo.country_name || null;
        entry.ip      = geo.ip           || null;
      }
    } catch {}
    try { await sb.from("visits").insert(entry); } catch {}
  };

  if (typeof window !== "undefined") {
    setTimeout(() => trackVisit(), 1500);
  }

  window.AG = {
    ready,
    CATEGORIES,
    // brand
    loginBrand,
    registerBrand,
    logoutBrand,
    getSessionBrand,
    // admin
    loginAdmin,
    logoutAdmin,
    isAdmin,
    // architect
    registerArchitect,
    loginArchitect,
    logoutArchitect,
    getSessionArchitect,
    getFavoriteProducts,
    getFavoriteProjects,
    toggleFavoriteProduct,
    toggleFavoriteProject,
    createCollection,
    getCollections,
    addCollectionItem,
    removeCollectionItem,
    createMoodboard,
    getMoodboards,
    getMoodboard,
    updateMoodboard,
    addProductToMoodboard,
    getArchitectOfficeProjects,
    addArchitectOfficeProject,
    deleteArchitectOfficeProject,
    // products
    getProducts,
    getAllProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    incrementView,
    getBrandProductAnalytics,
    uploadBrandAsset,
    uploadBrandImage,
    uploadBrandDocument,
    getProjects,
    addProject,
    // admin data
    getAllBrands,
    getVisits,
  };
})();
