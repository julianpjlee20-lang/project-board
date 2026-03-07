'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CardTemplate, TemplateSubtask, Column } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubtaskForm {
  id?: string
  title: string
  day_of_month: number | null
  assignee_id: string | null
}

interface RecurringEditorProps {
  template: CardTemplate | null
  projectId: string
  columns: Column[]
  members: { id: string; name: string }[]
  onSave: () => void
  onClose: () => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
] as const

// ---------------------------------------------------------------------------
// SVG Icons
// ---------------------------------------------------------------------------

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="5" x2="15" y2="15" />
      <line x1="15" y1="5" x2="5" y2="15" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4.5h11" />
      <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
      <path d="M12 4.5l-.5 8.5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1L4 4.5" />
      <path d="M6.5 7v4" />
      <path d="M9.5 7v4" />
    </svg>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="3" y1="8" x2="13" y2="8" />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// RecurringEditor
// ---------------------------------------------------------------------------

export function RecurringEditor({
  template,
  projectId,
  columns,
  members,
  onSave,
  onClose,
}: RecurringEditorProps) {
  const isEditMode = template !== null

  // ---- Form state ----
  const [name, setName] = useState(template?.name || '')
  const [titlePattern, setTitlePattern] = useState(template?.title_pattern || '')
  const [description, setDescription] = useState(template?.description || '')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>(template?.priority || 'medium')
  const [targetColumnId, setTargetColumnId] = useState(template?.target_column_id || columns[0]?.id || '')
  const [rollingDueDate, setRollingDueDate] = useState(template?.rolling_due_date || false)
  const [subtasks, setSubtasks] = useState<SubtaskForm[]>(
    template?.subtasks.map((s: TemplateSubtask) => ({
      id: s.id,
      title: s.title,
      day_of_month: s.day_of_month,
      assignee_id: s.assignee_id,
    })) || []
  )
  const [saving, setSaving] = useState(false)

  // ---- Subtask helpers ----

  function handleAddSubtask() {
    setSubtasks(prev => [...prev, { title: '', day_of_month: null, assignee_id: null }])
  }

  function handleRemoveSubtask(index: number) {
    setSubtasks(prev => prev.filter((_, i) => i !== index))
  }

  function handleSubtaskChange(index: number, field: keyof SubtaskForm, value: string | number | null) {
    setSubtasks(prev =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    )
  }

  // ---- Save ----

  async function handleSave() {
    if (!name.trim() || !titlePattern.trim()) return

    setSaving(true)
    try {
      const body = {
        name: name.trim(),
        title_pattern: titlePattern.trim(),
        description: description.trim() || null,
        priority,
        target_column_id: targetColumnId || null,
        rolling_due_date: rollingDueDate,
        subtasks: subtasks
          .filter(s => s.title.trim())
          .map((s, i) => ({
            ...(s.id ? { id: s.id } : {}),
            title: s.title.trim(),
            position: i,
            day_of_month: s.day_of_month,
            assignee_id: s.assignee_id || null,
          })),
      }

      const url = isEditMode
        ? `/api/templates/${template.id}`
        : `/api/projects/${projectId}/templates`
      const method = isEditMode ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || '儲存失敗')
      }

      onSave()
    } catch (error) {
      console.error('儲存定期任務失敗:', error)
      alert(error instanceof Error ? error.message : '儲存失敗，請稍後重試')
    } finally {
      setSaving(false)
    }
  }

  // ---- Render ----

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {isEditMode ? '編輯定期任務' : '新增定期任務'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              名稱 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：每月帳單付款"
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent transition-shadow"
            />
          </div>

          {/* Title Pattern */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              卡片標題模式 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={titlePattern}
              onChange={(e) => setTitlePattern(e.target.value)}
              placeholder="例：{{YYYY}}/{{MM}} 帳單付款"
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent transition-shadow"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {'可用 {{YYYY}} 和 {{MM}} 作為年月佔位符'}
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              描述
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="選填說明…"
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent transition-shadow resize-none"
            />
          </div>

          {/* Priority + Target Column (side by side) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                優先度
              </label>
              <Select value={priority} onValueChange={(v) => setPriority(v as 'low' | 'medium' | 'high')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                目標欄位
              </label>
              <Select value={targetColumnId} onValueChange={setTargetColumnId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="選擇欄位" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(col => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Rolling Due Date */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="rolling-due-date"
              checked={rollingDueDate}
              onChange={(e) => setRollingDueDate(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus-visible:ring-blue-500"
            />
            <div>
              <label htmlFor="rolling-due-date" className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                滾動截止日
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                母卡截止日自動跟隨最近未完成的子任務
              </p>
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              子任務
            </label>
            <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
              {subtasks.length === 0 && (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">
                  尚無子任務
                </p>
              )}

              {subtasks.map((subtask, index) => (
                <div key={index} className="flex items-center gap-2">
                  {/* Title */}
                  <input
                    type="text"
                    value={subtask.title}
                    onChange={(e) => handleSubtaskChange(index, 'title', e.target.value)}
                    placeholder="子任務標題"
                    className="flex-1 min-w-0 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent"
                  />

                  {/* Day of month */}
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={subtask.day_of_month ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value, 10) : null
                        handleSubtaskChange(index, 'day_of_month', val)
                      }}
                      placeholder="-"
                      className="w-12 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-1.5 py-1.5 text-sm text-center text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-transparent"
                    />
                    <span className="text-xs text-slate-500 dark:text-slate-400">號</span>
                  </div>

                  {/* Assignee */}
                  <Select
                    value={subtask.assignee_id || '__none__'}
                    onValueChange={(v) => handleSubtaskChange(index, 'assignee_id', v === '__none__' ? null : v)}
                  >
                    <SelectTrigger size="sm" className="w-24 shrink-0">
                      <SelectValue placeholder="指派" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">無</SelectItem>
                      {members.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Delete */}
                  <button
                    onClick={() => handleRemoveSubtask(index)}
                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    title="刪除子任務"
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}

              <button
                onClick={handleAddSubtask}
                className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors mt-1"
              >
                <PlusIcon />
                <span>新增子任務</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !titlePattern.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>
    </div>
  )
}
