import { describe, expect, it } from 'vitest';
import { canRequestApproval, getRequestableApprovalType } from './approvalRules';
import type { ProfileRole } from './types';

describe('canRequestApproval', () => {
  it('permite admin e pm', () => {
    expect(canRequestApproval('admin')).toBe(true);
    expect(canRequestApproval('pm')).toBe(true);
  });

  it('nega developer, approver, viewer, nulo e ausente', () => {
    const denied: Array<ProfileRole | null | undefined> = ['developer', 'approver', 'viewer', null, undefined];
    for (const role of denied) {
      expect(canRequestApproval(role)).toBe(false);
    }
  });
});

describe('getRequestableApprovalType', () => {
  it('retorna task_approval quando o estado é PENDING_APPROVAL e não há nenhuma solicitação ainda', () => {
    expect(getRequestableApprovalType('PENDING_APPROVAL', [])).toBe('task_approval');
  });

  it('retorna publish_approval quando o estado é READY_TO_PUBLISH e não há nenhuma solicitação ainda', () => {
    expect(getRequestableApprovalType('READY_TO_PUBLISH', [])).toBe('publish_approval');
  });

  it('retorna null para qualquer estado que não usa aprovação', () => {
    expect(getRequestableApprovalType('BACKLOG', [])).toBeNull();
    expect(getRequestableApprovalType('IN_DEV', [])).toBeNull();
    expect(getRequestableApprovalType('APPROVED', [])).toBeNull();
    expect(getRequestableApprovalType('PUBLISHED', [])).toBeNull();
    expect(getRequestableApprovalType('BLOCKED', [])).toBeNull();
  });

  // Regra A — aprovação pendente
  it('bloqueia nova solicitação quando já existe uma pending do mesmo tipo', () => {
    const existing = [{ approval_type: 'task_approval' as const, decision: 'pending' as const }];
    expect(getRequestableApprovalType('PENDING_APPROVAL', existing)).toBeNull();
  });

  // Regra B — aprovação já concedida, ainda não consumida
  it('bloqueia nova solicitação quando já existe uma approved do mesmo tipo (ainda não consumida pelo estado atual)', () => {
    const existing = [{ approval_type: 'task_approval' as const, decision: 'approved' as const }];
    expect(getRequestableApprovalType('PENDING_APPROVAL', existing)).toBeNull();

    const existingPublish = [{ approval_type: 'publish_approval' as const, decision: 'approved' as const }];
    expect(getRequestableApprovalType('READY_TO_PUBLISH', existingPublish)).toBeNull();
  });

  // Regra C — aprovação rejeitada (sem caminho de retrabalho de volta ao gate)
  it('bloqueia permanentemente nova solicitação de task_approval após uma rejected — exige tarefa nova', () => {
    const existing = [{ approval_type: 'task_approval' as const, decision: 'rejected' as const }];
    expect(getRequestableApprovalType('PENDING_APPROVAL', existing)).toBeNull();
  });

  it('bloqueia permanentemente nova solicitação de publish_approval após uma rejected (grafo não oferece retrabalho de publicação)', () => {
    const existing = [{ approval_type: 'publish_approval' as const, decision: 'rejected' as const }];
    expect(getRequestableApprovalType('READY_TO_PUBLISH', existing)).toBeNull();
  });

  // Regra D — BLOCKED -> PENDING_APPROVAL não é um novo ciclo
  it('BLOCKED -> PENDING_APPROVAL não reabilita uma solicitação anteriormente rejeitada (mesmo histórico de approvals, sem usar timestamps)', () => {
    // Simula o estado depois de PENDING_APPROVAL -> BLOCKED -> PENDING_APPROVAL de novo:
    // a lista de approvals não muda com o bloqueio/desbloqueio, e a função nunca olha
    // task_state_transitions — então o resultado tem que ser o mesmo de antes do ciclo.
    const existingAfterUnblock = [{ approval_type: 'task_approval' as const, decision: 'rejected' as const }];
    expect(getRequestableApprovalType('PENDING_APPROVAL', existingAfterUnblock)).toBeNull();
  });

  it('pendente/concedida/rejeitada de um tipo não bloqueia a solicitação do outro tipo', () => {
    const pendingPublish = [{ approval_type: 'publish_approval' as const, decision: 'pending' as const }];
    expect(getRequestableApprovalType('PENDING_APPROVAL', pendingPublish)).toBe('task_approval');

    const rejectedTask = [{ approval_type: 'task_approval' as const, decision: 'rejected' as const }];
    expect(getRequestableApprovalType('READY_TO_PUBLISH', rejectedTask)).toBe('publish_approval');
  });
});
