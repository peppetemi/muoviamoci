-- Muoviamoci migration 002: minutes for stretching/camminata, and the new "walk" activity.
-- Run once in Supabase → SQL Editor → New query → Run. Safe to run again.

alter table public.entries add column if not exists minuti int;

alter table public.entries drop constraint if exists entries_minuti_check;
alter table public.entries add constraint entries_minuti_check
  check (minuti is null or minuti between 1 and 600);

alter table public.entries drop constraint if exists entries_activity_check;
alter table public.entries add constraint entries_activity_check
  check (activity in ('swim', 'volley', 'stretch', 'walk'));

-- Make the API see the new column right away.
notify pgrst, 'reload schema';
