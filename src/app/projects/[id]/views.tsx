'use client'

import type { Card, Column, Phase } from './types'

const PRIORITY_CONFIG = {
  high:   { color: 'bg-red-500',    label: '高' },
  medium: { color: 'bg-yellow-400', label: '中' },
  low:    { color: 'bg-green-500',  label: '低' },
} as const

// List View Component
export function ListView({ columns, phases, onCardClick }: { columns: Column[], phases?: Phase[], onCardClick: (card: Card) => void }) {
  const allCards = columns.flatMap(col => 
    col.cards.map(card => ({ ...card, columnName: col.name, columnColor: col.color }))
  )

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">標題</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">階段</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">優先度</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">欄位</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">指派</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">截止日</th>
            <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">進度</th>
          </tr>
        </thead>
        <tbody>
          {allCards.map((card) => (
            <tr 
              key={card.id} 
              onClick={() => onCardClick(card)}
              className="border-b hover:bg-slate-50 cursor-pointer"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.columnColor }} />
                  <span className="font-medium">{card.title}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm">
                {(() => {
                  const phase = card.phase_id ? phases?.find(p => p.id === card.phase_id) : null
                  return phase ? (
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                      style={{ backgroundColor: phase.color }}
                    >
                      {phase.name}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )
                })()}
              </td>
              <td className="px-4 py-3 text-sm">
                {(() => {
                  const priority = card.priority || 'medium'
                  const config = PRIORITY_CONFIG[priority]
                  return (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${config.color}`} />
                      <span className="text-slate-600">{config.label}</span>
                    </span>
                  )
                })()}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">{card.columnName}</td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {card.assignees?.[0]?.name || '-'}
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {card.due_date ? new Date(card.due_date.split('T')[0] + 'T00:00:00').toLocaleDateString('zh-TW') : '-'}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full" 
                      style={{ 
                        width: `${card.progress || 0}%`,
                        backgroundColor: card.progress === 100 ? '#10B981' : '#3B82F6'
                      }} 
                    />
                  </div>
                  <span className="text-xs text-slate-500">{card.progress || 0}%</span>
                </div>
              </td>
            </tr>
          ))}
          {allCards.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                尚無任務
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// Calendar View Component
export function CalendarView({ columns, onCardClick }: { columns: Column[], onCardClick: (card: Card) => void }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDay = new Date(year, month, 1).getDay()
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const blanks = Array.from({ length: firstDay }, (_, i) => i)
  
  const cardsWithDue = columns.flatMap(col => 
    col.cards.filter(c => c.due_date).map(card => ({
      ...card,
      columnName: col.name,
      columnColor: col.color
    }))
  ).filter(card => {
    const due = new Date(card.due_date!.split('T')[0] + 'T00:00:00')
    return due.getFullYear() === year && due.getMonth() === month
  })

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4">
        {year}年 {month + 1}月
      </h3>
      <div className="grid grid-cols-7 gap-1">
        {['日', '一', '二', '三', '四', '五', '六'].map(day => (
          <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
            {day}
          </div>
        ))}
        {blanks.map(i => <div key={`blank-${i}`} className="h-24" />)}
        {days.map(day => {
          const dayCards = cardsWithDue.filter(c => new Date(c.due_date!.split('T')[0] + 'T00:00:00').getDate() === day)
          return (
            <div key={day} className="h-24 border rounded p-1">
              <div className="text-sm text-slate-500 mb-1">{day}</div>
              {dayCards.map(card => (
                <div 
                  key={card.id}
                  onClick={() => onCardClick(card)}
                  className="text-xs p-1 mb-1 rounded truncate cursor-pointer"
                  style={{ backgroundColor: card.columnColor + '30', color: card.columnColor }}
                >
                  {card.title}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Progress View Component
export function ProgressView({ columns }: { columns: Column[] }) {
  const totalCards = columns.reduce((sum, col) => sum + col.cards.length, 0)
  const completedCards = columns.find(c => c.name.toLowerCase().includes('done'))?.cards.length || 0
  const overallProgress = totalCards > 0 ? Math.round((completedCards / totalCards) * 100) : 0

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-6">專案進度</h3>
      
      <div className="mb-8">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-slate-600">整體進度</span>
          <span className="font-medium">{overallProgress}%</span>
        </div>
        <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className="h-full rounded-full transition-all"
            style={{ 
              width: `${overallProgress}%`,
              backgroundColor: overallProgress === 100 ? '#10B981' : '#3B82F6'
            }} 
          />
        </div>
      </div>

      <div className="space-y-4">
        {columns.map(col => {
          const colTotal = col.cards.length
          const colDone = col.name.toLowerCase().includes('done') ? colTotal : 
            col.cards.filter(c => (c.progress || 0) === 100).length
          const colProgress = colTotal > 0 ? Math.round((colDone / colTotal) * 100) : 0
          
          return (
            <div key={col.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} />
                  {col.name}
                </span>
                <span className="text-slate-500">{colTotal} 任務</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full"
                  style={{ width: `${colProgress}%`, backgroundColor: col.color }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">{totalCards}</div>
          <div className="text-sm text-slate-500">總任務</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{totalCards - completedCards}</div>
          <div className="text-sm text-slate-500">進行中</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{completedCards}</div>
          <div className="text-sm text-slate-500">已完成</div>
        </div>
      </div>
    </div>
  )
}
