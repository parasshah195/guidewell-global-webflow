import { expect, test } from 'bun:test';

import { matchesOnDemandTest } from './filters';

test('on-demand test names match the selected test without matching another name', () => {
  expect(matchesOnDemandTest('ACT Practice Test', '')).toBe(true);
  expect(matchesOnDemandTest('ACT Practice Test', 'ACT')).toBe(true);
  expect(matchesOnDemandTest('SAT Practice Test', 'ACT')).toBe(false);
  expect(matchesOnDemandTest('SHSAT Practice Test', 'SAT')).toBe(false);
  expect(matchesOnDemandTest('AP Biology', 'AP')).toBe(true);
  expect(matchesOnDemandTest('AP Biology', 'AP Biology')).toBe(true);
  expect(
    matchesOnDemandTest('AP U.S. Government and Politics', 'AP U.S. Government and Politics')
  ).toBe(true);
});
