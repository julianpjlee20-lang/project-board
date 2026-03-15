'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UuidDisplay } from '@/components/ui/UuidDisplay'
import { DateInput } from '@/components/ui/DateInput'
import { AssigneeCombobox } from '@/components/ui/AssigneeCombobox'
import type { Card, Phase, Subtask, ActivityLog, CardDetailProps, ActiveUser, RecurrenceRule } from './types'
import { getDerivedDueDate, getDaysUntil } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_COLORS: Record<Card['priority'], string> = {
  high: 'bg-priority-high',
  medium: 'bg-priority-medium',
  low: 'bg-emerald-500',
}

const PRIORITY_LABELS: Record<Card['priority'], string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const ACTION_LABELS: Record<string, string> = {
  create_card: '建立卡片',
  update_card: '更新卡片',
  move_card: '移動卡片',
  delete_card: '刪除卡片',
  add_assignee: '新增指派人',
  remove_assignee: '移除指派人',
  add_comment: '新增留言',
  update_column: '更新欄位',
  create_column: '建立欄位',
  delete_column: '刪除欄位',
  add_label: '新增標籤',
  remove_label: '移除標籤',
  update_subtask: '更新子任務',
  create_subtask: '建立子任務',
  delete_subtask: '刪除子任務',
}

function translateAction(action: string): string {
  return ACTION_LABELS[action] || action
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function toDateOnly(dateStr: string): string {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDaysUntilDue(dateStr: string): number {
  return getDaysUntil(toDateOnly(dateStr))
}

function formatShortDate(dateStr: string): string {
  const d = new Date(toDateOnly(dateStr) + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function getDueDateStyle(days: number, isCompleted: boolean): string {
  if (isCompleted) return 'bg-slate-100 dark:bg-slate-800 text-slate-400'
  if (days < 0) return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium'
  if (days === 0) return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
  if (days <= 3) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
  if (days <= 7) return 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
  return 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
}

function formatDueDateLabel(dateStr: string, days: number): string {
  if (days < 0) return `${formatShortDate(dateStr)} · 逾期${Math.abs(days)}天`
  if (days === 0) return '今天截止'
  if (days <= 7) return `${formatShortDate(dateStr)} · 剩${days}天`
  return formatShortDate(dateStr)
}

function getScheduleSummary(dueDate: string, plannedDate: string, actualDate: string): string | null {
  if (!dueDate) return null
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0)

  if (actualDate) {
    const actual = new Date(actualDate); actual.setHours(0, 0, 0, 0)
    const diffMs = due.getTime() - actual.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays > 0) return `比截止日提前 ${diffDays} 天完成`
    if (diffDays < 0) return `比截止日延遲 ${Math.abs(diffDays)} 天完成`
    return '剛好在截止日完成'
  }

  if (plannedDate) {
    const planned = new Date(plannedDate); planned.setHours(0, 0, 0, 0)
    const diffMs = due.getTime() - planned.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays > 0) return `預計比截止日提前 ${diffDays} 天完成`
    if (diffDays < 0) return `預計比截止日延遲 ${Math.abs(diffDays)} 天`
    return '預計在截止日當天完成'
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays > 0) return `距離截止日還有 ${diffDays} 天`
  if (diffDays < 0) return `已超過截止日 ${Math.abs(diffDays)} 天`
  return '今天是截止日'
}

function getScheduleCollapsedDisplay(
  startDate: string,
  dueDate: string,
  actualDate: string
): { text: string; icon: string; color: string } | null {
  const fmtShort = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

  if (actualDate && dueDate) {
    const actual = new Date(actualDate + 'T00:00:00')
    const due = new Date(dueDate + 'T00:00:00')
    const diff = Math.round((due.getTime() - actual.getTime()) / 86400000)
    if (diff > 0) return { text: `比截止日提前 ${diff} 天完成（${fmtShort(actual)}）`, icon: '✅', color: 'text-green-600' }
    if (diff < 0) return { text: `比截止日延遲 ${Math.abs(diff)} 天完成（${fmtShort(actual)}）`, icon: '⚠️', color: 'text-red-500' }
    return { text: `在截止日當天完成（${fmtShort(actual)}）`, icon: '✅', color: 'text-green-600' }
  }
  if (actualDate) {
    const actual = new Date(actualDate + 'T00:00:00')
    return { text: `已完成（${fmtShort(actual)}）`, icon: '✅', color: 'text-green-600' }
  }
  if (startDate && dueDate) {
    const start = new Date(startDate + 'T00:00:00')
    const due = new Date(dueDate + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const left = Math.round((due.getTime() - today.getTime()) / 86400000)
    if (left > 0) return { text: `${fmtShort(start)} → ${fmtShort(due)}（剩 ${left} 天）`, icon: '🕐', color: 'text-slate-600 dark:text-slate-300' }
    if (left < 0) return { text: `${fmtShort(start)} → ${fmtShort(due)}（已超過 ${Math.abs(left)} 天）`, icon: '⚠️', color: 'text-red-500' }
    return { text: `${fmtShort(start)} → ${fmtShort(due)}（今天截止）`, icon: '🕐', color: 'text-amber-600' }
  }
  if (dueDate) {
    const due = new Date(dueDate + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const left = Math.round((due.getTime() - today.getTime()) / 86400000)
    if (left > 0) return { text: `${fmtShort(due)} 截止（剩 ${left} 天）`, icon: '🕐', color: 'text-slate-600 dark:text-slate-300' }
    if (left < 0) return { text: `${fmtShort(due)} 截止（已超過 ${Math.abs(left)} 天）`, icon: '⚠️', color: 'text-red-500' }
    return { text: `今天截止（${fmtShort(due)}）`, icon: '🕐', color: 'text-amber-600' }
  }
  if (startDate) {
    const start = new Date(startDate + 'T00:00:00')
    return { text: `${fmtShort(start)} 開始`, icon: '📅', color: 'text-slate-500 dark:text-slate-400' }
  }
  return null
}

// ---------------------------------------------------------------------------
// ScheduleTimelineBar
// ---------------------------------------------------------------------------

function ScheduleTimelineBar({ dueDate, plannedDate, actualDate, createdAt }: {
  dueDate: string
  plannedDate: string
  actualDate: string
  createdAt?: string
}) {
  const dates: { label: string; value: Date }[] = []
  const dueDateParsed = dueDate ? (() => { const d = new Date(dueDate); d.setHours(0,0,0,0); return d })() : null
  const plannedParsed = plannedDate ? (() => { const d = new Date(plannedDate); d.setHours(0,0,0,0); return d })() : null
  const actualParsed = actualDate ? (() => { const d = new Date(actualDate); d.setHours(0,0,0,0); return d })() : null
  const createdParsed = createdAt ? (() => { const d = new Date(createdAt); d.setHours(0,0,0,0); return d })() : null

  if (dueDateParsed) dates.push({ label: '截止', value: dueDateParsed })
  if (plannedParsed) dates.push({ label: '預計', value: plannedParsed })
  if (actualParsed) dates.push({ label: '實際', value: actualParsed })
  if (createdParsed) dates.push({ label: '建立', value: createdParsed })

  if (dates.length < 2) {
    return (
      <div className="text-xs text-slate-400 dark:text-slate-500 mt-2">需要至少 2 個日期才能顯示時間軸</div>
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const allTimestamps = dates.map(d => d.value.getTime())
  allTimestamps.push(today.getTime())
  const minTime = Math.min(...allTimestamps)
  const maxTime = Math.max(...allTimestamps)
  const range = maxTime - minTime || 1

  const toPercent = (d: Date) => ((d.getTime() - minTime) / range) * 100

  const segments: { left: number; width: number; color: string }[] = []

  const startTime = createdParsed || new Date(minTime)

  if (actualParsed && dueDateParsed) {
    if (actualParsed <= dueDateParsed) {
      segments.push({
        left: toPercent(startTime),
        width: toPercent(actualParsed) - toPercent(startTime),
        color: 'bg-blue-400',
      })
      segments.push({
        left: toPercent(actualParsed),
        width: toPercent(dueDateParsed) - toPercent(actualParsed),
        color: 'bg-emerald-400',
      })
    } else {
      segments.push({
        left: toPercent(startTime),
        width: toPercent(dueDateParsed) - toPercent(startTime),
        color: 'bg-blue-400',
      })
      segments.push({
        left: toPercent(dueDateParsed),
        width: toPercent(actualParsed) - toPercent(dueDateParsed),
        color: 'bg-red-400',
      })
    }
  } else if (plannedParsed) {
    const endPoint = plannedParsed
    segments.push({
      left: toPercent(startTime),
      width: Math.min(toPercent(today), toPercent(endPoint)) - toPercent(startTime),
      color: 'bg-blue-400',
    })
    if (today < endPoint) {
      segments.push({
        left: toPercent(today),
        width: toPercent(endPoint) - toPercent(today),
        color: 'bg-slate-200',
      })
    }
  } else if (dueDateParsed) {
    segments.push({
      left: toPercent(startTime),
      width: Math.min(toPercent(today), toPercent(dueDateParsed)) - toPercent(startTime),
      color: 'bg-blue-400',
    })
    if (today < dueDateParsed) {
      segments.push({
        left: toPercent(today),
        width: toPercent(dueDateParsed) - toPercent(today),
        color: 'bg-slate-200',
      })
    }
  }

  const markers = dates
    .filter(d => d.label !== '建立')
    .map(d => ({ label: d.label, percent: toPercent(d.value), date: d.value }))

  const formatShort = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`

  return (
    <div className="mt-3">
      {/* Marker labels */}
      <div className="relative h-4 text-xs text-slate-500 dark:text-slate-400 mb-1">
        {markers.map((m, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${Math.max(5, Math.min(95, m.percent))}%` }}
          >
            {formatShort(m.date)}
          </span>
        ))}
      </div>
      {/* Bar */}
      <div className="relative w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`absolute top-0 h-full ${seg.color} ${
              i === 0 ? 'rounded-l-full' : ''
            } ${i === segments.length - 1 ? 'rounded-r-full' : ''}`}
            style={{
              left: `${seg.left}%`,
              width: `${Math.max(seg.width, 0.5)}%`,
            }}
          />
        ))}
        {/* Due date dashed marker */}
        {dueDateParsed && (
          <div
            className="absolute top-0 h-full border-l-2 border-dashed border-slate-500 dark:border-slate-400"
            style={{ left: `${toPercent(dueDateParsed)}%` }}
          />
        )}
      </div>
      {/* Legend labels */}
      <div className="relative h-4 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
        {markers.map((m, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: `${Math.max(5, Math.min(95, m.percent))}%` }}
          >
            {m.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SubtaskChecklist
// ---------------------------------------------------------------------------

/** 取得使用者名稱的首字母（支援中文） */
function getInitial(name: string): string {
  if (!name) return '?'
  return (Array.from(name)[0] ?? '?').toUpperCase()
}

/** 根據名稱產生一致的背景色 */
function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

/** 取得截止日圓點的顏色 class */
function getDueDotColor(days: number, isCompleted: boolean): string {
  if (isCompleted) return 'bg-slate-300 dark:bg-slate-600'
  if (days <= 0) return 'bg-red-500'
  if (days <= 3) return 'bg-orange-500'
  return 'bg-slate-400 dark:bg-slate-500'
}

/** 取得截止日圓點的 tooltip 文字 */
function getDueDotTooltip(dateStr: string, days: number, isCompleted: boolean, isInherited: boolean): string {
  const base = isCompleted
    ? formatShortDate(dateStr)
    : formatDueDateLabel(dateStr, days)
  const suffix = isInherited ? ' (繼承自卡片)' : ''
  return base + suffix
}

function SubtaskChecklist({ cardId, subtasks: initialSubtasks, onSubtasksChange, activeUsers, cardDueDate, onBoardUpdate }: {
  cardId: string
  subtasks: Subtask[]
  onSubtasksChange: (subtasks: Subtask[]) => void
  activeUsers: { id: string; name: string }[]
  cardDueDate?: string | null
  onBoardUpdate?: () => void
}) {
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks || [])
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newAssigneeId, setNewAssigneeId] = useState('')
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSubmittingRef = useRef(false)

  // activeUsers with avatar_url for AssigneeCombobox
  const comboboxUsers = useMemo(
    () => activeUsers.map(u => ({ ...u, avatar_url: null as string | null })),
    [activeUsers]
  )

  useEffect(() => {
    setSubtasks(initialSubtasks || [])
  }, [initialSubtasks])

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
    }
  }, [])

  const completedCount = subtasks.filter(s => s.is_completed).length
  const totalCount = subtasks.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const updateSubtaskField = async (subtaskId: string, field: 'title' | 'due_date' | 'assignee_id', value: string) => {
    const updated = subtasks.map(s => {
      if (s.id !== subtaskId) return s
      if (field === 'title') return { ...s, title: value }
      if (field === 'due_date') return { ...s, due_date: value || null }
      if (field === 'assignee_id') {
        const user = activeUsers.find(u => u.id === value)
        return { ...s, assignee_id: value || null, assignee_name: user?.name || null }
      }
      return s
    })
    setSubtasks(updated)
    onSubtasksChange(updated)

    try {
      const res = await fetch(`/api/cards/${cardId}/subtasks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtask_id: subtaskId, [field]: value || null })
      })
      if (!res.ok) { setSubtasks(subtasks); onSubtasksChange(subtasks) }
      else {
        const data = await res.json()
        if (data.auto_transition?.moved && onBoardUpdate) onBoardUpdate()
      }
    } catch { setSubtasks(subtasks); onSubtasksChange(subtasks) }
  }

  const toggleSubtask = async (subtask: Subtask) => {
    const updated = { ...subtask, is_completed: !subtask.is_completed }
    const newSubtasks = subtasks.map(s => s.id === subtask.id ? updated : s)
    setSubtasks(newSubtasks)
    onSubtasksChange(newSubtasks)

    try {
      const res = await fetch(`/api/cards/${cardId}/subtasks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subtask_id: subtask.id, is_completed: !subtask.is_completed })
      })
      if (!res.ok) {
        setSubtasks(subtasks)
        onSubtasksChange(subtasks)
      } else {
        const data = await res.json()
        if (data.auto_transition?.moved && onBoardUpdate) onBoardUpdate()
      }
    } catch {
      setSubtasks(subtasks)
      onSubtasksChange(subtasks)
    }
  }

  const submitNewSubtask = async () => {
    if (!newTitle.trim() || isSubmittingRef.current) return
    isSubmittingRef.current = true

    try {
      const res = await fetch(`/api/cards/${cardId}/subtasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          due_date: newDueDate || null,
          assignee_id: newAssigneeId || null,
        })
      })
      if (!res.ok) throw new Error('新增子任務失敗')
      const created = await res.json()
      const newSubtasks = [...subtasks, created]
      setSubtasks(newSubtasks)
      onSubtasksChange(newSubtasks)
      setNewTitle('')
      setNewDueDate('')
      setNewAssigneeId('')
    } catch (err) {
      console.error('新增子任務錯誤:', err)
      // 失敗時不清空，讓使用者可以重試
    } finally {
      isSubmittingRef.current = false
    }
  }

  const addSubtask = (e: React.FormEvent) => {
    e.preventDefault()
    submitNewSubtask()
  }

  const deleteSubtask = async (id: string) => {
    const newSubtasks = subtasks.filter(s => s.id !== id)
    setSubtasks(newSubtasks)
    onSubtasksChange(newSubtasks)
    setEditingSubtaskId(null)

    try {
      const res = await fetch(`/api/cards/${cardId}/subtasks?subtask_id=${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        setSubtasks(subtasks)
        onSubtasksChange(subtasks)
      }
    } catch {
      setSubtasks(subtasks)
      onSubtasksChange(subtasks)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">子任務</span>
        {totalCount > 0 && (
          <span className="text-xs text-slate-400 dark:text-slate-500">{completedCount}/{totalCount}</span>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-2">
          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-300 ${
                progressPercent === 100 ? 'bg-emerald-500'
                  : subtasks.some(s => !s.is_completed && s.due_date && getDaysUntilDue(s.due_date) < 0) ? 'bg-priority-high'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-0.5 mb-2">
        {subtasks.map(subtask => {
          const isExpanded = editingSubtaskId === subtask.id
          const effectiveDueDate = subtask.due_date || cardDueDate || null
          const isInherited = !subtask.due_date && !!cardDueDate
          const days = effectiveDueDate ? getDaysUntilDue(effectiveDueDate) : null

          return (
            <div key={subtask.id}>
              {/* Compact row */}
              <div
                className={`flex items-center gap-2 py-1.5 px-1 rounded cursor-pointer transition-colors ${
                  isExpanded
                    ? 'bg-slate-100 dark:bg-slate-800'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
                onClick={() => setEditingSubtaskId(isExpanded ? null : subtask.id)}
              >
                <input
                  type="checkbox"
                  checked={subtask.is_completed}
                  onChange={() => toggleSubtask(subtask)}
                  onClick={e => e.stopPropagation()}
                  className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-blue-500 cursor-pointer dark:bg-slate-800 shrink-0"
                />
                <span
                  className={`flex-1 text-sm truncate ${
                    subtask.is_completed
                      ? 'line-through text-slate-400'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {subtask.title}
                </span>

                {/* Icon indicators (right-aligned) */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Due date dot */}
                  {effectiveDueDate && days !== null && (
                    <span
                      role="img"
                      aria-label={getDueDotTooltip(effectiveDueDate, days, subtask.is_completed, isInherited)}
                      className={`w-2 h-2 rounded-full ${getDueDotColor(days, subtask.is_completed)} ${
                        isInherited ? 'ring-1 ring-offset-1 ring-slate-300 dark:ring-slate-600 dark:ring-offset-slate-900' : ''
                      }`}
                      title={getDueDotTooltip(effectiveDueDate, days, subtask.is_completed, isInherited)}
                    />
                  )}
                  {/* Assignee mini avatar */}
                  {subtask.assignee_name && (
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-medium shrink-0 ${getAvatarColor(subtask.assignee_name)}`}
                      title={subtask.assignee_name}
                    >
                      {getInitial(subtask.assignee_name)}
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded edit panel */}
              {isExpanded && (
                <div className="ml-8 mr-2 mb-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                  {/* Title input */}
                  <div>
                    <label htmlFor={`subtask-title-${subtask.id}`} className="block text-xs text-slate-500 dark:text-slate-400 mb-1">名稱</label>
                    <input
                      id={`subtask-title-${subtask.id}`}
                      key={`${subtask.id}-${subtask.title}`}
                      type="text"
                      defaultValue={subtask.title}
                      onBlur={e => {
                        const val = e.target.value.trim()
                        if (val && val !== subtask.title) {
                          updateSubtaskField(subtask.id, 'title', val)
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const val = (e.target as HTMLInputElement).value.trim()
                          if (val && val !== subtask.title) {
                            updateSubtaskField(subtask.id, 'title', val)
                          }
                        }
                        if (e.key === 'Escape') setEditingSubtaskId(null)
                      }}
                      className="w-full text-sm border rounded-md px-3 py-2 dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      autoFocus
                    />
                  </div>

                  {/* Due date + Assignee row */}
                  <div className="flex flex-wrap gap-3">
                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">截止日</label>
                      <DateInput
                        value={subtask.due_date ? toDateOnly(subtask.due_date) : ''}
                        onChange={val => updateSubtaskField(subtask.id, 'due_date', val)}
                        className="w-full dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200"
                      />
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">負責人</label>
                      <AssigneeCombobox
                        users={comboboxUsers}
                        value={subtask.assignee_id || ''}
                        onChange={val => updateSubtaskField(subtask.id, 'assignee_id', val)}
                      />
                    </div>
                  </div>

                  {/* Bottom actions: delete (left) + collapse (right) */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (pendingDeleteId === subtask.id) {
                          if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current)
                          setPendingDeleteId(null)
                          deleteSubtask(subtask.id)
                        } else {
                          setPendingDeleteId(subtask.id)
                          deleteTimerRef.current = setTimeout(() => {
                            setPendingDeleteId(null)
                          }, 1500)
                        }
                      }}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        pendingDeleteId === subtask.id
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium'
                          : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                      }`}
                    >
                      {pendingDeleteId === subtask.id ? '再次點擊確認刪除' : '刪除子任務'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSubtaskId(null)}
                      className="text-xs px-2 py-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      收合
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add subtask */}
      <form onSubmit={addSubtask}>
        <div className="flex items-center gap-3">
          <div className="w-5 shrink-0" />
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="新增子任務...按 Enter 送出"
            className="flex-1 text-sm border-0 border-b border-dashed border-slate-300 dark:border-slate-600 bg-transparent px-1 py-2 focus:border-blue-500 focus:outline-none placeholder:text-slate-400 dark:text-slate-200"
          />
        </div>
      </form>
      {/* Optional fields for new subtask (shown when title is non-empty) */}
      {newTitle.trim() && (
        <div className="ml-8 mt-2 p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-dashed border-blue-200 dark:border-blue-800 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">截止日（選填）</label>
              <DateInput
                value={newDueDate}
                onChange={setNewDueDate}
                className="w-full dark:bg-slate-900 dark:border-slate-600 dark:text-slate-200"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">負責人（選填）</label>
              <AssigneeCombobox
                users={comboboxUsers}
                value={newAssigneeId}
                onChange={setNewAssigneeId}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submitNewSubtask}
              className="text-sm px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              新增
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// useCardDetail custom hook
// ---------------------------------------------------------------------------

interface UseCardDetailReturn {
  // Form state
  title: string
  setTitle: (v: string) => void
  description: string
  setDescription: (v: string) => void
  assigneeId: string
  setAssigneeId: (v: string) => void
  activeUsers: ActiveUser[]
  startDate: string
  setStartDate: (v: string) => void
  dueDate: string
  setDueDate: (v: string) => void
  plannedDate: string
  setPlannedDate: (v: string) => void
  actualDate: string
  setActualDate: (v: string) => void
  cardCreatedAt: string | undefined
  priority: Card['priority']
  setPriority: (v: Card['priority']) => void
  phaseId: string | null
  setPhaseId: (v: string | null) => void
  activity: ActivityLog[]
  cardSubtasks: Subtask[]
  setCardSubtasks: (v: Subtask[]) => void
  // Date editing
  editingDate: string | null
  setEditingDate: (v: string | null) => void
  scheduleExpanded: boolean
  setScheduleExpanded: (v: boolean | ((prev: boolean) => boolean)) => void
  // Save/cancel
  isSaving: boolean
  isFormReady: boolean
  saveCard: () => Promise<void>
  handleCancel: () => void
  // Delete
  isDeleting: boolean
  showDeleteConfirm: boolean
  setShowDeleteConfirm: (v: boolean) => void
  deleteCard: () => Promise<void>
  // Archive
  isArchiving: boolean
  archiveCard: () => Promise<void>
  // Recurrence
  recurrenceRule: RecurrenceRule | null
  setRecurrenceRule: (v: RecurrenceRule | null) => void
  // Computed
  scheduleSummary: string | null
  collapsedDisplay: { text: string; icon: string; color: string } | null
  // Board refresh
  onUpdate: () => Promise<void>
}

function useCardDetail(cardId: string, onCloseFn: () => void, onUpdate: () => Promise<void>): UseCardDetailReturn {
  const onCloseFnRef = useRef(onCloseFn)
  onCloseFnRef.current = onCloseFn
  const [isFormReady, setIsFormReady] = useState(false)
  const [originalData, setOriginalData] = useState({
    title: '',
    description: '',
    assigneeId: '',
    startDate: '',
    dueDate: '',
    plannedDate: '',
    actualDate: '',
    priority: 'medium' as Card['priority'],
    phase_id: null as string | null,
  })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([])
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [actualDate, setActualDate] = useState('')
  const [cardCreatedAt, setCardCreatedAt] = useState<string | undefined>(undefined)
  const [priority, setPriority] = useState<Card['priority']>('medium')
  const [phaseId, setPhaseId] = useState<string | null>(null)
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [cardSubtasks, setCardSubtasks] = useState<Subtask[]>([])

  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | null>(null)

  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [scheduleExpanded, setScheduleExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Fetch active users for assignee dropdown
  useEffect(() => {
    fetch('/api/users/active').then(r => r.json()).then(data => {
      if (data.users) setActiveUsers(data.users)
    }).catch(console.error)
  }, [])

  // Fetch card data and activity on mount
  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch('/api/cards/' + cardId).then(res => {
        if (!res.ok) throw new Error('無法載入卡片資料')
        return res.json()
      }),
      fetch('/api/cards/' + cardId + '/activity').then(res => {
        if (!res.ok) throw new Error('無法載入活動紀錄')
        return res.json()
      }).catch(() => [])
    ]).then(([cardData, activityData]) => {
      if (cancelled) return
      const formData = {
        title: cardData.title,
        description: cardData.description || '',
        assigneeId: cardData.assignees?.[0]?.id || '',
        startDate: cardData.start_date ? toDateOnly(cardData.start_date) : '',
        dueDate: cardData.due_date ? toDateOnly(cardData.due_date) : '',
        plannedDate: cardData.planned_completion_date ? toDateOnly(cardData.planned_completion_date) : '',
        actualDate: cardData.actual_completion_date ? toDateOnly(cardData.actual_completion_date) : '',
        priority: (cardData.priority || 'medium') as Card['priority'],
        phase_id: cardData.phase_id || null,
      }
      setTitle(formData.title)
      setDescription(formData.description)
      setAssigneeId(formData.assigneeId)
      setStartDate(formData.startDate)
      setDueDate(formData.dueDate)
      setPlannedDate(formData.plannedDate)
      setActualDate(formData.actualDate)
      setCardCreatedAt(cardData.created_at)
      setPriority(formData.priority)
      setPhaseId(formData.phase_id)
      setOriginalData(formData)
      setActivity(activityData)
      setCardSubtasks(cardData.subtasks || [])
      setRecurrenceRule(cardData.recurrence_rule || null)
      setIsFormReady(true)
    }).catch(err => {
      console.error('載入卡片錯誤:', err)
      if (!cancelled) {
        alert('無法載入卡片資料，請重新整理頁面')
        onCloseFnRef.current()
      }
    })

    return () => { cancelled = true }
  }, [cardId])

  const saveCard = useCallback(async () => {
    if (isSaving) return

    setIsSaving(true)
    try {
      const payload = {
        title,
        description,
        assignee_id: assigneeId || null,
        start_date: startDate || null,
        due_date: dueDate || null,
        planned_completion_date: plannedDate || null,
        actual_completion_date: actualDate || null,
        priority,
        phase_id: phaseId,
        recurrence_rule: recurrenceRule,
      }
      console.log('[saveCard] payload:', JSON.stringify(payload))
      const res = await fetch('/api/cards/' + cardId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (res.ok) {
        try { await onUpdate() } catch (e) { console.error('[saveCard] onUpdate failed:', e) }
        onCloseFn()
      } else {
        console.error('[saveCard] API error:', JSON.stringify(data))
        alert('儲存失敗: ' + (data.error || '未知錯誤') + (data.detail ? '\n詳情: ' + data.detail : '') + (data.step ? '\n步驟: ' + data.step : ''))
        setIsSaving(false)
      }
    } catch (e) {
      console.error('Save error:', e)
      alert('儲存失敗')
      setIsSaving(false)
    }
  }, [isSaving, title, description, assigneeId, startDate, dueDate, plannedDate, actualDate, priority, phaseId, recurrenceRule, cardId, onCloseFn, onUpdate])

  const deleteCard = useCallback(async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/cards/${cardId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete card')
      try { await onUpdate() } catch (e) { console.error('[deleteCard] onUpdate failed:', e) }
      onCloseFn()
    } catch (error) {
      console.error('Delete card error:', error)
      setIsDeleting(false)
    }
  }, [cardId, onUpdate, onCloseFn])

  const [isArchiving, setIsArchiving] = useState(false)

  const archiveCard = useCallback(async () => {
    setIsArchiving(true)
    try {
      const res = await fetch(`/api/cards/${cardId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: true }),
      })
      if (!res.ok) throw new Error('封存失敗')
      try { await onUpdate() } catch (e) { console.error('[archiveCard] onUpdate failed:', e) }
      onCloseFn()
    } catch (err) {
      console.error('Archive error:', err)
    } finally {
      setIsArchiving(false)
    }
  }, [cardId, onCloseFn, onUpdate])

  const handleCancel = useCallback(() => {
    setTitle(originalData.title)
    setDescription(originalData.description)
    setAssigneeId(originalData.assigneeId)
    setStartDate(originalData.startDate)
    setDueDate(originalData.dueDate)
    setPlannedDate(originalData.plannedDate)
    setActualDate(originalData.actualDate)
    setPriority(originalData.priority)
    setPhaseId(originalData.phase_id)
    onCloseFn()
  }, [originalData, onCloseFn])

  const scheduleSummary = useMemo(() => getScheduleSummary(dueDate, plannedDate, actualDate), [dueDate, plannedDate, actualDate])
  const collapsedDisplay = useMemo(() => getScheduleCollapsedDisplay(startDate, dueDate, actualDate), [startDate, dueDate, actualDate])

  return {
    title, setTitle,
    description, setDescription,
    assigneeId, setAssigneeId,
    activeUsers,
    startDate, setStartDate,
    dueDate, setDueDate,
    plannedDate, setPlannedDate,
    actualDate, setActualDate,
    cardCreatedAt,
    priority, setPriority,
    phaseId, setPhaseId,
    activity,
    cardSubtasks, setCardSubtasks,
    recurrenceRule, setRecurrenceRule,
    editingDate, setEditingDate,
    scheduleExpanded, setScheduleExpanded,
    isSaving,
    isFormReady,
    saveCard,
    handleCancel,
    isDeleting,
    showDeleteConfirm, setShowDeleteConfirm,
    deleteCard,
    isArchiving,
    archiveCard,
    scheduleSummary,
    collapsedDisplay,
    onUpdate,
  }
}

