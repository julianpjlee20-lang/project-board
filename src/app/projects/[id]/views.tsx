'use client'

import { useState } from 'react'
import type { Card, Column, Phase, CalendarMode } from './types'

const PRIORITY_CONFIG = {
  high:   { color: 'bg-red-500',    label: '高' },
  medium: { color: 'bg-yellow-400', label: '中' },
  low:    { color: 'bg-green-500',  label: '低' },
} as const

// ──────────────────────────────────────────────
// Shared Timeline Utilities
// ──────────────────────────────────────────────

/** Normalise a date string to a local Date (timezone-safe) */
function parseDueDate(due: string): Date {
  return new Date(due.split('T')[0] + 'T00:00:00')
}

/** Format date for display in zh-TW locale */
function formatDateShort(dateStr: string): string {
  return parseDueDate(dateStr).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })
}

/**
 * MiniTimelineBar — compact timeline bar for ListView rows
 * Shows time progression from created → planned → due → actual
 * Width ~120px, height 4px
 *
 * Logic:
 * - Needs at least 2 dates to display
 * - Blue (bg-blue-400): created → planned
 * - Green (bg-emerald-400): actual <= due (on time)
 * - Red (bg-red-400): actual > due (late)
 * - Grey (bg-slate-200): future/unfilled interval
 * - Dashed vertical line marks the due date position
 */
function MiniTimelineBar({ card }: { card: Card }) {
  const dueDate = card.due_date ? parseDueDate(card.due_date) : null
  const plannedDate = card.planned_completion_date ? parseDueDate(card.planned_completion_date) : null
  const actualDate = card.actual_completion_date ? parseDueDate(card.actual_completion_date) : null

  // Collect all available dates
  const dates: Date[] = []
  if (dueDate) dates.push(dueDate)
  if (plannedDate) dates.push(plannedDate)
  if (actualDate) dates.push(actualDate)

  // Need at least 2 dates to show timeline
  if (dates.length < 2) return null

  const minTime = Math.min(...dates.map(d => d.getTime()))
  const maxTime = Math.max(...dates.map(d => d.getTime()))
  const range = maxTime - minTime

  if (range === 0) return null

  // Convert date to percentage position on the bar
  const toPercent = (d: Date) => ((d.getTime() - minTime) / range) * 100

  // Determine segments to draw
  const segments: { left: number; width: number; color: string }[] = []

  // If we have planned date and due date, draw the planned segment (blue)
  if (plannedDate && dueDate) {
    const pLeft = toPercent(plannedDate < dueDate ? plannedDate : dueDate)
    const pRight = toPercent(plannedDate < dueDate ? dueDate : plannedDate)
    segments.push({ left: pLeft, width: pRight - pLeft, color: 'bg-blue-400' })
  }

  // If we have actual date, draw actual completion segment
  if (actualDate && dueDate) {
    const aPos = toPercent(actualDate)
    const dPos = toPercent(dueDate)
    const isLate = actualDate.getTime() > dueDate.getTime()

    if (isLate) {
      // On-time portion (up to due) + late portion (due to actual)
      segments.push({ left: Math.min(aPos, dPos), width: Math.abs(dPos - Math.min(aPos, dPos)), color: 'bg-emerald-400' })
      segments.push({ left: dPos, width: aPos - dPos, color: 'bg-red-400' })
    } else {
      // All on time
      segments.push({ left: Math.min(aPos, dPos), width: Math.abs(dPos - aPos), color: 'bg-emerald-400' })
    }
  } else if (actualDate && plannedDate && !dueDate) {
    // No due date, but have actual and planned
    const aPos = toPercent(actualDate)
    const pPos = toPercent(plannedDate)
    const isLate = actualDate.getTime() > plannedDate.getTime()
    segments.push({
      left: Math.min(aPos, pPos),
      width: Math.abs(aPos - pPos),
      color: isLate ? 'bg-red-400' : 'bg-emerald-400'
    })
  }

  // Due date vertical marker position
  const duePercent = dueDate ? toPercent(dueDate) : null

  return (
    <div className="relative w-[120px] h-1 bg-slate-200 rounded-full mt-1.5">
      {segments.map((seg, i) => (
        <div
          key={i}
          className={`absolute top-0 h-full rounded-full ${seg.color}`}
          style={{ left: `${seg.left}%`, width: `${Math.max(seg.width, 1)}%` }}
        />
      ))}
      {/* Due date vertical dashed marker */}
      {duePercent !== null && (
        <div
          className="absolute top-[-3px] w-[1px] h-[10px] border-l border-dashed border-slate-500"
          style={{ left: `${duePercent}%` }}
        />
      )}
    </div>
  )
}

