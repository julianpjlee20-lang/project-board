'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import UserNav from '@/components/UserNav'
import { queryKeys } from '@/lib/query-keys'
import { fetchNotificationCenter, dismissNotification, restoreNotification } from '@/lib/api'

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
  dismissed: { card_id: string; dismiss_type: string }[]
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    return new Intl.DateTimeFormat('zh-TW', { month: '2-digit', day: '2-digit' }).format(new Date(dateStr))
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
          className="rounded-xl border shadow-sm p-5 animate-pulse border-l-4 bg-surface-elevated border-l-slate-200"
        >
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-3" />
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-1" />
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24" />
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
          className="rounded-lg border shadow-sm p-4 animate-pulse border-l-4 bg-surface-elevated border-l-slate-200"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-slate-200 dark:bg-slate-700 rounded-full" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48" />
            </div>
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20" />
          </div>
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-64 mb-3" />
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full w-full" />
        </div>
      ))}
    </div>
  )
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-12 animate-pulse" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3 animate-pulse">
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-12 mt-0.5" />
          <div className="flex-1">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32" />
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
          className="rounded-xl border shadow-sm p-5 animate-pulse bg-surface-elevated"
        >
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4" />
          <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full w-full mb-3" />
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2" />
          <div className="flex gap-4">
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Summary Cards ────────────────────────────────────────────────────────────

interface SummaryCardsProps {
  counts: NotificationData['counts']
  topOverdue: CardItem | null
  topDueSoon: CardItem | null
  latestChange: RecentChange | null
  todayChangeCount: number
  onTabChange?: (tab: TabKey) => void
}

function truncateTitle(title: string, maxLen = 18): string {
  return title.length > maxLen ? title.slice(0, maxLen) + '…' : title
}

function SummaryCards({
  counts,
  topOverdue,
  topDueSoon,
  latestChange,
  todayChangeCount,
  onTabChange,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Overdue Card */}
      <button
        type="button"
        onClick={() => onTabChange?.('overdue')}
        className="rounded-xl border shadow-sm p-5 border-l-4 text-left cursor-pointer transition-[shadow,transform] duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] bg-surface-elevated border-l-red-600"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">逾期任務</p>
        {counts.overdue === 0 ? (
          <div className="flex items-end justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-3xl font-bold text-emerald-500">
                0
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">太好了，全數完成</p>
            </div>
            <svg className="w-4 h-4 text-slate-400 mb-1 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        ) : (
          <div className="flex items-end justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-3xl font-bold text-red-600">
                {counts.overdue}
              </p>
              {topOverdue && (
                <>
                  <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 truncate" title={topOverdue.title}>
                    {truncateTitle(topOverdue.title)}
                    <span className="text-xs ml-1 text-red-600">
                      逾期 {Math.abs(Math.floor(topOverdue.days_overdue ?? 0))} 天
                    </span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: PRIORITY_COLORS[topOverdue.priority] + '20',
                        color: PRIORITY_COLORS[topOverdue.priority] || '#6B7280',
                      }}
                    >
                      {PRIORITY_LABELS[topOverdue.priority] || topOverdue.priority}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{topOverdue.project_name}</span>
                  </div>
                </>
              )}
            </div>
            <svg className="w-4 h-4 text-slate-400 mb-1 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </button>

      {/* Due Soon Card */}
      <button
        type="button"
        onClick={() => onTabChange?.('due_soon')}
        className="rounded-xl border shadow-sm p-5 border-l-4 text-left cursor-pointer transition-[shadow,transform] duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] bg-surface-elevated border-l-brand-accent"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">即將到期</p>
        {counts.due_soon === 0 ? (
          <div className="flex items-end justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-3xl font-bold text-emerald-500">
                0
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">近 7 天無到期任務</p>
            </div>
            <svg className="w-4 h-4 text-slate-400 mb-1 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        ) : (
          <div className="flex items-end justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-3xl font-bold text-amber-500">
                {counts.due_soon}
              </p>
              {topDueSoon && (
                <>
                  <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 truncate" title={topDueSoon.title}>
                    {truncateTitle(topDueSoon.title)}
                    <span className="text-xs ml-1 text-amber-500">
                      {getDaysRemaining(topDueSoon.due_date)} 天後截止
                    </span>
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: PRIORITY_COLORS[topDueSoon.priority] + '20',
                        color: PRIORITY_COLORS[topDueSoon.priority] || '#6B7280',
                      }}
                    >
                      {PRIORITY_LABELS[topDueSoon.priority] || topDueSoon.priority}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 truncate">{topDueSoon.project_name}</span>
                  </div>
                </>
              )}
            </div>
            <svg className="w-4 h-4 text-slate-400 mb-1 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
      </button>

      {/* Recent Changes Card */}
      <button
        type="button"
        onClick={() => onTabChange?.('recent_changes')}
        className="rounded-xl border shadow-sm p-5 border-l-4 text-left cursor-pointer transition-[shadow,transform] duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] bg-surface-elevated border-l-brand-green"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">近期變更</p>
        <div className="flex items-end justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-bold text-brand-green">
              {counts.recent_changes}
            </p>
            {todayChangeCount > 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                今天 {todayChangeCount} 筆
              </p>
            ) : latestChange ? (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                {describeAction(latestChange).slice(0, 30)}
              </p>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                {counts.recent_changes}筆近期變更
              </p>
            )}
          </div>
          <svg className="w-4 h-4 text-slate-400 mb-1 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
    </div>
  )
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

