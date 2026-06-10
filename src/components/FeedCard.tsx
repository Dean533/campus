'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

interface Props {
  href: string
  children: ReactNode
}

export function FeedCard({ href, children }: Props) {
  const [hovered, setHovered] = useState(false)

  const style: CSSProperties = {
    display: 'block',
    background: '#ffffff',
    borderRadius: 12,
    border: hovered ? '1px solid #a5b4fc' : '1px solid #e8edf3',
    boxShadow: hovered
      ? '0 4px 16px rgba(79,70,229,0.09), 0 1px 4px rgba(15,23,42,0.05)'
      : '0 1px 3px rgba(15,23,42,0.05), 0 1px 2px rgba(15,23,42,0.03)',
    padding: '20px 24px',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  }

  return (
    <Link
      href={href}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </Link>
  )
}
