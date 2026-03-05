'use client'

import { useRef, useCallback, useState, useEffect, useMemo } from 'react'

interface DateInputProps {
  value: string           // YYYY-MM-DD or ''
  onChange: (value: string) => void
  onBlur?: () => void
  autoFocus?: boolean
  className?: string
}

/** Returns the number of days in the given month (1-indexed). Defaults to 31 for invalid/incomplete input. */
function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12 || !Number.isFinite(year)) return 31
  // new Date(year, month, 0) gives the last day of the previous month,
  // so new Date(2024, 2, 0) → Jan 31 — we need month as 1-indexed input
  // Using month directly (not month-1) because Date(year, month, 0) = last day of `month`
  return new Date(year, month, 0).getDate()
}

export function DateInput({ value, onChange, onBlur, autoFocus, className }: DateInputProps) {
  // Parse the incoming value into year/month/day parts
  const parts = value ? value.split('-') : ['', '', '']
  const [year, setYear] = useState(parts[0] || '')
  const [month, setMonth] = useState(parts[1] || '')
  const [day, setDay] = useState(parts[2] || '')

  const yearRef = useRef<HTMLInputElement>(null)
  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track whether the blur timeout is pending so we can cancel it
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track whether the change originated from internal typing (to skip useEffect sync)
  const isInternalChange = useRef(false)

  // Sync from external value prop (skip when the change came from our own emitChange)
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false
      return
    }
    const p = value ? value.split('-') : ['', '', '']
    setYear(p[0] || '')
    setMonth(p[1] || '')
    setDay(p[2] || '')
  }, [value])

  // Compute the max days for the currently entered year+month
  const maxDay = useMemo(() => {
    const y = parseInt(year, 10)
    const m = parseInt(month, 10)
    if (year.length === 4 && month.length === 2 && m >= 1 && m <= 12) {
      return getDaysInMonth(y, m)
    }
    return 31 // default when year/month incomplete
  }, [year, month])

  // Determine if input is "partial" (some fields have values but not all complete)
  const isPartial = useMemo(() => {
    const allEmpty = !year && !month && !day
    const allComplete = year.length === 4 && month.length === 2 && day.length === 2
    return !allEmpty && !allComplete
  }, [year, month, day])

  // Emit the combined value only when all parts are complete or all empty
  const emitChange = useCallback((y: string, m: string, d: string) => {
    if (!y && !m && !d) {
      isInternalChange.current = true
      onChange('')
    } else if (y.length === 4 && m.length === 2 && d.length === 2) {
      isInternalChange.current = true
      onChange(`${y}-${m}-${d}`)
    }
    // Incomplete input → don't emit, keep internal state only
  }, [onChange])

  // Handle the composite onBlur: only fire when focus leaves ALL three inputs
  const handleFieldBlur = useCallback(() => {
    // Defer the check so that if focus moves to another field within this
    // component, the new field's onFocus fires first and cancels the timeout
    blurTimeoutRef.current = setTimeout(() => {
      // 10ms delay ensures focus event on sibling input fires first
      if (
        containerRef.current &&
        !containerRef.current.contains(document.activeElement)
      ) {
        // If input is incomplete (some fields filled, but not all), emit '' to clear
        // This prevents stale complete dates from persisting when user partially clears
        const hasAny = year || month || day
        const isComplete = year.length === 4 && month.length === 2 && day.length === 2
        if (hasAny && !isComplete) {
          isInternalChange.current = true
          onChange('')
        }
        onBlur?.()
      }
    }, 10)
  }, [onBlur, onChange, year, month, day])

  const handleFieldFocus = useCallback(() => {
    if (blurTimeoutRef.current !== null) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
  }, [])

  // Filter to digits only
  const digitsOnly = (v: string) => v.replace(/\D/g, '')

  // Clamp day value based on dynamic maxDay
  const clampDay = useCallback((v: string, currentMaxDay: number): string => {
    if (v.length === 1 && parseInt(v, 10) > 3) {
      v = '0' + v
    }
    if (v.length === 2) {
      const num = parseInt(v, 10)
      if (num < 1) v = '01'
      if (num > currentMaxDay) v = String(currentMaxDay).padStart(2, '0')
    }
    return v
  }, [])

  const handleYearChange = (raw: string) => {
    const v = digitsOnly(raw).slice(0, 4)
    setYear(v)
    if (v.length === 4) {
      monthRef.current?.focus()
    }
    // Re-clamp day if year changed and month is complete
    let currentDay = day
    if (v.length === 4 && month.length === 2) {
      const newMax = getDaysInMonth(parseInt(v, 10), parseInt(month, 10))
      if (day.length === 2 && parseInt(day, 10) > newMax) {
        currentDay = String(newMax).padStart(2, '0')
        setDay(currentDay)
      }
    }
    emitChange(v, month, currentDay)
  }

  const handleMonthChange = (raw: string) => {
    let v = digitsOnly(raw).slice(0, 2)
    // Clamp to 01-12
    if (v.length === 1 && parseInt(v, 10) > 1) {
      v = '0' + v
    }
    if (v.length === 2) {
      const num = parseInt(v, 10)
      if (num < 1) v = '01'
      if (num > 12) v = '12'
    }
    setMonth(v)
    if (v.length === 2) {
      dayRef.current?.focus()
    }
    // Re-clamp day if month changed and year is complete
    let currentDay = day
    if (year.length === 4 && v.length === 2) {
      const newMax = getDaysInMonth(parseInt(year, 10), parseInt(v, 10))
      if (day.length === 2 && parseInt(day, 10) > newMax) {
        currentDay = String(newMax).padStart(2, '0')
        setDay(currentDay)
      }
    }
    emitChange(year, v, currentDay)
  }

  const handleDayChange = (raw: string) => {
    let v = digitsOnly(raw).slice(0, 2)
    v = clampDay(v, maxDay)
    setDay(v)
    emitChange(year, month, v)
  }

  // Arrow key helpers: adjust a numeric field value by delta with wrapping
  const adjustField = useCallback((
    field: 'year' | 'month' | 'day',
    delta: number,
    currentYear: string,
    currentMonth: string,
    currentDay: string
  ) => {
    if (field === 'year') {
      if (!currentYear) return
      const num = parseInt(currentYear, 10)
      const next = Math.max(0, Math.min(9999, num + delta))
      const v = String(next).padStart(4, '0')
      setYear(v)
      // Re-clamp day after year change
      let newDay = currentDay
      if (currentMonth.length === 2 && currentDay.length === 2) {
        const newMax = getDaysInMonth(next, parseInt(currentMonth, 10))
        if (parseInt(currentDay, 10) > newMax) {
          newDay = String(newMax).padStart(2, '0')
          setDay(newDay)
        }
      }
      emitChange(v, currentMonth, newDay)
    } else if (field === 'month') {
      if (!currentMonth) return
      let num = parseInt(currentMonth, 10) + delta
      // Wrap: 12 + 1 → 1, 1 - 1 → 12
      if (num > 12) num = 1
      if (num < 1) num = 12
      const v = String(num).padStart(2, '0')
      setMonth(v)
      // Re-clamp day after month change
      let newDay = currentDay
      if (currentYear.length === 4 && currentDay.length === 2) {
        const newMax = getDaysInMonth(parseInt(currentYear, 10), num)
        if (parseInt(currentDay, 10) > newMax) {
          newDay = String(newMax).padStart(2, '0')
          setDay(newDay)
        }
      }
      emitChange(currentYear, v, newDay)
    } else if (field === 'day') {
      if (!currentDay) return
      const y = parseInt(currentYear, 10)
      const m = parseInt(currentMonth, 10)
      const currentMaxDay = (currentYear.length === 4 && currentMonth.length === 2 && m >= 1 && m <= 12)
        ? getDaysInMonth(y, m)
        : 31
      let num = parseInt(currentDay, 10) + delta
      // Wrap: maxDay + 1 → 1, 1 - 1 → maxDay
      if (num > currentMaxDay) num = 1
      if (num < 1) num = currentMaxDay
      const v = String(num).padStart(2, '0')
      setDay(v)
      emitChange(currentYear, currentMonth, v)
    }
  }, [emitChange])

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: 'year' | 'month' | 'day'
  ) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      // Tab forward: year → month, month → day
      // From day → let Tab naturally leave the component (no preventDefault)
      if (field === 'year') {
        e.preventDefault()
        monthRef.current?.focus()
      } else if (field === 'month') {
        e.preventDefault()
        dayRef.current?.focus()
      }
      // field === 'day': do nothing, let browser handle natural tab out
    } else if (e.key === 'Tab' && e.shiftKey) {
      // Shift+Tab backward: day → month, month → year
      // From year → let Shift+Tab naturally leave the component (no preventDefault)
      if (field === 'day') {
        e.preventDefault()
        monthRef.current?.focus()
      } else if (field === 'month') {
        e.preventDefault()
        yearRef.current?.focus()
      }
      // field === 'year': do nothing, let browser handle natural shift+tab out
    } else if (e.key === 'Escape') {
      // Escape: blur the active input and trigger onBlur
      e.preventDefault()
      ;(e.currentTarget as HTMLInputElement).blur()
      // Force immediate onBlur since we want to leave the component entirely
      onBlur?.()
    } else if (e.key === 'Enter') {
      // Enter: confirm and trigger onBlur
      e.preventDefault()
      ;(e.currentTarget as HTMLInputElement).blur()
      onBlur?.()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      adjustField(field, 1, year, month, day)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      adjustField(field, -1, year, month, day)
    } else if (e.key === 'Backspace') {
      const input = e.currentTarget
      if (input.value === '') {
        e.preventDefault()
        if (field === 'month') {
          yearRef.current?.focus()
        } else if (field === 'day') {
          monthRef.current?.focus()
        }
      }
    }
  }

  const inputBase =
    'border-0 bg-transparent text-center text-base sm:text-sm outline-none p-0 focus:ring-0'

  // Container border style: partial input gets a warning amber border
  const borderStyle = isPartial
    ? 'border-amber-300 dark:border-amber-500'
    : 'border'

  return (
    <div
      ref={containerRef}
      className={`inline-flex items-center border rounded px-2 py-2 sm:py-1 text-base sm:text-sm min-h-[40px] sm:min-h-0 ${borderStyle} ${className || ''}`}
      title={isPartial ? '日期尚未完成，請填寫所有欄位' : undefined}
    >
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        maxLength={4}
        placeholder="YYYY"
        value={year}
        onChange={e => handleYearChange(e.target.value)}
        onKeyDown={e => handleKeyDown(e, 'year')}
        onBlur={handleFieldBlur}
        onFocus={handleFieldFocus}
        autoFocus={autoFocus}
        className={`${inputBase} w-[4.5ch]`}
        aria-label="Year"
      />
      <span className="text-slate-400 mx-px select-none">-</span>
      <input
        ref={monthRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="MM"
        value={month}
        onChange={e => handleMonthChange(e.target.value)}
        onKeyDown={e => handleKeyDown(e, 'month')}
        onBlur={handleFieldBlur}
        onFocus={handleFieldFocus}
        className={`${inputBase} w-[2.5ch]`}
        aria-label="Month"
      />
      <span className="text-slate-400 mx-px select-none">-</span>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="DD"
        value={day}
        onChange={e => handleDayChange(e.target.value)}
        onKeyDown={e => handleKeyDown(e, 'day')}
        onBlur={handleFieldBlur}
        onFocus={handleFieldFocus}
        className={`${inputBase} w-[2.5ch]`}
        aria-label="Day"
      />
    </div>
  )
}
