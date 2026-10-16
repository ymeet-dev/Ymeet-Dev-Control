import { describe, expect, it } from 'vitest';
import { translateTaskStateError } from './taskStateErrors';

/**
 * As strings usadas aqui são exatamente as lançadas por
 * enforce_task_approval_gate em
 * supabase/migrations/20261016103000_task_state_transitions.sql — se a
 * mensagem lá mudar, estes testes devem ser atualizados junto.
 */
describe('translateTaskStateError', () => {
  it('traduz o gate de REJECTED a partir de PENDING_APPROVAL (caso reportado em Staging)', () => {
    const error = new Error(
      'transicao para REJECTED a partir de PENDING_APPROVAL exige approvals.task_approval rejeitado',
    );
    expect(translateTaskStateError(error)).toBe(
      'Não foi possível mudar o estado da tarefa: esta tarefa só pode ser rejeitada depois de uma decisão de rejeição registrada na aprovação correspondente.',
    );
  });

  it('traduz o gate de APPROVED', () => {
    const error = new Error('transicao para APPROVED exige approvals.task_approval aprovado');
    expect(translateTaskStateError(error)).toBe(
      'Não foi possível mudar o estado da tarefa: esta tarefa só pode ser aprovada depois de uma aprovação registrada e já decidida como aprovada.',
    );
  });

  it('traduz o gate de PUBLISHED', () => {
    const error = new Error('transicao para PUBLISHED exige approvals.publish_approval aprovado');
    expect(translateTaskStateError(error)).toBe(
      'Não foi possível mudar o estado da tarefa: esta tarefa só pode ser publicada depois de uma aprovação de publicação registrada e já decidida como aprovada.',
    );
  });

  it('traduz motivo obrigatório para BLOCKED/CANCELLED/REJECTED', () => {
    expect(translateTaskStateError(new Error('transicao para BLOCKED exige motivo'))).toBe(
      'Não foi possível mudar o estado da tarefa: é obrigatório informar um motivo para esta transição.',
    );
    expect(translateTaskStateError(new Error('transicao para CANCELLED exige motivo'))).toContain(
      'motivo para esta transição',
    );
  });

  it('traduz papel sem permissão para BLOCKED/CANCELLED/REJECTED', () => {
    const error = new Error('apenas admin ou pm podem solicitar transicao para CANCELLED');
    expect(translateTaskStateError(error)).toBe(
      'Não foi possível mudar o estado da tarefa: seu papel não tem permissão para solicitar esta transição.',
    );
  });

  it('traduz transição fora do grafo', () => {
    const error = new Error('transicao invalida: BACKLOG -> PUBLISHED nao e permitida');
    expect(translateTaskStateError(error)).toBe(
      'Não foi possível mudar o estado da tarefa: esta transição não é permitida a partir do estado atual da tarefa.',
    );
  });

  it('traduz origem de APPROVED/PUBLISHED inválida como transição não permitida', () => {
    expect(
      translateTaskStateError(new Error('transicao invalida: APPROVED so e permitido a partir de PENDING_APPROVAL')),
    ).toContain('não é permitida a partir do estado atual');
  });

  it('traduz saída de BLOCKED para destino diferente da origem como transição não permitida', () => {
    const error = new Error(
      'transicao invalida: a saida de BLOCKED so e permitida para o estado de origem registrado no historico (IN_DEV)',
    );
    expect(translateTaskStateError(error)).toContain('não é permitida a partir do estado atual');
  });

  it('traduz tarefa não encontrada ou sem permissão', () => {
    const error = new Error('tarefa nao encontrada ou sem permissao para executar esta transicao');
    expect(translateTaskStateError(error)).toBe(
      'Não foi possível mudar o estado da tarefa: não foi possível localizar a tarefa ou você não tem permissão para alterá-la.',
    );
  });

  it('funciona com um PostgrestError-like que não é instanceof Error', () => {
    const postgrestLikeError = { message: 'transicao para REJECTED a partir de PENDING_APPROVAL exige approvals.task_approval rejeitado', code: 'P0001' };
    expect(translateTaskStateError(postgrestLikeError)).toContain('decisão de rejeição registrada');
  });

  it('usa mensagem genérica para erro desconhecido, sem mencionar aprovação', () => {
    const message = translateTaskStateError(new Error('conexao com o banco de dados falhou'));
    expect(message).toBe('Não foi possível mudar o estado da tarefa. Tente novamente ou, se persistir, contate um administrador.');
    expect(message.toLowerCase()).not.toContain('aprova');
  });

  it('usa mensagem genérica quando o erro não tem message nem é Error', () => {
    expect(translateTaskStateError(null)).toContain('Tente novamente');
    expect(translateTaskStateError(undefined)).toContain('Tente novamente');
    expect(translateTaskStateError('string qualquer')).toContain('Tente novamente');
  });

  it('nunca produz o prefixo duplicado "Não foi possível mudar o estado da tarefa" duas vezes', () => {
    const cases = [
      new Error('transicao para REJECTED a partir de PENDING_APPROVAL exige approvals.task_approval rejeitado'),
      new Error('transicao invalida: BACKLOG -> PUBLISHED nao e permitida'),
      new Error('erro totalmente desconhecido'),
    ];
    for (const error of cases) {
      const message = translateTaskStateError(error);
      const occurrences = message.split('Não foi possível mudar o estado da tarefa').length - 1;
      expect(occurrences).toBe(1);
    }
  });
});
