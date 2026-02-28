'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { ListView, CalendarView, ProgressView } from './views'
import type { Card, Column, Project, ViewType } from './types'

// Draggable Card Component
function CardItem({ card, index, onClick, color = '#3B82F6' }: { card: Card, index: number, onClick: () => void, color?: string }) {
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
          className={`bg-white p-3 rounded-lg shadow-sm hover:shadow-md border-l-4 mb-2 ${
            snapshot.isDragging ? 'shadow-lg rotate-2' : ''
          }`}
          style={{
            ...provided.draggableProps.style,
            opacity: snapshot.isDragging ? 0.9 : 1,
            borderLeftColor: color,
          }}
        >
          {/* Tags */}
          {card.tags && card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {card.tags.slice(0, 3).map(tag => (
                <span 
                  key={tag.id} 
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: tag.color + '30', color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          
          <p className="font-medium">{card.title}</p>
          
          {/* Progress bar */}
          {(card.progress || 0) > 0 && (
            <div className="mt-2">
              <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full"
                  style={{ 
                    width: `${card.progress}%`,
                    backgroundColor: card.progress === 100 ? '#10B981' : '#3B82F6'
                  }} 
                />
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            {card.due_date && <span>📅 {new Date(card.due_date).toLocaleDateString('zh-TW')}</span>}
            {card.assignees?.[0]?.name && <span>👤 {card.assignees[0].name}</span>}
            {card.subtasks && card.subtasks.length > 0 && (
              <span>☑️ {card.subtasks.filter(s => s.is_completed).length}/{card.subtasks.length}</span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  )
}

function CardModal({ card, onClose, onUpdate }: { card: Card, onClose: () => void, onUpdate: () => void }) {
  const [isFormReady, setIsFormReady] = useState(false)
  const [originalData, setOriginalData] = useState({
    title: '',
    description: '',
    assignee: '',
    dueDate: ''
  })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignee, setAssignee] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [activity, setActivity] = useState<any[]>([])

  // Dirty state
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Check if dirty
  useEffect(() => {
    const dirty =
      title !== originalData.title ||
      description !== originalData.description ||
      assignee !== originalData.assignee ||
      dueDate !== originalData.dueDate
    setIsDirty(dirty)
  }, [title, description, assignee, dueDate, originalData])

  // Fetch card data and activity on mount - populate form only after fetch completes
  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetch('/api/cards/' + card.id).then(res => {
        if (!res.ok) throw new Error('無法載入卡片資料')
        return res.json()
      }),
      fetch('/api/cards/' + card.id + '/activity').then(res => {
        if (!res.ok) throw new Error('無法載入活動紀錄')
        return res.json()
      }).catch(() => [])
    ]).then(([cardData, activityData]) => {
      if (cancelled) return
      const formData = {
        title: cardData.title,
        description: cardData.description || '',
        assignee: cardData.assignees?.[0]?.name || '',
        dueDate: cardData.due_date ? cardData.due_date.split('T')[0] : ''
      }
      setTitle(formData.title)
      setDescription(formData.description)
      setAssignee(formData.assignee)
      setDueDate(formData.dueDate)
      setOriginalData(formData)
      setActivity(activityData)
      setIsFormReady(true)
    }).catch(err => {
      console.error('載入卡片錯誤:', err)
      if (!cancelled) {
        alert('無法載入卡片資料，請重新整理頁面')
        onClose()
      }
    })

    return () => { cancelled = true }
  }, [card.id])

  // Unified save - save and close modal
  const saveCard = async () => {
    if (isSaving) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/cards/' + card.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          assignee,
          due_date: dueDate
        })
      })

      const data = await res.json()

      if (res.ok) {
        // Close modal first, then refresh board data in background
        onClose()
        onUpdate()
      } else {
        alert('儲存失敗: ' + (data.error || '未知錯誤'))
        setIsSaving(false)
      }
    } catch (e) {
      console.error('Save error:', e)
      alert('儲存失敗')
      setIsSaving(false)
    }
  }

  // Cancel - restore and close
  const handleCancel = () => {
    setTitle(originalData.title)
    setDescription(originalData.description)
    setAssignee(originalData.assignee)
    setDueDate(originalData.dueDate)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">卡片詳情</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {!isFormReady ? (
          <div className="p-8 text-center text-slate-400">載入中...</div>
        ) : (
          <>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">標題</label>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border rounded px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">描述</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border rounded px-3 py-2" placeholder="輸入描述..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">指派</label>
                  <input value={assignee} onChange={e => setAssignee(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="名字" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">截止日</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border rounded px-3 py-2" />
                </div>
              </div>

              {/* Activity Log */}
              <div>
                <label className="block text-sm font-medium mb-1">活動紀錄</label>
                <div className="space-y-2 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded">
                  {activity.length === 0 ? (
                    <p className="text-sm text-slate-400">尚無活動紀錄</p>
                  ) : (
                    activity.map((log) => (
                      <div key={log.id} className="text-xs text-slate-600 border-l-2 border-blue-300 pl-2 py-1">
                        <span className="font-medium text-blue-600">[{log.action}]</span>
                        <span className="text-slate-700"> {log.target}</span>
                        {log.old_value && log.new_value && log.old_value !== log.new_value ? (
                          <span className="text-orange-600"> {log.old_value} → {log.new_value}</span>
                        ) : (
                          <span className="text-green-600"> {log.new_value}</span>
                        )}
                        <span className="text-slate-400 block mt-0.5">
                          {new Date(log.created_at).toLocaleString('zh-TW')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={handleCancel} className="px-4 py-2 border rounded hover:bg-gray-50">
                取消
              </button>
              <button onClick={saveCard} disabled={isSaving} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
                {isSaving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ColumnDroppable({ column, onCardClick, onAddCard }: { 
  column: Column, 
  onCardClick: (card: Card) => void,
  onAddCard: (columnId: string, title: string) => void,
}) {
  const [newCardTitle, setNewCardTitle] = useState('')
  const [showAddCard, setShowAddCard] = useState(false)

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault()
    if (newCardTitle.trim()) {
      onAddCard(column.id, newCardTitle.trim())
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
          className="w-72 flex-shrink-0 flex flex-col"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700">
              {column.name}
              <span className="ml-2 text-sm text-slate-400">{column.cards?.length || 0}</span>
            </h2>
          </div>

          <div 
            className={`flex-1 space-y-2 overflow-y-auto min-h-[100px] rounded ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}
          >
            {column.cards?.map((card, index) => (
              <CardItem 
                key={card.id} 
                card={card} 
                index={index}
                onClick={() => onCardClick(card)}
                color={column.color}
              />
            ))}
            {provided.placeholder}
          </div>

          {showAddCard ? (
            <form onSubmit={handleAddCard} className="mt-2">
              <input
                value={newCardTitle}
                onChange={e => setNewCardTitle(e.target.value)}
                placeholder="卡片標題..."
                className="w-full px-3 py-2 text-sm border rounded mb-2"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 px-3 py-2 text-sm bg-blue-500 text-white rounded">新增</button>
                <button type="button" onClick={() => setShowAddCard(false)} className="flex-1 px-3 py-2 text-sm border rounded">取消</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowAddCard(true)} className="w-full mt-2 px-3 py-2 text-sm text-left text-slate-500 hover:bg-slate-100 rounded">
              + 新增卡片
            </button>
          )}
        </div>
      )}
    </Droppable>
  )
}

export default function BoardPage() {
  const params = useParams()
  const projectId = params.id as string
  
  const [project, setProject] = useState<Project | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [newColumnName, setNewColumnName] = useState('')
  const [currentView, setCurrentView] = useState<ViewType>('board')

  const viewTabs = [
    { id: 'board' as ViewType, label: 'Board', icon: '📋' },
    { id: 'list' as ViewType, label: 'List', icon: '📝' },
    { id: 'calendar' as ViewType, label: 'Calendar', icon: '📅' },
    { id: 'progress' as ViewType, label: 'Progress', icon: '📊' },
  ]

  useEffect(() => {
    fetchBoard()
  }, [projectId])

  async function fetchBoard() {
    setLoading(true)
    try {
      const projectRes = await fetch(`/api/projects/${projectId}`)
      if (!projectRes.ok) {
        throw new Error('無法載入專案資料')
      }
      const projectData = await projectRes.json()
      setProject(projectData)

      const columnsRes = await fetch(`/api/projects/${projectId}/columns`)
      if (!columnsRes.ok) {
        throw new Error('無法載入欄位資料')
      }
      const columnsData = await columnsRes.json()
      setColumns(columnsData)
    } catch (e) {
      console.error('載入看板錯誤:', e)
      alert(e instanceof Error ? e.message : '載入看板失敗，請重新整理頁面')
    } finally {
      setLoading(false)
    }
  }

  async function addCard(columnId: string, title: string) {
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: columnId, title })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '新增卡片失敗')
      }

      await fetchBoard()
    } catch (error) {
      console.error('新增卡片錯誤:', error)
      alert(error instanceof Error ? error.message : '新增卡片失敗，請重試')
    }
  }

  async function addColumn(name: string) {
    try {
      const res = await fetch('/api/columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, name })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || '新增欄位失敗')
      }

      await fetchBoard()
    } catch (error) {
      console.error('新增欄位錯誤:', error)
      alert(error instanceof Error ? error.message : '新增欄位失敗，請重試')
    }
  }

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

    // Update local state immediately
    setColumns(newColumns)

    // Save to server
    try {
      await fetch('/api/cards/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: draggableId,
          source_column_id: source.droppableId,
          dest_column_id: destination.droppableId,
          source_index: source.index,
          dest_index: destination.index,
        })
      })
    } catch (e) {
      console.error('Failed to save:', e)
      fetchBoard() // Refresh on error
    }
  }

  if (loading) {
    return <div className="p-8">載入中...</div>
  }

  if (!project) {
    return <div className="p-8">專案不存在</div>
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col">
        <header className="border-b px-6 py-4 flex items-center justify-between bg-white">
          <h1 className="text-xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 rounded-lg p-1">
              {viewTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentView(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    currentView === tab.id 
                      ? 'bg-white shadow text-slate-900' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
            <a href="/projects" className="px-4 py-2 border rounded hover:bg-slate-50">返回專案</a>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {currentView === 'board' && (
            <div className="flex gap-4 h-full">
              {columns.map((column) => (
                <ColumnDroppable
                  key={column.id}
                  column={column}
                  onCardClick={setSelectedCard}
                  onAddCard={addCard}
                />
              ))}
              <AddColumnForm onAdd={addColumn} />
            </div>
          )}

          {currentView === 'list' && <ListView columns={columns} onCardClick={setSelectedCard} />}
          {currentView === 'calendar' && <CalendarView columns={columns} onCardClick={setSelectedCard} />}
          {currentView === 'progress' && <ProgressView columns={columns} />}
        </div>

        {selectedCard && (
          <CardModal 
            card={selectedCard} 
            onClose={() => setSelectedCard(null)} 
            onUpdate={fetchBoard}
          />
        )}
      </div>
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
    <div className="w-72 flex-shrink-0">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="新欄位名稱..." className="flex h-10 w-full rounded-md border px-3 py-2 text-sm" />
        <button type="submit" className="px-4 py-2 bg-slate-100 rounded">+</button>
      </form>
    </div>
  )
}
