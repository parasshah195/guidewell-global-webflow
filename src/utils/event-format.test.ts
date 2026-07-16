import { expect, test } from 'bun:test';

import { applyVAT } from './event-format';

test('applyVAT adds 20% VAT to an ex-VAT price', () => {
  expect(applyVAT('100')).toBe('120.00');
  expect(applyVAT('687.50')).toBe('825.00');
});

test('applyVAT passes non-numeric prices through unchanged', () => {
  expect(applyVAT('')).toBe('');
  expect(applyVAT('n/a')).toBe('n/a');
});
