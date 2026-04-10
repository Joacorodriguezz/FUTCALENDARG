/**
 * Scraper genérico para ligas internacionales via football-data.org (API v4).
 *
 * Uso:
 *   npm run scrape-leagues              # scrapea todas las ligas configuradas
 *   npm run scrape-leagues -- PL CL SA  # scrapea solo las ligas indicadas
 *
 * Logos: guarda las URLs de crest/emblem de football-data.org directamente
 * en teams.logo / leagues.logo (campo text en PostgreSQL, sin usar Supabase Storage).
 *
 * Temporada: se calcula automáticamente.
 *   - Ligas europeas y CL: si el mes actual >= agosto → año actual, si no → año anterior.
 *   - BSA (liga brasileña, enero-diciembre): siempre el año actual.
 */

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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const api = axios.create({
  baseURL: 'https://api.football-data.org/v4',
  headers: { 'X-Auth-Token': FOOTBALL_DATA_API_KEY },
});

// ── Configuración de ligas ────────────────────────────────────────

interface LeagueConfig {
  code: string;
  country: string;
  /** true para ligas con temporada enero-diciembre (ej. BSA) */
  calendarYear?: boolean;
}

const ALL_LEAGUES: LeagueConfig[] = [
  { code: 'PL',  country: 'England' },
  { code: 'CL',  country: 'International' },
  { code: 'SA',  country: 'Italy' },
  { code: 'PD',  country: 'Spain' },
  { code: 'BL1', country: 'Germany' },
  { code: 'FL1', country: 'France' },
  { code: 'DED', country: 'Netherlands' },
  { code: 'BSA', country: 'Brazil', calendarYear: true },
  { code: 'PPL', country: 'Portugal' },
  { code: 'ELC', country: 'England' },
  { code: 'EC',  country: 'International' },
];

// ── Temporada dinámica ────────────────────────────────────────────

/**
 * Ligas europeas y CL: la temporada arranca en agosto.
 *   agosto-diciembre → año actual
 *   enero-julio      → año anterior
 */
function getEuropeanSeason(): number {
  const now = new Date();
  return now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/** BSA y ligas de año calendario: siempre el año actual. */
function getCalendarSeason(): number {
  return new Date().getFullYear();
}

function getSeasonForLeague(cfg: LeagueConfig): number {
  return cfg.calendarYear ? getCalendarSeason() : getEuropeanSeason();
}

// ── Rate limiting ─────────────────────────────────────────────────

/** Free tier: 10 req/min → espaciamos 6.5 s entre requests. */
const MIN_MS_BETWEEN_REQUESTS = Number(process.env.FOOTBALL_DATA_MIN_INTERVAL_MS ?? 6500);
let lastRequestAt = 0;

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function parse429WaitSeconds(err: unknown): number {
  if (!axios.isAxiosError(err) || err.response?.status !== 429) return 60;
  const body = err.response?.data as { message?: string } | undefined;
  const m = (body?.message ?? '').match(/(\d+)\s*second/i);
  if (m) return Math.min(parseInt(m[1], 10) + 3, 120);
  const ra = err.response?.headers?.['retry-after'];
  if (ra) {
    const n = parseInt(String(ra), 10);
    if (!Number.isNaN(n)) return Math.min(n + 3, 120);
  }
  return 60;
}

async function fdGet<T>(path: string): Promise<T> {
  const elapsed = Date.now() - lastRequestAt;
  if (lastRequestAt > 0 && elapsed < MIN_MS_BETWEEN_REQUESTS) {
    const w = MIN_MS_BETWEEN_REQUESTS - elapsed;
    console.log(`  (pausa ${Math.ceil(w / 1000)}s — límite football-data.org)`);
    await sleep(w);
  }
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      const { data } = await api.get<T>(path);
      lastRequestAt = Date.now();
      return data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 429) {
          const sec = parse429WaitSeconds(err);
          console.warn(`  429 rate limit — esperando ${sec}s (reintento ${attempt + 1}/15)...`);
          await sleep(sec * 1000);
          continue;
        }
        // 4xx/5xx: enriquecer el mensaje con el path y la respuesta de la API
        const body = err.response?.data as { message?: string } | undefined;
        const detail = body?.message ?? err.message;
        throw new Error(`HTTP ${status ?? '?'} en ${path}: ${detail}`);
      }
      throw err;
    }
  }
  throw new Error('football-data.org: demasiados errores 429');
}

// ── Types ─────────────────────────────────────────────────────────

interface FdCompetition {
  id: number;
  name: string;
  emblem: string | null;
}

interface FdTeam {
  id: number;
  name: string;
  crest: string | null;
}

