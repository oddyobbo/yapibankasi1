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

**Durum:** Kısmen yapıldı. Dinamik ürün detay sayfası seçili ürünü çekiyor ve analytics non-blocking başladı. Ürün listeleme tarafında 24'lü query/pagination mantığı başladı; tam facet/RPC ve görsel türev üretimi henüz tamamlanmadı.

**Analytics durumu:** `analytics_events` event sistemi, `product_view` duplicate azaltma, dosya indirme/teklif/moodboard/favori eventleri ve marka dashboard için günlük/özet agregasyon viewleri eklendi.

**SEO durumu:** Ürün ve proje detay için title, meta description, canonical, Open Graph ve JSON-LD helper altyapısı eklendi. Marka detay sayfası açıldığında aynı helper ile Organization JSON-LD kullanılacak.

**Astro migration:** Public SEO-sensitive katalog sayfaları için Astro + Supabase + Netlify geçişi `astro-migration` branch'inde başlatıldı. Dashboard/auth/moodboard/admin akışları Phase 2'ye kadar legacy `.html` olarak korunacak.

**Astro ürün listeleme:** `/products` sayfasında query tabanlı filtreler, URL state'i ve 24'lü server-side pagination eklendi. Tarayıcıya tüm ürünleri yükleyip filtreleme yapılmıyor.

**Astro ürün detay:** `/products/[slug]` ürün detay datası marka, kategori/subkategori, teknik bilgiler, dosyalar, varyantlar, ilgili ürünler ve ilgili projelerle zenginleştirildi.

**Astro slug altyapısı:** `sql/astro_slug_backfill.sql` eklendi. Supabase'de çalıştırılınca ürün, marka, proje ve kategori slug alanlarını doldurur; yeni kayıtlar için otomatik slug trigger'ları kurar.

**Astro SEO discovery:** `/robots.txt` ve `/sitemap.xml` endpointleri eklendi. Sitemap public katalog URL'lerini Supabase'den üretir; robots dashboard/panel sayfalarını index dışı bırakır.

**Astro görsel kimlik:** Header, footer, temel tipografi ve ürün kartları mevcut Archilink MVP çizgisine yaklaştırıldı. Bu adım mimariyi değiştiriyor ama dashboard/auth akışlarına dokunmuyor.

**Astro anasayfa UI:** Eski `mvp-taslak-v1.html` anasayfa yapısı Astro `/` route'una taşındı. Hero animasyonu, hızlı keşif bloğu, kategori şeridi, mimar/marka değer bölümleri, katalog alanları ve kapanış CTA korunarak Astro/Supabase altyapısına bağlandı.

**Astro ürün listeleme UI:** Eski `urunler.html` katalog yapısı Astro `/products` route'una taşındı. Üst arama, kategori pill'leri, aktif filtre chip'leri, sticky filtre sidebar'ı, yoğun ürün grid'i ve sayfalama query tabanlı Supabase sistemiyle çalışıyor.

**Astro ürün detay UI:** Eski ürün detay tasarım yönü Astro `/products/[slug]` template'ine taşındı. Geniş Architonic-style galeri, sağda görselin üstüne binen sticky marka/ürün kartı, ürün açıklaması, teknik bilgiler, teknik dosyalar, varyantlar, ilgili projeler ve teklif CTA alanları dinamik Supabase verisiyle çalışıyor.

**Astro marka UI:** Eski onaylı marka dizini mantığı Astro `/brands` ve `/brands/[slug]` route'larına taşındı. Marka liste sayfası başvuru CTA'sı ve güven/dizin diliyle; marka detay sayfası logo, açıklama, rol/konum/iletişim, ürünler, projeler ve Organization JSON-LD ile çalışıyor.

**Astro proje UI:** Eski referans proje mantığı Astro `/projects` ve `/projects/[slug]` route'larına taşındı. Liste sayfası proje kartlarıyla; detay sayfası büyük hero, proje bilgileri, galeri, kullanılan ürünler ve CreativeWork JSON-LD ile çalışıyor.

**Astro kategori UI:** Kategori keşif mantığı Astro `/categories` ve `/categories/[slug]` route'larına taşındı. Kategori listesi kartlarla; kategori detay sayfası kategori hero, ürün grid'i ve diğer kategori önerileriyle çalışıyor.

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

**Durum:** Kısmen yapıldı. `products` ve `product_images` tarafında thumbnail/card/gallery/original URL alanları eklendi; ürün listesi kart görseli için card/thumbnail alanlarını, ürün detay galerisi gallery alanlarını tercih ediyor. Upload tarafı şimdilik aynı URL'yi tüm boyut alanlarına yazıyor. Gerçek thumbnail/medium/WebP üretimi için sonraki adımda Supabase Storage/Edge Function veya CDN dönüşüm sistemi kurulmalı.

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
