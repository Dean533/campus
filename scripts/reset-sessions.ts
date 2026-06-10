/**
 * Clears session_participants, sessions, and session_requests in FK order,
 * then exits. Re-run the full seed to repopulate (it will skip all other steps).
 *
 * Usage:
 *   npx tsx scripts/reset-sessions.ts
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

async function clearTable(table: string) {
  // Supabase requires at least one filter on delete. Using a tautology so all
  // rows match while service role bypasses RLS entirely.
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
  console.log('Campus session reset')
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
  console.log('')

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not set in .env.local')
    process.exit(1)
  }

  // Count before so the user can confirm what is being deleted.
  const counts: Record<string, number | null> = {}
  for (const t of ['session_requests', 'sessions', 'session_participants']) {
    const { count } = await supabase
      .from(t)
      .select('*', { count: 'exact', head: true })
    counts[t] = count
  }
  console.log('Current counts:')
  console.log('  session_requests:    ', counts['session_requests'])
  console.log('  sessions:            ', counts['sessions'])
  console.log('  session_participants:', counts['session_participants'])
  console.log('')

  // Delete in FK order: participants -> sessions -> requests.
  for (const table of ['session_participants', 'sessions', 'session_requests']) {
    process.stdout.write(`  deleting ${table}...`)
    await clearTable(table)
    console.log(' done')
  }

  console.log('')
  console.log('All session data cleared.')
  console.log('')
  console.log('Next step:')
  console.log('  npx tsx scripts/seed.ts')
  console.log('')
  console.log('The seed will skip all steps except sessions (count is now 0).')
}

main().catch((err) => {
  console.error('Reset failed:', err)
  process.exit(1)
})
