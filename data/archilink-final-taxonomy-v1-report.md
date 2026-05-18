# Archilink — Final Taxonomy V1

Üretim: 2026-05-18T17:25:02.669Z

## Özet

| Metrik | Değer |
|--------|-------|
| L1 (Header mega grup) | 6 |
| L2 (Header dropdown link) | 32 |
| L3 (ürün ailesi / canonical) | 259 |
| Toplam düğüm | 297 |
| Benzersiz slug | 297 |
| Validation | Geçti |

## Kaynak

- **Ağaç:** `scripts/archilink-taxonomy-v2-tree.mjs`
- **L3:** Kürasyonlu ürün aileleri (Header’da L3 render edilmez)

## Hiyerarşi kuralları

| Seviye | Rol | Header’da görünür | Canonical ürün kategorisi |
|--------|-----|-------------------|---------------------------|
| L1 | Mega menü grup başlığı | Evet (grup) | Hayır |
| L2 | Header dropdown kategori linki | Evet | Hayır |
| L3 | Kategori sayfası + ürün ekleme formu | Hayır | **Evet** (tek canonical) |

## URL / path kuralları

- **L1:** `/urunler/<l1.slug>`
- **L2:** `/urunler/<l1.slug>/<l2.slug>`
- **L3:** `/urunler/<l1.slug>/<l2.slug>/<l3.slug>`

## L1 listesi

- **Zemin & Yüzey** (`zemin-yuzey`) — 6 L2, 66 L3
- **Yapı & Cephe** (`yapi-cephe`) — 6 L2, 60 L3
- **İç Mekan & Mobilya** (`ic-mekan-mobilya`) — 6 L2, 34 L3
- **Mutfak & Banyo** (`mutfak-banyo`) — 5 L2, 34 L3
- **Teknik Sistemler** (`teknik-sistemler`) — 5 L2, 35 L3
- **Dış Mekan & Peyzaj** (`dis-mekan-peyzaj`) — 4 L2, 30 L3


