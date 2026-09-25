import { describe, expect, it } from 'vitest';
import { DATABASE_PACKAGE_READY } from './index';

describe('database package', () => {
  it('ainda não está configurado (aguarda Fase 2+)', () => {
    expect(DATABASE_PACKAGE_READY).toBe(false);
  });
});
