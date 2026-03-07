'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────
interface Project {
  id: string
  name: string
  description: string | null
  status: string | null
  card_count: number
  member_count: number
  creator_name: string | null
  created_at: string
}

// ─── Helpers ─────────────────────────────────────────────
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Sort Types & Helper ─────────────────────────────────
type SortDirection = 'asc' | 'desc' | null
type ProjectSortKey = 'name' | 'creator_name' | 'created_at' | 'member_count' | 'card_count' | 'status'

interface SortState {
  key: ProjectSortKey | null
  direction: SortDirection
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: ProjectSortKey
  currentSort: SortState
  onSort: (key: ProjectSortKey) => void
  align?: 'left' | 'center'
}) {
  const isActive = currentSort.key === sortKey
  const direction = isActive ? currentSort.direction : null

  return (
    <th
      className={`${align === 'center' ? 'text-center' : 'text-left'} px-6 py-3 font-medium text-xs uppercase tracking-wide select-none cursor-pointer group text-text-secondary focus:outline-none focus:ring-2 focus:ring-blue-500`}
      tabIndex={0}
      role="button"
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(sortKey); } }}
      aria-sort={direction === 'asc' ? 'ascending' : direction === 'desc' ? 'descending' : 'none'}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'center' ? 'justify-center' : ''}`}>
        {label}
        <span className={`text-xs ${isActive ? 'text-blue-500' : 'text-slate-400 opacity-0 group-hover:opacity-100'} transition-opacity`}>
          {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '▲▼'}
        </span>
      </span>
    </th>
  )
}

// ─── Skeleton Loader ─────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-surface-elevated rounded-xl p-5 border border-border-default">
            <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700 mb-3" />
            <div className="h-7 w-12 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="bg-surface-elevated rounded-xl border border-border-default overflow-hidden">
        <div className="p-4 border-b border-border-default">
          <div className="h-10 w-64 rounded-lg bg-slate-200" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-surface-subtle">
            <div className="h-4 flex-1 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-20 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-12 rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-12 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────
function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold mb-1 text-brand-primary">
        {hasSearch ? '沒有符合的專案' : '尚無專案'}
      </h3>
      <p className="text-sm text-text-secondary">
        {hasSearch ? '請嘗試其他搜尋關鍵字' : '系統中尚未建立任何專案'}
      </p>
    </div>
  )
}

// ─── Stats Cards ─────────────────────────────────────────
function StatsCards({ projects }: { projects: Project[] }) {
  const totalProjects = projects.length
  const totalCards = projects.reduce((sum, p) => sum + p.card_count, 0)
  const avgCards = totalProjects > 0 ? Math.round(totalCards / totalProjects) : 0

  const stats = [
    { label: '總專案數', value: totalProjects, color: '#4EA7FC' },
    { label: '總卡片數', value: totalCards, color: '#10B981' },
    { label: '平均每專案卡片數', value: avgCards, color: '#F59E0B' },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-surface-elevated rounded-xl p-5 border border-border-default transition-shadow hover:shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide mb-1 text-text-secondary">
            {stat.label}
          </p>
          <p className="text-2xl font-bold" style={{ color: stat.color }}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Search Input ────────────────────────────────────────
function SearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="搜尋專案名稱…"
        className="w-full sm:w-64 pl-10 pr-4 py-2.5 rounded-lg border border-border-default text-sm text-brand-primary focus:outline-none focus-visible:ring-2"
        aria-label="搜尋專案"
      />
    </div>
  )
}

// ─── Mobile Card ─────────────────────────────────────────
function ProjectCard({ project }: { project: Project }) {
  return (
    <div
      className="bg-surface-elevated rounded-xl border border-border-default p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between mb-3">
        <Link
          href={`/projects/${project.id}`}
          className="text-sm font-semibold hover:underline text-blue-400"
        >
          {project.name}
        </Link>
        {project.status && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              project.status === 'active'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-surface-subtle text-text-secondary'
            }`}
          >
            {project.status === 'active' ? '進行中' : project.status === 'completed' ? '已完成' : project.status === 'archived' ? '已封存' : project.status}
          </span>
        )}
      </div>

      {project.description && (
        <p className="text-xs mb-3 line-clamp-2 text-text-secondary">
          {project.description}
        </p>
      )}

      <div className="grid grid-cols-2 gap-y-2 text-xs text-text-secondary">
        <div>
          <span className="font-medium">擁有者：</span>
          {project.creator_name || '未知'}
        </div>
        <div>
          <span className="font-medium">卡片數：</span>
          {project.card_count}
        </div>
        <div>
          <span className="font-medium">成員數：</span>
          {project.member_count}
        </div>
        <div>
          <span className="font-medium">建立日期：</span>
          {formatDate(project.created_at)}
        </div>
      </div>
    </div>
  )
}

