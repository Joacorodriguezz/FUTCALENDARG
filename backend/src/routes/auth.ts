import { Router, Request, Response } from 'express';
import { google } from 'googleapis';

const router = Router();

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// GET /api/auth/google
router.get('/google', (_req: Request, res: Response) => {
  const oauth2Client = getOAuthClient();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.events',
    ],
  });
  res.redirect(authUrl);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code } = req.query;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!code || typeof code !== 'string') {
    return res.redirect(`${FRONTEND_URL}?auth=error`);
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();

    req.session.access_token = tokens.access_token ?? undefined;
    req.session.email = data.email ?? undefined;

    return res.redirect(`${FRONTEND_URL}?auth=success`);
  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.redirect(`${FRONTEND_URL}?auth=error`);
  }
});

// GET /api/auth/status
router.get('/status', (req: Request, res: Response) => {
  if (req.session.access_token) {
    res.json({ authenticated: true, email: req.session.email });
  } else {
    res.json({ authenticated: false });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

export default router;
