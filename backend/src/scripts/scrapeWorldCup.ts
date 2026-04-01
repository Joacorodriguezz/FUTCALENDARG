import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !FOOTBALL_DATA_API_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FOOTBALL_DATA_API_KEY');
  process.exit(1);
}

/**
 * Sin `season`, football-data usa la "temporada actual" del torneo y a menudo
 * devuelve menos partidos o otra edición. Mundial 2026 → 2026 (cambiar si la API usa otro año).
 */
const WC_SEASON = process.env.FOOTBALL_DATA_WC_SEASON ?? '2026';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const api = axios.create({
  baseURL: 'https://api.football-data.org/v4',
  headers: {
    'X-Auth-Token': FOOTBALL_DATA_API_KEY,
  },
});

/** Planes gratuitos suelen limitar ~10 req/min; espaciamos peticiones para evitar 429. */
const MIN_MS_BETWEEN_REQUESTS = Number(process.env.FOOTBALL_DATA_MIN_INTERVAL_MS ?? 6500);

let lastFootballDataRequestAt = 0;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function parse429WaitSeconds(err: unknown): number {
  if (!axios.isAxiosError(err) || err.response?.status !== 429) return 60;
  const body = err.response?.data as { message?: string } | undefined;
  const msg = body?.message ?? '';
  const m = msg.match(/(\d+)\s*second/i);
  if (m) return Math.min(parseInt(m[1], 10) + 3, 120);
  const ra = err.response?.headers?.['retry-after'];
  if (ra) {
    const n = parseInt(String(ra), 10);
    if (!Number.isNaN(n)) return Math.min(n + 3, 120);
  }
  return 60;
}

async function footballDataGet<T>(path: string): Promise<T> {
  const now = Date.now();
  const elapsed = now - lastFootballDataRequestAt;
  if (lastFootballDataRequestAt > 0 && elapsed < MIN_MS_BETWEEN_REQUESTS) {
    const w = MIN_MS_BETWEEN_REQUESTS - elapsed;
    console.log(`  (pausa ${Math.ceil(w / 1000)}s — límite football-data.org)`);
    await sleep(w);
  }

  const maxAttempts = 15;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { data } = await api.get<T>(path);
      lastFootballDataRequestAt = Date.now();
      return data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        const sec = parse429WaitSeconds(err);
        console.warn(`  429 rate limit: esperando ${sec}s (reintento ${attempt + 1}/${maxAttempts})...`);
        await sleep(sec * 1000);
        continue;
      }
      throw err;
    }
  }
  throw new Error('football-data.org: demasiados errores 429');
}

// ── Selecciones oficiales del Mundial 2026 (48 equipos) ─────────
/** Nombres normalizados (en inglés, lowercase) de las 48 selecciones clasificadas. */
const ALLOWED_TEAMS_RAW = [
  'mexico', 'south africa', 'south korea', 'korea republic', 'republic of korea',
  'czech republic', 'czechia', 'canada',
  'bosnia and herzegovina', 'bosnia-herzegovina', 'bosnia herzegovina',
  'qatar', 'switzerland', 'brazil', 'morocco',
  'haiti', 'scotland', 'united states', 'usa', 'united states of america',
  'paraguay', 'australia', 'turkey', 'türkiye', 'turkiye',
  'germany', 'curacao', 'curaçao',
  "cote d'ivoire", 'côte divoire', 'ivory coast', 'cote divoire',
  'ecuador', 'netherlands', 'holland', 'japan', 'sweden', 'tunisia',
  'belgium', 'egypt', 'iran', 'new zealand',
  'spain', 'cabo verde', 'cape verde', 'cape verde islands',
  'saudi arabia', 'uruguay',
  'france', 'senegal', 'iraq', 'norway',
  'argentina', 'algeria', 'austria', 'jordan',
  'portugal', 'dr congo', 'congo dr', 'democratic republic of congo',
  'uzbekistan', 'colombia',
  'england', 'croatia', 'ghana', 'panama',
];

const ALLOWED_TEAMS_SET = new Set(
  ALLOWED_TEAMS_RAW.map((n) =>
    n.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
  )
);

function isAllowedTeam(name: string): boolean {
  const normalized = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/'/g, "'")
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ALLOWED_TEAMS_SET.has(normalized);
}

// ── Types ────────────────────────────────────────────────────────

interface FootballDataCompetition {
  id: number;
  name: string;
  emblem: string | null;
}

interface FootballDataTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string | null;
}

interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  matchday: number | null;
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  venue: string | null;
}

interface MatchesListResponse {
  matches: FootballDataMatch[];
  resultSet?: { count?: number; first?: string; last?: string };
}

