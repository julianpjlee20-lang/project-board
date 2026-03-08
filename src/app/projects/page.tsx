import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { fetchProjects } from '@/lib/queries'
import { ProjectsPageClient } from './projects-client'

// Skeleton for Suspense fallback
function ProjectsSkeleton() {
  return (
    <div id="main-content" className="min-h-screen bg-brand-bg">
      <header className="border-b bg-brand-primary border-brand-green">
        <div className="container mx-auto px-6 max-sm:px-4 py-8 max-sm:py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="h-9 w-36 bg-brand-bg/20 rounded animate-pulse" />
              <div className="mt-2 h-4 w-48 bg-brand-bg/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 max-sm:px-4 py-8 max-sm:py-5">
        <div className="flex gap-3 mb-12 max-sm:mb-8">
          <div className="h-12 w-full max-w-md rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="h-12 w-20 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="p-5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3 animate-pulse">
              <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="flex gap-2 pt-2">
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

async function ProjectsContent() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const projects = await fetchProjects()
  return <ProjectsPageClient initialProjects={projects} />
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<ProjectsSkeleton />}>
      <ProjectsContent />
    </Suspense>
  )
}
