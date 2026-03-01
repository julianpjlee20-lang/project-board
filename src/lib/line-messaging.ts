/**
 * LINE Messaging API 推播函式
 * 使用 Push Message API 發送 Flex Message 給指定使用者
 * 不安裝 SDK，直接使用 fetch
 */

const CHANNEL_ACCESS_TOKEN = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN

/**
 * 推送 Flex Message（卡片式通知）給指定 LINE 使用者
 * @param lineUserId - LINE 使用者 ID
 * @param projectName - 專案名稱
 * @param cardTitle - 卡片標題
 * @param action - 動作描述（如「更新標題」、「指派給 XXX」）
 */
export async function sendLineFlexNotification(
  lineUserId: string,
  projectName: string,
  cardTitle: string,
  action: string
): Promise<void> {
  if (!CHANNEL_ACCESS_TOKEN || !lineUserId) return

  const flexMessage = {
    type: 'flex' as const,
    altText: `[${projectName}] ${action}: ${cardTitle}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{
          type: 'text',
          text: projectName,
          size: 'sm',
          color: '#316745',
          weight: 'bold',
        }],
        paddingBottom: 'none',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: action, size: 'xs', color: '#999999' },
          { type: 'text', text: cardTitle, size: 'md', weight: 'bold', margin: 'sm', wrap: true },
        ],
      },
    },
  }

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ to: lineUserId, messages: [flexMessage] }),
    })
    if (!res.ok) {
      const err = await res.json()
      console.error('LINE push message failed:', err)
    }
  } catch (e) {
    console.error('LINE notification error:', e)
  }
}
