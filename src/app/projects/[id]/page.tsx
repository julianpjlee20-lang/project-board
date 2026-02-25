import { query } from "@/lib/db"
import BoardClient from "@/components/BoardClient"
import { revalidatePath } from "next/cache"

export const dynamic = 'force-dynamic'

async function getBoard(projectId: string) {
  try {
    const columns = await query(
      "SELECT * FROM columns WHERE project_id = $1 ORDER BY position",
      [projectId]
    )
    
    for (const col of columns) {
      const cards = await query(`
        SELECT c.*, 
          COALESCE(json_agg(DISTINCT jsonb_build_object('id', ca.user_id, 'name', p.name)) FILTER (WHERE ca.user_id IS NOT NULL), '[]') as assignees,
          COALESCE(json_agg(DISTINCT jsonb_build_object('id', cmt.id, 'content', cmt.content, 'author_name', p2.name)) FILTER (WHERE cmt.id IS NOT NULL), '[]') as comments
        FROM cards c
        LEFT JOIN card_assignees ca ON c.id = ca.card_id
        LEFT JOIN profiles p ON ca.user_id = p.id
        LEFT JOIN comments cmt ON c.id = cmt.card_id
        LEFT JOIN profiles p2 ON cmt.author_id = p2.id
        WHERE c.column_id = $1
        GROUP BY c.id
        ORDER BY c.position
      `, [col.id])
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

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params
  const project = await getProject(projectId)
  const columns = await getBoard(projectId)

  if (!project) {
    return <div className="p-8">專案不存在</div>
  }

  async function addCard(columnId: string, title: string) {
    'use server'
    const cards = await query(
      "SELECT COALESCE(MAX(position), -1) + 1 as pos FROM cards WHERE column_id = $1",
      [columnId]
    )
    const position = cards[0]?.pos || 0
    await query(
      "INSERT INTO cards (column_id, title, position) VALUES ($1, $2, $3)",
      [columnId, title, position]
    )
    revalidatePath(`/projects/${projectId}`)
  }

  async function addColumn(name: string) {
    'use server'
    const columns = await query(
      "SELECT COALESCE(MAX(position), -1) + 1 as pos FROM columns WHERE project_id = $1",
      [projectId]
    )
    const position = columns[0]?.pos || 0
    await query(
      "INSERT INTO columns (project_id, name, position) VALUES ($1, $2, $3)",
      [projectId, name, position]
    )
    revalidatePath(`/projects/${projectId}`)
  }

  function handleRefresh() {
    revalidatePath(`/projects/${projectId}`)
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="border-b px-6 py-4 flex items-center justify-between bg-white">
        <h1 className="text-xl font-bold">{project.name}</h1>
        <a href="/projects" className="px-4 py-2 border rounded hover:bg-slate-50">
          返回專案
        </a>
      </header>

      <BoardClient 
        columns={columns} 
        projectId={projectId}
        onRefresh={handleRefresh}
        onAddCard={addCard}
        onAddColumn={addColumn}
      />
    </div>
  )
}
