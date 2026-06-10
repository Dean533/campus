/**
 * Campus diagnostic script
 * Run: npx tsx scripts/diagnose.ts
 *
 * Checks row counts for all key tables, validates per-school data isolation,
 * simulates the feed and sessions queries, and prints expected vs. actual counts.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  console.log('\n=== Campus diagnostic ===\n')
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)

  // ---- 1. Row counts ----
  console.log('\n--- Row counts (service role, bypasses RLS) ---')
  const tables = [
    'schools',
    'professors',
    'courses',
    'course_offerings',
    'profiles',
    'enrollments',
    'verified_tutors',
    'questions',
    'answers',
    'answer_likes',
    'professor_ratings',
    'session_requests',
    'sessions',
    'session_participants',
    'study_groups',
  ] as const

  const counts: Record<string, number | null> = {}
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
    if (error) {
      console.log(`  ${table}: ERROR - ${error.message}`)
      counts[table] = null
    } else {
      console.log(`  ${table}: ${count}`)
      counts[table] = count
    }
  }

  // ---- 2. Schools ----
  console.log('\n--- Schools ---')
  const { data: schools } = await supabase.from('schools').select('id, name, domain')
  for (const s of schools ?? []) {
    console.log(`  ${s.name} (${s.domain}): ${s.id}`)
  }

  // ---- 3. Per-school breakdown ----
  console.log('\n--- Per-school breakdown ---')
  for (const s of schools ?? []) {
    const [{ count: qCount }, { count: srCount }, { count: sesCount }] = await Promise.all([
      supabase.from('questions').select('*', { count: 'exact', head: true }).eq('school_id', s.id),
      supabase.from('session_requests').select('*', { count: 'exact', head: true }).eq('school_id', s.id),
      supabase
        .from('session_requests')
        .select('*', { count: 'exact', head: true })
        .eq('school_id', s.id)
        .eq('status', 'open'),
    ])
    console.log(`  ${s.name}:  questions=${qCount}  session_requests=${srCount}  open=${sesCount}`)
  }

  // ---- 4. Session status breakdown ----
  console.log('\n--- Session status breakdown ---')
  for (const status of ['scheduled', 'completed', 'cancelled']) {
    const { count } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', status)
    console.log(`  ${status}: ${count}`)
  }

  // ---- 5. Profile completeness ----
  console.log('\n--- Profile completeness ---')
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, school_id, onboarding_complete')
    .order('display_name')

  const noSchool  = (profiles ?? []).filter((p) => !p.school_id)
  const noOnboard = (profiles ?? []).filter((p) => !p.onboarding_complete)
  console.log(`  Total:                    ${profiles?.length ?? 0}`)
  console.log(`  null school_id:           ${noSchool.length}`)
  console.log(`  onboarding_complete=false: ${noOnboard.length}`)

  // ---- 6. Feed simulation ----
  const onboarded = (profiles ?? []).find((p) => p.school_id && p.onboarding_complete)
  if (onboarded) {
    console.log(`\n--- Feed simulation for: ${onboarded.display_name ?? onboarded.id} ---`)
    const { data: qs, error: qErr } = await supabase
      .from('questions')
      .select('id, title, school_id, course_offerings ( courses ( code ) )')
      .eq('school_id', onboarded.school_id)
      .order('created_at', { ascending: false })
      .limit(5)
    if (qErr) {
      console.log('  Query error:', qErr.message)
    } else {
      console.log(`  Returns ${qs?.length ?? 0} question(s) (showing up to 5):`)
      for (const q of qs ?? []) {
        const co = q.course_offerings as { courses?: { code?: string } } | null
        console.log(`    [${co?.courses?.code ?? '?'}] ${q.title.slice(0, 55)}`)
      }
    }
  } else {
    console.log('\n  No fully-onboarded profile found -- run seed first')
  }

  // ---- 7. Sessions open requests simulation ----
  if (onboarded?.school_id) {
    console.log(`\n--- Open session requests at school ${onboarded.school_id.slice(0, 8)}... ---`)
    const { data: reqs, error: rErr } = await supabase
      .from('session_requests')
      .select('id, session_type, duration_minutes, format, price_display, course_offerings ( courses ( code ) )')
      .eq('status', 'open')
      .eq('school_id', onboarded.school_id)
      .order('created_at', { ascending: false })
      .limit(5)
    if (rErr) {
      console.log('  Query error:', rErr.message)
    } else {
      console.log(`  Returns ${reqs?.length ?? 0} open request(s) (showing up to 5):`)
      for (const r of reqs ?? []) {
        const co = r.course_offerings as { courses?: { code?: string } } | null
        console.log(`    [${co?.courses?.code ?? '?'}] ${r.session_type} | ${r.format} | ${r.duration_minutes}min | $${r.price_display}`)
      }
    }
  }

  // ---- 8. Expected counts ----
  console.log('\n--- Expected counts after a full seed ---')
  console.log('  schools:           2')
  console.log('  professors:        13')
  console.log('  courses:           30')
  console.log('  course_offerings:  30')
  console.log('  profiles:          50')
  console.log('  enrollments:       ~150-200')
  console.log('  verified_tutors:   ~30-45')
  console.log('  questions:         80')
  console.log('  answers:           ~160-400')
  console.log('  session_requests:  22  (8 UCLA open + 10 UCLA matched + 4 Berk open)')
  console.log('  sessions:          10  (~3-4 scheduled, ~6-7 completed)')
  console.log('  session_participants: 10')
  console.log('  study_groups:      5')

  console.log('\n=== Done ===\n')
}

main().catch((err) => {
  console.error('Diagnostic failed:', err)
  process.exit(1)
})
