'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import UserNav from '@/components/UserNav'
import { GlobalCalendarView, type CalendarCard, type CalendarProject } from './calendar-views'

export default function CalendarPage() {
  const [cards, setCards] = useState<CalendarCard[]>([])
  const [projects, setProjects] = useState<CalendarProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchCalendarData() {
      try {
        const res = await fetch('/api/calendar')
        if (!res.ok) throw new Error('載入失敗')
        const data = await res.json()
        setCards(data.cards || [])
        setProjects(data.projects || [])
      } catch (e) {
        setError(e instanceof Error ? e.message : '載入行事曆資料失敗')
      } finally {
        setLoading(false)
      }
    }
    fetchCalendarData()
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F9F8F5' }}>
      {/* Header */}
      <header
        className="border-b"
        style={{ backgroundColor: '#0B1A14', borderColor: '#316745' }}
      >
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href="/projects"
                  className="text-sm px-3 py-1 rounded-md transition-colors"
                  style={{ color: '#F9F8F5', opacity: 0.7 }}
                >
                  ← 專案列表
                </Link>
              </div>
              <h1
                className="text-3xl font-bold"
                style={{ color: '#F9F8F5', fontFamily: 'Inter, sans-serif', letterSpacing: '-0.03em' }}
              >
                全域行事曆
              </h1>
              <p className="mt-2" style={{ color: '#F9F8F5', opacity: 0.7 }}>
                跨所有專案的任務時程總覽
              </p>
            </div>
            <UserNav />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {loading && (
          <div className="flex justify-center py-12">
            <div className="animate-pulse text-lg" style={{ color: '#316745' }}>
              載入中...
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-12 text-red-500">{error}</div>
        )}

        {!loading && !error && (
          <GlobalCalendarView cards={cards} projects={projects} />
        )}
      </main>
    </div>
  )
}
