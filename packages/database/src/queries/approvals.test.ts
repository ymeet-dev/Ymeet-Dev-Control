import { describe, expect, it, vi } from 'vitest';
import { createApprovalRequest, listTaskApprovals } from './approvals';
import type { TypedSupabaseClient } from '../types';

function fakeSupabase(methodName: 'select' | 'insert', result: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockResolvedValue(result);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(result);

  return {
    from: vi.fn().mockReturnValue(chain),
    __chain: chain,
  } as unknown as TypedSupabaseClient & { __chain: typeof chain };
}

describe('listTaskApprovals', () => {
  it('consulta approvals filtrando por task_id, ordenado por requested_at desc', async () => {
    const rows = [{ id: 'a1', task_id: 'task-1', approval_type: 'task_approval', decision: 'pending' }];
    const supabase = fakeSupabase('select', { data: rows, error: null });

    const result = await listTaskApprovals(supabase, 'task-1');

    expect(supabase.from).toHaveBeenCalledWith('approvals');
    expect(supabase.__chain.eq).toHaveBeenCalledWith('task_id', 'task-1');
    expect(supabase.__chain.order).toHaveBeenCalledWith('requested_at', { ascending: false });
    expect(result).toBe(rows);
  });

  it('retorna lista vazia quando data é null', async () => {
    const supabase = fakeSupabase('select', { data: null, error: null });
    expect(await listTaskApprovals(supabase, 'task-1')).toEqual([]);
  });

  it('propaga erro do Postgres', async () => {
    const supabase = fakeSupabase('select', { data: null, error: new Error('falhou') });
    await expect(listTaskApprovals(supabase, 'task-1')).rejects.toThrow('falhou');
  });
});

describe('createApprovalRequest', () => {
  it('insere e retorna a linha criada', async () => {
    const row = { id: 'a1', task_id: 'task-1', approval_type: 'task_approval', decision: 'pending' };
    const supabase = fakeSupabase('insert', { data: row, error: null });

    const result = await createApprovalRequest(supabase, {
      task_id: 'task-1',
      approval_type: 'task_approval',
      requested_by: 'user-1',
    });

    expect(supabase.from).toHaveBeenCalledWith('approvals');
    expect(supabase.__chain.insert).toHaveBeenCalledWith({
      task_id: 'task-1',
      approval_type: 'task_approval',
      requested_by: 'user-1',
    });
    expect(result).toBe(row);
  });

  it('propaga erro do Postgres (ex.: RLS recusando o insert)', async () => {
    const supabase = fakeSupabase('insert', { data: null, error: new Error('violates row-level security policy') });

    await expect(
      createApprovalRequest(supabase, { task_id: 'task-1', approval_type: 'task_approval', requested_by: 'user-1' }),
    ).rejects.toThrow('row-level security');
  });

  it('propaga a exceção YM001 da trigger enforce_approval_lifecycle (inserção direta com decisão final)', async () => {
    const errorYM001 = {
      message: 'aprovacao_deve_iniciar_pending: uma nova solicitacao de aprovacao deve comecar com decision = pending',
      code: 'YM001',
    };
    const supabase = fakeSupabase('insert', { data: null, error: errorYM001 });

    await expect(
      createApprovalRequest(supabase, { task_id: 'task-1', approval_type: 'task_approval', requested_by: 'user-1' }),
    ).rejects.toMatchObject({ code: 'YM001' });
  });

  it('propaga a exceção YM002 da trigger enforce_approval_lifecycle (nova solicitação após decisão final)', async () => {
    const errorYM002 = {
      message: 'aprovacao_final_ja_existe: ja existe uma decisao final (approved ou rejected) para este tipo de aprovacao nesta tarefa',
      code: 'YM002',
    };
    const supabase = fakeSupabase('insert', { data: null, error: errorYM002 });

    await expect(
      createApprovalRequest(supabase, { task_id: 'task-1', approval_type: 'task_approval', requested_by: 'user-1' }),
    ).rejects.toMatchObject({ code: 'YM002' });
  });
});
