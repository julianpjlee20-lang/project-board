'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

// Sortable Card Component
function SortableCard({ card, onClick }: { card: Card, onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: card.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-white p-3 rounded-lg shadow-sm cursor-grab hover:shadow-md border-l-4 border-blue-500"
    >
      <p className="font-medium">{card.title}</p>
      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
        {card.due_date && <span>📅 {new Date(card.due_date).toLocaleDateString('zh-TW')}</span>}
        {card.assignees?.[0]?.name && <span>👤 {card.assignees[0].name}</span>}
      </div>
    </div>
  )
}

function CardModal({ card, onClose, onUpdate }: { card: Card, onClose: () => void, onUpdate: () => void }) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description || '')
  const [assignee, setAssignee] = useState(card.assignees?.[0]?.name || '')
  const [dueDate, setDueDate] = useState(card.due_date ? card.due_date.split('T')[0] : '')
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState(card.comments || [])

  const handleSave = async () => {
    await fetch('/api/cards/' + card.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, assignee, due_date: dueDate })
    })
    onUpdate()
    onClose()
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
        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded">取消</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded">儲存</button>
        </div>
      </div>
    </div>
  )
}

function Column({ column, onCardClick, onAddCard, onReorderCards }: { 
  column: Column, 
  onCardClick: (card: Card) => void,
  onAddCard: (columnId: string, title: string) => void,
  onReorderCards: (columnId: string, cards: Card[]) => void
}) {
  const [newCardTitle, setNewCardTitle] = useState('')
  const [showAddCard, setShowAddCard] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault()
    if (newCardTitle.trim()) {
      onAddCard(column.id, newCardTitle.trim())
      setNewCardTitle('')
      setShowAddCard(false)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      const oldIndex = column.cards.findIndex(c => c.id === active.id)
      const newIndex = column.cards.findIndex(c => c.id === over.id)
      
      const newCards = arrayMove(column.cards, oldIndex, newIndex)
      onReorderCards(column.id, newCards)
    }
  }

  return (
    <div className="w-72 flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-700">
          {column.name}
          <span className="ml-2 text-sm text-slate-400">{column.cards?.length || 0}</span>
        </h2>
      </div>

      <SortableContext 
        items={column.cards.map(c => c.id)} 
        strategy={verticalListSortingStrategy}
      >
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 space-y-2 overflow-y-auto min-h-[100px]">
            {column.cards?.map((card) => (
              <SortableCard 
                key={card.id} 
                card={card} 
                onClick={() => onCardClick(card)} 
              />
            ))}
          </div>
        </DndContext>
      </SortableContext>

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

  async function reorderCards(columnId: string, cards: Card[]) {
    // Update local state immediately for smooth UX
    setColumns(prev => prev.map(col => 
      col.id === columnId ? { ...col, cards } : col
    ))
    
    // Save to server
    await fetch('/api/cards/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_id: columnId, cards: cards.map((c, i) => ({ id: c.id, position: i })) })
    })
  }

  if (loading) {
    return <div className="p-8">載入中...</div>
  }

  if (!project) {
    return <div className="p-8">專案不存在</div>
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between bg-white">
        <h1 className="text-xl font-bold">{project.name}</h1>
        <a href="/projects" className="px-4 py-2 border rounded hover:bg-slate-50">返回專案</a>
      </header>

      <div className="flex-1 overflow-x-auto p-6 bg-slate-50">
        <div className="flex gap-4 h-full">
          {columns.map((column) => (
            <Column 
              key={column.id} 
              column={column} 
              onCardClick={setSelectedCard}
              onAddCard={addCard}
              onReorderCards={reorderCards}
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
