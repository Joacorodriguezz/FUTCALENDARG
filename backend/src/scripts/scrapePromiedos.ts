import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const api = axios.create({
  baseURL: 'https://api.promiedos.com.ar',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.promiedos.com.ar/',
    'x-ver': '1.11.7.5',
  },
});

// ── Types ────────────────────────────────────────────────────────

interface PromiedosTeam {
  id: string;
  name: string;
  url_name: string;
}

interface PromiedosGame {
  id: string;
  stage_round_name?: string;
  teams: [PromiedosTeam, PromiedosTeam];
  status: { enum: number; name: string };
  start_time?: string;
}

// ── Helpers ──────────────────────────────────────────────────────

/** "25-03-2026 19:00" (ART = UTC-3) → ISO UTC string */
function parseART(startTime: string): string {
  const [datePart, timePart] = startTime.split(' ');
  const [day, month, year] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  // Build as UTC then subtract 3h offset (ART is UTC-3, so ART+3=UTC)
  const utc = Date.UTC(year, month - 1, day, hour + 3, minute);
  return new Date(utc).toISOString();
}

/** Map promiedos status enum → our status codes (matching API-Football convention) */
function mapStatus(enumVal: number): string {
  if (enumVal === 1) return 'NS';   // Not Started / Programado
  if (enumVal === 3) return 'FT';   // Full Time / Finalizado
  if (enumVal === 2) return 'LIVE'; // En juego
  return 'NS';
}

// ── Supabase upserts ─────────────────────────────────────────────

const leagueUuidCache = new Map<string, string>();

async function upsertLeague(promiedosId: string, name: string): Promise<string> {
  if (leagueUuidCache.has(promiedosId)) return leagueUuidCache.get(promiedosId)!;

  const { error } = await supabase.from('leagues').upsert(
    { promiedos_id: promiedosId, name, country: 'Argentina', active: true },
    { onConflict: 'promiedos_id' }
  );
  if (error) throw new Error(`League upsert failed (${promiedosId}): ${error.message}`);

  const { data, error: selErr } = await supabase
    .from('leagues').select('id').eq('promiedos_id', promiedosId).single();
  if (selErr) throw new Error(`League select failed: ${selErr.message}`);

  leagueUuidCache.set(promiedosId, data.id);
  return data.id as string;
}

const teamUuidCache = new Map<string, string>();

async function upsertTeam(team: PromiedosTeam, leagueUuid: string): Promise<string> {
  if (teamUuidCache.has(team.id)) return teamUuidCache.get(team.id)!;

  const { error } = await supabase.from('teams').upsert(
    {
      promiedos_id: team.id,
      name: team.name,
      league_id: leagueUuid,
      division: 'Liga Profesional',
    },
    { onConflict: 'promiedos_id' }
  );
  if (error) throw new Error(`Team upsert failed (${team.name}): ${error.message}`);

  const { data, error: selErr } = await supabase
    .from('teams').select('id').eq('promiedos_id', team.id).single();
  if (selErr) throw new Error(`Team select failed (${team.name}): ${selErr.message}`);

  teamUuidCache.set(team.id, data.id);
  return data.id as string;
}

async function upsertFixtures(rows: object[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase
      .from('fixtures')
      .upsert(batch, { onConflict: 'promiedos_id' });
    if (error) throw new Error(`Fixture upsert batch failed: ${error.message}`);
  }
}

// ── Fetch LP teams ───────────────────────────────────────────────

async function fetchLPTeamIds(): Promise<Set<string>> {
  const { data } = await api.get('/league/tables_and_fixtures/hc');
  const ids = new Set<string>();
  for (const group of (data.tables_groups ?? [])) {
    for (const table of (group.tables ?? [])) {
      for (const row of (table.table?.rows ?? [])) {
        const obj = row?.entity?.object;
        if (obj?.id) ids.add(obj.id);
      }
    }
  }
  return ids;
}

// ── Fetch all stage keys for a league ───────────────────────────

async function fetchStageFilters(leagueId: string): Promise<{ key: string; name: string }[]> {
  const { data } = await api.get(`/league/tables_and_fixtures/${leagueId}`);
  const filters: { key: string; name: string }[] = data?.games?.filters ?? [];
  // Skip "latest" — it's a subset of real stages
  return filters.filter(f => f.key !== 'latest');
}

// ── Process games for a league ───────────────────────────────────

async function processLeague(
  leaguePromiedosId: string,
  leagueName: string,
  lpTeamIds: Set<string>,
  filterToLPOnly: boolean
): Promise<void> {
  console.log(`\n── ${leagueName} ──`);

  const leagueUuid = await upsertLeague(leaguePromiedosId, leagueName);
  const filters = await fetchStageFilters(leaguePromiedosId);
  console.log(`  ${filters.length} stages encontrados`);

  let totalUpserted = 0;
  let totalSkipped = 0;

  for (const filter of filters) {
    const { data } = await api.get(`/league/games/${leaguePromiedosId}/${filter.key}`);
    const games: PromiedosGame[] = data?.games ?? [];

    const fixtureRows: object[] = [];

    for (const game of games) {
      if (!game.start_time) { totalSkipped++; continue; }

      const [homeTeam, awayTeam] = game.teams;

      // Copa Argentina: skip if neither team is from LP
      if (filterToLPOnly && !lpTeamIds.has(homeTeam.id) && !lpTeamIds.has(awayTeam.id)) {
        totalSkipped++;
        continue;
      }

      const homeUuid = await upsertTeam(homeTeam, leagueUuid);
      const awayUuid = await upsertTeam(awayTeam, leagueUuid);

      fixtureRows.push({
        promiedos_id:  game.id,
        date:          parseART(game.start_time),
        home_team_id:  homeUuid,
        away_team_id:  awayUuid,
        league_id:     leagueUuid,
        round:         game.stage_round_name ?? filter.name,
        status:        mapStatus(game.status.enum),
        venue:         null,
      });
    }

    if (fixtureRows.length > 0) {
      await upsertFixtures(fixtureRows);
      totalUpserted += fixtureRows.length;
    }

    process.stdout.write(`\r  ${filter.name}: ${fixtureRows.length} partidos`);
  }

  console.log(`\n  Total upserted: ${totalUpserted} | skipped: ${totalSkipped}`);
}

// ── Main ─────────────────────────────────────────────────────────

async function scrape() {
  console.log('Obteniendo equipos de Liga Profesional...');
  const lpTeamIds = await fetchLPTeamIds();
  console.log(`  ${lpTeamIds.size} equipos de primera división`);

  await processLeague('hc',  'Liga Profesional Argentina', lpTeamIds, false);
  await processLeague('gea', 'Copa Argentina',             lpTeamIds, true);
  await processLeague('bac', 'Copa Libertadores',          lpTeamIds, true);
  await processLeague('dij', 'Copa Sudamericana',          lpTeamIds, true);

  console.log('\nDone.');
}

scrape().catch(err => {
  console.error('scrapePromiedos failed:', err.message);
  process.exit(1);
});
