'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  canRequestApproval,
  createApprovalRequest,
  getRequestableApprovalType,
  getTask,
  listTaskApprovals,
  transitionTaskState,
  translateApprovalError,
  translateTaskStateError,
  type ApprovalType,
  type TaskState,
} from 'database';
import { getServerSupabaseClient } from '../../../lib/supabase/server';
import { getCurrentUser } from '../../../lib/auth/get-current-user';

/**
 * A validação real (grafo de transições, motivo obrigatório, papel do
 * solicitante, gates de aprovação) acontece na trigger enforce_task_approval_gate,
 * no banco — esta Server Action só chama a RPC e traduz o resultado. Mesmo que
 * esta Action seja contornada (chamada manipulada, UPDATE direto via API), a
 * trigger continua protegendo a tabela tasks.
 *
 * `message` já vem completo (com o prefixo "Não foi possível mudar o estado
 * da tarefa"), produzido por translateTaskStateError — quem exibir stateError
 * na UI não deve acrescentar outro prefixo, para não duplicá-lo.
 */
function failStateChange(taskId: string, message: string): never {
  redirect(`/tasks/${taskId}?stateError=${encodeURIComponent(message)}`);
}

export async function changeTaskStateAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get('task_id') ?? '').trim();
  const toState = String(formData.get('to_state') ?? '').trim() as TaskState;
  const reason = String(formData.get('reason') ?? '').trim();

  if (!taskId || !toState) {
    failStateChange(taskId || '', 'Não foi possível mudar o estado da tarefa: dados inválidos para esta transição.');
  }

  const supabase = await getServerSupabaseClient();

  try {
    await transitionTaskState(supabase, { taskId, toState, reason: reason || null });
  } catch (err) {
    failStateChange(taskId, translateTaskStateError(err));
  }

  revalidatePath('/tasks');
  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}?stateUpdated=1`);
}

/**
 * Só solicita (cria a linha pending em approvals) — não decide. Decidir uma
 * aprovação (aprovar/rejeitar) não está implementado nesta etapa (pausado
 * até a regra de autoaprovação ser formalizada). O papel e o estado válido
 * são checados aqui só para dar uma mensagem clara; a policy approvals_insert
 * (admin/pm) no banco é quem de fato impede uma solicitação não autorizada.
 */
function failApprovalRequest(taskId: string, message: string): never {
  redirect(`/tasks/${taskId}?approvalError=${encodeURIComponent(message)}`);
}

export async function requestApprovalAction(formData: FormData): Promise<void> {
  const taskId = String(formData.get('task_id') ?? '').trim();
  const approvalType = String(formData.get('approval_type') ?? '').trim() as ApprovalType;

  if (!taskId || !approvalType) {
    failApprovalRequest(taskId || '', 'Não foi possível solicitar a aprovação: dados inválidos.');
  }

  const currentUser = await getCurrentUser();
  if (!canRequestApproval(currentUser?.role)) {
    failApprovalRequest(taskId, 'Não foi possível solicitar a aprovação: seu papel não tem permissão para isso.');
  }

  const supabase = await getServerSupabaseClient();

  const task = await getTask(supabase, taskId);
  if (!task) {
    failApprovalRequest(taskId, 'Não foi possível solicitar a aprovação: tarefa não encontrada.');
  }

  const existingApprovals = await listTaskApprovals(supabase, taskId);
  const requestableType = getRequestableApprovalType(task.state, existingApprovals);

  if (!requestableType || requestableType !== approvalType) {
    failApprovalRequest(
      taskId,
      'Não foi possível solicitar a aprovação: esta solicitação não é válida para o estado atual da tarefa, ou já existe uma solicitação (pendente, aprovada ou rejeitada) do mesmo tipo para esta tarefa.',
    );
  }

  try {
    await createApprovalRequest(supabase, {
      task_id: taskId,
      approval_type: approvalType,
      requested_by: currentUser?.id ?? null,
    });
  } catch (err) {
    failApprovalRequest(taskId, translateApprovalError(err));
  }

  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}?approvalRequested=1`);
}