/**
 * TimelineTooltip — hover tooltip showing three dates for a card
 */
function TimelineTooltipContent({ card }: { card: Card }) {
  return (
    <div className="text-xs space-y-1">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
        <span className="text-slate-500">截止日：</span>
        <span className="font-medium">{card.due_date ? formatDateShort(card.due_date) : '-'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
        <span className="text-slate-500">預計完成：</span>
        <span className="font-medium">{card.planned_completion_date ? formatDateShort(card.planned_completion_date) : '-'}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
        <span className="text-slate-500">實際完成：</span>
        <span className="font-medium">{card.actual_completion_date ? formatDateShort(card.actual_completion_date) : '-'}</span>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// List View Component
// ──────────────────────────────────────────────
export function ListView({ columns, phases, onCardClick }: { columns: Column[], phases?: Phase[], onCardClick: (card: Card) => void }) {
  const allCards = columns.flatMap(col =>
    col.cards.map(card => ({ ...card, columnName: col.name, columnColor: col.color }))
  )

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">標題</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">階段</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">優先度</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">欄位</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">指派</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">日程</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">進度</th>
          </tr>
        </thead>
        <tbody>
          {allCards.map((card) => (
            <tr
              key={card.id}
              onClick={() => onCardClick(card)}
              className="border-b hover:bg-slate-50 cursor-pointer"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.columnColor }} />
                  <span className="font-medium">{card.title}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm">
                {(() => {
                  const phase = card.phase_id ? phases?.find(p => p.id === card.phase_id) : null
                  return phase ? (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: phase.color }}
                    >
                      {phase.name}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )
                })()}
              </td>
              <td className="px-4 py-3 text-sm">
                {(() => {
                  const priority = card.priority || 'medium'
                  const config = PRIORITY_CONFIG[priority]
                  return (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${config.color}`} />
                      <span className="text-slate-600">{config.label}</span>
                    </span>
                  )
                })()}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">{card.columnName}</td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {card.assignees?.[0]?.name || '-'}
              </td>
              <td className="px-4 py-3">
                <ScheduleCell card={card} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${card.progress || 0}%`,
                        backgroundColor: card.progress === 100 ? '#10B981' : '#3B82F6'
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">{card.progress || 0}%</span>
                </div>
              </td>
            </tr>
          ))}
          {allCards.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                尚無任務
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Schedule cell for ListView — shows due date text + mini timeline bar + hover tooltip */
function ScheduleCell({ card }: { card: Card }) {
  const [showTooltip, setShowTooltip] = useState(false)

  const hasDueDate = !!card.due_date
  const hasAnyDate = hasDueDate || !!card.planned_completion_date || !!card.actual_completion_date

  if (!hasAnyDate) {
    return <span className="text-sm text-slate-400">-</span>
  }

  // Check if actual > due (late)
  const isLate = card.actual_completion_date && card.due_date
    ? parseDueDate(card.actual_completion_date).getTime() > parseDueDate(card.due_date).getTime()
    : false

  // Check if overdue (no actual, due date passed)
  const isOverdue = !card.actual_completion_date && card.due_date
    ? parseDueDate(card.due_date).getTime() < new Date().setHours(0, 0, 0, 0)
    : false

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div className="text-sm text-slate-600">
        {hasDueDate && (
          <span className={isLate || isOverdue ? 'text-red-500 font-medium' : ''}>
            截止 {formatDateShort(card.due_date!)}
          </span>
        )}
        {!hasDueDate && card.planned_completion_date && (
          <span className="text-blue-500">
            預計 {formatDateShort(card.planned_completion_date)}
          </span>
        )}
      </div>
      <MiniTimelineBar card={card} />

      {/* Hover tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[180px] whitespace-nowrap">
          <TimelineTooltipContent card={card} />
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// Calendar View Utilities & Types
// ──────────────────────────────────────────────

type CardWithColumn = Card & { columnName: string; columnColor: string }

/** Date entry types for calendar display */
type DateEntryType = 'due' | 'planned' | 'actual'

interface DateEntry {
  card: CardWithColumn
  type: DateEntryType
  date: Date
}

/** Style config for each date entry type in calendar */
const DATE_TYPE_STYLES: Record<DateEntryType, { label: string; dotClass: string; ringClass: string }> = {
  due:     { label: '截止日',   dotClass: 'bg-current',                                    ringClass: '' },
  planned: { label: '預計完成', dotClass: 'bg-transparent ring-2 ring-blue-400',            ringClass: 'ring-2 ring-blue-400' },
  actual:  { label: '實際完成', dotClass: 'bg-emerald-400 ring-2 ring-emerald-400/50',      ringClass: 'ring-2 ring-emerald-400' },
}

/** Compute calendar grid data for a given month */
function getMonthData(year: number, month: number): { daysInMonth: number; firstDay: number } {
  return {
    daysInMonth: new Date(year, month + 1, 0).getDate(),
    firstDay: new Date(year, month, 1).getDay(),
  }
}

/** Check if two dates represent the same calendar day */
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Collect all date entries from cards (due, planned, actual) */
function collectDateEntries(cards: CardWithColumn[]): DateEntry[] {
  const entries: DateEntry[] = []
  for (const card of cards) {
    if (card.due_date) {
      entries.push({ card, type: 'due', date: parseDueDate(card.due_date) })
    }
    if (card.planned_completion_date) {
      entries.push({ card, type: 'planned', date: parseDueDate(card.planned_completion_date) })
    }
    if (card.actual_completion_date) {
      entries.push({ card, type: 'actual', date: parseDueDate(card.actual_completion_date) })
    }
  }
  return entries
}

// ──────────────────────────────────────────────
// MonthView — full-size month calendar
// ──────────────────────────────────────────────
function MonthView({ year, month, cards, onCardClick }: {
  year: number
  month: number
  cards: CardWithColumn[]
  onCardClick: (card: Card) => void
}) {
  const today = new Date()
  const { daysInMonth, firstDay } = getMonthData(year, month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDay }, (_, i) => i)

  // Collect all date entries for this month
  const allEntries = collectDateEntries(cards)
  const monthEntries = allEntries.filter(e =>
    e.date.getFullYear() === year && e.date.getMonth() === month
  )

  return (
    <div className="grid grid-cols-7 gap-1">
      {['日', '一', '二', '三', '四', '五', '六'].map(day => (
        <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
          {day}
        </div>
      ))}
      {blanks.map(i => <div key={`blank-${i}`} className="h-24" />)}
      {days.map(day => {
        const cellDate = new Date(year, month, day)
        const isToday = isSameDay(cellDate, today)
        const dayEntries = monthEntries.filter(e => e.date.getDate() === day)

        // Group entries by card to show each card once with date type markers
        const cardMap = new Map<string, { card: CardWithColumn; types: DateEntryType[] }>()
        for (const entry of dayEntries) {
          const existing = cardMap.get(entry.card.id)
          if (existing) {
            existing.types.push(entry.type)
          } else {
            cardMap.set(entry.card.id, { card: entry.card, types: [entry.type] })
          }
        }
        const cardGroups = Array.from(cardMap.values())

        return (
          <div
            key={day}
            className={`h-24 border rounded p-1 overflow-hidden ${isToday ? 'bg-blue-50 border-blue-200' : ''}`}
          >
            <div className={`text-sm mb-1 ${isToday ? 'font-bold text-blue-600' : 'text-slate-500'}`}>
              {day}
            </div>
            {cardGroups.slice(0, 3).map(({ card, types }) => (
              <div
                key={`${card.id}-${types.join('-')}`}
                onClick={() => onCardClick(card)}
                className="text-xs p-0.5 mb-0.5 rounded truncate cursor-pointer hover:opacity-80 flex items-center gap-1"
                style={{ backgroundColor: card.columnColor + '20' }}
              >
                {/* Date type markers */}
                <span className="flex items-center gap-0.5 flex-shrink-0">
                  {types.includes('due') && (
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: card.columnColor }}
                      title="截止日"
                    />
                  )}
                  {types.includes('planned') && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-transparent ring-1 ring-blue-400"
                      title="預計完成"
                    />
                  )}
                  {types.includes('actual') && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-emerald-300"
                      title="實際完成"
                    />
                  )}
                </span>
                <span className="truncate" style={{ color: card.columnColor }}>
                  {card.title}
                </span>
              </div>
            ))}
            {cardGroups.length > 3 && (
              <div className="text-[10px] text-slate-400 text-center">+{cardGroups.length - 3}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────
// QuarterView — 3-month mini calendars side by side
// ──────────────────────────────────────────────
function QuarterView({ year, quarter, cards, onCardClick }: {
  year: number
  quarter: number
  cards: CardWithColumn[]
  onCardClick: (card: Card) => void
}) {
  const startMonth = (quarter - 1) * 3
  const months = [startMonth, startMonth + 1, startMonth + 2]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {months.map(m => (
        <MiniMonth
          key={m}
          year={year}
          month={m}
          cards={cards}
          onCardClick={onCardClick}
        />
      ))}
    </div>
  )
}

/** Mini month calendar used in QuarterView */
function MiniMonth({ year, month, cards, onCardClick }: {
  year: number
  month: number
  cards: CardWithColumn[]
  onCardClick: (card: Card) => void
}) {
  const today = new Date()
  const { daysInMonth, firstDay } = getMonthData(year, month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDay }, (_, i) => i)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  // Collect all date entries for this month
  const allEntries = collectDateEntries(cards)
  const monthEntries = allEntries.filter(e =>
    e.date.getFullYear() === year && e.date.getMonth() === month
  )

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{month + 1}月</h4>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['日', '一', '二', '三', '四', '五', '六'].map(d => (
          <div key={d} className="text-[10px] font-medium text-slate-400 py-1">{d}</div>
        ))}
        {blanks.map(i => <div key={`b-${i}`} className="h-8" />)}
        {days.map(day => {
          const cellDate = new Date(year, month, day)
          const isToday = isSameDay(cellDate, today)
          const dayEntries = monthEntries.filter(e => e.date.getDate() === day)

          // Collect unique types and cards for this day
          const typesInDay = new Set(dayEntries.map(e => e.type))
          const uniqueCards = new Map<string, CardWithColumn>()
          for (const entry of dayEntries) {
            uniqueCards.set(entry.card.id, entry.card)
          }
          const dayCards = Array.from(uniqueCards.values())

          // Build dot display: show type-based dots (max 3)
          const dots: { key: string; type: DateEntryType; color: string }[] = []
          if (typesInDay.has('due')) {
            const dueCards = dayEntries.filter(e => e.type === 'due')
            dueCards.slice(0, 1).forEach(e => dots.push({ key: `due-${e.card.id}`, type: 'due', color: e.card.columnColor }))
          }
          if (typesInDay.has('planned')) {
            dots.push({ key: 'planned', type: 'planned', color: '#60A5FA' })
          }
          if (typesInDay.has('actual')) {
            dots.push({ key: 'actual', type: 'actual', color: '#34D399' })
          }
          const overflow = dayCards.length - 3

          return (
            <div
              key={day}
              className="relative h-8 flex flex-col items-center justify-center cursor-default"
              onMouseEnter={() => dayEntries.length > 0 ? setHoveredDay(day) : undefined}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <span
                className={`text-xs leading-none ${
                  isToday
                    ? 'bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold'
                    : 'text-slate-600'
                }`}
              >
                {day}
              </span>
              {dayEntries.length > 0 && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {dots.slice(0, 3).map(dot => {
                    if (dot.type === 'planned') {
                      return (
                        <span
                          key={dot.key}
                          className="w-1.5 h-1.5 rounded-full bg-transparent ring-1 ring-blue-400"
                        />
                      )
                    }
                    if (dot.type === 'actual') {
                      return (
                        <span
                          key={dot.key}
                          className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-emerald-300"
                        />
                      )
                    }
                    // due
                    return (
                      <span
                        key={dot.key}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: dot.color }}
                      />
                    )
                  })}
                  {overflow > 0 && (
                    <span className="text-[8px] text-slate-400">+{overflow}</span>
                  )}
                </div>
              )}
              {/* Tooltip */}
              {hoveredDay === day && dayEntries.length > 0 && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[180px] max-w-[240px]">
                  <div className="text-xs font-medium text-slate-500 mb-1">{month + 1}月{day}日</div>
                  {dayEntries.map((entry, idx) => (
                    <div
                      key={`${entry.card.id}-${entry.type}-${idx}`}
                      onClick={() => onCardClick(entry.card)}
                      className="text-xs py-1 px-1.5 rounded hover:bg-slate-50 cursor-pointer truncate flex items-center gap-1.5"
                    >
                      {entry.type === 'due' && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.card.columnColor }} />
                      )}
                      {entry.type === 'planned' && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-transparent ring-1.5 ring-blue-400" />
                      )}
                      {entry.type === 'actual' && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400 ring-1.5 ring-emerald-300" />
                      )}
                      <span className="truncate">{entry.card.title}</span>
                      <span className="text-slate-400 flex-shrink-0">({DATE_TYPE_STYLES[entry.type].label})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// YearView — 12-month heatmap overview
// ──────────────────────────────────────────────
function YearView({ year, cards, onCardClick, onMonthClick }: {
  year: number
  cards: CardWithColumn[]
  onCardClick: (card: Card) => void
  onMonthClick: (month: number) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }, (_, m) => (
        <YearMonthTile
          key={m}
          year={year}
          month={m}
          cards={cards}
          onCardClick={onCardClick}
          onMonthClick={onMonthClick}
        />
      ))}
    </div>
  )
}

/** Heatmap colour based on date entry count */
function heatColor(count: number): string {
  if (count === 0) return 'bg-slate-100'
  if (count === 1) return 'bg-blue-200'
  if (count === 2) return 'bg-blue-300'
  return 'bg-blue-500'
}

/** Single month tile for YearView */
function YearMonthTile({ year, month, cards, onCardClick, onMonthClick }: {
  year: number
  month: number
  cards: CardWithColumn[]
  onCardClick: (card: Card) => void
  onMonthClick: (month: number) => void
}) {
  const today = new Date()
  const { daysInMonth, firstDay } = getMonthData(year, month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDay }, (_, i) => i)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  // Collect all date entries for this month
  const allEntries = collectDateEntries(cards)
  const monthEntries = allEntries.filter(e =>
    e.date.getFullYear() === year && e.date.getMonth() === month
  )

  // Count unique cards that have any date in this month
  const uniqueCardIds = new Set(monthEntries.map(e => e.card.id))
  const monthCardCount = uniqueCardIds.size

  const entryCountForDay = (day: number) =>
    monthEntries.filter(e => e.date.getDate() === day).length

  return (
    <div
      className="bg-white rounded-lg shadow p-3 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onMonthClick(month)}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-700">{month + 1}月</h4>
        {monthCardCount > 0 && (
          <span className="text-xs text-slate-400">{monthCardCount} 張卡片</span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {blanks.map(i => <div key={`b-${i}`} className="w-3 h-3" />)}
        {days.map(day => {
          const cellDate = new Date(year, month, day)
          const isToday = isSameDay(cellDate, today)
          const count = entryCountForDay(day)
          const dayEntries = monthEntries.filter(e => e.date.getDate() === day)

          return (
            <div
              key={day}
              className="relative"
              onMouseEnter={(e) => { e.stopPropagation(); if (count > 0) setHoveredDay(day) }}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <div
                className={`w-3 h-3 rounded-sm ${heatColor(count)} ${isToday ? 'ring-1 ring-blue-500' : ''}`}
                title={`${month + 1}/${day}: ${count} 筆日期`}
              />
              {/* Tooltip */}
              {hoveredDay === day && dayEntries.length > 0 && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[180px] max-w-[240px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-xs font-medium text-slate-500 mb-1">{month + 1}月{day}日</div>
                  {dayEntries.map((entry, idx) => (
                    <div
                      key={`${entry.card.id}-${entry.type}-${idx}`}
                      onClick={(e) => { e.stopPropagation(); onCardClick(entry.card) }}
                      className="text-xs py-1 px-1.5 rounded hover:bg-slate-50 cursor-pointer truncate flex items-center gap-1.5"
                    >
                      {entry.type === 'due' && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.card.columnColor }} />
                      )}
                      {entry.type === 'planned' && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-transparent ring-1.5 ring-blue-400" />
                      )}
                      {entry.type === 'actual' && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400 ring-1.5 ring-emerald-300" />
                      )}
                      <span className="truncate">{entry.card.title}</span>
                      <span className="text-slate-400 flex-shrink-0">({DATE_TYPE_STYLES[entry.type].label})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// CalendarView — main container with mode switching & navigation
// ──────────────────────────────────────────────
export function CalendarView({ columns, onCardClick }: { columns: Column[], onCardClick: (card: Card) => void }) {
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month')
  const [viewDate, setViewDate] = useState(new Date())

  const today = new Date()

  // Pre-compute all cards with any date + column metadata
  // A card appears if it has at least one of: due_date, planned_completion_date, actual_completion_date
  const cardsWithDates: CardWithColumn[] = columns.flatMap(col =>
    col.cards
      .filter(c => c.due_date || c.planned_completion_date || c.actual_completion_date)
      .map(card => ({ ...card, columnName: col.name, columnColor: col.color }))
  )

  // --- Navigation ---
  function navigatePrev() {
    setViewDate(prev => {
      const d = new Date(prev)
      if (calendarMode === 'month') d.setMonth(d.getMonth() - 1)
      else if (calendarMode === 'quarter') d.setMonth(d.getMonth() - 3)
      else d.setFullYear(d.getFullYear() - 1)
      return d
    })
  }

  function navigateNext() {
    setViewDate(prev => {
      const d = new Date(prev)
      if (calendarMode === 'month') d.setMonth(d.getMonth() + 1)
      else if (calendarMode === 'quarter') d.setMonth(d.getMonth() + 3)
      else d.setFullYear(d.getFullYear() + 1)
      return d
    })
  }

  function navigateToday() {
    setViewDate(new Date())
  }

  // --- "Today" button disabled state ---
  const isCurrentPeriod = (() => {
    const vy = viewDate.getFullYear()
    const vm = viewDate.getMonth()
    const ty = today.getFullYear()
    const tm = today.getMonth()
    if (calendarMode === 'month') return vy === ty && vm === tm
    if (calendarMode === 'quarter') {
      return vy === ty && Math.floor(vm / 3) === Math.floor(tm / 3)
    }
    return vy === ty
  })()

  // --- Dynamic title ---
  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()
  const viewQuarter = Math.floor(viewMonth / 3) + 1
  const quarterStartMonth = (viewQuarter - 1) * 3 + 1
  const quarterEndMonth = quarterStartMonth + 2

  const title = (() => {
    if (calendarMode === 'month') return `${viewYear}年 ${viewMonth + 1}月`
    if (calendarMode === 'quarter') return `${viewYear}年 Q${viewQuarter} (${quarterStartMonth}-${quarterEndMonth}月)`
    return `${viewYear}年`
  })()

  // --- Navigation labels for a11y ---
  const prevLabel = calendarMode === 'month' ? '上個月' : calendarMode === 'quarter' ? '上個季度' : '上一年'
  const nextLabel = calendarMode === 'month' ? '下個月' : calendarMode === 'quarter' ? '下個季度' : '下一年'

  // --- Month click from YearView ---
  function handleMonthClick(month: number) {
    setViewDate(new Date(viewYear, month, 1))
    setCalendarMode('month')
  }

  const modeOptions: { id: CalendarMode; label: string }[] = [
    { id: 'month', label: '月' },
    { id: 'quarter', label: '季' },
    { id: 'year', label: '年' },
  ]

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-wrap gap-2">
        {/* Left: Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={navigatePrev}
            aria-label={prevLabel}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={navigateToday}
            aria-label="回到今天"
            className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
              isCurrentPeriod
                ? 'text-slate-300 cursor-default'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            disabled={isCurrentPeriod}
          >
            今天
          </button>
          <button
            onClick={navigateNext}
            aria-label={nextLabel}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Center: Title */}
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>

        {/* Right: Mode tabs */}
        <div className="bg-slate-100 rounded-lg p-1 flex">
          {modeOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setCalendarMode(opt.id)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                calendarMode === opt.id
                  ? 'bg-white shadow-sm text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          截止日
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-transparent ring-1.5 ring-blue-400" />
          預計完成
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-emerald-300" />
          實際完成
        </span>
      </div>

      {/* Content */}
      <div className="p-4">
        {calendarMode === 'month' && (
          <MonthView
            year={viewYear}
            month={viewMonth}
            cards={cardsWithDates}
            onCardClick={onCardClick}
          />
        )}
        {calendarMode === 'quarter' && (
          <QuarterView
            year={viewYear}
            quarter={viewQuarter}
            cards={cardsWithDates}
            onCardClick={onCardClick}
          />
        )}
        {calendarMode === 'year' && (
          <YearView
            year={viewYear}
            cards={cardsWithDates}
            onCardClick={onCardClick}
            onMonthClick={handleMonthClick}
          />
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Progress View Component
// ──────────────────────────────────────────────
export function ProgressView({ columns }: { columns: Column[] }) {
  const allCards = columns.flatMap(col => col.cards)
  const totalCards = allCards.length
  const overallProgress = totalCards > 0
    ? Math.round(allCards.reduce((sum, card) => sum + (card.progress || 0), 0) / totalCards)
    : 0
  const completedCards = allCards.filter(c => (c.progress || 0) === 100).length

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-6">專案進度</h3>

      <div className="mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-600">整體進度</span>
          <span className="font-medium">{overallProgress}%</span>
        </div>
        <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${overallProgress}%`,
              backgroundColor: overallProgress === 100 ? '#10B981' : '#3B82F6'
            }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {columns.map(col => {
          const colTotal = col.cards.length
          const colAvgProgress = colTotal > 0
            ? Math.round(col.cards.reduce((sum, c) => sum + (c.progress || 0), 0) / colTotal)
            : 0

          return (
            <div key={col.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} />
                  {col.name}
                </span>
                <span className="text-slate-500">{colTotal} 任務</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${colAvgProgress}%`, backgroundColor: col.color }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">{totalCards}</div>
          <div className="text-sm text-slate-500">總任務</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{totalCards - completedCards}</div>
          <div className="text-sm text-slate-500">進行中</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{completedCards}</div>
          <div className="text-sm text-slate-500">已完成</div>
        </div>
      </div>
    </div>
  )
}
