'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import type { Card, Column, Phase, GanttScale } from './types'

// ──────────────────────────────────────────────
// Constants & Config
// ──────────────────────────────────────────────

const DAY_WIDTH: Record<GanttScale, number> = {
  week: 40,
  month: 12,
}

const SCALE_LABELS: Record<GanttScale, string> = {
  week: '週',
  month: '月',
}

const PRIORITY_BORDER_COLORS: Record<string, string> = {
  urgent: '#EF4444', // red-500
  high: '#F97316',   // orange-500
  medium: '#EAB308', // yellow-500
  low: '#22C55E',    // green-500
}

const BAR_HEIGHT = 28
const ROW_HEIGHT = 36
const HEADER_HEIGHT = 52
const PHASE_HEADER_HEIGHT = 32
const MS_PER_DAY = 86400000

const UNPHASED_GROUP_ID = '__unphased__'

// ──────────────────────────────────────────────
// Date Utilities
// ──────────────────────────────────────────────

function parseDate(dateStr: string): Date {
  return new Date(dateStr.split('T')[0] + 'T00:00:00')
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + n)
  return result
}

function formatMonth(d: Date): string {
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
}

function formatWeek(d: Date): string {
  const weekStart = new Date(d)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekEnd = addDays(weekStart, 6)
  const sm = weekStart.getMonth() + 1
  const sd = weekStart.getDate()
  const em = weekEnd.getMonth() + 1
  const ed = weekEnd.getDate()
  return `${sm}/${sd} - ${em}/${ed}`
}

function formatDateFull(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
}

