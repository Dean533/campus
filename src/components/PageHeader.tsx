import type { ReactNode } from 'react'

interface Props {
  title: string
  description: string
  action?: ReactNode
}

export function PageHeader({ title, description, action }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 20,
        marginBottom: 28,
      }}
    >
      <div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#0f172a',
            margin: '0 0 5px',
            letterSpacing: '-0.3px',
            lineHeight: 1.25,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: '#64748b',
            margin: 0,
            lineHeight: 1.55,
          }}
        >
          {description}
        </p>
      </div>

      {action && (
        <div style={{ flexShrink: 0, paddingTop: 2 }}>{action}</div>
      )}
    </div>
  )
}
