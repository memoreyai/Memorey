-- Per light/dark vault colour overrides (pill + default card) as JSONB.
alter table public.category_vaults
  add column if not exists color_overrides jsonb;

comment on column public.category_vaults.color_overrides is
  'Optional { light, dark } slices with pillFill, pillText, cardBg, cardText, cardAccent (hex strings).';
