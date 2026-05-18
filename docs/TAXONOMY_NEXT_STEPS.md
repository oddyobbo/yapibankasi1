# Taxonomy — Sonraki Adımlar

## Tamamlanan (final taxonomy v1)

- Tek kaynak: `data/archilink-final-taxonomy-v1.json` (`scripts/archilink-taxonomy-v2-tree.mjs` → `scripts/build-archilink-final-taxonomy.mjs`)
- 6 L1 / 32 L2 / 259 L3
- Header mega menü (L1/L2, 3×2), products chipleri, sidebar, footer L1 şeridi, marka paneli L1/L2/L3 cascade
- SQL üretici: `scripts/generate-final-taxonomy-sql.mjs` → `sql/final_taxonomy_seed_2026.sql`
- Salt okuma kontrol: `sql/final_taxonomy_readonly_check.sql`

## Faz 4A — Final taxonomy SQL seed (hazır, uygulanmadı)

- Dosya: `sql/final_taxonomy_seed_2026.sql`
- `product_categories`: 32 L2 upsert + visibility/L1 kolonları
- `product_subcategories`: 259 L3 upsert + visibility kolonları
- Eski satırlar **silinmez / pasifleştirilmez** (FK korunur)
- Supabase SQL Editor'da **manuel** çalıştırılacak; canlıya otomatik uygulama yok
- Sonrası: `sql/final_taxonomy_readonly_check.sql` ile doğrulama

## Faz 4B — Ürün migration

Mevcut `products` kayıtları yeni taxonomy ile eşleştirilecek:

- `category_id` / `subcategory_id` final slug'lara bağlanacak
- `category` string (`L1 > L2 > L3`) güncellenecek
- Eski / fazla kategori satırları ayrı temizlik fazında ele alınacak

## Faz 4C — Boş L3 gizleme (kullanıcı UI)

Products kullanıcı arayüzünde L3 yalnızca şu koşullarda görünür:

- `is_active = true`
- `show_in_products_filter = true`
- **published product count > 0**

Marka ürün formu ve admin panel: ürün sayısı şartı **yok** (yeni ürün / yönetim için).

## Faz 4D — Admin panel visibility toggle

Admin kategori **eklemez / silmez**; yalnızca görünürlük toggle:

| Alan | L2 | L3 |
|------|----|----|
| `show_in_header_dropdown` | Evet | Hayır |
| `show_in_products_filter` | Evet | Evet |
| `show_in_brand_product_form` | Evet | Evet |
| `is_active` | Evet | Evet |

L1 admin panelden gizlenmez (sabit ana yapı).

## Veritabanı notları

- Visibility alanları seed migration ile eklenir (`sql/final_taxonomy_seed_2026.sql`).
- Marka paneli: ID eşleşmesi seed sonrası çalışır; aksi halde `category` string fallback.
- Eski URL: `src/lib/product-taxonomy-routes.js` legacy alias'ları.
