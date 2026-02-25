import { Pool } from 'pg'

let pool: Pool | null = null

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    console.log('DATABASE_URL:', connectionString ? 'set' : 'NOT SET')
    
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }
    
    pool = new Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 5000,
    })
  }
  return pool
}

export async function query(text: string, params?: any[]) {
  try {
    const p = getPool()
    const result = await p.query(text, params)
    return result.rows
  } catch (error) {
    console.error('Query error:', error)
    throw error
  }
}
