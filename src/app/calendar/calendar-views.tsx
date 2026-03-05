'use client'

import { useState, useMemo } from 'react'

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type CalendarMode = 'month' | 'quarter' | 'year'

export interface CalendarCard {
  id: string
  card_number: number | null
  title: string
  progress: number
  priority: 'low' | 'medium' | 'high'
  due_date: string | null
  start_date: string | null
  planned_completion_date: string | null
  actual_completion_date: string | null
  column_name: string
  column_color: string
  project_id: string
  project_name: string
  assignees: { id: string; name: string }[]
  tags: { id: string; name: string; color: string }[]
}

export interface CalendarProject {
  id: string
  name: string
}

type CardWithColumn = CalendarCard & { columnName: string; columnColor: string }
type DateEntryType = 'due' | 'planned' | 'actual'

interface DateEntry {
  card: CardWithColumn
  type: DateEntryType
  date: Date
}

const DATE_TYPE_STYLES: Record<DateEntryType, { label: string }> = {
  due:     { label: '截止日' },
  planned: { label: '預計完成' },
  actual:  { label: '實際完成' },
}

// ──────────────────────────────────────────────
// Utilities (mirrored from views.tsx)
// ──────────────────────────────────────────────

function parseDueDate(due: string): Date {
  return new Date(due.split('T')[0] + 'T00:00:00')
}

function getMonthData(year: number, month: number) {
  return {
    daysInMonth: new Date(year, month + 1, 0).getDate(),
    firstDay: new Date(year, month, 1).getDay(),
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function collectDateEntries(cards: CardWithColumn[]): DateEntry[] {
  const entries: DateEntry[] = []
  for (const card of cards) {
    if (card.due_date) entries.push({ card, type: 'due', date: parseDueDate(card.due_date) })
    if (card.planned_completion_date) entries.push({ card, type: 'planned', date: parseDueDate(card.planned_completion_date) })
    if (card.actual_completion_date) entries.push({ card, type: 'actual', date: parseDueDate(card.actual_completion_date) })
  }
  return entries
}

// ──────────────────────────────────────────────
// MonthView
// ──────────────────────────────────────────────

function MonthView({ year, month, cards, onCardClick }: {
  year: number
  month: number
  cards: CardWithColumn[]
  onCardClick: (card: CalendarCard) => void
}) {
  const today = new Date()
  const { daysInMonth, firstDay } = getMonthData(year, month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDay }, (_, i) => i)

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
      {blanks.map(i => <div key={`blank-${i}`} className="h-28" />)}
      {days.map(day => {
        const cellDate = new Date(year, month, day)
        const isToday = isSameDay(cellDate, today)
        const dayEntries = monthEntries.filter(e => e.date.getDate() === day)

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
            className={`h-28 border rounded p-1 overflow-hidden ${isToday ? 'bg-blue-50 border-blue-200' : ''}`}
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
                <span className="flex items-center gap-0.5 flex-shrink-0">
                  {types.includes('due') && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: card.columnColor }} title="截止日" />
                  )}
                  {types.includes('planned') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-transparent ring-1 ring-blue-400" title="預計完成" />
                  )}
                  {types.includes('actual') && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-emerald-300" title="實際完成" />
                  )}
                </span>
                <span className="truncate text-slate-600">
                  <span className="text-slate-400">[{card.project_name}]</span>{' '}
                  {card.card_number != null ? `#${card.card_number} ` : ''}{card.title}
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
// QuarterView
// ──────────────────────────────────────────────

function QuarterView({ year, quarter, cards, onCardClick }: {
  year: number
  quarter: number
  cards: CardWithColumn[]
  onCardClick: (card: CalendarCard) => void
}) {
  const startMonth = (quarter - 1) * 3
  const months = [startMonth, startMonth + 1, startMonth + 2]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {months.map(m => (
        <MiniMonth key={m} year={year} month={m} cards={cards} onCardClick={onCardClick} />
      ))}
    </div>
  )
}

