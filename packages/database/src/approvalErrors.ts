/**
 * Traduz erros da solicitação de aprovação (createApprovalRequest) em
 * mensagens de negócio legíveis, sem expor texto bruto do Postgres. Domínio
 * diferente de taskStateErrors.ts (que traduz exceções da trigger de
 * máquina de estados) — aqui os erros típicos são:
 *   - a policy approvals_insert (RLS) recusando o INSERT por papel;
 *   - a violação do índice único parcial approvals_one_pending_per_task_type
 *     (ver migration 20261016150000_approvals_pending_unique_index.sql),
 *     quando duas solicitações concorrentes tentam criar a mesma pending
 *     ao mesmo tempo;
 *   - as exceções da trigger enforce_approval_lifecycle (ver migration
 *     20261017090000_approvals_lifecycle_guard.sql), identificadas por
 *     SQLSTATE próprio (YM001/YM002/YM003), não por texto de mensagem —
 *     mais robusto do que casar substring, e é assim que a trigger foi
 *     desenhada de propósito (using errcode = '...').
 */

const PREFIX = 'Não foi possível solicitar a aprovação';

const GENERIC_MESSAGE = `${PREFIX}. Tente novamente ou, se persistir, contate um administrador.`;

/** Nome exato da constraint criada pela migration — único identificador confiável do 23505 específico. */
const PENDING_UNIQUE_INDEX_NAME = 'approvals_one_pending_per_task_type';

const UNIQUE_VIOLATION_CODE = '23505';

/** SQLSTATE padrão do Postgres para violação de policy de RLS (insufficient_privilege). */
const RLS_VIOLATION_CODE = '42501';

/**
 * SQLSTATEs próprios, definidos em enforce_approval_lifecycle via
 * `using errcode = '...'`. Usar o código, não o texto da mensagem, é o que
 * torna esse reconhecimento estável mesmo que a frase da exceção mude.
 */
const LIFECYCLE_ERROR_MESSAGES: Record<string, string> = {
  YM001: 'esta solicitação precisa começar como pendente — não é possível criar uma aprovação já decidida.',
  YM002: 'esta tarefa já tem uma decisão registrada para este tipo de aprovação — não é possível solicitar de novo.',
  YM003: 'não é possível alterar uma decisão de aprovação já finalizada.',
};

interface ExtractedError {
  message: string;
  code?: string;
}

function extractError(error: unknown): ExtractedError {
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; code?: unknown };
    const message = typeof candidate.message === 'string' ? candidate.message : '';
    const code = typeof candidate.code === 'string' ? candidate.code : undefined;
    if (message) return { message, code };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: '' };
}

export function translateApprovalError(error: unknown): string {
  const { message, code } = extractError(error);
  const raw = message.toLowerCase();

  if (!raw) return GENERIC_MESSAGE;

  if (code && LIFECYCLE_ERROR_MESSAGES[code]) {
    return `${PREFIX}: ${LIFECYCLE_ERROR_MESSAGES[code]}`;
  }

  // Não trata qualquer 23505 como duplicata de aprovação — só quando o
  // nome real da constraint criada por esta migration aparece na mensagem
  // (é assim que o Postgres relata violação de índice único:
  // `duplicate key value violates unique constraint "<nome>"`).
  if (code === UNIQUE_VIOLATION_CODE && raw.includes(PENDING_UNIQUE_INDEX_NAME.toLowerCase())) {
    return `${PREFIX}: já existe uma solicitação de aprovação pendente deste tipo para esta tarefa.`;
  }

  if (code === RLS_VIOLATION_CODE || raw.includes('row-level security') || raw.includes('violates row-level security policy')) {
    return `${PREFIX}: seu papel não tem permissão para solicitar este tipo de aprovação.`;
  }

  return GENERIC_MESSAGE;
}
