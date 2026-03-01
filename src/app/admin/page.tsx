'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface AdminStats {
  total_users: number
  active_users: number
  disabled_users: number
  total_projects: number
  total_cards: number
  users_this_month: number
  credentials_users: number
  discord_users: number
}

// --- SVG Icon Components ---

type IconProps = { className?: string; style?: React.CSSProperties }

function UsersIcon({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  )
}

function ActiveUserIcon({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function PendingUserIcon({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}

function ProjectIcon({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  )
}

function CardsIcon({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 0 1 2.25-2.25h7.5A2.25 2.25 0 0 1 18 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 0 0 4.5 9v.878m13.5-3A2.25 2.25 0 0 1 19.5 9v.878m0 0a2.246 2.246 0 0 0-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0 1 21 12v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6c0-1.016.672-1.872 1.595-2.153" />
    </svg>
  )
}

function NewUserIcon({ className, style }: IconProps) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
    </svg>
  )
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  )
}

// --- Stat Card Component ---

interface StatCardProps {
  title: string
  value: number
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  bgColor: string
}

function StatCard({ title, value, icon: Icon, color, bgColor }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border p-5 transition-shadow hover:shadow-md" style={{ borderColor: '#E5E5E5' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: '#6B7280' }}>
            {title}
          </p>
          <p className="text-3xl font-bold mt-1" style={{ color: '#0B1A14' }}>
            {value.toLocaleString()}
          </p>
        </div>
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: bgColor }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

// --- Loading Skeleton ---

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border p-5 animate-pulse" style={{ borderColor: '#E5E5E5' }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="h-4 w-20 bg-slate-200 rounded" />
          <div className="h-8 w-16 bg-slate-200 rounded mt-2" />
        </div>
        <div className="w-11 h-11 bg-slate-200 rounded-lg" />
      </div>
    </div>
  )
}

// --- Main Dashboard Component ---

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats')
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || '無法載入統計數據')
        }
        const data = await res.json()
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : '載入失敗')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statCards: (StatCardProps & { key: string })[] = stats
    ? [
        {
          key: 'total_users',
          title: '總使用者數',
          value: stats.total_users,
          icon: UsersIcon,
          color: '#4EA7FC',
          bgColor: '#EEF6FF',
        },
        {
          key: 'active_users',
          title: '啟用中使用者',
          value: stats.active_users,
          icon: ActiveUserIcon,
          color: '#10B981',
          bgColor: '#ECFDF5',
        },
        {
          key: 'disabled_users',
          title: '待審核/停用',
          value: stats.disabled_users,
          icon: PendingUserIcon,
          color: '#F59E0B',
          bgColor: '#FFFBEB',
        },
        {
          key: 'total_projects',
          title: '總專案數',
          value: stats.total_projects,
          icon: ProjectIcon,
          color: '#8B5CF6',
          bgColor: '#F5F3FF',
        },
        {
          key: 'total_cards',
          title: '總卡片數',
          value: stats.total_cards,
          icon: CardsIcon,
          color: '#EC4899',
          bgColor: '#FDF2F8',
        },
        {
          key: 'users_this_month',
          title: '本月新使用者',
          value: stats.users_this_month,
          icon: NewUserIcon,
          color: '#06B6D4',
          bgColor: '#ECFEFF',
        },
      ]
    : []

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#0B1A14' }}>
          管理後台 Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          系統總覽與快速操作
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: '#9CA3AF' }}>
          系統統計
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <StatCardSkeleton key={i} />)
            : statCards.map((card) => (
                <StatCard
                  key={card.key}
                  title={card.title}
                  value={card.value}
                  icon={card.icon}
                  color={card.color}
                  bgColor={card.bgColor}
                />
              ))}
        </div>
      </section>

      {/* Login Methods Summary */}
      {stats && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: '#9CA3AF' }}>
            登入方式統計
          </h2>
          <div className="bg-white rounded-xl border p-5" style={{ borderColor: '#E5E5E5' }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#0B1A14' }}
                />
                <span className="text-sm" style={{ color: '#374151' }}>
                  帳號密碼登入
                </span>
                <span className="text-sm font-semibold ml-auto" style={{ color: '#0B1A14' }}>
                  {stats.credentials_users}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: '#5865F2' }}
                />
                <span className="text-sm" style={{ color: '#374151' }}>
                  Discord 登入
                </span>
                <span className="text-sm font-semibold ml-auto" style={{ color: '#0B1A14' }}>
                  {stats.discord_users}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: '#9CA3AF' }}>
          快速操作
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Review Users */}
          <Link
            href="/admin/users?is_active=false"
            className="group bg-white rounded-xl border p-5 transition-all hover:shadow-md hover:border-amber-300"
            style={{ borderColor: '#E5E5E5' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm" style={{ color: '#0B1A14' }}>
                  審核使用者
                </h3>
                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                  查看待審核的使用者帳號
                </p>
                {stats && stats.disabled_users > 0 && (
                  <span
                    className="inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full"
                    style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                  >
                    {stats.disabled_users} 人待處理
                  </span>
                )}
              </div>
              <ArrowRightIcon className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
            </div>
          </Link>

          {/* View All Projects */}
          <Link
            href="/admin/projects"
            className="group bg-white rounded-xl border p-5 transition-all hover:shadow-md hover:border-violet-300"
            style={{ borderColor: '#E5E5E5' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm" style={{ color: '#0B1A14' }}>
                  查看所有專案
                </h3>
                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                  瀏覽所有專案的狀態與統計
                </p>
                {stats && (
                  <span
                    className="inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full"
                    style={{ backgroundColor: '#F5F3FF', color: '#6D28D9' }}
                  >
                    共 {stats.total_projects} 個專案
                  </span>
                )}
              </div>
              <ArrowRightIcon className="w-5 h-5 text-slate-400 group-hover:text-violet-500 transition-colors" />
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}
