/**
 * AI 專用：批次更新端點（效能優化版）
 * 一次更新多張卡片（進度、優先度、移動欄位等，最多 50 筆）
 *
 * 效能優化：
 * - 批次驗證卡片存在性（單次 SELECT ... WHERE id = ANY）
 * - 批次取得欄位資訊（單次 SELECT ... WHERE id = ANY）
 * - 批次更新卡片欄位（UNNEST 批次 UPDATE）
 * - 批次插入 activity logs（單次 INSERT with VALUES）
 * - 批次處理指派人（批次 DELETE + INSERT）
 * - 批次處理欄位移動
 *
 * 安全規範：
 * - requireAuth() + requireWritePermission() 保護
 * - 部分卡片失敗不中斷整批
 * - 所有變更寫入 activity_logs
 */

import { NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { requireWritePermission } from '@/lib/api-key-guard'
import { z } from 'zod'
import { validateData } from '@/lib/validations'
import type { PoolClient } from 'pg'

// 批次更新的驗證 schema
const batchUpdateSchema = z.object({
  updates: z.array(z.object({
    card_id: z.string().uuid('card_id 必須為有效的 UUID'),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional().or(z.literal('')),
    progress: z.number().int().min(0).max(100).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/).optional().or(z.literal('')),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/).optional().or(z.literal('')),
    phase_id: z.string().uuid().optional().or(z.literal('')),
    assignee_id: z.string().uuid().optional().or(z.literal('')),
    move_to_column: z.string().optional(),
  })).min(1, '至少需要一筆更新').max(50, '每次最多 50 筆更新'),
  project_id: z.string().uuid('project_id 必須為有效的 UUID').optional(),
})

// 可更新的欄位定義
const FIELD_MAP = [
  { key: 'title', col: 'title', logTarget: '標題' },
  { key: 'description', col: 'description', logTarget: '描述' },
  { key: 'progress', col: 'progress', logTarget: '進度' },
  { key: 'priority', col: 'priority', logTarget: '優先度' },
  { key: 'due_date', col: 'due_date', logTarget: '截止日' },
  { key: 'start_date', col: 'start_date', logTarget: '開始日期' },
  { key: 'phase_id', col: 'phase_id', logTarget: '階段' },
] as const

type UpdateItem = z.infer<typeof batchUpdateSchema>['updates'][number]
type CardRow = Record<string, unknown>
type ActivityLog = {
  project_id: string
  card_id: string
  user_id: string
  action: string
  target: string
  old_value: string
  new_value: string
}

/**
 * 格式化欄位值為顯示文字
 */
function formatDisplayValue(key: string, val: unknown): string {
  if (key === 'progress') return `${val ?? 0}%`
  if (val && typeof val === 'string') return val.split('T')[0]
  if (val && val instanceof Date) return val.toISOString().split('T')[0]
  return val ? String(val) : '(未設定)'
}

/**
 * Step 1: 批次取得所有卡片 + 欄位資訊
 * 查詢數：2（cards + columns）
 */
async function batchFetchCards(
  client: PoolClient,
  cardIds: string[]
): Promise<{ cardsMap: Map<string, CardRow>; columnsMap: Map<string, { project_id: string; name: string }> }> {
  // 批次取得卡片
  const cards = await client.query(
    'SELECT * FROM cards WHERE id = ANY($1)',
    [cardIds]
  )
  const cardsMap = new Map<string, CardRow>()
  const columnIds = new Set<string>()
  for (const card of cards.rows) {
    cardsMap.set(card.id, card)
    columnIds.add(card.column_id)
  }

  // 批次取得欄位資訊（project_id + name）
  const columnsMap = new Map<string, { project_id: string; name: string }>()
  if (columnIds.size > 0) {
    const cols = await client.query(
      'SELECT id, project_id, name FROM columns WHERE id = ANY($1)',
      [Array.from(columnIds)]
    )
    for (const col of cols.rows) {
      columnsMap.set(col.id, { project_id: col.project_id, name: col.name })
    }
  }

  return { cardsMap, columnsMap }
}

