'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { CardTemplate, Column } from './types'
import { RecurringEditor } from './recurring-editor'
import { RecurringGenerateDialog } from './recurring-generate'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecurringTasksPanelProps {
  projectId: string
  columns: Column[]
  isOpen: boolean
  onClose: () => void
  onRefreshBoard: () => void
}

// ---------------------------------------------------------------------------
// RecurringTasksPanel
// ---------------------------------------------------------------------------

export function RecurringTasksPanel({
  projectId,
  columns,
  isOpen,
  onClose,
  onRefreshBoard,
}: RecurringTasksPanelProps) {
  const [templates, setTemplates] = useState<CardTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<{ id: string; name: string }[]>([])
  const [editingTemplate, setEditingTemplate] = useState<CardTemplate | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [generatingTemplate, setGeneratingTemplate] = useState<CardTemplate | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  const deletingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // -- Fetch templates -------------------------------------------------------

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/projects/${projectId}/templates`)
      if (!res.ok) throw new Error('載入定期任務失敗')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (err) {
      console.error('fetchTemplates error:', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (isOpen) {
      fetchTemplates()
      fetch('/api/users/active').then(r => r.json()).then(data => {
        if (data.users) setMembers(data.users)
      }).catch(console.error)
    }
  }, [isOpen, fetchTemplates])

  // -- ESC key ---------------------------------------------------------------

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showEditor || generatingTemplate) return
        handleClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose, showEditor, generatingTemplate])

  // -- Delete logic ----------------------------------------------------------

  const handleDeleteClick = useCallback(
    async (templateId: string) => {
      if (deletingId === templateId) {
        // Second click — confirm delete
        if (deletingTimerRef.current) clearTimeout(deletingTimerRef.current)
        setDeletingId(null)
        try {
          const res = await fetch(
            `/api/templates/${templateId}`,
            { method: 'DELETE' },
          )
          if (!res.ok) throw new Error('刪除失敗')
          setTemplates((prev) => prev.filter((t) => t.id !== templateId))
        } catch (err) {
          console.error('delete template error:', err)
        }
      } else {
        // First click — enter confirm state
        setDeletingId(templateId)
        if (deletingTimerRef.current) clearTimeout(deletingTimerRef.current)
        deletingTimerRef.current = setTimeout(() => setDeletingId(null), 3000)
      }
    },
    [deletingId, projectId],
  )

  // Reset deletingId when clicking outside the delete button
  useEffect(() => {
    if (!deletingId) return
    const handleClick = () => setDeletingId(null)
    // Defer so the current click event finishes first
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick, { once: true })
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleClick)
    }
  }, [deletingId])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (deletingTimerRef.current) clearTimeout(deletingTimerRef.current)
    }
  }, [])

  // -- Editor callbacks ------------------------------------------------------

  const handleNewTemplate = useCallback(() => {
    setEditingTemplate(null)
    setShowEditor(true)
  }, [])

  const handleEditTemplate = useCallback((template: CardTemplate) => {
    setEditingTemplate(template)
    setShowEditor(true)
  }, [])

  const handleEditorClose = useCallback(() => {
    setShowEditor(false)
    setEditingTemplate(null)
  }, [])

  const handleEditorSaved = useCallback(() => {
    setShowEditor(false)
    setEditingTemplate(null)
    fetchTemplates()
  }, [fetchTemplates])

  // -- Generate callbacks ----------------------------------------------------

  const handleGenerateClose = useCallback(() => {
    setGeneratingTemplate(null)
  }, [])

  const handleGenerateDone = useCallback(() => {
    setGeneratingTemplate(null)
    onRefreshBoard()
  }, [onRefreshBoard])

  // -- Helpers ---------------------------------------------------------------

  const getColumnName = useCallback(
    (columnId: string | null) => {
      if (!columnId) return '(未指定)'
      const col = columns.find((c) => c.id === columnId)
      return col ? col.name : '(未知欄位)'
    },
    [columns],
  )

  const formatSubtasksSummary = useCallback(
    (subtasks: CardTemplate['subtasks']) => {
      if (!subtasks || subtasks.length === 0) return null
      return subtasks
        .map((s) => {
          const dayLabel = s.day_of_month != null ? ` (${s.day_of_month}號)` : ''
          return `${s.title}${dayLabel}`
        })
        .join(' / ')
    },
    [],
  )

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
        className={`fixed top-0 right-0 h-full w-full max-w-lg z-50 bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-700 flex flex-col transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            定期任務
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Add button */}
          <button
            onClick={handleNewTemplate}
            className="w-full mb-4 px-4 py-2.5 text-sm font-medium text-blue-600 dark:text-blue-400 border border-dashed border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors min-h-[44px] flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新增定期任務
          </button>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-12 text-slate-400 dark:text-slate-500 text-sm">
              載入中…
            </div>
          )}

          {/* Empty state */}
          {!loading && templates.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                尚未建立定期任務
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                點擊上方按鈕新增第一個定期任務
              </p>
            </div>
          )}

          {/* Template list */}
          {!loading && templates.length > 0 && (
            <div className="space-y-3">
              {templates.map((template) => {
                const subtasksSummary = formatSubtasksSummary(template.subtasks)
                const isDeleting = deletingId === template.id

                return (
                  <div
                    key={template.id}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {/* Template name */}
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {template.name}
                    </h3>

                    {/* Title pattern */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                      {template.title_pattern}
                    </p>

                    {/* Subtasks summary */}
                    {subtasksSummary && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {subtasksSummary}
                      </p>
                    )}

                    {/* Meta info */}
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        {getColumnName(template.target_column_id)}
                      </span>
                      {template.rolling_due_date && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600">|</span>
                          <span className="text-amber-500 dark:text-amber-400 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            滾動截止日
                          </span>
                        </>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setGeneratingTemplate(template)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors min-h-[32px]"
                      >
                        產生卡片
                      </button>
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-h-[32px]"
                      >
                        編輯
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteClick(template.id)
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[32px] ${
                          isDeleting
                            ? 'text-white bg-red-500 hover:bg-red-600'
                            : 'text-red-500 dark:text-red-400 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20'
                        }`}
                      >
                        {isDeleting ? '確認刪除？' : '刪除'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* RecurringEditor */}
      {showEditor && (
        <RecurringEditor
          projectId={projectId}
          columns={columns}
          members={members}
          template={editingTemplate}
          onClose={handleEditorClose}
          onSave={handleEditorSaved}
        />
      )}

      {/* RecurringGenerateDialog */}
      {generatingTemplate && (
        <RecurringGenerateDialog
          template={generatingTemplate}
          onClose={handleGenerateClose}
          onGenerate={handleGenerateDone}
        />
      )}
    </>
  )
}
