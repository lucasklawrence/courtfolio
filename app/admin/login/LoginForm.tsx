'use client'

import { useState, type FormEvent, type JSX } from 'react'

import { sendMagicLink } from './actions'

/** Status of the magic-link request — drives the form's visible status text. */
type LoginStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string }

/**
 * Magic-link sign-in form. Posts to the {@link sendMagicLink} server
 * action, which delegates to Supabase Auth's `signInWithOtp`. The form
 * renders a positive confirmation regardless of whether the email is
 * on the admin allowlist — Supabase emits the link unconditionally,
 * and the admin gate at the route-handler layer is what actually
 * controls write access.
 */
export function LoginForm(): JSX.Element {
  const [status, setStatus] = useState<LoginStatus>({ kind: 'idle' })

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    if (!email) {
      setStatus({ kind: 'error', message: 'Enter an email.' })
      return
    }
    setStatus({ kind: 'sending' })
    const result = await sendMagicLink(email)
    if (result.ok) {
      setStatus({ kind: 'sent', email })
    } else {
      setStatus({ kind: 'error', message: result.error })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4" noValidate>
      <label className="block">
        <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-300/70">
          Email
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1.5 block w-full rounded border border-amber-300/30 bg-neutral-950/60 px-3 py-2 text-sm text-amber-50 placeholder:text-amber-200/30 focus:border-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        />
      </label>
      <button
        type="submit"
        disabled={status.kind === 'sending'}
        className="rounded bg-amber-300 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-950 hover:bg-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status.kind === 'sending' ? 'Sending…' : 'Send magic link'}
      </button>
      <div role="status" className="min-h-[1.25rem] font-mono text-[11px] tracking-wide">
        {status.kind === 'sent' && (
          <span className="text-emerald-400">
            Check {status.email} for the magic link.
          </span>
        )}
        {status.kind === 'error' && (
          <span className="text-rose-400">{status.message}</span>
        )}
      </div>
    </form>
  )
}