/**
 * Step 2: 在應用層計算所有欄位差異
 * 查詢數：0（純計算）
 */
function computeFieldUpdates(
  updates: UpdateItem[],
  cardsMap: Map<string, CardRow>,
  columnsMap: Map<string, { project_id: string; name: string }>,
  userId: string
): {
  cardFieldUpdates: Map<string, { sets: Record<string, unknown> }>
  activityLogs: ActivityLog[]
  validCardIds: Set<string>
  errors: { card_id: string; detail: string }[]
} {
  const cardFieldUpdates = new Map<string, { sets: Record<string, unknown> }>()
  const activityLogs: ActivityLog[] = []
  const validCardIds = new Set<string>()
  const errors: { card_id: string; detail: string }[] = []

  for (const upd of updates) {
    const old = cardsMap.get(upd.card_id)
    if (!old) {
      errors.push({ card_id: upd.card_id, detail: '卡片不存在' })
      continue
    }
    validCardIds.add(upd.card_id)

    const colInfo = columnsMap.get(old.column_id as string)
    const pid = colInfo?.project_id || ''

    const sets: Record<string, unknown> = {}

    for (const field of FIELD_MAP) {
      const val = (upd as Record<string, unknown>)[field.key]
      if (val !== undefined) {
        const dbVal = val === '' ? null : val
        sets[field.col] = dbVal

        // 比較舊值，產生 activity log
        const oldVal = old[field.col]
        if (String(oldVal ?? '') !== String(dbVal ?? '')) {
          activityLogs.push({
            project_id: pid,
            card_id: upd.card_id,
            user_id: userId,
            action: '修改',
            target: field.logTarget,
            old_value: formatDisplayValue(field.key, oldVal),
            new_value: formatDisplayValue(field.key, dbVal),
          })
        }
      }
    }

    if (Object.keys(sets).length > 0) {
      cardFieldUpdates.set(upd.card_id, { sets })
    }
  }

  return { cardFieldUpdates, activityLogs, validCardIds, errors }
}

/**
 * Step 3: 批次更新卡片欄位（使用 CTE + UNNEST）
 * 查詢數：最多 7（每個可能變更的欄位一次 UPDATE，但只更新有變更的欄位）
 * 實際上通常 1-3 個查詢（AI 常見操作：progress + priority）
 */
async function batchUpdateCardFields(
  client: PoolClient,
  cardFieldUpdates: Map<string, { sets: Record<string, unknown> }>
): Promise<void> {
  if (cardFieldUpdates.size === 0) return

  // 收集每個欄位需要更新的 card_id + value
  const fieldBatches: Record<string, { ids: string[]; values: unknown[] }> = {}

  for (const [cardId, { sets }] of cardFieldUpdates) {
    for (const [col, val] of Object.entries(sets)) {
      if (!fieldBatches[col]) {
        fieldBatches[col] = { ids: [], values: [] }
      }
      fieldBatches[col].ids.push(cardId)
      fieldBatches[col].values.push(val)
    }
  }

  // 每個欄位一次批次 UPDATE（使用 UNNEST）
  for (const [col, batch] of Object.entries(fieldBatches)) {
    // 根據欄位類型選擇 PostgreSQL cast
    let typeCast = '::text'
    if (col === 'progress') typeCast = '::int'
    else if (col === 'due_date' || col === 'start_date') typeCast = '::date'
    else if (col === 'phase_id') typeCast = '::uuid'

    await client.query(
      `UPDATE cards SET ${col} = batch.val${typeCast}, updated_at = NOW()
       FROM (SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::text[]) AS val) AS batch
       WHERE cards.id = batch.id`,
      [batch.ids, batch.values.map(v => v === null ? null : String(v))]
    )
  }
}

