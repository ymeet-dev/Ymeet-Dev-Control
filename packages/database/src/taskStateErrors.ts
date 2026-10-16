/**
 * Traduz os erros levantados pela trigger enforce_task_approval_gate (e pelo
 * wrapper transitionTaskState) em mensagens de negócio legíveis, sem expor o
 * texto bruto do Postgres. A trigger é a fonte de verdade da validação (ver
 * supabase/migrations/20261016103000_task_state_transitions.sql); este
 * arquivo só mapeia os textos que ela já lança para português, por prefixo/
 * trecho — nunca inventa uma causa que a mensagem original não confirma.
 */

const PREFIX = 'Não foi possível mudar o estado da tarefa';

const GENERIC_MESSAGE = `${PREFIX}. Tente novamente ou, se persistir, contate um administrador.`;

/**
 * Extrai o texto de erro de forma robusta, sem depender de `instanceof Error`:
 * o erro de uma chamada `supabase.rpc()` que falha na trigger é um
 * `PostgrestError` (objeto com `message`), que nem sempre é reconhecido por
 * `instanceof Error` dependendo do bundler — daí o bug original (a mensagem
 * caía no fallback genérico duas vezes).
 */
function extractRawMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string') return message;
  }
  if (error instanceof Error) return error.message;
  return '';
}

interface ErrorRule {
  matches: (raw: string) => boolean;
  reason: string;
}

const RULES: ErrorRule[] = [
  {
    // "transicao para REJECTED a partir de PENDING_APPROVAL exige approvals.task_approval rejeitado"
    matches: (raw) => raw.includes('exige approvals.task_approval rejeitado'),
    reason: 'esta tarefa só pode ser rejeitada depois de uma decisão de rejeição registrada na aprovação correspondente.',
  },
  {
    // "transicao para APPROVED exige approvals.task_approval aprovado"
    matches: (raw) => raw.includes('exige approvals.task_approval aprovado'),
    reason: 'esta tarefa só pode ser aprovada depois de uma aprovação registrada e já decidida como aprovada.',
  },
  {
    // "transicao para PUBLISHED exige approvals.publish_approval aprovado"
    matches: (raw) => raw.includes('exige approvals.publish_approval aprovado'),
    reason: 'esta tarefa só pode ser publicada depois de uma aprovação de publicação registrada e já decidida como aprovada.',
  },
  {
    // "transicao para % exige motivo"
    matches: (raw) => raw.includes('exige motivo'),
    reason: 'é obrigatório informar um motivo para esta transição.',
  },
  {
    // "apenas admin ou pm podem solicitar transicao para %"
    matches: (raw) => raw.includes('apenas admin ou pm podem solicitar'),
    reason: 'seu papel não tem permissão para solicitar esta transição.',
  },
  {
    // "tarefa nao encontrada ou sem permissao para executar esta transicao"
    matches: (raw) => raw.includes('nao encontrada ou sem permissao'),
    reason: 'não foi possível localizar a tarefa ou você não tem permissão para alterá-la.',
  },
  {
    // "transicao invalida: a saida de BLOCKED so e permitida para o estado de origem..."
    // "transicao invalida: APPROVED so e permitido a partir de PENDING_APPROVAL"
    // "transicao invalida: PUBLISHED so e permitido a partir de READY_TO_PUBLISH"
    // "transicao invalida: % -> % nao e permitida"
    matches: (raw) => raw.includes('transicao invalida'),
    reason: 'esta transição não é permitida a partir do estado atual da tarefa.',
  },
];

/**
 * Mensagem final, já completa (com o prefixo), pronta para ser exibida ao
 * usuário — quem chama esta função não deve acrescentar outro prefixo.
 */
export function translateTaskStateError(error: unknown): string {
  const raw = extractRawMessage(error).toLowerCase();

  if (!raw) return GENERIC_MESSAGE;

  const rule = RULES.find((candidate) => candidate.matches(raw));
  if (!rule) return GENERIC_MESSAGE;

  return `${PREFIX}: ${rule.reason}`;
}
