/** Shared MiniMart test credentials and URLs (no private host baked in). */

export const DEMO_EMAIL = process.env.TEST_USER || 'demo@minimart.test';
export const DEMO_PASSWORD = process.env.TEST_PASS || 'demo1234';

/** Assignment default reset path segment; override with RESET_PATH or full RESET_URL. */
export const DEFAULT_RESET_PATH = process.env.RESET_PATH || 'reset-4712a2d2';

function trimTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

/**
 * Resolve Day-0 reset URL.
 * Prefer RESET_URL; otherwise BASE_URL + RESET_PATH.
 */
export function resolveResetUrl(): string {
  if (process.env.RESET_URL) return process.env.RESET_URL;
  const base = process.env.BASE_URL;
  if (!base) {
    throw new Error(
      'Missing BASE_URL (or RESET_URL). Copy .env.example, set the host from the assignment, then export vars before npm test. See README.',
    );
  }
  return `${trimTrailingSlash(base)}/${DEFAULT_RESET_PATH.replace(/^\//, '')}`;
}
