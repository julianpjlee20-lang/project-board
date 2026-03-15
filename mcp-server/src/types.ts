// src/types.ts

export interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Phase {
  id: string;
  project_id: string;
  name: string;
  position?: number;
  created_at?: string;
}

export const CARD_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type CardStatus = (typeof CARD_STATUSES)[number];

export interface Card {
  id: string;
  phase_id: string;
  title: string;
  description?: string;
  status?: CardStatus;
  assignee?: string;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
}

export type ProjectsApiResponse =
  | { projects: Project[] }
  | { data: Project[] }
  | Project[];

export type PhasesApiResponse =
  | { phases: Phase[] }
  | { data: Phase[] }
  | Phase[];

export type CardsApiResponse =
  | { cards: Card[] }
  | { data: Card[] }
  | Card[];

export interface Subtask {
  id: string;
  card_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  due_date?: string;
  assignee_id?: string;
  assignee_name?: string;
  created_at?: string;
}

export interface User {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  login_method: string;
  created_at: string;
}

export interface UsersApiResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
}
