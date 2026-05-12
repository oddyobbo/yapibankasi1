import { ADMIN_EMAIL, getSB, ready, uploadStorageAsset } from "./supabaseClient.js";
import { LS_ARCHITECT_SESSION_KEY, LS_BRAND_SESSION_KEY, lsWrite, lsRead, nsKey } from "./uiHelpers.js";
import { dbToProject, projectToDB } from "./projectService.js";

const ARCH_SESSION_CACHE_MS = 90_000;

export const createArchitectService = ({
  ensureOwnProfile,
  syncArchitectProfileFromMetadata,
  getProjects,
}) => {
  let architectSessionCache = null;
  let architectSessionInflight = null;

  const clearArchitectSessionCache = () => {
    architectSessionCache = null;
    architectSessionInflight = null;
  };

  const setArchitectSession = (session) => {
    clearArchitectSessionCache();
    lsWrite(LS_ARCHITECT_SESSION_KEY, session || null);
  };

  const getSessionArchitect = async () => {
    await ready;
    const now = Date.now();
    if (architectSessionCache && architectSessionCache.exp > Date.now()) {
      return architectSessionCache.val;
    }
    if (architectSessionInflight) return architectSessionInflight;

    architectSessionInflight = (async () => {
      const sb = getSB();
      if (!sb) return null;
      const { data: { user } } = await sb.auth.getUser();
      if (!user || user.email === ADMIN_EMAIL) {
        architectSessionCache = { val: null, exp: now + 15_000 };
        return null;
      }
      const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
      if (!profile || profile.account_type !== "architect") {
        architectSessionCache = { val: null, exp: now + 15_000 };
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
      architectSessionCache = { val, exp: Date.now() + ARCH_SESSION_CACHE_MS };
      return val;
    })().finally(() => {
      architectSessionInflight = null;
    });

    return architectSessionInflight;
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
    setArchitectSession(session);
    return { ok: true, architect: session };
  };

  const logoutArchitect = async () => {
    await ready;
    const sb = getSB();
    if (sb) {
      try {
        await sb.auth.signOut();
      } catch {}
    }
    setArchitectSession(null);
  };

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
        try {
          await sb.from("product_favorites").delete().eq("user_id", session.id).eq("product_id", item.id);
        } catch {}
      }
      return { ok: true, active: false };
    }
    list.unshift({
      id: item.id,
      name: item.name || "",
      image: item.image || "",
      category: item.category || "",
      url: item.url || `/urun-unica-baffle.html?id=${encodeURIComponent(item.id || "")}`,
      spec: item.spec || "",
      description: String(item.description || "").slice(0, 280),
      hasPdf: Boolean(item.hasPdf || item.files?.pdfUrl),
      hasCad: Boolean(item.hasCad || item.files?.cadUrl),
      files: item.files && item.files.bimUrl ? { bimUrl: item.files.bimUrl } : undefined,
      technical: item.technical
        ? {
            usageScope: item.technical.usageScope || item.technical.usageArea || "",
            materialType: item.technical.materialType || item.technical.malzemeTuru || "",
            dimensions: item.technical.dimensions || "",
            certificates: item.technical.certificates || "",
          }
        : undefined,
      savedAt: Date.now(),
    });
    setArchitectArray("favorite_products", session.id, list);
    if (sb && session.id && item.id) {
      try {
        await sb.from("product_favorites").insert({ user_id: session.id, product_id: item.id });
      } catch {}
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

  const uploadArchitectProjectImage = async (file) => {
    const session = await getSessionArchitect();
    if (!session || session.architectProfileType !== "office") {
      return { ok: false, message: "Görsel yüklemek için mimarlık ofisi hesabıyla giriş yapın." };
    }
    const type = (file && file.type) || "";
    if (!type.startsWith("image/")) return { ok: false, message: "Lütfen bir görsel dosyası seçin (JPG, PNG, WebP vb.)." };
    return uploadStorageAsset(file, session.id, "product-images");
  };

  return {
    setArchitectSession,
    getSessionArchitect,
    registerArchitect,
    loginArchitect,
    logoutArchitect,
    getArchitectOfficeProjects,
    addArchitectOfficeProject,
    deleteArchitectOfficeProject,
    getArchitectArray,
    setArchitectArray,
    getFavoriteProducts,
    getFavoriteProjects,
    toggleFavoriteProduct,
    toggleFavoriteProject,
    uploadArchitectProjectImage,
  };
};
