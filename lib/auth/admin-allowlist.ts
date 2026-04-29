/**
 * Admin-email allowlist parsing for both server (`requireAdmin`) and
 * client (`useAdminSession`) gates. Reads `NEXT_PUBLIC_ADMIN_EMAILS` so
 * the same list is visible in both runtimes — the public exposure is
 * acceptable here because (a) magic-link auth still requires email
 * ownership to actually sign in, and (b) the admin email is already
 * public on the site owner's GitHub profile.
 */

/**
 * Parse the comma-separated `NEXT_PUBLIC_ADMIN_EMAILS` env var into a
 * normalized Set of lowercase emails. Empty values, whitespace, and
 * casing are smoothed out so `"Lucas@example.com, foo@bar.com"`
 * normalizes to the same Set as `"lucas@example.com,foo@bar.com"`.
 *
 * Returns an empty Set when the env var is missing or contains only
 * whitespace — no emails means no admins, the safe default.
 */
export function getAdminAllowlist(): Set<string> {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? ''
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
