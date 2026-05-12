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
      return { ok: false, message: "Marka hesabıyla giriş yapın. Admin paneli için /admin-giris.html adresini kullanın." };
    }
    setArchitectSession(null);
    lsWrite(LS_BRAND_SESSION_KEY, null);
    const { data: profile } = await sb.from("profiles").select("*").eq("id", data.user.id).single();
    if (profile?.account_type === "architect") {
      await sb.auth.signOut();
      return { ok: false, message: "Bu hesap mimar hesabı. Mimar girişi için /mimar-giris.html sayfasını kullanın." };
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
    const { data } = await sb.from("profiles").select("*").order("created_at", { ascending: false });
    return (data || []).filter((row) => row.account_type !== "architect");
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
  };
};
