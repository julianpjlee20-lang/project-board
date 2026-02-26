'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'

// Types
interface Card {
  id: string
  title: string
  description: string | null
  due_date: string | null
  assignees: { id: string; name: string }[]
  comments: { id: string; content: string; author_name: string }[]
}

interface Column {
  id: string
  name: string
  cards: Card[]
}

interface Project {
  id: string
  name: string
}

// Draggable Card Component
function CardItem({ card, index, onClick }: { card: Card, index: number, onClick: () => void }) {
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
          className={`bg-white p-3 rounded-lg shadow-sm hover:shadow-md border-l-4 border-blue-500 mb-2 ${
            snapshot.isDragging ? 'shadow-lg rotate-2' : ''
          }`}
          style={{
            ...provided.draggableProps.style,
            opacity: snapshot.isDragging ? 0.9 : 1,
          }}
        >
          <p className="font-medium">{card.title}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
            {card.due_date && <span>📅 {new Date(card.due_date).toLocaleDateString('zh-TW')}</span>}
            {card.assignees?.[0]?.name && <span>👤 {card.assignees[0].name}</span>}
          </div>
        </div>
      )}
    </Draggable>
  )
}

function CardModal({ card, onClose, onUpdate }: { card: Card, onClose: () => void, onUpdate: () => void }) {
  // Original data for comparison
  const [originalData, setOriginalData] = useState({
    title: card.title,
    description: card.description || '',
    assignee: card.assignees?.[0]?.name || '',
    dueDate: card.due_date ? card.due_date.split('T')[0] : ''
  })
  
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description || '')
  const [assignee, setAssignee] = useState(card.assignees?.[0]?.name || '')
  const [dueDate, setDueDate] = useState(card.due_date ? card.due_date.split('T')[0] : '')
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(card.comments || [])
  const [activity, setActivity] = useState<any[]>([])
  
  // Dirty state
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Check if dirty
  useEffect(() => {
    const dirty = 
      title !== originalData.title ||
      description !== originalData.description ||
      assignee !== originalData.assignee ||
      dueDate !== originalData.dueDate
    setIsDirty(dirty)
  }, [title, description, assignee, dueDate, originalData])

  // Debounced auto-save
  useEffect(() => {
    if (!isDirty) return
    
    const timer = setTimeout(async () => {
      await saveCard()
    }, 2000) // Auto-save after 2 seconds of inactivity
    
    return () => clearTimeout(timer)
  }, [title, description, assignee, dueDate])

  // Fetch activity on mount
  useEffect(() => {
    fetch('/api/cards/' + card.id + '/activity')
      .then(res => res.json())
      .then(data => setActivity(data))
      .catch(console.error)
  }, [card.id])

  const saveCard = async () => {
    if (isSaving) return
    
    setIsSaving(true)
    try {
      const res = await fetch('/api/cards/' + card.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, assignee, due_date: dueDate })
      })
      
      if (res.ok) {
        setOriginalData({ title, description, assignee, dueDate })
        setIsDirty(false)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
        onUpdate()
      }
    } catch (e) {
      console.error(e)
    }
    setIsSaving(false)
  }

  const handleCancel = () => {
    setTitle(originalData.title)
    setDescription(originalData.description)
    setAssignee(originalData.assignee)
    setDueDate(originalData.dueDate)
    setIsDirty(false)
  }

  const handleAddComment = async () => {
    if (!comment.trim()) return
    await fetch('/api/cards/' + card.id + '/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: comment, author_name: 'User' })
    })
    setComment('')
    onUpdate()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">卡片詳情</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>
        
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

          <div>
            <label className="block text-sm font-medium mb-1">評論</label>
            <div className="space-y-2 mb-2 max-h-40 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="bg-gray-50 p-2 rounded text-sm">
                  <span className="font-medium">{c.author_name || 'Anonymous'}:</span> {c.content}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder="輸入評論..." className="flex-1 border rounded px-3 py-2" />
              <button onClick={handleAddComment} className="bg-blue-500 text-white px-4 py-2 rounded">送出</button>
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

        <div className="p-4 border-t flex justify-between items-center">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-sm text-blue-500 flex items-center gap-1">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                儲存中...
              </span>
            )}
            {saveSuccess && !isSaving && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                已儲存
              </span>
            )}
            {isDirty && !isSaving && !saveSuccess && (
              <span className="text-sm text-orange-500">未儲存</span>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-2">
            {isDirty && (
              <button onClick={handleCancel} className="px-4 py-2 border rounded hover:bg-gray-50">
                取消
              </button>
            )}
            <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">
              關閉
            </button>
            {isDirty && (
              <button onClick={saveCard} disabled={isSaving} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
                儲存
              </button>
            )}
          </div>
        </div>
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

  useEffect(() => {
    fetchBoard()
  }, [projectId])

  async function fetchBoard() {
    setLoading(true)
    try {
      const projectRes = await fetch(`/api/projects/${projectId}`)
      const projectData = await projectRes.json()
      setProject(projectData)
      
      const columnsRes = await fetch(`/api/projects/${projectId}/columns`)
      const columnsData = await columnsRes.json()
      setColumns(columnsData)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function addCard(columnId: string, title: string) {
    await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_id: columnId, title })
    })
    fetchBoard()
  }

  async function addColumn(name: string) {
    await fetch('/api/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, name })
    })
    fetchBoard()
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
          <a href="/projects" className="px-4 py-2 border rounded hover:bg-slate-50">返回專案</a>
        </header>

        <div className="flex-1 overflow-x-auto p-6 bg-slate-50">
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
