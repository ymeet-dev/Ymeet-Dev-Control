import type { ApprovalType, ProfileRole, TaskState } from './types';
import type { ApprovalRow } from './queries/approvals';

/**
 * Mesmo conjunto de papéis da policy RLS approvals_insert (admin, pm).
 * Não é a proteção real — isso é a RLS no banco — é só o filtro de UX para
 * não mostrar um botão de solicitar que o servidor certamente vai rejeitar.
 */
export const ROLES_ALLOWED_TO_REQUEST_APPROVAL: ProfileRole[] = ['admin', 'pm'];

/**
 * Espelho dos dois gates reais da trigger enforce_task_approval_gate (ver
 * supabase/migrations/20261016103000_task_state_transitions.sql):
 * PENDING_APPROVAL exige approvals.task_approval; READY_TO_PUBLISH exige
 * approvals.publish_approval. Nenhum outro estado da máquina consome uma
 * aprovação, então nenhum outro estado aparece aqui.
 */
const APPROVAL_TYPE_BY_STATE: Partial<Record<TaskState, ApprovalType>> = {
  PENDING_APPROVAL: 'task_approval',
  READY_TO_PUBLISH: 'publish_approval',
};

export function canRequestApproval(role: ProfileRole | null | undefined): boolean {
  return !!role && ROLES_ALLOWED_TO_REQUEST_APPROVAL.includes(role);
}

/**
 * Tipo de aprovação que faz sentido solicitar para o estado atual da
 * tarefa, ou null se o estado atual não usa aprovação, ou se já existe
 * QUALQUER solicitação desse tipo para esta tarefa — pending, approved ou
 * rejected.
 *
 * Desde a migration 20261017090000_approvals_lifecycle_guard.sql, essa
 * mesma regra (nascer pending; bloquear nova solicitação quando já existe
 * approved/rejected) também é garantida no próprio Postgres, pela trigger
 * enforce_approval_lifecycle — esta função não depende mais só da
 * aplicação chamar a Server Action corretamente. A checagem abaixo
 * continua existindo só para dar feedback imediato na interface (esconder
 * o botão, evitar um round-trip ao servidor); a garantia real passou a
 * estar no banco.
 *

 * As três decisões colapsam numa única checagem ("já existe alguma linha
 * desse tipo?") porque, no grafo real da máquina de estados (ver
 * supabase/migrations/20261016103000_task_state_transitions.sql e
 * taskStateMachine.ts), PENDING_APPROVAL e READY_TO_PUBLISH só são
 * alcançados de forma consequente uma única vez por tarefa:
 *   - PENDING_APPROVAL: única entrada real é IN_QA -> PENDING_APPROVAL.
 *     Suas únicas saídas são APPROVED, REJECTED, BLOCKED e CANCELLED.
 *     BLOCKED só retorna à própria origem (PENDING_APPROVAL de novo) — não
 *     é um novo ciclo, é a mesma permanência pausada. Nenhuma aresta no
 *     grafo volta de APPROVED, READY_TO_PUBLISH, PUBLISHED, REJECTED ou
 *     CANCELLED para PENDING_APPROVAL.
 *   - READY_TO_PUBLISH segue o mesmo padrão: única entrada é
 *     APPROVED -> READY_TO_PUBLISH; saídas são PUBLISHED, BLOCKED (volta à
 *     própria origem) e CANCELLED; nenhuma aresta de retorno.
 *
 * Ou seja: enquanto este grafo não ganhar uma aresta nova de volta para
 * PENDING_APPROVAL ou READY_TO_PUBLISH, qualquer linha de approvals desse
 * tipo para esta tarefa — pending, approved ou rejected — pertence sempre
 * à mesma e única passagem da tarefa por esse estado. Não há "ciclo"
 * diferente para calcular, e por isso esta função não usa nenhum
 * timestamp do histórico (task_state_transitions) para decidir isso —
 * usar timestamp para inventar um ciclo seria contornar o próprio grafo.
 *
 * Consequência explícita (regra de negócio, não um bug): depois de uma
 * `pending` (evita duplicidade), de uma `approved` ainda não consumida
 * (a tarefa só precisa avançar pelo botão "Mudar estado", não pedir de
 * novo) ou de uma `rejected` (nenhum caminho de retrabalho leva de volta a
 * PENDING_APPROVAL/READY_TO_PUBLISH para a mesma tarefa — uma nova
 * tentativa de trabalho exige uma tarefa nova), esta função nunca mais
 * libera uma nova solicitação do mesmo tipo para esta tarefa.
 *
 * Se este grafo ganhar, no futuro, uma aresta nova de volta para
 * PENDING_APPROVAL ou READY_TO_PUBLISH, esta função precisa ser revisada
 * — a garantia acima deixaria de valer.
 */
export function getRequestableApprovalType(
  taskState: TaskState,
  existingApprovals: Pick<ApprovalRow, 'approval_type' | 'decision'>[],
): ApprovalType | null {
  const candidate = APPROVAL_TYPE_BY_STATE[taskState];
  if (!candidate) return null;

  const alreadyRequestedOnce = existingApprovals.some((approval) => approval.approval_type === candidate);

  return alreadyRequestedOnce ? null : candidate;
}