// ---------------------------------------------------------------------------
// CardDetailContent — pure UI component (Zone A ~ E)
// ---------------------------------------------------------------------------

function CardDetailContent({ card, phases, detail }: {
  card: Card
  phases: Phase[]
  detail: UseCardDetailReturn
}) {
  const {
    title, setTitle,
    description, setDescription,
    assigneeId, setAssigneeId,
    activeUsers,
    startDate, setStartDate,
    dueDate, setDueDate,
    plannedDate, setPlannedDate,
    actualDate, setActualDate,
    cardCreatedAt,
    priority, setPriority,
    phaseId, setPhaseId,
    activity,
    cardSubtasks, setCardSubtasks,
    recurrenceRule, setRecurrenceRule,
    editingDate, setEditingDate,
    scheduleExpanded, setScheduleExpanded,
    scheduleSummary,
    collapsedDisplay,
    onUpdate,
  } = detail

  // Derived due date from subtasks (when no manual due date is set)
  const derivedDueDate = useMemo(() => {
    if (dueDate) return null
    return getDerivedDueDate(cardSubtasks)
  }, [dueDate, cardSubtasks])

  // Compute due date display for Zone B
  const dueDateDisplay = useMemo(() => {
    const effectiveDate = dueDate || derivedDueDate
    if (!effectiveDate) return null
    const isDerived = !dueDate && !!derivedDueDate
    const due = new Date(effectiveDate + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)
    const dateText = due.toLocaleDateString('zh-TW')
    let badge: { text: string; className: string } | null = null
    if (actualDate) {
      // Already completed — no urgency badge
    } else if (diffDays < 0) {
      badge = { text: `逾期 ${Math.abs(diffDays)} 天`, className: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' }
    } else if (diffDays === 0) {
      badge = { text: '今天截止', className: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' }
    } else if (diffDays <= 3) {
      badge = { text: `剩 ${diffDays} 天`, className: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' }
    } else {
      badge = { text: `剩 ${diffDays} 天`, className: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' }
    }
    return { dateText, badge, isDerived }
  }, [dueDate, derivedDueDate, actualDate])

  return (
    <div className="px-5 py-4 max-sm:px-4">
      {/* ================================================================= */}
      {/* Zone A: Hero (Title + Description) */}
      {/* ================================================================= */}
      <div className="space-y-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full text-lg max-sm:text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-2 max-sm:py-2.5 -mx-2 max-sm:mx-0 focus-visible:border-slate-300 dark:focus-visible:border-slate-600 focus:ring-0 focus:outline-none transition-colors dark:text-slate-100"
          placeholder="輸入標題…"
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          className="w-full text-base max-sm:text-base text-slate-600 dark:text-slate-300 bg-transparent border border-transparent rounded-md px-2 py-2 max-sm:py-2.5 -mx-2 max-sm:mx-0 focus-visible:border-slate-300 dark:focus-visible:border-slate-600 focus:ring-0 focus:outline-none transition-colors resize-none"
          placeholder="新增描述…"
        />
      </div>

      {/* ================================================================= */}
      {/* Zone B: Property Rows */}
      {/* ================================================================= */}
      <div className="border-t border-slate-100 dark:border-slate-700 py-1 mt-3">
        {/* Priority */}
        <div className="flex items-center min-h-[44px] px-4 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 -mx-4">
          <span className="w-20 text-sm text-slate-500 dark:text-slate-400 shrink-0">優先度</span>
          <div className="flex-1 min-w-0">
            <Select value={priority} onValueChange={(v) => setPriority(v as Card['priority'])}>
              <SelectTrigger className="w-auto h-9 max-sm:h-10 border-0 shadow-none px-2 hover:bg-slate-100 dark:hover:bg-slate-700 focus:ring-0">
                <SelectValue>
                  <span className="flex items-center gap-1.5">
                    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${PRIORITY_COLORS[priority]}`} />
                    <span className="text-sm">{PRIORITY_LABELS[priority]}</span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(['high', 'medium', 'low'] as const).map(level => (
                  <SelectItem key={level} value={level}>
                    <span className="flex items-center gap-1.5">
                      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${PRIORITY_COLORS[level]}`} />
                      <span>{PRIORITY_LABELS[level]}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Assignee */}
        <div className="flex items-center min-h-[44px] px-4 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 -mx-4">
          <span className="w-20 text-sm text-slate-500 dark:text-slate-400 shrink-0">指派人</span>
          <div className="flex-1 min-w-0">
            <AssigneeCombobox users={activeUsers} value={assigneeId} onChange={setAssigneeId} />
          </div>
        </div>

        {/* Phase */}
        <div className="flex items-center min-h-[44px] px-4 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 -mx-4">
          <span className="w-20 text-sm text-slate-500 dark:text-slate-400 shrink-0">階段</span>
          <div className="flex-1 min-w-0">
            <Select value={phaseId || '__none__'} onValueChange={(v) => setPhaseId(v === '__none__' ? null : v)}>
              <SelectTrigger className="w-auto h-9 max-sm:h-10 border-0 shadow-none px-2 hover:bg-slate-100 dark:hover:bg-slate-700 focus:ring-0">
                <SelectValue>
                  <span className="flex items-center gap-1.5">
                    {phaseId && phases.find(p => p.id === phaseId) ? (
                      <>
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: phases.find(p => p.id === phaseId)?.color }}
                        />
                        <span className="text-sm">{phases.find(p => p.id === phaseId)?.name}</span>
                      </>
                    ) : (
                      <span className="text-sm text-slate-400 dark:text-slate-500">無階段</span>
                    )}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-slate-400">無階段</span>
                </SelectItem>
                {phases.map(phase => (
                  <SelectItem key={phase.id} value={phase.id}>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: phase.color }} />
                      <span>{phase.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Due date (read-only display, click to expand Zone C) */}
        <div
          className="flex items-center min-h-[44px] px-4 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 -mx-4 cursor-pointer"
          onClick={() => setScheduleExpanded(true)}
        >
          <span className="w-20 text-sm text-slate-500 dark:text-slate-400 shrink-0">截止日</span>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {dueDateDisplay ? (
              <>
                <span
                  className={`text-sm ${dueDateDisplay.isDerived
                    ? 'text-slate-400 dark:text-slate-500 border-b border-dashed border-slate-300 dark:border-slate-600'
                    : 'text-slate-700 dark:text-slate-200'}`}
                  title={dueDateDisplay.isDerived ? '衍生自子任務截止日' : undefined}
                >
                  {dueDateDisplay.isDerived && '↑ '}
                  {dueDateDisplay.dateText}
                </span>
                {dueDateDisplay.badge && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${dueDateDisplay.isDerived
                    ? 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-dashed border-slate-300 dark:border-slate-600'
                    : dueDateDisplay.badge.className}`}>
                    {dueDateDisplay.badge.text}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-slate-400 dark:text-slate-500">+ 設定截止日</span>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Zone C: Schedule (collapsible) */}
      {/* ================================================================= */}
      <div className="border-t border-slate-100 dark:border-slate-700">
        {/* Header row */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5">日程安排</span>
          <button
            type="button"
            onClick={() => setScheduleExpanded((prev: boolean) => !prev)}
            className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-500 transition-colors px-1"
          >
            {scheduleExpanded ? '收合' : '展開'}
          </button>
        </div>

        {/* Collapsed summary */}
        {!scheduleExpanded && (
          <div className="pb-2">
            {collapsedDisplay ? (
              <button
                type="button"
                onClick={() => setScheduleExpanded(true)}
                className={`text-sm font-medium ${collapsedDisplay.color} hover:opacity-80 transition-opacity text-left`}
              >
                {collapsedDisplay.icon} {collapsedDisplay.text}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setScheduleExpanded(true)}
                className="text-sm text-slate-400 dark:text-slate-500 hover:text-blue-500 transition-colors"
              >
                + 設定日期
              </button>
            )}
          </div>
        )}

        {/* Expanded: date fields + timeline */}
        {scheduleExpanded && (
          <div className="space-y-1 pb-3">
            {/* Start date */}
            <div className="flex items-center justify-between group min-h-[28px]">
              <span className="text-sm text-slate-500 w-20 shrink-0">開始日</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {editingDate === 'start' ? (
                  <DateInput value={startDate} onChange={setStartDate} onBlur={() => setEditingDate(null)} className="flex-1" autoFocus />
                ) : startDate ? (
                  <span
                    className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => setEditingDate('start')}
                    title="點擊編輯"
                  >
                    {new Date(startDate + 'T00:00:00').toLocaleDateString('zh-TW')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDate('start')}
                    className="flex-1 text-sm text-slate-400 dark:text-slate-500 hover:text-blue-500 text-left transition-colors"
                  >
                    + 設定開始日
                  </button>
                )}
                {startDate && editingDate !== 'start' && (
                  <button
                    type="button"
                    onClick={() => { setStartDate(''); setEditingDate(null) }}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 text-xs transition-opacity"
                    title="清除"
                  >✕</button>
                )}
              </div>
            </div>

            {/* Due date */}
            <div className="flex items-center justify-between group min-h-[28px]">
              <span className="text-sm text-slate-500 w-20 shrink-0">截止日</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {editingDate === 'due' ? (
                  <DateInput value={dueDate} onChange={setDueDate} onBlur={() => setEditingDate(null)} className="flex-1" autoFocus />
                ) : dueDate ? (
                  <span
                    className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => setEditingDate('due')}
                    title="點擊編輯"
                  >
                    {new Date(dueDate + 'T00:00:00').toLocaleDateString('zh-TW')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDate('due')}
                    className="flex-1 text-sm text-slate-400 dark:text-slate-500 hover:text-blue-500 text-left transition-colors"
                  >
                    + 設定截止日
                  </button>
                )}
                {dueDate && editingDate !== 'due' && (
                  <button
                    type="button"
                    onClick={() => { setDueDate(''); setEditingDate(null) }}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 text-xs transition-opacity"
                    title="清除"
                  >✕</button>
                )}
              </div>
            </div>

            {/* Recurrence selector */}
            <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
              <RecurrenceSelector value={recurrenceRule} onChange={setRecurrenceRule} />
            </div>

            {/* Completion tracking divider */}
            <div className="text-xs font-medium text-slate-400 dark:text-slate-500 tracking-wide pt-2 pb-1 border-t border-slate-200 dark:border-slate-700 mt-2">完成追蹤</div>

            {/* Actual completion */}
            <div className="flex items-center justify-between group min-h-[28px]">
              <span className="text-sm text-slate-500 w-20 shrink-0">實際完成</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {editingDate === 'actual' ? (
                  <DateInput value={actualDate} onChange={setActualDate} onBlur={() => setEditingDate(null)} className="flex-1" autoFocus />
                ) : actualDate ? (
                  <span
                    className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => setEditingDate('actual')}
                    title="點擊編輯"
                  >
                    {new Date(actualDate + 'T00:00:00').toLocaleDateString('zh-TW')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDate('actual')}
                    className="flex-1 text-sm text-slate-400 dark:text-slate-500 hover:text-blue-500 text-left transition-colors"
                  >
                    + 設定日期
                  </button>
                )}
                {actualDate && editingDate !== 'actual' && (
                  <button
                    type="button"
                    onClick={() => { setActualDate(''); setEditingDate(null) }}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 text-xs transition-opacity"
                    title="清除"
                  >✕</button>
                )}
              </div>
            </div>

            {/* Timeline bar */}
            <ScheduleTimelineBar
              dueDate={dueDate}
              plannedDate={plannedDate}
              actualDate={actualDate}
              createdAt={cardCreatedAt}
            />

            {/* Dynamic summary */}
            {scheduleSummary && (
              <div className={`text-xs font-medium mt-1 ${
                scheduleSummary.includes('延遲') || scheduleSummary.includes('超過') ? 'text-red-500' :
                scheduleSummary.includes('提前') ? 'text-green-600' : 'text-slate-500'
              }`}>
                {scheduleSummary.includes('延遲') || scheduleSummary.includes('超過') ? '⚠️' :
                 scheduleSummary.includes('提前') ? '✅' :
                 scheduleSummary.includes('剛好') ? '✅' : '🕐'} {scheduleSummary}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* Zone D: Subtasks */}
      {/* ================================================================= */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
        <SubtaskChecklist
          cardId={card.id}
          subtasks={cardSubtasks}
          onSubtasksChange={setCardSubtasks}
          activeUsers={activeUsers}
          cardDueDate={dueDate}
          onBoardUpdate={onUpdate}
        />
      </div>

      {/* ================================================================= */}
      {/* Zone E: Activity Log */}
      {/* ================================================================= */}
      <div className="border-t border-slate-100 dark:border-slate-700 pt-3 mt-3">
        <details className="group">
          <summary className="text-sm font-medium cursor-pointer select-none list-none flex items-center gap-1">
            <svg className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            活動紀錄{activity.length > 0 && <span className="text-xs text-slate-400 ml-1">({activity.length})</span>}
          </summary>
          <div className="space-y-2 max-h-40 overflow-y-auto mt-2">
            {activity.length === 0 ? (
              <p className="text-sm text-slate-400">尚無活動紀錄</p>
            ) : (
              activity.map((log) => (
                <div key={log.id} className="text-xs border-l-2 border-slate-200 dark:border-slate-700 pl-2 py-1">
                  <span className="font-medium text-slate-700 dark:text-slate-200">{translateAction(log.action)}</span>
                  <span className="text-slate-500 dark:text-slate-400"> {log.target}</span>
                  {log.old_value && log.new_value && log.old_value !== log.new_value ? (
                    <span className="text-slate-500 dark:text-slate-400"> {log.old_value} → {log.new_value}</span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400"> {log.new_value}</span>
                  )}
                  <span className="text-slate-400 text-xs block mt-0.5">
                    {new Date(log.created_at).toLocaleString('zh-TW')}
                  </span>
                </div>
              ))
            )}
          </div>
        </details>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CardModal — thin container (~35 lines)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DeleteConfirmDialog
// ---------------------------------------------------------------------------

function DeleteConfirmDialog({ cardTitle, isDeleting, onConfirm, onCancel }: {
  cardTitle: string
  isDeleting: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">刪除卡片</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
          確定要刪除「{cardTitle}」嗎？所有子任務、留言、活動記錄都會一併刪除，此操作無法復原。
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={isDeleting} className="px-4 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 min-h-[40px] dark:text-slate-200">
            取消
          </button>
          <button onClick={onConfirm} disabled={isDeleting} className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 min-h-[40px]">
            {isDeleting ? '刪除中...' : '確認刪除'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RecurrenceSelector — inline recurrence rule editor
// ---------------------------------------------------------------------------

function RecurrenceSelector({
  value,
  onChange
}: {
  value: RecurrenceRule | null
  onChange: (rule: RecurrenceRule | null) => void
}) {
  const enabled = value !== null

  const handleToggle = () => {
    if (enabled) {
      onChange(null)
    } else {
      onChange({ frequency: 'monthly', auto_suffix: true })
    }
  }

  const handleFrequencyChange = (freq: RecurrenceRule['frequency']) => {
    const base: RecurrenceRule = { frequency: freq, auto_suffix: value?.auto_suffix ?? true }
    if (freq === 'weekly') base.day_of_week = new Date().getDay()
    if (freq === 'monthly') base.day_of_month = new Date().getDate()
    if (freq === 'yearly') {
      base.month_of_year = new Date().getMonth() + 1
      base.day_of_month = new Date().getDate()
    }
    onChange(base)
  }

  const dayNames = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleToggle}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            enabled ? 'bg-blue-600' : 'bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-4.5' : 'translate-x-0.5'
            }`}
          />
        </button>
        <div className="flex items-center gap-1.5 text-sm text-gray-300">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          重複
        </div>
      </div>

      {enabled && value && (
        <div className="pl-2 space-y-2 border-l-2 border-blue-600/30">
          {/* 頻率選擇 */}
          <div className="flex gap-1.5 flex-wrap">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map(freq => (
              <button
                key={freq}
                type="button"
                onClick={() => handleFrequencyChange(freq)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  value.frequency === freq
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {{ daily: '每日', weekly: '每週', monthly: '每月', yearly: '每年' }[freq]}
              </button>
            ))}
          </div>

          {/* 週幾選擇 */}
          {value.frequency === 'weekly' && (
            <div className="flex gap-1">
              {dayNames.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onChange({ ...value, day_of_week: i })}
                  className={`w-7 h-7 text-xs rounded-md transition-colors ${
                    value.day_of_week === i
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* 幾號選擇 */}
          {value.frequency === 'monthly' && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <span>每月</span>
              <select
                value={value.day_of_month || 1}
                onChange={e => onChange({ ...value, day_of_month: Number(e.target.value) })}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
              >
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <span>號</span>
            </div>
          )}

          {/* 每年：月+日 */}
          {value.frequency === 'yearly' && (
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <span>每年</span>
              <select
                value={value.month_of_year || 1}
                onChange={e => onChange({ ...value, month_of_year: Number(e.target.value) })}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1} 月</option>
                ))}
              </select>
              <select
                value={value.day_of_month || 1}
                onChange={e => onChange({ ...value, day_of_month: Number(e.target.value) })}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white"
              >
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{i + 1}</option>
                ))}
              </select>
              <span>號</span>
            </div>
          )}

          {/* 自動後綴 */}
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={value.auto_suffix !== false}
              onChange={e => onChange({ ...value, auto_suffix: e.target.checked })}
              className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            自動在標題加上日期後綴
          </label>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CardModal — thin container (~40 lines)
// ---------------------------------------------------------------------------

export function CardModal({ card, phases, onClose, onUpdate }: CardDetailProps) {
  const { data: session } = useSession()
  const detail = useCardDetail(card.id, onClose, onUpdate)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { detail.handleCancel() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [detail.handleCancel])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 max-sm:p-0" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-xl max-sm:rounded-none w-full max-w-lg max-h-[90vh] max-sm:max-h-full max-sm:h-full flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3 max-sm:px-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-mono text-slate-400 dark:text-slate-500">
              {card?.card_number != null ? `#${card.card_number}` : '卡片詳情'}
            </span>
            {session?.user?.role === 'admin' && card?.id && (
              <UuidDisplay uuid={card.id} label="ID" />
            )}
          </div>
          <button onClick={onClose} aria-label="關閉" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {!detail.isFormReady ? (
          <div className="p-8 text-center text-slate-400 dark:text-slate-500">載入中…</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <CardDetailContent card={card} phases={phases} detail={detail} />
            </div>
            <div className="px-5 py-3 max-sm:px-4 max-sm:py-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={detail.archiveCard}
                  disabled={detail.isArchiving}
                  className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg min-h-[44px] flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                  title="封存卡片"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                  封存
                </button>
                <button
                  onClick={() => detail.setShowDeleteConfirm(true)}
                  className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg min-h-[44px] flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  刪除
                </button>
              </div>
              <div className="flex gap-2">
                <button onClick={detail.handleCancel} className="px-4 py-2.5 max-sm:py-3 text-sm max-sm:text-base border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px] dark:text-slate-200">取消</button>
                <button onClick={detail.saveCard} disabled={detail.isSaving} className="px-4 py-2.5 max-sm:py-3 text-sm max-sm:text-base bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 min-h-[44px]">
                  {detail.isSaving ? '儲存中…' : '儲存'}
                </button>
              </div>
            </div>
            {detail.showDeleteConfirm && (
              <DeleteConfirmDialog
                cardTitle={detail.title || card.title}
                isDeleting={detail.isDeleting}
                onConfirm={detail.deleteCard}
                onCancel={() => detail.setShowDeleteConfirm(false)}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SlideInPane — thin container (~50 lines)
// ---------------------------------------------------------------------------

export function SlideInPane({ card, phases, onClose, onUpdate }: CardDetailProps) {
  const [isVisible, setIsVisible] = useState(false)

  // Slide-in animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  // Close with slide-out animation
  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => onClose(), 300)
  }, [onClose])

  const detail = useCardDetail(card.id, handleClose, onUpdate)

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { detail.handleCancel() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [detail.handleCancel])

  return (
    <div
      className={`fixed top-0 right-0 h-full w-[420px] max-md:w-full max-md:inset-0 z-50 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-700 flex flex-col transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-x-0' : 'translate-x-full max-md:translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="px-5 py-3 max-sm:px-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
        <span className="text-sm font-mono text-slate-400 dark:text-slate-500">
          {card?.card_number != null ? `#${card.card_number}` : '卡片詳情'}
        </span>
        <button onClick={handleClose} aria-label="關閉" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Content */}
      {!detail.isFormReady ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500">載入中…</div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <CardDetailContent card={card} phases={phases} detail={detail} />
          </div>
          <div className="px-5 py-3 max-sm:px-4 max-sm:py-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={detail.archiveCard}
                disabled={detail.isArchiving}
                className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg min-h-[44px] flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                title="封存卡片"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                封存
              </button>
              <button
                onClick={() => detail.setShowDeleteConfirm(true)}
                className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg min-h-[44px] flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                刪除
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={detail.handleCancel} className="px-4 py-2.5 max-sm:py-3 text-sm max-sm:text-base border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px] dark:text-slate-200">取消</button>
              <button onClick={detail.saveCard} disabled={detail.isSaving} className="px-4 py-2.5 max-sm:py-3 text-sm max-sm:text-base bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 min-h-[44px]">
                {detail.isSaving ? '儲存中…' : '儲存'}
              </button>
            </div>
          </div>
          {detail.showDeleteConfirm && (
            <DeleteConfirmDialog
              cardTitle={detail.title || card.title}
              isDeleting={detail.isDeleting}
              onConfirm={detail.deleteCard}
              onCancel={() => detail.setShowDeleteConfirm(false)}
            />
          )}
        </>
      )}
    </div>
  )
}
