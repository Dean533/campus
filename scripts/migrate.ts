/**
 * Migration runner
 * Run: npx tsx scripts/migrate.ts
 *
 * Requires DATABASE_URL in .env.local
 * Get it from: Supabase dashboard > Settings > Database > Connection string (URI mode)
 * It looks like: postgresql://postgres:[your-password]@db.lslgbuifmwttbwuvfeyr.supabase.co:5432/postgres
 */

import postgres from 'postgres'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const DB_URL = process.env.DATABASE_URL

if (!DB_URL) {
  console.error('\nERROR: DATABASE_URL is not set in .env.local')
  console.error('\nAdd this line to .env.local:')
  console.error('DATABASE_URL=postgresql://postgres:[your-password]@db.lslgbuifmwttbwuvfeyr.supabase.co:5432/postgres')
  console.error('\nFind your password: Supabase dashboard > Settings > Database > Connection string')
  process.exit(1)
}

const MIGRATIONS = [
  'supabase/migrations/0001_schema.sql',
  'supabase/migrations/0002_rls.sql',
  'supabase/migrations/0003_triggers.sql',
  'supabase/migrations/0004_functions.sql',
  'supabase/migrations/0005_indexes.sql',
]

async function main() {
  console.log('Connecting to database...')
  const sql = postgres(DB_URL!, { ssl: 'require', max: 1 })

  try {
    for (const file of MIGRATIONS) {
      const filePath = path.resolve(process.cwd(), file)
      const content = fs.readFileSync(filePath, 'utf-8')
      console.log(`Running ${file}...`)
      await sql.unsafe(content)
      console.log(`  done.`)
    }
    console.log('\nAll migrations applied successfully.')
  } finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error('\nMigration failed:', err.message)
  process.exit(1)
})
