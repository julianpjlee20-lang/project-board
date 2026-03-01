/**
 * 清理 E2E 測試產生的專案資料
 * 用法: node --env-file=.env scripts/cleanup-test-data.mjs
 */
import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL 未設定。請使用: node --env-file=.env scripts/cleanup-test-data.mjs')
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 20000,
})

// 測試專案名稱的關鍵字模式
const TEST_PATTERNS = [
  'Board測試%',
  'Modal測試%',
  'Phase測試%',
  '測試專案%',
  '移動測試%',
  '子任務測試%',
  'CRUD測試%',
]

async function cleanup() {
  try {
    // 先列出所有測試專案
    const whereClause = TEST_PATTERNS.map((_, i) => `name LIKE $${i + 1}`).join(' OR ')
    const listResult = await pool.query(
      `SELECT id, name, created_at FROM projects WHERE ${whereClause} ORDER BY created_at DESC`,
      TEST_PATTERNS
    )

    if (listResult.rows.length === 0) {
      console.log('沒有找到測試專案，資料庫已乾淨。')
      return
    }

    console.log(`找到 ${listResult.rows.length} 個測試專案：`)
    for (const row of listResult.rows) {
      console.log(`  - [${row.id}] ${row.name} (${row.created_at})`)
    }

    // 刪除（CASCADE 會一併刪除 columns, cards, subtasks 等）
    const deleteResult = await pool.query(
      `DELETE FROM projects WHERE ${whereClause} RETURNING id, name`,
      TEST_PATTERNS
    )

    console.log(`\n已刪除 ${deleteResult.rowCount} 個測試專案。`)
  } catch (error) {
    console.error('清理失敗:', error)
  } finally {
    await pool.end()
  }
}

cleanup()
