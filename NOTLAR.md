# Ertelenen Fikirler ve Notlar

---

## 2. Performans Kuralları

**Ne:** Platform binlerce ürün, marka ve proje ile de hızlı kalmalı.

**Kurallar:**
- Listeleme sayfalarında tüm ürün datası çekilmeyecek; sadece kart için hafif alanlar çekilecek.
- Ürün detay sayfası yalnızca seçili ürünün tam datasını çekecek.
- Ürün listelerinde sayfalama veya sonsuz yükleme kullanılacak; varsayılan sayfa boyutu 24 ürün.
- Filtreler tarayıcıda tüm ürünleri yükleyerek değil, Supabase query/RPC ile çalışacak.
- Filtre alanları için index şart: `category_id`, `brand_id`, `material`, `usage_area`, `color_family`, `fire_class`, `slug`, `status`, `created_at`.
- Ürün kartlarında original görsel kullanılmayacak; thumbnail/card boyutları kullanılacak.
- Görseller `thumbnail`, `card`, `gallery`, `original` boyutlarında yönetilecek.
- Fold altı görseller `loading="lazy"` ile yüklenecek.
- PDF, CAD, BIM ve katalog dosyalarının kendisi sayfa yüklenirken indirilmeyecek; sadece metadata gösterilecek.
- JS sayfaya göre bölünecek; panel/admin/detay kodları her public sayfada yüklenmeyecek.
- `core.js` dev bundle gibi büyümeyecek; sayfalar ihtiyaç duyduğu modülü import edecek.
- Public katalog verisinde browser cache ve CDN dostu asset URL'leri kullanılacak.
- Analytics eventleri render'ı bekletmeyecek, non-blocking çalışacak.
- Skeleton loader ve temiz boş durumlar kullanılacak.
- Büyük değişikliklerden sonra Lighthouse ölçümü yapılacak: Performance 85+, LCP 2.5s altı, CLS sıfıra yakın.

**Durum:** Kısmen yapıldı. Dinamik ürün detay sayfası seçili ürünü çekiyor ve analytics non-blocking başladı. Listeleme sayfası hâlâ tamamen performans kurallarına uygun değil; sıradaki işlerden biri query tabanlı 24'lü listeleme/filtreleme.

---

## 3. Görsel Performans Sistemi

**Ne:** Ürün görselleri farklı kullanım yerleri için ayrı boyutlarda tutulmalı.

**Kurallar:**
- Ürün kartı için thumbnail/card görseli.
- Galeri için medium görsel.
- Original sadece zoom/download için.
- Mümkün olduğunda sıkıştırılmış WebP.
- Kartlarda original full-resolution görsel render edilmeyecek.
- Kritik olmayan görsellerde `loading="lazy"`.
- Görsellerde `width` ve `height` değerleriyle layout shift azaltılacak.

**Durum:** Yapılmadı. Bazı görsellerde lazy loading var ama upload sonrası otomatik thumbnail/medium/original üretim sistemi yok.

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
