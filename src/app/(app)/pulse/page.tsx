import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import { PAGE, CARD, SECTION_LABEL, profPill } from '@/lib/ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RatingRow = {
  exam_fairness: number
  grade_transparency: number
  lecture_quality: number
  office_hours_value: number
  curve_likelihood: number
  workload_realism: number
  would_retake: boolean
}

type ProfRow = {
  id: string
  first_name: string
  last_name: string
  department: string
  schools: { name: string } | null
  professor_ratings: RatingRow[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avg(nums: number[]) {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function pct(val: number) {
  return Math.round((val / 5) * 100)
}

const RATING_DIMS = [
  { key: 'exam_fairness',      label: 'Exam Fairness'      },
  { key: 'lecture_quality',    label: 'Lecture Quality'    },
  { key: 'grade_transparency', label: 'Grade Transparency' },
  { key: 'office_hours_value', label: 'Office Hours'       },
  { key: 'curve_likelihood',   label: 'Curve Likelihood'   },
  { key: 'workload_realism',   label: 'Workload Realism'   },
] as const

type DimKey = typeof RATING_DIMS[number]['key']

// Color thresholds: green >= 4.0, amber >= 3.0, red < 3.0
function barColor(val: number): string {
  if (val >= 4.0) return '#22c55e'
  if (val >= 3.0) return '#f59e0b'
  return '#f87171'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RatingBar({ label, value }: { label: string; value: number }) {
  const width  = pct(value)
  const color  = barColor(value)
  const isZero = value === 0

  return (
    <div style={{ marginBottom: 7 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 3,
        }}
      >
        <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 600,
            color: isZero ? '#cbd5e1' : '#334155',
            minWidth: 24,
            textAlign: 'right',
          }}
        >
          {isZero ? '--' : value.toFixed(1)}
        </span>
      </div>
      <div style={{ height: 5, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${width}%`,
            background: isZero ? '#e2e8f0' : color,
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  )
}

function ProfCard({ prof }: { prof: ProfRow }) {
  const ratings     = prof.professor_ratings ?? []
  const count       = ratings.length
  const avgs: Record<DimKey, number> = {} as Record<DimKey, number>
  for (const dim of RATING_DIMS) {
    avgs[dim.key] = avg(ratings.map((r) => r[dim.key]))
  }

  const overallAvg  = avg(Object.values(avgs))
  const wouldRetake = count > 0
    ? Math.round((ratings.filter((r) => r.would_retake).length / count) * 100)
    : 0

  return (
    <div style={{ ...CARD, padding: '16px 18px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
            {prof.first_name} {prof.last_name}
          </div>
          <span style={profPill()}>{prof.department}</span>
        </div>

        {/* Overall score with semantic color */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {count > 0 ? (
            <>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: barColor(overallAvg),
                  lineHeight: 1,
                }}
              >
                {overallAvg.toFixed(1)}
              </div>
              <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>
                {count} rating{count !== 1 ? 's' : ''}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#cbd5e1' }}>No ratings</div>
          )}
        </div>
      </div>

      {/* Rating bars */}
      {RATING_DIMS.map((dim) => (
        <RatingBar key={dim.key} label={dim.label} value={avgs[dim.key]} />
      ))}

      {/* Would retake */}
      {count > 0 && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background:
                wouldRetake >= 70 ? '#22c55e' : wouldRetake >= 50 ? '#f59e0b' : '#f87171',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, color: '#475569' }}>
            {wouldRetake}% would take again
          </span>
        </div>
      )}
    </div>
  )
}

function SchoolSection({ school, profs }: { school: string; profs: ProfRow[] }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={SECTION_LABEL}>{school}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          {profs.length} professor{profs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* 2-column grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 14,
        }}
      >
        {profs.map((p) => (
          <ProfCard key={p.id} prof={p} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProfPulsePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (!profile?.school_id) redirect('/onboarding/school')

  const { data: rawProfs, error } = await supabase
    .from('professors')
    .select(`
      id,
      first_name,
      last_name,
      department,
      schools ( name ),
      professor_ratings (
        exam_fairness,
        grade_transparency,
        lecture_quality,
        office_hours_value,
        curve_likelihood,
        workload_realism,
        would_retake
      )
    `)
    .order('last_name')

  if (error) console.error('[pulse] professors error:', error.message)

  const profs = (rawProfs ?? []) as unknown as ProfRow[]

  const uclaProfs = profs.filter((p) => p.schools?.name === 'UCLA')
  const berkProfs = profs.filter((p) => p.schools?.name === 'UC Berkeley')

  return (
    <div style={{ ...PAGE, maxWidth: 1000 }}>
      <PageHeader
        title="Prof Pulse"
        description="Know your professor before the semester starts."
      />

      {uclaProfs.length > 0 && (
        <SchoolSection school="UCLA" profs={uclaProfs} />
      )}
      {berkProfs.length > 0 && (
        <SchoolSection school="UC Berkeley" profs={berkProfs} />
      )}
      {profs.length === 0 && (
        <div
          style={{
            padding: '40px 24px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: 14,
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #e8edf3',
          }}
        >
          No professor data yet. Run the seed script to populate ratings.
        </div>
      )}
    </div>
  )
}
