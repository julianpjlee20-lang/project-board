/**
 * TanStack Query key factory
 * Centralizes all query keys for consistent invalidation
 */

export const queryKeys = {
  // ─── Projects ──────────────────────────────────────────────
  projects: {
    all: ['projects'] as const,
    list: () => [...queryKeys.projects.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.projects.all, 'detail', id] as const,
  },

  // ─── Board (columns + cards) ───────────────────────────────
  board: {
    all: (projectId: string) => ['board', projectId] as const,
    columns: (projectId: string) => ['board', projectId, 'columns'] as const,
    phases: (projectId: string) => ['board', projectId, 'phases'] as const,
  },

  // ─── Calendar ──────────────────────────────────────────────
  calendar: {
    all: ['calendar'] as const,
    global: () => [...queryKeys.calendar.all, 'global'] as const,
  },

  // ─── Notifications ────────────────────────────────────────
  notifications: {
    all: ['notifications'] as const,
    center: () => [...queryKeys.notifications.all, 'center'] as const,
    preferences: () => [...queryKeys.notifications.all, 'preferences'] as const,
  },

  // ─── Settings ─────────────────────────────────────────────
  settings: {
    profile: ['settings', 'profile'] as const,
  },

  // ─── Admin ────────────────────────────────────────────────
  admin: {
    stats: ['admin', 'stats'] as const,
    users: {
      all: ['admin', 'users'] as const,
      list: (params: Record<string, string>) => ['admin', 'users', 'list', params] as const,
      detail: (id: string) => ['admin', 'users', 'detail', id] as const,
    },
    projects: {
      all: ['admin', 'projects'] as const,
      list: () => ['admin', 'projects', 'list'] as const,
    },
    apiKeys: {
      all: ['admin', 'api-keys'] as const,
      list: () => ['admin', 'api-keys', 'list'] as const,
    },
    notifications: {
      settings: ['admin', 'notifications', 'settings'] as const,
      users: ['admin', 'notifications', 'users'] as const,
    },
  },
} as const
