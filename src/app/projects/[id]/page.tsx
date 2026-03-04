'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import Link from 'next/link'
import UserNav from '@/components/UserNav'
import { ListView, CalendarView, ProgressView } from './views'
import { GanttView } from './gantt'
import type { Card, Column, Project, ViewType, Phase } from './types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DateInput } from '@/components/ui/DateInput'
import { AssigneeCombobox } from '@/components/ui/AssigneeCombobox'

// Priority color mapping
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

// Activity action 中文對照
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

// Mini Timeline Bar for CardItem (4px, hover → 8px)
// Kept for potential reuse in Gantt/other views — currently unused in Board CardItem
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function MiniTimelineBar({ card }: { card: Card }) {
  const dueDate = card.due_date ? new Date(card.due_date.split('T')[0] + 'T00:00:00') : null
  const plannedDate = card.planned_completion_date ? new Date(card.planned_completion_date.split('T')[0] + 'T00:00:00') : null
  const actualDate = card.actual_completion_date ? new Date(card.actual_completion_date.split('T')[0] + 'T00:00:00') : null

  // Need at least 2 dates to display
  const dateCount = [dueDate, plannedDate, actualDate].filter(Boolean).length
  if (dateCount < 2) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const allDates = [dueDate, plannedDate, actualDate, today].filter((d): d is Date => d !== null)
  const minTime = Math.min(...allDates.map(d => d.getTime()))
  const maxTime = Math.max(...allDates.map(d => d.getTime()))
  const range = maxTime - minTime
  if (range === 0) return null
  const toPercent = (d: Date) => ((d.getTime() - minTime) / range) * 100

  const segments: { left: number; width: number; color: string }[] = []
  const startDate = new Date(minTime)

  if (actualDate && dueDate) {
    if (actualDate <= dueDate) {
      // On time
      segments.push({ left: toPercent(startDate), width: toPercent(actualDate) - toPercent(startDate), color: '#60A5FA' })
      segments.push({ left: toPercent(actualDate), width: toPercent(dueDate) - toPercent(actualDate), color: '#34D399' })
    } else {
      // Late
      segments.push({ left: toPercent(startDate), width: toPercent(dueDate) - toPercent(startDate), color: '#60A5FA' })
      segments.push({ left: toPercent(dueDate), width: toPercent(actualDate) - toPercent(dueDate), color: '#F87171' })
    }
  } else if (plannedDate && dueDate) {
    const progressEnd = Math.min(toPercent(today), toPercent(plannedDate))
    segments.push({ left: toPercent(startDate), width: progressEnd - toPercent(startDate), color: '#60A5FA' })
    if (today < plannedDate) {
      segments.push({ left: toPercent(today), width: toPercent(plannedDate) - toPercent(today), color: '#E2E8F0' })
    }
  } else if (plannedDate && actualDate) {
    if (actualDate <= plannedDate) {
      segments.push({ left: toPercent(startDate), width: toPercent(actualDate) - toPercent(startDate), color: '#34D399' })
    } else {
      segments.push({ left: toPercent(startDate), width: toPercent(plannedDate) - toPercent(startDate), color: '#60A5FA' })
      segments.push({ left: toPercent(plannedDate), width: toPercent(actualDate) - toPercent(plannedDate), color: '#F87171' })
    }
  }

  // Build tooltip text
  const tooltipParts: string[] = []
  if (dueDate) tooltipParts.push(`截止: ${dueDate.toLocaleDateString('zh-TW')}`)
  if (plannedDate) tooltipParts.push(`預計: ${plannedDate.toLocaleDateString('zh-TW')}`)
  if (actualDate) tooltipParts.push(`實際: ${actualDate.toLocaleDateString('zh-TW')}`)

  return (
    <div
      className="mt-1.5 relative w-full h-1 hover:h-2 bg-slate-100 rounded-full overflow-hidden transition-all cursor-default"
      title={tooltipParts.join(' | ')}
    >
      {segments.map((seg, i) => (
        <div
          key={i}
          className="absolute top-0 h-full"
          style={{
            left: `${seg.left}%`,
            width: `${Math.max(seg.width, 1)}%`,
            backgroundColor: seg.color,
            borderRadius: i === 0 ? '9999px 0 0 9999px' : i === segments.length - 1 ? '0 9999px 9999px 0' : '0',
          }}
        />
      ))}
      {/* Due date dashed marker */}
      {dueDate && (
        <div
          className="absolute top-0 h-full border-l border-dashed border-slate-500"
          style={{ left: `${toPercent(dueDate)}%` }}
        />
      )}
    </div>
  )
}

