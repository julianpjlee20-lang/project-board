import { query } from "@/lib/db"
import { redirect } from "next/navigation"

export const dynamic = 'force-dynamic'

async function getProjects() {
  try {
    return await query("SELECT * FROM projects ORDER BY created_at DESC")
  } catch (e) {
    console.error(e)
    return []
  }
}

async function createProject(formData: FormData) {
  'use server'
  const name = formData.get("name") as string
  if (!name) return
  
  await query(
    "INSERT INTO projects (name) VALUES ($1) RETURNING *",
    [name]
  )
  
  // Create default columns
  const project = await query("SELECT id FROM projects ORDER BY created_at DESC LIMIT 1")
  if (project[0]) {
    await query(
      "INSERT INTO columns (project_id, name, position) VALUES ($1, 'To Do', 0), ($1, 'In Progress', 1), ($1, 'Done', 2)",
      [project[0].id]
    )
  }
  
  redirect("/projects")
}

export default async function ProjectsPage() {
  const projects = await getProjects()

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">專案列表</h1>

      <form action={createProject} className="flex gap-2 mb-8">
        <input
          name="name"
          placeholder="新專案名稱..."
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 max-w-md"
          required
        />
        <button
          type="submit"
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
        >
          建立
        </button>
      </form>

      {projects.length === 0 ? (
        <p className="text-slate-500">尚無專案，建立一個開始吧！</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project: any) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  {project.description && (
                    <CardDescription>{project.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500">
                    建立於 {new Date(project.created_at).toLocaleDateString('zh-TW')}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
