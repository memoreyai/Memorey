-- Lucide icon component name (e.g. Target, Flag) for vault pills & sidebar
ALTER TABLE category_vaults
  ADD COLUMN IF NOT EXISTS icon_key TEXT DEFAULT NULL;
