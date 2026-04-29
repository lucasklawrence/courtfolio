import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

import { requireSupabaseEnv } from './env'

/**
 * Per-request Supabase client for server components, route handlers,
 * and server actions. Reads/writes the auth cookies on the incoming
 * request via Next's `cookies()` helper, so `await supabase.auth.getUser()`
 * returns whoever is currently signed in.
 *
 * Always create a fresh client per request — this client is bound to
 * the request's cookie jar and must not be reused across requests.
 *
 * Cookie writes throw when called from a Server Component (cookies
 * can only be mutated in route handlers / server actions). The `setAll`
 * impl below swallows that error: the auth library writes refreshed
 * tokens during normal reads, the next request will refresh again, and
 * a server-component-only call has no opportunity to persist anyway.
 */
export async function createServerSupabaseClient(): Promise<SupabaseClient> {
  const { url, anonKey } = requireSupabaseEnv()
  const cookieStore = await cookies()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // See note in the function docblock.
        }
      },
    },
  })
}
