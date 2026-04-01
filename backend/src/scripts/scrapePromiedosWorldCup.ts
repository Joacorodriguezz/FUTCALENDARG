/**
 * Partidos del Mundial 2026 desde Promiedos (liga fjda) — las 48 selecciones.
 * Intenta reutilizar el mismo UUID de `teams` que football-data (division = World Cup)
 * comparando nombres canónicos (Francia ↔ France, etc.).
 *
 * Ejecutar después de tener la liga Mundial en DB (scrape-worldcup football-data).
 *
 * Uso: npm run scrape-promiedos-wc
 */

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

/** Liga FIFA World Cup en promiedos.com.ar/league/fifa-world-cup/fjda */
const PROMIEDOS_WC_LEAGUE_ID = 'fjda';

// ── Mapeo canónico: español/promiedos ↔ inglés/football-data ──────
// Cada entrada: [clave canónica en inglés, ...variantes en español e inglés]
const TEAM_ALIASES: [string, ...string[]][] = [
  ['mexico', 'méxico', 'mexico'],
  ['south africa', 'sudáfrica', 'sudafrica', 'south africa'],
  ['south korea', 'corea del sur', 'south korea', 'korea republic', 'republic of korea', 'rep. corea', 'rep. de corea', 'corea del s.'],
  ['czech republic', 'república checa', 'rep. checa', 'chequia', 'czechia', 'czech republic'],
  ['canada', 'canadá', 'canada'],
  ['bosnia and herzegovina', 'bosnia y herzegovina', 'bosnia', 'bosnia and herzegovina', 'bosnia-herzegovina', 'bosnia herzegovina'],
  ['qatar', 'catar', 'qatar'],
  ['switzerland', 'suiza', 'switzerland'],
  ['brazil', 'brasil', 'brazil'],
  ['morocco', 'marruecos', 'morocco'],
  ['haiti', 'haití', 'haiti'],
  ['scotland', 'escocia', 'scotland'],
  ['united states', 'estados unidos', 'ee.uu.', 'eeuu', 'usa', 'united states', 'united states of america', 'eua'],
  ['australia', 'australia'],
  ['turkey', 'turquía', 'turquia', 'turkey', 'türkiye', 'turkiye'],
  ['germany', 'alemania', 'germany'],
  ['curacao', 'curazao', 'curação', 'curaçao', 'curacao'],
  ['ivory coast', "costa de marfil", "côte d'ivoire", "cote d'ivoire", 'ivory coast', 'costa de marfil', 'cote divoire'],
  ['ecuador', 'ecuador'],
  ['netherlands', 'países bajos', 'paises bajos', 'holanda', 'netherlands', 'holland'],
  ['japan', 'japón', 'japon', 'japan'],
  ['sweden', 'suecia', 'sweden'],
  ['tunisia', 'túnez', 'tunez', 'tunisia'],
  ['belgium', 'bélgica', 'belgica', 'belgium'],
  ['egypt', 'egipto', 'egypt'],
  ['iran', 'irán', 'iran'],
  ['new zealand', 'nueva zelanda', 'new zealand'],
  ['spain', 'españa', 'spain'],
  ['cabo verde', 'cabo verde', 'cape verde', 'cape verde islands'],
  ['saudi arabia', 'arabia saudita', 'a. saudita', 'saudi arabia'],
  ['uruguay', 'uruguay'],
  ['france', 'francia', 'france'],
  ['senegal', 'senegal'],
  ['iraq', 'irak', 'iraq'],
  ['norway', 'noruega', 'norway'],
  ['argentina', 'argentina'],
  ['algeria', 'argelia', 'algeria'],
  ['austria', 'austria'],
  ['jordan', 'jordania', 'jordan'],
  ['portugal', 'portugal'],
  ['dr congo', 'rd congo', 'r.d. congo', 'rep. dem. del congo', 'rd del congo', 'dr congo', 'congo dr', 'democratic republic of congo'],
  ['uzbekistan', 'uzbekistán', 'uzbekistan'],
  ['colombia', 'colombia'],
  ['england', 'inglaterra', 'england'],
  ['croatia', 'croacia', 'croatia'],
  ['ghana', 'ghana'],
  ['panama', 'panamá', 'panama'],
];

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/'/g, "'")
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Construir mapa: nombre normalizado → clave canónica
const CANONICAL_MAP = new Map<string, string>();
for (const [canonical, ...aliases] of TEAM_ALIASES) {
  for (const alias of [canonical, ...aliases]) {
    CANONICAL_MAP.set(normalize(alias), normalize(canonical));
  }
}

/** Devuelve clave canónica o null si no es selección del Mundial */
function teamCanonicalKey(name: string): string | null {
  const n = normalize(name);

  // Búsqueda exacta
  if (CANONICAL_MAP.has(n)) return CANONICAL_MAP.get(n)!;

  // Búsqueda parcial (por si Promiedos acorta nombres)
  for (const [alias, canonical] of CANONICAL_MAP.entries()) {
    if (n.includes(alias) || alias.includes(n)) return canonical;
  }

  return null;
}

/** ¿AMBOS equipos son selecciones del Mundial 2026? */
function isWorldCupMatch(home: string, away: string): boolean {
  return teamCanonicalKey(home) != null && teamCanonicalKey(away) != null;
}

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

function parseART(startTime: string): string {
  const [datePart, timePart] = startTime.split(' ');
  const [day, month, year] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const utc = Date.UTC(year, month - 1, day, hour + 3, minute);
  return new Date(utc).toISOString();
}

function mapStatus(enumVal: number): string {
  if (enumVal === 1) return 'NS';
  if (enumVal === 3) return 'FT';
  if (enumVal === 2) return 'LIVE';
  return 'NS';
}

