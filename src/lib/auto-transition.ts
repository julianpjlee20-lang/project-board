import { query } from '@/lib/db'

export interface TransitionResult {
  moved: boolean
  newColumnId?: string
  newColumnName?: string
}

const NO_MOVE: TransitionResult = { moved: false }

/**
 * 取得卡片所在欄位 position 與專案欄位結構
 */
async function getCardColumnContext(cardId: string) {
  const rows = await query(
    `SELECT c.id as card_id, c.column_id,
            col.position as column_position, col.project_id,
            (SELECT MIN(position) FROM columns WHERE project_id = col.project_id) as min_position,
            (SELECT MAX(position) FROM columns WHERE project_id = col.project_id) as max_position
     FROM cards c
     JOIN columns col ON c.column_id = col.id
     WHERE c.id = $1`,
    [cardId]
  )
  return rows[0] || null
}

/**
 * 將卡片移動到指定 position 的欄位
 * - 更新 column_id + position（放到目標欄末尾）
 * - 重排來源欄 position
 * - 移到最後欄自動填 actual_completion_date，移出最後欄自動清除
 * - 寫入活動日誌
 */
async function moveCardToColumnByPosition(
  cardId: string,
  projectId: string,
  targetPosition: number
): Promise<TransitionResult> {
  // 找目標欄位
  const targetCols = await query(
    'SELECT id, name, position FROM columns WHERE project_id = $1 AND position = $2',
    [projectId, targetPosition]
  )
  if (targetCols.length === 0) return NO_MOVE
  const targetCol = targetCols[0]

  // 取得卡片目前欄位
  const card = await query('SELECT column_id FROM cards WHERE id = $1', [cardId])
  if (card.length === 0) return NO_MOVE
  const sourceColumnId = card[0].column_id

  // 已在目標欄 → 不移動
  if (sourceColumnId === targetCol.id) return NO_MOVE

  // 計算目標欄末尾 position
  const posResult = await query(
    'SELECT COALESCE(MAX(position), -1) + 1 as pos FROM cards WHERE column_id = $1',
    [targetCol.id]
  )
  const newPosition = posResult[0]?.pos || 0

  // 更新卡片
  await query(
    'UPDATE cards SET column_id = $1, position = $2, updated_at = NOW() WHERE id = $3',
    [targetCol.id, newPosition, cardId]
  )

  // 重排來源欄
  const sourceCards = await query(
    'SELECT id FROM cards WHERE column_id = $1 AND id != $2 ORDER BY position',
    [sourceColumnId, cardId]
  )
  if (sourceCards.length > 0) {
    const ids = sourceCards.map((c: { id: number }) => c.id)
    const positions = sourceCards.map((_: unknown, i: number) => i)
    await query(
      `UPDATE cards SET position = batch.pos
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS pos) AS batch
       WHERE cards.id = batch.id`,
      [ids, positions]
    )
  }

  // actual_completion_date 處理
  const maxPosResult = await query(
    'SELECT MAX(position) as max_pos FROM columns WHERE project_id = $1',
    [projectId]
  )
  const maxPos = maxPosResult[0]?.max_pos

  if (targetPosition === maxPos) {
    // 移到最後欄 → 自動填入
    const today = new Date().toISOString().split('T')[0]
    await query(
      'UPDATE cards SET actual_completion_date = $1 WHERE id = $2 AND actual_completion_date IS NULL',
      [today, cardId]
    )
  } else {
    // 移出最後欄 → 清除
    await query(
      'UPDATE cards SET actual_completion_date = NULL WHERE id = $1',
      [cardId]
    )
  }

  // 活動日誌
  const sourceCol = await query('SELECT name FROM columns WHERE id = $1', [sourceColumnId])
  await query(
    'INSERT INTO activity_logs (project_id, card_id, action, target, old_value, new_value) VALUES ($1, $2, $3, $4, $5, $6)',
    [projectId, cardId, '自動移動', '欄位', sourceCol[0]?.name || '', targetCol.name]
  )

  return { moved: true, newColumnId: targetCol.id, newColumnName: targetCol.name }
}

/**
 * 規則 1：設定日期 → 若在第一欄，移到第二欄（不能是最後欄）
 */
export async function autoTransitionOnDateSet(cardId: string): Promise<TransitionResult> {
  const ctx = await getCardColumnContext(cardId)
  if (!ctx) return NO_MOVE

  // 只有在第一欄才觸發
  if (ctx.column_position !== ctx.min_position) return NO_MOVE

  // 目標欄不能是最後欄（避免 2 欄時設日期直接完成）
  const targetPos = ctx.min_position + 1
  if (targetPos >= ctx.max_position) return NO_MOVE

  return moveCardToColumnByPosition(cardId, ctx.project_id, targetPos)
}

/**
 * 規則 2：所有子任務完成 → 移到最後欄
 */
export async function autoTransitionOnAllSubtasksCompleted(cardId: string): Promise<TransitionResult> {
  const ctx = await getCardColumnContext(cardId)
  if (!ctx) return NO_MOVE

  // 檢查是否所有子任務都已完成
  const stats = await query(
    'SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_completed) as completed FROM subtasks WHERE card_id = $1',
    [cardId]
  )
  const total = parseInt(stats[0].total)
  const completed = parseInt(stats[0].completed)

  // 沒有子任務或有未完成的 → 不移動
  if (total === 0 || completed < total) return NO_MOVE

  // 已在最後欄 → 不移動
  if (ctx.column_position === ctx.max_position) return NO_MOVE

  return moveCardToColumnByPosition(cardId, ctx.project_id, ctx.max_position)
}

/**
 * 規則 3：取消子任務完成 → 若在最後欄，移回第二欄
 */
export async function autoTransitionOnSubtaskUncompleted(cardId: string): Promise<TransitionResult> {
  const ctx = await getCardColumnContext(cardId)
  if (!ctx) return NO_MOVE

  // 只有在最後欄才觸發
  if (ctx.column_position !== ctx.max_position) return NO_MOVE

  // 需要至少 2 欄
  if (ctx.min_position === ctx.max_position) return NO_MOVE

  // 移到第二欄；若只有 2 欄則移到第一欄
  const targetPos = ctx.min_position + 1 < ctx.max_position
    ? ctx.min_position + 1
    : ctx.min_position

  return moveCardToColumnByPosition(cardId, ctx.project_id, targetPos)
}
