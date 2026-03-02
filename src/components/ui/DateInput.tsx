'use client'

import { useRef, useCallback, useState, useEffect } from 'react'

interface DateInputProps {
  value: string           // YYYY-MM-DD or ''
  onChange: (value: string) => void
  onBlur?: () => void
  autoFocus?: boolean
  className?: string
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

  // Sync from external value prop
  useEffect(() => {
    const p = value ? value.split('-') : ['', '', '']
    setYear(p[0] || '')
    setMonth(p[1] || '')
    setDay(p[2] || '')
  }, [value])

  // Emit the combined value whenever any part changes
  const emitChange = useCallback((y: string, m: string, d: string) => {
    if (!y && !m && !d) {
      onChange('')
    } else {
      const yy = y.padStart(4, '0')
      const mm = m.padStart(2, '0')
      const dd = d.padStart(2, '0')
      onChange(`${yy}-${mm}-${dd}`)
    }
  }, [onChange])

  // Handle the composite onBlur: only fire when focus leaves ALL three inputs
  const handleFieldBlur = useCallback(() => {
    // Defer the check so that if focus moves to another field within this
    // component, the new field's onFocus fires first and cancels the timeout
    blurTimeoutRef.current = setTimeout(() => {
      if (
        containerRef.current &&
        !containerRef.current.contains(document.activeElement)
      ) {
        onBlur?.()
      }
    }, 0)
  }, [onBlur])

  const handleFieldFocus = useCallback(() => {
    if (blurTimeoutRef.current !== null) {
      clearTimeout(blurTimeoutRef.current)
      blurTimeoutRef.current = null
    }
  }, [])

  // Filter to digits only
  const digitsOnly = (v: string) => v.replace(/\D/g, '')

  const handleYearChange = (raw: string) => {
    const v = digitsOnly(raw).slice(0, 4)
    setYear(v)
    if (v.length === 4) {
      monthRef.current?.focus()
    }
    // Only emit when we have a full year or clearing
    emitChange(v, month, day)
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
    emitChange(year, v, day)
  }

  const handleDayChange = (raw: string) => {
    let v = digitsOnly(raw).slice(0, 2)
    // Clamp to 01-31
    if (v.length === 1 && parseInt(v, 10) > 3) {
      v = '0' + v
    }
    if (v.length === 2) {
      const num = parseInt(v, 10)
      if (num < 1) v = '01'
      if (num > 31) v = '31'
    }
    setDay(v)
    emitChange(year, month, v)
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: 'year' | 'month' | 'day'
  ) => {
    if (e.key === 'Backspace') {
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
    'border-0 bg-transparent text-center text-sm outline-none p-0 focus:ring-0'

  return (
    <div
      ref={containerRef}
      className={`inline-flex items-center border rounded px-2 py-1 text-sm ${className || ''}`}
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
        className={`${inputBase} w-[3.2ch]`}
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
        className={`${inputBase} w-[2ch]`}
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
        className={`${inputBase} w-[2ch]`}
        aria-label="Day"
      />
    </div>
  )
}
