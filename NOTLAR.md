# Ertelenen Fikirler ve Notlar

---

## 1. PDF Katalogdan AI ile Ürün Çıkarma

**Ne:** Marka kendi PDF kataloğunu yükler, Gemini 1.5 Flash okur ve her ürünü ayrı ayrı JSON olarak çıkartır. Önizleme tablosunda marka onaylar, toplu olarak kaydedilir.

**Neden ertelendi:** Şimdilik öncelikli değil, ama güçlü bir özellik.

**Yapılacaklar:**
- `marka-paneli-urunler.html` → "Katalogdan Yükle (AI)" sekmesi
- Supabase Edge Function → Gemini `application/pdf` API çağrısı (API key gizli)
- Önizleme tablosu + onay adımı
- `AG.addProduct()` ile toplu kayıt

**Maliyet:** Gemini 1.5 Flash ücretsiz tier (günlük 1500 istek). Büyük kataloglar için Flash Pro ~$0.075/katalog.

---
