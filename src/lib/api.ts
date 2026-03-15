/**
 * Centralized API functions for TanStack Query
 * Each function handles fetch + error extraction
 */

// ─── Generic helpers ────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

async function postJson<T>(url: string, data: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

async function putJson<T>(url: string, data: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

async function patchJson<T>(url: string, data: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

async function deleteJson<T>(url: string): Promise<T> {
  return fetchJson<T>(url, { method: 'DELETE' })
}

// ─── Projects ───────────────────────────────────────────────

export interface ProjectListItem {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface ProjectDetail {
  id: string
  name: string
  description: string | null
  created_at: string
}

export async function fetchProjects(): Promise<ProjectListItem[]> {
  const res = await fetch('/api/projects')
  const data = await res.json()
  // API may return error object if DB not initialized
  if (data.error) {
    throw new Error(data.detail || data.error)
  }
  return data
}

export async function createProject(name: string): Promise<ProjectDetail> {
  return postJson('/api/projects', { name })
}

export async function initDatabase(): Promise<{ success: boolean; detail?: string }> {
  return fetchJson('/api/projects', { method: 'PUT' })
}

// ─── Board ──────────────────────────────────────────────────

export async function fetchProjectDetail(projectId: string): Promise<ProjectDetail> {
  return fetchJson(`/api/projects/${projectId}`)
}

export async function fetchColumns(projectId: string) {
  return fetchJson<unknown[]>(`/api/projects/${projectId}/columns`)
}

export async function fetchPhases(projectId: string) {
  try {
    return await fetchJson<unknown[]>(`/api/projects/${projectId}/phases`)
  } catch {
    return [] // Phases API may not exist yet
  }
}

export async function createCard(data: { column_id: string; title: string; phase_id?: string }) {
  return postJson('/api/cards', data)
}

export async function updateCard(cardId: string, data: Record<string, unknown>) {
  return putJson(`/api/cards/${cardId}`, data)
}

export interface MoveCardResult {
  success?: boolean
  recurring_card_created?: Record<string, unknown>
}

export async function moveCard(data: {
  card_id: string
  source_column_id: string
  dest_column_id: string
  source_index: number
  dest_index: number
}): Promise<MoveCardResult> {
  return postJson<MoveCardResult>('/api/cards/move', data)
}

export async function createColumn(data: { project_id: string; name: string }) {
  return postJson('/api/columns', data)
}

export async function deleteColumn(columnId: string, targetColumnId?: string | null) {
  let url = `/api/columns?id=${columnId}`
  if (targetColumnId) url += `&targetColumnId=${targetColumnId}`
  return deleteJson(url)
}

export async function createPhase(projectId: string, data: { name: string; color: string }) {
  return postJson(`/api/projects/${projectId}/phases`, data)
}

export async function deletePhase(projectId: string, phaseId: string, targetPhaseId?: string | null) {
  let url = `/api/projects/${projectId}/phases?id=${phaseId}`
  if (targetPhaseId) url += `&targetPhaseId=${targetPhaseId}`
  return deleteJson(url)
}

// ─── Calendar ───────────────────────────────────────────────

export interface CalendarData {
  cards: unknown[]
  projects: unknown[]
}

export async function fetchCalendarData(): Promise<CalendarData> {
  const data = await fetchJson<CalendarData>('/api/calendar')
  return {
    cards: data.cards || [],
    projects: data.projects || [],
  }
}

// ─── Notifications ──────────────────────────────────────────

export async function fetchNotificationCenter() {
  return fetchJson<unknown>('/api/notifications/center')
}

export async function dismissNotification(cardId: string, dismissType: string) {
  return postJson('/api/notifications/dismiss', { card_id: cardId, dismiss_type: dismissType })
}

export async function restoreNotification(cardId: string, dismissType: string) {
  return fetchJson('/api/notifications/dismiss', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ card_id: cardId, dismiss_type: dismissType }),
  })
}

export async function fetchNotificationPreferences() {
  return fetchJson<unknown>('/api/notifications/preferences')
}

export async function updateNotificationPreferences(data: unknown) {
  return putJson('/api/notifications/preferences', data)
}

// ─── Settings ───────────────────────────────────────────────

export async function fetchUserProfile() {
  return fetchJson<unknown>('/api/users/me')
}

export async function updateUserProfile(data: Record<string, unknown>) {
  return putJson('/api/users/me', data)
}

export async function changePassword(data: { current_password: string; new_password: string }) {
  return putJson('/api/users/me/password', data)
}

// ─── Admin ──────────────────────────────────────────────────

export async function fetchAdminStats() {
  return fetchJson<unknown>('/api/admin/stats')
}

export async function fetchAdminUsers(params: URLSearchParams) {
  return fetchJson<unknown>(`/api/admin/users?${params.toString()}`)
}

export async function fetchAdminUserDetail(id: string) {
  return fetchJson<unknown>(`/api/admin/users/${id}`)
}

export async function updateAdminUser(id: string, data: Record<string, unknown>) {
  return fetchJson(`/api/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function fetchAdminProjects() {
  return fetchJson<unknown>('/api/admin/projects')
}

export async function fetchAdminApiKeys() {
  return fetchJson<unknown>('/api/ai/keys')
}

export async function createAdminApiKey(data: { name: string; permissions: string; expires_at?: string }) {
  return postJson('/api/ai/keys', data)
}

export async function deleteAdminApiKey(id: string) {
  return deleteJson(`/api/ai/keys?id=${id}`)
}

export async function fetchAdminNotificationSettings() {
  return fetchJson<unknown>('/api/admin/notifications/settings')
}

export async function updateAdminNotificationSettings(data: unknown) {
  return putJson('/api/admin/notifications/settings', data)
}

export async function fetchActiveUsers() {
  return fetchJson<unknown>('/api/admin/users?is_active=true&limit=100')
}

export async function adminResetPassword(userId: string, newPassword: string) {
  return putJson(`/api/admin/users/${userId}/password`, { new_password: newPassword })
}

// ─── Archive ───────────────────────────────────────────────

export interface ArchivedCard {
  id: string
  card_number: number | null
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high'
  actual_completion_date: string | null
  archived_at: string
  phase_id: string | null
  phase_name: string | null
  phase_color: string | null
  column_name: string
  column_color: string
  assignees: { id: string; name: string }[]
  tags: { id: string; name: string; color: string }[]
}

export async function fetchArchivedCards(projectId: string, search?: string) {
  const params = new URLSearchParams({ project_id: projectId })
  if (search) params.set('search', search)
  return fetchJson<{ total: number; cards: ArchivedCard[] }>(`/api/cards/archived?${params}`)
}

export async function batchUpdateSubtasks(cardId: string, data: {
  action: 'complete_all' | 'uncomplete_all'
  subtask_ids: string[]
  skip_auto_transition?: boolean
}) {
  return patchJson<{ updated_count: number }>(`/api/cards/${cardId}/subtasks/batch`, {
    ...data,
    skip_auto_transition: data.skip_auto_transition ?? true,
  })
}

export async function archiveCard(cardId: string, isArchived: boolean) {
  return fetchJson(`/api/cards/${cardId}/archive`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_archived: isArchived }),
  })
}
