import { ADMIN_EMAIL, getSB, ready, uploadStorageAsset } from "./supabaseClient.js";
import { LS_BRAND_SESSION_KEY, lsWrite, normalizeStringArray } from "./uiHelpers.js";

const mergeBrandMetadata = (user, profile) => {
  const meta = user?.user_metadata || {};
  const fromMetaCat = normalizeStringArray(meta.brand_categories);
  const fromMetaRoles = normalizeStringArray(meta.brand_company_roles);
  const fromProfCat = normalizeStringArray(profile?.brand_categories);
  const fromProfRoles = normalizeStringArray(profile?.brand_company_roles);
  const primary = String(profile?.primary_category || meta.primary_category || "").trim();
  const categories = [...new Set([...fromMetaCat, ...fromProfCat, ...(primary ? [primary] : [])])];
  const roles = [...new Set([...fromMetaRoles, ...fromProfRoles])];
  return { brand_categories: categories, brand_company_roles: roles };
};

export const createBrandService = ({ setArchitectSession }) => {
  const loginBrand = async ({ email, password }) => {
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: "E-posta veya şifre hatalı." };
    if (data.user?.email === ADMIN_EMAIL) {
      await sb.auth.signOut();
      return { ok: false, message: "Marka hesabıyla giriş yapın. Admin paneli için /giris adresini kullanın." };
    }
    setArchitectSession(null);
    lsWrite(LS_BRAND_SESSION_KEY, null);
    const { data: profile } = await sb.from("profiles").select("*").eq("id", data.user.id).single();
    if (profile?.account_type === "architect") {
      await sb.auth.signOut();
      return { ok: false, message: "Bu hesap mimar hesabı. Mimar kaydı için /kayit sayfasını kullanın." };
    }
    const metaMerged = mergeBrandMetadata(data.user, profile || {});
    return {
      ok: true,
      brand: {
        id: data.user.id,
        email: data.user.email,
        ...(profile || {}),
        brand_categories: metaMerged.brand_categories,
        brand_company_roles: metaMerged.brand_company_roles,
      },
    };
  };

  const registerBrand = async ({
    name, email, password, website,
    contactName, jobTitle, phone,
    primaryCategory,
    brandCategories,
    companyRoles,
  }) => {
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };
    const categories = normalizeStringArray(brandCategories);
    const roles = normalizeStringArray(companyRoles);
    const primaryCat = categories[0] || String(primaryCategory || "").trim();
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
          primary_category: primaryCat,
          brand_categories: JSON.stringify(categories.length ? categories : (primaryCat ? [primaryCat] : [])),
          brand_company_roles: JSON.stringify(roles),
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
    if (profile) {
      const m = mergeBrandMetadata(user, profile);
      return {
        id: user.id,
        email: user.email,
        ...profile,
        brand_categories: m.brand_categories.length
          ? m.brand_categories
          : (profile.primary_category ? [String(profile.primary_category)] : []),
        brand_company_roles: m.brand_company_roles,
      };
    }
    const m = mergeBrandMetadata(user, {});
    return {
      id: user.id,
      email: user.email,
      name: user.email.split("@")[0],
      brand_categories: m.brand_categories,
      brand_company_roles: m.brand_company_roles,
    };
  };

  const uploadBrandAsset = (file, brandId, bucket = "product-images") => uploadStorageAsset(file, brandId, bucket);
  const uploadBrandImage = (file, brandId) => uploadBrandAsset(file, brandId, "product-images");
  const uploadBrandDocument = (file, brandId) => uploadBrandAsset(file, brandId, "product-documents");

  const getAllBrands = async () => {
    await ready;
    const sb = getSB();
    if (!sb) return [];
    const { data: profiles, error: profErr } = await sb
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (profErr) {
      console.error("getAllBrands profiles", profErr);
      return [];
    }
    const list = (profiles || []).filter((row) => row.account_type !== "architect");
    if (!list.length) return [];

    const ids = list.map((p) => p.id);
    const { data: brandRows, error: brErr } = await sb
      .from("brands")
      .select("id, profile_id, name, slug, status")
      .in("profile_id", ids);
    if (brErr) console.error("getAllBrands brands", brErr);

    const byProfile = new Map();
    for (const br of brandRows || []) {
      if (br?.profile_id) byProfile.set(br.profile_id, br);
    }

    return list.map((p) => {
      const br = byProfile.get(p.id);
      return {
        ...p,
        id: p.id,
        profile_id: p.id,
        profile_name: p.name ?? "",
        brand_record_id: br?.id ?? null,
        brand_name: br?.name ?? null,
        brand_slug: br?.slug ?? null,
        brand_status: br?.status ?? null,
      };
    });
  };

  const BRAND_STATUS_ALLOWED = new Set(["pending", "approved", "rejected", "suspended"]);

  /** İzinli: pending→approved|rejected; rejected→approved; approved→suspended; suspended→approved */
  const assertAdminBrandStatusTransition = (cur, next) => {
    if (cur === next) return null;
    const allowed = {
      pending: ["approved", "rejected"],
      rejected: ["approved"],
      approved: ["suspended"],
      suspended: ["approved"],
    };
    if (allowed[cur]?.includes(next)) return null;
    if (cur === "approved" && (next === "rejected" || next === "pending")) {
      return "Onaylı markanın durumu bu panelden düşürülemez.";
    }
    if (cur === "rejected" && next === "pending") {
      return "Reddedilmiş marka tekrar 'onay bekliyor' durumuna alınamaz.";
    }
    if (cur === "suspended" && (next === "rejected" || next === "pending")) {
      return "Askıdaki marka bu panelden reddedilemez veya beklemeye alınamaz.";
    }
    if (cur === "rejected" && next === "suspended") {
      return "Reddedilmiş marka doğrudan askıya alınamaz.";
    }
    if (cur === "pending" && next === "suspended") {
      return "Onay bekleyen marka doğrudan askıya alınamaz. Önce onaylayın veya reddedin.";
    }
    return "Bu durum geçişine izin verilmiyor.";
  };

  /**
   * Admin: brands.id ile status günceller.
   * Geçişler: pending→approved|rejected; rejected→approved; approved→suspended; suspended→approved.
   */
  const adminSetBrandStatus = async (brandRecordId, status) => {
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı.", brand: null };

    const { data: { user } } = await sb.auth.getUser();
    if (user?.email !== ADMIN_EMAIL) {
      return { ok: false, message: "Bu işlem için admin oturumu gerekli.", brand: null };
    }

    const next = String(status ?? "").trim();
    if (!BRAND_STATUS_ALLOWED.has(next)) {
      return { ok: false, message: "Geçersiz marka durumu.", brand: null };
    }
    if (!brandRecordId) {
      return { ok: false, message: "Marka kaydı seçilemedi.", brand: null };
    }

    const { data: row, error: fetchErr } = await sb
      .from("brands")
      .select("*")
      .eq("id", brandRecordId)
      .maybeSingle();

    if (fetchErr) {
      console.error("adminSetBrandStatus fetch", fetchErr);
      return { ok: false, message: fetchErr.message || "Marka bilgisi alınamadı.", brand: null };
    }
    if (!row) {
      return { ok: false, message: "Marka kaydı bulunamadı.", brand: null };
    }

    const cur = String(row.status || "").trim();
    if (cur === next) {
      return { ok: true, brand: row };
    }

    const transitionErr = assertAdminBrandStatusTransition(cur, next);
    if (transitionErr) {
      return { ok: false, message: transitionErr, brand: row };
    }

    const { data: updated, error: upErr } = await sb
      .from("brands")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", brandRecordId)
      .select("*")
      .single();

    if (upErr) {
      console.error("adminSetBrandStatus update", upErr);
      return { ok: false, message: upErr.message || "Güncellenemedi.", brand: row };
    }
    return { ok: true, brand: updated };
  };

  const normalizeWebsite = (raw) => {
    const t = String(raw ?? "").trim();
    if (!t) return "";
    if (/^https?:\/\//i.test(t)) return t;
    return `https://${t}`;
  };

  /** Marka kataloğu / panel: brands satırı (iletişim dahil). Yalnızca profile_id ile eşleşen satır. */
  const getBrandRecordForProfile = async (profileId) => {
    if (!profileId) return null;
    await ready;
    const sb = getSB();
    if (!sb) return null;
    const { data, error } = await sb
      .from("brands")
      .select(
        "id, profile_id, name, slug, status, website, email, phone, whatsapp_number, address, city, country, description, logo_url",
      )
      .eq("profile_id", profileId)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  };

  /**
   * brands iletişim alanları — tek kaynak brands tablosu.
   * Güncelleme yalnızca profile_id = profileId satırında (RLS brands_own_write).
   */
  const updateBrandContactFields = async (profileId, patch = {}) => {
    if (!profileId) return { ok: false, message: "Oturum bulunamadı." };
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };

    const allowed = new Set(["website", "email", "phone", "whatsapp_number", "address", "city", "country"]);
    const row = {};

    for (const key of allowed) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
      let v = patch[key];
      if (key === "website") {
        row[key] = normalizeWebsite(v);
      } else if (key === "email") {
        const e = String(v ?? "").trim();
        if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
          return { ok: false, message: "Geçerli bir e-posta girin veya alanı boş bırakın." };
        }
        row[key] = e;
      } else if (key === "whatsapp_number") {
        row[key] = String(v ?? "").replace(/\s/g, "").trim();
      } else {
        row[key] = String(v ?? "").trim();
      }
    }

    if (Object.keys(row).length === 0) {
      return { ok: false, message: "Güncellenecek alan yok." };
    }

    const { error } = await sb.from("brands").update(row).eq("profile_id", profileId);
    if (error) return { ok: false, message: error.message || "Güncellenemedi." };
    return { ok: true };
  };

  const LEAD_STATUS_ALLOWED = new Set(["new", "open", "answered", "closed", "spam"]);

  /** Archilink form leadleri; RLS leads_owner_read (brand_id = auth.uid()). */
  const listLeadsForBrand = async (profileId) => {
    if (!profileId) return { ok: false, message: "Oturum bulunamadı.", leads: [] };
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı.", leads: [] };

    const baseFields =
      "id, created_at, lead_type, request_intent, name, email, phone, company, message, status, source, product_id";
    const attempts = [
      () =>
        sb
          .from("leads")
          .select(`${baseFields}, products(name, slug)`)
          .eq("brand_id", profileId)
          .eq("source", "archilink")
          .order("created_at", { ascending: false }),
      () =>
        sb
          .from("leads")
          .select(baseFields)
          .eq("brand_id", profileId)
          .eq("source", "archilink")
          .order("created_at", { ascending: false }),
      () =>
        sb
          .from("leads")
          .select(`${baseFields}, products(name, slug)`)
          .eq("brand_id", profileId)
          .order("created_at", { ascending: false }),
      () =>
        sb.from("leads").select(baseFields).eq("brand_id", profileId).order("created_at", { ascending: false }),
    ];

    let lastErr = null;
    for (const run of attempts) {
      const { data, error } = await run();
      if (!error) return { ok: true, leads: data || [] };
      lastErr = error;
      console.warn("listLeadsForBrand attempt failed", error.message);
    }
    console.error("listLeadsForBrand", lastErr);
    return { ok: false, message: lastErr?.message || "Talepler alınamadı.", leads: [] };
  };

  const updateBrandLeadStatus = async (profileId, leadId, status) => {
    if (!profileId || !leadId) return { ok: false, message: "Eksik bilgi.", lead: null };
    const st = String(status || "").trim();
    if (!LEAD_STATUS_ALLOWED.has(st)) return { ok: false, message: "Geçersiz talep durumu.", lead: null };
    await ready;
    const sb = getSB();
    if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı.", lead: null };

    const patch = { status: st, updated_at: new Date().toISOString() };
    const tryUpdate = (selectStr) =>
      sb
        .from("leads")
        .update(patch)
        .eq("id", leadId)
        .eq("brand_id", profileId)
        .select(selectStr)
        .maybeSingle();

    let { data, error } = await tryUpdate(
      "id, created_at, lead_type, request_intent, name, email, phone, company, message, status, source, product_id, products(name, slug)",
    );
    if (error) {
      ({ data, error } = await tryUpdate(
        "id, created_at, lead_type, request_intent, name, email, phone, company, message, status, source, product_id",
      ));
    }
    if (error) {
      console.error("updateBrandLeadStatus", error);
      return { ok: false, message: error.message || "Durum güncellenemedi.", lead: null };
    }
    if (!data) {
      return { ok: false, message: "Talep bulunamadı veya bu talebi güncelleme yetkiniz yok.", lead: null };
    }
    return { ok: true, lead: data };
  };

  return {
    loginBrand,
    registerBrand,
    logoutBrand,
    getSessionBrand,
    uploadBrandAsset,
    uploadBrandImage,
    uploadBrandDocument,
    getAllBrands,
    adminSetBrandStatus,
    getBrandRecordForProfile,
    updateBrandContactFields,
    listLeadsForBrand,
    updateBrandLeadStatus,
  };
};
