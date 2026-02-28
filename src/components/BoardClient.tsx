'use client'

import { useState, useEffect } from 'react'

interface CardData {
  id: string
  title: string
  description: string | null
  due_date: string | null
  assignees?: { id: string; name: string }[]
}

interface ColumnData {
  id: string
  name: string
  cards?: CardData[]
}

function CardModal({ card, onClose, onUpdate }: { card: CardData, onClose: () => void, onUpdate: () => void }) {
  const [title, setTitle] = useState(card.title)
  const [description, setDescription] = useState(card.description || '')
  const [assignee, setAssignee] = useState(card.assignees?.[0]?.name || '')
  const [dueDate, setDueDate] = useState(card.due_date ? card.due_date.split('T')[0] : '')


  useEffect(() => {
    console.log('CardModal rendered for card:', card.id, card.title)
  }, [card])

  const handleSave = async () => {
    await fetch('/api/cards/' + card.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, assignee, due_date: dueDate })
    })
    onUpdate()
    onClose()
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

        </div>

        <div className="p-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded">取消</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded">儲存</button>
        </div>
      </div>
    </div>
  )
}

function Card({ card, onClick }: { card: CardData, onClick: () => void }) {
  console.log('Card rendered:', card.id, card.title, 'onClick type:', typeof onClick)
  return (
    <div onClick={onClick} className="bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md border-l-4 border-blue-500">
      <p className="font-medium">{card.title}</p>
      <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
        {card.due_date && <span>📅 {new Date(card.due_date).toLocaleDateString('zh-TW')}</span>}
        {card.assignees?.[0]?.name && <span>👤 {card.assignees[0].name}</span>}
      </div>
    </div>
  )
}

function Column({ column, onCardClick, onAddCard }: {
  column: ColumnData,
  onCardClick: (card: CardData) => void,
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
    <div className="w-72 flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-700">
          {column.name}
          <span className="ml-2 text-sm text-slate-400">{column.cards?.length || 0}</span>
        </h2>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto">
        {column.cards?.map((card: CardData) => (
          <Card key={card.id} card={card} onClick={() => {
            console.log('Card clicked:', card.id, card.title)
            onCardClick(card)
          }} />
        ))}
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
  )
}

export default function BoardClient({
  columns,
  onRefresh,
  onAddCard,
  onAddColumn
}: {
  columns: ColumnData[],
  projectId: string,
  onRefresh: () => void,
  onAddCard: (columnId: string, title: string) => void,
  onAddColumn: (name: string) => void
}) {
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null)
  const [newColumnName, setNewColumnName] = useState('')

  console.log('BoardClient rendered, columns:', columns?.length, 'selectedCard:', selectedCard?.id)

  return (
    <>
      <div className="flex-1 overflow-x-auto p-6 bg-slate-50">
        <div className="flex gap-4 h-full">
          {columns.map((column: ColumnData) => (
            <Column
              key={column.id}
              column={column}
              onCardClick={(card) => {
                console.log('Setting selected card:', card.id, card.title)
                setSelectedCard(card)
              }}
              onAddCard={onAddCard}
            />
          ))}

          <div className="w-72 flex-shrink-0">
            {newColumnName ? (
              <form onSubmit={(e) => { e.preventDefault(); onAddColumn(newColumnName); setNewColumnName(''); }} className="flex gap-2">
                <input
                  value={newColumnName}
                  onChange={e => setNewColumnName(e.target.value)}
                  placeholder="欄位名稱..."
                  className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  autoFocus
                />
                <button type="submit" className="px-4 py-2 bg-slate-100 rounded">+</button>
                <button type="button" onClick={() => setNewColumnName('')} className="px-4 py-2 border rounded">✕</button>
              </form>
            ) : (
              <button onClick={() => setNewColumnName('新欄位')} className="w-full px-3 py-2 text-sm text-left text-slate-500 hover:bg-slate-100 rounded">
                + 新增欄位
              </button>
            )}
          </div>
        </div>
      </div>

      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={() => {
            console.log('Closing modal')
            setSelectedCard(null)
          }}
          onUpdate={onRefresh}
        />
      )}
    </>
  )
}
