import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// GET /api/teams?league_id=&division=
router.get('/', async (req: Request, res: Response) => {
  const { league_id, division } = req.query;

  let query = supabase
    .from('teams')
    .select('id, name, logo, league_id, division')
    .order('name');

  if (league_id && typeof league_id === 'string') {
    query = query.eq('league_id', league_id);
  }
  if (division && typeof division === 'string') {
    query = query.eq('division', division);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Supabase teams error:', error);
    return res.status(500).json({ error: 'Error fetching teams' });
  }

  return res.json(data ?? []);
});

export default router;
