/**
 * 統一通知分發器
 * 整合 Discord webhook 廣播 + LINE 個人推播
 * 通知失敗不影響主 API 回應（靜默失敗 + console.error）
 */

import { query } from './db'
import { sendLineFlexNotification } from './line-messaging'

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL

interface NotifyParams {
  cardTitle: string
  action: string
  projectName: string
  targetUserIds?: string[]  // profiles.id[] — 被通知的人
}

/**
 * 發送通知（Discord 廣播 + LINE 個人推播）
 * @param params - 通知參數
 */
export async function sendNotification(params: NotifyParams): Promise<void> {
  const { cardTitle, action, projectName, targetUserIds } = params

  // 1. Discord webhook 廣播（維持原有行為）
  if (DISCORD_WEBHOOK_URL) {
    try {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: `📋 ${projectName}`,
            description: `**${action}**: ${cardTitle}`,
            color: 0x316745,
            timestamp: new Date().toISOString(),
          }],
        }),
      })
    } catch (e) {
      console.error('Discord notification failed:', e)
    }
  }

  // 2. LINE 個人推播
  if (targetUserIds && targetUserIds.length > 0) {
    for (const userId of targetUserIds) {
      try {
        const users = await query(
          `SELECT p.line_user_id, np.notify_assigned, np.notify_title_changed,
                  np.quiet_hours_start, np.quiet_hours_end
           FROM profiles p
           LEFT JOIN notification_preferences np ON p.id = np.user_id
           WHERE p.id = $1`,
          [userId]
        )
        const user = users[0]
        if (!user?.line_user_id) continue

        // 安靜時段檢查：排入佇列而非即時推播
        if (isQuietHours(user.quiet_hours_start, user.quiet_hours_end)) {
          await query(
            'INSERT INTO notification_queue (user_id, project_name, card_title, action) VALUES ($1, $2, $3, $4)',
            [userId, projectName, cardTitle, action]
          )
          continue
        }

        await sendLineFlexNotification(user.line_user_id, projectName, cardTitle, action)
      } catch (e) {
        console.error('LINE targeted notification failed:', e)
      }
    }
  }
}

/**
 * 判斷目前是否在安靜時段內
 * 支援跨午夜的時段（如 22:00 ~ 08:00）
 */
function isQuietHours(start: number | null, end: number | null): boolean {
  if (start == null || end == null) return false
  const hour = new Date().getHours()
  if (start <= end) return hour >= start && hour < end
  return hour >= start || hour < end
}
