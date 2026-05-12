export const SUPABASE_URL = "https://dbcyoveyoqjlmybklovu.supabase.co";
export const SUPABASE_KEY = "sb_publishable_RhoIIO1nhGpyGqgU6MD3kw_sawB4_Zk";
export const ADMIN_EMAIL = "onatderindere@icloud.com";

let client = null;

export const getSB = () => {
  if (!client && window.supabase?.createClient) {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return client;
};

export const ready = new Promise((resolve) => {
  if (window.supabase) {
    resolve();
    return;
  }
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
  script.onload = () => resolve();
  script.onerror = () => resolve();
  document.head.appendChild(script);
});

export const uploadStorageAsset = async (file, ownerId, bucket = "product-images") => {
  await ready;
  const sb = getSB();
  if (!sb) return { ok: false, message: "Sunucu bağlantısı kurulamadı." };
  if (!file) return { ok: false, message: "Lütfen bir dosya seçin." };

  const safeName = (file.name || "file.bin").replace(/[^a-zA-Z0-9._-]/g, "-");
  const ext = safeName.includes(".") ? safeName.split(".").pop() : "jpg";
  const path = `${ownerId || "unknown"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

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
