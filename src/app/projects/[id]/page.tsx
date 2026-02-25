'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'

type Column = {
  id: string
  name: string
  position: number
  cards?: Card[]
}

type Card = {
  id: string
  title: string
  description: string | null
  due_date: string | null
  position: number
  assignees?: { user_id: string; profiles?: { name: string; avatar_url: string | null } }[]
}

export default function BoardPage() {
  const params = useParams()
  const projectId = params.id as string
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(true)
  const [newColumnName, setNewColumnName] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchBoard()
  }, [projectId])

  async function fetchBoard() {
    // Fetch columns
    const { data: columnsData } = await supabase
      .from('columns')
      .select('*')
      .eq('project_id', projectId)
      .order('position')

    if (!columnsData) {
      setLoading(false)
      return
    }

    // Fetch cards for each column
    const columnsWithCards = await Promise.all(
      columnsData.map(async (col) => {
        const { data: cards } = await supabase
          .from('cards')
          .select(`
            *,
            card_assignees!inner(
              user_id,
              profiles!inner(name, avatar_url)
            )
          `)
          .eq('column_id', col.id)
          .order('position')

        return {
          ...col,
          cards: cards?.map((c: any) => ({
            ...c,
            assignees: c.card_assignees
          })) || []
        }
      })
    )

    setColumns(columnsWithCards)
    setLoading(false)
  }

  async function addColumn() {
    if (!newColumnName.trim()) return

    const position = columns.length
    const { data } = await supabase
      .from('columns')
      .insert({ project_id: projectId, name: newColumnName.trim(), position })
      .select()
      .single()

    if (data) {
      setColumns([...columns, { ...data, cards: [] }])
      setNewColumnName('')
    }
  }

  async function addCard(columnId: string) {
    const title = prompt('輸入卡片標題：')
    if (!title?.trim()) return

    const columnCards = columns.find(c => c.id === columnId)?.cards || []
    const position = columnCards.length

    const { data } = await supabase
      .from('cards')
      .insert({ 
        column_id: columnId, 
        title: title.trim(), 
        position 
      })
      .select()
      .single()

    if (data) {
      fetchBoard()
    }
  }

  if (loading) {
    return <div className="p-8 text-center">載入中...</div>
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between bg-white">
        <h1 className="text-xl font-bold">看板</h1>
        <Link href="/projects">
          <Button variant="outline">返回專案</Button>
        </Link>
      </header>

      <div className="flex-1 overflow-x-auto p-6 bg-slate-50">
        <div className="flex gap-4 h-full">
          {columns.map((column) => (
            <div key={column.id} className="w-72 flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-700">
                  {column.name}
                  <span className="ml-2 text-sm text-slate-400">
                    {column.cards?.length || 0}
                  </span>
                </h2>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto">
                {column.cards?.map((card) => (
                  <Card key={card.id} className="cursor-pointer hover:shadow-md">
                    <CardContent className="p-3">
                      <p className="font-medium">{card.title}</p>
                      {card.due_date && (
                        <p className="text-xs text-slate-500 mt-1">
                          📅 {new Date(card.due_date).toLocaleDateString('zh-TW')}
                        </p>
                      )}
                      {card.assignees && card.assignees.length > 0 && (
                        <div className="flex -space-x-2 mt-2">
                          {card.assignees.map((a: any) => (
                            <div
                              key={a.user_id}
                              className="w-6 h-6 rounded-full bg-slate-200 border-2 border-white"
                              title={a.profiles?.name}
                            >
                              {a.profiles?.name?.[0]}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button
                variant="ghost"
                className="w-full justify-start mt-2"
                onClick={() => addCard(column.id)}
              >
                <Plus className="w-4 h-4 mr-2" />
                新增卡片
              </Button>
            </div>
          ))}

          <div className="w-72 flex-shrink-0">
            <div className="flex gap-2">
              <Input
                placeholder="新欄位名稱..."
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addColumn()}
              />
              <Button onClick={addColumn}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
