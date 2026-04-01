import { loadBackendEnv } from './lib/loadEnv';

loadBackendEnv();

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import calendarRoutes from './routes/calendar';
import teamsRoutes from './routes/teams';
import fixturesRoutes from './routes/fixtures';
import leaguesRoutes from './routes/leagues';
import riscRoutes, { revokedEmails, revokedSubs } from './routes/risc';

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET env var is not set');
  process.exit(1);
}
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const isProd = process.env.NODE_ENV === 'production';

// Required for Railway/Render: they sit behind a reverse proxy,
// so Express needs to trust X-Forwarded-* headers for req.secure to work.
if (isProd) app.set('trust proxy', 1);

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 900000, // 15 minutes
    httpOnly: true,
    // In production: secure=true (HTTPS only) + sameSite='none' (required for
    // cross-domain cookies between Vercel frontend and Railway/Render backend).
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  },
}));

// Rate limiters — protect Google Calendar API quota and prevent abuse
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá de nuevo en 15 minutos' },
});

const calendarLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intentá de nuevo en 15 minutos' },
});

app.use('/api/auth/google', authLimiter);
app.use('/api/calendar/add', calendarLimiter);

// RISC endpoint — Google sends raw JWT as text/plain
app.use('/api/auth/risc', express.text({ type: '*/*' }), riscRoutes);

// Blocklist middleware: invalidate sessions for revoked accounts
app.use((req, res, next) => {
  const sess = req.session as any;
  if (
    sess.email && revokedEmails.has(sess.email.toLowerCase()) ||
    sess.google_sub && revokedSubs.has(sess.google_sub)
  ) {
    return req.session.destroy(() => res.status(401).json({ error: 'Session revoked' }));
  }
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/fixtures', fixturesRoutes);
app.use('/api/leagues', leaguesRoutes);

// Keep-alive health check — pings Supabase to prevent free-tier sleep
app.get('/api/health', async (_req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    await sb.from('leagues').select('id').limit(1);
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(500).json({ status: 'error', timestamp: new Date().toISOString() });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
