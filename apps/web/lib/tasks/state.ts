import type { TaskState } from 'database';

/** Ordem da máquina de estados definida em docs/architecture/fase-1-arquitetura.md. */
export const TASK_STATE_ORDER: TaskState[] = [
  'BACKLOG',
  'QUEUED',
  'IN_DEV',
  'IN_AUDIT',
  'IN_QA',
  'PENDING_APPROVAL',
  'APPROVED',
  'READY_TO_PUBLISH',
  'PUBLISHED',
  'CHANGES_REQUESTED',
  'BLOCKED',
  'CANCELLED',
  'REJECTED',
];

export const TASK_STATE_LABELS: Record<TaskState, string> = {
  BACKLOG: 'Backlog',
  QUEUED: 'Na fila',
  IN_DEV: 'Em desenvolvimento',
  IN_AUDIT: 'Em auditoria',
  IN_QA: 'Em QA',
  PENDING_APPROVAL: 'Aguardando aprovação',
  APPROVED: 'Aprovada',
  READY_TO_PUBLISH: 'Pronta para publicar',
  PUBLISHED: 'Publicada',
  CHANGES_REQUESTED: 'Alterações solicitadas',
  BLOCKED: 'Bloqueada',
  CANCELLED: 'Cancelada',
  REJECTED: 'Rejeitada',
};

/** Categoria visual do estado, só para agrupar cores no badge — não é um dado do schema. */
export type TaskStateCategory = 'neutral' | 'progress' | 'pending' | 'success' | 'warning' | 'danger';

const TASK_STATE_CATEGORY: Record<TaskState, TaskStateCategory> = {
  BACKLOG: 'neutral',
  QUEUED: 'neutral',
  IN_DEV: 'progress',
  IN_AUDIT: 'progress',
  IN_QA: 'progress',
  PENDING_APPROVAL: 'pending',
  APPROVED: 'success',
  READY_TO_PUBLISH: 'success',
  PUBLISHED: 'success',
  CHANGES_REQUESTED: 'warning',
  BLOCKED: 'danger',
  CANCELLED: 'danger',
  REJECTED: 'danger',
};

export function getTaskStateCategory(state: TaskState): TaskStateCategory {
  return TASK_STATE_CATEGORY[state];
}
