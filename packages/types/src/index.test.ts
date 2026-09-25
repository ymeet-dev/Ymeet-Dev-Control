import { describe, expect, it } from 'vitest';
import { TYPES_PACKAGE_VERSION } from './index';

describe('types package', () => {
  it('exporta a versão do pacote', () => {
    expect(TYPES_PACKAGE_VERSION).toBe('1.0.0');
  });
});