/**
 * Step 4: 批次處理指派人
 * 查詢數：最多 4（取得舊指派 + 取得新指派人名 + 批次刪除 + 批次插入）
 */
async function batchHandleAssignees(
  client: PoolClient,
  updates: UpdateItem[],
  cardsMap: Map<string, CardRow>,
  columnsMap: Map<string, { project_id: string; name: string }>,
  userId: string
): Promise<ActivityLog[]> {
  const assigneeUpdates = updates.filter(
    u => u.assignee_id !== undefined && cardsMap.has(u.card_id)
  )
  if (assigneeUpdates.length === 0) return []

  const cardIdsWithAssignee = assigneeUpdates.map(u => u.card_id)
  const activityLogs: ActivityLog[] = []

  // 批次取得舊指派人名稱
  const oldAssignees = await client.query(
    `SELECT ca.card_id, p.name
     FROM card_assignees ca
     JOIN profiles p ON p.id = ca.user_id
     WHERE ca.card_id = ANY($1)`,
    [cardIdsWithAssignee]
  )
  const oldAssigneeMap = new Map<string, string>()
  for (const row of oldAssignees.rows) {
    oldAssigneeMap.set(row.card_id, row.name)
  }

  // 收集需要查詢的新指派人 ID
  const newAssigneeIds = new Set<string>()
  for (const upd of assigneeUpdates) {
    if (upd.assignee_id && upd.assignee_id !== '') {
      newAssigneeIds.add(upd.assignee_id)
    }
  }

  // 批次取得新指派人資訊
  const newAssigneeMap = new Map<string, { id: string; name: string }>()
  if (newAssigneeIds.size > 0) {
    const profiles = await client.query(
      'SELECT id, name FROM profiles WHERE id = ANY($1)',
      [Array.from(newAssigneeIds)]
    )
    for (const p of profiles.rows) {
      newAssigneeMap.set(p.id, { id: p.id, name: p.name })
    }
  }

  // 批次刪除舊指派
  await client.query(
    'DELETE FROM card_assignees WHERE card_id = ANY($1)',
    [cardIdsWithAssignee]
  )

  // 收集要插入的新指派 + activity logs
  const insertPairs: { card_id: string; user_id: string }[] = []

  for (const upd of assigneeUpdates) {
    const old = cardsMap.get(upd.card_id)!
    const colInfo = columnsMap.get(old.column_id as string)
    const pid = colInfo?.project_id || ''
    const oldName = oldAssigneeMap.get(upd.card_id) || '(未指派)'

    if (upd.assignee_id && upd.assignee_id !== '') {
      const assignee = newAssigneeMap.get(upd.assignee_id)
      if (assignee) {
        insertPairs.push({ card_id: upd.card_id, user_id: assignee.id })
        activityLogs.push({
          project_id: pid,
          card_id: upd.card_id,
          user_id: userId,
          action: '指派',
          target: '負責人',
          old_value: oldName,
          new_value: assignee.name,
        })
      }
    } else if (oldName !== '(未指派)') {
      activityLogs.push({
        project_id: pid,
        card_id: upd.card_id,
        user_id: userId,
        action: '取消指派',
        target: '負責人',
        old_value: oldName,
        new_value: '(未指派)',
      })
    }
  }

  // 批次插入新指派
  if (insertPairs.length > 0) {
    const cardIds = insertPairs.map(p => p.card_id)
    const userIds = insertPairs.map(p => p.user_id)
    await client.query(
      `INSERT INTO card_assignees (card_id, user_id)
       SELECT UNNEST($1::uuid[]), UNNEST($2::uuid[])`,
      [cardIds, userIds]
    )
  }

  return activityLogs
}

/**
 * Step 5: 批次處理欄位移動
 * 查詢數：最多 3（查目標欄位 + 查最大 position + 批次 UPDATE + 查來源欄位名）
 */