function MiniMonth({ year, month, cards, onCardClick }: {
  year: number
  month: number
  cards: CardWithColumn[]
  onCardClick: (card: CalendarCard) => void
}) {
  const today = new Date()
  const { daysInMonth, firstDay } = getMonthData(year, month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDay }, (_, i) => i)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

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

          const typesInDay = new Set(dayEntries.map(e => e.type))
          const dots: { key: string; type: DateEntryType; color: string }[] = []
          if (typesInDay.has('due')) {
            const dueCards = dayEntries.filter(e => e.type === 'due')
            dueCards.slice(0, 1).forEach(e => dots.push({ key: `due-${e.card.id}`, type: 'due', color: e.card.columnColor }))
          }
          if (typesInDay.has('planned')) dots.push({ key: 'planned', type: 'planned', color: '#60A5FA' })
          if (typesInDay.has('actual')) dots.push({ key: 'actual', type: 'actual', color: '#34D399' })

          return (
            <div
              key={day}
              className="relative h-8 flex flex-col items-center justify-center cursor-default"
              onMouseEnter={() => dayEntries.length > 0 ? setHoveredDay(day) : undefined}
              onMouseLeave={() => setHoveredDay(null)}
            >
              <span className={`text-xs leading-none ${
                isToday ? 'bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold' : 'text-slate-600'
              }`}>
                {day}
              </span>
              {dayEntries.length > 0 && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {dots.slice(0, 3).map(dot => {
                    if (dot.type === 'planned') return <span key={dot.key} className="w-1.5 h-1.5 rounded-full bg-transparent ring-1 ring-blue-400" />
                    if (dot.type === 'actual') return <span key={dot.key} className="w-1.5 h-1.5 rounded-full bg-emerald-400 ring-1 ring-emerald-300" />
                    return <span key={dot.key} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dot.color }} />
                  })}
                </div>
              )}
              {hoveredDay === day && dayEntries.length > 0 && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[200px] max-w-[280px]">
                  <div className="text-xs font-medium text-slate-500 mb-1">{month + 1}月{day}日</div>
                  {dayEntries.map((entry, idx) => (
                    <div
                      key={`${entry.card.id}-${entry.type}-${idx}`}
                      onClick={() => onCardClick(entry.card)}
                      className="text-xs py-1 px-1.5 rounded hover:bg-slate-50 cursor-pointer truncate flex items-center gap-1.5"
                    >
                      {entry.type === 'due' && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.card.columnColor }} />}
                      {entry.type === 'planned' && <span className="w-2 h-2 rounded-full flex-shrink-0 bg-transparent ring-1.5 ring-blue-400" />}
                      {entry.type === 'actual' && <span className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400 ring-1.5 ring-emerald-300" />}
                      <span className="text-slate-400 flex-shrink-0">[{entry.card.project_name}]</span>
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
// YearView
// ──────────────────────────────────────────────

function heatColor(count: number): string {
  if (count === 0) return 'bg-slate-100'
  if (count === 1) return 'bg-blue-200'
  if (count === 2) return 'bg-blue-300'
  return 'bg-blue-500'
}

function YearView({ year, cards, onCardClick, onMonthClick }: {
  year: number
  cards: CardWithColumn[]
  onCardClick: (card: CalendarCard) => void
  onMonthClick: (month: number) => void
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }, (_, m) => (
        <YearMonthTile key={m} year={year} month={m} cards={cards} onCardClick={onCardClick} onMonthClick={onMonthClick} />
      ))}
    </div>
  )
}

