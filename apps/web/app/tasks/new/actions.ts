'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createTask, createTaskDependencies, type NewTaskDependencyInput, type TaskRow } from 'database';
import { getServerSupabaseClient } from '../../../lib/supabase/server';

/** Toda tarefa nova começa em BACKLOG — o usuário não escolhe o estado inicial (ver trigger enforce_task_approval_gate). */
const INITIAL_TASK_STATE = 'BACKLOG' as const;

function failNewTaskForm(message: string): never {
  redirect(`/tasks/new?error=${encodeURIComponent(message)}`);
}

export async function createTaskAction(formData: FormData): Promise<void> {
  const projectId = String(formData.get('project_id') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim();
  const priorityRaw = String(formData.get('priority') ?? '0').trim();
  const blocksIds = formData.getAll('blocks').map(String).filter(Boolean);
  const relatesToIds = formData.getAll('relates_to').map(String).filter(Boolean);

  if (!projectId || !title) {
    failNewTaskForm('Projeto e título são obrigatórios.');
  }

  const priority = Number.parseInt(priorityRaw, 10);
  if (!Number.isFinite(priority)) {
    failNewTaskForm('Prioridade inválida — informe um número inteiro.');
  }

  const overlap = blocksIds.filter((id) => relatesToIds.includes(id));
  if (overlap.length > 0) {
    failNewTaskForm('Uma tarefa não pode ser selecionada em "Bloqueada por" e "Relaciona-se com" ao mesmo tempo.');
  }

  const supabase = await getServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let task: TaskRow;
  try {
    task = await createTask(supabase, {
      project_id: projectId,
      title,
      state: INITIAL_TASK_STATE,
      priority,
      created_by: user?.id ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Não foi possível criar a tarefa.';
    failNewTaskForm(message);
  }

  revalidatePath('/tasks');

  const dependencyRows: NewTaskDependencyInput[] = [
    ...blocksIds.map((dependsOnTaskId) => ({
      task_id: task.id,
      depends_on_task_id: dependsOnTaskId,
      dependency_type: 'blocks' as const,
    })),
    ...relatesToIds.map((dependsOnTaskId) => ({
      task_id: task.id,
      depends_on_task_id: dependsOnTaskId,
      dependency_type: 'relates_to' as const,
    })),
  ];

  if (dependencyRows.length > 0) {
    try {
      await createTaskDependencies(supabase, dependencyRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar dependências.';
      redirect(`/tasks/${task.id}?created=1&dependencyError=${encodeURIComponent(message)}`);
    }
  }

  redirect(`/tasks/${task.id}?created=1`);
}
