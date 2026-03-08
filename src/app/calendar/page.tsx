import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { fetchCalendarData } from '@/lib/queries'
import { CalendarPageClient } from './calendar-client'

// Skeleton for Suspense fallback
function CalendarSkeleton() {
  return (
    <div id="main-content" className="min-h-screen bg-brand-bg">
      <header className="border-b bg-brand-primary border-brand-green">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="h-4 w-20 bg-brand-bg/10 rounded animate-pulse mb-2" />
              <div className="h-9 w-40 bg-brand-bg/20 rounded animate-pulse" />
              <div className="mt-2 h-4 w-56 bg-brand-bg/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-8">
        <div className="space-y-4 animate-pulse">
          <div className="flex justify-between items-center">
            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="flex gap-2">
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-px">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
            {Array.from({ length: 35 }, (_, i) => (
              <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

async function CalendarContent() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const { cards, projects } = await fetchCalendarData()
  return <CalendarPageClient initialCards={cards} initialProjects={projects} />
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarContent />
    </Suspense>
  )
}
