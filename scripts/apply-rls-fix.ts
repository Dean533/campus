/**
 * Applies the RLS recursion fix for session_participants / sessions.
 *
 * Requires a Supabase personal access token (not the service role key).
 * Get one at: https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=<your-token> npx tsx scripts/apply-rls-fix.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const PROJECT_REF = 'lslgbuifmwttbwuvfeyr'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

const SQL = `
-- Create SECURITY DEFINER helper to read sessions.tutor_id without triggering RLS
create or replace function public.get_session_tutor_id(p_session_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select tutor_id from public.sessions where id = p_session_id
$$;

-- Replace the recursive session_participants policy
drop policy if exists "sp_read_same_session" on public.session_participants;

create policy "sp_read_same_session" on public.session_participants
  for select using (
    student_id = auth.uid()
    or public.get_session_tutor_id(session_id) = auth.uid()
  );
`.trim()

async function main() {
  if (!ACCESS_TOKEN) {
    console.error('ERROR: SUPABASE_ACCESS_TOKEN is not set.')
    console.error('')
    console.error('Option A — run via this script:')
    console.error('  1. Go to https://supabase.com/dashboard/account/tokens')
    console.error('  2. Create a new access token')
    console.error('  3. Run: SUPABASE_ACCESS_TOKEN=<token> npx tsx scripts/apply-rls-fix.ts')
    console.error('')
    console.error('Option B — paste directly in the Supabase SQL Editor:')
    console.error('  https://supabase.com/dashboard/project/lslgbuifmwttbwuvfeyr/sql/new')
    console.error('')
    console.error('SQL to run:')
    console.error('─'.repeat(64))
    console.error(SQL)
    console.error('─'.repeat(64))
    process.exit(1)
  }

  console.log('Applying RLS fix to project:', PROJECT_REF)
  console.log('')

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: SQL }),
    }
  )

  const body = await res.json()

  if (!res.ok) {
    console.error('Management API error:', JSON.stringify(body, null, 2))
    process.exit(1)
  }

  console.log('RLS fix applied successfully.')
  console.log('')
  console.log('What changed:')
  console.log('  + created function: public.get_session_tutor_id(uuid)')
  console.log('  ~ replaced policy:  session_participants.sp_read_same_session')
  console.log('')
  console.log('The session_participants policy no longer queries sessions directly.')
  console.log('It uses the SECURITY DEFINER helper, breaking the recursive loop.')
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
