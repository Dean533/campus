/**
 * Clears questions, answers, answer_likes, professor_ratings, and study_groups
 * so the seed can re-run those sections with updated realistic content.
 *
 * Does NOT touch users, schools, courses, offerings, enrollments, or sessions.
 *
 * Usage:
 *   npx tsx scripts/reset-content.ts
 *   npx tsx scripts/seed.ts
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

async function countTable(table: string): Promise<number | null> {
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
  return count
}

async function clearTable(table: string) {
  const { error } = await supabase
    .from(table)
    .delete()
    .gte('created_at', '2000-01-01T00:00:00Z')
  if (error) {
    console.error(`  ERROR clearing ${table}:`, error.message)
    process.exit(1)
  }
}

async function main() {
  console.log('Campus content reset')
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not set in .env.local')
    process.exit(1)
  }

  const tables = [
    'answer_likes',
    'answers',
    'questions',
    'professor_ratings',
    'study_group_members',
    'study_groups',
  ]

  console.log('Current counts:')
  for (const t of tables) {
    const n = await countTable(t)
    console.log(`  ${t.padEnd(22)} ${n}`)
  }
  console.log('')

  // Delete in FK order: likes -> answers -> questions, then ratings, then members -> groups.
  for (const table of tables) {
    process.stdout.write(`  deleting ${table}...`)
    await clearTable(table)
    console.log(' done')
  }

  console.log('')
  console.log('Content cleared. Next step:')
  console.log('  npx tsx scripts/seed.ts')
  console.log('')
  console.log('The seed will skip schools, professors, courses, offerings,')
  console.log('users, enrollments, verified_tutors, and sessions (counts > 0).')
  console.log('It will re-run sections 8, 9, and 11 with realistic text.')
}

main().catch((err) => {
  console.error('Reset failed:', err)
  process.exit(1)
})
