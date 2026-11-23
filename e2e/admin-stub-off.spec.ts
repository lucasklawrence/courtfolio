import { expect, test } from '@playwright/test'

import { signInAsE2eAdmin } from './helpers/admin'

/**
 * The e2e admin stub's cookie does nothing on its own.
 *
 * Runs in `training-facility-enabled` against the 3008 server, which has the
 * Weight Room on but neither `E2E_ADMIN_STUB` nor a loopback Supabase URL. A
 * request carrying the stub's cookie must still be refused the admin pages,
 * exactly like an anonymous one. (The production-build half, `NODE_ENV=production`
 * with every other condition met, is pinned by `lib/auth/e2e-admin-stub.test.ts`.)
 *
 * The refusal is a 404 locally, where `.env.local` lets the server ask Supabase
 * and learn there's no session. In CI there are no Supabase credentials, so the
 * session lookup itself fails before it can answer. Either way the page must
 * not render, which is what's asserted.
 */

const BASE = 'http://127.0.0.1:3008'

for (const path of [
  '/training-facility/weight-room/log',
  '/training-facility/weight-room/settings',
]) {
  test(`the stub cookie alone does not open ${path}`, async ({ page, context }) => {
    await signInAsE2eAdmin(context, BASE)
    const response = await page.goto(`${BASE}${path}`)
    expect(response?.status(), 'an admin page answered 200 without the stub enabled').not.toBe(200)
    await expect(page.getByTestId('quick-log')).toHaveCount(0)
    await expect(page.getByTestId('weight-room-sub-nav')).toHaveCount(0)
  })
}
