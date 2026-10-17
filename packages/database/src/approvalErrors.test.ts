import { describe, expect, it } from 'vitest';
import { translateApprovalError } from './approvalErrors';

describe('translateApprovalError', () => {
  it('traduz violação de RLS como falta de permissão de papel', () => {
    const error = new Error('new row violates row-level security policy for table "approvals"');
    expect(translateApprovalError(error)).toBe(
      'Não foi possível solicitar a aprovação: seu papel não tem permissão para solicitar este tipo de aprovação.',
    );
  });

  it('funciona com um objeto PostgrestError-like que não é instanceof Error', () => {
    const postgrestLikeError = { message: 'new row violates row-level security policy', code: '42501' };
    expect(translateApprovalError(postgrestLikeError)).toContain('não tem permissão');
  });

  it('traduz a violação do índice único approvals_one_pending_per_task_type como solicitação duplicada', () => {
    const error = {
      message: 'duplicate key value violates unique constraint "approvals_one_pending_per_task_type"',
      code: '23505',
      details: 'Key (task_id, approval_type)=(...) already exists.',
    };
    expect(translateApprovalError(error)).toBe(
      'Não foi possível solicitar a aprovação: já existe uma solicitação de aprovação pendente deste tipo para esta tarefa.',
    );
  });

  it('não classifica um 23505 de outra constraint como duplicata de aprovação', () => {
    const error = {
      message: 'duplicate key value violates unique constraint "tasks_pkey"',
      code: '23505',
    };
    const message = translateApprovalError(error);
    expect(message).not.toContain('já existe uma solicitação de aprovação pendente');
    expect(message).toBe(
      'Não foi possível solicitar a aprovação. Tente novamente ou, se persistir, contate um administrador.',
    );
  });

  it('não classifica o nome da constraint como duplicata se o code não for 23505', () => {
    const error = { message: 'approvals_one_pending_per_task_type mencionado sem ser a violação real', code: 'XX000' };
    expect(translateApprovalError(error)).not.toContain('já existe uma solicitação de aprovação pendente');
  });

  it('traduz YM001 (trigger enforce_approval_lifecycle) como exigência de nascer pending', () => {
    const error = {
      message: 'aprovacao_deve_iniciar_pending: uma nova solicitacao de aprovacao deve comecar com decision = pending',
      code: 'YM001',
    };
    expect(translateApprovalError(error)).toBe(
      'Não foi possível solicitar a aprovação: esta solicitação precisa começar como pendente — não é possível criar uma aprovação já decidida.',
    );
  });

  it('traduz YM002 (trigger enforce_approval_lifecycle) como decisão final já existente, para approved ou rejected', () => {
    const errorApproved = {
      message: 'aprovacao_final_ja_existe: ja existe uma decisao final (approved ou rejected) para este tipo de aprovacao nesta tarefa',
      code: 'YM002',
    };
    expect(translateApprovalError(errorApproved)).toBe(
      'Não foi possível solicitar a aprovação: esta tarefa já tem uma decisão registrada para este tipo de aprovação — não é possível solicitar de novo.',
    );
  });

  it('traduz YM003 (trigger enforce_approval_lifecycle) como decisão final imutável', () => {
    const error = {
      message: 'aprovacao_decisao_final_imutavel: uma decisao final (approved ou rejected) nao pode ser alterada',
      code: 'YM003',
    };
    expect(translateApprovalError(error)).toBe(
      'Não foi possível solicitar a aprovação: não é possível alterar uma decisão de aprovação já finalizada.',
    );
  });

  it('reconhece violação de RLS pelo código 42501, mesmo sem a frase padrão na mensagem', () => {
    const error = { message: 'qualquer outra mensagem', code: '42501' };
    expect(translateApprovalError(error)).toBe(
      'Não foi possível solicitar a aprovação: seu papel não tem permissão para solicitar este tipo de aprovação.',
    );
  });

  it('usa mensagem genérica para erro desconhecido, sem mencionar aprovação duplicada ou papel', () => {
    const message = translateApprovalError(new Error('conexao com o banco de dados falhou'));
    expect(message).toBe(
      'Não foi possível solicitar a aprovação. Tente novamente ou, se persistir, contate um administrador.',
    );
  });

  it('usa mensagem genérica quando não há message nem é Error', () => {
    expect(translateApprovalError(null)).toContain('Tente novamente');
    expect(translateApprovalError(undefined)).toContain('Tente novamente');
    expect(translateApprovalError('string qualquer')).toContain('Tente novamente');
  });
});
