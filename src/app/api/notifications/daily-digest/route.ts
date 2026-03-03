/**
 * 每日摘要推播 API
 * POST /api/notifications/daily-digest
 *
 * 觸發方式：
 * 1. CRON_SECRET（排程觸發）: ?secret=xxx
 * 2. Admin Session（手動觸發）
 *
 * 邏輯：
 * - 讀取 notification_settings 判斷啟用的區塊
 * - 查詢即將到期、逾期、昨日變更、專案統計
 * - 為每位有 LINE 綁定的活躍使用者組合個人化摘要
 * - Boss 使用者看到所有卡片，一般使用者只看到指派給自己的
 * - 透過 LINE Messaging API 推播 Flex Message
 */

import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { getCurrentUser, AuthError } from "@/lib/auth"
import { sendLineDailyDigest, DailyDigestData } from "@/lib/line-messaging"

const SETTINGS_ID = "00000000-0000-0000-0000-000000000001"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface CardRow {
  id: string
  title: string
  due_date: string | null
  priority: string | null
  days_overdue?: number
  project_id: string
  project_name: string
  column_id: string
  column_name: string
  assignees: { id: string; name: string | null }[]
}

interface ProjectStatRow {
  id: string
  name: string
  total_cards: number
  completed_cards: number
  overdue_count: number
}

interface LineUser {
  id: string
  name: string | null
  line_user_id: string
}

