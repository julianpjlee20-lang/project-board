'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import UserNav from '@/components/UserNav'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabKey = 'overdue' | 'due_soon' | 'recent_changes' | 'project_summary'

interface CardItem {
  id: string
  title: string
  due_date: string
  priority: string
  progress: number
  project_id: string
  project_name: string
  column_id: string
  column_name: string
  assignees: { id: string; name: string }[]
  days_overdue?: number
}

interface RecentChange {
  id: string
  action: string
  target: string | null
  old_value: string | null
  new_value: string | null
  created_at: string
  user_name: string | null
  card_id: string | null
  card_title: string | null
  project_id: string
  project_name: string
}

interface ProjectSummary {
  id: string
  name: string
  total_cards: number
  completed_cards: number
  completion_rate: number
  overdue_count: number
  due_soon_count: number
}

interface NotificationData {
  due_soon: CardItem[]
  overdue: CardItem[]
  recent_changes: RecentChange[]
  project_summary: ProjectSummary[]
  counts: { due_soon: number; overdue: number; recent_changes: number }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const COLORS = {
  bg: '#F9F8F5',
  primary: '#0B1A14',
  headerBg: '#0B1A14',
  headerBorder: '#316745',
  headerText: '#F9F8F5',
  accent: '#F8B500',
  green: '#316745',
  white: '#FFFFFF',
  danger: '#DC2626',
  warning: '#F59E0B',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#DC2626',
  medium: '#F59E0B',
  low: '#10B981',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${month}/${day}`
  } catch {
    return dateStr
  }
}

function formatFullDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  } catch {
    return dateStr
  }
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

function getDaysRemaining(dueDateStr: string): number {
  return Math.ceil((new Date(dueDateStr).getTime() - Date.now()) / 86400000)
}

function getDateGroupLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.floor((today.getTime() - target.getTime()) / 86400000)

  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  return '更早'
}

function describeAction(change: RecentChange): string {
  const actor = change.user_name || '系統'
  const cardRef = change.card_title ? `「${change.card_title}」` : ''

  switch (change.action) {
    case 'create_card':
      return `${actor} 建立了卡片${cardRef}`
    case 'update_card':
      if (change.target === 'priority' && change.old_value && change.new_value) {
        return `${actor} 更新了${cardRef}的優先度 ${change.old_value} → ${change.new_value}`
      }
      if (change.target === 'title' && change.old_value && change.new_value) {
        return `${actor} 將${cardRef}重新命名為「${change.new_value}」`
      }
      if (change.target === 'due_date') {
        return `${actor} 更新了${cardRef}的截止日期`
      }
      if (change.target) {
        return `${actor} 更新了${cardRef}的${change.target}${change.old_value && change.new_value ? ` ${change.old_value} → ${change.new_value}` : ''}`
      }
      return `${actor} 更新了${cardRef}`
    case 'move_card':
      if (change.old_value && change.new_value) {
        return `${actor} 將${cardRef}從「${change.old_value}」移至「${change.new_value}」`
      }
      return `${actor} 移動了${cardRef}`
    case 'delete_card':
      return `${actor} 刪除了卡片${cardRef}`
    case 'add_assignee':
      return `${actor} 將 ${change.new_value || '成員'} 指派至${cardRef}`
    case 'remove_assignee':
      return `${actor} 將 ${change.old_value || '成員'} 從${cardRef}移除`
    default:
      return `${actor} ${change.action}${cardRef}`
  }
}

// ─── Skeleton Components ──────────────────────────────────────────────────────

function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border shadow-sm p-5 animate-pulse border-l-4"
          style={{ backgroundColor: COLORS.white, borderLeftColor: '#E2E8F0' }}
        >
          <div className="h-3 bg-slate-200 rounded w-20 mb-3" />
          <div className="h-8 bg-slate-200 rounded w-16 mb-1" />
          <div className="h-3 bg-slate-200 rounded w-24" />
        </div>
      ))}
    </div>
  )
}

function CardListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-lg border shadow-sm p-4 animate-pulse border-l-4"
          style={{ backgroundColor: COLORS.white, borderLeftColor: '#E2E8F0' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-slate-200 rounded-full" />
              <div className="h-4 bg-slate-200 rounded w-48" />
            </div>
            <div className="h-5 bg-slate-200 rounded w-20" />
          </div>
          <div className="h-3 bg-slate-200 rounded w-64 mb-3" />
          <div className="h-2 bg-slate-100 rounded-full w-full" />
        </div>
      ))}
    </div>
  )
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 bg-slate-200 rounded w-12 animate-pulse" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="h-3 bg-slate-200 rounded w-12 mt-0.5" />
          <div className="flex-1">
            <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-200 rounded w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

function ProjectGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl border shadow-sm p-5 animate-pulse"
          style={{ backgroundColor: COLORS.white }}
        >
          <div className="h-5 bg-slate-200 rounded w-32 mb-4" />
          <div className="h-2 bg-slate-100 rounded-full w-full mb-3" />
          <div className="h-3 bg-slate-200 rounded w-24 mb-2" />
          <div className="flex gap-4">
            <div className="h-3 bg-slate-200 rounded w-16" />
            <div className="h-3 bg-slate-200 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ counts }: { counts: NotificationData['counts'] }) {
  const cards = [
    {
      label: '個逾期任務',
      count: counts.overdue,
      borderColor: COLORS.danger,
      textColor: COLORS.danger,
    },
    {
      label: '個即將到期',
      count: counts.due_soon,
      borderColor: COLORS.accent,
      textColor: COLORS.warning,
    },
    {
      label: '筆近期變更',
      count: counts.recent_changes,
      borderColor: COLORS.green,
      textColor: COLORS.green,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border shadow-sm p-5 border-l-4 transition-shadow hover:shadow-md"
          style={{
            backgroundColor: COLORS.white,
            borderLeftColor: card.borderColor,
          }}
        >
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">
            {card.label.replace(/^\S+\s/, '')}
          </p>
          <p
            className="text-3xl font-bold"
            style={{ color: card.textColor }}
          >
            {card.count}
          </p>
          <p className="text-sm text-slate-600 mt-0.5">
            {card.count}{card.label}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

interface TabDef {
  id: TabKey
  label: string
  dotColor?: string
  showDot?: boolean
}

function TabBar({
  activeTab,
  onTabChange,
  counts,
}: {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  counts: NotificationData['counts']
}) {
  const tabs: TabDef[] = [
    {
      id: 'overdue',
      label: '已逾期',
      dotColor: COLORS.danger,
      showDot: counts.overdue > 0,
    },
    {
      id: 'due_soon',
      label: '即將到期',
      dotColor: COLORS.accent,
      showDot: counts.due_soon > 0,
    },
    {
      id: 'recent_changes',
      label: '近期變更',
    },
    {
      id: 'project_summary',
      label: '專案進度',
    },
  ]

  return (
    <div className="flex bg-slate-100 rounded-lg p-1 overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
            activeTab === tab.id
              ? 'bg-white shadow text-slate-900'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {tab.showDot && (
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: tab.dotColor }}
            />
          )}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ─── Card List Item (overdue / due_soon 共用) ─────────────────────────────────

function CardListItem({
  card,
  variant,
}: {
  card: CardItem
  variant: 'overdue' | 'due_soon'
}) {
  const borderColor = variant === 'overdue' ? COLORS.danger : COLORS.accent
  const priorityColor = PRIORITY_COLORS[card.priority] || '#6B7280'

  const badgeContent =
    variant === 'overdue'
      ? `逾期 ${Math.abs(Math.floor(card.days_overdue ?? 0))} 天`
      : `剩餘 ${getDaysRemaining(card.due_date)} 天`

  const badgeBg = variant === 'overdue' ? COLORS.danger : COLORS.accent
  const badgeText = variant === 'overdue' ? '#FFFFFF' : '#0B1A14'

  const assigneeText = card.assignees.length > 0
    ? card.assignees.map((a) => a.name).join(', ')
    : '未指派'

  return (
    <Link
      href={`/projects/${card.project_id}`}
      className="block rounded-lg border shadow-sm border-l-4 hover:shadow-md transition-shadow"
      style={{
        backgroundColor: COLORS.white,
        borderLeftColor: borderColor,
      }}
    >
      <div className="p-4">
        {/* Row 1: Priority dot + Title + Badge */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: priorityColor }}
              title={`優先度: ${PRIORITY_LABELS[card.priority] || card.priority}`}
            />
            <h3 className="font-semibold text-sm truncate" style={{ color: COLORS.primary }}>
              {card.title}
            </h3>
          </div>
          <span
            className="ml-2 flex-shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full"
            style={{ backgroundColor: badgeBg, color: badgeText }}
          >
            {badgeContent}
          </span>
        </div>

        {/* Row 2: Project > Column | Assignee | Due Date */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mb-3">
          <span className="inline-flex items-center gap-1">
            <span>📁</span>
            <span>{card.project_name}</span>
            <span className="text-slate-300 mx-0.5">&rarr;</span>
            <span>{card.column_name}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span>👤</span>
            <span>{assigneeText}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span>📅</span>
            <span>{formatFullDate(card.due_date)}</span>
          </span>
        </div>

        {/* Row 3: Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(card.progress, 100)}%`,
                backgroundColor: card.progress >= 100 ? '#10B981' : COLORS.green,
              }}
            />
          </div>
          <span className="text-xs text-slate-500 flex-shrink-0 w-8 text-right">
            {card.progress}%
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Recent Changes Timeline ──────────────────────────────────────────────────