async function batchHandleMoves(
  client: PoolClient,
  updates: UpdateItem[],
  cardsMap: Map<string, CardRow>,
  columnsMap: Map<string, { project_id: string; name: string }>,
  projectId: string | undefined,
  userId: string
): Promise<ActivityLog[]> {
  const moveUpdates = updates.filter(
    u => u.move_to_column && cardsMap.has(u.card_id)
  )
  if (moveUpdates.length === 0) return []

  const activityLogs: ActivityLog[] = []

  // 收集所有需要查找的 project_id + column name 組合
  const targetProjectIds = new Set<string>()
  for (const upd of moveUpdates) {
    const old = cardsMap.get(upd.card_id)!
    const colInfo = columnsMap.get(old.column_id as string)
    const pid = projectId || colInfo?.project_id || ''
    if (pid) targetProjectIds.add(pid)
  }

  // 批次查詢所有目標專案的欄位
  const targetColumnsMap = new Map<string, { id: string; name: string }>()
  if (targetProjectIds.size > 0) {
    const targetCols = await client.query(
      'SELECT id, project_id, name, LOWER(name) as lower_name FROM columns WHERE project_id = ANY($1)',
      [Array.from(targetProjectIds)]
    )
    for (const col of targetCols.rows) {
      // key = project_id + lower(name) 方便 ILIKE 匹配
      targetColumnsMap.set(`${col.project_id}:${col.lower_name}`, { id: col.id, name: col.name })
    }
  }

  // 收集所有需要移動的卡片
  const moveOps: { cardId: string; destColId: string; destColName: string; srcColName: string; pid: string }[] = []

  for (const upd of moveUpdates) {
    const old = cardsMap.get(upd.card_id)!
    const colInfo = columnsMap.get(old.column_id as string)
    const pid = projectId || colInfo?.project_id || ''
    const key = `${pid}:${upd.move_to_column!.toLowerCase()}`
    const targetCol = targetColumnsMap.get(key)

    if (targetCol) {
      moveOps.push({
        cardId: upd.card_id,
        destColId: targetCol.id,
        destColName: targetCol.name,
        srcColName: colInfo?.name || '',
        pid,
      })
    }
  }

  if (moveOps.length === 0) return []

  // 批次取得每個目標欄位的最大 position
  const destColIds = [...new Set(moveOps.map(m => m.destColId))]
  const posResult = await client.query(
    `SELECT column_id, COALESCE(MAX(position), -1) + 1 as next_pos
     FROM cards
     WHERE column_id = ANY($1)
     GROUP BY column_id`,
    [destColIds]
  )
  const posMap = new Map<string, number>()
  for (const row of posResult.rows) {
    posMap.set(row.column_id, Number(row.next_pos))
  }

  // 逐一累加 position 避免衝突，然後批次 UPDATE
  const moveCardIds: string[] = []
  const moveColIds: string[] = []
  const movePositions: number[] = []

  for (const op of moveOps) {
    const pos = posMap.get(op.destColId) || 0
    posMap.set(op.destColId, pos + 1) // 下一張卡片 position +1

    moveCardIds.push(op.cardId)
    moveColIds.push(op.destColId)
    movePositions.push(pos)

    activityLogs.push({
      project_id: op.pid,
      card_id: op.cardId,
      user_id: userId,
      action: '移動',
      target: '欄位',
      old_value: op.srcColName,
      new_value: op.destColName,
    })
  }

  // 批次 UPDATE 移動（使用 UNNEST）
  await client.query(
    `UPDATE cards SET
       column_id = batch.col_id::uuid,
       position = batch.pos::int,
       updated_at = NOW()
     FROM (
       SELECT UNNEST($1::uuid[]) AS id,
              UNNEST($2::uuid[]) AS col_id,
              UNNEST($3::int[]) AS pos
     ) AS batch
     WHERE cards.id = batch.id`,
    [moveCardIds, moveColIds, movePositions]
  )

  return activityLogs
}

