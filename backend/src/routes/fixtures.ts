import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { Partido } from '../types/partido';

const router = Router();

// GET /api/fixtures?team_id=<uuid>&league_id=<uuid>&status=NS
router.get('/', async (req: Request, res: Response) => {
  const { team_id, league_id, status } = req.query;

  if (!team_id || typeof team_id !== 'string') {
    return res.status(400).json({ error: 'team_id query param required' });
  }

  const statusFilter = typeof status === 'string' ? status : 'NS';

  const { data, error } = await supabase
    .from('fixtures')
    .select(`
      id,
      date,
      venue,
      round,
      status,
      league_id,
      home_team:home_team_id ( id, name, logo ),
      away_team:away_team_id ( id, name, logo ),
      league:league_id ( name, logo )
    `)
    .or(`home_team_id.eq.${team_id},away_team_id.eq.${team_id}`)
    .eq('status', statusFilter)
    .order('date');

  if (error) {
    console.error('Supabase fixtures error:', error);
    return res.status(500).json({ error: 'Error fetching fixtures' });
  }

  let rows = data ?? [];

  if (league_id && typeof league_id === 'string') {
    rows = rows.filter((f) => f.league_id === league_id);
  }

  const partidos: Partido[] = rows.map((f) => {
    const homeTeam = f.home_team as unknown as { id: string; name: string; logo: string | null } | null;
    const awayTeam = f.away_team as unknown as { id: string; name: string; logo: string | null } | null;
    const league   = f.league   as unknown as { name: string; logo: string | null } | null;

    // Parse date in UTC and convert to ART (UTC-3) for display
    const d = new Date(f.date as string);
    const artOffset = -3 * 60 * 60 * 1000;
    const art = new Date(d.getTime() + artOffset);
    const fecha = art.toISOString().split('T')[0];
    const hora = art.toISOString().split('T')[1].slice(0, 5);

    return {
      id: f.id as string,
      equipo_local: homeTeam?.name ?? 'Desconocido',
      equipo_visitante: awayTeam?.name ?? 'Desconocido',
      logo_local: homeTeam?.logo ?? null,
      logo_visitante: awayTeam?.logo ?? null,
      fecha,
      hora,
      competicion: (f.round as string) ?? '',
      competicion_nombre: league?.name ?? '',
      competicion_logo: league?.logo ?? null,
      estadio: (f.venue as string) ?? undefined,
    };
  });

  return res.json(partidos);
});

export default router;
