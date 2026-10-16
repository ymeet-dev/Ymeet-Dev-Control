import { describe, expect, it, vi } from 'vitest';
import { transitionTaskState } from './tasks';
import type { TypedSupabaseClient } from '../types';

function fakeSupabaseWithRpc(result: { data?: unknown; error?: unknown }): TypedSupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue(result),
  } as unknown as TypedSupabaseClient;
}

describe('transitionTaskState', () => {
  it('chama a RPC transition_task_state com os parâmetros corretos', async () => {
    const task = { id: 'task-1', state: 'QUEUED' };
    const supabase = fakeSupabaseWithRpc({ data: task, error: null });

    const result = await transitionTaskState(supabase, {
      taskId: 'task-1',
      toState: 'QUEUED',
      reason: null,
    });

    expect(supabase.rpc).toHaveBeenCalledWith('transition_task_state', {
      p_task_id: 'task-1',
      p_to_state: 'QUEUED',
      p_reason: null,
    });
    expect(result).toBe(task);
  });

  it('envia o motivo quando informado', async () => {
    const supabase = fakeSupabaseWithRpc({ data: { id: 'task-1' }, error: null });

    await transitionTaskState(supabase, {
      taskId: 'task-1',
      toState: 'BLOCKED',
      reason: 'Aguardando dependência externa',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('transition_task_state', {
      p_task_id: 'task-1',
      p_to_state: 'BLOCKED',
      p_reason: 'Aguardando dependência externa',
    });
  });

  it('usa null quando reason não é informado', async () => {
    const supabase = fakeSupabaseWithRpc({ data: { id: 'task-1' }, error: null });

    await transitionTaskState(supabase, { taskId: 'task-1', toState: 'IN_DEV' });

    expect(supabase.rpc).toHaveBeenCalledWith('transition_task_state', {
      p_task_id: 'task-1',
      p_to_state: 'IN_DEV',
      p_reason: null,
    });
  });

  it('propaga o erro retornado pelo Postgres (ex.: transição negada pela trigger)', async () => {
    const supabase = fakeSupabaseWithRpc({
      data: null,
      error: new Error('transicao invalida: BACKLOG -> PUBLISHED nao e permitida'),
    });

    await expect(transitionTaskState(supabase, { taskId: 'task-1', toState: 'PUBLISHED' })).rejects.toThrow(
      'transicao invalida',
    );
  });

  it('lança erro próprio se a RPC não retornar a tarefa (sem erro explícito)', async () => {
    const supabase = fakeSupabaseWithRpc({ data: null, error: null });

    await expect(transitionTaskState(supabase, { taskId: 'task-1', toState: 'IN_DEV' })).rejects.toThrow(
      'não retornou a tarefa atualizada',
    );
  });
});
