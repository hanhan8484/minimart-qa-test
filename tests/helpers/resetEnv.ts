import type { APIRequestContext } from '@playwright/test';
import { loginViaApi } from './auth';
import { resolveResetUrl } from './constants';
import { loadDay0SeedOrders } from './orders';

/**
 * Reset environment to Day-0 seed, wait for service, then verify A.4 orders.
 * Fails fast if the shared SUT did not restore seed data (avoids cascading serial skips).
 * Seed order *dates* roll with server D0 — validation is by count + statuses, not fixed ids.
 * Reset URL comes from RESET_URL or BASE_URL + RESET_PATH (see .env.example / README).
 */
export async function resetEnv(request: APIRequestContext, waitMs = 5_000) {
  const url = resolveResetUrl();
  const res = await request.get(url);
  if (!res.ok()) {
    throw new Error(`resetEnv failed: ${res.status()} ${url}`);
  }
  await new Promise((r) => setTimeout(r, waitMs));

  const login = await loginViaApi(request);
  if (!login.ok()) {
    throw new Error(`resetEnv: login after reset failed: ${login.status()}`);
  }

  let lastError: unknown;
  for (let i = 0; i < 3; i++) {
    try {
      await loadDay0SeedOrders(request);
      return;
    } catch (e) {
      lastError = e;
      if (i < 2) await new Promise((r) => setTimeout(r, 2_000));
    }
  }
  throw new Error(
    [
      String(lastError instanceof Error ? lastError.message : lastError),
      `RESET_URL=${url}`,
      'Fix: open the reset URL, wait 5–10s, confirm /orders has 待出貨→已完成→已出貨, then re-run.',
    ].join('\n'),
  );
}
