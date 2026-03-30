import 'express-session';

declare module 'express-session' {
  interface SessionData {
    access_token?: string;
    email?: string;
    oauth_state?: string;
    code_verifier?: string;
  }
}
