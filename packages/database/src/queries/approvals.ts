import type { ApprovalType, Tables, TypedSupabaseClient } from '../types';

export type ApprovalRow = Tables<'approvals'>;

/** Sujeito à policy approvals_select (qualquer profile autenticado). */
export async function listTaskApprovals(supabase: TypedSupabaseClient, taskId: string): Promise<ApprovalRow[]> {
  const { data, error } = await supabase
    .from('approvals')
    .select('*')
    .eq('task_id', taskId)
    .order('requested_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export interface NewApprovalRequestInput {
  task_id: string;
  approval_type: ApprovalType;
  requested_by: string | null;
}

/**
 * Cria a solicitação (decision nasce 'pending', pelo default da coluna).
 * Sujeito à policy approvals_insert (admin/pm) — quem chama já deve ter
 * validado papel e estado da tarefa via approvalRules antes de chegar aqui;
 * esta função não repete essa validação, só propaga o erro do Postgres se a
 * policy recusar.
 */
export async function createApprovalRequest(
  supabase: TypedSupabaseClient,
  input: NewApprovalRequestInput,
): Promise<ApprovalRow> {
  const { data, error } = await supabase.from('approvals').insert(input).select('*').single();

  if (error) throw error;
  return data;
}