function YearMonthTile({ year, month, cards, onCardClick, onMonthClick }: {
  year: number
  month: number
  cards: CardWithColumn[]
  onCardClick: (card: CalendarCard) => void
  onMonthClick: (month: number) => void
}) {
  const today = new Date()
  const { daysInMonth, firstDay } = getMonthData(year, month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDay }, (_, i) => i)
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)

  const allEntries = collectDateEntries(cards)
  const monthEntries = allEntries.filter(e =>
    e.date.getFullYear() === year && e.date.getMonth() === month
  )

  const uniqueCardIds = new Set(monthEntries.map(e => e.card.id))
  const monthCardCount = uniqueCardIds.size
  const entryCountForDay = (day: number) => monthEntries.filter(e => e.date.getDate() === day).length

  return (
    <div className="bg-white rounded-lg shadow p-3 cursor-pointer hover:shadow-md transition-shadow" onClick={() => onMonthClick(month)}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-slate-700">{month + 1}月</h4>
        {monthCardCount > 0 && <span className="text-xs text-slate-400">{monthCardCount} 張卡片</span>}
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
              {hoveredDay === day && dayEntries.length > 0 && (
                <div
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[200px] max-w-[280px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-xs font-medium text-slate-500 mb-1">{month + 1}月{day}日</div>
                  {dayEntries.map((entry, idx) => (
                    <div
                      key={`${entry.card.id}-${entry.type}-${idx}`}
                      onClick={(e) => { e.stopPropagation(); onCardClick(entry.card) }}
                      className="text-xs py-1 px-1.5 rounded hover:bg-slate-50 cursor-pointer truncate flex items-center gap-1.5"
                    >
                      {entry.type === 'due' && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.card.columnColor }} />}
                      {entry.type === 'planned' && <span className="w-2 h-2 rounded-full flex-shrink-0 bg-transparent ring-1.5 ring-blue-400" />}
                      {entry.type === 'actual' && <span className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-400 ring-1.5 ring-emerald-300" />}
                      <span className="text-slate-400 flex-shrink-0">[{entry.card.project_name}]</span>
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
// GlobalCalendarView — main exported component
// ──────────────────────────────────────────────

export function GlobalCalendarView({
  cards: rawCards,
  projects,
}: {
  cards: CalendarCard[]
  projects: CalendarProject[]
}) {
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('month')
  const [viewDate, setViewDate] = useState(new Date())
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set(projects.map(p => p.id)))
  const [filterOpen, setFilterOpen] = useState(false)

  const today = new Date()

  // Map raw cards to CardWithColumn format
  const cardsWithDates: CardWithColumn[] = useMemo(() =>
    rawCards
      .filter(c => selectedProjects.has(c.project_id))
      .filter(c => c.due_date || c.planned_completion_date || c.actual_completion_date)
      .map(card => ({ ...card, columnName: card.column_name, columnColor: card.column_color })),
    [rawCards, selectedProjects]
  )

  // Navigation
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

  const isCurrentPeriod = (() => {
    const vy = viewDate.getFullYear()
    const vm = viewDate.getMonth()
    const ty = today.getFullYear()
    const tm = today.getMonth()
    if (calendarMode === 'month') return vy === ty && vm === tm
    if (calendarMode === 'quarter') return vy === ty && Math.floor(vm / 3) === Math.floor(tm / 3)
    return vy === ty
  })()

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

  const prevLabel = calendarMode === 'month' ? '上個月' : calendarMode === 'quarter' ? '上個季度' : '上一年'
  const nextLabel = calendarMode === 'month' ? '下個月' : calendarMode === 'quarter' ? '下個季度' : '下一年'

  function handleMonthClick(month: number) {
    setViewDate(new Date(viewYear, month, 1))
    setCalendarMode('month')
  }

  function handleCardClick(card: CalendarCard) {
    window.location.href = `/projects/${card.project_id}?card=${card.id}`
  }

  function toggleProject(projectId: string) {
    setSelectedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  function selectAllProjects() {
    setSelectedProjects(new Set(projects.map(p => p.id)))
  }

  function clearAllProjects() {
    setSelectedProjects(new Set())
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
              isCurrentPeriod ? 'text-slate-300 cursor-default' : 'text-slate-600 hover:bg-slate-100'
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

        {/* Right: Filter + Mode tabs */}
        <div className="flex items-center gap-2">
          {/* Project filter */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                selectedProjects.size < projects.length
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                專案 ({selectedProjects.size}/{projects.length})
              </span>
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 min-w-[200px]">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b">
                    <button onClick={selectAllProjects} className="text-xs text-blue-600 hover:text-blue-800">全選</button>
                    <button onClick={clearAllProjects} className="text-xs text-slate-500 hover:text-slate-700">清除</button>
                  </div>
                  {projects.map(p => (
                    <label key={p.id} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedProjects.has(p.id)}
                        onChange={() => toggleProject(p.id)}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700 truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Mode tabs */}
          <div className="bg-slate-100 rounded-lg p-1 flex">
            {modeOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setCalendarMode(opt.id)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  calendarMode === opt.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
        {cardsWithDates.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>沒有含日期的卡片</p>
            <p className="text-sm mt-1">為卡片設定截止日或完成日期後，會顯示在這裡</p>
          </div>
        ) : (
          <>
            {calendarMode === 'month' && (
              <MonthView year={viewYear} month={viewMonth} cards={cardsWithDates} onCardClick={handleCardClick} />
            )}
            {calendarMode === 'quarter' && (
              <QuarterView year={viewYear} quarter={viewQuarter} cards={cardsWithDates} onCardClick={handleCardClick} />
            )}
            {calendarMode === 'year' && (
              <YearView year={viewYear} cards={cardsWithDates} onCardClick={handleCardClick} onMonthClick={handleMonthClick} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
