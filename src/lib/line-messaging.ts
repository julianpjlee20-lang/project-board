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

// ─── Daily Digest 介面定義 ───

export interface DigestCard {
  title: string
  project_name: string
  due_date?: string
  days_overdue?: number
  priority?: string
}

export interface DigestProjectStats {
  name: string
  total_cards: number
  completed_cards: number
  completion_rate: number
  overdue_count: number
}

export interface DailyDigestData {
  date: string // YYYY-MM-DD
  upcoming: DigestCard[]
  overdue: DigestCard[]
  yesterday_changes: { total: number; created: number; completed: number; moved: number }
  project_stats: DigestProjectStats[]
  include_upcoming: boolean
  include_overdue: boolean
  include_yesterday_changes: boolean
  include_project_stats: boolean
}

// ─── Daily Digest 推播函數 ───

/**
 * 發送每日摘要 Flex Message（carousel 格式）給指定 LINE 使用者
 * 包含：摘要總覽、逾期警告、即將到期、昨日變更、專案進度
 */
export async function sendLineDailyDigest(
  lineUserId: string,
  digest: DailyDigestData
): Promise<void> {
  if (!CHANNEL_ACCESS_TOKEN || !lineUserId) return

  const { date, overdue, upcoming, yesterday_changes, project_stats } = digest

  // 若所有區塊都沒有資料，不發送
  const hasOverdue = digest.include_overdue && overdue.length > 0
  const hasUpcoming = digest.include_upcoming && upcoming.length > 0
  const hasChanges = digest.include_yesterday_changes && yesterday_changes.total > 0
  const hasStats = digest.include_project_stats && project_stats.length > 0

  if (!hasOverdue && !hasUpcoming && !hasChanges && !hasStats) return

  // ── 組裝 carousel bubbles ──
  const bubbles: Record<string, unknown>[] = []

  // Bubble 1 - Header/摘要（永遠顯示）
  bubbles.push(buildSummaryBubble(date, overdue.length, upcoming.length, yesterday_changes.total))

  // Bubble 2 - 逾期警告
  if (hasOverdue) {
    bubbles.push(buildOverdueBubble(overdue))
  }

  // Bubble 3 - 即將到期
  if (hasUpcoming) {
    bubbles.push(buildUpcomingBubble(upcoming))
  }

  // Bubble 4 - 昨日變更
  if (hasChanges) {
    bubbles.push(buildChangesBubble(yesterday_changes))
  }

  // Bubble 5 - 專案進度
  if (hasStats) {
    bubbles.push(buildStatsBubble(project_stats))
  }

  const flexMessage = {
    type: 'flex' as const,
    altText: `每日摘要 ${date}`,
    contents: {
      type: 'carousel',
      contents: bubbles,
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
      console.error('LINE daily digest push failed:', err)
    }
  } catch (e) {
    console.error('LINE daily digest error:', e)
  }
}

// ─── Bubble 建構輔助函數 ───

function buildSummaryBubble(
  date: string,
  overdueCount: number,
  upcomingCount: number,
  changesCount: number
): Record<string, unknown> {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '每日摘要', size: 'lg', weight: 'bold', color: '#FFFFFF' },
        { type: 'text', text: date, size: 'sm', color: '#FFFFFFCC', margin: 'sm' },
      ],
      backgroundColor: '#0B1A14',
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        buildStatRow('🔴 逾期', `${overdueCount} 項`, overdueCount > 0 ? '#DC2626' : '#999999'),
        buildStatRow('🟡 即將到期', `${upcomingCount} 項`, upcomingCount > 0 ? '#F59E0B' : '#999999'),
        buildStatRow('📝 昨日變更', `${changesCount} 項`, changesCount > 0 ? '#4EA7FC' : '#999999'),
      ],
      spacing: 'md',
      paddingAll: 'lg',
    },
  }
}

function buildStatRow(label: string, value: string, color: string): Record<string, unknown> {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: label, size: 'sm', color: '#555555', flex: 3 },
      { type: 'text', text: value, size: 'sm', color, weight: 'bold', align: 'end', flex: 2 },
    ],
  }
}

