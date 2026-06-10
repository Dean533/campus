import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import {
  PAGE,
  CARD,
  SECTION_LABEL,
  PRIMARY_BTN,
  coursePill,
  profPill,
  tierPill,
  sessionTypePill,
  sessionStatusPill,
} from '@/lib/ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Offering = {
  semester: string
  year: number
  courses: { code: string } | null
  professors: { last_name: string } | null
}

type OpenRequest = {
  id: string
  description: string
  session_type: string
  duration_minutes: number
  format: string
  max_students: number
  price_display: number
  created_at: string
  expires_at: string | null
  profiles: { display_name: string | null; tier: string } | null
  course_offerings: Offering | null
}

type MySession = {
  id: string
  tutor_id: string
  format: string
  status: string
  scheduled_at: string
  duration_minutes: number
  price_per_student_display: number
  meet_url: string | null
  prep_note: string | null
  tutor: { display_name: string | null; tier: string } | null
  course_offerings: Offering | null
  session_participants: Array<{
    student_id: string
    payment_status: string
    profiles: { display_name: string | null } | null
  }>
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

function timeUntil(dateStr: string): string | null {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff <= 0) return null
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m left`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h left`
  return `${Math.floor(hrs / 24)}d left`
}

function formatDateTime(dateStr: string) {
  const d   = new Date(dateStr)
  const now = new Date()
  const isToday    = d.toDateString() === now.toDateString()
  const isTomorrow = d.toDateString() === new Date(Date.now() + 86_400_000).toDateString()
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (isToday)    return `Today at ${time}`
  if (isTomorrow) return `Tomorrow at ${time}`
  return (
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
    ` at ${time}`
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CoursePillRow({ offering }: { offering: Offering | null }) {
  if (!offering?.courses?.code) return null
  return <span style={coursePill()}>{offering.courses.code}</span>
}

function RequestCard({ req }: { req: OpenRequest }) {
  const isEmergency = req.session_type === 'emergency'
  const profLast    = req.course_offerings?.professors?.last_name ?? ''
  const formatLabel = req.format === '1on1' ? '1-on-1' : `Group (${req.max_students})`
  const remaining   = req.expires_at ? timeUntil(req.expires_at) : null

  return (
    <div
      style={{
        ...CARD,
        borderLeft: isEmergency ? '3px solid #be123c' : '1px solid #e8edf3',
        paddingLeft: isEmergency ? 21 : 24,
      }}
    >
      {/* Top row: pills + expiry + price */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <CoursePillRow offering={req.course_offerings} />
          <span style={sessionTypePill(req.session_type)}>
            {isEmergency ? 'Emergency' : 'Scheduled'}
          </span>
          {isEmergency && req.expires_at && (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 6,
                background: remaining ? '#fff1f2' : '#f9fafb',
                color:      remaining ? '#be123c' : '#6b7280',
                border:     `1px solid ${remaining ? '#fecdd3' : '#e5e7eb'}`,
                whiteSpace: 'nowrap',
              }}
            >
              {remaining ?? 'Expired'}
            </span>
          )}
        </div>

        {/* Price - prominent */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: req.price_display === 0 ? '#15803d' : '#0f172a',
            }}
          >
            {req.price_display === 0 ? 'Free' : `$${req.price_display}`}
          </span>
          {req.price_display > 0 && (
            <span
              style={{
                fontSize: 10.5,
                color: '#94a3b8',
                fontWeight: 500,
                marginLeft: 4,
              }}
            >
              simulated
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: 14,
          color: '#334155',
          lineHeight: 1.6,
          margin: '0 0 14px',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {req.description}
      </p>

      {/* Meta: author group + details group */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {/* Author + tier + prof */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
          <span style={{ color: '#334155', fontWeight: 500 }}>
            {req.profiles?.display_name ?? 'Anonymous'}
          </span>
          {req.profiles?.tier && (
            <span style={tierPill(req.profiles.tier)}>{req.profiles.tier}</span>
          )}
          {profLast && (
            <>
              <span aria-hidden style={{ color: '#dde3ea', margin: '0 2px' }}>&middot;</span>
              <span style={profPill()}>{profLast}</span>
            </>
          )}
        </div>

        {/* Duration + format + time */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12.5,
            color: '#64748b',
            flexShrink: 0,
          }}
        >
          <span>{req.duration_minutes} min</span>
          <span aria-hidden style={{ color: '#dde3ea' }}>&middot;</span>
          <span>{formatLabel}</span>
          <span aria-hidden style={{ color: '#dde3ea' }}>&middot;</span>
          <span style={{ color: '#94a3b8' }}>{timeAgo(req.created_at)}</span>
        </div>
      </div>
    </div>
  )
}

function SessionCard({ session, userId }: { session: MySession; userId: string }) {
  const iAmTutor    = session.tutor_id === userId
  const isUpcoming  = session.status === 'scheduled'
  const formatLabel = session.format === '1on1' ? '1-on-1' : 'Group'

  const participantNames = (session.session_participants ?? [])
    .map((p) => p.profiles?.display_name ?? 'Unknown')
    .join(', ')

  return (
    <div
      style={{
        ...CARD,
        borderLeft: iAmTutor ? '3px solid #6366f1' : '3px solid #0ea5e9',
        paddingLeft: 21,
      }}
    >
      {/* Top row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <CoursePillRow offering={session.course_offerings} />
        <span style={sessionStatusPill(session.status)}>
          {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
        </span>
      </div>

      {/* Date + duration + format */}
      <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 10 }}>
        {formatDateTime(session.scheduled_at)}
        <span style={{ fontSize: 13, fontWeight: 400, color: '#64748b', marginLeft: 10 }}>
          {session.duration_minutes} min
        </span>
        <span style={{ fontSize: 13, fontWeight: 400, color: '#94a3b8', marginLeft: 8 }}>
          {formatLabel}
        </span>
      </div>

      {/* Role labels */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span
            style={{
              color: '#94a3b8',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Tutor
          </span>
          {iAmTutor ? (
            <span style={{ color: '#334155', fontWeight: 500 }}>You</span>
          ) : (
            <span style={{ color: '#334155', fontWeight: 500 }}>
              {session.tutor?.display_name ?? 'Unknown'}
            </span>
          )}
          {session.tutor?.tier && (
            <span style={tierPill(session.tutor.tier)}>{session.tutor.tier}</span>
          )}
        </div>

        {participantNames && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span
              style={{
                color: '#94a3b8',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Student
            </span>
            <span style={{ color: '#475569' }}>
              {iAmTutor ? participantNames : 'You'}
            </span>
          </div>
        )}
      </div>

      {/* Price + meet link */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <span style={{ fontSize: 14, fontWeight: 700, color: session.price_per_student_display === 0 ? '#15803d' : '#0f172a' }}>
            {session.price_per_student_display === 0 ? 'Free' : `$${session.price_per_student_display}`}
          </span>
          {session.price_per_student_display > 0 && (
            <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 4 }}>per student, simulated</span>
          )}
        </div>

        {isUpcoming && session.meet_url && (
          <a
            href={session.meet_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 14px',
              background: '#f0fdf4',
              color: '#15803d',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Join meeting
          </a>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      }}
    >
      <span style={SECTION_LABEL}>{label}</span>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>
        {count} {count === 1 ? 'result' : 'results'}
      </span>
    </div>
  )
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div
      style={{
        ...CARD,
        padding: '32px 24px',
        textAlign: 'center',
        color: '#94a3b8',
        fontSize: 14,
      }}
    >
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SessionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (!profile?.school_id) redirect('/onboarding/school')

  const schoolId = profile.school_id

  const { data: rawRequests, error: reqErr } = await supabase
    .from('session_requests')
    .select(`
      id,
      description,
      session_type,
      duration_minutes,
      format,
      max_students,
      price_display,
      created_at,
      expires_at,
      profiles ( display_name, tier ),
      course_offerings (
        semester,
        year,
        courses ( code ),
        professors ( last_name )
      )
    `)
    .eq('status', 'open')
    .eq('school_id', schoolId)
    .order('session_type', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: rawSessions, error: sesErr } = await supabase
    .from('sessions')
    .select(`
      id,
      tutor_id,
      format,
      status,
      scheduled_at,
      duration_minutes,
      price_per_student_display,
      meet_url,
      prep_note,
      tutor:profiles!tutor_id ( display_name, tier ),
      course_offerings (
        semester,
        year,
        courses ( code ),
        professors ( last_name )
      ),
      session_participants (
        student_id,
        payment_status,
        profiles ( display_name )
      )
    `)
    .order('scheduled_at', { ascending: false })
    .limit(20)

  if (reqErr)  console.error('[sessions] open_requests error:', reqErr.message)
  if (sesErr)  console.error('[sessions] sessions error:', sesErr.message)

  console.log(
    `[sessions] user=${user.id} school=${schoolId} ` +
    `open_requests=${rawRequests?.length ?? 'err'} ` +
    `sessions=${rawSessions?.length ?? 'err'}`
  )

  const openRequests      = (rawRequests ?? []) as unknown as OpenRequest[]
  const mySessions        = (rawSessions  ?? []) as unknown as MySession[]
  const upcomingSessions  = mySessions.filter((s) => s.status === 'scheduled')
  const completedSessions = mySessions.filter((s) => s.status === 'completed')

  return (
    <div style={PAGE}>
      <PageHeader
        title="Book a Brain"
        description="Request a 1-on-1 or group session with a verified tutor. All payments are simulated."
        action={
          <Link href="/sessions/new" style={PRIMARY_BTN}>
            + Post a Request
          </Link>
        }
      />

      {/* Open Requests */}
      <div style={{ marginBottom: 40 }}>
        <SectionHeader label="Open Requests" count={openRequests.length} />
        {openRequests.length === 0 ? (
          <EmptyCard message="No open requests at your school right now. Post one to get the ball rolling." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {openRequests.map((r) => (
              <RequestCard key={r.id} req={r} />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming Sessions */}
      {upcomingSessions.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <SectionHeader label="Upcoming Sessions" count={upcomingSessions.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcomingSessions.map((s) => (
              <SessionCard key={s.id} session={s} userId={user.id} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <SectionHeader label="Completed Sessions" count={completedSessions.length} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {completedSessions.map((s) => (
              <SessionCard key={s.id} session={s} userId={user.id} />
            ))}
          </div>
        </div>
      )}

      {mySessions.length === 0 && (
        <div>
          <SectionHeader label="Your Sessions" count={0} />
          <EmptyCard message="You have no sessions yet. Post a request or claim one as a tutor." />
        </div>
      )}
    </div>
  )
}
