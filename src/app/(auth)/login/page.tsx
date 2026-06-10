'use client'

import { useState } from 'react'
import { signInWithMagicLink, devLogin } from '@/app/actions/auth'

const DEV_EMAILS = [
  'tutor001@ucla.edu',
  'tutor002@ucla.edu',
  'tutor003@ucla.edu',
  'student001@ucla.edu',
  'student002@ucla.edu',
  'student003@ucla.edu',
  'student001@berkeley.edu',
  'student002@berkeley.edu',
  'student003@berkeley.edu',
]

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [devError, setDevError] = useState<string | null>(null)
  const [devLoading, setDevLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await signInWithMagicLink(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  async function handleDevLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setDevError(null)
    setDevLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await devLogin(formData)

    if (result?.error) {
      setDevError(result.error)
      setDevLoading(false)
    }
    // On success devLogin calls redirect() server-side; Next.js handles the navigation.
  }

  return (
    <div>
      <div style={{
        background: '#fff',
        borderRadius: 12,
        padding: 32,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
      }}>
        <h1 style={{
          fontSize: 20,
          fontWeight: 600,
          color: '#0f172a',
          marginBottom: 8,
        }}>
          Sign in to Campus
        </h1>
        <p style={{
          fontSize: 14,
          color: '#64748b',
          marginBottom: 24,
        }}>
          Enter your .edu email and we will send you a magic link.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            color: '#374151',
            marginBottom: 6,
          }}>
            School email
          </label>
          <input
            type="email"
            name="email"
            required
            placeholder="you@school.edu"
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 12px',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              fontSize: 14,
              color: '#0f172a',
              background: '#fff',
              outline: 'none',
              marginBottom: 16,
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#6366f1'
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />

          {error && (
            <p style={{
              fontSize: 13,
              color: '#ef4444',
              marginBottom: 16,
              padding: '8px 12px',
              background: '#fef2f2',
              borderRadius: 6,
              border: '1px solid #fecaca',
            }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px 16px',
              background: loading ? '#a5b4fc' : '#6366f1',
              color: '#fff',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? 'Sending...' : 'Send magic link'}
          </button>
        </form>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <div style={{
          marginTop: 16,
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
          border: '1px dashed #f59e0b',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#92400e',
              background: '#fef3c7',
              border: '1px solid #fcd34d',
              borderRadius: 4,
              padding: '2px 6px',
            }}>
              DEV ONLY
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Dev Login
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
            Sign in directly as a seeded user. Never available in production.
          </p>

          <form onSubmit={handleDevLogin}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 500,
              color: '#374151',
              marginBottom: 6,
            }}>
              Seeded user
            </label>
            <select
              name="email"
              required
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 14,
                color: '#0f172a',
                background: '#fff',
                outline: 'none',
                marginBottom: 8,
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
            >
              {DEV_EMAILS.map((em) => (
                <option key={em} value={em}>{em}</option>
              ))}
            </select>

            <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>
              Full list: tutor001-015@ucla.edu, student001-020@ucla.edu, student001-015@berkeley.edu
            </p>

            {devError && (
              <p style={{
                fontSize: 13,
                color: '#ef4444',
                marginBottom: 12,
                padding: '8px 12px',
                background: '#fef2f2',
                borderRadius: 6,
                border: '1px solid #fecaca',
              }}>
                {devError}
              </p>
            )}

            <button
              type="submit"
              disabled={devLoading}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                background: devLoading ? '#fcd34d' : '#f59e0b',
                color: '#78350f',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                border: 'none',
                cursor: devLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {devLoading ? 'Signing in...' : 'Sign in directly'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
