/**
 * Server-only admin-email allowlist. Used by `requireAdmin` (route
 * handlers) and `/api/admin/check` (the boolean-only endpoint the
 * client hook calls). Reads `ADMIN_EMAILS` — deliberately *not* a
 * `NEXT_PUBLIC_*` var so the raw list never reaches the browser
 * bundle. Browsers learn admin status only through the check route's
 * `{ isAdmin: boolean }` response.
 */

import 'server-only'

/**
 * Parse the comma-separated `ADMIN_EMAILS` env var into a normalized
 * Set of lowercase emails. Empty values, whitespace, and casing are
 * smoothed out so `"Lucas@example.com, foo@bar.com"` normalizes to the
 * same Set as `"lucas@example.com,foo@bar.com"`.
 *
 * Returns an empty Set when the env var is missing or contains only
 * whitespace — no emails means no admins, the safe default.
 */
export function getAdminAllowlist(): Set<string> {
  const raw = process.env.ADMIN_EMAILS ?? ''
  const set = new Set<string>()
  for (const part of raw.split(',')) {
    const email = part.trim().toLowerCase()
    if (email) set.add(email)
  }
  return set
}

/**
 * Case-insensitive admin-membership check.
 *
 * @param email Verified email to check; `null`/`undefined` returns false.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminAllowlist().has(email.toLowerCase())
}
