/**
 * Shared env-var validation for the Supabase client factories
 * (`browser.ts`, `server.ts`). Reads at call time — not module load —
 * so deploys with missing config fail loudly on the first auth/data
 * call instead of silently falling back to the wrong project.
 */

/** Validated Supabase env-var pair used by the browser/server clients. */
export interface SupabaseEnv {
  /** Project API URL — `https://<ref>.supabase.co`. From `NEXT_PUBLIC_SUPABASE_URL`. */
  url: string
  /**
   * Anon (publishable) key — safe to ship to the browser. Accepts both
   * the legacy JWT form (`eyJ...`) and the modern publishable form
   * (`sb_publishable_...`); `@supabase/ssr` handles either. From
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   */
  anonKey: string
}

/**
 * Read and validate the public Supabase env vars. Throws with a precise
 * "X is not set" message when either is missing or whitespace-only —
 * preferred over a runtime null-reference further down the call chain.
 *
 * @throws Error when `NEXT_PUBLIC_SUPABASE_URL` or
 *   `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing.
 */
export function requireSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.')
  }
  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.')
  }
  return { url, anonKey }
}
