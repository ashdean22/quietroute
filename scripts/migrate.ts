import { readFileSync } from 'fs'
import { join } from 'path'
import { Pool } from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const sql = readFileSync(join(process.cwd(), 'db/001_schema.sql'), 'utf-8')
  try {
    await pool.query(sql)
    console.log('Migration applied successfully.')
  } finally {
    await pool.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
