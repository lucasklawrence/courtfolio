import type { JSX } from 'react'

import { LoginForm } from './LoginForm'

/**
 * Public sign-in page for the personal-site admin (Lucas). Emits a
 * Supabase Auth magic link to whoever submits the form; the link only
 * grants write access if the signed-in email matches
 * `NEXT_PUBLIC_ADMIN_EMAILS` (the route handlers gate on that even if
 * other accounts complete the OTP exchange).
 *
 * Optional `?error=...` query param surfaces a top-of-page banner when
 * the auth callback rejected a code — typically when a magic link
 * expired or was opened in a different browser than the one that
 * requested it.
 */
export default async function AdminLoginPage(props: {
  searchParams: Promise<{ error?: string }>
}): Promise<JSX.Element> {
  const { error } = await props.searchParams
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6 py-16">
      <h1 className="font-mono text-[11px] uppercase tracking-[0.32em] text-amber-300/80">
        Admin · Sign in
      </h1>
      <p className="mt-2 text-sm text-amber-50/70">
        Enter your email to receive a one-time magic link.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-rose-400/30 bg-rose-950/40 px-3 py-2 font-mono text-[11px] text-rose-300"
        >
          Sign-in failed: {error}
        </p>
      )}
      <LoginForm />
    </main>
  )
}
