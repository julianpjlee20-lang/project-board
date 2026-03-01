/**
 * 排程通知發送 API
 * POST - 將佇列中未發送的通知合併後推播給使用者
 *
 * 用途：安靜時段結束後，由排程器（cron / external trigger）呼叫此端點
 *       將累積的通知整合為摘要，一次推播給使用者
 */

import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { sendLineFlexNotification } from '@/lib/line-messaging'

// POST /api/notifications/flush
export async function POST() {
  try {
    // 1. 查詢所有未發送的通知，按使用者分組
    const pendingNotifications = await query(
      `SELECT nq.id, nq.user_id, nq.project_name, nq.card_title, nq.action,
              p.line_user_id
       FROM notification_queue nq
       JOIN profiles p ON nq.user_id = p.id
       WHERE nq.sent = FALSE
       ORDER BY nq.user_id, nq.created_at ASC`
    )

    if (pendingNotifications.length === 0) {
      return NextResponse.json({ message: '無待發送通知', sent: 0 })
    }

    // 2. 按 user_id 分組
    const grouped = new Map<string, {
      lineUserId: string
      notifications: { projectName: string; cardTitle: string; action: string }[]
      ids: string[]
    }>()

    for (const row of pendingNotifications) {
      if (!row.line_user_id) continue

      if (!grouped.has(row.user_id)) {
        grouped.set(row.user_id, {
          lineUserId: row.line_user_id,
          notifications: [],
          ids: [],
        })
      }

      const group = grouped.get(row.user_id)!
      group.notifications.push({
        projectName: row.project_name,
        cardTitle: row.card_title,
        action: row.action,
      })
      group.ids.push(row.id)
    }

    // 3. 逐使用者發送摘要通知
    let totalSent = 0

    for (const [, group] of grouped) {
      const { lineUserId, notifications, ids } = group
      const count = notifications.length

      // 組合摘要文字
      const summaryLines = notifications
        .slice(0, 5) // 最多顯示 5 則
        .map((n, i) => `${i + 1}. [${n.projectName}] ${n.action}: ${n.cardTitle}`)
        .join('\n')

      const summaryText = count > 5
        ? `${summaryLines}\n...還有 ${count - 5} 則通知`
        : summaryLines

      try {
        await sendLineFlexNotification(
          lineUserId,
          '通知摘要',
          summaryText,
          `你有 ${count} 個新通知`
        )

        // 4. 標記為已發送
        await query(
          `UPDATE notification_queue SET sent = TRUE, sent_at = NOW() WHERE id = ANY($1::uuid[])`,
          [`{${ids.join(',')}}`]
        )

        totalSent += count
      } catch (e) {
        console.error('Flush notification failed for user:', e)
        // 個別使用者失敗不影響其他使用者
      }
    }

    return NextResponse.json({
      message: `已發送 ${totalSent} 則通知`,
      sent: totalSent,
      users: grouped.size,
    })
  } catch (error) {
    console.error('POST /api/notifications/flush error:', error)
    return NextResponse.json(
      { error: '排程通知發送失敗' },
      { status: 500 }
    )
  }
}
