import type { ProfileRole, TaskState } from './types';

export interface TaskStateTransitionRule {
  from: TaskState;
  to: TaskState;
}

/**
 * Espelho de supabase/migrations/20261016103000_task_state_transitions.sql
 * (tabela task_state_transition_rules). A fonte de verdade é o banco — esta
 * lista só serve para a interface decidir quais ações mostrar. Toda transição
 * real é revalidada pela trigger enforce_task_approval_gate, independente
 * desta lista: se esta lista ficar desatualizada, a pior consequência é a UI
 * mostrar um botão que o banco vai rejeitar, nunca uma transição indevida
 * sendo aceita.
 *
 * BLOCKED nunca aparece aqui como origem — sua saída é dinâmica, validada
 * contra o histórico (ver getBlockedOriginState), não contra este grafo
 * estático.
 */
export const TASK_STATE_TRANSITION_RULES: TaskStateTransitionRule[] = [
  { from: 'BACKLOG', to: 'QUEUED' },
  { from: 'QUEUED', to: 'IN_DEV' },
  { from: 'IN_DEV', to: 'IN_AUDIT' },
  { from: 'IN_AUDIT', to: 'IN_QA' },
  { from: 'IN_QA', to: 'PENDING_APPROVAL' },
  { from: 'PENDING_APPROVAL', to: 'APPROVED' },
  { from: 'APPROVED', to: 'READY_TO_PUBLISH' },
  { from: 'READY_TO_PUBLISH', to: 'PUBLISHED' },
  { from: 'IN_AUDIT', to: 'CHANGES_REQUESTED' },
  { from: 'IN_QA', to: 'CHANGES_REQUESTED' },
  { from: 'CHANGES_REQUESTED', to: 'IN_DEV' },
  { from: 'PENDING_APPROVAL', to: 'REJECTED' },
  { from: 'IN_AUDIT', to: 'REJECTED' },
  { from: 'IN_QA', to: 'REJECTED' },
  { from: 'BACKLOG', to: 'BLOCKED' },
  { from: 'QUEUED', to: 'BLOCKED' },
  { from: 'IN_DEV', to: 'BLOCKED' },
  { from: 'IN_AUDIT', to: 'BLOCKED' },
  { from: 'IN_QA', to: 'BLOCKED' },
  { from: 'PENDING_APPROVAL', to: 'BLOCKED' },
  { from: 'READY_TO_PUBLISH', to: 'BLOCKED' },
  { from: 'CHANGES_REQUESTED', to: 'BLOCKED' },
  { from: 'BACKLOG', to: 'CANCELLED' },
  { from: 'QUEUED', to: 'CANCELLED' },
  { from: 'IN_DEV', to: 'CANCELLED' },
  { from: 'IN_AUDIT', to: 'CANCELLED' },
  { from: 'IN_QA', to: 'CANCELLED' },
  { from: 'PENDING_APPROVAL', to: 'CANCELLED' },
  { from: 'APPROVED', to: 'CANCELLED' },
  { from: 'READY_TO_PUBLISH', to: 'CANCELLED' },
  { from: 'CHANGES_REQUESTED', to: 'CANCELLED' },
];

/** Estados cujo destino exige motivo obrigatório (D2/D3/D4) e papel admin/pm. */
const RESTRICTED_TARGET_STATES: TaskState[] = ['BLOCKED', 'CANCELLED', 'REJECTED'];

/** Mesmo conjunto de papéis da policy RLS tasks_update. */
const ROLES_ALLOWED_TO_UPDATE_TASKS: ProfileRole[] = ['admin', 'pm', 'developer'];

/** Só admin/pm podem solicitar BLOCKED/CANCELLED/REJECTED — não se aplica à saída de BLOCKED. */
const ROLES_ALLOWED_RESTRICTED_TRANSITIONS: ProfileRole[] = ['admin', 'pm'];

export function requiresTransitionReason(toState: TaskState): boolean {
  return RESTRICTED_TARGET_STATES.includes(toState);
}

/**
 * Estado de origem de uma tarefa atualmente BLOCKED, a partir do histórico já
 * carregado na página (mesma regra usada pela trigger: a transição mais
 * recente com to_state = 'BLOCKED'). `history` deve estar ordenado do mais
 * recente para o mais antigo, como listTaskHistory já devolve.
 */
export function getBlockedOriginState(
  history: Array<{ to_state: string; from_state: string | null }>,
): TaskState | null {
  const blockedEntry = history.find((entry) => entry.to_state === 'BLOCKED');
  return (blockedEntry?.from_state as TaskState | undefined) ?? null;
}

/**
 * Próximos estados que a interface deve oferecer para o papel informado, dado
 * o estado atual da tarefa. Não é a validação de segurança (essa é a trigger
 * no banco) — é só o filtro de UX para não mostrar um botão que o servidor
 * certamente vai rejeitar.
 */
export function getAllowedNextStates(
  currentState: TaskState,
  role: ProfileRole | null | undefined,
  blockedOriginState?: TaskState | null,
): TaskState[] {
  if (!role || !ROLES_ALLOWED_TO_UPDATE_TASKS.includes(role)) {
    return [];
  }

  const candidates: TaskState[] =
    currentState === 'BLOCKED'
      ? blockedOriginState
        ? [blockedOriginState]
        : []
      : TASK_STATE_TRANSITION_RULES.filter((rule) => rule.from === currentState).map((rule) => rule.to);

  return candidates.filter(
    (to) => !RESTRICTED_TARGET_STATES.includes(to) || ROLES_ALLOWED_RESTRICTED_TRANSITIONS.includes(role),
  );
}
