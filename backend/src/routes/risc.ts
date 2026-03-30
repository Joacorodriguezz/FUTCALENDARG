import { Router, Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';

const router = Router();

// ── In-memory blocklist ───────────────────────────────────────────
// Sessions for users in these sets get invalidated on next request.
export const revokedEmails = new Set<string>();
export const revokedSubs   = new Set<string>();

// ── JWKS cache ────────────────────────────────────────────────────
let jwksCache: { keys: any[]; fetchedAt: number } | null = null;
const JWKS_TTL = 60 * 60 * 1000; // 1 hour

async function getRiscJwks(): Promise<any[]> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL) {
    return jwksCache.keys;
  }
  const { data: config } = await axios.get(
    'https://accounts.google.com/.well-known/risc-configuration'
  );
  const { data: jwks } = await axios.get(config.jwks_uri);
  jwksCache = { keys: jwks.keys, fetchedAt: Date.now() };
  return jwksCache.keys;
}

// ── JWT verification ──────────────────────────────────────────────
async function verifyRiscToken(token: string): Promise<any> {
  const [headerB64, payloadB64, sigB64] = token.split('.');
  if (!headerB64 || !payloadB64 || !sigB64) throw new Error('Malformed token');

  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
  const keys   = await getRiscJwks();
  const jwk    = keys.find((k: any) => k.kid === header.kid);
  if (!jwk) throw new Error(`Unknown kid: ${header.kid}`);

  const pubKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const pem    = pubKey.export({ type: 'spki', format: 'pem' }) as string;

  const verifier = crypto.createVerify('SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  const valid = verifier.verify(pem, Buffer.from(sigB64, 'base64url'));
  if (!valid) throw new Error('Invalid signature');

  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  const now = Math.floor(Date.now() / 1000);

  if (payload.iss !== 'https://accounts.google.com') throw new Error('Invalid issuer');
  if (payload.aud !== process.env.GOOGLE_CLIENT_ID)   throw new Error('Invalid audience');
  if (payload.exp && payload.exp < now)                throw new Error('Token expired');

  return payload;
}

// ── Event types that require session revocation ───────────────────
const REVOKE_EVENTS = new Set([
  'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
  'https://schemas.openid.net/secevent/oauth/event-type/tokens-revoked',
  'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
  'https://schemas.openid.net/secevent/risc/event-type/account-purged',
  'https://schemas.openid.net/secevent/risc/event-type/credential-change',
]);

// ── POST /api/auth/risc ───────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const token = req.body; // raw JWT string
    if (typeof token !== 'string') {
      return res.status(400).json({ error: 'Expected raw JWT body' });
    }

    const payload = await verifyRiscToken(token);

    // Check if any event in the SET requires revocation
    const events: Record<string, any> = payload.events ?? {};
    const shouldRevoke = Object.keys(events).some(e => REVOKE_EVENTS.has(e));

    if (shouldRevoke) {
      // sub is the Google Account ID
      if (payload.sub) revokedSubs.add(String(payload.sub));

      // Subject identifier can also carry email
      for (const eventData of Object.values(events) as any[]) {
        const subj = eventData?.subject;
        if (subj?.subject_type === 'email' && subj.email) {
          revokedEmails.add(subj.email.toLowerCase());
        }
      }

      console.log(`[RISC] Revoked sub=${payload.sub} events=${Object.keys(events).join(', ')}`);
    }

    // Google expects 202 with empty body
    return res.status(202).send();
  } catch (err: any) {
    console.error('[RISC] Error:', err.message);
    // Return 400 so Google knows the token was rejected
    return res.status(400).json({ error: err.message });
  }
});

export default router;
