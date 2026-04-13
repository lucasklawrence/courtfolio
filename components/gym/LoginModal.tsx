'use client'

import React, { useState } from 'react'
import { useAuth } from '@/utils/hooks/useAuth'

type Props = {
  onClose: () => void
}

export function LoginModal({ onClose }: Props) {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      onClose()
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        backgroundColor: '#111', border: '1px solid #2a2a2a', borderRadius: '10px',
        padding: '28px 32px', width: '320px',
        fontFamily: "'Geist Sans', system-ui, sans-serif", color: 'white',
      }}>
        <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '6px' }}>🔒 Admin Login</div>
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '20px' }}>Training Facility access only</div>

        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={inputStyle}
            placeholder="you@example.com"
          />

          <label style={{ fontSize: '11px', color: '#888', display: 'block', marginBottom: '4px', marginTop: '14px' }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={inputStyle}
            placeholder="••••••••"
          />

          {error && (
            <div style={{ fontSize: '11px', color: '#e74c3c', marginTop: '10px' }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '20px', width: '100%', padding: '10px',
              backgroundColor: loading ? '#333' : '#e07b39',
              color: 'white', border: 'none', borderRadius: '6px',
              fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', boxSizing: 'border-box',
  backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '6px',
  color: 'white', fontSize: '13px', outline: 'none',
}