interface FdMatch {
  id: number;
  utcDate: string;
  status: string;
  stage: string;
  group: string | null;
  matchday: number | null;
  homeTeam: { id: number; name: string } | null;
  awayTeam: { id: number; name: string } | null;
  venue: string | null;
}

interface TeamsResponse  { teams: FdTeam[] }
interface MatchesResponse { matches: FdMatch[]; resultSet?: { count?: number } }

const PAGE_SIZE = 200;

async function fetchTeams(code: string, season: number): Promise<FdTeam[]> {
  const data = await fdGet<TeamsResponse>(
    `/competitions/${code}/teams?season=${season}&limit=500`
  );
  return data.teams ?? [];
}

async function fetchMatches(code: string, season: number): Promise<FdMatch[]> {
  const all: FdMatch[] = [];
  let offset = 0;
  let reported: number | undefined;

  for (;;) {
    const data = await fdGet<MatchesResponse>(
      `/competitions/${code}/matches?season=${season}&limit=${PAGE_SIZE}&offset=${offset}`
    );
    if (offset === 0 && data.resultSet?.count != null) {
      reported = data.resultSet.count;
      console.log(`  La API indica ${reported} partidos (season=${season})`);
    }
    const batch = data.matches ?? [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (reported != null && all.length < reported) {
    console.warn(`  Aviso: recibidos ${all.length} partidos pero resultSet.count=${reported}`);
  }
  return all;
}

// ── Helpers ───────────────────────────────────────────────────────

function mapStatus(status: string): string {
  if (['SCHEDULED', 'TIMED'].includes(status)) return 'NS';
  if (['IN_PLAY', 'PAUSED'].includes(status)) return 'LIVE';
  if (['FINISHED', 'AWARDED'].includes(status)) return 'FT';
  if (['POSTPONED', 'CANCELLED', 'SUSPENDED'].includes(status)) return 'PP';
  return 'NS';
}

function buildRound(match: FdMatch): string {
  if (match.matchday) return `Matchday ${match.matchday}`;
  if (match.group)    return `${match.stage} - ${match.group}`;
  return match.stage;
}

// ── Supabase upserts ──────────────────────────────────────────────

const leagueUuidCache = new Map<string, string>();
const teamUuidCache   = new Map<string, string>();

async function upsertLeague(
  fdId: number,
  name: string,
  logo: string | null,
  country: string
): Promise<string> {
  const promiedosId = `fd_${fdId}`;
  if (leagueUuidCache.has(promiedosId)) return leagueUuidCache.get(promiedosId)!;

  const { error } = await supabase.from('leagues').upsert(
    { promiedos_id: promiedosId, name, logo, country, active: true },
    { onConflict: 'promiedos_id' }
  );
  if (error) throw new Error(`League upsert failed (${promiedosId}): ${error.message}`);

  const { data, error: selErr } = await supabase
    .from('leagues').select('id').eq('promiedos_id', promiedosId).single();
  if (selErr) throw new Error(`League select failed: ${selErr.message}`);

  leagueUuidCache.set(promiedosId, data.id);
  return data.id as string;
}

async function upsertTeam(
  fdId: number,
  name: string,
  crest: string | null,
  leagueUuid: string,
  division: string
): Promise<string> {
  const promiedosId = `fd_${fdId}`;
  if (teamUuidCache.has(promiedosId)) return teamUuidCache.get(promiedosId)!;

  const { error } = await supabase.from('teams').upsert(
    { promiedos_id: promiedosId, name, logo: crest, league_id: leagueUuid, division },
    { onConflict: 'promiedos_id' }
  );
  if (error) throw new Error(`Team upsert failed (${name}): ${error.message}`);

  const { data, error: selErr } = await supabase
    .from('teams').select('id').eq('promiedos_id', promiedosId).single();
  if (selErr) throw new Error(`Team select failed: ${selErr.message}`);

  teamUuidCache.set(promiedosId, data.id);
  return data.id as string;
}

async function upsertFixtures(rows: object[]): Promise<void> {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase
      .from('fixtures')
      .upsert(batch, { onConflict: 'promiedos_id' });
    if (error) throw new Error(`Fixtures upsert batch failed: ${error.message}`);
  }
}

// ── Scrape una liga ───────────────────────────────────────────────

async function scrapeLeague(cfg: LeagueConfig): Promise<void> {
  const season = getSeasonForLeague(cfg);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Liga: ${cfg.code}  |  Temporada: ${season}  |  País: ${cfg.country}`);
  console.log('═'.repeat(60));

  // 1. Competición
  console.log('── Fetching competition info ──');
  const comp = await fdGet<FdCompetition>(`/competitions/${cfg.code}`);
  const leagueUuid = await upsertLeague(comp.id, comp.name, comp.emblem, cfg.country);
  console.log(`  Upserted: ${comp.name} (UUID: ${leagueUuid})`);

  // 2. Equipos
  console.log('── Fetching teams ──');
  let teams: FdTeam[] = [];
  try {
    teams = await fetchTeams(cfg.code, season);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      console.warn(`  Sin equipos para season=${season} — la temporada puede no haber arrancado aún.`);
    } else {
      throw err;
    }
  }
  console.log(`  Found ${teams.length} teams`);

  for (const t of teams) {
    await upsertTeam(t.id, t.name, t.crest, leagueUuid, comp.name);
    process.stdout.write(`\r  Upserted: ${t.name.padEnd(40)}`);
  }
  if (teams.length > 0) console.log();

  // 3. Partidos
  console.log('── Fetching matches ──');
  let matches: FdMatch[] = [];
  try {
    matches = await fetchMatches(cfg.code, season);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      console.warn(`  Sin partidos para season=${season}.`);
      return;
    }
    throw err;
  }
  console.log(`  Found ${matches.length} matches`);

  const fixtureRows: object[] = [];
  let skippedTbd = 0;

  for (const match of matches) {
    const ht = match.homeTeam;
    const at = match.awayTeam;

    // Omitir cruces sin rivales definidos (TBD / playoffs sin sortear)
    if (!ht?.name || !at?.name || ht.id == null || at.id == null) {
      skippedTbd++;
      continue;
    }

    // Asegurar que ambos equipos existen en la DB (pueden no estar en /teams si son de otra liga)
    let homeUuid = teamUuidCache.get(`fd_${ht.id}`);
    if (!homeUuid) {
      homeUuid = await upsertTeam(ht.id, ht.name, null, leagueUuid, comp.name);
    }
    let awayUuid = teamUuidCache.get(`fd_${at.id}`);
    if (!awayUuid) {
      awayUuid = await upsertTeam(at.id, at.name, null, leagueUuid, comp.name);
    }

    fixtureRows.push({
      promiedos_id: `fd_${match.id}`,
      date: match.utcDate,
      home_team_id: homeUuid,
      away_team_id: awayUuid,
      league_id: leagueUuid,
      round: buildRound(match),
      status: mapStatus(match.status),
      venue: match.venue ?? null,
    });
  }

  await upsertFixtures(fixtureRows);
  console.log(`  Upserted ${fixtureRows.length} fixtures`);
  if (skippedTbd > 0) {
    console.log(`  Omitidos ${skippedTbd} partidos TBD (rivales sin definir)`);
  }
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  // Si se pasan códigos como args CLI, filtrar; si no, scrapear todos
  const cliCodes = process.argv.slice(2).map((c) => c.toUpperCase());
  const leaguesToScrape = cliCodes.length > 0
    ? ALL_LEAGUES.filter((l) => cliCodes.includes(l.code))
    : ALL_LEAGUES;

  if (cliCodes.length > 0) {
    const unknown = cliCodes.filter((c) => !ALL_LEAGUES.some((l) => l.code === c));
    if (unknown.length > 0) {
      console.warn(`Advertencia: códigos desconocidos y omitidos → ${unknown.join(', ')}`);
    }
  }

  if (leaguesToScrape.length === 0) {
    console.error('No hay ligas para scrapear. Revisá los códigos pasados como argumento.');
    process.exit(1);
  }

  console.log(`\nScraping ${leaguesToScrape.length} liga(s): ${leaguesToScrape.map((l) => l.code).join(', ')}`);
  console.log(`Temporada europea: ${getEuropeanSeason()} | Temporada calendario: ${getCalendarSeason()}\n`);

  const failed: string[] = [];

  for (const cfg of leaguesToScrape) {
    try {
      await scrapeLeague(cfg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n  ERROR en ${cfg.code}: ${msg}`);
      if (msg.includes('HTTP 4') || msg.includes('HTTP 5')) {
        console.error(`  → Posible causa: la liga ${cfg.code} no está disponible en tu tier de football-data.org,`);
        console.error(`    o la temporada ${getSeasonForLeague(cfg)} no existe para esa competición.`);
      }
      failed.push(cfg.code);
    }
  }

  const succeeded = leaguesToScrape.length - failed.length;
  console.log(`\n\nDone. ${succeeded}/${leaguesToScrape.length} liga(s) scrapeadas correctamente.`);
  if (failed.length > 0) {
    console.warn(`Fallaron: ${failed.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('\nscrapeLeagues: error inesperado:', err instanceof Error ? err.message : err);
  process.exit(1);
});
