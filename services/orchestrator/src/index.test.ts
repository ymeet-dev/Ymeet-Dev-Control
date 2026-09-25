import { describe, expect, it } from 'vitest';
import { ORCHESTRATOR_PACKAGE_READY } from './index';

describe('orchestrator package', () => {
  it('a máquina de estados ainda não foi implementada (aguarda etapa futura)', () => {
    expect(ORCHESTRATOR_PACKAGE_READY).toBe(false);
  });
});
