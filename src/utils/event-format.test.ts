import { expect, test } from 'bun:test';

import type { APIResponse } from '$api/types';
import type { FiltersStore } from '$stores/filters';

import {
  applyVAT,
  buildQueryFromFilters,
  getEventDateRange,
  getPriceSummary,
  getTimeRange,
  groupEventsByLocation,
  isMultiDayEvent,
  isProctored,
} from './event-format';

// Minimal APIResponse / FiltersStore builders — only the fields under test are meaningful.
function evt(p: Partial<APIResponse> = {}): APIResponse {
  return {
    id: 1,
    name: '',
    type: 'class',
    description: '',
    event_code: '',
    is_online: false,
    starts_at: null,
    ends_at: null,
    price: '0',
    tags: [],
    markets: [],
    topics: [],
    days_of_week: [],
    address: null,
    presenters: null,
    location_id: null,
    location_name: null,
    google_maps_url: '',
    extended_time_available: null,
    event_page_url: '',
    ...p,
  } as APIResponse;
}

function filters(p: Partial<FiltersStore> = {}): FiltersStore {
  return {
    tests: [],
    location: 'both',
    dateAfter: null,
    dateBefore: null,
    extendedTime: false,
    daysOfWeek: [],
    proctored: false,
    init() {},
    toggleTest() {},
    toggleDay() {},
    reset() {},
    ...p,
  } as FiltersStore;
}

test('applyVAT adds 20% VAT to an ex-VAT price', () => {
  expect(applyVAT('100')).toBe('120.00');
  expect(applyVAT('687.50')).toBe('825.00');
});

test('applyVAT rounds to two decimals', () => {
  // 99.99 * 1.2 = 119.988 → 119.99
  expect(applyVAT('99.99')).toBe('119.99');
});

test('applyVAT passes non-numeric prices through unchanged', () => {
  expect(applyVAT('')).toBe('');
  expect(applyVAT('n/a')).toBe('n/a');
});

test('getPriceSummary formats a single, a range, and empty', () => {
  expect(getPriceSummary([])).toBe('');
  expect(getPriceSummary([evt({ price: '100' })])).toBe('$100');
  expect(getPriceSummary([evt({ price: '100' }), evt({ price: '250' })])).toBe('$100 - $250');
});

test('getPriceSummary ignores non-numeric prices', () => {
  expect(getPriceSummary([evt({ price: 'n/a' }), evt({ price: '50' })])).toBe('$50');
  expect(getPriceSummary([evt({ price: 'n/a' })])).toBe('');
});

test('getPriceSummary treats null/0 price as Free', () => {
  expect(getPriceSummary([evt({ price: null as unknown as string })])).toBe('Free');
  expect(getPriceSummary([evt({ price: '0' })])).toBe('Free');
  expect(getPriceSummary([evt({ price: null as unknown as string }), evt({ price: '50' })])).toBe(
    'Free - $50'
  );
});

test('isProctored checks the Proctored tag', () => {
  expect(isProctored(evt({ tags: ['Proctored'] }))).toBe(true);
  expect(isProctored(evt({ tags: ['Other'] }))).toBe(false);
});

test('isMultiDayEvent needs a class with >1 sessions', () => {
  const schedule = (sessions_count: number) =>
    ({ sessions_count } as NonNullable<APIResponse['class_schedule']>);
  expect(isMultiDayEvent(evt({ type: 'class', class_schedule: schedule(2) }))).toBe(true);
  expect(isMultiDayEvent(evt({ type: 'class', class_schedule: schedule(1) }))).toBe(false);
  expect(isMultiDayEvent(evt({ type: 'class', class_schedule: null }))).toBe(false);
  expect(isMultiDayEvent(evt({ type: 'marketing_event', class_schedule: schedule(2) }))).toBe(
    false
  );
});

test('buildQueryFromFilters maps tests → topic IDs (unknown keys drop)', () => {
  expect(buildQueryFromFilters(filters({ tests: ['SAT'] }), {}).topics).toEqual([1134]);
  expect(buildQueryFromFilters(filters({ tests: ['SAT', 'ACT'] }), {}).topics).toEqual([1134, 1049]);
  expect(buildQueryFromFilters(filters({ tests: ['NOPE'] }), {}).topics).toEqual([]);
});

