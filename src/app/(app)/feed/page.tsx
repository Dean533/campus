import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { FeedCard } from '@/components/FeedCard'
import {
  PAGE,
  coursePill,
  profPill,
  resolvedPill,
  tierPill,
  PRIMARY_BTN,
} from '@/lib/ui'

type Question = {
  id: string
  title: string
  answer_count: number
  is_resolved: boolean
  created_at: string
  profiles: { display_name: string | null; tier: string } | null
  course_offerings: {
    semester: string
    year: number
    courses: { code: string } | null
    professors: { last_name: string } | null
  } | null
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function Dot() {
  return (
    <span
      aria-hidden
      style={{ margin: '0 8px', color: '#dde3ea', userSelect: 'none' }}
    >
      &middot;
    </span>
  )
}

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select(`
      id,
      title,
      answer_count,
      is_resolved,
      created_at,
      profiles ( display_name, tier ),
      course_offerings (
        semester,
        year,
        courses ( code ),
        professors ( last_name )
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (questionsError) {
    console.error('[feed] questions query error:', questionsError)
  }
  console.log(`[feed] user=${user.id} questions=${questions?.length ?? 'null (error)'}`)

  const qs = (questions ?? []) as unknown as Question[]

  return (
    <div style={PAGE}>
      <PageHeader
        title="Feed"
        description="Questions from your school, visible only to students here."
        action={
          <Link href="/feed/new" style={PRIMARY_BTN}>
            + Ask a question
          </Link>
        }
      />

      {qs.length === 0 ? (
        <EmptyFeed />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {qs.map((q) => {
            const offering   = q.course_offerings
            const courseCode = offering?.courses?.code ?? ''
            const profLast   = offering?.professors?.last_name ?? ''

            return (
              <FeedCard key={q.id} href={`/feed/${q.id}`}>
                {/* Tags row -- no tier badge here, it lives with the author */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexWrap: 'wrap',
                    marginBottom: 11,
                  }}
                >
                  {courseCode && (
                    <span style={coursePill()}>{courseCode}</span>
                  )}
                  {profLast && (
                    <span style={profPill()}>{profLast}</span>
                  )}
                  {offering && (
                    <span style={{ fontSize: 12, color: '#94a3b8', userSelect: 'none' }}>
                      {offering.semester} {offering.year}
                    </span>
                  )}
                </div>

                {/* Question title */}
                <h2
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#0f172a',
                    margin: '0 0 14px',
                    lineHeight: 1.45,
                  }}
                >
                  {q.title}
                </h2>

                {/* Meta row: author + tier badge + answer count + time */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 12.5,
                      color: '#94a3b8',
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        color: '#334155',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 160,
                      }}
                    >
                      {q.profiles?.display_name ?? 'Anonymous'}
                    </span>
                    {q.profiles?.tier && (
                      <span style={{ ...tierPill(q.profiles.tier), marginLeft: 6 }}>
                        {q.profiles.tier}
                      </span>
                    )}
                    <Dot />
                    {/* Answer count as an activity signal: bold number, muted label */}
                    <span style={{ fontWeight: 700, color: q.answer_count > 0 ? '#334155' : '#94a3b8' }}>
                      {q.answer_count}
                    </span>
                    <span style={{ marginLeft: 3 }}>
                      {q.answer_count === 1 ? 'answer' : 'answers'}
                    </span>
                    <Dot />
                    <span>{timeAgo(q.created_at)}</span>
                  </div>

                  {q.is_resolved && (
                    <span style={resolvedPill()}>Resolved</span>
                  )}
                </div>
              </FeedCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

function EmptyFeed() {
  return (
    <div
      style={{
        padding: '56px 32px',
        textAlign: 'center',
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e8edf3',
        boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#eef2ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 20,
          color: '#6366f1',
        }}
      >
        ?
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#334155', margin: '0 0 6px' }}>
        No questions yet
      </p>
      <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 24px' }}>
        Be the first to start the conversation.
      </p>
      <Link href="/feed/new" style={PRIMARY_BTN}>
        + Ask a question
      </Link>
    </div>
  )
}
