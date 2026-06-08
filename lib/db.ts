import { Pool } from 'pg'

// Singleton pool — reused across hot-reloads in dev via globalThis
const globalForPg = globalThis as typeof globalThis & { pgPool?: Pool }

const pool =
  globalForPg.pgPool ??
  new Pool({ connectionString: process.env.DATABASE_URL })

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool

export default pool
