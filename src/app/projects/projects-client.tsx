'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import UserNav from '@/components/UserNav'
import { createProject } from '@/lib/api'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
}

export function ProjectsPageClient({ initialProjects }: { initialProjects: Project[] }) {
  const router = useRouter()
  const [projectName, setProjectName] = useState('')

  const createMutation = useMutation({
    mutationFn: (name: string) => createProject(name),
    onSuccess: () => {
      setProjectName('')
      router.refresh() // Refresh SSR data
    },
    onError: (e: Error) => {
      console.error(e)
      alert('建立失敗')
    },
  })

  const creating = createMutation.isPending

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!projectName.trim()) return
    createMutation.mutate(projectName)
  }

  return (
    <div id="main-content" className="min-h-screen bg-brand-bg">
      {/* Header */}
      <header className="border-b bg-brand-primary border-brand-green">
        <div className="container mx-auto px-6 max-sm:px-4 py-8 max-sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-3xl max-sm:text-2xl font-bold text-balance text-brand-bg font-[Inter,sans-serif] tracking-[-0.03em]">
                專案列表
              </h1>
              <p className="mt-2 max-sm:mt-1 text-sm max-sm:text-xs text-brand-bg/70">
                建立和管理你的團隊專案
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/calendar"
                className="flex items-center gap-2 px-4 max-sm:px-3 py-2 rounded-lg font-medium text-sm transition-opacity hover:opacity-90 min-h-[44px] bg-brand-green text-brand-bg"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="max-sm:hidden">全域行事曆</span>
                <span className="sm:hidden">行事曆</span>
              </Link>
              <UserNav />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 max-sm:px-4 py-8 max-sm:py-5">
        {/* Create Form */}
        <form onSubmit={handleCreate} className="flex max-sm:flex-col gap-3 mb-12 max-sm:mb-8">
          <input
            name="name"
            placeholder="輸入新專案名稱…"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="flex h-12 w-full max-w-md max-sm:max-w-full rounded-lg border px-4 text-base transition-colors focus:outline-none focus-visible:ring-2 bg-surface-elevated border-brand-green text-brand-primary"
            required
            disabled={creating}
          />
          <button
            type="submit"
            className="h-12 px-6 rounded-lg font-medium transition-opacity hover:opacity-90 min-h-[48px] bg-brand-accent text-brand-primary"
            disabled={creating}
          >
            {creating ? '建立中...' : '建立'}
          </button>
        </form>

        {/* Empty State */}
        {initialProjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-24 h-24 rounded-full flex items-center justify-center mb-6 bg-brand-green/[0.125]">
              <svg
                className="w-12 h-12 text-brand-green"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2 text-brand-primary">
              尚無專案
            </h3>
            <p className="text-center max-w-md text-brand-primary/60">
              建立第一個專案，開始追蹤你的任務進度
            </p>
          </div>
        )}

        {/* Project Grid */}
        {initialProjects.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {initialProjects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full transition-shadow hover:shadow-lg cursor-pointer border-l-4 border-l-brand-accent bg-surface-elevated">
                  <CardHeader>
                    <CardTitle className="text-lg text-brand-primary">
                      {project.name}
                    </CardTitle>
                    {project.description && (
                      <CardDescription className="line-clamp-3">
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-brand-green">
                      建立於 {new Date(project.created_at).toLocaleDateString('zh-TW')}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
