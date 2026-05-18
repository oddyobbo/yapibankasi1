-- Admin taxonomy CRUD phase 1
-- Amaç: Admin panelden sonradan oluşturulan L2/L3 kategorileri ayırt etmek ve güvenli arşivlemek.
-- Bu SQL'i Supabase SQL Editor'da manuel çalıştırın.
-- Kod/UI değişikliği değildir.

BEGIN;

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'seed'
    CHECK (source IN ('seed', 'admin')),
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE public.product_subcategories
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'seed'
    CHECK (source IN ('seed', 'admin')),
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Mevcut seed satırları net işaretlensin.
UPDATE public.product_categories
SET source = COALESCE(source, 'seed'),
    is_custom = COALESCE(is_custom, false)
WHERE source IS NULL OR is_custom IS NULL;

UPDATE public.product_subcategories
SET source = COALESCE(source, 'seed'),
    is_custom = COALESCE(is_custom, false)
WHERE source IS NULL OR is_custom IS NULL;

COMMIT;

-- Kontrol:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('product_categories', 'product_subcategories')
--   AND column_name IN ('source', 'is_custom', 'archived_at', 'updated_at')
-- ORDER BY table_name, column_name;
