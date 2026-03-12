'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArchivedCard {
  id: string
  card_number: number | null
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high'
  actual_completion_date: string | null
  archived_at: string | null
  phase_id: string | null
  column_name: string
  column_color: string
  phase_name: string | null
  phase_color: string | null
  assignees: { id: string; name: string }[]
  tags: { id: string; name: string; color: string }[]
}

interface ArchivePanelProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  onRefreshBoard: () => void
}

// ---------------------------------------------------------------------------
// Priority helpers
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  high: { label: '高', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  medium: { label: '中', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  low: { label: '低', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '剛剛'
  if (diffMin < 60) return `${diffMin} 分鐘前`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} 小時前`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay} 天前`
  const diffMonth = Math.floor(diffDay / 30)
  if (diffMonth < 12) return `${diffMonth} 個月前`
  return `${Math.floor(diffMonth / 12)} 年前`
}

// ---------------------------------------------------------------------------
// ArchivePanel
// ---------------------------------------------------------------------------

export function ArchivePanel({
  projectId,
  isOpen,
  onClose,
  onRefreshBoard,
}: ArchivePanelProps) {
  const [cards, setCards] = useState<ArchivedCard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isVisible, setIsVisible] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // -- Slide-in animation ----------------------------------------------------

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsVisible(true), 10)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => onClose(), 300)
  }, [onClose])

  // -- Fetch archived cards --------------------------------------------------

  const fetchCards = useCallback(async (searchTerm: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ project_id: projectId })
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim())
      }
      const res = await fetch(`/api/cards/archived?${params.toString()}`)
      if (!res.ok) throw new Error('載入封存卡片失敗')
      const data = await res.json()
      setCards(data.cards || [])
    } catch (err) {
      console.error('fetchArchivedCards error:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      fetchCards(search)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fetchCards])

  // -- Debounced search ------------------------------------------------------

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchCards(value)
    }, 300)
  }, [fetchCards])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // -- ESC key ---------------------------------------------------------------

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  // -- Restore card ----------------------------------------------------------

  const handleRestore = useCallback(async (cardId: string) => {
    try {
      setRestoringId(cardId)
      const res = await fetch(`/api/cards/${cardId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: false }),
      })
      if (!res.ok) throw new Error('恢復卡片失敗')
      // Remove from local list
      setCards((prev) => prev.filter((c) => c.id !== cardId))
      onRefreshBoard()
    } catch (err) {
      console.error('restore card error:', err)
      alert('恢復卡片失敗，請重試')
    } finally {
      setRestoringId(null)
    }
  }, [onRefreshBoard])

  // -- Render ----------------------------------------------------------------

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md z-50 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-700 flex flex-col transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            封存卡片
          </h2>
          <button
            onClick={handleClose}
            aria-label="關閉"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜尋封存卡片..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              載入中...
            </div>
          )}

          {/* Empty state */}
          {!loading && cards.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {search.trim() ? '找不到符合的封存卡片' : '沒有封存的卡片'}
              </p>
              {search.trim() && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  嘗試不同的搜尋關鍵字
                </p>
              )}
            </div>
          )}

          {/* Card list */}
          {!loading && cards.length > 0 && (
            <div className="space-y-3">
              {cards.map((card) => {
                const priority = PRIORITY_CONFIG[card.priority] || PRIORITY_CONFIG.medium
                const isRestoring = restoringId === card.id

                return (
                  <div
                    key={card.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {/* Title + card number */}
                    <div className="flex items-start gap-1.5">
                      {card.card_number != null && (
                        <span className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-[2px] flex-shrink-0">
                          #{card.card_number}
                        </span>
                      )}
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                        {card.title}
                      </h3>
                    </div>

                    {/* Badges row */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {/* Priority badge */}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${priority.className}`}>
                        {priority.label}
                      </span>

                      {/* Phase badge */}
                      {card.phase_name && card.phase_color && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded-full font-medium text-white"
                          style={{ backgroundColor: card.phase_color }}
                        >
                          {card.phase_name}
                        </span>
                      )}

                      {/* Column name */}
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {card.column_name}
                      </span>
                    </div>

                    {/* Archived time + restore button */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        封存於 {relativeTime(card.archived_at)}
                      </span>
                      <button
                        onClick={() => handleRestore(card.id)}
                        disabled={isRestoring}
                        className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors min-h-[32px] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRestoring ? '恢復中...' : '恢復'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
