import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { fetchProject, fetchColumnsWithCards, fetchPhases } from '@/lib/queries'
import { BoardPageClient } from './board-client'

// Skeleton for Suspense fallback
function BoardSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6" id="main-content">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-9 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
      {/* Phase filter skeleton */}
      <div className="flex gap-2">
        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
      </div>
      {/* Columns skeleton */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex-shrink-0 w-72 space-y-3">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            {Array.from({ length: 3 - i % 2 }, (_, j) => (
              <div key={j} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

async function BoardContent({ projectId }: { projectId: string }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const [project, columns, phases] = await Promise.all([
    fetchProject(projectId),
    fetchColumnsWithCards(projectId),
    fetchPhases(projectId),
  ])

  if (!project) notFound()

  return (
    <BoardPageClient
      projectId={projectId}
      initialProject={{ id: project.id, name: project.name }}
      initialColumns={columns}
      initialPhases={phases}
    />
  )
}

export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardContent projectId={id} />
    </Suspense>
  )
}