/**
 * Step 6: 批次插入 activity logs
 * 查詢數：1（單次 INSERT with UNNEST）
 */
async function batchInsertActivityLogs(
  client: PoolClient,
  logs: ActivityLog[]
): Promise<void> {
  if (logs.length === 0) return

  await client.query(
    `INSERT INTO activity_logs (project_id, card_id, user_id, action, target, old_value, new_value)
     SELECT UNNEST($1::uuid[]),
            UNNEST($2::uuid[]),
            UNNEST($3::uuid[]),
            UNNEST($4::text[]),
            UNNEST($5::text[]),
            UNNEST($6::text[]),
            UNNEST($7::text[])`,
    [
      logs.map(l => l.project_id),
      logs.map(l => l.card_id),
      logs.map(l => l.user_id),
      logs.map(l => l.action),
      logs.map(l => l.target),
      logs.map(l => l.old_value),
      logs.map(l => l.new_value),
    ]
  )
}

/**
 * POST /api/ai/batch — 批次更新卡片（效能優化版）
 *
 * 查詢數預估：
 * - 2: 批次取得卡片 + 欄位
 * - 1~7: 批次更新欄位（每種變更欄位一次 UPDATE）
 * - 4: 批次指派人處理（查舊 + 查新 + 刪 + 插）
 * - 3: 批次移動處理（查目標欄 + 查 position + UPDATE）
 * - 1: 批次插入 activity logs
 * 總計：~10-17 個查詢（原本 500+）
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    await requireWritePermission()

    const body = await request.json()
    const validation = validateData(batchUpdateSchema, body)
    if (!validation.success) {
      return NextResponse.json({
        error: '輸入驗證失敗',
        details: validation.errors
      }, { status: 400 })
    }

    const { updates, project_id } = validation.data
    const cardIds = updates.map(u => u.card_id)

    // 使用 transaction 確保一致性
    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Step 1: 批次取得卡片 + 欄位（2 queries）
      const { cardsMap, columnsMap } = await batchFetchCards(client, cardIds)

      // Step 2: 計算欄位差異（0 queries，純計算）
      const { cardFieldUpdates, activityLogs, errors } =
        computeFieldUpdates(updates, cardsMap, columnsMap, user.id)

      // Step 3: 批次更新欄位（1~7 queries）
      await batchUpdateCardFields(client, cardFieldUpdates)

      // Step 4: 批次處理指派人（0~4 queries）
      const assigneeLogs = await batchHandleAssignees(
        client, updates, cardsMap, columnsMap, user.id
      )

      // Step 5: 批次處理移動（0~3 queries）
      const moveLogs = await batchHandleMoves(
        client, updates, cardsMap, columnsMap, project_id, user.id
      )

      // Step 6: 批次插入所有 activity logs（1 query）
      const allLogs = [...activityLogs, ...assigneeLogs, ...moveLogs]
      await batchInsertActivityLogs(client, allLogs)

      await client.query('COMMIT')

      // 組裝結果
      const results = updates.map(upd => {
        const err = errors.find(e => e.card_id === upd.card_id)
        if (err) {
          return { card_id: upd.card_id, status: 'error' as const, detail: err.detail }
        }
        const card = cardsMap.get(upd.card_id)
        return {
          card_id: upd.card_id,
          status: 'ok' as const,
          card_number: card ? (card.card_number as number) : undefined,
        }
      })

      const successCount = results.filter(r => r.status === 'ok').length
      return NextResponse.json({
        success: true,
        summary: `${successCount}/${updates.length} 筆更新成功`,
        results,
      })
    } catch (txError) {
      await client.query('ROLLBACK')
      throw txError
    } finally {
      client.release()
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/ai/batch error:', error)
    return NextResponse.json({
      error: '批次更新失敗',
      detail: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
