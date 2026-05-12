import { ADMIN_EMAIL, getSB, ready } from "./supabaseClient.js";
import { lsWrite } from "./uiHelpers.js";

export const createAuthService = () => {
  const ensureOwnProfile = async (row) => {
    const sb = getSB();
    if (!sb || !row?.id) return;
    try {
      await sb.from("profiles").upsert(row, { onConflict: "id" });
    } catch {}
  };

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

  return {
    ensureOwnProfile,
    syncArchitectProfileFromMetadata,
    loginAdmin,
    logoutAdmin,
    isAdmin,
  };
};