// ── Supabase helpers ─────────────────────────────────────────────

async function getWorldCupLeagueUuid(): Promise<string> {
  const tryQuery = async (pattern: string) => {
    const { data, error } = await supabase
      .from('leagues')
      .select('id')
      .ilike('name', pattern)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Leagues query: ${error.message}`);
    return data?.id as string | undefined;
  };

  const id =
    (await tryQuery('%World Cup%')) ??
    (await tryQuery('%FIFA%')) ??
    (await tryQuery('%Mundial%'));

  if (!id) {
    throw new Error(
      'No hay liga de Mundial en la base. Ejecutá primero: npm run scrape-worldcup'
    );
  }
  return id;
}

let wcTeamCache: { id: string; name: string }[] | null = null;

async function loadWcTeams(): Promise<void> {
  const { data, error } = await supabase
    .from('teams')
    .select('id,name')
    .eq('division', 'World Cup');
  if (error) throw new Error(`Teams query: ${error.message}`);
  wcTeamCache = data ?? [];
}

async function resolveTeamUuid(promiedosTeam: PromiedosTeam, wcLeagueId: string): Promise<string> {
  if (!wcTeamCache) await loadWcTeams();

  // 1. Buscar por clave canónica (español ↔ inglés)
  const key = teamCanonicalKey(promiedosTeam.name);
  if (key) {
    const byCanon = wcTeamCache!.find((t) => teamCanonicalKey(t.name) === key);
    if (byCanon) return byCanon.id;
  }

  // 2. Búsqueda exacta por nombre normalizado
  const byExact = wcTeamCache!.find(
    (t) => normalize(t.name) === normalize(promiedosTeam.name)
  );
  if (byExact) return byExact.id;

  // 3. Si no existe, crear nuevo team
  console.log(`\n  ⚠ Equipo no encontrado en DB, creando: ${promiedosTeam.name}`);
  const { error } = await supabase.from('teams').upsert(
    {
      promiedos_id: promiedosTeam.id,
      name: promiedosTeam.name,
      league_id: wcLeagueId,
      division: 'World Cup',
    },
    { onConflict: 'promiedos_id' }
  );
  if (error) throw new Error(`Team upsert ${promiedosTeam.name}: ${error.message}`);

  const { data, error: selErr } = await supabase
    .from('teams')
    .select('id')
    .eq('promiedos_id', promiedosTeam.id)
    .single();
  if (selErr || !data) throw new Error(`Team select ${promiedosTeam.name}: ${selErr?.message}`);

  const id = data.id as string;
  wcTeamCache!.push({ id, name: promiedosTeam.name });
  return id;
}

async function fetchStageFilters(leagueId: string): Promise<{ key: string; name: string }[]> {
  const { data } = await api.get(`/league/tables_and_fixtures/${leagueId}`);
  const filters: { key: string; name: string }[] = data?.games?.filters ?? [];
  return filters.filter((f) => {
    if (f.key === 'latest') return false;
    // Excluir etapas de eliminatorias / clasificación
    const n = f.name.toLowerCase();
    if (n.includes('eliminatoria') || n.includes('clasificaci')) return false;
    return true;
  });
}

async function upsertFixtures(rows: object[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from('fixtures').upsert(batch, { onConflict: 'promiedos_id' });
    if (error) throw new Error(`Fixture upsert: ${error.message}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log('Promiedos — Mundial 2026 (fjda) — 48 selecciones\n');

  const wcLeagueId = await getWorldCupLeagueUuid();
  console.log(`  Liga Mundial UUID: ${wcLeagueId}\n`);

  await loadWcTeams();
  console.log(`  Equipos World Cup en DB (cache): ${wcTeamCache?.length ?? 0}\n`);

  const filters = await fetchStageFilters(PROMIEDOS_WC_LEAGUE_ID);
  console.log(`  ${filters.length} etapas/fechas en Promiedos (fjda)\n`);

  let total = 0;
  let skipped = 0;
  let filteredOut = 0;

  for (const filter of filters) {
    const { data } = await api.get(`/league/games/${PROMIEDOS_WC_LEAGUE_ID}/${filter.key}`);
    const games: PromiedosGame[] = data?.games ?? [];
    const batch: object[] = [];

    for (const game of games) {
      if (!game.start_time) {
        skipped++;
        continue;
      }
      const [home, away] = game.teams;

      // Filtrar partidos que no son de las 48 selecciones
      if (!isWorldCupMatch(home.name, away.name)) {
        filteredOut++;
        continue;
      }

      const homeUuid = await resolveTeamUuid(home, wcLeagueId);
      const awayUuid = await resolveTeamUuid(away, wcLeagueId);

      batch.push({
        promiedos_id: game.id,
        date: parseART(game.start_time),
        home_team_id: homeUuid,
        away_team_id: awayUuid,
        league_id: wcLeagueId,
        round: game.stage_round_name ?? filter.name,
        status: mapStatus(game.status.enum),
        venue: null,
      });
    }

    if (batch.length > 0) {
      await upsertFixtures(batch);
      total += batch.length;
    }
    process.stdout.write(`\r  ${filter.name}: +${batch.length} partidos`);
  }

  console.log(`\n\n  Total insertados/actualizados: ${total}`);
  if (skipped > 0) console.log(`  Sin horario (omitidos): ${skipped}`);
  if (filteredOut > 0) console.log(`  Filtrados (no son selecciones del Mundial): ${filteredOut}`);
  console.log('Done.');
}

main().catch((err) => {
  console.error('scrapePromiedosWorldCup failed:', err.message);
  process.exit(1);
});
