'use client'

import { useEffect, useState } from 'react'

import { getBrowserSupabaseClient } from '@/lib/supabase/browser'
import { isAdminEmail } from './admin-allowlist'

/**
 * Browser-side admin-session state for gating admin-only UI surfaces
 * (e.g. the Combine entry form). Subscribes to Supabase Auth state
 * changes so the gate flips immediately on sign-in / sign-out without
 * a page reload.
 *
 * The check mirrors the server-side `requireAdmin` contract: a verified
 * email that appears in the `NEXT_PUBLIC_ADMIN_EMAILS` allowlist.
 *
 * `isLoading` stays true until the first session lookup resolves so
 * callers can render skeletons / null without flashing the form for
 * an unauthed user.
 */
export interface AdminSession {
  /** True when the signed-in user's email is on the allowlist. */
  isAdmin: boolean
  /** True until the initial session lookup finishes. */
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

    void supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      const email = data.user?.email ?? null
      setState({
        isAdmin: isAdminEmail(email),
        isLoading: false,
        email,
      })
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      const email = session?.user?.email ?? null
      setState({
        isAdmin: isAdminEmail(email),
        isLoading: false,
        email,
      })
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  return state
}
