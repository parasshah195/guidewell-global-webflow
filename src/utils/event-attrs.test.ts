import { expect, test } from 'bun:test';

import { parseAttrValue } from './event-attrs';

test('parseAttrValue coerces by shape', () => {
  expect(parseAttrValue('12')).toBe(12);
  expect(parseAttrValue('2026-07-01')).toBeInstanceOf(Date);
  expect(parseAttrValue('true')).toBe(true);
  expect(parseAttrValue('false')).toBe(false);
  expect(parseAttrValue("['SAT','ACT']")).toEqual(['SAT', 'ACT']);
  expect(parseAttrValue('marketing_event')).toBe('marketing_event');
});
