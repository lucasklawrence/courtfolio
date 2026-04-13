'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient, supabaseReady } from '@/lib/supabase/client'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return }

    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    if (!supabaseReady) return new Error('Supabase not configured')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  async function signOut() {
    if (!supabaseReady) return
    const supabase = createClient()
    await supabase.auth.signOut()
  }

  return { user, loading, signIn, signOut }
}
