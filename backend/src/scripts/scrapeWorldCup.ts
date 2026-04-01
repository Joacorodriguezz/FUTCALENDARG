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
  headers: {
    'X-Auth-Token': FOOTBALL_DATA_API_KEY,
  },
});

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
  const { data: compData } = await api.get<FootballDataCompetition>('/competitions/WC');
  const leagueUuid = await upsertLeague(
    compData.id,
    'FIFA World Cup 2026',
    compData.emblem
  );
  console.log(`  Upserted league: ${compData.name} (UUID: ${leagueUuid})\n`);

  // 2. Fetch teams
  console.log('── Fetching teams ──');
  const { data: teamsData } = await api.get<{ teams: FootballDataTeam[] }>(
    '/competitions/WC/teams'
  );
  const teams = teamsData.teams;
  console.log(`  Found ${teams.length} teams`);

  for (const team of teams) {
    await upsertTeam(team, leagueUuid);
    process.stdout.write(`\r  Upserted: ${team.name.padEnd(40)}`);
  }
  console.log('\n');

  // 3. Fetch matches
  console.log('── Fetching matches ──');
  const { data: matchesData } = await api.get<{ matches: FootballDataMatch[] }>(
    '/competitions/WC/matches'
  );
  const matches = matchesData.matches;
  console.log(`  Found ${matches.length} matches`);

  const fixtureRows: object[] = [];

  for (const match of matches) {
    // Skip matches with TBD/null teams (playoffs not yet determined)
    if (!match.homeTeam?.name || !match.awayTeam?.name) {
      continue;
    }

    const homePromiedosId = `fd_${match.homeTeam.id}`;
    const awayPromiedosId = `fd_${match.awayTeam.id}`;

    // Get team UUIDs from cache, or upsert if not found (handles teams not in /teams endpoint)
    let homeUuid = teamUuidCache.get(homePromiedosId);
    if (!homeUuid) {
      // Team not in cache - create minimal team object and upsert
      const homeTeamObj: FootballDataTeam = {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        shortName: match.homeTeam.name,
        tla: '',
        crest: null,
      };
      homeUuid = await upsertTeam(homeTeamObj, leagueUuid);
      process.stdout.write(`\r  Added team from match: ${match.homeTeam.name.padEnd(40)}`);
    }

    let awayUuid = teamUuidCache.get(awayPromiedosId);
    if (!awayUuid) {
      // Team not in cache - create minimal team object and upsert
      const awayTeamObj: FootballDataTeam = {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        shortName: match.awayTeam.name,
        tla: '',
        crest: null,
      };
      awayUuid = await upsertTeam(awayTeamObj, leagueUuid);
      process.stdout.write(`\r  Added team from match: ${match.awayTeam.name.padEnd(40)}`);
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
  console.log(`  Upserted ${fixtureRows.length} fixtures\n`);

  console.log('Done.');
}

scrapeWorldCup().catch((err) => {
  console.error('scrapeWorldCup failed:', err.message);
  if (err.response) {
    console.error('API response:', err.response.data);
  }
  process.exit(1);
});
