import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import session from 'express-session';
import authRoutes from './routes/auth';
import calendarRoutes from './routes/calendar';
import teamsRoutes from './routes/teams';
import fixturesRoutes from './routes/fixtures';
import leaguesRoutes from './routes/leagues';

const app = express();
const PORT = process.env.PORT || 3001;
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
  secret: process.env.SESSION_SECRET || 'dev-secret',
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

app.use('/api/auth', authRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/fixtures', fixturesRoutes);
app.use('/api/leagues', leaguesRoutes);

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
