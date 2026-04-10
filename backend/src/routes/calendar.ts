import { Router, Request, Response } from 'express';
import { addPartidosToCalendar } from '../services/googleCalendar';
import { Partido } from '../types/partido';

const router = Router();

const MAX_PARTIDOS = 50;

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.access_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// POST /api/calendar/add
router.post('/add', requireAuth, async (req: Request, res: Response) => {
  const { partidos, force = false } = req.body as { partidos: Partido[]; force?: boolean };

  if (!Array.isArray(partidos) || partidos.length === 0) {
    return res.status(400).json({ error: 'partidos array required' });
  }

  if (partidos.length > MAX_PARTIDOS) {
    return res.status(400).json({ error: `Máximo ${MAX_PARTIDOS} partidos por solicitud` });
  }

  const agregables = partidos.filter(
    (p) => !p.estado || p.estado === 'NS' || p.estado === 'LIVE'
  );
  if (agregables.length === 0) {
    return res.status(400).json({ error: 'No hay partidos pendientes para agregar' });
  }

  try {
    const result = await addPartidosToCalendar(
      req.session.access_token as string,
      agregables,
      force
    );
    return res.json(result);
  } catch (err) {
    console.error('Calendar error:', err);
    return res.status(500).json({ error: 'Error adding to calendar' });
  }
});

export default router;