function getStartOfWeek(d: Date): Date {
  const result = new Date(d)
  result.setDate(result.getDate() - result.getDay())
  return result
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

// ──────────────────────────────────────────────
// Data Processing
// ──────────────────────────────────────────────

interface ProcessedCard extends Card {
  columnName: string
  columnColor: string
}

interface PhaseGroupData {
  phaseId: string
  phaseName: string
  phaseColor: string
  phaseProgress: number
  cards: ProcessedCard[]
  isExpanded: boolean
}

function getTimeRange(
  cards: ProcessedCard[],
  paddingDays: number = 7
): { rangeStart: Date; rangeEnd: Date } | null {
  const dates: Date[] = []

  for (const card of cards) {
    if (card.start_date) dates.push(parseDate(card.start_date))
    if (card.due_date) dates.push(parseDate(card.due_date))
  }

  if (dates.length === 0) return null

  const min = new Date(Math.min(...dates.map(d => d.getTime())))
  const max = new Date(Math.max(...dates.map(d => d.getTime())))

  return {
    rangeStart: addDays(min, -paddingDays),
    rangeEnd: addDays(max, paddingDays),
  }
}

function getScheduledCards(columns: Column[]): ProcessedCard[] {
  return columns.flatMap(col =>
    col.cards
      .filter(c => c.start_date || c.due_date)
      .map(c => ({ ...c, columnName: col.name, columnColor: col.color }))
  )
}

function getUnscheduledCards(columns: Column[]): ProcessedCard[] {
  return columns.flatMap(col =>
    col.cards
      .filter(c => !c.start_date && !c.due_date)
      .map(c => ({ ...c, columnName: col.name, columnColor: col.color }))
  )
}

function groupByPhase(
  cards: ProcessedCard[],
  phases: Phase[]
): { phaseId: string; phaseName: string; phaseColor: string; phaseProgress: number; cards: ProcessedCard[] }[] {
  const phaseMap = new Map<string, Phase>()
  for (const p of phases) phaseMap.set(p.id, p)

  const groups = new Map<
    string,
    { phaseId: string; phaseName: string; phaseColor: string; phaseProgress: number; cards: ProcessedCard[] }
  >()

  // Initialize groups for existing phases (keep position order)
  const sortedPhases = [...phases].sort((a, b) => a.position - b.position)
  for (const p of sortedPhases) {
    groups.set(p.id, {
      phaseId: p.id,
      phaseName: p.name,
      phaseColor: p.color,
      phaseProgress: p.progress,
      cards: [],
    })
  }

  // Add unphased group
  groups.set(UNPHASED_GROUP_ID, {
    phaseId: UNPHASED_GROUP_ID,
    phaseName: '未分類',
    phaseColor: '#94A3B8', // slate-400
    phaseProgress: 0,
    cards: [],
  })

  for (const card of cards) {
    const groupId = card.phase_id || UNPHASED_GROUP_ID
    const group = groups.get(groupId)
    if (group) {
      group.cards.push(card)
    } else {
      // Phase id exists on card but not in phases list — put in unphased
      const unphased = groups.get(UNPHASED_GROUP_ID)!
      unphased.cards.push(card)
    }
  }

  // Calculate unphased progress
  const unphasedGroup = groups.get(UNPHASED_GROUP_ID)!
  if (unphasedGroup.cards.length > 0) {
    unphasedGroup.phaseProgress = Math.round(
      unphasedGroup.cards.reduce((sum, c) => sum + (c.progress || 0), 0) / unphasedGroup.cards.length
    )
  }

  // Return only groups with cards
  return Array.from(groups.values()).filter(g => g.cards.length > 0)
}

// ──────────────────────────────────────────────
// GanttToolbar
// ──────────────────────────────────────────────

function GanttToolbar({
  scale,
  onScaleChange,
  onNavigatePrev,
  onNavigateNext,
  onNavigateToday,
  title,
}: {
  scale: GanttScale
  onScaleChange: (scale: GanttScale) => void
  onNavigatePrev: () => void
  onNavigateNext: () => void
  onNavigateToday: () => void
  title: string
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b flex-wrap gap-2">
      {/* Left: Navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={onNavigatePrev}
          aria-label="前一段時間"
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={onNavigateToday}
          aria-label="回到今天"
          className="px-3 py-1 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          今天
        </button>
        <button
          onClick={onNavigateNext}
          aria-label="後一段時間"
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Center: Title */}
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>

      {/* Right: Scale tabs */}
      <div className="bg-slate-100 rounded-lg p-1 flex">
        {(['week', 'month'] as GanttScale[]).map(s => (
          <button
            key={s}
            onClick={() => onScaleChange(s)}
            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
              scale === s
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {SCALE_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// GanttHeader — time axis
// ──────────────────────────────────────────────

function GanttHeader({
  rangeStart,
  rangeEnd,
  dayWidth,
  scale,
}: {
  rangeStart: Date
  rangeEnd: Date
  dayWidth: number
  scale: GanttScale
}) {
  const totalDays = daysBetween(rangeStart, rangeEnd)
  const today = new Date()

  if (scale === 'week') {
    // Top row: month labels, bottom row: day numbers
    const months: { label: string; startDay: number; span: number }[] = []
    let currentMonth = -1
    let currentYear = -1

    for (let i = 0; i < totalDays; i++) {
      const d = addDays(rangeStart, i)
      const m = d.getMonth()
      const y = d.getFullYear()
      if (m !== currentMonth || y !== currentYear) {
        months.push({ label: `${y}年 ${m + 1}月`, startDay: i, span: 1 })
        currentMonth = m
        currentYear = y
      } else {
        months[months.length - 1].span++
      }
    }

    return (
      <div className="sticky top-0 z-10 bg-white border-b" style={{ height: HEADER_HEIGHT }}>
        {/* Month row */}
        <div className="flex border-b" style={{ height: HEADER_HEIGHT / 2 }}>
          {months.map((m, i) => (
            <div
              key={i}
              className="text-xs font-semibold text-slate-600 flex items-center px-2 border-r border-slate-200"
              style={{ width: m.span * dayWidth, minWidth: m.span * dayWidth }}
            >
              {m.label}
            </div>
          ))}
        </div>
        {/* Day row */}
        <div className="flex" style={{ height: HEADER_HEIGHT / 2 }}>
          {Array.from({ length: totalDays }, (_, i) => {
            const d = addDays(rangeStart, i)
            const isToday_ = isSameDay(d, today)
            const isWkend = isWeekend(d)
            return (
              <div
                key={i}
                className={`text-[10px] flex items-center justify-center border-r border-slate-100 flex-shrink-0 ${
                  isToday_ ? 'bg-blue-50 text-blue-600 font-bold' : isWkend ? 'text-slate-400 bg-slate-50' : 'text-slate-500'
                }`}
                style={{ width: dayWidth, minWidth: dayWidth }}
              >
                {d.getDate()}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Month scale: top row = month labels, bottom row = week markers
  const months: { label: string; startDay: number; span: number }[] = []
  let currentMonth = -1
  let currentYear = -1

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(rangeStart, i)
    const m = d.getMonth()
    const y = d.getFullYear()
    if (m !== currentMonth || y !== currentYear) {
      months.push({ label: `${y}年 ${m + 1}月`, startDay: i, span: 1 })
      currentMonth = m
      currentYear = y
    } else {
      months[months.length - 1].span++
    }
  }

  // Weekly markers for month view
  const weeks: { label: string; startDay: number; span: number }[] = []
  let weekStart = getStartOfWeek(rangeStart)
  while (weekStart < rangeEnd) {
    const weekEnd = addDays(weekStart, 7)
    const startOffset = Math.max(0, daysBetween(rangeStart, weekStart))
    const endOffset = Math.min(totalDays, daysBetween(rangeStart, weekEnd))
    const span = endOffset - startOffset
    if (span > 0) {
      weeks.push({
        label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        startDay: startOffset,
        span,
      })
    }
    weekStart = weekEnd
  }

  return (
    <div className="sticky top-0 z-10 bg-white border-b" style={{ height: HEADER_HEIGHT }}>
      {/* Month row */}
      <div className="flex border-b" style={{ height: HEADER_HEIGHT / 2 }}>
        {months.map((m, i) => (
          <div
            key={i}
            className="text-xs font-semibold text-slate-600 flex items-center px-1 border-r border-slate-200"
            style={{ width: m.span * dayWidth, minWidth: m.span * dayWidth }}
          >
            {m.label}
          </div>
        ))}
      </div>
      {/* Week row */}
      <div className="flex" style={{ height: HEADER_HEIGHT / 2 }}>
        {weeks.map((w, i) => (
          <div
            key={i}
            className="text-[10px] text-slate-400 flex items-center justify-center border-r border-slate-100"
            style={{ width: w.span * dayWidth, minWidth: w.span * dayWidth }}
          >
            {w.label}
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// GanttBar — single task bar
// ──────────────────────────────────────────────

function GanttBar({
  card,
  rangeStart,
  dayWidth,
  phaseColor,
  onCardClick,
}: {
  card: ProcessedCard
  rangeStart: Date
  dayWidth: number
  phaseColor: string
  onCardClick: (card: Card) => void
}) {
  const [showTooltip, setShowTooltip] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  const startDate = card.start_date ? parseDate(card.start_date) : null
  const dueDate = card.due_date ? parseDate(card.due_date) : null

  // Compute bar position and width
  let barStart: Date
  let barDays: number
  let isDashed = false
  let isDot = false

  if (startDate && dueDate) {
    barStart = startDate
    barDays = Math.max(1, daysBetween(startDate, dueDate) + 1)
  } else if (dueDate && !startDate) {
    // Only due_date: show as a dot/circle marker
    barStart = dueDate
    barDays = 1
    isDot = true
  } else if (startDate && !dueDate) {
    // Only start_date: dashed bar extending 14 days
    barStart = startDate
    barDays = 14
    isDashed = true
  } else {
    return null // Should not happen (filtered out)
  }

  const leftDays = daysBetween(rangeStart, barStart)
  const left = leftDays * dayWidth
  const width = barDays * dayWidth

  const priorityColor = PRIORITY_BORDER_COLORS[card.priority] || PRIORITY_BORDER_COLORS.medium
  const progress = card.progress || 0

  const assigneeNames = card.assignees?.map(a => a.name).join(', ') || '-'

  return (
    <div
      className="relative"
      style={{ height: ROW_HEIGHT }}
    >
      {/* Task label on the left sidebar is handled by PhaseGroup */}
      <div
        ref={barRef}
        className={`absolute top-1 rounded cursor-pointer transition-opacity hover:opacity-90 ${
          isDashed ? 'border-dashed border' : ''
        } ${isDot ? 'rounded-full' : 'rounded'}`}
        style={{
          left,
          width: isDot ? BAR_HEIGHT : Math.max(width, dayWidth),
          height: BAR_HEIGHT,
          backgroundColor: isDot ? 'transparent' : phaseColor + '33',
          borderColor: isDashed ? phaseColor : 'transparent',
          borderLeftWidth: isDot ? 0 : 3,
          borderLeftColor: priorityColor,
          borderLeftStyle: 'solid',
        }}
        onClick={() => onCardClick(card)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Progress fill */}
        {!isDot && progress > 0 && (
          <div
            className="absolute top-0 left-0 h-full rounded-l"
            style={{
              width: `${progress}%`,
              backgroundColor: phaseColor + '88',
              borderRadius: progress === 100 ? 'inherit' : undefined,
            }}
          />
        )}

        {/* Dot marker for due-date-only cards */}
        {isDot && (
          <div
            className="absolute inset-0 m-auto w-3 h-3 rounded-full"
            style={{
              backgroundColor: phaseColor,
              border: `2px solid ${priorityColor}`,
            }}
          />
        )}

        {/* Bar label (only if wide enough) */}
        {!isDot && width > 60 && (
          <span
            className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium truncate pointer-events-none"
            style={{
              maxWidth: width - 16,
              color: phaseColor,
              filter: 'brightness(0.6)',
            }}
          >
            {card.title}
          </span>
        )}

        {/* Tooltip */}
        {showTooltip && (
          <div
            className="absolute z-30 bg-white border border-slate-200 rounded-lg shadow-lg p-3 min-w-[220px] whitespace-nowrap pointer-events-none"
            style={{
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              marginBottom: 4,
            }}
          >
            <div className="text-sm font-semibold text-slate-800 mb-2 truncate max-w-[240px]">
              {card.title}
            </div>
            <div className="text-xs space-y-1.5">
              {card.start_date && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-16">開始日</span>
                  <span className="text-slate-700">{formatDateFull(card.start_date)}</span>
                </div>
              )}
              {card.due_date && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 w-16">截止日</span>
                  <span className="text-slate-700">{formatDateFull(card.due_date)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-16">進度</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: progress === 100 ? '#10B981' : phaseColor,
                      }}
                    />
                  </div>
                  <span className="text-slate-600">{progress}%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-16">指派人</span>
                <span className="text-slate-700">{assigneeNames}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// PhaseGroup — collapsible phase section
// ──────────────────────────────────────────────

function PhaseGroup({
  group,
  rangeStart,
  dayWidth,
  isExpanded,
  onToggle,
  onCardClick,
  totalWidth,
}: {
  group: PhaseGroupData
  rangeStart: Date
  dayWidth: number
  isExpanded: boolean
  onToggle: () => void
  onCardClick: (card: Card) => void
  totalWidth: number
}) {
  return (
    <div>
      {/* Phase header */}
      <div
        className="flex items-center gap-2 px-3 cursor-pointer select-none hover:bg-slate-50 transition-colors border-b border-slate-100"
        style={{ height: PHASE_HEADER_HEIGHT, minWidth: totalWidth }}
        onClick={onToggle}
      >
        {/* Expand/collapse arrow */}
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>

        {/* Phase color dot */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: group.phaseColor }}
        />

        {/* Phase name */}
        <span className="text-sm font-semibold text-slate-700">{group.phaseName}</span>

        {/* Progress */}
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${group.phaseProgress}%`,
                backgroundColor: group.phaseColor,
              }}
            />
          </div>
          <span className="text-[10px] text-slate-400">{group.phaseProgress}%</span>
        </div>

        {/* Card count */}
        <span className="text-xs text-slate-400 ml-1">
          {group.cards.length} 張卡片
        </span>
      </div>

      {/* Cards */}
      {isExpanded &&
        group.cards.map(card => (
          <div key={card.id} className="flex border-b border-slate-50" style={{ minWidth: totalWidth }}>
            {/* Left sidebar: card title */}
            <div
              className="flex-shrink-0 flex items-center gap-1.5 px-3 bg-white border-r border-slate-100 overflow-hidden"
              style={{ width: 220, height: ROW_HEIGHT }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: PRIORITY_BORDER_COLORS[card.priority] || PRIORITY_BORDER_COLORS.medium }}
              />
              <span
                className="text-xs text-slate-600 truncate cursor-pointer hover:text-slate-900 transition-colors"
                onClick={() => onCardClick(card)}
                title={card.title}
              >
                {card.title}
              </span>
            </div>
            {/* Bar area */}
            <div className="flex-1 relative">
              <GanttBar
                card={card}
                rangeStart={rangeStart}
                dayWidth={dayWidth}
                phaseColor={group.phaseColor}
                onCardClick={onCardClick}
              />
            </div>
          </div>
        ))}
    </div>
  )
}

// ──────────────────────────────────────────────
// TodayLine — vertical red line
// ──────────────────────────────────────────────

function TodayLine({
  rangeStart,
  dayWidth,
  totalHeight,
}: {
  rangeStart: Date
  dayWidth: number
  totalHeight: number
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const offset = daysBetween(rangeStart, today)
  if (offset < 0) return null

  const left = offset * dayWidth + dayWidth / 2 + 220 // account for sidebar width

  return (
    <div
      className="absolute top-0 z-20 pointer-events-none"
      style={{ left, height: totalHeight }}
    >
      {/* Diamond marker at top */}
      <div
        className="absolute -top-0 -translate-x-1/2 w-2.5 h-2.5 bg-red-500 rotate-45"
        style={{ marginTop: HEADER_HEIGHT - 6 }}
      />
      {/* Vertical line */}
      <div
        className="absolute top-0 -translate-x-1/2 w-px bg-red-400"
        style={{
          marginTop: HEADER_HEIGHT,
          height: totalHeight - HEADER_HEIGHT,
          opacity: 0.6,
        }}
      />
    </div>
  )
}

// ──────────────────────────────────────────────
// Weekend columns (background stripes)
// ──────────────────────────────────────────────

function WeekendStripes({
  rangeStart,
  rangeEnd,
  dayWidth,
  totalHeight,
}: {
  rangeStart: Date
  rangeEnd: Date
  dayWidth: number
  totalHeight: number
}) {
  const totalDays = daysBetween(rangeStart, rangeEnd)
  const stripes: number[] = []

  for (let i = 0; i < totalDays; i++) {
    const d = addDays(rangeStart, i)
    if (isWeekend(d)) {
      stripes.push(i)
    }
  }

  return (
    <>
      {stripes.map(i => (
        <div
          key={i}
          className="absolute top-0 bg-slate-50/60 pointer-events-none"
          style={{
            left: i * dayWidth + 220, // account for sidebar width
            width: dayWidth,
            height: totalHeight,
          }}
        />
      ))}
    </>
  )
}

// ──────────────────────────────────────────────
// UnscheduledPanel — collapsible panel
// ──────────────────────────────────────────────

function UnscheduledPanel({
  cards,
  phases,
  onCardClick,
}: {
  cards: ProcessedCard[]
  phases: Phase[]
  onCardClick: (card: Card) => void
}) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (cards.length === 0) return null

  const phaseMap = new Map<string, Phase>()
  for (const p of phases) phaseMap.set(p.id, p)

  return (
    <div className="border-t">
      {/* Toggle header */}
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        className="flex items-center gap-2 w-full px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
      >
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm text-slate-500">
          {cards.length} 張卡片未排程
        </span>
      </button>

      {/* Expanded card list */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-1">
          {cards.map(card => {
            const phase = card.phase_id ? phaseMap.get(card.phase_id) : null
            const priorityColor = PRIORITY_BORDER_COLORS[card.priority] || PRIORITY_BORDER_COLORS.medium
            return (
              <div
                key={card.id}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 cursor-pointer transition-colors border border-slate-100"
                style={{ borderLeftWidth: 3, borderLeftColor: priorityColor }}
                onClick={() => onCardClick(card)}
              >
                <span className="text-sm text-slate-700 flex-1 truncate">{card.title}</span>
                {phase && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full text-white flex-shrink-0"
                    style={{ backgroundColor: phase.color }}
                  >
                    {phase.name}
                  </span>
                )}
                <span className="flex items-center gap-1 flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priorityColor }} />
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// GanttView — main exported component
// ──────────────────────────────────────────────

export function GanttView({
  columns,
  phases,
  onCardClick,
}: {
  columns: Column[]
  phases: Phase[]
  onCardClick: (card: Card) => void
}) {
  const [scale, setScale] = useState<GanttScale>('week')
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({})
  const [viewOffset, setViewOffset] = useState(0) // in days
  const chartContainerRef = useRef<HTMLDivElement>(null)

  const dayWidth = DAY_WIDTH[scale]

  // Process data
  const scheduledCards = useMemo(() => getScheduledCards(columns), [columns])
  const unscheduledCards = useMemo(() => getUnscheduledCards(columns), [columns])

  const timeRange = useMemo(() => getTimeRange(scheduledCards), [scheduledCards])

  const phaseGroups = useMemo(
    () => groupByPhase(scheduledCards, phases),
    [scheduledCards, phases]
  )

  // Initialize expanded state — all expanded by default
  useEffect(() => {
    const initial: Record<string, boolean> = {}
    for (const g of phaseGroups) {
      if (expandedPhases[g.phaseId] === undefined) {
        initial[g.phaseId] = true
      }
    }
    if (Object.keys(initial).length > 0) {
      setExpandedPhases(prev => ({ ...initial, ...prev }))
    }
    // Only run when phaseGroups changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseGroups])

  const togglePhase = useCallback((phaseId: string) => {
    setExpandedPhases(prev => ({ ...prev, [phaseId]: !prev[phaseId] }))
  }, [])

  // Compute adjusted range with offset
  const adjustedRange = useMemo(() => {
    if (!timeRange) return null
    return {
      rangeStart: addDays(timeRange.rangeStart, viewOffset),
      rangeEnd: addDays(timeRange.rangeEnd, viewOffset),
    }
  }, [timeRange, viewOffset])

  // Navigation
  const handleNavigatePrev = useCallback(() => {
    setViewOffset(prev => prev - (scale === 'week' ? 7 : 30))
  }, [scale])

  const handleNavigateNext = useCallback(() => {
    setViewOffset(prev => prev + (scale === 'week' ? 7 : 30))
  }, [scale])

  const handleNavigateToday = useCallback(() => {
    if (!timeRange) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayOffset = daysBetween(timeRange.rangeStart, today)

    // Calculate target scroll position
    setViewOffset(0)

    // Scroll the container to bring today into view
    requestAnimationFrame(() => {
      if (chartContainerRef.current) {
        const scrollLeft = todayOffset * dayWidth - chartContainerRef.current.clientWidth / 2
        chartContainerRef.current.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' })
      }
    })
  }, [timeRange, dayWidth])

  // Scale change resets offset
  const handleScaleChange = useCallback((newScale: GanttScale) => {
    setScale(newScale)
    setViewOffset(0)
  }, [])

  // Compute total height for today line and weekend stripes
  const computedTotalHeight = useMemo(() => {
    let height = HEADER_HEIGHT
    for (const g of phaseGroups) {
      height += PHASE_HEADER_HEIGHT
      if (expandedPhases[g.phaseId]) {
        height += g.cards.length * ROW_HEIGHT
      }
    }
    return height
  }, [phaseGroups, expandedPhases])

  // Title
  const title = useMemo(() => {
    if (!adjustedRange) return '甘特圖'
    const start = adjustedRange.rangeStart
    const end = adjustedRange.rangeEnd
    if (scale === 'week') {
      return `${formatMonth(start)} — ${formatMonth(end)}`
    }
    return `${formatMonth(start)} — ${formatMonth(end)}`
  }, [adjustedRange, scale])

  // Total width
  const totalWidth = useMemo(() => {
    if (!adjustedRange) return 0
    const totalDays = daysBetween(adjustedRange.rangeStart, adjustedRange.rangeEnd)
    return totalDays * dayWidth + 220 // + sidebar width
  }, [adjustedRange, dayWidth])

  // Empty state
  if (scheduledCards.length === 0 && unscheduledCards.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <GanttToolbar
          scale={scale}
          onScaleChange={handleScaleChange}
          onNavigatePrev={handleNavigatePrev}
          onNavigateNext={handleNavigateNext}
          onNavigateToday={handleNavigateToday}
          title="甘特圖"
        />
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-4xl mb-3 opacity-40">
              <svg className="w-12 h-12 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-4m-5 0v4m0-4h4m-4 0H9" />
              </svg>
            </div>
            <p className="text-slate-500 text-sm">尚無任務</p>
            <p className="text-slate-400 text-xs mt-1">建立卡片並設定日期後，甘特圖將會顯示</p>
          </div>
        </div>
      </div>
    )
  }

  // All cards are unscheduled
  if (!adjustedRange) {
    return (
      <div className="bg-white rounded-lg shadow">
        <GanttToolbar
          scale={scale}
          onScaleChange={handleScaleChange}
          onNavigatePrev={handleNavigatePrev}
          onNavigateNext={handleNavigateNext}
          onNavigateToday={handleNavigateToday}
          title="甘特圖"
        />
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-500 text-sm">所有卡片均未排程，請設定開始日或截止日</p>
        </div>
        <UnscheduledPanel cards={unscheduledCards} phases={phases} onCardClick={onCardClick} />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Toolbar */}
      <GanttToolbar
        scale={scale}
        onScaleChange={handleScaleChange}
        onNavigatePrev={handleNavigatePrev}
        onNavigateNext={handleNavigateNext}
        onNavigateToday={handleNavigateToday}
        title={title}
      />

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-sm bg-slate-300" />
          任務時程
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-1.5 rounded-sm bg-slate-500" />
          進度
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-px h-3 bg-red-400" />
          今天
        </span>
        <span className="ml-auto flex items-center gap-3">
          {Object.entries(PRIORITY_BORDER_COLORS).map(([key, color]) => (
            <span key={key} className="flex items-center gap-1">
              <span className="w-1 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-slate-400">
                {key === 'urgent' ? '緊急' : key === 'high' ? '高' : key === 'medium' ? '中' : '低'}
              </span>
            </span>
          ))}
        </span>
      </div>

      {/* Chart container with horizontal scroll */}
      <div ref={chartContainerRef} className="overflow-x-auto relative">
        <div style={{ minWidth: totalWidth }} className="relative">
          {/* Weekend stripes (behind everything) */}
          <WeekendStripes
            rangeStart={adjustedRange.rangeStart}
            rangeEnd={adjustedRange.rangeEnd}
            dayWidth={dayWidth}
            totalHeight={computedTotalHeight}
          />

          {/* Today line */}
          <TodayLine
            rangeStart={adjustedRange.rangeStart}
            dayWidth={dayWidth}
            totalHeight={computedTotalHeight}
          />

          {/* Header */}
          <div className="flex">
            {/* Sidebar header */}
            <div
              className="flex-shrink-0 bg-white border-r border-b border-slate-200 flex items-center px-3 sticky left-0 z-20"
              style={{ width: 220, height: HEADER_HEIGHT }}
            >
              <span className="text-xs font-medium text-slate-500">任務名稱</span>
            </div>
            {/* Time axis */}
            <div className="flex-1">
              <GanttHeader
                rangeStart={adjustedRange.rangeStart}
                rangeEnd={adjustedRange.rangeEnd}
                dayWidth={dayWidth}
                scale={scale}
              />
            </div>
          </div>

          {/* Body: Phase groups */}
          {phaseGroups.map(group => (
            <PhaseGroup
              key={group.phaseId}
              group={{ ...group, isExpanded: expandedPhases[group.phaseId] ?? true }}
              rangeStart={adjustedRange.rangeStart}
              dayWidth={dayWidth}
              isExpanded={expandedPhases[group.phaseId] ?? true}
              onToggle={() => togglePhase(group.phaseId)}
              onCardClick={onCardClick}
              totalWidth={totalWidth}
            />
          ))}
        </div>
      </div>

      {/* Unscheduled cards panel */}
      <UnscheduledPanel cards={unscheduledCards} phases={phases} onCardClick={onCardClick} />
    </div>
  )
}
