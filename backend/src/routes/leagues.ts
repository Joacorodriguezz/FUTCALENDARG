import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';

const router = Router();

// GET /api/leagues
router.get('/', async (_req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('leagues')
    .select('id, name, logo, active')
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('Supabase leagues error:', error);
    return res.status(500).json({ error: 'Error fetching leagues' });
  }

  return res.json(data ?? []);
});

export default router;
