# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
cd backend
npm run dev              # Start dev server on :3001 (ts-node-dev, hot reload)
npx tsc --noEmit         # Type-check without building
npm run build            # Compile to dist/
npm run scrape-promiedos # Scrape promiedos and upsert into Supabase
npm run dry-run          # Scrape all 4 leagues → saves JSON locally, no Supabase
npm run upload-logos     # Convert PNGs to WebP and upload to Supabase Storage
```

### Frontend
```bash
cd frontend
npm run dev        # Start Vite dev server on :5173
npx tsc --noEmit   # Type-check
npm run build      # Production build
```

### Cron (GitHub Actions)
Runs daily at 2am. Runs `scrape-promiedos`. Workflow file lives in `.github/workflows/`.

---

## Architecture

Two independent packages — no monorepo tooling, just two separate `npm` projects.

```
Frontend (React)  <--REST-->  Backend (Node/Express)
       |                            |
   auth flow                   lee/escribe
       |                            |
 Google Services            Supabase (PostgreSQL + Storage)
 - OAuth 2.0                        |
 - Calendar API              crea evento
                                    |
Cron (GitHub Actions)       Google Services
 - Runs daily at 2am         - Calendar API
 - Scrapes promiedos.com.ar
 - Saves to Supabase
```

---

### Frontend (`frontend/src/`)

Vite + React 18 + Tailwind. No router — single-page app.

**Screens / sections:**
- **Login** — Google OAuth sign-in.
- **Team selector bar** — Shows only the 30 LP (Liga Profesional) teams filtered via `LP_TEAM_NAMES` set (`src/data/equipos.ts`). No league selector.
- **Selector de partidos** — Shows upcoming fixtures for the selected team across all competitions; add selected fixtures to Google Calendar.

**State lives entirely in `App.tsx`**: selected team, fetched fixtures, checked set (by fixture `id`), auth status, modal visibility, toast.

**Auth + redirect recovery:** On mount, `App.tsx` calls `fetchAuthStatus()` and checks `?auth=success` in the URL. If returning from OAuth and authenticated, it reads `sessionStorage` key `partidos_pending` and automatically retries the calendar add — this is how selections survive the OAuth redirect.

**API calls** all go through `src/api/client.ts`. The Vite dev server proxies `/api/*` to `http://localhost:3001`, so no CORS issues in development.

**Team filtering:** `LP_TEAM_NAMES` (exported from `src/data/equipos.ts`) is a `Set<string>` with the 30 exact team names as they appear in the DB (promiedos names). Teams fetched from the API are filtered by this set before being shown in the selector bar.

**Logos:** Team and competition logos are served from Supabase Storage URLs stored in the DB (`teams.logo`, `leagues.logo`). `MatchCard` uses the DB URL first, falling back to `getLogoByName()` (local LOGO_MAP) if null.

---

### Backend (`backend/src/`)

Express + TypeScript. Entry point: `index.ts` sets up CORS, express-session, and mounts route files.

**Routes:**
- `GET /api/teams` — returns teams from Supabase (`id, name, logo, league_id, division`).
- `GET /api/leagues` — returns active leagues (`id, name, logo, active`).
- `GET /api/fixtures?team_id=&status=NS` — returns upcoming fixtures for a team, joined with team logos and league name/logo.

**`Partido` type** (`src/types/partido.ts`):
```ts
{
  id, equipo_local, equipo_visitante,
  logo_local, logo_visitante,       // Supabase Storage URLs (nullable)
  fecha, hora,
  competicion,                      // round string (e.g. "Fecha 7")
  competicion_nombre,               // league name (e.g. "Liga Profesional Argentina")
  competicion_logo,                 // Supabase Storage URL (nullable)
  estadio
}
```

**Auth flow:**
`GET /api/auth/google` → Google OAuth redirect → `GET /api/auth/google/callback` validates the Google token, stores `access_token` + `email` in session → redirects to frontend with `?auth=success`.

**Calendar service (`services/googleCalendar.ts`):**
Creates events in the user's Google Calendar via Calendar API. Called from `POST /api/calendar/add` (requires `req.session.access_token`).

Session data shape is declared in `src/types/session.d.ts` (extends `express-session`'s `SessionData`).

---

### Database — Supabase (PostgreSQL, free tier)

Schema file: `backend/supabase/schema.sql`

#### `leagues`
| column | type |
|--------|------|
| id | uuid PK |
| promiedos_id | text UNIQUE |
| name | text |
| logo | text (Supabase Storage URL) |
| country | text |
| active | boolean |
| updated_at | timestamp |

#### `teams`
| column | type |
|--------|------|
| id | uuid PK |
| promiedos_id | text UNIQUE |
| name | text |
| logo | text (Supabase Storage URL) |
| league_id | FK → leagues.id |
| division | text |
| updated_at | timestamp |

#### `fixtures`
| column | type |
|--------|------|
| id | uuid PK |
| promiedos_id | text UNIQUE |
| date | timestamp (UTC) |
| venue | text (always null — promiedos doesn't provide it) |
| home_team_id | FK → teams.id |
| away_team_id | FK → teams.id |
| league_id | FK → leagues.id |
| round | text |
| status | text (`NS` / `LIVE` / `FT`) |
| updated_at | timestamp |

---

### Supabase Storage

Bucket: **`logos`** (public)

```
logos/
  teams/   ← WebP 64×64 quality 85, one per unique logo filename
  leagues/ ← WebP 48×48 (PNG→WebP) or SVG (Sudamericana)
```

URLs follow the pattern:
`https://<ref>.supabase.co/storage/v1/object/public/logos/teams/<file>.webp`

The `logo` column in both `teams` and `leagues` stores these public URLs.

---

### Scripts (`backend/src/scripts/`)

| Script | npm script | Description |
|--------|-----------|-------------|
| `scrapePromiedos.ts` | `scrape-promiedos` | Scrapes 4 leagues from promiedos API, upserts into Supabase. Filters Copa Argentina / Libertadores / Sudamericana to LP teams only. |
| `dryRunScrape.ts` | `dry-run` | Same scraping logic but outputs to `scrape-output.json` in project root. No Supabase writes. |
| `uploadLogos.ts` | `upload-logos` | Reads LOGO_MAP, converts PNGs to WebP (64×64), uploads to Supabase Storage, updates `teams.logo` and `leagues.logo` with public URLs. Requires `sharp`. |

---

### Cron — GitHub Actions

Runs daily at 2am. Executes `npm run scrape-promiedos` in the backend.

---

### Scraping — Promiedos

Data source: **`api.promiedos.com.ar`** (internal JSON API used by promiedos.com.ar).

Headers required: `User-Agent`, `Referer: https://www.promiedos.com.ar/`, `x-ver: 1.11.7.5`

**Ligas configuradas:**

| Liga | ID promiedos | Filtro LP |
|------|-------------|-----------|
| Liga Profesional Argentina | `hc` | No (todas) |
| Copa Argentina | `gea` | Sí |
| Copa Libertadores | `bac` | Sí |
| Copa Sudamericana | `dij` | Sí |

**Filtro LP:** para Copa Argentina, Libertadores y Sudamericana, se omiten los partidos donde ninguno de los dos equipos es de LP (la lista `lpTeamIds` se obtiene de los standings de `hc`).

**Endpoints usados:**
- `/league/tables_and_fixtures/{leagueId}` → lista de stages/fechas + IDs de equipos LP (de `tables_groups`)
- `/league/games/{leagueId}/{filterKey}` → partidos de una fecha

**Formato de fecha:** `"dd-MM-yyyy HH:mm"` en ART (UTC-3). El scraper convierte a UTC sumando 3h antes de guardar.

**Importante:** `venue` no está disponible en la API de promiedos — siempre se guarda `null`.

---

### External services

| Service | Purpose |
|---------|---------|
| promiedos.com.ar | Scraping de fixtures, equipos y ligas argentinas |
| Supabase | PostgreSQL (datos) + Storage (logos) |
| Google OAuth 2.0 | User login |
| Google Calendar API | Creates calendar events for selected fixtures |

---

## Calendar event creation rules

Before inserting any event, `services/googleCalendar.ts` performs two checks via `calendar.events.list` for each fixture against the user's primary calendar.

### 1. Duplicate check — event already exists

Search in the exact time window (timeMin = startDate, timeMax = endDate) for events whose `summary` matches `"{equipo_local} vs {equipo_visitante}"` (case-insensitive). If found:
- **Skip** the insert.
- Add to `duplicates` array in the response (not to `errors`).

### 2. Conflict check — something else is already scheduled

Search for **any** events in that same window. If events exist whose summary does **not** match the fixture:
- **Still insert** the fixture.
- Add fixture + conflicting event title to the `conflicts` array.

**Response shape:**
```ts
{ added: number; errors: string[]; duplicates: string[]; conflicts: ConflictInfo[] }
```

### Frontend behavior (`App.tsx` / `doAddToCalendar`)
- `duplicates.length > 0` → warning toast "Ya estaban en tu calendario"
- `conflicts.length > 0` → opens `ConflictModal` to let the user confirm
- Errors remain separate from duplicates/conflicts

---

## Environment

Backend requires `backend/.env` (see `backend/.env.example`).

Required env vars:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console (Calendar API enabled, redirect URI: `http://localhost:3001/api/auth/google/callback`)
- `SUPABASE_URL` — from Supabase project settings
- `SUPABASE_ANON_KEY` — used by the Express server (read-only routes)
- `SUPABASE_SERVICE_ROLE_KEY` — used by scraper and upload scripts (write access)
