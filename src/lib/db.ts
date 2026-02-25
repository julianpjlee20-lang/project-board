import { Pool } from 'pg'

// Create a singleton pool
let pool: Pool | null = null

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    pool = new Pool({
      connectionString,
      max: 1, // Reduce connections for serverless
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 5000,
    })
  }
  return pool
}

export async function query(text: string, params?: any[]) {
  const p = getPool()
  const res = await p.query(text, params)
  return res.rows
}

export default getPool()
