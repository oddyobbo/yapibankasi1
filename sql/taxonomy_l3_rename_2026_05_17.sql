-- Taxonomy L3 rename / slug update
-- Manuel çalıştırılacak SQL. Önce staging veya Supabase SQL Editor'da kontrol edin.

BEGIN;

UPDATE public.product_subcategories
SET name = 'Halı ve Karo Halı',
    slug = 'hali-ve-karo-hali'
WHERE slug = 'hali-ve-hali-karo';

UPDATE public.product_subcategories
SET name = 'Keçe Paneller',
    slug = 'kece-paneller'
WHERE slug = 'pet-kece-levhalar';

UPDATE public.product_subcategories
SET name = 'Keçe Akustik Paneller',
    slug = 'kece-akustik-paneller'
WHERE slug = 'pet-kece-akustik-paneller';

UPDATE public.product_subcategories
SET name = '3D Akustik Paneller',
    slug = '3d-akustik-paneller'
WHERE slug = '3d-akustik-paneller';

COMMIT;

-- Kontrol:
-- SELECT name, slug FROM public.product_subcategories
-- WHERE slug IN (
--   'hali-ve-karo-hali',
--   'kece-paneller',
--   'kece-akustik-paneller',
--   '3d-akustik-paneller'
-- )
-- ORDER BY slug;
