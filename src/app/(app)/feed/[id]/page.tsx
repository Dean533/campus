import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PAGE, CARD, coursePill, profPill, resolvedPill, tierPill, SECTION_LABEL, GHOST_BTN } from '@/lib/ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type QuestionDetail = {
  id: string
  title: string
  body: string
  is_resolved: boolean
  created_at: string
  author_id: string
  profiles: { display_name: string | null; tier: string } | null
  course_offerings: {
    semester: string
    year: number
    courses: { id: string; code: string; title: string } | null
    professors: { first_name: string; last_name: string } | null
  } | null
}

type AnswerRow = {
  id: string
  body: string
  created_at: string
  author_id: string
  profiles: {
    display_name: string | null
    tier: string
    verified_tutors: { course_id: string }[]
  } | null
  answer_likes: { user_id: string }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function Dot() {
  return (
    <span aria-hidden style={{ margin: '0 7px', color: '#dde3ea', userSelect: 'none' }}>
      &middot;
    </span>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AnswerCard({
  answer,
  courseId,
  index,
}: {
  answer: AnswerRow & { likeCount: number }
  courseId: string
  index: number
}) {
  const isVerified = (answer.profiles?.verified_tutors ?? []).some(
    (vt) => vt.course_id === courseId
  )

  return (
    <div
      style={{
        ...CARD,
        borderLeft: index === 0 ? '3px solid #6366f1' : '1px solid #e8edf3',
        paddingLeft: index === 0 ? 21 : 24,
      }}
    >
      <p
        style={{
          fontSize: 14,
          color: '#334155',
          lineHeight: 1.65,
          margin: '0 0 16px',
          whiteSpace: 'pre-wrap',
        }}
      >
        {answer.body}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 12.5 }}>
          <span style={{ color: '#334155', fontWeight: 500 }}>
            {answer.profiles?.display_name ?? 'Anonymous'}
          </span>
          {answer.profiles?.tier && (
            <span style={{ ...tierPill(answer.profiles.tier), marginLeft: 6 }}>
              {answer.profiles.tier}
            </span>
          )}
          {isVerified && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 6,
                background: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #bbf7d0',
                marginLeft: 6,
              }}
            >
              Verified
            </span>
          )}
          <Dot />
          <span style={{ color: '#94a3b8' }}>{timeAgo(answer.created_at)}</span>
        </div>

        {/* Like count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12.5,
            color: '#94a3b8',
          }}
        >
          <span style={{ fontSize: 14 }}>+</span>
          <span style={{ fontWeight: 600, color: answer.likeCount > 0 ? '#4f46e5' : '#94a3b8' }}>
            {answer.likeCount}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawQuestion } = await supabase
    .from('questions')
    .select(`
      id,
      title,
      body,
      is_resolved,
      created_at,
      author_id,
      profiles ( display_name, tier ),
      course_offerings (
        semester,
        year,
        courses ( id, code, title ),
        professors ( first_name, last_name )
      )
    `)
    .eq('id', id)
    .single()

  if (!rawQuestion) notFound()

  const question   = rawQuestion as unknown as QuestionDetail
  const courseId   = question.course_offerings?.courses?.id ?? ''
  const courseCode = question.course_offerings?.courses?.code ?? ''
  const prof       = question.course_offerings?.professors
  const profName   = prof ? `${prof.first_name} ${prof.last_name}` : ''

  const { data: rawAnswers } = await supabase
    .from('answers')
    .select(`
      id,
      body,
      created_at,
      author_id,
      profiles (
        display_name,
        tier,
        verified_tutors ( course_id )
      ),
      answer_likes ( user_id )
    `)
    .eq('question_id', id)

  const answers = ((rawAnswers ?? []) as unknown as AnswerRow[])
    .map((a) => ({ ...a, likeCount: (a.answer_likes ?? []).length }))
    .sort((a, b) => b.likeCount - a.likeCount)

  return (
    <div style={PAGE}>
      {/* Back nav */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/feed" style={{ ...GHOST_BTN, display: 'inline-flex', padding: '6px 12px', fontSize: 13 }}>
          Back to Feed
        </Link>
      </div>

      {/* Question card */}
      <div style={{ ...CARD, marginBottom: 32 }}>
        {/* Tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {courseCode && <span style={coursePill()}>{courseCode}</span>}
          {profName   && <span style={profPill()}>{profName}</span>}
          {question.course_offerings && (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>
              {question.course_offerings.semester} {question.course_offerings.year}
            </span>
          )}
          {question.is_resolved && (
            <span style={{ ...resolvedPill(), marginLeft: 'auto' }}>Resolved</span>
          )}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 14px', lineHeight: 1.35, letterSpacing: '-0.2px' }}>
          {question.title}
        </h1>

        {/* Body */}
        <p style={{ fontSize: 14.5, color: '#334155', lineHeight: 1.7, margin: '0 0 20px', whiteSpace: 'pre-wrap' }}>
          {question.body}
        </p>

        {/* Author meta */}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 12.5, color: '#94a3b8' }}>
          <span style={{ color: '#334155', fontWeight: 500 }}>
            {question.profiles?.display_name ?? 'Anonymous'}
          </span>
          {question.profiles?.tier && (
            <span style={{ ...tierPill(question.profiles.tier), marginLeft: 6 }}>
              {question.profiles.tier}
            </span>
          )}
          <Dot />
          <span>{timeAgo(question.created_at)}</span>
        </div>
      </div>

      {/* Answers */}
      <div style={{ marginBottom: 12 }}>
        <span style={SECTION_LABEL}>
          {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
        </span>
      </div>

      {answers.length === 0 ? (
        <div
          style={{
            ...CARD,
            padding: '32px 24px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: 14,
          }}
        >
          No answers yet. Be the first to help.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {answers.map((a, i) => (
            <AnswerCard key={a.id} answer={a} courseId={courseId} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}
