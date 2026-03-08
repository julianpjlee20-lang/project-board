'use client'

import Link from 'next/link'
import UserNav from '@/components/UserNav'
import { GlobalCalendarView, type CalendarCard, type CalendarProject } from './calendar-views'

interface CalendarPageClientProps {
  initialCards: CalendarCard[]
  initialProjects: CalendarProject[]
}

export function CalendarPageClient({ initialCards, initialProjects }: CalendarPageClientProps) {
  return (
    <div id="main-content" className="min-h-screen bg-brand-bg">
      {/* Header */}
      <header className="border-b bg-brand-primary border-brand-green">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href="/projects"
                  className="text-sm px-3 py-1 rounded-md transition-colors text-brand-bg/70"
                >
                  ← 專案列表
                </Link>
              </div>
              <h1 className="text-3xl font-bold text-brand-bg font-[Inter,sans-serif] tracking-[-0.03em]">
                全域行事曆
              </h1>
              <p className="mt-2 text-brand-bg/70">
                跨所有專案的任務時程總覽
              </p>
            </div>
            <UserNav />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <GlobalCalendarView cards={initialCards} projects={initialProjects} />
      </main>
    </div>
  )
}