function buildOverdueBubble(overdue: DigestCard[]): Record<string, unknown> {
  const MAX_ITEMS = 10
  const items = overdue.slice(0, MAX_ITEMS)
  const remaining = overdue.length - MAX_ITEMS

  const contentItems: Record<string, unknown>[] = items.map((card) => ({
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: `[${card.project_name}] ${card.title}`,
        size: 'sm',
        color: '#333333',
        wrap: true,
      },
      {
        type: 'text',
        text: `逾期 ${card.days_overdue ?? 0} 天`,
        size: 'xs',
        color: '#DC2626',
      },
    ],
    spacing: 'xs',
    margin: 'md',
  }))

  if (remaining > 0) {
    contentItems.push({
      type: 'text',
      text: `...還有 ${remaining} 項`,
      size: 'xs',
      color: '#999999',
      margin: 'md',
    } as Record<string, unknown>)
  }

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '⚠️ 逾期警告', size: 'lg', weight: 'bold', color: '#FFFFFF' },
      ],
      backgroundColor: '#DC2626',
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: contentItems,
      paddingAll: 'lg',
    },
  }
}

function buildUpcomingBubble(upcoming: DigestCard[]): Record<string, unknown> {
  const MAX_ITEMS = 10
  const items = upcoming.slice(0, MAX_ITEMS)
  const remaining = upcoming.length - MAX_ITEMS

  const contentItems: Record<string, unknown>[] = items.map((card) => ({
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: `[${card.project_name}] ${card.title}`,
        size: 'sm',
        color: '#333333',
        wrap: true,
      },
      {
        type: 'text',
        text: card.due_date ?? '未設定到期日',
        size: 'xs',
        color: '#F59E0B',
      },
    ],
    spacing: 'xs',
    margin: 'md',
  }))

  if (remaining > 0) {
    contentItems.push({
      type: 'text',
      text: `...還有 ${remaining} 項`,
      size: 'xs',
      color: '#999999',
      margin: 'md',
    } as Record<string, unknown>)
  }

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '📅 即將到期', size: 'lg', weight: 'bold', color: '#FFFFFF' },
      ],
      backgroundColor: '#F59E0B',
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: contentItems,
      paddingAll: 'lg',
    },
  }
}

function buildChangesBubble(
  changes: { total: number; created: number; completed: number; moved: number }
): Record<string, unknown> {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '📝 昨日變更', size: 'lg', weight: 'bold', color: '#FFFFFF' },
      ],
      backgroundColor: '#4EA7FC',
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        buildStatRow('✨ 新增', `${changes.created} 項`, '#333333'),
        buildStatRow('✅ 完成', `${changes.completed} 項`, '#316745'),
        buildStatRow('🔄 移動', `${changes.moved} 項`, '#4EA7FC'),
      ],
      spacing: 'md',
      paddingAll: 'lg',
    },
  }
}

function buildStatsBubble(projectStats: DigestProjectStats[]): Record<string, unknown> {
  const MAX_ITEMS = 5
  const items = projectStats.slice(0, MAX_ITEMS)

  const contentItems: Record<string, unknown>[] = items.map((stat) => ({
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: stat.name,
        size: 'sm',
        weight: 'bold',
        color: '#333333',
        wrap: true,
      },
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          {
            type: 'text',
            text: `完成率 ${stat.completion_rate}%`,
            size: 'xs',
            color: '#316745',
            flex: 3,
          },
          {
            type: 'text',
            text: stat.overdue_count > 0 ? `逾期 ${stat.overdue_count}` : '無逾期',
            size: 'xs',
            color: stat.overdue_count > 0 ? '#DC2626' : '#999999',
            align: 'end',
            flex: 2,
          },
        ],
      },
    ],
    spacing: 'xs',
    margin: 'md',
  }))

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: '📊 專案進度', size: 'lg', weight: 'bold', color: '#FFFFFF' },
      ],
      backgroundColor: '#316745',
      paddingAll: 'lg',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: contentItems,
      paddingAll: 'lg',
    },
  }
}