function RecentChangesTimeline({ changes }: { changes: RecentChange[] }) {
  if (changes.length === 0) {
    return <EmptyState message="近 7 天沒有變更紀錄" icon="📝" />
  }

  // Group by date
  const grouped = changes.reduce<Record<string, RecentChange[]>>((acc, change) => {
    const label = getDateGroupLabel(change.created_at)
    if (!acc[label]) acc[label] = []
    acc[label].push(change)
    return acc
  }, {})

  const groupOrder = ['今天', '昨天', '更早']

  return (
    <div className="space-y-6">
      {groupOrder.map((groupLabel) => {
        const items = grouped[groupLabel]
        if (!items || items.length === 0) return null

        return (
          <div key={groupLabel}>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              {groupLabel}
            </h3>
            <div className="space-y-2">
              {items.map((change) => (
                <div
                  key={change.id}
                  className="flex gap-3 rounded-lg p-3 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-xs text-slate-400 mt-0.5 flex-shrink-0 w-12 text-right font-mono">
                    {formatTime(change.created_at)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 leading-relaxed">
                      {describeAction(change)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <span>📁</span>
                      <span>{change.project_name}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Project Summary Grid ─────────────────────────────────────────────────────

function ProjectSummaryGrid({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return <EmptyState message="目前沒有任何專案" icon="📂" />
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="block rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow"
          style={{ backgroundColor: COLORS.white }}
        >
          <h3 className="font-semibold text-base mb-3" style={{ color: COLORS.primary }}>
            {project.name}
          </h3>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(project.completion_rate, 100)}%`,
                  backgroundColor: project.completion_rate >= 100 ? '#10B981' : COLORS.green,
                }}
              />
            </div>
            <span className="text-xs font-medium text-slate-600 flex-shrink-0">
              {Math.round(project.completion_rate)}%
            </span>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              📋 {project.total_cards} 張卡片
            </span>
            <span className="inline-flex items-center gap-1">
              ✅ {project.completed_cards} 完成
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1.5">
            {project.overdue_count > 0 && (
              <span className="inline-flex items-center gap-1" style={{ color: COLORS.danger }}>
                🔴 {project.overdue_count} 逾期
              </span>
            )}
            {project.due_soon_count > 0 && (
              <span className="inline-flex items-center gap-1" style={{ color: COLORS.warning }}>
                🟡 {project.due_soon_count} 即將到期
              </span>
            )}
            {project.overdue_count === 0 && project.due_soon_count === 0 && (
              <span className="inline-flex items-center gap-1 text-slate-400">
                ✅ 沒有逾期或即將到期的任務
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ message, icon }: { message: string; icon: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-4xl mb-4">{icon}</span>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="text-sm text-red-600 mb-3">{message}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
      >
        重試
      </button>
    </div>
  )
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [data, setData] = useState<NotificationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('overdue')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/notifications/center')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || body.error || '無法載入通知中心資料')
      }
      const json: NotificationData = await res.json()
      setData(json)
    } catch (e) {
      console.error('載入通知中心錯誤:', e)
      setError(e instanceof Error ? e.message : '載入失敗，請重新整理頁面')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const counts = data?.counts ?? { due_soon: 0, overdue: 0, recent_changes: 0 }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.bg }}>
      {/* ─── Header ─────────────────────────────────────────── */}
      <header
        className="border-b"
        style={{
          backgroundColor: COLORS.headerBg,
          borderColor: COLORS.headerBorder,
        }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-start justify-between">
            <div>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1 text-sm mb-4 hover:opacity-80 transition-opacity"
                style={{ color: COLORS.headerText, opacity: 0.7 }}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                返回專案列表
              </Link>
              <h1
                className="text-2xl sm:text-3xl font-bold"
                style={{
                  color: COLORS.headerText,
                  letterSpacing: '-0.03em',
                }}
              >
                通知中心
              </h1>
              <p
                className="mt-1 sm:mt-2 text-sm sm:text-base"
                style={{ color: COLORS.headerText, opacity: 0.7 }}
              >
                跨專案即時狀態總覽
              </p>
            </div>
            <div className="flex-shrink-0 mt-1">
              <UserNav />
            </div>
          </div>
        </div>
      </header>

      {/* ─── Main Content ───────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Error state */}
        {error && !loading && (
          <ErrorBanner message={error} onRetry={fetchData} />
        )}

        {/* Summary Cards */}
        {loading ? (
          <SummaryCardsSkeleton />
        ) : data ? (
          <SummaryCards counts={counts} />
        ) : null}

        {/* Tab Bar */}
        {!error && (
          <TabBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            counts={counts}
          />
        )}

        {/* Tab Content */}
        {loading ? (
          <div>
            {activeTab === 'overdue' && <CardListSkeleton />}
            {activeTab === 'due_soon' && <CardListSkeleton />}
            {activeTab === 'recent_changes' && <TimelineSkeleton />}
            {activeTab === 'project_summary' && <ProjectGridSkeleton />}
          </div>
        ) : data ? (
          <div>
            {/* Overdue Tab */}
            {activeTab === 'overdue' && (
              data.overdue.length === 0 ? (
                <EmptyState message="太好了！目前沒有逾期的任務" icon="✅" />
              ) : (
                <div className="space-y-3">
                  {data.overdue.map((card) => (
                    <CardListItem key={card.id} card={card} variant="overdue" />
                  ))}
                </div>
              )
            )}

            {/* Due Soon Tab */}
            {activeTab === 'due_soon' && (
              data.due_soon.length === 0 ? (
                <EmptyState message="近 7 天沒有即將到期的任務" icon="📅" />
              ) : (
                <div className="space-y-3">
                  {data.due_soon.map((card) => (
                    <CardListItem key={card.id} card={card} variant="due_soon" />
                  ))}
                </div>
              )
            )}

            {/* Recent Changes Tab */}
            {activeTab === 'recent_changes' && (
              <RecentChangesTimeline changes={data.recent_changes} />
            )}

            {/* Project Summary Tab */}
            {activeTab === 'project_summary' && (
              <ProjectSummaryGrid projects={data.project_summary} />
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}
