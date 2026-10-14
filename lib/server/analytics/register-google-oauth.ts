import "server-only";
import { exchangeCodeForTokens, refreshAccessToken } from "./google-oauth";
import { _setTokenExchange, _setTokenRefresh } from "./tokens";

/**
 * Phase B Step 2 (PR-A): Register the real Google OAuth implementations.
 *
 * Import this module (for its side effect) from any route or server component
 * that uses the token lifecycle. This wires the injectable network layer in
 * `tokens.ts` to the real Google endpoints. Tests override these with mocks
 * via `_setTokenExchange` / `_setTokenRefresh`.
 *
 * Registration is idempotent: calling it multiple times is safe.
 */
let registered = false;

export function registerGoogleOAuth(): void {
  if (registered) return;
  _setTokenExchange(exchangeCodeForTokens);
  _setTokenRefresh(refreshAccessToken);
  registered = true;
}

// Auto-register on import so routes get the real implementation by default.
registerGoogleOAuth();