// POST /api/notifications/daily-digest
export async function POST(request: NextRequest) {
  try {
    // ── 1. 雙認證模式 ──
    const secret = request.nextUrl.searchParams.get("secret")
    const cronSecretValid =
      secret &&
      process.env.CRON_SECRET &&
      secret === process.env.CRON_SECRET

    if (!cronSecretValid) {
      const user = await getCurrentUser()
      if (!user || user.role !== "admin") {
        return NextResponse.json({ error: "未授權" }, { status: 401 })
      }
    }

    // ── 2. 查詢 notification_settings ──
    const settingsRows = await query(
      `SELECT * FROM notification_settings WHERE id = $1`,
      [SETTINGS_ID]
    )

    if (settingsRows.length === 0 || !settingsRows[0].daily_digest_enabled) {
      return NextResponse.json({ skipped: true, reason: "每日摘要已停用" })
    }

    const settings = settingsRows[0]

    // ── 3. 根據開關平行查詢資料 ──
    const queries: Promise<CardRow[] | ProjectStatRow[] | { action: string }[]>[] = []
    const queryKeys: string[] = []

    // 3a. 即將到期（3 天內）
    if (settings.digest_include_upcoming) {
      queryKeys.push("upcoming")
      queries.push(
        query(`
          SELECT c.id, c.title, c.due_date, c.priority,
            p.id AS project_id, p.name AS project_name,
            col.id AS column_id, col.name AS column_name,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object('id', ca_user.id, 'name', ca_user.name))
              FILTER (WHERE ca_user.id IS NOT NULL),
              '[]'
            ) AS assignees
          FROM cards c
          JOIN columns col ON c.column_id = col.id
          JOIN projects p ON col.project_id = p.id
          LEFT JOIN card_assignees ca ON c.id = ca.card_id
          LEFT JOIN profiles ca_user ON ca.user_id = ca_user.id
          WHERE c.due_date IS NOT NULL
            AND c.due_date >= NOW()
            AND c.due_date <= NOW() + INTERVAL '3 days'
            AND c.actual_completion_date IS NULL
            AND col.position < (SELECT MAX(col2.position) FROM columns col2 WHERE col2.project_id = p.id)
          GROUP BY c.id, c.title, c.due_date, c.priority, p.id, p.name, col.id, col.name
          ORDER BY c.due_date ASC
          LIMIT 50
        `)
      )
    }

    // 3b. 逾期卡片
    if (settings.digest_include_overdue) {
      queryKeys.push("overdue")
      queries.push(
        query(`
          SELECT c.id, c.title, c.due_date, c.priority,
            EXTRACT(DAY FROM NOW() - c.due_date)::int AS days_overdue,
            p.id AS project_id, p.name AS project_name,
            col.id AS column_id, col.name AS column_name,
            COALESCE(
              json_agg(DISTINCT jsonb_build_object('id', ca_user.id, 'name', ca_user.name))
              FILTER (WHERE ca_user.id IS NOT NULL),
              '[]'
            ) AS assignees
          FROM cards c
          JOIN columns col ON c.column_id = col.id
          JOIN projects p ON col.project_id = p.id
          LEFT JOIN card_assignees ca ON c.id = ca.card_id
          LEFT JOIN profiles ca_user ON ca.user_id = ca_user.id
          WHERE c.due_date IS NOT NULL
            AND c.due_date < NOW()
            AND c.actual_completion_date IS NULL
            AND col.position < (SELECT MAX(col2.position) FROM columns col2 WHERE col2.project_id = p.id)
          GROUP BY c.id, c.title, c.due_date, c.priority, p.id, p.name, col.id, col.name
          ORDER BY c.due_date ASC
          LIMIT 50
        `)
      )
    }

    // 3c. 昨日活動記錄
    if (settings.digest_include_yesterday_changes) {
      queryKeys.push("yesterday")
      queries.push(
        query(`
          SELECT action FROM activity_logs
          WHERE created_at >= NOW() - INTERVAL '1 day'
        `)
      )
    }

    // 3d. 專案統計
    if (settings.digest_include_project_stats) {
      queryKeys.push("stats")
      queries.push(
        query(`
          SELECT
            p.id, p.name,
            COUNT(c.id)::int AS total_cards,
            COUNT(c.id) FILTER (
              WHERE col.position = max_pos.max_position
                 OR c.actual_completion_date IS NOT NULL
            )::int AS completed_cards,
            COUNT(c.id) FILTER (
              WHERE c.due_date IS NOT NULL
                AND c.due_date < NOW()
                AND c.actual_completion_date IS NULL
                AND col.position < max_pos.max_position
            )::int AS overdue_count
          FROM projects p
          LEFT JOIN columns col ON col.project_id = p.id
          LEFT JOIN cards c ON c.column_id = col.id
          LEFT JOIN LATERAL (
            SELECT MAX(col2.position) AS max_position
            FROM columns col2
            WHERE col2.project_id = p.id
          ) max_pos ON true
          GROUP BY p.id, p.name, max_pos.max_position
          ORDER BY p.name ASC
        `)
      )
    }

    // 平行執行所有啟用的查詢
    const results = await Promise.all(queries)

    // 解析結果到對應變數
    let allUpcoming: CardRow[] = []
    let allOverdue: CardRow[] = []
    let yesterdayStats = { total: 0, created: 0, completed: 0, moved: 0 }
    let projectStats: ProjectStatRow[] = []

    queryKeys.forEach((key, i) => {
      switch (key) {
        case "upcoming":
          allUpcoming = results[i] as CardRow[]
          break
        case "overdue":
          allOverdue = results[i] as CardRow[]
          break
        case "yesterday": {
          const logs = results[i] as { action: string }[]
          yesterdayStats = {
            total: logs.length,
            created: logs.filter(
              (l) => l.action === "建立卡片" || l.action === "新增卡片"
            ).length,
            completed: logs.filter(
              (l) => l.action === "完成" || l.action === "標記完成"
            ).length,
            moved: logs.filter(
              (l) => l.action === "移動卡片" || l.action === "移動"
            ).length,
          }
          break
        }
        case "stats":
          projectStats = results[i] as ProjectStatRow[]
          break
      }
    })

    // ── 4. 查詢有 LINE 綁定的活躍使用者 ──
    const lineUsers: LineUser[] = await query(`
      SELECT id, name, line_user_id FROM profiles
      WHERE is_active = true AND line_user_id IS NOT NULL AND line_user_id != ''
    `)

    if (lineUsers.length === 0) {
      return NextResponse.json({
        success: true,
        sent_count: 0,
        skipped_count: 0,
        total_users: 0,
        reason: "沒有已綁定 LINE 的活躍使用者",
        digest_summary: {
          overdue_count: allOverdue.length,
          upcoming_count: allUpcoming.length,
          yesterday_changes: yesterdayStats.total,
          project_count: projectStats.length,
        },
      })
    }

    // ── 5. 查詢卡片指派關係（用於一般使用者篩選） ──
    // Boss 使用者可以看到所有卡片，一般使用者只看到指派給自己的
    const bossUserIds: string[] = settings.boss_user_ids || []

    // ── 6. 為每位使用者組合摘要並推播 ──
    let sentCount = 0
    let skippedCount = 0
    const errors: string[] = []

    for (const user of lineUsers) {
      const isBoss = bossUserIds.includes(user.id)

      // 篩選資料：Boss 看全部，一般使用者只看指派給自己的
      let userUpcoming: CardRow[]
      let userOverdue: CardRow[]

      if (isBoss) {
        userUpcoming = allUpcoming
        userOverdue = allOverdue
      } else {
        userUpcoming = allUpcoming.filter((card) =>
          card.assignees?.some((a) => a.id === user.id)
        )
        userOverdue = allOverdue.filter((card) =>
          card.assignees?.some((a) => a.id === user.id)
        )
      }

      // 組合 DailyDigestData
      const digest: DailyDigestData = {
        date: new Date().toISOString().split("T")[0],
        upcoming: userUpcoming.map((c) => ({
          title: c.title,
          project_name: c.project_name,
          due_date: c.due_date ?? undefined,
          priority: c.priority ?? undefined,
        })),
        overdue: userOverdue.map((c) => ({
          title: c.title,
          project_name: c.project_name,
          days_overdue: c.days_overdue,
          priority: c.priority ?? undefined,
        })),
        yesterday_changes: yesterdayStats,
        project_stats: projectStats.map((p) => ({
          name: p.name,
          total_cards: p.total_cards,
          completed_cards: p.completed_cards,
          completion_rate:
            p.total_cards > 0
              ? Math.round((p.completed_cards / p.total_cards) * 100)
              : 0,
          overdue_count: p.overdue_count,
        })),
        include_upcoming: settings.digest_include_upcoming,
        include_overdue: settings.digest_include_overdue,
        include_yesterday_changes: settings.digest_include_yesterday_changes,
        include_project_stats: settings.digest_include_project_stats,
      }

      // 檢查是否有內容可推播
      const hasContent =
        (digest.include_overdue && digest.overdue.length > 0) ||
        (digest.include_upcoming && digest.upcoming.length > 0) ||
        (digest.include_yesterday_changes &&
          digest.yesterday_changes.total > 0) ||
        (digest.include_project_stats && digest.project_stats.length > 0)

      if (!hasContent) {
        skippedCount++
        continue
      }

      try {
        await sendLineDailyDigest(user.line_user_id, digest)
        sentCount++
      } catch (e) {
        errors.push(
          `${user.name || user.id}: ${e instanceof Error ? e.message : "未知錯誤"}`
        )
      }
    }

    // ── 7. 回傳結果 ──
    return NextResponse.json({
      success: true,
      sent_count: sentCount,
      skipped_count: skippedCount,
      total_users: lineUsers.length,
      errors: errors.length > 0 ? errors : undefined,
      digest_summary: {
        overdue_count: allOverdue.length,
        upcoming_count: allUpcoming.length,
        yesterday_changes: yesterdayStats.total,
        project_count: projectStats.length,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }
    console.error("[Daily Digest] POST error:", error)
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 })
  }
}
