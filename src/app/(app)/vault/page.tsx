import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/PageHeader'
import {
  PAGE,
  CARD,
  SECTION_LABEL,
  coursePill,
  profPill,
  tierPill,
  materialTypePill,
  gradePill,
  PRIMARY_BTN,
} from '@/lib/ui'

// ---------------------------------------------------------------------------
// Static demo listings
// ---------------------------------------------------------------------------

type MaterialType = 'Notes' | 'Flashcards' | 'Practice Problems' | 'Cheat Sheet'

type VaultItem = {
  id: string
  school: 'UCLA' | 'Berkeley'
  courseCode: string
  profLast: string
  type: MaterialType
  title: string
  grade: string
  price: number
  sellerName: string
  sellerTier: string
}

const VAULT_ITEMS: VaultItem[] = [
  // UCLA
  { id: 'v01', school: 'UCLA',     courseCode: 'CS131',    profLast: 'Millstein',  type: 'Notes',             title: 'Complete lecture notes weeks 1-10 with worked examples',                      grade: 'A',  price: 12, sellerName: 'Alex R.',    sellerTier: 'Gold'   },
  { id: 'v02', school: 'UCLA',     courseCode: 'CS131',    profLast: 'Millstein',  type: 'Practice Problems', title: '45 problems on type inference and lambda calculus with solutions',              grade: 'A-', price: 8,  sellerName: 'Sarah M.',   sellerTier: 'Silver' },
  { id: 'v03', school: 'UCLA',     courseCode: 'CS111',    profLast: 'Millstein',  type: 'Cheat Sheet',       title: 'OS Principles one-page reference: scheduling, memory, concurrency',             grade: 'A',  price: 5,  sellerName: 'Jordan T.',  sellerTier: 'Gold'   },
  { id: 'v04', school: 'UCLA',     courseCode: 'CS111',    profLast: 'Millstein',  type: 'Notes',             title: 'Annotated slides every lecture with my own explanations added',                 grade: 'A',  price: 10, sellerName: 'Jordan T.',  sellerTier: 'Gold'   },
  { id: 'v05', school: 'UCLA',     courseCode: 'CS32',     profLast: 'Smallberg',  type: 'Notes',             title: 'Comprehensive notes: arrays through balanced trees with diagrams',              grade: 'A',  price: 10, sellerName: 'Chris L.',   sellerTier: 'Silver' },
  { id: 'v06', school: 'UCLA',     courseCode: 'CS32',     profLast: 'Smallberg',  type: 'Practice Problems', title: '30 solved midterm prep exercises with step-by-step walkthroughs',               grade: 'A-', price: 7,  sellerName: 'Priya K.',   sellerTier: 'Bronze' },
  { id: 'v07', school: 'UCLA',     courseCode: 'CS33',     profLast: 'Nachenberg', type: 'Cheat Sheet',       title: 'x86 assembly and memory model quick-reference card',                           grade: 'A',  price: 6,  sellerName: 'Sam W.',     sellerTier: 'Gold'   },
  { id: 'v08', school: 'UCLA',     courseCode: 'CS33',     profLast: 'Nachenberg', type: 'Notes',             title: 'Lectures 1-20: system architecture and assembly with full diagrams',            grade: 'A',  price: 9,  sellerName: 'Sam W.',     sellerTier: 'Gold'   },
  { id: 'v09', school: 'UCLA',     courseCode: 'CS161',    profLast: 'Millstein',  type: 'Flashcards',        title: '200 cards covering search, constraint satisfaction, Bayes nets, and ML',         grade: 'A-', price: 10, sellerName: 'Mia B.',     sellerTier: 'Silver' },
  { id: 'v10', school: 'UCLA',     courseCode: 'CS161',    profLast: 'Millstein',  type: 'Notes',             title: 'Complete AI course notes with algorithm pseudocode and derivations',             grade: 'A',  price: 12, sellerName: 'Riley C.',   sellerTier: 'Gold'   },
  { id: 'v11', school: 'UCLA',     courseCode: 'CS35L',    profLast: 'Eggert',     type: 'Notes',             title: 'All lab write-ups and tool reference: shell, git, make, Python',                grade: 'A-', price: 7,  sellerName: 'Tae P.',     sellerTier: 'Bronze' },
  { id: 'v12', school: 'UCLA',     courseCode: 'MATH31A',  profLast: 'Bertozzi',   type: 'Practice Problems', title: 'Full practice exam packet with solutions, 4 full-length exams included',          grade: 'A',  price: 8,  sellerName: 'Yuki H.',    sellerTier: 'Silver' },
  { id: 'v13', school: 'UCLA',     courseCode: 'MATH31B',  profLast: 'Vese',       type: 'Notes',             title: 'Lecture notes on series, sequences, and integration techniques',                grade: 'A',  price: 9,  sellerName: 'Yuki H.',    sellerTier: 'Silver' },
  { id: 'v14', school: 'UCLA',     courseCode: 'MATH33A',  profLast: 'Vese',       type: 'Flashcards',        title: '150 flashcards covering key theorems, proofs, and definitions',                  grade: 'A-', price: 6,  sellerName: 'Omar D.',    sellerTier: 'Bronze' },
  { id: 'v15', school: 'UCLA',     courseCode: 'MATH115A', profLast: 'Bertozzi',   type: 'Notes',             title: 'Advanced linear algebra: all proof strategies and worked examples',              grade: 'A',  price: 12, sellerName: 'Dana K.',    sellerTier: 'Gold'   },
  { id: 'v16', school: 'UCLA',     courseCode: 'ECON1',    profLast: 'Burstein',   type: 'Notes',             title: 'Principles of Economics complete notes with labeled supply/demand diagrams',    grade: 'A-', price: 8,  sellerName: 'Leah N.',    sellerTier: 'Bronze' },
  { id: 'v17', school: 'UCLA',     courseCode: 'ECON11',   profLast: 'Burstein',   type: 'Practice Problems', title: 'Problem sets 1-9 with fully worked solutions and intuition notes',               grade: 'A',  price: 10, sellerName: 'Leah N.',    sellerTier: 'Silver' },
  { id: 'v18', school: 'UCLA',     courseCode: 'ECON101',  profLast: 'Burstein',   type: 'Cheat Sheet',       title: 'Advanced micro theory formula reference: utility, equilibrium, welfare',         grade: 'A',  price: 6,  sellerName: 'Marcus F.',  sellerTier: 'Gold'   },
  { id: 'v19', school: 'UCLA',     courseCode: 'PSYCH100A',profLast: 'Castel',     type: 'Notes',             title: 'Stats for psychology full notes with SPSS output examples and interpretation',  grade: 'A',  price: 9,  sellerName: 'Aisha J.',   sellerTier: 'Silver' },
  { id: 'v20', school: 'UCLA',     courseCode: 'PSYCH100B',profLast: 'Bjork',      type: 'Flashcards',        title: 'Research methods key terms: 120 cards covering design, validity, analysis',    grade: 'A-', price: 5,  sellerName: 'Aisha J.',   sellerTier: 'Silver' },
  { id: 'v21', school: 'UCLA',     courseCode: 'CS130',    profLast: 'Palsberg',   type: 'Notes',             title: 'Software engineering design pattern notes with annotated code examples',        grade: 'A',  price: 11, sellerName: 'Will T.',    sellerTier: 'Gold'   },
  { id: 'v22', school: 'UCLA',     courseCode: 'CS143',    profLast: 'Eggert',     type: 'Notes',             title: 'Compiler construction notes: lexer through code generation with examples',      grade: 'A',  price: 13, sellerName: 'Nina L.',    sellerTier: 'Gold'   },
  { id: 'v23', school: 'UCLA',     courseCode: 'CS132',    profLast: 'Palsberg',   type: 'Practice Problems', title: 'Automata and parsing exercises with solutions for midterm prep',                 grade: 'A-', price: 8,  sellerName: 'Nina L.',    sellerTier: 'Gold'   },
  { id: 'v24', school: 'UCLA',     courseCode: 'MATH32A',  profLast: 'Bertozzi',   type: 'Notes',             title: 'Multivariable calculus notes with visual illustrations and diagrams',            grade: 'A',  price: 9,  sellerName: 'Ben M.',     sellerTier: 'Silver' },
  { id: 'v25', school: 'UCLA',     courseCode: 'CS31',     profLast: 'Smallberg',  type: 'Notes',             title: 'Intro CS complete notes, beginner-friendly, all 10 weeks covered',              grade: 'A-', price: 7,  sellerName: 'Emma R.',    sellerTier: 'Bronze' },
  // Berkeley
  { id: 'b01', school: 'Berkeley', courseCode: 'CS61A',    profLast: 'DeNero',     type: 'Notes',             title: 'Structure and Interpretation: annotated notes all 40 lectures',                grade: 'A',  price: 12, sellerName: 'Kai S.',     sellerTier: 'Gold'   },
  { id: 'b02', school: 'Berkeley', courseCode: 'CS61B',    profLast: 'Hug',        type: 'Practice Problems', title: 'Data structures full problem set collection with step-by-step solutions',        grade: 'A',  price: 9,  sellerName: 'Kai S.',     sellerTier: 'Gold'   },
  { id: 'b03', school: 'Berkeley', courseCode: 'CS70',     profLast: 'Rao',        type: 'Flashcards',        title: 'Discrete math and probability: 180 cards through all major topics',              grade: 'A-', price: 7,  sellerName: 'Nora V.',    sellerTier: 'Silver' },
  { id: 'b04', school: 'Berkeley', courseCode: 'CS189',    profLast: 'Rao',        type: 'Cheat Sheet',       title: 'ML algorithms reference card with formulas and selection guide',                grade: 'A',  price: 6,  sellerName: 'Dev P.',     sellerTier: 'Gold'   },
  { id: 'b05', school: 'Berkeley', courseCode: 'CS188',    profLast: 'DeNero',     type: 'Notes',             title: 'Intro AI complete lecture notes: search, CSP, Bayes nets, RL',                  grade: 'A',  price: 11, sellerName: 'Dev P.',     sellerTier: 'Gold'   },
  { id: 'b06', school: 'Berkeley', courseCode: 'DATA8',    profLast: 'Hug',        type: 'Notes',             title: 'Foundations of data science notes with annotated Python code',                  grade: 'A-', price: 8,  sellerName: 'Sasha R.',   sellerTier: 'Bronze' },
  { id: 'b07', school: 'Berkeley', courseCode: 'MATH54',   profLast: 'Rao',        type: 'Practice Problems', title: 'Linear algebra and ODE problem set with full solutions',                        grade: 'A',  price: 9,  sellerName: 'Uma K.',     sellerTier: 'Silver' },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function VaultPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id, schools ( name )')
    .eq('id', user.id)
    .single()

  const schoolName = (profile?.schools as { name?: string } | null)?.name ?? ''
  const isUCLA     = schoolName.includes('UCLA')
  const school     = isUCLA ? 'UCLA' : 'Berkeley'

  const items = VAULT_ITEMS.filter((v) => v.school === school)

  return (
    <div style={PAGE}>
      <PageHeader
        title="Study Vault"
        description="Verified study materials from students who aced the course."
        action={
          <button style={PRIMARY_BTN}>+ List Material</button>
        }
      />

      <div style={{ marginBottom: 16 }}>
        <span style={SECTION_LABEL}>{items.length} listings</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
        }}
      >
        {items.map((item) => (
          <VaultCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

function VaultCard({ item }: { item: VaultItem }) {
  return (
    <div
      style={{
        ...CARD,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Top: course + type */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span style={coursePill()}>{item.courseCode}</span>
        <span style={materialTypePill(item.type)}>{item.type}</span>
      </div>

      {/* Title */}
      <p
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: '#0f172a',
          margin: 0,
          lineHeight: 1.45,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {item.title}
      </p>

      {/* Prof */}
      <span style={profPill()}>{item.profLast}</span>

      {/* Grade + price */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        {/* Grade - slightly more prominent */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: 10.5,
              color: '#94a3b8',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Grade
          </span>
          <span
            style={{
              ...gradePill(item.grade),
              fontSize: 12,
              fontWeight: 700,
              padding: '4px 10px',
            }}
          >
            {item.grade}
          </span>
        </div>

        {/* Price with clearer "simulated" label */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: item.price === 0 ? '#15803d' : '#0f172a',
            }}
          >
            {item.price === 0 ? 'Free' : `$${item.price}`}
          </span>
          {item.price > 0 && (
            <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 500 }}>
              simulated
            </span>
          )}
        </div>
      </div>

      {/* Seller */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingTop: 6,
          borderTop: '1px solid #f1f5f9',
        }}
      >
        <span style={{ fontSize: 12.5, color: '#475569', fontWeight: 500 }}>
          {item.sellerName}
        </span>
        <span style={tierPill(item.sellerTier)}>{item.sellerTier}</span>
      </div>
    </div>
  )
}
