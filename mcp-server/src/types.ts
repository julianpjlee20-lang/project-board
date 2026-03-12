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
  order?: number;
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
