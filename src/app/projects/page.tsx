'use client'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

type Project = {
  id: string
  name: string
  description: string | null
  created_at: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [newProjectName, setNewProjectName] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setProjects(data)
    setLoading(false)
  }

  async function createProject() {
    if (!newProjectName.trim()) return

    const { data, error } = await supabase
      .from('projects')
      .insert({ name: newProjectName.trim() })
      .select()
      .single()

    if (data) {
      setProjects([data, ...projects])
      setNewProjectName('')
      
      // Create default columns
      await supabase.from('columns').insert([
        { project_id: data.id, name: 'To Do', position: 0 },
        { project_id: data.id, name: 'In Progress', position: 1 },
        { project_id: data.id, name: 'Done', position: 2 },
      ])
    }
  }

  if (loading) {
    return <div className="p-8 text-center">載入中...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">專案列表</h1>

      <div className="flex gap-2 mb-8">
        <Input
          placeholder="新專案名稱..."
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createProject()}
          className="max-w-md"
        />
        <Button onClick={createProject}>
          <Plus className="w-4 h-4 mr-2" />
          建立
        </Button>
      </div>

      {projects.length === 0 ? (
        <p className="text-slate-500">尚無專案，建立一個開始吧！</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
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
