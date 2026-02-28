'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [initError, setInitError] = useState('')

  async function fetchProjects() {
    setLoading(true)
    try {
      const res = await fetch('/api/projects')
      const data = await res.json()
      if (data.error && data.detail?.includes('does not exist')) {
        setInitError(data.detail)
      } else {
        setProjects(data)
        setInitError('')
      }
    } catch (_e) {
      // ignore
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchProjects()
  }, [])

  async function initDatabase() {
    if (!confirm('確定要初始化資料庫嗎？這會建立所有必要的表格。')) return
    
    setCreating(true)
    try {
      const res = await fetch('/api/projects', { method: 'PUT' })
      const data = await res.json()
      
      if (data.success) {
        alert('資料庫初始化成功！')
        fetchProjects()
      } else {
        alert('初始化失敗：' + data.detail)
      }
    } catch {
      alert('初始化失敗')
    }
    setCreating(false)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!projectName.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName })
      })

      if (res.ok) {
        setProjectName('')
        fetchProjects()
      } else {
        alert('建立失敗')
      }
    } catch (e) {
      console.error(e)
      alert('建立失敗')
    }
    setCreating(false)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F9F8F5' }}>
      {/* Header */}
      <header 
        className="border-b"
        style={{ 
          backgroundColor: '#0B1A14',
          borderColor: '#316745'
        }}
      >
        <div className="container mx-auto px-6 py-8">
          <h1 
            className="text-3xl font-bold"
            style={{ 
              color: '#F9F8F5',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '-0.03em'
            }}
          >
            專案列表
          </h1>
          <p 
            className="mt-2"
            style={{ color: '#F9F8F5', opacity: 0.7 }}
          >
            建立和管理你的團隊專案
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Create Form - Only show if database is initialized */}
        {!initError && (
          <form onSubmit={handleCreate} className="flex gap-3 mb-12">
            <input
              name="name"
              placeholder="輸入新專案名稱..."
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="flex h-12 w-full max-w-md rounded-lg border px-4 text-sm transition-all focus:outline-none focus:ring-2"
              style={{ 
                backgroundColor: '#FFFFFF',
                borderColor: '#316745',
                color: '#0B1A14'
              }}
              required
              disabled={creating}
            />
            <button
              type="submit"
              className="h-12 px-6 rounded-lg font-medium transition-all hover:opacity-90"
              style={{ 
                backgroundColor: '#F8B500',
                color: '#0B1A14'
              }}
              disabled={creating}
            >
              {creating ? '建立中...' : '建立'}
            </button>
          </form>
        )}

        {/* Database Init Error */}
        {initError && (
          <div className="mb-8 p-6 rounded-lg border" style={{ backgroundColor: '#FFF5F5', borderColor: '#DC2626' }}>
            <h3 className="font-semibold mb-2" style={{ color: '#DC2626' }}>
              資料庫需要初始化
            </h3>
            <p className="text-sm mb-4" style={{ color: '#0B1A14', opacity: 0.7 }}>
              尚未建立資料表，請點擊下方按鈕初始化資料庫。
            </p>
            <button
              onClick={initDatabase}
              className="h-12 px-6 rounded-lg font-medium transition-all hover:opacity-90"
              style={{ 
                backgroundColor: '#DC2626',
                color: '#FFFFFF'
              }}
              disabled={creating}
            >
              {creating ? '初始化中...' : '初始化資料庫'}
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-pulse text-lg" style={{ color: '#316745' }}>
              載入中...
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: '#31674520' }}
            >
              <svg 
                className="w-12 h-12" 
                fill="none" 
                stroke="#316745" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 
              className="text-xl font-semibold mb-2"
              style={{ color: '#0B1A14' }}
            >
              尚無專案
            </h3>
            <p 
              className="text-center max-w-md"
              style={{ color: '#0B1A14', opacity: 0.6 }}
            >
              建立第一個專案，開始追蹤你的任務進度
            </p>
          </div>
        )}

        {/* Project Grid */}
        {!loading && projects.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card 
                  className="h-full transition-all hover:shadow-lg cursor-pointer border-l-4"
                  style={{ 
                    borderLeftColor: '#F8B500',
                    backgroundColor: '#FFFFFF'
                  }}
                >
                  <CardHeader>
                    <CardTitle 
                      className="text-lg"
                      style={{ color: '#0B1A14' }}
                    >
                      {project.name}
                    </CardTitle>
                    {project.description && (
                      <CardDescription>
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p 
                      className="text-sm"
                      style={{ color: '#316745' }}
                    >
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
