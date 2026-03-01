'use client'

import { useState } from 'react'
import type { Card, Column, Phase, CalendarMode } from './types'

const PRIORITY_CONFIG = {
  high:   { color: 'bg-red-500',    label: '高' },
  medium: { color: 'bg-yellow-400', label: '中' },
  low:    { color: 'bg-green-500',  label: '低' },
} as const

// List View Component
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
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">截止日</th>
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
              <td className="px-4 py-3 text-sm text-slate-600">
                {card.due_date ? new Date(card.due_date.split('T')[0] + 'T00:00:00').toLocaleDateString('zh-TW') : '-'}
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

// --- Calendar View Utilities & Sub-components ---

type CardWithColumn = Card & { columnName: string; columnColor: string }

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

/** Normalise a due_date string to a local Date (timezone-safe) */
function parseDueDate(due: string): Date {
  return new Date(due.split('T')[0] + 'T00:00:00')
}

// ──────────────────────────────────────────────
// MonthView — full-size month calendar (refactored from original CalendarView)
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

  const monthCards = cards.filter(c => {
    const d = parseDueDate(c.due_date!)
    return d.getFullYear() === year && d.getMonth() === month
  })

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
        const dayCards = monthCards.filter(c => parseDueDate(c.due_date!).getDate() === day)

        return (
          <div
            key={day}
            className={`h-24 border rounded p-1 ${isToday ? 'bg-blue-50 border-blue-200' : ''}`}
          >
            <div className={`text-sm mb-1 ${isToday ? 'font-bold text-blue-600' : 'text-slate-500'}`}>
              {day}
            </div>
            {dayCards.map(card => (
              <div
                key={card.id}
                onClick={() => onCardClick(card)}
                className="text-xs p-1 mb-1 rounded truncate cursor-pointer hover:opacity-80"
                style={{ backgroundColor: card.columnColor + '30', color: card.columnColor }}
              >
                {card.title}
              </div>
            ))}
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

  const monthCards = cards.filter(c => {
    const d = parseDueDate(c.due_date!)
    return d.getFullYear() === year && d.getMonth() === month
  })

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
          const dayCards = monthCards.filter(c => parseDueDate(c.due_date!).getDate() === day)
          const dotsToShow = dayCards.slice(0, 3)
          const overflow = dayCards.length - 3

          return (
            <div
              key={day}
              className="relative h-8 flex flex-col items-center justify-center cursor-default"
              onMouseEnter={() => dayCards.length > 0 ? setHoveredDay(day) : undefined}
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
              {dayCards.length > 0 && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {dotsToShow.map(c => (
                    <span
                      key={c.id}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: c.columnColor }}
                    />
                  ))}
                  {overflow > 0 && (
                    <span className="text-[8px] text-slate-400">+{overflow}</span>
                  )}
                </div>
              )}
              {/* Tooltip */}
              {hoveredDay === day && dayCards.length > 0 && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[160px] max-w-[220px]">
                  <div className="text-xs font-medium text-slate-500 mb-1">{month + 1}月{day}日</div>
                  {dayCards.map(card => (
                    <div
                      key={card.id}
                      onClick={() => onCardClick(card)}
                      className="text-xs py-1 px-1.5 rounded hover:bg-slate-50 cursor-pointer truncate flex items-center gap-1.5"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: card.columnColor }} />
                      <span className="truncate">{card.title}</span>
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

/** Heatmap colour based on card count */
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

  const monthCards = cards.filter(c => {
    const d = parseDueDate(c.due_date!)
    return d.getFullYear() === year && d.getMonth() === month
  })

  const cardCountForDay = (day: number) =>
    monthCards.filter(c => parseDueDate(c.due_date!).getDate() === day).length

  return (
    <div
      className="bg-white rounded-lg shadow p-3 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => onMonthClick(month)}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-700">{month + 1}月</h4>
        {monthCards.length > 0 && (
          <span className="text-xs text-slate-400">{monthCards.length} 張卡片</span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {blanks.map(i => <div key={`b-${i}`} className="w-3 h-3" />)}
        {days.map(day => {
          const cellDate = new Date(year, month, day)
          const isToday = isSameDay(cellDate, today)
          const count = cardCountForDay(day)
          const dayCards = monthCards.filter(c => parseDueDate(c.due_date!).getDate() === day)

          return (
            <div
              key={day}
              className="relative"
              onMouseEnter={(e) => { e.stopPropagation(); if (count > 0) setHoveredDay(day) }}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <div
                className={`w-3 h-3 rounded-sm ${heatColor(count)} ${isToday ? 'ring-1 ring-blue-500' : ''}`}
                title={`${month + 1}/${day}: ${count} 張卡片`}
              />
              {/* Tooltip */}
              {hoveredDay === day && dayCards.length > 0 && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[160px] max-w-[220px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-xs font-medium text-slate-500 mb-1">{month + 1}月{day}日</div>
                  {dayCards.map(card => (
                    <div
                      key={card.id}
                      onClick={(e) => { e.stopPropagation(); onCardClick(card) }}
                      className="text-xs py-1 px-1.5 rounded hover:bg-slate-50 cursor-pointer truncate flex items-center gap-1.5"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: card.columnColor }} />
                      <span className="truncate">{card.title}</span>
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

  // Pre-compute all cards with due_date + column metadata
  const cardsWithDue: CardWithColumn[] = columns.flatMap(col =>
    col.cards
      .filter(c => c.due_date)
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

      {/* Content */}
      <div className="p-4">
        {calendarMode === 'month' && (
          <MonthView
            year={viewYear}
            month={viewMonth}
            cards={cardsWithDue}
            onCardClick={onCardClick}
          />
        )}
        {calendarMode === 'quarter' && (
          <QuarterView
            year={viewYear}
            quarter={viewQuarter}
            cards={cardsWithDue}
            onCardClick={onCardClick}
          />
        )}
        {calendarMode === 'year' && (
          <YearView
            year={viewYear}
            cards={cardsWithDue}
            onCardClick={onCardClick}
            onMonthClick={handleMonthClick}
          />
        )}
      </div>
    </div>
  )
}

// Progress View Component
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
