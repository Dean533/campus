/**
 * Shared design tokens and style factories.
 * Import from any page or component to stay visually consistent.
 */
import type { CSSProperties } from 'react'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const PAGE: CSSProperties = {
  padding: '40px 44px',
  maxWidth: 800,
}

// Sidebar layout: outer wrapper (sets max-width + padding), inner flex wrap.
export const SIDEBAR_PAGE: CSSProperties = {
  maxWidth: 1180,
  margin: '0 auto',
  padding: '40px 44px',
}

export const SIDEBAR_WRAP: CSSProperties = {
  display: 'flex',
  gap: 28,
  alignItems: 'flex-start',
}

// Sticky aside panel. Use inside SIDEBAR_WRAP.
export const SIDEBAR: CSSProperties = {
  width: 240,
  flexShrink: 0,
  position: 'sticky',
  top: 72, // 56px nav + 16px breathing room
}

// White card that wraps the sidebar filter groups.
export const SIDEBAR_CARD: CSSProperties = {
  background: '#ffffff',
  borderRadius: 12,
  border: '1px solid #e8edf3',
  overflow: 'hidden',
}

// Main content column next to the sidebar.
export const MAIN_COL: CSSProperties = {
  flex: 1,
  minWidth: 0,
}

// ---------------------------------------------------------------------------
// Pill / badge factories
// All pills share the same geometry; only colors differ.
// ---------------------------------------------------------------------------

const PILL_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 11,
  fontWeight: 600,
  padding: '3px 9px',
  borderRadius: 6,
  whiteSpace: 'nowrap',
  letterSpacing: '0.01em',
}

export function coursePill(): CSSProperties {
  return {
    ...PILL_BASE,
    background: '#eef2ff',
    color: '#4338ca',
    border: '1px solid #c7d2fe',
  }
}

export function profPill(): CSSProperties {
  return {
    ...PILL_BASE,
    background: '#f8fafc',
    color: '#475569',
    border: '1px solid #e2e8f0',
    fontWeight: 500,
  }
}

export function resolvedPill(): CSSProperties {
  return {
    ...PILL_BASE,
    background: '#f0fdf4',
    color: '#15803d',
    border: '1px solid #bbf7d0',
  }
}

const TIER_VARIANTS: Record<string, CSSProperties> = {
  Gold:   { background: '#fefce8', color: '#92400e', border: '1px solid #fde68a' },
  Silver: { background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' },
  Bronze: { background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' },
}

export function tierPill(tier: string): CSSProperties {
  return { ...PILL_BASE, ...(TIER_VARIANTS[tier] ?? TIER_VARIANTS.Bronze) }
}

// ---------------------------------------------------------------------------
// Avatar helpers
// ---------------------------------------------------------------------------

const AVATAR_PALETTE = [
  '#6366f1', '#0ea5e9', '#ec4899', '#10b981',
  '#f59e0b', '#8b5cf6', '#14b8a6', '#f97316',
]

/** Deterministic color based on the first character of a name. */
export function nameColor(name: string | null | undefined): string {
  if (!name) return AVATAR_PALETTE[0]
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length]
}

/** Circle avatar style. Pass a background color and optional size. */
export function avatarCircle(bg: string, size = 40): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: Math.round(size * 0.38),
    fontWeight: 700,
    flexShrink: 0,
    userSelect: 'none',
    letterSpacing: '-0.3px',
  }
}

// ---------------------------------------------------------------------------
// Answer count badge (Stack Overflow style)
// ---------------------------------------------------------------------------

export function answerBadge(count: number): CSSProperties {
  return {
    width: 68,
    padding: '10px 4px',
    borderRadius: 8,
    border: count > 0 ? '1.5px solid #86efac' : '1px solid #e2e8f0',
    background: count > 0 ? '#f0fdf4' : '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    textAlign: 'center',
  }
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export const PRIMARY_BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '9px 18px',
  background: '#4f46e5',
  color: '#ffffff',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

export const GHOST_BTN: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 16px',
  background: 'transparent',
  color: '#475569',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
  border: '1px solid #e2e8f0',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

// ---------------------------------------------------------------------------
// Section label (used inside cards or above lists)
// ---------------------------------------------------------------------------

export const SECTION_LABEL: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: '#94a3b8',
}

// ---------------------------------------------------------------------------
// Static card (non-link version of FeedCard)
// ---------------------------------------------------------------------------

export const CARD: CSSProperties = {
  background: '#ffffff',
  borderRadius: 12,
  border: '1px solid #e8edf3',
  boxShadow: '0 1px 3px rgba(15,23,42,0.05), 0 1px 2px rgba(15,23,42,0.03)',
  padding: '20px 24px',
}

// ---------------------------------------------------------------------------
// Session-specific pill variants
// ---------------------------------------------------------------------------

const SESSION_TYPE_VARIANTS: Record<string, CSSProperties> = {
  emergency: { background: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3' },
  scheduled: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
}

export function sessionTypePill(type: string): CSSProperties {
  return { ...PILL_BASE, ...(SESSION_TYPE_VARIANTS[type] ?? SESSION_TYPE_VARIANTS.scheduled) }
}

const SESSION_FORMAT_VARIANTS: Record<string, CSSProperties> = {
  '1on1':  { background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' },
  group:   { background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe' },
}

export function sessionFormatPill(format: string): CSSProperties {
  return { ...PILL_BASE, ...(SESSION_FORMAT_VARIANTS[format] ?? SESSION_FORMAT_VARIANTS['1on1']) }
}

const SESSION_STATUS_VARIANTS: Record<string, CSSProperties> = {
  scheduled: { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  completed: { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
  cancelled: { background: '#f9fafb', color: '#6b7280', border: '1px solid #e5e7eb' },
}

export function sessionStatusPill(status: string): CSSProperties {
  return { ...PILL_BASE, ...(SESSION_STATUS_VARIANTS[status] ?? SESSION_STATUS_VARIANTS.scheduled) }
}

// ---------------------------------------------------------------------------
// Study Vault pill variants
// ---------------------------------------------------------------------------

const MATERIAL_TYPE_VARIANTS: Record<string, CSSProperties> = {
  'Notes':             { background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' },
  'Flashcards':        { background: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe' },
  'Practice Problems': { background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' },
  'Cheat Sheet':       { background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' },
}

export function materialTypePill(type: string): CSSProperties {
  return { ...PILL_BASE, ...(MATERIAL_TYPE_VARIANTS[type] ?? MATERIAL_TYPE_VARIANTS['Notes']) }
}

export function gradePill(grade: string): CSSProperties {
  const isA = grade.startsWith('A')
  return {
    ...PILL_BASE,
    background: isA ? '#f0fdf4' : '#f8fafc',
    color:      isA ? '#15803d' : '#475569',
    border:     isA ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
  }
}

// ---------------------------------------------------------------------------
// Divider
// ---------------------------------------------------------------------------

export const DIVIDER: CSSProperties = {
  border: 'none',
  borderTop: '1px solid #e8eef4',
  margin: '24px 0',
}
