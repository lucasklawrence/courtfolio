'use client'

import { useEffect, useState } from 'react'

import { getBrowserSupabaseClient } from '@/lib/supabase/browser'

/**
 * Browser-side admin-session state for gating admin-only UI surfaces
 * (e.g. the Combine entry form).
 *
 * Calls the server-only `/api/admin/check` route to learn whether the
 * current viewer is an admin — the route checks the session cookie
 * against the `ADMIN_EMAILS` allowlist server-side and returns only a
 * boolean. The full allowlist never reaches the browser bundle.
 *
 * Re-fetches on every Supabase Auth state change so the gate flips
 * immediately on sign-in / sign-out without a page reload.
 *
 * `isLoading` stays true until the first check resolves so callers
 * can render skeletons / null without flashing the form for an
 * unauthed user.
 */
export interface AdminSession {
  /** True when the signed-in user's email is on the allowlist. */
  isAdmin: boolean
  /** True until the initial admin-check resolves. */
  isLoading: boolean
  /** Verified email of the signed-in user, or null if not signed in. */
  email: string | null
}

const INITIAL_STATE: AdminSession = {
  isAdmin: false,
  isLoading: true,
  email: null,
}

/**
 * React hook that resolves the current admin session state and keeps
 * it fresh via Supabase's auth-state subscription. Call from any
 * client component that needs to gate UI on admin presence.
 */
export function useAdminSession(): AdminSession {
  const [state, setState] = useState<AdminSession>(INITIAL_STATE)

  useEffect(() => {
    const supabase = getBrowserSupabaseClient()
    let mounted = true

    async function refresh(): Promise<void> {
      let next: Omit<AdminSession, 'isLoading'> = {
        isAdmin: false,
        email: null,
      }
      try {
        const res = await fetch('/api/admin/check', { cache: 'no-store' })
        if (res.ok) {
          const body = (await res.json()) as Omit<AdminSession, 'isLoading'>
          next = body
        }
      } catch {
        // Network/parse failure — treat as logged-out, the safe
        // default. The form stays hidden, no incorrect admin grant.
      }
      if (!mounted) return
      setState({ ...next, isLoading: false })
    }

    void refresh()

    const { data } = supabase.auth.onAuthStateChange(() => {
      void refresh()
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}
