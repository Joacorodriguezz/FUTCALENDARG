# FUTCALENDARG

> Agendá los partidos de tu equipo de fútbol argentino directo en Google Calendar. Fixtures de Liga Profesional, Copa Argentina, Libertadores y Sudamericana - con un click.

---

## Stack

| Capa | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Base de datos | Supabase (PostgreSQL) |
| Storage | Supabase Storage (logos WebP) |
| Auth | Google OAuth 2.0 |
| Calendar | Google Calendar API |
| Cron | GitHub Actions (diario 2am ART) |
| Scraping | promiedos.com.ar (API interna) |

---

## Flujo de la app

```
Usuario abre la app
        |
        v
Elige su equipo de la Liga Profesional
        |
        v
Se muestran los proximos partidos (todas las competiciones)
        |
        v
Selecciona los partidos que quiere agendar
        |
        v
Esta autenticado con Google?
   NO -> OAuth redirect -> Google -> callback -> vuelve y reintenta automaticamente
   SI |
        v
Backend verifica duplicados y conflictos en el calendario
        |
        +-- Duplicado  --> aviso, no agrega
        +-- Conflicto  --> modal de confirmacion
        +-- Libre      --> crea evento en Google Calendar
```

---

## Arquitectura

```
Frontend (React/Vite)  ---REST-->  Backend (Express)
        |                               |
   Google OAuth                    Supabase DB
   Google Calendar API             Supabase Storage
                                        |
                              GitHub Actions (cron)
                                        |
                               Scraping promiedos.com.ar
```

---

## Competiciones

- **Liga Profesional Argentina** - todos los equipos
- **Copa Argentina** - solo equipos LP
- **Copa Libertadores** - solo equipos LP
- **Copa Sudamericana** - solo equipos LP

---

## Setup local

### Requisitos

- Node.js 20+
- Cuenta en [Supabase](https://supabase.com)
- Proyecto en [Google Cloud Console](https://console.cloud.google.com) con Calendar API habilitada

### Backend

```bash
cd backend
cp .env.example .env   # completar variables
npm install
npm run dev            # :3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev            # :5173
```

### Variables de entorno (backend)

| Variable | Descripcion |
|---|---|
| `GOOGLE_CLIENT_ID` | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3001/api/auth/google/callback` en dev |
| `FRONTEND_URL` | `http://localhost:5173` en dev |
| `SESSION_SECRET` | String random para firmar sesiones |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Para las rutas de lectura |
| `SUPABASE_SERVICE_ROLE_KEY` | Para el scraper y upload de logos |

---

## Scripts

```bash
npm run scrape-promiedos   # scraping real -> upsert en Supabase
npm run dry-run            # scraping sin escribir en DB (guarda JSON local)
npm run upload-logos       # convierte PNGs a WebP y sube a Supabase Storage
```

---

## Cron

GitHub Actions ejecuta `scrape-promiedos` todos los dias a las 2am ART (5am UTC).
Requiere los secrets `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el repositorio.

---

## Deploy

Frontend y backend en dominios separados:

- **Frontend** (Vercel) - variable de build: `VITE_API_URL=https://<backend-url>/api`
- **Backend** (Railway / Render) - setear `NODE_ENV=production` y todas las env vars

##ZONA HORARIA
  Match times are stored in the database as UTC timestamps. The backend converts them to Argentina Time (ART, UTC-3) and sends two plain strings to the frontend: fecha (YYYY-MM-DD) and hora (HH:MM).

  On the frontend, instead of displaying those strings directly, the app now reconstructs a proper Date object by parsing the ART time with its correct offset (-03:00). It then uses the browser's local      
  timezone — detected via Intl.DateTimeFormat().resolvedOptions().timeZone — to format the date and time for display.

  This means every visitor sees match times converted to their own system timezone. A user in Berlin (UTC+2) will see a match scheduled at 21:00 ART displayed as 02:00 the next day. The day of the week label   also updates accordingly.

  No backend or database changes were required — the conversion happens entirely in the two display components (MatchCard and ConflictModal).