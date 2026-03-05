'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateInput } from '@/components/ui/DateInput'
import { AssigneeCombobox } from '@/components/ui/AssigneeCombobox'
import type { Card, Phase, Subtask, ActivityLog, CardDetailProps, ActiveUser } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_COLORS: Record<Card['priority'], string> = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
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
  return dateStr.split('T')[0]
}

function isOverdue(dateStr: string): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return new Date(toDateOnly(dateStr) + 'T00:00:00') < today
}

function isDueSoon(dateStr: string): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = (new Date(toDateOnly(dateStr) + 'T00:00:00').getTime() - today.getTime()) / 86400000
  return diff >= 0 && diff <= 2
}

function formatShortDate(dateStr: string): string {
  const d = new Date(toDateOnly(dateStr) + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function getScheduleSummary(dueDate: string, plannedDate: string, actualDate: string): string | null {
  if (!dueDate) return null
  const due = new Date(dueDate.split('T')[0] + 'T00:00:00')

  if (actualDate) {
    const actual = new Date(actualDate.split('T')[0] + 'T00:00:00')
    const diffMs = due.getTime() - actual.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays > 0) return `比截止日提前 ${diffDays} 天完成`
    if (diffDays < 0) return `比截止日延遲 ${Math.abs(diffDays)} 天完成`
    return '剛好在截止日完成'
  }

  if (plannedDate) {
    const planned = new Date(plannedDate.split('T')[0] + 'T00:00:00')
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
    if (left > 0) return { text: `${fmtShort(start)} → ${fmtShort(due)}（剩 ${left} 天）`, icon: '🕐', color: 'text-slate-600' }
    if (left < 0) return { text: `${fmtShort(start)} → ${fmtShort(due)}（已超過 ${Math.abs(left)} 天）`, icon: '⚠️', color: 'text-red-500' }
    return { text: `${fmtShort(start)} → ${fmtShort(due)}（今天截止）`, icon: '🕐', color: 'text-amber-600' }
  }
  if (dueDate) {
    const due = new Date(dueDate + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const left = Math.round((due.getTime() - today.getTime()) / 86400000)
    if (left > 0) return { text: `${fmtShort(due)} 截止（剩 ${left} 天）`, icon: '🕐', color: 'text-slate-600' }
    if (left < 0) return { text: `${fmtShort(due)} 截止（已超過 ${Math.abs(left)} 天）`, icon: '⚠️', color: 'text-red-500' }
    return { text: `今天截止（${fmtShort(due)}）`, icon: '🕐', color: 'text-amber-600' }
  }
  if (startDate) {
    const start = new Date(startDate + 'T00:00:00')
    return { text: `${fmtShort(start)} 開始`, icon: '📅', color: 'text-slate-500' }
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
  const dueDateParsed = dueDate ? new Date(dueDate.split('T')[0] + 'T00:00:00') : null
  const plannedParsed = plannedDate ? new Date(plannedDate.split('T')[0] + 'T00:00:00') : null
  const actualParsed = actualDate ? new Date(actualDate.split('T')[0] + 'T00:00:00') : null
  const createdParsed = createdAt ? new Date(createdAt.split('T')[0] + 'T00:00:00') : null

  if (dueDateParsed) dates.push({ label: '截止', value: dueDateParsed })
  if (plannedParsed) dates.push({ label: '預計', value: plannedParsed })
  if (actualParsed) dates.push({ label: '實際', value: actualParsed })
  if (createdParsed) dates.push({ label: '建立', value: createdParsed })

  if (dates.length < 2) {
    return (
      <div className="text-xs text-slate-400 mt-2">需要至少 2 個日期才能顯示時間軸</div>
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
        color: '#60A5FA',
      })
      segments.push({
        left: toPercent(actualParsed),
        width: toPercent(dueDateParsed) - toPercent(actualParsed),
        color: '#34D399',
      })
    } else {
      segments.push({
        left: toPercent(startTime),
        width: toPercent(dueDateParsed) - toPercent(startTime),
        color: '#60A5FA',
      })
      segments.push({
        left: toPercent(dueDateParsed),
        width: toPercent(actualParsed) - toPercent(dueDateParsed),
        color: '#F87171',
      })
    }
  } else if (plannedParsed) {
    const endPoint = plannedParsed
    segments.push({
      left: toPercent(startTime),
      width: Math.min(toPercent(today), toPercent(endPoint)) - toPercent(startTime),
      color: '#60A5FA',
    })
    if (today < endPoint) {
      segments.push({
        left: toPercent(today),
        width: toPercent(endPoint) - toPercent(today),
        color: '#E2E8F0',
      })
    }
  } else if (dueDateParsed) {
    segments.push({
      left: toPercent(startTime),
      width: Math.min(toPercent(today), toPercent(dueDateParsed)) - toPercent(startTime),
      color: '#60A5FA',
    })
    if (today < dueDateParsed) {
      segments.push({
        left: toPercent(today),
        width: toPercent(dueDateParsed) - toPercent(today),
        color: '#E2E8F0',
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
      <div className="relative h-4 text-[10px] text-slate-500 mb-1">
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
      <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="absolute top-0 h-full"
            style={{
              left: `${seg.left}%`,
              width: `${Math.max(seg.width, 0.5)}%`,
              backgroundColor: seg.color,
              borderRadius: i === 0 ? '9999px 0 0 9999px' : i === segments.length - 1 ? '0 9999px 9999px 0' : '0',
            }}
          />
        ))}
        {/* Due date dashed marker */}
        {dueDateParsed && (
          <div
            className="absolute top-0 h-full border-l-2 border-dashed border-slate-500"
            style={{ left: `${toPercent(dueDateParsed)}%` }}
          />
        )}
      </div>
      {/* Legend labels */}
      <div className="relative h-4 text-[10px] text-slate-400 mt-0.5">
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

function SubtaskChecklist({ cardId, subtasks: initialSubtasks, onSubtasksChange, activeUsers }: {
  cardId: string
  subtasks: Subtask[]
  onSubtasksChange: (subtasks: Subtask[]) => void
  activeUsers: { id: string; name: string }[]
}) {
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks || [])
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newAssigneeId, setNewAssigneeId] = useState('')
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const updateSubtaskField = async (subtaskId: string, field: 'due_date' | 'assignee_id', value: string) => {
    const updated = subtasks.map(s => {
      if (s.id !== subtaskId) return s
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
      }
    } catch {
      setSubtasks(subtasks)
      onSubtasksChange(subtasks)
    }
  }

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

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
    }
  }

  const deleteSubtask = async (id: string) => {
    const newSubtasks = subtasks.filter(s => s.id !== id)
    setSubtasks(newSubtasks)
    onSubtasksChange(newSubtasks)

    try {
      const res = await fetch(`/api/cards/${cardId}/subtasks?id=${id}`, {
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
        <span className="text-sm font-medium text-slate-700">子任務</span>
        {totalCount > 0 && (
          <span className="text-xs text-slate-400">{completedCount}/{totalCount}</span>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-2">
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPercent}%`,
                backgroundColor: progressPercent === 100 ? '#10B981' : '#3B82F6'
              }}
            />
          </div>
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-0.5 mb-2">
        {subtasks.map(subtask => (
          <div key={subtask.id}>
            <div
              className="flex items-center gap-2 group py-1 px-1 rounded hover:bg-slate-50"
              onMouseEnter={() => setHoveredId(subtask.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <input
                type="checkbox"
                checked={subtask.is_completed}
                onChange={() => toggleSubtask(subtask)}
                className="w-4 h-4 rounded border-slate-300 text-blue-500 cursor-pointer"
              />
              <span
                className={`flex-1 text-sm cursor-pointer ${subtask.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}
                onClick={() => setEditingSubtaskId(editingSubtaskId === subtask.id ? null : subtask.id)}
              >
                {subtask.title}
              </span>
              {/* Due date badge */}
              {subtask.due_date && (
                <span className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap ${
                  subtask.is_completed ? 'bg-slate-100 text-slate-400' :
                  isOverdue(subtask.due_date) ? 'bg-red-100 text-red-600' :
                  isDueSoon(subtask.due_date) ? 'bg-amber-100 text-amber-600' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {formatShortDate(subtask.due_date)}
                </span>
              )}
              {/* Assignee name */}
              {subtask.assignee_name && (
                <span className={`text-xs whitespace-nowrap ${subtask.is_completed ? 'text-slate-400' : 'text-slate-500'}`}>
                  {subtask.assignee_name}
                </span>
              )}
              {hoveredId === subtask.id && (
                <button
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
                  className={`text-xs px-1 transition-colors ${
                    pendingDeleteId === subtask.id
                      ? 'text-red-600 font-medium'
                      : 'text-slate-400 hover:text-red-500'
                  }`}
                >
                  {pendingDeleteId === subtask.id ? '確認？' : '✕'}
                </button>
              )}
            </div>
            {/* Inline edit for due_date and assignee */}
            {editingSubtaskId === subtask.id && (
              <div className="flex items-center gap-3 pl-7 py-1 text-xs">
                <label className="flex items-center gap-1 text-slate-500">
                  截止
                  <input type="date" value={subtask.due_date ? toDateOnly(subtask.due_date) : ''}
                    onChange={e => updateSubtaskField(subtask.id, 'due_date', e.target.value)}
                    className="border rounded px-1.5 py-0.5 text-xs" />
                </label>
                <label className="flex items-center gap-1 text-slate-500">
                  負責人
                  <select value={subtask.assignee_id || ''}
                    onChange={e => updateSubtaskField(subtask.id, 'assignee_id', e.target.value)}
                    className="border rounded px-1.5 py-0.5 text-xs">
                    <option value="">--</option>
                    {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add subtask */}
      <form onSubmit={addSubtask} className="flex gap-2">
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="新增子任務..."
          className="flex-1 text-sm border rounded px-2 py-1.5"
        />
        <button
          type="submit"
          className="text-sm px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded"
        >
          +
        </button>
      </form>
      {/* Optional fields for new subtask */}
      {newTitle.trim() && (
        <div className="flex items-center gap-3 pl-1 pt-1 text-xs text-slate-500">
          <label className="flex items-center gap-1">
            截止
            <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
              className="border rounded px-1.5 py-0.5 text-xs" />
          </label>
          <label className="flex items-center gap-1">
            負責人
            <select value={newAssigneeId} onChange={e => setNewAssigneeId(e.target.value)}
              className="border rounded px-1.5 py-0.5 text-xs">
              <option value="">--</option>
              {activeUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
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
  // Computed
  scheduleSummary: string | null
  collapsedDisplay: { text: string; icon: string; color: string } | null
}

function useCardDetail(cardId: string, onCloseFn: () => void, onUpdate: () => void): UseCardDetailReturn {
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

  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [scheduleExpanded, setScheduleExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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
        startDate: cardData.start_date ? cardData.start_date.split('T')[0] : '',
        dueDate: cardData.due_date ? cardData.due_date.split('T')[0] : '',
        plannedDate: cardData.planned_completion_date ? cardData.planned_completion_date.split('T')[0] : '',
        actualDate: cardData.actual_completion_date ? cardData.actual_completion_date.split('T')[0] : '',
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
      setIsFormReady(true)
    }).catch(err => {
      console.error('載入卡片錯誤:', err)
      if (!cancelled) {
        alert('無法載入卡片資料，請重新整理頁面')
        onCloseFn()
      }
    })

    return () => { cancelled = true }
  }, [cardId, onCloseFn])

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
      }
      console.log('[saveCard] payload:', JSON.stringify(payload))
      const res = await fetch('/api/cards/' + cardId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (res.ok) {
        onCloseFn()
        onUpdate()
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
  }, [isSaving, title, description, assigneeId, startDate, dueDate, plannedDate, actualDate, priority, phaseId, cardId, onCloseFn, onUpdate])

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
    editingDate, setEditingDate,
    scheduleExpanded, setScheduleExpanded,
    isSaving,
    isFormReady,
    saveCard,
    handleCancel,
    scheduleSummary,
    collapsedDisplay,
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
    editingDate, setEditingDate,
    scheduleExpanded, setScheduleExpanded,
    scheduleSummary,
    collapsedDisplay,
  } = detail

  // Compute due date display for Zone B
  const dueDateDisplay = useMemo(() => {
    if (!dueDate) return null
    const due = new Date(dueDate + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000)
    const dateText = due.toLocaleDateString('zh-TW')
    let badge: { text: string; className: string } | null = null
    if (actualDate) {
      // Already completed — no urgency badge
    } else if (diffDays < 0) {
      badge = { text: `逾期 ${Math.abs(diffDays)} 天`, className: 'bg-red-100 text-red-600' }
    } else if (diffDays === 0) {
      badge = { text: '今天截止', className: 'bg-amber-100 text-amber-600' }
    } else if (diffDays <= 3) {
      badge = { text: `剩 ${diffDays} 天`, className: 'bg-amber-50 text-amber-600' }
    } else {
      badge = { text: `剩 ${diffDays} 天`, className: 'bg-slate-100 text-slate-500' }
    }
    return { dateText, badge }
  }, [dueDate, actualDate])

  return (
    <div className="px-5 py-4">
      {/* ================================================================= */}
      {/* Zone A: Hero (Title + Description) */}
      {/* ================================================================= */}
      <div className="space-y-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full text-lg font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 -mx-2 focus:border-slate-300 focus:ring-0 focus:outline-none transition-colors"
          placeholder="輸入標題..."
        />
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          className="w-full text-sm text-slate-600 bg-transparent border border-transparent rounded-md px-2 py-1 -mx-2 focus:border-slate-300 focus:ring-0 focus:outline-none transition-colors resize-none"
          placeholder="新增描述..."
        />
      </div>

      {/* ================================================================= */}
      {/* Zone B: Property Rows */}
      {/* ================================================================= */}
      <div className="border-t border-slate-100 py-1 mt-3">
        {/* Priority */}
        <div className="flex items-center min-h-[36px] px-4 rounded-md hover:bg-slate-50 -mx-4">
          <span className="w-20 text-sm text-slate-500 shrink-0">優先度</span>
          <div className="flex-1 min-w-0">
            <Select value={priority} onValueChange={(v) => setPriority(v as Card['priority'])}>
              <SelectTrigger className="w-auto h-7 border-0 shadow-none px-2 hover:bg-slate-100 focus:ring-0">
                <SelectValue>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[priority] }} />
                    <span className="text-sm">{PRIORITY_LABELS[priority]}</span>
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(['high', 'medium', 'low'] as const).map(level => (
                  <SelectItem key={level} value={level}>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_COLORS[level] }} />
                      <span>{PRIORITY_LABELS[level]}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Assignee */}
        <div className="flex items-center min-h-[36px] px-4 rounded-md hover:bg-slate-50 -mx-4">
          <span className="w-20 text-sm text-slate-500 shrink-0">指派人</span>
          <div className="flex-1 min-w-0">
            <AssigneeCombobox users={activeUsers} value={assigneeId} onChange={setAssigneeId} />
          </div>
        </div>

        {/* Phase */}
        <div className="flex items-center min-h-[36px] px-4 rounded-md hover:bg-slate-50 -mx-4">
          <span className="w-20 text-sm text-slate-500 shrink-0">階段</span>
          <div className="flex-1 min-w-0">
            <Select value={phaseId || '__none__'} onValueChange={(v) => setPhaseId(v === '__none__' ? null : v)}>
              <SelectTrigger className="w-auto h-7 border-0 shadow-none px-2 hover:bg-slate-100 focus:ring-0">
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
                      <span className="text-sm text-slate-400">無階段</span>
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
          className="flex items-center min-h-[36px] px-4 rounded-md hover:bg-slate-50 -mx-4 cursor-pointer"
          onClick={() => setScheduleExpanded(true)}
        >
          <span className="w-20 text-sm text-slate-500 shrink-0">截止日</span>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {dueDateDisplay ? (
              <>
                <span className="text-sm text-slate-700">{dueDateDisplay.dateText}</span>
                {dueDateDisplay.badge && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${dueDateDisplay.badge.className}`}>
                    {dueDateDisplay.badge.text}
                  </span>
                )}
              </>
            ) : (
              <span className="text-sm text-slate-400">+ 設定截止日</span>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Zone C: Schedule (collapsible) */}
      {/* ================================================================= */}
      <div className="border-t border-slate-100">
        {/* Header row */}
        <div className="flex items-center justify-between py-2">
          <span className="text-sm font-medium text-slate-700 flex items-center gap-1.5">日程安排</span>
          <button
            type="button"
            onClick={() => setScheduleExpanded((prev: boolean) => !prev)}
            className="text-xs text-slate-400 hover:text-blue-500 transition-colors px-1"
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
                className="text-sm text-slate-400 hover:text-blue-500 transition-colors"
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
                    className="flex-1 text-sm font-medium text-slate-800 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => setEditingDate('start')}
                    title="點擊編輯"
                  >
                    {new Date(startDate + 'T00:00:00').toLocaleDateString('zh-TW')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDate('start')}
                    className="flex-1 text-sm text-slate-400 hover:text-blue-500 text-left transition-colors"
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
                    className="flex-1 text-sm font-medium text-slate-800 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => setEditingDate('due')}
                    title="點擊編輯"
                  >
                    {new Date(dueDate + 'T00:00:00').toLocaleDateString('zh-TW')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDate('due')}
                    className="flex-1 text-sm text-slate-400 hover:text-blue-500 text-left transition-colors"
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

            {/* Completion tracking divider */}
            <div className="text-xs font-medium text-slate-400 tracking-wide pt-2 pb-1 border-t border-slate-200 mt-2">完成追蹤</div>

            {/* Actual completion */}
            <div className="flex items-center justify-between group min-h-[28px]">
              <span className="text-sm text-slate-500 w-20 shrink-0">實際完成</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                {editingDate === 'actual' ? (
                  <DateInput value={actualDate} onChange={setActualDate} onBlur={() => setEditingDate(null)} className="flex-1" autoFocus />
                ) : actualDate ? (
                  <span
                    className="flex-1 text-sm font-medium text-slate-800 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => setEditingDate('actual')}
                    title="點擊編輯"
                  >
                    {new Date(actualDate + 'T00:00:00').toLocaleDateString('zh-TW')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDate('actual')}
                    className="flex-1 text-sm text-slate-400 hover:text-blue-500 text-left transition-colors"
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
      <div className="border-t border-slate-100 pt-3">
        <SubtaskChecklist
          cardId={card.id}
          subtasks={cardSubtasks}
          onSubtasksChange={setCardSubtasks}
          activeUsers={activeUsers}
        />
      </div>

      {/* ================================================================= */}
      {/* Zone E: Activity Log */}
      {/* ================================================================= */}
      <div className="border-t border-slate-100 pt-3 mt-3">
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
                <div key={log.id} className="text-xs border-l-2 border-slate-200 pl-2 py-1">
                  <span className="font-medium text-slate-700">{translateAction(log.action)}</span>
                  <span className="text-slate-500"> {log.target}</span>
                  {log.old_value && log.new_value && log.old_value !== log.new_value ? (
                    <span className="text-slate-500"> {log.old_value} → {log.new_value}</span>
                  ) : (
                    <span className="text-slate-500"> {log.new_value}</span>
                  )}
                  <span className="text-slate-400 text-[11px] block mt-0.5">
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

export function CardModal({ card, phases, onClose, onUpdate }: CardDetailProps) {
  const detail = useCardDetail(card.id, onClose, onUpdate)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { detail.handleCancel() }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [detail.handleCancel])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
          <span className="text-sm font-mono text-slate-400">
            {card?.card_number != null ? `#${card.card_number}` : '卡片詳情'}
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        {!detail.isFormReady ? (
          <div className="p-8 text-center text-slate-400">載入中...</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <CardDetailContent card={card} phases={phases} detail={detail} />
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 flex-shrink-0">
              <button onClick={detail.handleCancel} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">取消</button>
              <button onClick={detail.saveCard} disabled={detail.isSaving} className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                {detail.isSaving ? '儲存中...' : '儲存'}
              </button>
            </div>
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
      className={`fixed top-0 right-0 h-full w-[420px] max-lg:w-full max-lg:inset-0 z-50 bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-x-0' : 'translate-x-full max-lg:translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center flex-shrink-0">
        <span className="text-sm font-mono text-slate-400">
          {card?.card_number != null ? `#${card.card_number}` : '卡片詳情'}
        </span>
        <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Content */}
      {!detail.isFormReady ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">載入中...</div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <CardDetailContent card={card} phases={phases} detail={detail} />
          </div>
          <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 flex-shrink-0">
            <button onClick={detail.handleCancel} className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">取消</button>
            <button onClick={detail.saveCard} disabled={detail.isSaving} className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
              {detail.isSaving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
