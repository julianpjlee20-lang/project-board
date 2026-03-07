'use client'

import { useState, useMemo } from 'react'
import type { CardTemplate } from './types'

interface RecurringGenerateDialogProps {
  template: CardTemplate
  onGenerate: () => void
  onClose: () => void
}

interface PreviewCard {
  title: string
  subtasks: { title: string; dueDate: string | null }[]
}

function generatePreview(
  template: CardTemplate,
  startMonth: string,
  count: number
): PreviewCard[] {
  const [year, month] = startMonth.split('-').map(Number)
  const cards: PreviewCard[] = []
  for (let i = 0; i < count; i++) {
    const date = new Date(year, month - 1 + i)
    const yyyy = date.getFullYear().toString()
    const mm = (date.getMonth() + 1).toString().padStart(2, '0')
    const title = template.title_pattern
      .replace('{{YYYY}}', yyyy)
      .replace('{{MM}}', mm)

    const subtasks = template.subtasks.map((st) => {
      if (st.day_of_month == null) return { title: st.title, dueDate: null }
      const lastDay = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0
      ).getDate()
      const day = Math.min(st.day_of_month, lastDay)
      return {
        title: st.title,
        dueDate: `${yyyy}-${mm}-${String(day).padStart(2, '0')}`,
      }
    })

    cards.push({ title, subtasks })
  }
  return cards
}

function getDefaultStartMonth(): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1)
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

export function RecurringGenerateDialog({
  template,
  onGenerate,
  onClose,
}: RecurringGenerateDialogProps) {
  const [startMonth, setStartMonth] = useState(getDefaultStartMonth)
  const [count, setCount] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const previewCards = useMemo(
    () => generatePreview(template, startMonth, count),
    [template, startMonth, count]
  )

  async function handleGenerate() {
    setGenerating(true)
    setError('')
    try {
      const res = await fetch(`/api/templates/${template.id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_month: startMonth, count }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '產生失敗')
      }
      onGenerate()
    } catch (err) {
      setError(err instanceof Error ? err.message : '產生失敗')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            產生卡片 — {template.name}
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            aria-label="關閉"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-6 py-4">
          {/* Form fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="start-month"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                起始月份
              </label>
              <input
                id="start-month"
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                  focus-visible:border-blue-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500
                  dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label
                htmlFor="generate-count"
                className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                期數
              </label>
              <input
                id="generate-count"
                type="number"
                min={1}
                max={24}
                value={count}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v)) setCount(Math.max(1, Math.min(24, v)))
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm
                  focus-visible:border-blue-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500
                  dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          </div>

          {/* Preview */}
          <div>
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              預覽（將產生 {count} 張卡片）：
            </p>
            <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-600">
              {previewCards.map((card, idx) => (
                <div
                  key={idx}
                  className={`px-4 py-3 ${
                    idx > 0
                      ? 'border-t border-gray-200 dark:border-gray-600'
                      : ''
                  }`}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {card.title}
                  </p>
                  {card.subtasks.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {card.subtasks.map((st, stIdx) => (
                        <li
                          key={stIdx}
                          className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                        >
                          <span className="text-gray-400 dark:text-gray-500">
                            *
                          </span>
                          <span>{st.title}</span>
                          {st.dueDate && (
                            <span className="ml-auto text-gray-500 dark:text-gray-400">
                              {st.dueDate}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            onClick={onClose}
            disabled={generating}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700
              hover:bg-gray-50 disabled:opacity-50
              dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            取消
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || !startMonth}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white
              hover:bg-blue-700 disabled:opacity-50
              dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {generating ? '產生中...' : '確認產生'}
          </button>
        </div>
      </div>
    </div>
  )
}
