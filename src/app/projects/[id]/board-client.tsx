'use client'

import { useState, useEffect, useMemo, useTransition, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import Link from 'next/link'
import UserNav from '@/components/UserNav'
import { ThemeToggle } from '@/components/ThemeToggle'
import dynamic from 'next/dynamic'
import type { Card, Column, Project, ViewType, Phase } from './types'
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
  createPhase as createPhaseApi,
  deletePhase as deletePhaseApi,
} from '@/lib/api'

const ListView = dynamic(() => import('./views').then(m => ({ default: m.ListView })))
const CalendarView = dynamic(() => import('./views').then(m => ({ default: m.CalendarView })))
const ProgressView = dynamic(() => import('./views').then(m => ({ default: m.ProgressView })))
const GanttView = dynamic(() => import('./gantt').then(m => ({ default: m.GanttView })))
const CardModal = dynamic(() => import('./card-detail').then(m => ({ default: m.CardModal })))
const SlideInPane = dynamic(() => import('./card-detail').then(m => ({ default: m.SlideInPane })))
const RecurringTasksPanel = dynamic(() => import('./recurring-tasks').then(m => ({ default: m.RecurringTasksPanel })))

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
          }`}
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
          </div>

          {/* Bottom row: assignee avatar (left) + subtask count (right) */}
          {(assigneeInitial || totalSubtasks > 0) && (
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center">
                {assigneeInitial && (
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-semibold"
                    title={assigneeName}
                  >
                    {assigneeInitial}
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

function ColumnDroppable({ column, phases, onCardClick, onAddCard, selectedPhase }: {
  column: Column,
  phases: Phase[],
  onCardClick: (card: Card) => void,
  onAddCard: (columnId: string, title: string, phaseId?: string | null) => void,
  selectedPhase?: string | null,
}) {
  const [newCardTitle, setNewCardTitle] = useState('')
  const [showAddCard, setShowAddCard] = useState(false)

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
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700 dark:text-slate-200">
              {column.name}
              <span className="ml-2 text-sm text-slate-400 dark:text-slate-500">{column.cards?.length || 0}</span>
            </h2>
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

          <div
            className={`flex-1 space-y-2 overflow-y-auto min-h-[100px] rounded ${snapshot.isDraggingOver ? 'bg-blue-50 dark:bg-blue-950' : ''}`}
          >
            {column.cards?.map((card, index) => (
              <CardItem
                key={card.id}
                card={card}
                index={index}
                onClick={() => onCardClick(card)}
                phases={phases}
              />
            ))}
            {provided.placeholder}
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
            className="hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-500 hover:bg-red-200 text-xs ml-1"
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

  // Recurring tasks panel
  const [showRecurringPanel, setShowRecurringPanel] = useState(false)

  const [, startTransition] = useTransition()

  // Helper to invalidate board data
  const invalidateBoard = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.board.columns(projectId) })
    queryClient.invalidateQueries({ queryKey: queryKeys.board.phases(projectId) })
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

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

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
      await moveCard({
        card_id: draggableId,
        source_column_id: source.droppableId,
        dest_column_id: destination.droppableId,
        source_index: source.index,
        dest_index: destination.index,
      })
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
          <button
            onClick={() => setShowRecurringPanel(true)}
            className="px-3 py-1.5 rounded-md text-sm font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[36px] whitespace-nowrap flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            <span className="max-sm:hidden">定期任務</span>
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
                    phases={phases}
                    onCardClick={setSelectedCard}
                    onAddCard={addCard}
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

      <RecurringTasksPanel
        projectId={projectId}
        columns={columns}
        isOpen={showRecurringPanel}
        onClose={() => setShowRecurringPanel(false)}
        onRefreshBoard={invalidateBoard}
      />
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
