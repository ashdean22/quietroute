import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { Pool } from 'pg'
import { config } from 'dotenv'

config({ path: '.env.local' })

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const dbDir = join(process.cwd(), 'db')
  const files = readdirSync(dbDir)
    .filter((f) => f.endsWith('.sql'))
    .sort() // alphabetical order = chronological (001_, 002_, …)

  try {
    for (const file of files) {
      const sql = readFileSync(join(dbDir, file), 'utf-8')
      console.log(`Applying ${file}…`)
      await pool.query(sql)
    }
    console.log('All migrations applied.')
  } finally {
    await pool.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
