import { expect, test } from 'bun:test';

import { arrayCheck, parseAttrValue } from './event-attrs';

test('parseAttrValue coerces by shape', () => {
  expect(parseAttrValue('12')).toBe(12);
  expect(parseAttrValue('2026-07-01')).toBeInstanceOf(Date);
  expect(parseAttrValue('true')).toBe(true);
  expect(parseAttrValue('false')).toBe(false);
  expect(parseAttrValue("['SAT','ACT']")).toEqual(['SAT', 'ACT']);
  expect(parseAttrValue('marketing_event')).toBe('marketing_event');
});

test('parseAttrValue documents the shape-coercion ceiling', () => {
  // all-digit runs coerce to number; leading zeros collapse via Number()
  expect(parseAttrValue('007')).toBe(7);
  // ponytail ceiling: Date.parse is loose — '-5' becomes a Date, not a string. Upgrade to
  // per-key typed coercion (event-attrs.ts) if a real attr value ever hits this trap.
  expect(parseAttrValue('-5')).toBeInstanceOf(Date);
});

test('arrayCheck parses quoted arrays and falls back to the raw string', () => {
  expect(arrayCheck("['SAT','ACT']")).toEqual(['SAT', 'ACT']);
  expect(arrayCheck('[1, 2, 3]')).toEqual([1, 2, 3]);
  expect(arrayCheck('{"a":1}')).toBe('{"a":1}'); // valid JSON but not an array → raw string
  expect(arrayCheck('not-an-array')).toBe('not-an-array'); // parse throws → raw string
});
