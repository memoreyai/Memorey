-- Memory goals (step 3) and primary use case (step 4) for extended onboarding.
alter table public.profiles
  add column if not exists memory_goals text[] not null default '{}',
  add column if not exists primary_use_case text;

comment on column public.profiles.memory_goals is 'Onboarding: what user wants to remember most (multi-select ids).';
comment on column public.profiles.primary_use_case is 'Onboarding: primary use case (single id).';

-- One-time: old flow used onboarding_step 3 for "first memory". New flow uses 3 for goals, 5 for first memory.
update public.profiles
set onboarding_step = 5
where onboarding_completed = false and onboarding_step = 3;
