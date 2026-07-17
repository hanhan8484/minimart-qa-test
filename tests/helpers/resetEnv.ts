import type { APIRequestContext } from '@playwright/test';
import { DEFAULT_RESET_URL } from './constants';

/**
 * Reset environment to Day-0 seed, then wait for service restart.
 * @see https://cand1.tail296b14.ts.net/reset-4712a2d2
 */
export async function resetEnv(request: APIRequestContext, waitMs = 5_000) {
  const url = DEFAULT_RESET_URL;
  const res = await request.get(url);
  if (!res.ok()) {
    throw new Error(`resetEnv failed: ${res.status()} ${url}`);
  }
  await new Promise((r) => setTimeout(r, waitMs));
}