// Draggable Card Component
function CardItem({ card, index, onClick, phases }: { card: Card, index: number, onClick: () => void, phases: Phase[] }) {
  const priorityColor = PRIORITY_COLORS[card.priority] || PRIORITY_COLORS.medium
  const phase = card.phase_id ? phases.find(p => p.id === card.phase_id) : null
  const completedSubtasks = card.subtasks?.filter(s => s.is_completed).length || 0
  const totalSubtasks = card.subtasks?.length || 0
  const assigneeName = card.assignees?.[0]?.name || ''
  const assigneeInitial = assigneeName ? assigneeName.charAt(0) : ''

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          className={`bg-white p-3 rounded-lg shadow-sm hover:shadow-md border-l-[3px] mb-2 cursor-pointer ${
            snapshot.isDragging ? 'shadow-lg rotate-2' : ''
          }`}
          style={{
            ...provided.draggableProps.style,
            opacity: snapshot.isDragging ? 0.9 : 1,
            borderLeftColor: priorityColor,
          }}
        >
          {/* Phase badge */}
          {phase && (
            <div className="mb-1.5">
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
                style={{ backgroundColor: phase.color }}
              >
                {phase.name}
              </span>
            </div>
          )}

          {/* Card number + Title */}
          <div className="flex items-start gap-1.5">
            {card.card_number != null && (
              <span className="text-[10px] font-mono text-slate-400 mt-[2px] flex-shrink-0">#{card.card_number}</span>
            )}
            <p className="font-medium text-sm leading-snug">{card.title}</p>
          </div>

          {/* Bottom row: assignee avatar (left) + subtask count (right) */}
          {(assigneeInitial || totalSubtasks > 0) && (
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center">
                {assigneeInitial && (
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold"
                    title={assigneeName}
                  >
                    {assigneeInitial}
                  </span>
                )}
              </div>
              <div className="flex items-center">
                {totalSubtasks > 0 && (
                  <span className={`text-xs ${completedSubtasks === totalSubtasks ? 'text-green-600' : 'text-slate-500'}`}>
                    ✓ {completedSubtasks}/{totalSubtasks}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}

// Subtask Checklist Component
function SubtaskChecklist({ cardId, subtasks: initialSubtasks, onSubtasksChange }: {
  cardId: string
  subtasks: { id: string; title: string; is_completed: boolean }[]
  onSubtasksChange: (subtasks: { id: string; title: string; is_completed: boolean }[]) => void
}) {
  const [subtasks, setSubtasks] = useState(initialSubtasks || [])
  const [newTitle, setNewTitle] = useState('')
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

  const toggleSubtask = async (subtask: { id: string; title: string; is_completed: boolean }) => {
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
        // Revert on failure
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
        body: JSON.stringify({ title: newTitle.trim() })
      })
      if (!res.ok) throw new Error('新增子任務失敗')
      const created = await res.json()
      const newSubtasks = [...subtasks, created]
      setSubtasks(newSubtasks)
      onSubtasksChange(newSubtasks)
      setNewTitle('')
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
      <label className="block text-sm font-medium mb-1">子任務</label>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>{completedCount}/{totalCount} 完成</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
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
      <div className="space-y-1 mb-2">
        {subtasks.map(subtask => (
          <div
            key={subtask.id}
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
            <span className={`flex-1 text-sm ${subtask.is_completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
              {subtask.title}
            </span>
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
    </div>
  )
}

// Schedule Timeline Bar for CardModal (large version)
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

  // Need at least 2 dates to show timeline
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

  // Build segments
  const segments: { left: number; width: number; color: string }[] = []

  const startTime = createdParsed || new Date(minTime)

  if (actualParsed && dueDateParsed) {
    // Has actual completion
    if (actualParsed <= dueDateParsed) {
      // On time: blue from start to actual, then gray to due
      segments.push({
        left: toPercent(startTime),
        width: toPercent(actualParsed) - toPercent(startTime),
        color: '#60A5FA', // blue-400
      })
      segments.push({
        left: toPercent(actualParsed),
        width: toPercent(dueDateParsed) - toPercent(actualParsed),
        color: '#34D399', // emerald-400
      })
    } else {
      // Late: blue from start to due, red from due to actual
      segments.push({
        left: toPercent(startTime),
        width: toPercent(dueDateParsed) - toPercent(startTime),
        color: '#60A5FA', // blue-400
      })
      segments.push({
        left: toPercent(dueDateParsed),
        width: toPercent(actualParsed) - toPercent(dueDateParsed),
        color: '#F87171', // red-400
      })
    }
  } else if (plannedParsed) {
    // In progress with planned date
    const endPoint = plannedParsed
    segments.push({
      left: toPercent(startTime),
      width: Math.min(toPercent(today), toPercent(endPoint)) - toPercent(startTime),
      color: '#60A5FA', // blue-400
    })
    if (today < endPoint) {
      segments.push({
        left: toPercent(today),
        width: toPercent(endPoint) - toPercent(today),
        color: '#E2E8F0', // slate-200
      })
    }
  } else if (dueDateParsed) {
    // Only due date + created
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

  // Date markers for labels
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

// Schedule summary text
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

  // Only due date - show days remaining
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays > 0) return `距離截止日還有 ${diffDays} 天`
  if (diffDays < 0) return `已超過截止日 ${Math.abs(diffDays)} 天`
  return '今天是截止日'
}

// Collapsed schedule display for smart summary
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

function CardModal({ card, phases, onClose, onUpdate }: { card: Card, phases: Phase[], onClose: () => void, onUpdate: () => void }) {
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
  const [activeUsers, setActiveUsers] = useState<{id: string; name: string; avatar_url: string | null}[]>([])
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [actualDate, setActualDate] = useState('')
  const [cardCreatedAt, setCardCreatedAt] = useState<string | undefined>(undefined)
  const [priority, setPriority] = useState<Card['priority']>('medium')
  const [phaseId, setPhaseId] = useState<string | null>(null)
  const [activity, setActivity] = useState<{ id: string; action: string; target: string; old_value: string; new_value: string; created_at: string }[]>([])
  const [cardSubtasks, setCardSubtasks] = useState<{ id: string; title: string; is_completed: boolean }[]>([])

  // Date editing state
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [scheduleExpanded, setScheduleExpanded] = useState(false)

  const [isSaving, setIsSaving] = useState(false)

  // Fetch active users for assignee dropdown
  useEffect(() => {
    fetch('/api/users/active').then(r => r.json()).then(data => {
      if (data.users) setActiveUsers(data.users)
    }).catch(console.error)
  }, [])

  // Fetch card data and activity on mount - populate form only after fetch completes
  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch('/api/cards/' + card.id).then(res => {
        if (!res.ok) throw new Error('無法載入卡片資料')
        return res.json()
      }),
      fetch('/api/cards/' + card.id + '/activity').then(res => {
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
        onClose()
      }
    })

    return () => { cancelled = true }
  }, [card.id])

  // Unified save - save and close modal
  const saveCard = async () => {
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
      const res = await fetch('/api/cards/' + card.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (res.ok) {
        // Close modal first, then refresh board data in background
        onClose()
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
  }

  // Cancel - restore and close
  const handleCancel = () => {
    setTitle(originalData.title)
    setDescription(originalData.description)
    setAssigneeId(originalData.assigneeId)
    setStartDate(originalData.startDate)
    setDueDate(originalData.dueDate)
    setPlannedDate(originalData.plannedDate)
    setActualDate(originalData.actualDate)
    setPriority(originalData.priority)
    setPhaseId(originalData.phase_id)
    onClose()
  }

  // ESC 鍵關閉 Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleCancel])

  const scheduleSummary = getScheduleSummary(dueDate, plannedDate, actualDate)
  const collapsedDisplay = getScheduleCollapsedDisplay(startDate, dueDate, actualDate)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">卡片詳情</h2>
            {card?.card_number != null && (
              <span className="text-sm font-mono text-slate-400">#{card.card_number}</span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {!isFormReady ? (
          <div className="p-8 text-center text-slate-400">載入中...</div>
        ) : (
          <>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">標題</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border rounded px-3 py-2" placeholder="輸入描述..." />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">指派</label>
                <AssigneeCombobox users={activeUsers} value={assigneeId} onChange={setAssigneeId} />
              </div>

              {/* 日程安排區塊 */}
              <div className="bg-slate-50 rounded-lg p-4">
                {/* 標題列 */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">📅 日程安排</h3>
                  <button
                    type="button"
                    onClick={() => setScheduleExpanded(prev => !prev)}
                    className="text-xs text-slate-400 hover:text-blue-500 transition-colors px-1"
                  >
                    {scheduleExpanded ? '▾ 收合' : '✏️ 編輯'}
                  </button>
                </div>

                {/* 折疊狀態：智慧摘要 */}
                {!scheduleExpanded && (
                  <div className="mt-2">
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

                {/* 展開狀態：日期欄位 */}
                {scheduleExpanded && (
                  <div className="mt-3 space-y-1">
                    {/* 開始日 */}
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

                    {/* 截止日 */}
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

                    {/* 完成追蹤 */}
                    <div className="text-xs font-medium text-slate-400 tracking-wide pt-2 pb-1 border-t border-slate-200 mt-2">完成追蹤</div>

                    {/* 實際完成 */}
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

                    {/* 時間軸條 */}
                    <ScheduleTimelineBar
                      dueDate={dueDate}
                      plannedDate={plannedDate}
                      actualDate={actualDate}
                      createdAt={cardCreatedAt}
                    />

                    {/* 動態摘要 */}
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

              {/* Priority Selector */}
              <div>
                <label className="block text-sm font-medium mb-1">優先度</label>
                <div className="flex gap-2">
                  {(['high', 'medium', 'low'] as const).map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setPriority(level)}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border-2 transition-all ${
                        priority === level
                          ? 'border-current shadow-sm'
                          : 'border-transparent bg-slate-50 hover:bg-slate-100'
                      }`}
                      style={{
                        color: priority === level ? PRIORITY_COLORS[level] : '#64748b',
                        backgroundColor: priority === level ? PRIORITY_COLORS[level] + '15' : undefined,
                        borderColor: priority === level ? PRIORITY_COLORS[level] : 'transparent',
                      }}
                    >
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: PRIORITY_COLORS[level] }} />
                      {PRIORITY_LABELS[level]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Phase Selector */}
              <div>
                <label className="block text-sm font-medium mb-1">階段</label>
                <select
                  value={phaseId || ''}
                  onChange={e => setPhaseId(e.target.value || null)}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">無階段</option>
                  {phases.map(phase => (
                    <option key={phase.id} value={phase.id}>
                      {phase.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subtask Checklist */}
              <SubtaskChecklist
                cardId={card.id}
                subtasks={cardSubtasks}
                onSubtasksChange={setCardSubtasks}
              />

              {/* Activity Log */}
              <details className="group">
                <summary className="text-sm font-medium cursor-pointer select-none list-none flex items-center gap-1">
                  <svg className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  活動紀錄{activity.length > 0 && <span className="text-xs text-slate-400 ml-1">({activity.length})</span>}
                </summary>
                <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded mt-1">
                  {activity.length === 0 ? (
                    <p className="text-sm text-slate-400">尚無活動紀錄</p>
                  ) : (
                    activity.map((log) => (
                      <div key={log.id} className="text-xs text-slate-600 border-l-2 border-blue-300 pl-2 py-1">
                        <span className="font-medium text-blue-600">[{translateAction(log.action)}]</span>
                        <span className="text-slate-700"> {log.target}</span>
                        {log.old_value && log.new_value && log.old_value !== log.new_value ? (
                          <span className="text-orange-600"> {log.old_value} → {log.new_value}</span>
                        ) : (
                          <span className="text-green-600"> {log.new_value}</span>
                        )}
                        <span className="text-slate-400 block mt-0.5">
                          {new Date(log.created_at).toLocaleString('zh-TW')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </details>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={handleCancel} className="px-4 py-2 border rounded hover:bg-gray-50">
                取消
              </button>
              <button onClick={saveCard} disabled={isSaving} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
                {isSaving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// SlideInPane - Right-side slide-in panel for Board view
function SlideInPane({ card, phases, onClose, onUpdate }: { card: Card, phases: Phase[], onClose: () => void, onUpdate: () => void }) {
  const [isVisible, setIsVisible] = useState(false)
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
  const [activeUsers, setActiveUsers] = useState<{id: string; name: string; avatar_url: string | null}[]>([])
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [plannedDate, setPlannedDate] = useState('')
  const [actualDate, setActualDate] = useState('')
  const [cardCreatedAt, setCardCreatedAt] = useState<string | undefined>(undefined)
  const [priority, setPriority] = useState<Card['priority']>('medium')
  const [phaseId, setPhaseId] = useState<string | null>(null)
  const [activity, setActivity] = useState<{ id: string; action: string; target: string; old_value: string; new_value: string; created_at: string }[]>([])
  const [cardSubtasks, setCardSubtasks] = useState<{ id: string; title: string; is_completed: boolean }[]>([])

  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [scheduleExpanded, setScheduleExpanded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch active users for assignee dropdown
  useEffect(() => {
    fetch('/api/users/active').then(r => r.json()).then(data => {
      if (data.users) setActiveUsers(data.users)
    }).catch(console.error)
  }, [])

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

  // Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleClose])

  // Fetch card data and activity on mount
  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch('/api/cards/' + card.id).then(res => {
        if (!res.ok) throw new Error('無法載入卡片資料')
        return res.json()
      }),
      fetch('/api/cards/' + card.id + '/activity').then(res => {
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
        handleClose()
      }
    })

    return () => { cancelled = true }
  }, [card.id, handleClose])

  const saveCard = async () => {
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
      const res = await fetch('/api/cards/' + card.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (res.ok) {
        handleClose()
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
  }

  const handleCancel = () => {
    setTitle(originalData.title)
    setDescription(originalData.description)
    setAssigneeId(originalData.assigneeId)
    setStartDate(originalData.startDate)
    setDueDate(originalData.dueDate)
    setPlannedDate(originalData.plannedDate)
    setActualDate(originalData.actualDate)
    setPriority(originalData.priority)
    setPhaseId(originalData.phase_id)
    handleClose()
  }

  const scheduleSummary = getScheduleSummary(dueDate, plannedDate, actualDate)
  const collapsedDisplay = getScheduleCollapsedDisplay(startDate, dueDate, actualDate)

  return (
    <div
      className={`fixed top-0 right-0 h-full w-[420px] max-lg:w-full max-lg:inset-0 z-50 bg-white shadow-2xl border-l border-slate-200 flex flex-col transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-x-0' : 'translate-x-full max-lg:translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">卡片詳情</h2>
          {card?.card_number != null && (
            <span className="text-sm font-mono text-slate-400">#{card.card_number}</span>
          )}
        </div>
        <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 p-1">✕</button>
      </div>

      {/* Content */}
      {!isFormReady ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">載入中...</div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">標題</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">描述</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border rounded px-3 py-2" placeholder="輸入描述..." />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">指派</label>
              <AssigneeCombobox users={activeUsers} value={assigneeId} onChange={setAssigneeId} />
            </div>

            {/* 日程安排區塊 */}
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">📅 日程安排</h3>
                <button
                  type="button"
                  onClick={() => setScheduleExpanded(prev => !prev)}
                  className="text-xs text-slate-400 hover:text-blue-500 transition-colors px-1"
                >
                  {scheduleExpanded ? '▾ 收合' : '✏️ 編輯'}
                </button>
              </div>

              {!scheduleExpanded && (
                <div className="mt-2">
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

              {scheduleExpanded && (
                <div className="mt-3 space-y-1">
                  {/* 開始日 */}
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

                  {/* 截止日 */}
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

                  {/* 完成追蹤 */}
                  <div className="text-xs font-medium text-slate-400 tracking-wide pt-2 pb-1 border-t border-slate-200 mt-2">完成追蹤</div>

                  {/* 實際完成 */}
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

                  {/* 時間軸條 */}
                  <ScheduleTimelineBar
                    dueDate={dueDate}
                    plannedDate={plannedDate}
                    actualDate={actualDate}
                    createdAt={cardCreatedAt}
                  />

                  {/* 動態摘要 */}
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

            {/* Priority Selector */}
            <div>
              <label className="block text-sm font-medium mb-1">優先度</label>
              <div className="flex gap-2">
                {(['high', 'medium', 'low'] as const).map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPriority(level)}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border-2 transition-all ${
                      priority === level
                        ? 'border-current shadow-sm'
                        : 'border-transparent bg-slate-50 hover:bg-slate-100'
                    }`}
                    style={{
                      color: priority === level ? PRIORITY_COLORS[level] : '#64748b',
                      backgroundColor: priority === level ? PRIORITY_COLORS[level] + '15' : undefined,
                      borderColor: priority === level ? PRIORITY_COLORS[level] : 'transparent',
                    }}
                  >
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: PRIORITY_COLORS[level] }} />
                    {PRIORITY_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>

            {/* Phase Selector */}
            <div>
              <label className="block text-sm font-medium mb-1">階段</label>
              <select
                value={phaseId || ''}
                onChange={e => setPhaseId(e.target.value || null)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">無階段</option>
                {phases.map(phase => (
                  <option key={phase.id} value={phase.id}>
                    {phase.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subtask Checklist */}
            <SubtaskChecklist
              cardId={card.id}
              subtasks={cardSubtasks}
              onSubtasksChange={setCardSubtasks}
            />

            {/* Activity Log */}
            <details className="group">
              <summary className="text-sm font-medium cursor-pointer select-none list-none flex items-center gap-1">
                <svg className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                活動紀錄{activity.length > 0 && <span className="text-xs text-slate-400 ml-1">({activity.length})</span>}
              </summary>
              <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded mt-1">
                {activity.length === 0 ? (
                  <p className="text-sm text-slate-400">尚無活動紀錄</p>
                ) : (
                  activity.map((log) => (
                    <div key={log.id} className="text-xs text-slate-600 border-l-2 border-blue-300 pl-2 py-1">
                      <span className="font-medium text-blue-600">[{translateAction(log.action)}]</span>
                      <span className="text-slate-700"> {log.target}</span>
                      {log.old_value && log.new_value && log.old_value !== log.new_value ? (
                        <span className="text-orange-600"> {log.old_value} → {log.new_value}</span>
                      ) : (
                        <span className="text-green-600"> {log.new_value}</span>
                      )}
                      <span className="text-slate-400 block mt-0.5">
                        {new Date(log.created_at).toLocaleString('zh-TW')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </details>
          </div>

          {/* Footer */}
          <div className="p-4 border-t flex justify-end gap-2 flex-shrink-0">
            <button onClick={handleCancel} className="px-4 py-2 border rounded hover:bg-gray-50">
              取消
            </button>
            <button onClick={saveCard} disabled={isSaving} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
              {isSaving ? '儲存中...' : '儲存'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function ColumnDroppable({ column, phases, onCardClick, onAddCard }: {
  column: Column,
  phases: Phase[],
  onCardClick: (card: Card) => void,
  onAddCard: (columnId: string, title: string) => void,
}) {
  const [newCardTitle, setNewCardTitle] = useState('')
  const [showAddCard, setShowAddCard] = useState(false)

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault()
    if (newCardTitle.trim()) {
      onAddCard(column.id, newCardTitle.trim())
      setNewCardTitle('')
      setShowAddCard(false)
    }
  }

  return (
    <Droppable droppableId={column.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className="w-72 flex-shrink-0 flex flex-col"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700">
              {column.name}
              <span className="ml-2 text-sm text-slate-400">{column.cards?.length || 0}</span>
            </h2>
          </div>

          <div
            className={`flex-1 space-y-2 overflow-y-auto min-h-[100px] rounded ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}
          >
            {column.cards?.map((card, index) => (
              <CardItem
                key={card.id}
                card={card}
                index={index}
                onClick={() => onCardClick(card)}
                phases={phases}
              />
            ))}
            {provided.placeholder}
          </div>

          {showAddCard ? (
            <form onSubmit={handleAddCard} className="mt-2">
              <input
                value={newCardTitle}
                onChange={e => setNewCardTitle(e.target.value)}
                placeholder="卡片標題..."
                className="w-full px-3 py-2 text-sm border rounded mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded">新增</button>
                <button type="button" onClick={() => setShowAddCard(false)} className="flex-1 px-3 py-2 text-sm border rounded">取消</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowAddCard(true)} className="w-full mt-2 px-3 py-2 text-sm text-left text-slate-500 hover:bg-slate-100 rounded">
              + 新增卡片
            </button>
          )}
        </div>
      )}
    </Droppable>
  )
}

// Phase Filter Bar
function PhaseFilterBar({ phases, selectedPhase, onSelect, onAddPhase, onDeletePhase }: {
  phases: Phase[]
  selectedPhase: string | null
  onSelect: (phaseId: string | null) => void
  onAddPhase: (name: string, color: string) => void
  onDeletePhase: (id: string, targetPhaseId?: string | null) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366F1')
  const [pendingDeletePhase, setPendingDeletePhase] = useState<Phase | null>(null)
  const [targetPhaseId, setTargetPhaseId] = useState<string>('')

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (newName.trim()) {
      onAddPhase(newName.trim(), newColor)
      setNewName('')
      setNewColor('#6366F1')
      setShowAdd(false)
    }
  }

  const presetColors = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4']

  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-2 bg-white border-b max-h-28 overflow-y-auto">
      {/* "All" button */}
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
          selectedPhase === null
            ? 'bg-slate-800 text-white shadow-sm'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        全部
      </button>

      {/* Phase buttons */}
      {phases.map(phase => (
        <div key={phase.id} className="relative group flex items-center">
          <button
            onClick={() => onSelect(phase.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
              selectedPhase === phase.id
                ? 'text-white shadow-sm'
                : 'text-slate-600 hover:opacity-80'
            }`}
            style={{
              backgroundColor: selectedPhase === phase.id ? phase.color : phase.color + '20',
              color: selectedPhase === phase.id ? '#fff' : phase.color,
            }}
          >
            {phase.name}
            {phase.total_cards > 0 && (
              <span className={`text-xs ${selectedPhase === phase.id ? 'text-white/80' : 'opacity-60'}`}>
                {phase.progress}%
              </span>
            )}
          </button>
          {/* Delete button on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPendingDeletePhase(phase)
            }}
            className="hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-500 hover:bg-red-200 text-xs ml-1"
          >
            ✕
          </button>
        </div>
      ))}

      {/* Add phase button */}
      {showAdd ? (
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="階段名稱..."
            className="px-2 py-1 text-sm border rounded w-28"
            autoFocus
          />
          <div className="flex gap-1">
            {presetColors.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-all ${newColor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button type="submit" className="px-2 py-1 text-sm bg-blue-500 text-white rounded">新增</button>
          <button type="button" onClick={() => setShowAdd(false)} className="px-2 py-1 text-sm border rounded">取消</button>
        </form>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 rounded-full text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
        >
          + 新增階段
        </button>
      )}

      <Dialog open={pendingDeletePhase !== null} onOpenChange={(open) => { if (!open) { setPendingDeletePhase(null); setTargetPhaseId('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>刪除階段</DialogTitle>
            <DialogDescription>
              確定要刪除階段「{pendingDeletePhase?.name}」嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          {pendingDeletePhase && pendingDeletePhase.total_cards > 0 && (
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <p className="font-medium">⚠ 此階段包含 {pendingDeletePhase.total_cards} 個任務</p>
              <p className="mt-1 text-amber-700">請選擇要將任務移至哪個階段：</p>
              <select
                value={targetPhaseId}
                onChange={(e) => setTargetPhaseId(e.target.value)}
                className="mt-2 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">不指定階段（移除標記）</option>
                {phases.filter(p => p.id !== pendingDeletePhase.id).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingDeletePhase(null); setTargetPhaseId('') }}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDeletePhase) {
                  onDeletePhase(pendingDeletePhase.id, targetPhaseId || null)
                  setPendingDeletePhase(null)
                  setTargetPhaseId('')
                }
              }}
            >
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function BoardPage() {
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [newColumnName, setNewColumnName] = useState('')
  const [currentView, setCurrentView] = useState<ViewType>('board')

  // Phase state
  const [phases, setPhases] = useState<Phase[]>([])
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null)

  const viewTabs = [
    { id: 'board' as ViewType, label: 'Board', icon: '📋' },
    { id: 'list' as ViewType, label: 'List', icon: '📝' },
    { id: 'calendar' as ViewType, label: 'Calendar', icon: '📅' },
    { id: 'gantt' as ViewType, label: '甘特圖', icon: '📐' },
    { id: 'progress' as ViewType, label: 'Progress', icon: '📊' },
  ]

  useEffect(() => {
    fetchBoard()
  }, [projectId])

  async function fetchBoard() {
    setLoading(true)
    try {
      const [projectRes, columnsRes, phasesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/columns`),
        fetch(`/api/projects/${projectId}/phases`).catch(() => null),
      ])

      if (!projectRes.ok) throw new Error('無法載入專案資料')
      if (!columnsRes.ok) throw new Error('無法載入欄位資料')

      const projectData = await projectRes.json()
      const columnsData = await columnsRes.json()
      setProject(projectData)
      setColumns(columnsData)

      // Phases may not exist yet (API not ready), handle gracefully
      if (phasesRes && phasesRes.ok) {
        const phasesData = await phasesRes.json()
        setPhases(phasesData)
      }
    } catch (e) {
      console.error('載入看板錯誤:', e)
      alert(e instanceof Error ? e.message : '載入看板失敗，請重新整理頁面')
    } finally {
      setLoading(false)
    }
  }

  // Phase management
  async function addPhase(name: string, color: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/phases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color })
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '新增階段失敗')
      }
      await fetchBoard()
    } catch (error) {
      console.error('新增階段錯誤:', error)
      alert(error instanceof Error ? error.message : '新增階段失敗')
    }
  }

  async function deletePhase(id: string, targetPhaseId?: string | null) {
    try {
      let url = `/api/projects/${projectId}/phases?id=${id}`
      if (targetPhaseId) {
        url += `&targetPhaseId=${targetPhaseId}`
      }
      const res = await fetch(url, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '刪除階段失敗')
      }
      // If the deleted phase was selected, reset filter
      if (selectedPhase === id) {
        setSelectedPhase(null)
      }
      await fetchBoard()
    } catch (error) {
      console.error('刪除階段錯誤:', error)
      alert(error instanceof Error ? error.message : '刪除階段失敗')
    }
  }

  async function addCard(columnId: string, title: string) {
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: columnId, title })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '新增卡片失敗')
      }

      await fetchBoard()
    } catch (error) {
      console.error('新增卡片錯誤:', error)
      alert(error instanceof Error ? error.message : '新增卡片失敗，請重試')
    }
  }

  async function addColumn(name: string) {
    try {
      const res = await fetch('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '新增欄位失敗')
      }

      await fetchBoard()
    } catch (error) {
      console.error('新增欄位錯誤:', error)
      alert(error instanceof Error ? error.message : '新增欄位失敗，請重試')
    }
  }

  // Apply phase filter to columns
  const filteredColumns = selectedPhase
    ? columns.map(col => ({
        ...col,
        cards: col.cards.filter(card => card.phase_id === selectedPhase)
      }))
    : columns

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    // Find the column and card
    const sourceColumn = columns.find(c => c.id === source.droppableId)
    const destColumn = columns.find(c => c.id === destination.droppableId)

    if (!sourceColumn || !destColumn) return

    // Create new cards array
    const sourceCards = [...sourceColumn.cards]
    const [movedCard] = sourceCards.splice(source.index, 1)

    let newColumns: Column[]

    if (source.droppableId === destination.droppableId) {
      // Same column reorder
      sourceCards.splice(destination.index, 0, movedCard)
      newColumns = columns.map(col =>
        col.id === source.droppableId ? { ...col, cards: sourceCards } : col
      )
    } else {
      // Different column move
      const destCards = [...destColumn.cards]
      destCards.splice(destination.index, 0, movedCard)
      newColumns = columns.map(col => {
        if (col.id === source.droppableId) return { ...col, cards: sourceCards }
        if (col.id === destination.droppableId) return { ...col, cards: destCards }
        return col
      })
    }

    // Update local state immediately
    setColumns(newColumns)

    // Auto-fill actual_completion_date when dragging to last column (Done)
    const isLastColumn = columns[columns.length - 1]?.id === destination.droppableId
    const wasLastColumn = columns[columns.length - 1]?.id === source.droppableId
    const todayStr = new Date().toISOString().split('T')[0]

    if (source.droppableId !== destination.droppableId) {
      if (isLastColumn && !movedCard.actual_completion_date) {
        // Moving to Done → auto-fill actual_completion_date
        setColumns(prev => prev.map(col => ({
          ...col,
          cards: col.cards.map(c => c.id === draggableId ? { ...c, actual_completion_date: todayStr } : c)
        })))
        try {
          const res = await fetch('/api/cards/' + draggableId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: movedCard.title, actual_completion_date: todayStr })
          })
          if (!res.ok) throw new Error('Failed')
        } catch {
          // Rollback on failure
          setColumns(prev => prev.map(col => ({
            ...col,
            cards: col.cards.map(c => c.id === draggableId ? { ...c, actual_completion_date: null } : c)
          })))
        }
      } else if (wasLastColumn && movedCard.actual_completion_date) {
        // Moving from Done back → clear actual_completion_date
        const oldDate = movedCard.actual_completion_date
        setColumns(prev => prev.map(col => ({
          ...col,
          cards: col.cards.map(c => c.id === draggableId ? { ...c, actual_completion_date: null } : c)
        })))
        try {
          const res = await fetch('/api/cards/' + draggableId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: movedCard.title, actual_completion_date: null })
          })
          if (!res.ok) throw new Error('Failed')
        } catch {
          // Rollback on failure
          setColumns(prev => prev.map(col => ({
            ...col,
            cards: col.cards.map(c => c.id === draggableId ? { ...c, actual_completion_date: oldDate } : c)
          })))
        }
      }
    }

    // Save to server
    try {
      await fetch('/api/cards/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: draggableId,
          source_column_id: source.droppableId,
          dest_column_id: destination.droppableId,
          source_index: source.index,
          dest_index: destination.index,
        })
      })
    } catch (e) {
      console.error('Failed to save:', e)
      fetchBoard() // Refresh on error
    }
  }

  if (loading) {
    return <div className="p-8">載入中...</div>
  }

  if (!project) {
    return <div className="p-8">專案不存在</div>
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col">
        <header className="border-b px-6 py-4 flex items-center justify-between bg-white">
          <h1 className="text-xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 rounded-lg p-1">
              {viewTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentView(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    currentView === tab.id
                      ? 'bg-white shadow text-slate-900'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
            <Link href="/projects" className="px-4 py-2 border rounded hover:bg-slate-50">返回專案</Link>
            <UserNav />
          </div>
        </header>

        {/* Phase Filter Bar */}
        <PhaseFilterBar
          phases={phases}
          selectedPhase={selectedPhase}
          onSelect={setSelectedPhase}
          onAddPhase={addPhase}
          onDeletePhase={deletePhase}
        />

        <div className={`flex-1 overflow-auto p-6 bg-slate-50 transition-all duration-300 ${
          selectedCard && currentView === 'board' ? 'lg:mr-[420px]' : ''
        }`}>
          {currentView === 'board' && (
            <div className="flex gap-4 h-full">
              {filteredColumns.map((column) => (
                <ColumnDroppable
                  key={column.id}
                  column={column}
                  phases={phases}
                  onCardClick={setSelectedCard}
                  onAddCard={addCard}
                />
              ))}
              <AddColumnForm onAdd={addColumn} />
            </div>
          )}

          {currentView === 'list' && <ListView columns={filteredColumns} phases={phases} onCardClick={setSelectedCard} />}
          {currentView === 'calendar' && <CalendarView columns={filteredColumns} onCardClick={setSelectedCard} />}
          {currentView === 'gantt' && (
            <GanttView
              columns={filteredColumns}
              phases={phases}
              onCardClick={setSelectedCard}
            />
          )}
          {currentView === 'progress' && <ProgressView columns={filteredColumns} />}
        </div>

        {selectedCard && currentView === 'board' && (
          <SlideInPane
            card={selectedCard}
            phases={phases}
            onClose={() => setSelectedCard(null)}
            onUpdate={fetchBoard}
          />
        )}
        {selectedCard && currentView !== 'board' && (
          <CardModal
            card={selectedCard}
            phases={phases}
            onClose={() => setSelectedCard(null)}
            onUpdate={fetchBoard}
          />
        )}
      </div>
    </DragDropContext>
  )
}

function AddColumnForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onAdd(name.trim())
      setName('')
    }
  }

  return (
    <div className="w-72 flex-shrink-0">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="新欄位名稱..." className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" />
        <button type="submit" className="px-4 py-2 bg-slate-100 rounded">+</button>
      </form>
    </div>
  )
}