test('buildQueryFromFilters maps location → is_online', () => {
  expect('is_online' in buildQueryFromFilters(filters({ location: 'both' }), {})).toBe(false);
  expect(buildQueryFromFilters(filters({ location: 'online' }), {}).is_online).toBe(true);
  expect(buildQueryFromFilters(filters({ location: 'in-person' }), {}).is_online).toBe(false);
});

test('buildQueryFromFilters maps the simple flags', () => {
  const p = buildQueryFromFilters(filters({ extendedTime: true, daysOfWeek: ['Mon', 'Wed'] }), {});
  expect(p.extended_time_available).toBe(true);
  expect(p.days_of_week).toEqual(['Mon', 'Wed']);
});

test('buildQueryFromFilters appends the Proctored tag onto baseParams.tags', () => {
  expect(buildQueryFromFilters(filters({ proctored: true }), { tags: ['GWG'] }).tags).toEqual([
    'GWG',
    'Proctored',
  ]);
  expect(buildQueryFromFilters(filters({ proctored: true }), {}).tags).toEqual(['Proctored']);
});

test('buildQueryFromFilters sets ISO date + timezone (value math is dayjs)', () => {
  const p = buildQueryFromFilters(
    filters({ dateAfter: '2026-07-01', dateBefore: '2026-07-31' }),
    {}
  );
  expect(p.timezone).toBe('Europe/London');
  expect(p.after).toMatch(/Z$/);
  expect(p.before).toMatch(/Z$/);
});

test('buildQueryFromFilters returns {} for the default (empty) filter state', () => {
  expect(buildQueryFromFilters(filters(), {})).toEqual({});
});

test('groupEventsByLocation buckets, falls back, and ranks', () => {
  const groups = groupEventsByLocation([
    evt({ location_name: 'London' }),
    evt({ location_name: null, starts_at: '2026-07-01T09:00:00Z' }), // → Online
    evt({ location_name: null, starts_at: null }), // → Online (On Demand)
  ]);
  expect(groups.map((g) => g.name)).toEqual(['London', 'Online', 'Online (On Demand)']);
});

test('groupEventsByLocation attaches a per-group price summary', () => {
  const groups = groupEventsByLocation([
    evt({ location_name: 'London', price: '100' }),
    evt({ location_name: 'London', price: '250' }),
  ]);
  expect(groups[0].priceSummary).toBe('$100 - $250');
});

test('getEventDateRange handles on-demand, single, multi-day + days suffix', () => {
  expect(getEventDateRange(evt({ starts_at: null }))).toBe('On demand');
  expect(getEventDateRange(evt({ starts_at: '2026-07-01T09:00:00Z' }))).toBe('Jul 1');
  expect(getEventDateRange(evt({ starts_at: '2026-07-01T09:00:00Z', days_of_week: ['Mon'] }))).toBe(
    'Jul 1 (Mon)'
  );

  const multiDay = evt({
    type: 'class',
    class_schedule: {
      sessions_count: 3,
      first_session: { starts_at: '2026-07-01T09:00:00Z' },
      final_session: { starts_at: '2026-07-15T09:00:00Z' },
    } as NonNullable<APIResponse['class_schedule']>,
  });
  expect(getEventDateRange(multiDay)).toBe('Jul 1 - Jul 15');
});

test('getTimeRange formats start-only, a range, and empty', () => {
  // absolute clock time depends on the runtime's tz data (offset), so assert format not offset:
  // empty guard, single "h:mm AM/PM", and a " - "-joined range when an end is given.
  expect(getTimeRange(null)).toBe('');
  expect(getTimeRange('2026-07-01T09:00:00Z', null, false)).toMatch(/^\d{1,2}:\d{2} [AP]M$/);
  expect(getTimeRange('2026-07-01T09:00:00Z', '2026-07-01T10:30:00Z', false)).toMatch(
    /^\d{1,2}:\d{2} [AP]M - \d{1,2}:\d{2} [AP]M$/
  );
});

test('getTimeRange appends a timezone abbreviation by default', () => {
  expect(getTimeRange('2026-07-01T09:00:00Z')).toMatch(/^\d{1,2}:\d{2} [AP]M \(.+\)$/);
});
