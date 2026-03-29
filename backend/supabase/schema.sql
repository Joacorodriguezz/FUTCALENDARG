-- ── leagues ──────────────────────────────────────────────────────
create table if not exists public.leagues (
  id           uuid primary key default gen_random_uuid(),
  promiedos_id text not null unique,
  name         text not null,
  logo         text,
  country      text,
  active       boolean default true,
  updated_at   timestamp with time zone default now()
);

-- ── teams ─────────────────────────────────────────────────────────
create table if not exists public.teams (
  id           uuid primary key default gen_random_uuid(),
  promiedos_id text not null unique,
  name         text not null,
  logo         text,
  league_id    uuid references public.leagues(id),
  division     text,
  updated_at   timestamp with time zone default now()
);

-- ── fixtures ──────────────────────────────────────────────────────
create table if not exists public.fixtures (
  id           uuid primary key default gen_random_uuid(),
  promiedos_id text not null unique,
  date         timestamp with time zone,
  venue        text,
  home_team_id uuid references public.teams(id),
  away_team_id uuid references public.teams(id),
  league_id    uuid references public.leagues(id),
  round        text,
  status       text,
  updated_at   timestamp with time zone default now()
);
