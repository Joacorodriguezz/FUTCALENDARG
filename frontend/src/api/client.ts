export interface Partido {
  id: string;
  equipo_local: string;
  equipo_visitante: string;
  logo_local?: string | null;
  logo_visitante?: string | null;
  fecha: string;
  hora: string;
  competicion: string;
  competicion_nombre: string;
  competicion_logo?: string | null;
  estadio?: string;
  /** NS | LIVE | FT | PP — solo NS/LIVE se pueden agregar al calendario */
  estado?: string;
}

/** Partidos que aún se pueden agregar a Google Calendar */
export function partidoEsAgregable(p: Partido): boolean {
  return !p.estado || p.estado === 'NS' || p.estado === 'LIVE';
}

export interface Team {
  id: string;
  name: string;
  logo: string;
  league_id: string;
  division: string;
}

export interface League {
  id: string;
  name: string;
  logo: string;
  active: boolean;
}

export interface AuthStatus {
  authenticated: boolean;
  email?: string;
}

export interface ConflictInfo {
  partido: Partido;
  conflictingEvents: string[];
}

export interface CalendarResult {
  added: number;
  errors: string[];
  duplicates: string[];
  conflicts: ConflictInfo[];
}

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${BASE}/auth/status`, { credentials: 'include' });
  return res.json();
}

export async function fetchTeams(leagueId?: string): Promise<Team[]> {
  const params = leagueId ? `?league_id=${encodeURIComponent(leagueId)}` : '';
  const res = await fetch(`${BASE}/teams${params}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Error al obtener equipos');
  return res.json();
}

export async function fetchFixtures(
  teamId: string,
  options?: { leagueId?: string; status?: string }
): Promise<Partido[]> {
  const status = options?.status ?? 'NS';
  let url = `${BASE}/fixtures?team_id=${encodeURIComponent(teamId)}&status=${encodeURIComponent(status)}`;
  if (options?.leagueId) url += `&league_id=${encodeURIComponent(options.leagueId)}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Error al obtener partidos');
  return res.json();
}

export async function fetchLeagues(): Promise<League[]> {
  const res = await fetch(`${BASE}/leagues`, { credentials: 'include' });
  if (!res.ok) throw new Error('Error al obtener ligas');
  return res.json();
}

export async function addToCalendar(partidos: Partido[], force = false): Promise<CalendarResult> {
  const res = await fetch(`${BASE}/calendar/add`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partidos, force }),
  });
  if (res.status === 401) throw Object.assign(new Error('Unauthenticated'), { status: 401 });
  if (!res.ok) throw new Error('Error al agregar al calendar');
  return res.json();
}

export function redirectToGoogleLogin() {
  window.location.href = `${BASE}/auth/google`;
}
