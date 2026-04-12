-- Optional per-vault pill (header) colors; null = derive from vault.color
ALTER TABLE category_vaults
  ADD COLUMN IF NOT EXISTS pill_fill_bg TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pill_border_color TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pill_text_color TEXT DEFAULT NULL;
