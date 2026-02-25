import { query } from "@/lib/db"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

async function getBoard(projectId: string) {
  try {
    const columns = await query(
      "SELECT * FROM columns WHERE project_id = $1 ORDER BY position",
      [projectId]
    )
    
    for (const col of columns) {
      const cards = await query(
        "SELECT * FROM cards WHERE column_id = $1 ORDER BY position",
        [col.id]
      )
      col.cards = cards
    }
    
    return columns
  } catch (e) {
    console.error(e)
    return []
  }
}

async function getProject(projectId: string) {
  try {
    const result = await query("SELECT * FROM projects WHERE id = $1", [projectId])
    return result[0]
  } catch (e) {
    return null
  }
}

async function createColumn(projectId: string, formData: FormData) {
  'use server'
  const name = formData.get("name") as string
  if (!name) return
  
  const columns = await query(
    "SELECT COALESCE(MAX(position), -1) + 1 as pos FROM columns WHERE project_id = $1",
    [projectId]
  )
  const position = columns[0]?.pos || 0
  
  await query(
    "INSERT INTO columns (project_id, name, position) VALUES ($1, $2, $3)",
    [projectId, name, position]
  )
  
  redirect(`/projects/${projectId}`)
}

async function createCard(columnId: string, projectId: string, formData: FormData) {
  'use server'
  const title = formData.get("title") as string
  if (!title) return
  
  const cards = await query(
    "SELECT COALESCE(MAX(position), -1) + 1 as pos FROM cards WHERE column_id = $1",
    [columnId]
  )
  const position = cards[0]?.pos || 0
  
  await query(
    "INSERT INTO cards (column_id, title, position) VALUES ($1, $2, $3)",
    [columnId, title, position]
  )
  
  redirect(`/projects/${projectId}`)
}

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const project = await getProject(projectId)
  const columns = await getBoard(projectId)

  if (!project) {
    return <div className="p-8">專案不存在</div>
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between bg-white">
        <h1 className="text-xl font-bold">{project.name}</h1>
        <a href="/projects" className="px-4 py-2 border rounded hover:bg-slate-50">
          返回專案
        </a>
      </header>

      <div className="flex-1 overflow-x-auto p-6 bg-slate-50">
        <div className="flex gap-4 h-full">
          {columns.map((column: any) => (
            <div key={column.id} className="w-72 flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-slate-700">
                  {column.name}
                  <span className="ml-2 text-sm text-slate-400">
                    {column.cards?.length || 0}
                  </span>
                </h2>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto">
                {column.cards?.map((card: any) => (
                  <div key={card.id} className="bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md">
                    <p className="font-medium">{card.title}</p>
                    {card.due_date && (
                      <p className="text-xs text-slate-500 mt-1">
                        📅 {new Date(card.due_date).toLocaleDateString('zh-TW')}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <form action={createCard.bind(null, column.id, projectId)} className="mt-2">
                <input
                  name="title"
                  placeholder="新卡片標題..."
                  className="w-full px-3 py-2 text-sm border rounded mb-2"
                  required
                />
                <button
                  type="submit"
                  className="w-full px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded"
                >
                  + 新增卡片
                </button>
              </form>
            </div>
          ))}

          <div className="w-72 flex-shrink-0">
            <form action={createColumn.bind(null, projectId)} className="flex gap-2">
              <input
                name="name"
                placeholder="新欄位名稱..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded"
              >
                +
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
