'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/feed',     label: 'Feed' },
  { href: '/sessions', label: 'Book a Brain' },
  { href: '/vault',    label: 'Study Vault' },
  { href: '/pulse',    label: 'Prof Pulse' },
]

const TIER_COLORS: Record<string, string> = {
  Bronze: '#cd7f32',
  Silver: '#94a3b8',
  Gold:   '#f59e0b',
}

export function TopNav({
  displayName,
  avatarUrl,
  tier,
  reputationPoints,
  signOutAction,
}: {
  displayName: string
  avatarUrl: string | null
  tier: string
  reputationPoints: number
  signOutAction: () => Promise<void>
}) {
  const pathname = usePathname()

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: '#0f172a',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        height: 56,
      }}
    >
      {/* Centered inner container matches the SIDEBAR_PAGE max-width */}
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 44px',
          gap: 0,
        }}
      >
        {/* Wordmark */}
        <Link
          href="/"
          style={{
            fontSize: 19,
            fontWeight: 700,
            color: '#6366f1',
            letterSpacing: '-0.5px',
            textDecoration: 'none',
            marginRight: 36,
            flexShrink: 0,
          }}
        >
          Campus
        </Link>

        {/* Nav links */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flex: 1,
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 12px',
                  borderRadius: 7,
                  fontSize: 13.5,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#e0e7ff' : '#64748b',
                  background: isActive ? 'rgba(99,102,241,0.16)' : 'transparent',
                  textDecoration: 'none',
                  letterSpacing: '-0.1px',
                  transition: 'color 0.12s, background 0.12s',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User area */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexShrink: 0,
          }}
        >
          {/* Avatar + identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                (displayName?.[0] ?? '?').toUpperCase()
              )}
            </div>

            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#e2e8f0',
                  maxWidth: 150,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}
              >
                {displayName}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: TIER_COLORS[tier] ?? TIER_COLORS.Bronze,
                  lineHeight: 1,
                  marginTop: 2,
                }}
              >
                {tier} &middot; {reputationPoints} pts
              </div>
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 26,
              background: 'rgba(255,255,255,0.1)',
              flexShrink: 0,
            }}
          />

          {/* Sign out */}
          <form action={signOutAction}>
            <button
              type="submit"
              style={{
                padding: '5px 12px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                color: '#64748b',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                letterSpacing: '0.01em',
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
