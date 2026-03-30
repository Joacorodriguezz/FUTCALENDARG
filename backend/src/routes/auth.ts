import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import crypto from 'crypto';

const router = Router();

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// GET /api/auth/google
router.get('/google', (req: Request, res: Response) => {
  const state        = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  req.session.oauth_state    = state;
  req.session.code_verifier  = codeVerifier;

  const oauth2Client = getOAuthClient();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    state,
    include_granted_scopes: true,
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  } as any);
  res.redirect(authUrl);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const { code, state } = req.query;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!code || typeof code !== 'string') {
    return res.redirect(`${FRONTEND_URL}?auth=error`);
  }

  // CSRF check
  if (!state || state !== req.session.oauth_state) {
    return res.redirect(`${FRONTEND_URL}?auth=error`);
  }
  req.session.oauth_state = undefined;

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken({
      code,
      codeVerifier: req.session.code_verifier,
    });
    req.session.code_verifier = undefined;
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
