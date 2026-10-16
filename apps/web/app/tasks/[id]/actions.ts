'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { transitionTaskState, translateTaskStateError, type TaskState } from 'database';
import { getServerSupabaseClient } from '../../../lib/supabase/server';

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
