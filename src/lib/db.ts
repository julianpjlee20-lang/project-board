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
      max: process.env.NODE_ENV === 'production' ? 10 : 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000, // 增加到 20 秒,因為遠端資料庫
      statement_timeout: 15000, // SQL 語句超時 15 秒
    })
  }
  return pool
}

/** 取得獨立 client（用於 transaction） - 呼叫者必須自行 release */
export async function getClient() {
  return getPool().connect()
}

export async function query(text: string, params?: (string | number | boolean | null | undefined)[]) {
  try {
    const p = getPool()
    const result = await p.query(text, params)
    return result.rows
  } catch (error) {
    console.error('Query error:', error)
    throw error
  }
}
