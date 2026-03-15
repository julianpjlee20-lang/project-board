'use client'

import { useState, useEffect, useMemo, useTransition, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import Link from 'next/link'
import UserNav from '@/components/UserNav'
import { ThemeToggle } from '@/components/ThemeToggle'
import dynamic from 'next/dynamic'
import type { Card, Column, Project, ViewType, Phase, Subtask } from './types'
import { getSubtaskUrgency } from './types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { queryKeys } from '@/lib/query-keys'
import {
  fetchColumns as fetchColumnsApi,
  fetchPhases as fetchPhasesApi,
  createCard,
  updateCard,
  moveCard,
  createColumn as createColumnApi,
  deleteColumn as deleteColumnApi,
  createPhase as createPhaseApi,
  deletePhase as deletePhaseApi,
  batchUpdateSubtasks,
} from '@/lib/api'
import { exportToXlsx, exportToPdf } from '@/lib/export'
import Toast from '@/components/ui/toast'

const ListView = dynamic(() => import('./views').then(m => ({ default: m.ListView })))
const CalendarView = dynamic(() => import('./views').then(m => ({ default: m.CalendarView })))
const ProgressView = dynamic(() => import('./views').then(m => ({ default: m.ProgressView })))
const GanttView = dynamic(() => import('./gantt').then(m => ({ default: m.GanttView })))
const CardModal = dynamic(() => import('./card-detail').then(m => ({ default: m.CardModal })))
const SlideInPane = dynamic(() => import('./card-detail').then(m => ({ default: m.SlideInPane })))
const ArchivePanel = dynamic(() => import('./archive-panel').then(m => ({ default: m.ArchivePanel })))

// Priority color mapping (Tailwind border-left classes)
const PRIORITY_BORDER_CLASSES: Record<Card['priority'], string> = {
  high: 'border-l-priority-high',
  medium: 'border-l-priority-medium',
  low: 'border-l-emerald-500',
}

const PRESET_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4']

const VIEW_TABS: { id: ViewType; label: string; icon: string }[] = [
  { id: 'board', label: '看板', icon: '📋' },
  { id: 'list', label: '列表', icon: '📝' },
  { id: 'calendar', label: '行事曆', icon: '📅' },
  { id: 'gantt', label: '甘特圖', icon: '📐' },
  { id: 'progress', label: '進度', icon: '📊' },
]

// Draggable Card Component
function CardItem({ card, index, onClick, phases }: { card: Card, index: number, onClick: () => void, phases: Phase[] }) {
  const phaseMap = useMemo(() => new Map(phases.map(p => [p.id, p])), [phases])
  const priorityBorderClass = PRIORITY_BORDER_CLASSES[card.priority] || PRIORITY_BORDER_CLASSES.medium
  const phase = card.phase_id ? phaseMap.get(card.phase_id) ?? null : null
  const completedSubtasks = card.subtasks?.filter(s => s.is_completed).length || 0
  const totalSubtasks = card.subtasks?.length || 0
  const assigneeName = card.assignees?.[0]?.name || ''
  const assigneeInitial = assigneeName ? assigneeName.charAt(0) : ''
  const urgency = useMemo(() => getSubtaskUrgency(card.subtasks || []), [card.subtasks])
  const showUrgency = urgency.level === 'overdue' || urgency.level === 'today' || urgency.level === 'soon'

  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          className={`bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm hover:shadow-md border-l-[3px] mb-2 cursor-pointer ${priorityBorderClass} ${
            snapshot.isDragging ? 'shadow-lg rotate-2' : ''
          } ${urgency.level === 'overdue' ? 'ring-1 ring-red-200 dark:ring-red-800/50' : ''}`}
          style={{
            ...provided.draggableProps.style,
            opacity: snapshot.isDragging ? 0.9 : 1,
          }}
        >
          {/* Phase badge */}
          {phase && (
            <div className="mb-1.5">
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium text-white"
                style={{ backgroundColor: phase.color }}
              >
                {phase.name}
              </span>
            </div>
          )}

          {/* Card number + Title */}
          <div className="flex items-start gap-1.5">
            {card.card_number != null && (
              <span className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-[2px] flex-shrink-0">#{card.card_number}</span>
            )}
            <p className="font-medium text-sm leading-snug line-clamp-2">{card.title}</p>
            {card.recurrence_rule && (
              <span className="flex-shrink-0 mt-[2px]" title="定期任務">
                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </span>
            )}
          </div>

          {/* Bottom row: assignee avatar + urgency (left) + subtask count (right) */}
          {(assigneeInitial || totalSubtasks > 0 || showUrgency) && (
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5">
                {assigneeInitial && (
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold"
                    title={assigneeName}
                  >
                    {assigneeInitial}
                  </span>
                )}
                {showUrgency && (
                  <span className="inline-flex items-center gap-1" title={`${urgency.urgentCount} 個子任務即將到期`}>
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      urgency.level === 'soon' ? 'bg-amber-500' : 'bg-red-500 animate-pulse'
                    }`} />
                    {urgency.level === 'overdue' && (
                      <span className="text-[10px] text-red-500 dark:text-red-400 font-medium leading-none">逾期{Math.abs(urgency.days!)}天</span>
                    )}
                    {urgency.level === 'today' && (
                      <span className="text-[10px] text-red-500 dark:text-red-400 font-medium leading-none">今天</span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex items-center">
                {totalSubtasks > 0 && (
                  <span className={`text-xs ${completedSubtasks === totalSubtasks ? 'text-green-600' : 'text-slate-500 dark:text-slate-400'}`}>
                    ✓ {completedSubtasks}/{totalSubtasks}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}

function ColumnDroppable({ column, allColumns, phases, onCardClick, onAddCard, onDeleteColumn, selectedPhase }: {
  column: Column,
  allColumns: Column[],
  phases: Phase[],
  onCardClick: (card: Card) => void,
  onAddCard: (columnId: string, title: string, phaseId?: string | null) => void,
  onDeleteColumn: (columnId: string, targetColumnId?: string | null) => void,
  selectedPhase?: string | null,
}) {
  const [newCardTitle, setNewCardTitle] = useState('')
  const [showAddCard, setShowAddCard] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [targetColumnId, setTargetColumnId] = useState<string>('')

  // 已完成欄位摺疊：超過 5 張卡片時預設收合
  const isDoneColumn = /done|完成/i.test(column.name)
  const [isDoneCollapsed, setIsDoneCollapsed] = useState(true)
  const shouldCollapse = isDoneColumn && (column.cards?.length || 0) > 5
  const visibleCards = shouldCollapse && isDoneCollapsed
    ? column.cards.slice(0, 5)
    : column.cards
  const hiddenCount = shouldCollapse ? (column.cards?.length || 0) - 5 : 0

  // 使用未篩選的 allColumns 取得真實卡片數（Phase 篩選時 column.cards 只包含篩選後的卡片）
  const realColumn = allColumns.find(c => c.id === column.id)
  const realCardCount = realColumn?.cards.length || 0

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault()
    if (newCardTitle.trim()) {
      onAddCard(column.id, newCardTitle.trim(), selectedPhase)
      setNewCardTitle('')
      setShowAddCard(false)
    }
  }

  return (
    <Droppable droppableId={column.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className="w-72 max-sm:w-full flex-shrink-0 flex flex-col"
        >
          <div className="flex items-center justify-between mb-3 group/col">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200">
              {column.name}
              <span className="ml-2 text-sm text-slate-400 dark:text-slate-500">{column.cards?.length || 0}</span>
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover/col:opacity-100"
                title="刪除欄位"
                aria-label={`刪除欄位 ${column.name}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
              {!showAddCard && (
                <button
                  onClick={() => setShowAddCard(true)}
                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title="新增卡片"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div
            className={`flex-1 space-y-2 overflow-y-auto min-h-[100px] rounded ${snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
          >
            {visibleCards?.map((card, index) => (
              <CardItem
                key={card.id}
                card={card}
                index={index}
                onClick={() => onCardClick(card)}
                phases={phases}
              />
            ))}
            {provided.placeholder}
            {shouldCollapse && (
              <button
                onClick={() => setIsDoneCollapsed(!isDoneCollapsed)}
                className="w-full mt-2 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-center"
              >
                {isDoneCollapsed
                  ? `+${hiddenCount} 張隱藏中 — 點擊展開`
                  : '收合'}
              </button>
            )}
          </div>

          {showAddCard && (
            <form onSubmit={handleAddCard} className="mt-2">
              <input
                value={newCardTitle}
                onChange={e => setNewCardTitle(e.target.value)}
                placeholder="卡片標題…"
                className="w-full px-3 py-2.5 max-sm:py-3 text-base border rounded mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 bg-white dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 px-3 py-2.5 max-sm:py-3 text-sm max-sm:text-base bg-blue-500 text-white rounded min-h-[44px]">新增</button>
                <button type="button" onClick={() => setShowAddCard(false)} className="flex-1 px-3 py-2.5 max-sm:py-3 text-sm max-sm:text-base border rounded min-h-[44px] dark:border-slate-700 dark:text-slate-300">取消</button>
              </div>
            </form>
          )}

          {/* 刪除欄位確認對話框 */}
          <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); setTargetColumnId('') } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>刪除欄位</DialogTitle>
                <DialogDescription>
                  確定要刪除欄位「{column.name}」嗎？此操作無法復原。
                </DialogDescription>
              </DialogHeader>
              {realCardCount > 0 && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">此欄位包含 {realCardCount} 個卡片</p>
                  {allColumns.filter(c => c.id !== column.id).length > 0 ? (
                    <>
                      <p className="mt-1 text-amber-700 dark:text-amber-300">請選擇要將卡片移至哪個欄位：</p>
                      <select
                        value={targetColumnId}
                        onChange={(e) => setTargetColumnId(e.target.value)}
                        className="mt-2 w-full rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus-visible:border-blue-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                      >
                        <option value="">— 請選擇目標欄位 —</option>
                        {allColumns.filter(c => c.id !== column.id).map(c => (
                          <option key={c.id} value={c.id}>{c.name}（{c.cards.length} 個卡片）</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <p className="mt-1 text-red-600 dark:text-red-400">無其他欄位可遷移卡片，無法刪除此欄位。</p>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setTargetColumnId('') }}>取消</Button>
                <Button
                  variant="destructive"
                  disabled={realCardCount > 0 && (!targetColumnId || allColumns.filter(c => c.id !== column.id).length === 0)}
                  onClick={() => {
                    onDeleteColumn(column.id, targetColumnId || null)
                    setShowDeleteDialog(false)
                    setTargetColumnId('')
                  }}
                >
                  確認刪除
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </Droppable>
  )
}

// Phase Filter Bar
function PhaseFilterBar({ phases, selectedPhase, onSelect, onAddPhase, onDeletePhase }: {
  phases: Phase[]
  selectedPhase: string | null
  onSelect: (phaseId: string | null) => void
  onAddPhase: (name: string, color: string) => void
  onDeletePhase: (id: string, targetPhaseId?: string | null) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#6366F1')
  const [pendingDeletePhase, setPendingDeletePhase] = useState<Phase | null>(null)
  const [targetPhaseId, setTargetPhaseId] = useState<string>('')

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    if (newName.trim()) {
      onAddPhase(newName.trim(), newColor)
      setNewName('')
      setNewColor('#6366F1')
      setShowAdd(false)
    }
  }

  return (
    <div className="flex flex-wrap max-sm:flex-nowrap items-center gap-2 px-6 max-sm:px-3 py-2 bg-white dark:bg-slate-900 border-b dark:border-slate-700 max-h-28 max-sm:max-h-none overflow-y-auto max-sm:overflow-y-hidden max-sm:overflow-x-auto">
      {/* "All" button */}
      <button
        onClick={() => onSelect(null)}
        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 min-h-[36px] ${
          selectedPhase === null
            ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-sm'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        全部
      </button>

      {/* Phase buttons */}
      {phases.map(phase => (
        <div key={phase.id} className="relative group flex items-center flex-shrink-0">
          <button
            onClick={() => onSelect(phase.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 min-h-[36px] ${
              selectedPhase === phase.id
                ? 'text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:opacity-80'
            }`}
            style={{
              backgroundColor: selectedPhase === phase.id ? phase.color : phase.color + '20',
              color: selectedPhase === phase.id ? '#fff' : phase.color,
            }}
          >
            {phase.name}
            {phase.total_cards > 0 && (
              <span className={`text-xs ${selectedPhase === phase.id ? 'text-white/80' : 'opacity-60'}`}>
                {phase.progress}%
              </span>
            )}
          </button>
          {/* Delete button on hover */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPendingDeletePhase(phase)
            }}
            className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white hover:bg-red-600 text-[10px] leading-none transition-opacity z-10"
          >
            ✕
          </button>
        </div>
      ))}

      {/* Add phase button */}
      {showAdd ? (
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="階段名稱…"
            className="px-2 py-1 text-sm border rounded w-28 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
            autoFocus
          />
          <div className="flex gap-1">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`w-5 h-5 rounded-full border-2 transition-transform ${newColor === c ? 'border-slate-800 dark:border-slate-200 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button type="submit" className="px-2 py-1 text-sm bg-blue-500 text-white rounded">新增</button>
          <button type="button" onClick={() => setShowAdd(false)} className="px-2 py-1 text-sm border rounded dark:border-slate-600 dark:text-slate-300">取消</button>
        </form>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5 rounded-full text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          + 新增階段
        </button>
      )}

      <Dialog open={pendingDeletePhase !== null} onOpenChange={(open) => { if (!open) { setPendingDeletePhase(null); setTargetPhaseId('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>刪除階段</DialogTitle>
            <DialogDescription>
              確定要刪除階段「{pendingDeletePhase?.name}」嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>
          {pendingDeletePhase && pendingDeletePhase.total_cards > 0 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">⚠ 此階段包含 {pendingDeletePhase.total_cards} 個任務</p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">請選擇要將任務移至哪個階段：</p>
              <select
                value={targetPhaseId}
                onChange={(e) => setTargetPhaseId(e.target.value)}
                className="mt-2 w-full rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 shadow-sm focus-visible:border-blue-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <option value="">不指定階段（移除標記）</option>
                {phases.filter(p => p.id !== pendingDeletePhase.id).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPendingDeletePhase(null); setTargetPhaseId('') }}>取消</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDeletePhase) {
                  onDeletePhase(pendingDeletePhase.id, targetPhaseId || null)
                  setPendingDeletePhase(null)
                  setTargetPhaseId('')
                }
              }}
            >
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface BoardPageClientProps {
  projectId: string
  initialProject: Project
  initialColumns: Column[]
  initialPhases: Phase[]
}

export function BoardPageClient({ projectId, initialProject, initialColumns, initialPhases }: BoardPageClientProps) {
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const cardIdFromUrl = searchParams.get('cardId')

  const [project] = useState<Project>(initialProject)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [currentView, setCurrentView] = useState<ViewType>('board')

  // TanStack Query for columns + phases (with SSR initial data)
  const { data: queryColumns } = useQuery({
    queryKey: queryKeys.board.columns(projectId),
    queryFn: () => fetchColumnsApi(projectId) as Promise<Column[]>,
    initialData: initialColumns,
    staleTime: 10 * 1000,
  })

  const { data: queryPhases } = useQuery({
    queryKey: queryKeys.board.phases(projectId),
    queryFn: () => fetchPhasesApi(projectId) as Promise<Phase[]>,
    initialData: initialPhases,
    staleTime: 10 * 1000,
  })

  // Local state for DnD optimistic updates -- synced from query data
  const [columns, setColumns] = useState<Column[]>(initialColumns)
  const [phases, setPhases] = useState<Phase[]>(initialPhases)

  // Sync local state when query data changes (e.g. after invalidation)
  useEffect(() => {
    if (queryColumns) setColumns(queryColumns)
  }, [queryColumns])

  useEffect(() => {
    if (queryPhases) setPhases(queryPhases)
  }, [queryPhases])

  const [selectedPhase, setSelectedPhase] = useState<string | null>(null)

  // Archive panel
  const [showArchivePanel, setShowArchivePanel] = useState(false)
  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false)

  // 未完成子任務確認對話框
  const [pendingDrag, setPendingDrag] = useState<{
    result: DropResult
    card: Card
    sourceColumnId: string
    incompleteSubtasks: Subtask[]
  } | null>(null)

  // Undo toast
  const [undoToast, setUndoToast] = useState<{
    message: string
    snapshot: {
      cardId: string
      sourceColumnId: string
      destColumnId: string
      sourceIndex: number
      destIndex: number
      subtaskIds: string[]
      prevColumns: Column[]
    }
  } | null>(null)

  const [, startTransition] = useTransition()

  // Helper to invalidate board data
  const invalidateBoard = useCallback(async () => {
    await Promise.all([
      queryClient.refetchQueries({ queryKey: queryKeys.board.columns(projectId) }),
      queryClient.refetchQueries({ queryKey: queryKeys.board.phases(projectId) }),
    ])
  }, [queryClient, projectId])

  // Auto-open card from URL query param (e.g. from notification center)
  useEffect(() => {
    if (cardIdFromUrl && columns.length > 0 && !selectedCard) {
      const card = columns.flatMap(c => c.cards).find(c => c.id === cardIdFromUrl)
      if (card) {
        setSelectedCard(card)
      }
    }
  }, [cardIdFromUrl, columns, selectedCard])

  // ─── Mutations ────────────────────────────────────────────

  const addPhaseMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) => createPhaseApi(projectId, data),
    onSuccess: () => invalidateBoard(),
    onError: (error: Error) => {
      console.error('新增階段錯誤:', error)
      alert(error.message || '新增階段失敗')
    },
  })

  const deletePhaseMutation = useMutation({
    mutationFn: (data: { id: string; targetPhaseId?: string | null }) =>
      deletePhaseApi(projectId, data.id, data.targetPhaseId),
    onSuccess: (_data: unknown, variables: { id: string; targetPhaseId?: string | null }) => {
      if (selectedPhase === variables.id) {
        setSelectedPhase(null)
      }
      invalidateBoard()
    },
    onError: (error: Error) => {
      console.error('刪除階段錯誤:', error)
      alert(error.message || '刪除階段失敗')
    },
  })

  const addCardMutation = useMutation({
    mutationFn: (data: { column_id: string; title: string; phase_id?: string }) =>
      createCard(data),
    onSuccess: () => invalidateBoard(),
    onError: (error: Error) => {
      console.error('新增卡片錯誤:', error)
      alert(error.message || '新增卡片失敗，請重試')
    },
  })

  const addColumnMutation = useMutation({
    mutationFn: (name: string) => createColumnApi({ project_id: projectId, name }),
    onSuccess: () => invalidateBoard(),
    onError: (error: Error) => {
      console.error('新增欄位錯誤:', error)
      alert(error.message || '新增欄位失敗，請重試')
    },
  })

  const deleteColumnMutation = useMutation({
    mutationFn: (data: { id: string; targetColumnId?: string | null }) =>
      deleteColumnApi(data.id, data.targetColumnId),
    onSuccess: () => invalidateBoard(),
    onError: (error: Error) => {
      console.error('刪除欄位錯誤:', error)
      alert(error.message || '刪除欄位失敗')
    },
  })

  // Wrapper functions to maintain existing component API
  function addPhase(name: string, color: string) {
    addPhaseMutation.mutate({ name, color })
  }

  function deletePhase(id: string, targetPhaseId?: string | null) {
    deletePhaseMutation.mutate({ id, targetPhaseId })
  }

  function addCard(columnId: string, title: string, phaseId?: string | null) {
    addCardMutation.mutate({ column_id: columnId, title, phase_id: phaseId || undefined })
  }

  function addColumn(name: string) {
    addColumnMutation.mutate(name)
  }

  function deleteColumnHandler(id: string, targetColumnId?: string | null) {
    deleteColumnMutation.mutate({ id, targetColumnId })
  }

  // Apply phase filter to columns
  const filteredColumns = useMemo(() =>
    selectedPhase
      ? columns.map(col => ({
          ...col,
          cards: col.cards.filter(card => card.phase_id === selectedPhase)
        }))
      : columns,
    [columns, selectedPhase]
  )

  // 執行卡片移動 + 子任務批次完成的核心邏輯
  const executeDragWithBatchComplete = useCallback(async (
    result: DropResult,
    card: Card,
    incompleteSubtaskIds: string[],
  ) => {
    const { destination, source, draggableId } = result
    if (!destination) return

    // Dismiss any existing undo toast before proceeding
    setUndoToast(null)

    // 1. Snapshot for undo (deep clone subtasks to avoid reference pollution)
    const prevColumns = columns.map(col => ({
      ...col,
      cards: col.cards.map(c => ({ ...c, subtasks: c.subtasks.map(s => ({ ...s })) }))
    }))

    // 2. Optimistic update: move card + mark subtasks complete
    const sourceColumn = columns.find(c => c.id === source.droppableId)
    const destColumn = columns.find(c => c.id === destination.droppableId)
    if (!sourceColumn || !destColumn) return

    const sourceCards = [...sourceColumn.cards]
    const [movedCard] = sourceCards.splice(source.index, 1)
    const destCards = [...destColumn.cards]
    // Mark subtasks complete on moved card
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const updatedCard = {
      ...movedCard,
      subtasks: movedCard.subtasks.map(s =>
        incompleteSubtaskIds.includes(s.id) ? { ...s, is_completed: true } : s
      ),
      actual_completion_date: todayStr,
    }
    destCards.splice(destination.index, 0, updatedCard)

    const newColumns = columns.map(col => {
      if (col.id === source.droppableId) return { ...col, cards: sourceCards }
      if (col.id === destination.droppableId) return { ...col, cards: destCards }
      return col
    })
    setColumns(newColumns)

    // 3. API calls (parallel)
    try {
      const [, moveResult] = await Promise.all([
        batchUpdateSubtasks(draggableId, {
          action: 'complete_all',
          subtask_ids: incompleteSubtaskIds,
          skip_auto_transition: true,
        }),
        moveCard({
          card_id: draggableId,
          source_column_id: source.droppableId,
          dest_column_id: destination.droppableId,
          source_index: source.index,
          dest_index: destination.index,
        }),
        updateCard(draggableId, {
          title: card.title,
          actual_completion_date: todayStr,
        }),
      ])
      if (moveResult?.recurring_card_created) {
        invalidateBoard()
      }
    } catch (e) {
      console.error('Failed to save:', e)
      setColumns(prevColumns) // rollback
      await invalidateBoard() // sync with server truth
      alert('操作失敗，已還原到最新狀態，請重試')
      return
    }

    // 4. Show undo toast
    setUndoToast({
      message: `已將 ${incompleteSubtaskIds.length} 個子任務標記完成`,
      snapshot: {
        cardId: draggableId,
        sourceColumnId: source.droppableId,
        destColumnId: destination.droppableId,
        sourceIndex: source.index,
        destIndex: destination.index,
        subtaskIds: incompleteSubtaskIds,
        prevColumns,
      },
    })
  }, [columns, invalidateBoard])

  // 僅移動卡片（不動子任務）
  const executeDragMoveOnly = useCallback(async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return

    const sourceColumn = columns.find(c => c.id === source.droppableId)
    const destColumn = columns.find(c => c.id === destination.droppableId)
    if (!sourceColumn || !destColumn) return

    const sourceCards = [...sourceColumn.cards]
    const [movedCard] = sourceCards.splice(source.index, 1)
    const destCards = [...destColumn.cards]
    destCards.splice(destination.index, 0, movedCard)

    const newColumns = columns.map(col => {
      if (col.id === source.droppableId) return { ...col, cards: sourceCards }
      if (col.id === destination.droppableId) return { ...col, cards: destCards }
      return col
    })
    setColumns(newColumns)

    // Auto-fill actual_completion_date
    const isLastColumn = columns[columns.length - 1]?.id === destination.droppableId
    if (isLastColumn && !movedCard.actual_completion_date) {
      const now = new Date()
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      setColumns(prev => prev.map(col => ({
        ...col,
        cards: col.cards.map(c => c.id === draggableId ? { ...c, actual_completion_date: todayStr } : c)
      })))
      try {
        await updateCard(draggableId, { title: movedCard.title, actual_completion_date: todayStr })
      } catch {
        setColumns(prev => prev.map(col => ({
          ...col,
          cards: col.cards.map(c => c.id === draggableId ? { ...c, actual_completion_date: null } : c)
        })))
      }
    }

    try {
      const moveResult = await moveCard({
        card_id: draggableId,
        source_column_id: source.droppableId,
        dest_column_id: destination.droppableId,
        source_index: source.index,
        dest_index: destination.index,
      })
      if (moveResult?.recurring_card_created) {
        invalidateBoard()
      }
    } catch (e) {
      console.error('Failed to save:', e)
      invalidateBoard()
    }
  }, [columns, invalidateBoard])

  // Toast dismiss (stable reference to avoid timer resets)
  const handleToastDismiss = useCallback(() => setUndoToast(null), [])

  // Undo 復原
  const handleUndo = useCallback(async () => {
    if (!undoToast) return
    const { snapshot } = undoToast

    // Find the card title from CURRENT columns (not snapshot) to avoid overwriting recent edits
    const currentCard = columns
      .flatMap(col => col.cards)
      .find(c => c.id === snapshot.cardId)

    // 1. Client-side rollback
    setColumns(snapshot.prevColumns)
    setUndoToast(null)

    // 2. Server-side rollback (parallel)
    try {
      await Promise.all([
        batchUpdateSubtasks(snapshot.cardId, {
          action: 'uncomplete_all',
          subtask_ids: snapshot.subtaskIds,
          skip_auto_transition: true,
        }),
        moveCard({
          card_id: snapshot.cardId,
          source_column_id: snapshot.destColumnId,
          dest_column_id: snapshot.sourceColumnId,
          source_index: snapshot.destIndex,
          dest_index: snapshot.sourceIndex,
        }),
        updateCard(snapshot.cardId, {
          title: currentCard?.title || snapshot.prevColumns.flatMap(c => c.cards).find(c => c.id === snapshot.cardId)?.title || '',
          actual_completion_date: snapshot.prevColumns.flatMap(c => c.cards).find(c => c.id === snapshot.cardId)?.actual_completion_date ?? null,
        }),
      ])
    } catch (e) {
      console.error('Undo failed:', e)
      invalidateBoard()
    }
  }, [undoToast, columns, invalidateBoard])

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    // ── 攔截：拖到完成欄時檢查未完成子任務 ──
    const isMovingToLastColumn = columns[columns.length - 1]?.id === destination.droppableId
    if (isMovingToLastColumn && source.droppableId !== destination.droppableId) {
      const sourceCol = columns.find(c => c.id === source.droppableId)
      const card = sourceCol?.cards[source.index]
      if (card) {
        const incompleteSubtasks = (card.subtasks || []).filter(s => !s.is_completed)
        if (incompleteSubtasks.length > 0) {
          // 開啟確認對話框，暫停拖放
          setPendingDrag({
            result,
            card,
            sourceColumnId: source.droppableId,
            incompleteSubtasks,
          })
          return // 不執行移動，等待使用者選擇
        }
      }
    }

    // Find the column and card
    const sourceColumn = columns.find(c => c.id === source.droppableId)
    const destColumn = columns.find(c => c.id === destination.droppableId)

    if (!sourceColumn || !destColumn) return

    // Create new cards array
    const sourceCards = [...sourceColumn.cards]
    const [movedCard] = sourceCards.splice(source.index, 1)

    let newColumns: Column[]

    if (source.droppableId === destination.droppableId) {
      // Same column reorder
      sourceCards.splice(destination.index, 0, movedCard)
      newColumns = columns.map(col =>
        col.id === source.droppableId ? { ...col, cards: sourceCards } : col
      )
    } else {
      // Different column move
      const destCards = [...destColumn.cards]
      destCards.splice(destination.index, 0, movedCard)
      newColumns = columns.map(col => {
        if (col.id === source.droppableId) return { ...col, cards: sourceCards }
        if (col.id === destination.droppableId) return { ...col, cards: destCards }
        return col
      })
    }

    // Update local state immediately (optimistic)
    setColumns(newColumns)

    // Auto-fill actual_completion_date when dragging to last column (Done)
    const isLastColumn = columns[columns.length - 1]?.id === destination.droppableId
    const wasLastColumn = columns[columns.length - 1]?.id === source.droppableId
    const now = new Date(); const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    if (source.droppableId !== destination.droppableId) {
      if (isLastColumn && !movedCard.actual_completion_date) {
        // Moving to Done -> auto-fill actual_completion_date
        setColumns(prev => prev.map(col => ({
          ...col,
          cards: col.cards.map(c => c.id === draggableId ? { ...c, actual_completion_date: todayStr } : c)
        })))
        try {
          await updateCard(draggableId, { title: movedCard.title, actual_completion_date: todayStr })
        } catch {
          // Rollback on failure
          setColumns(prev => prev.map(col => ({
            ...col,
            cards: col.cards.map(c => c.id === draggableId ? { ...c, actual_completion_date: null } : c)
          })))
        }
      } else if (wasLastColumn && movedCard.actual_completion_date) {
        // Moving from Done back -> clear actual_completion_date
        const oldDate = movedCard.actual_completion_date
        setColumns(prev => prev.map(col => ({
          ...col,
          cards: col.cards.map(c => c.id === draggableId ? { ...c, actual_completion_date: null } : c)
        })))
        try {
          await updateCard(draggableId, { title: movedCard.title, actual_completion_date: null })
        } catch {
          // Rollback on failure
          setColumns(prev => prev.map(col => ({
            ...col,
            cards: col.cards.map(c => c.id === draggableId ? { ...c, actual_completion_date: oldDate } : c)
          })))
        }
      }
    }

    // Save to server
    try {
      const moveResult = await moveCard({
        card_id: draggableId,
        source_column_id: source.droppableId,
        dest_column_id: destination.droppableId,
        source_index: source.index,
        dest_index: destination.index,
      })
      if (moveResult?.recurring_card_created) {
        invalidateBoard()
      }
    } catch (e) {
      console.error('Failed to save:', e)
      invalidateBoard() // Refresh on error
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div id="main-content" className="h-screen flex flex-col">
        <header className="border-b dark:border-slate-700 px-6 max-sm:px-3 py-4 max-sm:py-3 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900">
          <h1 className="text-xl max-sm:text-lg font-bold truncate max-w-[50vw]">{project.name}</h1>
          <div className="flex items-center gap-2 max-sm:gap-1">
            <Link href="/projects" className="px-3 py-2 border rounded hover:bg-slate-50 dark:hover:bg-slate-800 dark:border-slate-700 dark:text-slate-300 text-sm min-h-[40px] flex items-center max-sm:order-last">返回</Link>
            <ThemeToggle />
            <UserNav />
          </div>
          <div className="w-full sm:hidden" />
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 max-sm:w-full max-sm:overflow-x-auto">
            {VIEW_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => startTransition(() => setCurrentView(tab.id))}
                className={`px-3 py-1.5 max-sm:px-2 max-sm:py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap max-sm:flex-1 min-h-[36px] ${
                  currentView === tab.id
                    ? 'bg-white dark:bg-slate-700 shadow text-slate-900 dark:text-slate-100'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span className="sm:hidden">{tab.icon}</span>
                <span className="max-sm:hidden">{tab.icon} </span>
                {tab.label}
              </button>
            ))}
          </div>
          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-3 py-1.5 rounded-md text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[36px] whitespace-nowrap flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="max-sm:hidden">匯出</span>
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 min-w-[160px]">
                  <button
                    onClick={() => {
                      exportToXlsx(project.name, filteredColumns, phases)
                      setShowExportMenu(false)
                    }}
                    className="w-full px-4 py-2.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                  >
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    下載 Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => {
                      exportToPdf(project.name, filteredColumns, phases)
                      setShowExportMenu(false)
                    }}
                    className="w-full px-4 py-2.5 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-700 dark:text-slate-200"
                  >
                    <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    列印 / 存為 PDF
                  </button>
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setShowArchivePanel(true)}
            className="px-3 py-1.5 rounded-md text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[36px] whitespace-nowrap flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="max-sm:hidden">封存</span>
          </button>
        </header>

        {/* Phase Filter Bar */}
        <PhaseFilterBar
          phases={phases}
          selectedPhase={selectedPhase}
          onSelect={(phase) => startTransition(() => setSelectedPhase(phase))}
          onAddPhase={addPhase}
          onDeletePhase={deletePhase}
        />

        <div className={`flex-1 overflow-auto p-6 max-sm:p-3 bg-slate-50 dark:bg-slate-800 transition-[padding] duration-300 ${
          selectedCard && currentView === 'board' ? 'md:mr-[420px]' : ''
        }`}>
          {currentView === 'board' && (
            <div className="flex gap-4 h-full max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory max-sm:pb-4 max-sm:-mx-3 max-sm:px-3">
              {filteredColumns.map((column) => (
                <div key={column.id} className="max-sm:snap-center max-sm:flex-shrink-0 max-sm:w-[85vw]">
                  <ColumnDroppable
                    column={column}
                    allColumns={columns}
                    phases={phases}
                    onCardClick={setSelectedCard}
                    onAddCard={addCard}
                    onDeleteColumn={deleteColumnHandler}
                    selectedPhase={selectedPhase}
                  />
                </div>
              ))}
              <div className="max-sm:snap-center max-sm:flex-shrink-0 max-sm:w-[85vw]">
                <AddColumnForm onAdd={addColumn} />
              </div>
            </div>
          )}

          {currentView === 'list' && <ListView columns={filteredColumns} phases={phases} onCardClick={setSelectedCard} />}
          {currentView === 'calendar' && <CalendarView columns={filteredColumns} onCardClick={setSelectedCard} />}
          {currentView === 'gantt' && (
            <GanttView
              columns={filteredColumns}
              phases={phases}
              onCardClick={setSelectedCard}
            />
          )}
          {currentView === 'progress' && <ProgressView columns={filteredColumns} />}
        </div>

        {selectedCard && currentView === 'board' && (
          <SlideInPane
            card={selectedCard}
            phases={phases}
            onClose={() => setSelectedCard(null)}
            onUpdate={invalidateBoard}
          />
        )}
        {selectedCard && currentView !== 'board' && (
          <CardModal
            card={selectedCard}
            phases={phases}
            onClose={() => setSelectedCard(null)}
            onUpdate={invalidateBoard}
          />
        )}
      </div>

      <ArchivePanel
        projectId={projectId}
        isOpen={showArchivePanel}
        onClose={() => setShowArchivePanel(false)}
        onRefreshBoard={invalidateBoard}
      />

      {/* 未完成子任務確認對話框 */}
      <Dialog open={!!pendingDrag} onOpenChange={(open) => { if (!open) setPendingDrag(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>子任務未完成</DialogTitle>
            <DialogDescription>
              「{pendingDrag?.card.title}」尚有 {pendingDrag?.incompleteSubtasks.length} 個子任務未完成
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {pendingDrag?.incompleteSubtasks.map(st => (
              <div key={st.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span className="w-4 h-4 border rounded flex-shrink-0" />
                <span className="truncate">{st.title}</span>
                {st.due_date && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                    {new Date(st.due_date).toLocaleDateString('zh-TW')}
                  </span>
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="default"
              onClick={() => {
                if (pendingDrag) {
                  const ids = pendingDrag.incompleteSubtasks.map(s => s.id)
                  executeDragWithBatchComplete(pendingDrag.result, pendingDrag.card, ids)
                  setPendingDrag(null)
                }
              }}
            >
              全部標記完成
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (pendingDrag) {
                  executeDragMoveOnly(pendingDrag.result)
                  setPendingDrag(null)
                }
              }}
            >
              僅移動卡片
            </Button>
            <Button
              variant="ghost"
              onClick={() => setPendingDrag(null)}
            >
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Undo Toast */}
      {undoToast && (
        <Toast
          message={undoToast.message}
          action={{ label: '復原', onClick: handleUndo }}
          duration={8000}
          onDismiss={handleToastDismiss}
        />
      )}
    </DragDropContext>
  )
}

function AddColumnForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onAdd(name.trim())
      setName('')
    }
  }

  return (
    <div className="w-72 max-sm:w-full flex-shrink-0">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="新欄位名稱…" className="flex h-10 max-sm:h-12 w-full rounded-md border dark:border-slate-700 px-3 py-2 text-base bg-white dark:bg-slate-900 dark:text-slate-100" />
        <button type="submit" className="px-4 py-2 bg-slate-100 dark:bg-slate-700 dark:text-slate-200 rounded min-h-[44px] min-w-[44px]">+</button>
      </form>
    </div>
  )
}
