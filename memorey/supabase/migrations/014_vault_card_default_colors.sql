-- Default card colours per vault (optional; nodes still use custom_* overrides)
ALTER TABLE category_vaults
  ADD COLUMN IF NOT EXISTS default_card_accent TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_card_bg TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS default_card_text TEXT DEFAULT NULL;
