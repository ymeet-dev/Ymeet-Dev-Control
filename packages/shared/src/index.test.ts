import { describe, expect, it } from 'vitest';
import { noop } from './index';

describe('shared package', () => {
  it('noop não retorna valor', () => {
    expect(noop()).toBeUndefined();
  });
});
