import axios from 'axios';
import fs from 'fs';
import path from 'path';

const api = axios.create({
  baseURL: 'https://api.promiedos.com.ar',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.promiedos.com.ar/',
    'x-ver': '1.11.7.5',
  },
});

const LEAGUES = [
  { id: 'hc',  name: 'Liga Profesional Argentina' },
  { id: 'gea', name: 'Copa Argentina' },
  { id: 'bac', name: 'Copa Libertadores' },
  { id: 'dij', name: 'Copa Sudamericana' },
];

interface Game {
  id: string;
  stage_round_name?: string;
  teams: { id: string; name: string; url_name: string }[];
  scores?: number[];
  status: { enum: number; name: string };
  start_time?: string;
}

async function fetchFilters(leagueId: string): Promise<{ key: string; name: string }[]> {
  const { data } = await api.get(`/league/tables_and_fixtures/${leagueId}`);
  const filters: { key: string; name: string }[] = data?.games?.filters ?? [];
  return filters.filter(f => f.key !== 'latest');
}

async function fetchGames(leagueId: string, filterKey: string): Promise<Game[]> {
  const { data } = await api.get(`/league/games/${leagueId}/${filterKey}`);
  return data?.games ?? [];
}

async function main() {
  const result: Record<string, { league: string; fixtures: object[] }> = {};

  for (const league of LEAGUES) {
    console.log(`Fetching ${league.name} (${league.id})...`);
    const filters = await fetchFilters(league.id);
    console.log(`  ${filters.length} stages`);

    const fixtures: object[] = [];

    for (const filter of filters) {
      const games = await fetchGames(league.id, filter.key);

      for (const game of games) {
        if (!game.start_time) continue;
        fixtures.push({
          id:         game.id,
          league:     league.name,
          round:      game.stage_round_name ?? filter.name,
          home_team:  game.teams[0]?.name,
          away_team:  game.teams[1]?.name,
          start_time: game.start_time,
          status:     game.status.name,
          scores:     game.scores ?? null,
        });
      }
    }

    result[league.id] = { league: league.name, fixtures };
    console.log(`  ${fixtures.length} partidos`);
  }

  const outPath = path.join(__dirname, '../../../../scrape-output.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\nGuardado en: ${outPath}`);

  // Resumen
  for (const [id, val] of Object.entries(result)) {
    console.log(`  ${val.league}: ${val.fixtures.length} partidos`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
