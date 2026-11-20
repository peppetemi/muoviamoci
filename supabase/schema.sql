-- Muoviamoci: Supabase schema.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
--
-- Security model: no logins. Each couple has a "space" whose id is a long random
-- invite code (e.g. K7QM-3XPA-9FDR). The app sends that code in an `x-space`
-- header, and row-level security only shows rows whose space matches it.
-- Without the code you can't read or write anything.

create table if not exists public.spaces (
  id          text primary key check (length(id) >= 12),
  names       jsonb not null default '{"a": "", "b": ""}'::jsonb,
  pool        int   not null default 25 check (pool in (25, 50)),
  created_at  timestamptz not null default now()
);

create table if not exists public.entries (
  space       text not null references public.spaces(id) on delete cascade,
  id          text not null,                         -- "<date>_<person>_<activity>"
  date        date not null,
  person      text not null check (person in ('a', 'b')),
  activity    text not null check (activity in ('swim', 'volley', 'stretch')),
  vasche      int  check (vasche is null or vasche between 1 and 999),
  updated_at  timestamptz not null default now(),
  primary key (space, id)
);

-- The invite code sent by the app in the `x-space` request header.
create or replace function public.space_key() returns text
language sql stable as $$
  select coalesce(current_setting('request.headers', true)::json ->> 'x-space', '')
$$;

alter table public.spaces  enable row level security;
alter table public.entries enable row level security;

drop policy if exists "read own space"   on public.spaces;
drop policy if exists "create space"     on public.spaces;
drop policy if exists "update own space" on public.spaces;
drop policy if exists "own entries"      on public.entries;

create policy "read own space"   on public.spaces  for select to anon using (id = public.space_key());
create policy "create space"     on public.spaces  for insert to anon with check (id = public.space_key());
create policy "update own space" on public.spaces  for update to anon using (id = public.space_key()) with check (id = public.space_key());
create policy "own entries"      on public.entries for all    to anon using (space = public.space_key()) with check (space = public.space_key());

grant select, insert, update         on public.spaces  to anon;
grant select, insert, update, delete on public.entries to anon;
