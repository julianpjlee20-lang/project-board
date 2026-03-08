import { Pool } from 'pg'

let pool: Pool | null = null

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    console.log('DATABASE_URL:', connectionString ? 'set' : 'NOT SET')

    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }

    const isProduction = process.env.NODE_ENV === 'production'
    const isTest = process.env.NODE_ENV === 'test'

    pool = new Pool({
      connectionString,
      // Zeabur 免費方案通常限制 ~20 連線，預留給其他服務
      max: isTest ? 3 : isProduction ? 10 : 5,
      // 閒置連線 30 秒後釋放
      idleTimeoutMillis: 30000,
      // 連線建立超時（遠端 DB 需較長時間）
      connectionTimeoutMillis: isProduction ? 10000 : 5000,
      // SQL 語句執行超時
      statement_timeout: 15000,
      // serverless / edge 環境友善：pool 閒置時允許 process 正常退出
      allowExitOnIdle: true,
    })

    // Pool-level error handler — 防止 unhandled rejection 導致 process crash
    pool.on('error', (err) => {
      console.error('[DB Pool] Unexpected error on idle client:', err.message)
      // 不要 throw，讓 pool 自動重建連線
    })

    // 連線建立時的 debug log（僅開發環境）
    if (!isProduction) {
      pool.on('connect', () => {
        console.log(`[DB Pool] New client connected (total: ${pool?.totalCount}, idle: ${pool?.idleCount}, waiting: ${pool?.waitingCount})`)
      })
    }
  }
  return pool
}

/** 取得獨立 client（用於 transaction） - 呼叫者必須自行 release */
export async function getClient() {
  return getPool().connect()
}

type QueryParam = string | number | boolean | null | undefined | string[] | number[]
export async function query(text: string, params?: QueryParam[]) {
  try {
    const p = getPool()
    const result = await p.query(text, params)
    return result.rows
  } catch (error) {
    console.error('Query error:', error)
    throw error
  }
}