interface TeamsListResponse {
  teams: FootballDataTeam[];
}

/** Menos páginas = menos peticiones (la API puede acotar el máximo por request). */
const PAGE_SIZE = 200;

/** La API devuelve listas paginadas; sin esto solo se guarda la primera página (~faltan decenas de partidos). */
async function fetchAllCompetitionMatches(): Promise<FootballDataMatch[]> {
  const all: FootballDataMatch[] = [];
  let offset = 0;
  let apiReportedTotal: number | undefined;

  for (;;) {
    const data = await footballDataGet<MatchesListResponse>(
      `/competitions/WC/matches?season=${encodeURIComponent(WC_SEASON)}&limit=${PAGE_SIZE}&offset=${offset}`
    );
    if (offset === 0 && data.resultSet?.count != null) {
      apiReportedTotal = data.resultSet.count;
      console.log(
        `  La API indica ${apiReportedTotal} partidos para season=${WC_SEASON} (resultSet.count)`
      );
    }
    const batch = data.matches ?? [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (apiReportedTotal != null && all.length < apiReportedTotal) {
    console.warn(
      `  Aviso: se recibieron ${all.length} partidos pero resultSet.count=${apiReportedTotal} (revisá paginación o permisos del token)`
    );
  }

  return all;
}

/** Un solo request con límite alto alcanza las ~48 selecciones del Mundial. */
async function fetchAllCompetitionTeams(): Promise<FootballDataTeam[]> {
  const data = await footballDataGet<TeamsListResponse>(
    `/competitions/WC/teams?season=${encodeURIComponent(WC_SEASON)}&limit=500`
  );
  return data.teams ?? [];
}

// ── Helpers ──────────────────────────────────────────────────────

/** Map football-data status → our status codes */
function mapStatus(status: string): string {
  if (['SCHEDULED', 'TIMED'].includes(status)) return 'NS';
  if (['IN_PLAY', 'PAUSED'].includes(status)) return 'LIVE';
  if (['FINISHED', 'AWARDED'].includes(status)) return 'FT';
  if (['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(status)) return 'PP';
  return 'NS';
}

// ── Supabase upserts ─────────────────────────────────────────────

const leagueUuidCache = new Map<string, string>();

async function upsertLeague(
  footballDataId: number,
  name: string,
  logo: string | null
): Promise<string> {
  const promiedosId = `fd_${footballDataId}`;
  if (leagueUuidCache.has(promiedosId)) return leagueUuidCache.get(promiedosId)!;

  const { error } = await supabase.from('leagues').upsert(
    {
      promiedos_id: promiedosId,
      name,
      logo,
      country: 'International',
      active: true,
    },
    { onConflict: 'promiedos_id' }
  );
  if (error) throw new Error(`League upsert failed (${promiedosId}): ${error.message}`);

  const { data, error: selErr } = await supabase
    .from('leagues')
    .select('id')
    .eq('promiedos_id', promiedosId)
    .single();
  if (selErr) throw new Error(`League select failed: ${selErr.message}`);

  leagueUuidCache.set(promiedosId, data.id);
  return data.id as string;
}

const teamUuidCache = new Map<string, string>();

async function upsertTeam(
  team: FootballDataTeam,
  leagueUuid: string
): Promise<string> {
  const promiedosId = `fd_${team.id}`;
  if (teamUuidCache.has(promiedosId)) return teamUuidCache.get(promiedosId)!;

  const { error } = await supabase.from('teams').upsert(
    {
      promiedos_id: promiedosId,
      name: team.name,
      logo: team.crest,
      league_id: leagueUuid,
      division: 'World Cup',
    },
    { onConflict: 'promiedos_id' }
  );
  if (error) throw new Error(`Team upsert failed (${team.name}): ${error.message}`);

  const { data, error: selErr } = await supabase
    .from('teams')
    .select('id')
    .eq('promiedos_id', promiedosId)
    .single();
  if (selErr) throw new Error(`Team select failed: ${selErr.message}`);

  teamUuidCache.set(promiedosId, data.id);
  return data.id as string;
}

async function upsertFixtures(rows: object[]): Promise<void> {
  if (rows.length === 0) return;

  // Batch upserts in chunks of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase
      .from('fixtures')
      .upsert(batch, { onConflict: 'promiedos_id' });
    if (error) {
      throw new Error(`Fixtures upsert batch failed: ${error.message}`);
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function scrapeWorldCup() {
  console.log('Scraping FIFA World Cup 2026 from football-data.org...\n');

  // 1. Fetch competition info
  console.log('── Fetching competition info ──');
  const compData = await footballDataGet<FootballDataCompetition>('/competitions/WC');
  const leagueUuid = await upsertLeague(
    compData.id,
    'FIFA World Cup 2026',
    compData.emblem
  );
  console.log(`  Upserted league: ${compData.name} (UUID: ${leagueUuid})\n`);

  // 2. Fetch teams (paginado: la API no devuelve todos en una sola respuesta por defecto)
  console.log('── Fetching teams ──');
  const allTeams = await fetchAllCompetitionTeams();
  const teams = allTeams.filter((t) => isAllowedTeam(t.name));
  const skippedTeams = allTeams.length - teams.length;
  console.log(`  Found ${allTeams.length} teams from API, ${teams.length} allowed, ${skippedTeams} filtered out`);

  for (const team of teams) {
    await upsertTeam(team, leagueUuid);
    process.stdout.write(`\r  Upserted: ${team.name.padEnd(40)}`);
  }
  console.log('\n');

  // 3. Fetch matches (paginado — antes solo se guardaba la 1.ª página)
  console.log('── Fetching matches ──');
  const matches = await fetchAllCompetitionMatches();
  console.log(`  Found ${matches.length} matches (all pages)`);

  const fixtureRows: object[] = [];
  let skippedTbd = 0;

  let skippedNotAllowed = 0;

  for (const match of matches) {
    // La API a veces lista cruces sin rivales definidos (playoffs / TBD) — no se pueden guardar en DB
    const ht = match.homeTeam;
    const at = match.awayTeam;
    if (!ht?.name || !at?.name || ht.id == null || at.id == null) {
      skippedTbd++;
      continue;
    }

    // Filtrar partidos donde ninguno de los dos equipos está en la lista de 48 selecciones
    if (!isAllowedTeam(ht.name) && !isAllowedTeam(at.name)) {
      skippedNotAllowed++;
      continue;
    }

    const homePromiedosId = `fd_${ht.id}`;
    const awayPromiedosId = `fd_${at.id}`;

    // Get team UUIDs from cache, or upsert if not found (handles teams not in /teams endpoint)
    let homeUuid = teamUuidCache.get(homePromiedosId);
    if (!homeUuid) {
      // Team not in cache - create minimal team object and upsert
      const homeTeamObj: FootballDataTeam = {
        id: ht.id,
        name: ht.name,
        shortName: ht.name,
        tla: '',
        crest: null,
      };
      homeUuid = await upsertTeam(homeTeamObj, leagueUuid);
      process.stdout.write(`\r  Added team from match: ${ht.name.padEnd(40)}`);
    }

    let awayUuid = teamUuidCache.get(awayPromiedosId);
    if (!awayUuid) {
      // Team not in cache - create minimal team object and upsert
      const awayTeamObj: FootballDataTeam = {
        id: at.id,
        name: at.name,
        shortName: at.name,
        tla: '',
        crest: null,
      };
      awayUuid = await upsertTeam(awayTeamObj, leagueUuid);
      process.stdout.write(`\r  Added team from match: ${at.name.padEnd(40)}`);
    }

    // Build round string from stage + group/matchday
    let round = match.stage;
    if (match.group) {
      round = `${match.stage} - ${match.group}`;
    } else if (match.matchday) {
      round = `${match.stage} - Matchday ${match.matchday}`;
    }

    fixtureRows.push({
      promiedos_id: `fd_${match.id}`,
      date: match.utcDate, // Already in UTC ISO format
      home_team_id: homeUuid,
      away_team_id: awayUuid,
      league_id: leagueUuid,
      round,
      status: mapStatus(match.status),
      venue: match.venue,
    });
  }

  await upsertFixtures(fixtureRows);
  console.log(`  Upserted ${fixtureRows.length} fixtures`);
  if (skippedTbd > 0) {
    console.log(
      `  Omitidos ${skippedTbd} partidos sin rivales definidos en la API (TBD — suelen completarse más adelante)`
    );
  }
  if (skippedNotAllowed > 0) {
    console.log(
      `  Filtrados ${skippedNotAllowed} partidos con selecciones fuera de las 48 oficiales`
    );
  }
  console.log(
    '\nNota: el total oficial del Mundial 2026 es 104 partidos. Si faltan filas, el proveedor aún no los publicó o tu plan de API limita datos.\n'
  );

  console.log('Done.');
}

scrapeWorldCup().catch((err) => {
  console.error('scrapeWorldCup failed:', err.message);
  if (err.response) {
    console.error('API response:', err.response.data);
  }
  process.exit(1);
});
