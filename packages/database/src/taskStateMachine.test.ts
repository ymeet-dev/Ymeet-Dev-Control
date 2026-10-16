import { describe, expect, it } from 'vitest';
import {
  getAllowedNextStates,
  getBlockedOriginState,
  requiresTransitionReason,
  TASK_STATE_TRANSITION_RULES,
} from './taskStateMachine';
import type { ProfileRole, TaskState } from './types';

describe('requiresTransitionReason', () => {
  it('exige motivo para BLOCKED, CANCELLED e REJECTED', () => {
    expect(requiresTransitionReason('BLOCKED')).toBe(true);
    expect(requiresTransitionReason('CANCELLED')).toBe(true);
    expect(requiresTransitionReason('REJECTED')).toBe(true);
  });

  it('não exige motivo para transições operacionais', () => {
    expect(requiresTransitionReason('QUEUED')).toBe(false);
    expect(requiresTransitionReason('IN_DEV')).toBe(false);
    expect(requiresTransitionReason('APPROVED')).toBe(false);
    expect(requiresTransitionReason('PUBLISHED')).toBe(false);
  });
});

describe('getBlockedOriginState', () => {
  it('retorna o from_state da transição mais recente para BLOCKED', () => {
    const history = [
      { to_state: 'BLOCKED', from_state: 'IN_DEV' },
      { to_state: 'IN_DEV', from_state: 'QUEUED' },
    ];
    expect(getBlockedOriginState(history)).toBe('IN_DEV');
  });

  it('retorna null quando não há nenhuma entrada em BLOCKED no histórico', () => {
    const history = [{ to_state: 'IN_DEV', from_state: 'QUEUED' }];
    expect(getBlockedOriginState(history)).toBeNull();
  });

  it('retorna null para histórico vazio', () => {
    expect(getBlockedOriginState([])).toBeNull();
  });
});

describe('getAllowedNextStates', () => {
  const operationalRoles: ProfileRole[] = ['admin', 'pm', 'developer'];

  it.each(operationalRoles)('admin/pm/developer (%s): transições operacionais do grafo estático', (role) => {
    expect(getAllowedNextStates('BACKLOG', role)).toEqual(expect.arrayContaining(['QUEUED']));
    expect(getAllowedNextStates('IN_AUDIT', role)).toEqual(expect.arrayContaining(['IN_QA', 'CHANGES_REQUESTED']));
    expect(getAllowedNextStates('CHANGES_REQUESTED', role)).toContain('IN_DEV');
  });

  it('nunca inclui um par fora de TASK_STATE_TRANSITION_RULES para estados não bloqueados', () => {
    const allTargets = getAllowedNextStates('IN_DEV', 'admin');
    for (const to of allTargets) {
      expect(TASK_STATE_TRANSITION_RULES.some((rule) => rule.from === 'IN_DEV' && rule.to === to)).toBe(true);
    }
  });

  it('developer não pode solicitar BLOCKED, CANCELLED ou REJECTED', () => {
    expect(getAllowedNextStates('IN_DEV', 'developer')).not.toContain('BLOCKED');
    expect(getAllowedNextStates('IN_DEV', 'developer')).not.toContain('CANCELLED');
    expect(getAllowedNextStates('IN_AUDIT', 'developer')).not.toContain('REJECTED');
  });

  it('admin e pm podem solicitar BLOCKED, CANCELLED e REJECTED quando o grafo permite', () => {
    expect(getAllowedNextStates('IN_DEV', 'admin')).toContain('BLOCKED');
    expect(getAllowedNextStates('IN_DEV', 'pm')).toContain('CANCELLED');
    expect(getAllowedNextStates('IN_QA', 'admin')).toContain('REJECTED');
  });

  it('developer continua podendo seguir o fluxo operacional normalmente', () => {
    expect(getAllowedNextStates('IN_DEV', 'developer')).toContain('IN_AUDIT');
  });

  it('approver e viewer nunca recebem nenhuma transição', () => {
    expect(getAllowedNextStates('BACKLOG', 'approver')).toEqual([]);
    expect(getAllowedNextStates('BACKLOG', 'viewer')).toEqual([]);
  });

  it('papel nulo ou ausente não recebe nenhuma transição', () => {
    expect(getAllowedNextStates('BACKLOG', null)).toEqual([]);
    expect(getAllowedNextStates('BACKLOG', undefined)).toEqual([]);
  });

  it('estados terminais (PUBLISHED, CANCELLED, REJECTED) não têm nenhuma transição de saída', () => {
    const terminalStates: TaskState[] = ['PUBLISHED', 'CANCELLED', 'REJECTED'];
    for (const state of terminalStates) {
      expect(getAllowedNextStates(state, 'admin')).toEqual([]);
    }
  });

  it('BLOCKED só oferece o estado de origem informado, para os papéis com permissão', () => {
    expect(getAllowedNextStates('BLOCKED', 'admin', 'IN_DEV')).toEqual(['IN_DEV']);
    expect(getAllowedNextStates('BLOCKED', 'developer', 'PENDING_APPROVAL')).toEqual(['PENDING_APPROVAL']);
  });

  it('BLOCKED sem origem registrada no histórico não oferece nenhuma transição', () => {
    expect(getAllowedNextStates('BLOCKED', 'admin', null)).toEqual([]);
    expect(getAllowedNextStates('BLOCKED', 'admin')).toEqual([]);
  });

  it('BLOCKED nunca oferece CANCELLED/REJECTED direto, mesmo para admin/pm', () => {
    const allowed = getAllowedNextStates('BLOCKED', 'admin', 'IN_DEV');
    expect(allowed).not.toContain('CANCELLED');
    expect(allowed).not.toContain('REJECTED');
  });
});