// ─── Desktop Table ───────────────────────────────────────
function ProjectTable({
  projects,
  sort,
  onSort,
}: {
  projects: Project[]
  sort: SortState
  onSort: (key: ProjectSortKey) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            <SortableHeader label="專案名稱" sortKey="name" currentSort={sort} onSort={onSort} />
            <SortableHeader label="擁有者" sortKey="creator_name" currentSort={sort} onSort={onSort} />
            <SortableHeader label="建立日期" sortKey="created_at" currentSort={sort} onSort={onSort} />
            <SortableHeader label="成員數" sortKey="member_count" currentSort={sort} onSort={onSort} align="center" />
            <SortableHeader label="卡片數" sortKey="card_count" currentSort={sort} onSort={onSort} align="center" />
            <SortableHeader label="狀態" sortKey="status" currentSort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              className="border-t border-surface-subtle transition-colors hover:bg-muted"
            >
              <td className="px-6 py-4">
                <Link
                  href={`/projects/${project.id}`}
                  className="font-medium hover:underline text-blue-400"
                >
                  {project.name}
                </Link>
                {project.description && (
                  <p className="text-xs mt-0.5 line-clamp-1 text-text-tertiary">
                    {project.description}
                  </p>
                )}
              </td>
              <td className="px-6 py-4 text-gray-700">
                {project.creator_name || '—'}
              </td>
              <td className="px-6 py-4 text-text-secondary">
                <span title={formatDateTime(project.created_at)}>
                  {formatDate(project.created_at)}
                </span>
              </td>
              <td className="px-6 py-4 text-center text-gray-700">
                {project.member_count}
              </td>
              <td className="px-6 py-4 text-center text-gray-700">
                {project.card_count}
              </td>
              <td className="px-6 py-4">
                {project.status ? (
                  <span
                    className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium ${
                      project.status === 'active'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-surface-subtle text-text-secondary'
                    }`}
                  >
                    {project.status === 'active' ? '進行中' : project.status === 'completed' ? '已完成' : project.status === 'archived' ? '已封存' : project.status}
                  </span>
                ) : (
                  <span className="text-text-tertiary">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────
export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/projects', { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: '伺服器錯誤' }))
        throw new Error(data.error || `請求失敗 (${res.status})`)
      }
      const data = await res.json()
      setProjects(data.projects ?? [])
    } catch (err) {
      console.error('[Admin Projects] 載入錯誤:', err)
      setError(err instanceof Error ? err.message : '載入專案列表失敗')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value)
    }, 300)
  }, [])

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  // Sort state
  const [sort, setSort] = useState<SortState>({ key: null, direction: null })

  const handleSort = useCallback((key: ProjectSortKey) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' }
      if (prev.direction === 'asc') return { key, direction: 'desc' }
      return { key: null, direction: null }
    })
  }, [])

  // Filtered projects
  const filteredProjects = searchQuery.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
      )
    : projects

  // Sorted projects
  const sortedProjects = useMemo(() => {
    if (!sort.key || !sort.direction) return filteredProjects

    const sorted = [...filteredProjects].sort((a, b) => {
      const key = sort.key!
      let comparison = 0

      if (key === 'member_count' || key === 'card_count') {
        comparison = a[key] - b[key]
      } else if (key === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else {
        // 字串排序：name, creator_name, status
        const valA = (a[key] ?? '').toLowerCase()
        const valB = (b[key] ?? '').toLowerCase()
        comparison = valA.localeCompare(valB, 'zh-TW')
      }

      return sort.direction === 'desc' ? -comparison : comparison
    })

    return sorted
  }, [filteredProjects, sort.key, sort.direction])

  return (
    <div id="main-content" className="p-6 sm:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-primary">
          專案概覽
        </h1>
        <p className="text-sm mt-1 text-text-secondary">
          管理和查看所有專案的狀態
        </p>
      </div>

      {/* Loading State */}
      {loading && <TableSkeleton />}

      {/* Error State */}
      {!loading && error && (
        <div className="rounded-xl border bg-red-50 border-red-200 p-6 text-center">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={fetchProjects}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
          >
            重試
          </button>
        </div>
      )}

      {/* Loaded Content */}
      {!loading && !error && (
        <>
          {/* Stats — 使用 filteredProjects 讓統計數字反映搜尋結果 */}
          <StatsCards projects={filteredProjects} />

          {/* Table / Card Container */}
          <div className="bg-surface-elevated rounded-xl border border-border-default overflow-hidden">
            {/* Search Bar */}
            <div className="px-6 py-4 border-b border-border-default flex items-center justify-between gap-4">
              <SearchInput value={searchInput} onChange={handleSearchChange} />
              <span className="text-xs whitespace-nowrap text-text-tertiary">
                共 {filteredProjects.length} 個專案
              </span>
            </div>

            {/* Content */}
            {filteredProjects.length === 0 ? (
              <EmptyState hasSearch={searchQuery.trim().length > 0} />
            ) : (
              <>
                {/* Desktop: Table */}
                <div className="hidden md:block">
                  <ProjectTable projects={sortedProjects} sort={sort} onSort={handleSort} />
                </div>

                {/* Mobile: Cards */}
                <div className="md:hidden p-4 space-y-3">
                  {sortedProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
