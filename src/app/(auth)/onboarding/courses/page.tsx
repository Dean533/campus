'use client'

import { useEffect, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { completeOnboardingCourses } from '@/app/actions/auth'

type Offering = {
  id: string
  semester: string
  year: number
  courses: { code: string; title: string } | null
  professors: { first_name: string; last_name: string } | null
}

export default function OnboardingCoursesPage() {
  const [offerings, setOfferings] = useState<Offering[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

      if (!profile?.school_id) return

      const { data } = await supabase
        .from('course_offerings')
        .select(`
          id,
          semester,
          year,
          courses ( code, title ),
          professors ( first_name, last_name )
        `)
        .eq('is_current', true)
        .eq('courses.school_id', profile.school_id)
        .order('id')

      if (data) {
        setOfferings(data as unknown as Offering[])
      }
    })
  }, [])

  const filtered = offerings.filter((o) => {
    if (!search) return true
    const q = search.toLowerCase()
    const code = o.courses?.code?.toLowerCase() ?? ''
    const title = o.courses?.title?.toLowerCase() ?? ''
    const prof = `${o.professors?.first_name ?? ''} ${o.professors?.last_name ?? ''}`.toLowerCase()
    return code.includes(q) || title.includes(q) || prof.includes(q)
  })

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await completeOnboardingCourses(Array.from(selected))
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: 32,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
        Add your current courses
      </h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
        Select the classes you are enrolled in this semester. You can change these later.
      </p>

      <input
        type="search"
        placeholder="Search by course code, title, or professor..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          display: 'block',
          width: '100%',
          padding: '9px 12px',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          fontSize: 14,
          marginBottom: 16,
          outline: 'none',
        }}
      />

      <div style={{
        maxHeight: 320,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        marginBottom: 20,
        paddingRight: 4,
      }}>
        {filtered.length === 0 && (
          <p style={{ fontSize: 13, color: '#94a3b8', padding: '16px 0', textAlign: 'center' }}>
            No courses found.
          </p>
        )}
        {filtered.map((o) => {
          const isSelected = selected.has(o.id)
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => toggle(o.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                border: isSelected ? '2px solid #6366f1' : '1px solid #e2e8f0',
                borderRadius: 8,
                background: isSelected ? '#eef2ff' : '#fff',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                border: isSelected ? '2px solid #6366f1' : '2px solid #cbd5e1',
                background: isSelected ? '#6366f1' : 'transparent',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {isSelected && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#0f172a' }}>
                  {o.courses?.code} {o.courses?.title && `- ${o.courses.title}`}
                </div>
                {o.professors && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {o.professors.first_name} {o.professors.last_name}
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {selected.size > 0 && (
        <p style={{ fontSize: 13, color: '#6366f1', marginBottom: 12, fontWeight: 500 }}>
          {selected.size} course{selected.size !== 1 ? 's' : ''} selected
        </p>
      )}

      {error && (
        <p style={{
          fontSize: 13,
          color: '#ef4444',
          marginBottom: 12,
          padding: '8px 12px',
          background: '#fef2f2',
          borderRadius: 6,
          border: '1px solid #fecaca',
        }}>
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={handleSubmit}
        style={{
          display: 'block',
          width: '100%',
          padding: '10px 16px',
          background: isPending ? '#a5b4fc' : '#6366f1',
          color: '#fff',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
          border: 'none',
          cursor: isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? 'Saving...' : selected.size === 0 ? 'Skip for now' : 'Finish setup'}
      </button>
    </div>
  )
}
