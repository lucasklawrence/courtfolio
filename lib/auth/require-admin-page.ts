import 'server-only'

import { notFound } from 'next/navigation'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { isAdminEmail } from './admin-allowlist'

/**
 * Server-component admin gate (#181 follow-up to #180). Sibling to
 * {@link import('./require-admin').requireAdmin} but for pages instead
 * of API route handlers — pages don't have a status-code response
 * model, so a non-admin viewer gets a hard 404 via Next's
 * `notFound()` rather than a JSON 401/403.
 *
 * The 404 is intentional: it matches the cardio dashboard's
 * "feature flag off" gate at the same exit, and it doesn't even hint
 * at the existence of an admin-only route to a non-admin viewer.
 *
 * Use at the top of every admin-gated Server Component page:
 *
 * ```ts
 * export default async function MyAdminPage() {
 *   const { email } = await requireAdminPage()
 *   // ...continue with admin-only work; `email` is the verified admin
 *   // email if you need it for an audit log or display.
 * }
 * ```
 *
 * @returns `{ email }` for the verified admin user. The function does
 *   not return when the caller is rejected — `notFound()` throws a
 *   well-known Next error that the framework catches at the route
 *   boundary and renders the custom 404.
 *
 * @throws when Supabase env vars are missing (misconfiguration).
 */
export async function requireAdminPage(): Promise<{ email: string }> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user || !isAdminEmail(data.user.email)) {
    notFound()
  }
  // `notFound()` is `never` so this branch only runs on the happy path;
  // the email assertion is safe because `isAdminEmail` returned true.
  return { email: data.user.email as string }
}
