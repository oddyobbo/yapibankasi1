(() => {
  const SUPABASE_URL = "https://dbcyoveyoqjlmybklovu.supabase.co";
  const SUPABASE_KEY = "sb_publishable_RhoIIO1nhGpyGqgU6MD3kw_sawB4_Zk";
  const ADMIN_EMAIL  = "admin@antigravity.com";

  const CATEGORIES = ["Akustik", "Aydınlatma", "Dış Cephe", "Zemin", "Tavan Sistemleri", "Mobilya"];

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
    const { data: profile } = await sb.from("profiles").select("*").eq("id", data.user.id).single();
    return { ok: true, brand: { id: data.user.id, email: data.user.email, ...(profile || {}) } };
  };

  const registerBrand = async ({ name, email, password, website }) => {
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { name: name.trim(), website: (website || "").trim() } },
    });
    if (error) return { ok: false, message: error.message };
    if (!data.user) return { ok: false, message: "Kayıt başarısız. Lütfen tekrar dene." };
    return { ok: true, brand: { id: data.user.id, email, name } };
  };

  const logoutBrand = async () => {
    await ready;
    const sb = getSB();
    if (sb) await sb.auth.signOut();
  };

  const getSessionBrand = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return null;
    const { data: { user } } = await sb.auth.getUser();
    if (!user || user.email === ADMIN_EMAIL) return null;
    const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
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
    if (!sb) return;
    try { await sb.rpc("increment_product_view", { product_id: id }); } catch {}
  };

  // ── Admin data queries ──────────────────────────────────────────────────
  const getAllBrands = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    const { data } = await sb.from("profiles").select("*").order("created_at", { ascending: false });
    return data || [];
  };

  const getVisits = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    const { data } = await sb.from("visits").select("*").order("created_at", { ascending: false }).limit(500);
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
    // products
    getProducts,
    getAllProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    incrementView,
    // admin data
    getAllBrands,
    getVisits,
  };
})();