interface TabDef {
  id: TabKey
  label: string
  dotClassName?: string
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
  const alertTabs: TabDef[] = [
    {
      id: 'overdue',
      label: '已逾期',
      dotClassName: 'bg-red-600',
      showDot: counts.overdue > 0,
    },
    {
      id: 'due_soon',
      label: '即將到期',
      dotClassName: 'bg-brand-accent',
      showDot: counts.due_soon > 0,
    },
  ]

  const infoTabs: TabDef[] = [
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
    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 overflow-x-auto">
      {alertTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === tab.id
              ? 'bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-slate-100'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          {tab.showDot && (
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${tab.dotClassName}`}
            />
          )}
          {tab.label}
        </button>
      ))}

      {/* Separator */}
      <div className="h-5 w-px bg-slate-300 dark:bg-slate-600 flex-shrink-0 mx-1" />

      {infoTabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
            activeTab === tab.id
              ? 'bg-white dark:bg-slate-900 shadow text-slate-900 dark:text-slate-100'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
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
  onDismiss,
}: {
  card: CardItem
  variant: 'overdue' | 'due_soon'
  onDismiss?: (cardId: string, type: 'overdue' | 'due_soon') => void
}) {
  const borderClass = variant === 'overdue' ? 'border-l-red-600' : 'border-l-brand-accent'
  const priorityColor = PRIORITY_COLORS[card.priority] || '#6B7280'

  const badgeContent =
    variant === 'overdue'
      ? `逾期 ${Math.abs(Math.floor(card.days_overdue ?? 0))} 天`
      : `剩餘 ${getDaysRemaining(card.due_date)} 天`

  const badgeClass = variant === 'overdue'
    ? 'bg-red-600 text-white'
    : 'bg-brand-accent text-brand-primary'

  const assigneeText = card.assignees.length > 0
    ? card.assignees.map((a) => a.name).join(', ')
    : '未指派'

  return (
    <Link
      href={`/projects/${card.project_id}?cardId=${card.id}`}
      className={`group block rounded-lg border shadow-sm border-l-4 hover:shadow-md transition-shadow bg-surface-elevated ${borderClass}`}
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
            <h3 className="font-semibold text-sm truncate text-brand-primary">
              {card.title}
            </h3>
          </div>
          <div className="flex items-center flex-shrink-0">
            <span
              className={`ml-2 flex-shrink-0 text-xs font-medium px-2.5 py-0.5 rounded-full ${badgeClass}`}
            >
              {badgeContent}
            </span>
            {onDismiss && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDismiss(card.id, variant)
                }}
                className="ml-2 flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100 dark:hover:bg-slate-700"
                title="忽略此通知"
              >
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Project > Column | Assignee | Due Date */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mb-3">
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
          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] ${card.progress >= 100 ? 'bg-emerald-500' : 'bg-brand-green'}`}
              style={{
                width: `${Math.min(card.progress, 100)}%`,
              }}
            />
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 w-8 text-right font-[tabular-nums]">
            {card.progress}%
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Dismissable Card List ───────────────────────────────────────────────────

function DismissableCardList({
  items,
  variant,
  dismissedSet,
  onDismiss,
  onRestore,
  emptyMessage,
  emptyIcon,
}: {
  items: CardItem[]
  variant: 'overdue' | 'due_soon'
  dismissedSet: Set<string>
  onDismiss: (cardId: string, type: 'overdue' | 'due_soon') => void
  onRestore: (cardId: string, type: 'overdue' | 'due_soon') => void
  emptyMessage: string
  emptyIcon: string
}) {
  const [showDismissed, setShowDismissed] = useState(false)

  const activeItems = items.filter(
    (card) => !dismissedSet.has(`${card.id}:${variant}`)
  )
  const dismissedItems = items.filter(
    (card) => dismissedSet.has(`${card.id}:${variant}`)
  )

  if (items.length === 0) {
    return <EmptyState message={emptyMessage} icon={emptyIcon} />
  }

  return (
    <div>
      {activeItems.length === 0 && dismissedItems.length > 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="text-4xl mb-4">&#10003;</span>
          <p className="text-sm text-slate-500 dark:text-slate-400">所有項目已處理</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeItems.map((card) => (
            <CardListItem
              key={card.id}
              card={card}
              variant={variant}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      )}

      {dismissedItems.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <button
            type="button"
            onClick={() => setShowDismissed((prev) => !prev)}
            className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showDismissed ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            已忽略 ({dismissedItems.length})
          </button>
          {showDismissed && (
            <div className="space-y-3 mt-3 opacity-60">
              {dismissedItems.map((card) => (
                <div key={`${card.id}-dismissed`} className="relative">
                  <CardListItem card={card} variant={variant} />
                  <button
                    type="button"
                    onClick={() => onRestore(card.id, variant)}
                    className="absolute top-3 right-3 text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium px-2 py-1 rounded hover:bg-blue-50"
                  >
                    恢復
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
                  className="flex gap-3 rounded-lg p-3 hover:bg-muted transition-colors"
                >
                  <span className="text-xs text-slate-400 mt-0.5 flex-shrink-0 w-12 text-right font-mono">
                    {formatTime(change.created_at)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
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
          className="block rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow bg-surface-elevated"
        >
          <h3 className="font-semibold text-base mb-3 text-brand-primary">
            {project.name}
          </h3>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] ${project.completion_rate >= 100 ? 'bg-emerald-500' : 'bg-brand-green'}`}
                style={{
                  width: `${Math.min(project.completion_rate, 100)}%`,
                }}
              />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 flex-shrink-0 font-[tabular-nums]">
              {Math.round(project.completion_rate)}%
            </span>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              📋 {project.total_cards} 張卡片
            </span>
            <span className="inline-flex items-center gap-1">
              ✅ {project.completed_cards} 完成
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1.5">
            {project.overdue_count > 0 && (
              <span className="inline-flex items-center gap-1 text-red-600">
                🔴 {project.overdue_count} 逾期
              </span>
            )}
            {project.due_soon_count > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-500">
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
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
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
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabKey>('overdue')
  const [dismissedSet, setDismissedSet] = useState<Set<string>>(new Set())

  const {
    data,
    isLoading: loading,
    error: queryError,
    refetch: fetchData,
  } = useQuery({
    queryKey: queryKeys.notifications.center(),
    queryFn: () => fetchNotificationCenter() as Promise<NotificationData>,
  })

  const error = queryError instanceof Error ? queryError.message : queryError ? '載入失敗' : null

  // Initialize dismissed set from query data
  const initDismissed = useCallback((notifData: NotificationData | undefined) => {
    if (notifData?.dismissed) {
      setDismissedSet(new Set(notifData.dismissed.map(d => `${d.card_id}:${d.dismiss_type}`)))
    }
  }, [])

  // Sync dismissed set when data changes
  useState(() => { initDismissed(data) })

  const dismissMutation = useMutation({
    mutationFn: ({ cardId, type }: { cardId: string; type: string }) =>
      dismissNotification(cardId, type),
    onMutate: async ({ cardId, type }) => {
      const key = `${cardId}:${type}`
      setDismissedSet(prev => new Set(prev).add(key))
    },
    onSuccess: () => {
      window.dispatchEvent(new Event('notification-dismissed'))
    },
    onError: (_err, { cardId, type }) => {
      const key = `${cardId}:${type}`
      setDismissedSet(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: ({ cardId, type }: { cardId: string; type: string }) =>
      restoreNotification(cardId, type),
    onMutate: async ({ cardId, type }) => {
      const key = `${cardId}:${type}`
      setDismissedSet(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    },
    onSuccess: () => {
      window.dispatchEvent(new Event('notification-dismissed'))
    },
    onError: (_err, { cardId, type }) => {
      const key = `${cardId}:${type}`
      setDismissedSet(prev => new Set(prev).add(key))
    },
  })

  const handleDismiss = (cardId: string, type: 'overdue' | 'due_soon') => {
    dismissMutation.mutate({ cardId, type })
  }

  const handleRestore = (cardId: string, type: 'overdue' | 'due_soon') => {
    restoreMutation.mutate({ cardId, type })
  }

  const counts = data?.counts ?? { due_soon: 0, overdue: 0, recent_changes: 0 }

  return (
    <div id="main-content" className="min-h-screen bg-brand-bg">
      {/* ─── Header ─────────────────────────────────────────── */}
      <header className="border-b bg-brand-primary border-brand-green">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-start justify-between">
            <div>
              <Link
                href="/projects"
                className="inline-flex items-center gap-1 text-sm mb-4 text-brand-bg/70 hover:text-brand-bg/90 transition-colors"
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
              <h1 className="text-2xl sm:text-3xl font-bold text-brand-bg tracking-tight">
                通知中心
              </h1>
              <p className="mt-1 sm:mt-2 text-sm sm:text-base text-brand-bg/70">
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
          <SummaryCards
            counts={counts}
            topOverdue={data.overdue[0] ?? null}
            topDueSoon={data.due_soon[0] ?? null}
            latestChange={data.recent_changes[0] ?? null}
            todayChangeCount={data.recent_changes.filter(c => getDateGroupLabel(c.created_at) === '今天').length}
            onTabChange={setActiveTab}
          />
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
              <DismissableCardList
                items={data.overdue}
                variant="overdue"
                dismissedSet={dismissedSet}
                onDismiss={handleDismiss}
                onRestore={handleRestore}
                emptyMessage="太好了！目前沒有逾期的任務"
                emptyIcon="✅"
              />
            )}

            {/* Due Soon Tab */}
            {activeTab === 'due_soon' && (
              <DismissableCardList
                items={data.due_soon}
                variant="due_soon"
                dismissedSet={dismissedSet}
                onDismiss={handleDismiss}
                onRestore={handleRestore}
                emptyMessage="近 7 天沒有即將到期的任務"
                emptyIcon="📅"
              />
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
