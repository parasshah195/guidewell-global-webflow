/**
 * Date/time/price formatting for events. Uses the GLOBAL `dayjs` (initialised once in entry.ts) —
 * never `import dayjs` here, so esbuild's multi-entry build doesn't duplicate the library (PRD §3.5).
 */
import { DEFAULT_TIMEZONE, PROCTORED_TAG, TEST_TOPIC_IDS, VAT_MULTIPLIER } from '$constants';
import type { APIResponse, QueryParams } from '$api/types';
import type { FiltersStore } from '$stores/filters';

export interface EventGroup {
  name: string;
  events: APIResponse[];
  priceSummary: string;
}

/**
 * API `price` is ex-VAT; the frontend always shows VAT-inclusive pricing (PRD §10), so this is
 * applied once at the API boundary (`fetchEvents`) and every consumer of `event.price` gets the
 * inc-VAT figure for free. Non-numeric prices (`null`, empty) pass through unchanged.
 */
export function applyVAT(price: string): string {
  const value = parseFloat(price);
  return isNaN(value) ? price : (value * VAT_MULTIPLIER).toFixed(2);
}

export function isProctored(event: APIResponse): boolean {
  return event.tags.includes(PROCTORED_TAG);
}

export function isMultiDayEvent(event: APIResponse): boolean {
  if (event.type !== 'class' || !event.class_schedule) return false;
  return event.class_schedule.sessions_count > 1;
}

export function getEventDateRange(event: APIResponse): string {
  const days = event.days_of_week.length ? ` (${event.days_of_week.join(', ')})` : '';

  if (isMultiDayEvent(event) && event.class_schedule) {
    const start = window.dayjs
      .tz(event.class_schedule.first_session.starts_at, DEFAULT_TIMEZONE)
      .format('MMM D');
    const end = window.dayjs
      .tz(event.class_schedule.final_session.starts_at, DEFAULT_TIMEZONE)
      .format('MMM D');
    return `${start} - ${end}${days}`;
  }

  if (!event.starts_at) return 'On demand';

  return window.dayjs.tz(event.starts_at, DEFAULT_TIMEZONE).format('MMM D') + days;
}

export function getTimeRange(
  start: string | null,
  end?: string | null,
  includeTimeZone = true
): string {
  if (!start) return '';

  const timeFormat = 'h:mm A';
  const startTime = window.dayjs.tz(start, DEFAULT_TIMEZONE).format(timeFormat);
  const endTime = end ? window.dayjs.tz(end, DEFAULT_TIMEZONE).format(timeFormat) : null;
  const range = endTime ? `${startTime} - ${endTime}` : startTime;

  if (!includeTimeZone) return range;

  return `${range} (${window.dayjs.tz(start, DEFAULT_TIMEZONE).format('z')})`;
}

/**
 * Per-group cost note (CSV #6): "£X" or "£X - £Y" across a list of events.
 */
export function getPriceSummary(events: APIResponse[]): string {
  const prices = events.map((e) => parseFloat(e.price)).filter((p) => !isNaN(p));
  if (!prices.length) return '';

  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return min === max ? `£${min}` : `£${min} - £${max}`;
}

/**
 * Maps the `filters` store state → API query params (PRD §8). Pure over `f` and `baseParams`
 * (only external dep is the global `window.dayjs` for the date branches).
 */
export function buildQueryFromFilters(
  f: FiltersStore,
  baseParams: QueryParams
): Partial<QueryParams> {
  const params: Partial<QueryParams> = {};

  if (f.tests.length) {
    params.topics = f.tests.flatMap((t) => TEST_TOPIC_IDS[t] ?? []);
  }
  if (f.location !== 'both') {
    params.is_online = f.location === 'online';
  }
  if (f.dateAfter) {
    params.after = window.dayjs.tz(f.dateAfter, DEFAULT_TIMEZONE).toISOString();
    params.timezone = DEFAULT_TIMEZONE;
  }
  if (f.dateBefore) {
    params.before = window.dayjs.tz(f.dateBefore, DEFAULT_TIMEZONE).toISOString();
    params.timezone = DEFAULT_TIMEZONE;
  }
  if (f.extendedTime) {
    params.extended_time_available = true;
  }
  if (f.daysOfWeek.length) {
    params.days_of_week = f.daysOfWeek;
  }
  if (f.proctored) {
    // 'tags' is confirmed server-side (returns exact matches, respects limit/start) — the
    // API has no dedicated proctored field/param, so this is the only reliable way to filter
    // without breaking pagination (fetch-all-then-filter can't guarantee a controlled count).
    params.tags = [...(baseParams.tags ?? []), PROCTORED_TAG];
  }

  return params;
}

/**
 * Buckets events by `location_name` (CSV #6) with Online / Online (On Demand) fallbacks, ranks
 * named venues first, and attaches a per-group price summary.
 */
export function groupEventsByLocation(events: APIResponse[]): EventGroup[] {
  const buckets = new Map<string, APIResponse[]>();
  for (const event of events) {
    const name = event.location_name ?? (event.starts_at ? 'Online' : 'Online (On Demand)');
    if (!buckets.has(name)) buckets.set(name, []);
    buckets.get(name)?.push(event);
  }

  const names = [...buckets.keys()].sort((a, b) => {
    const rank = (n: string) => (n === 'Online' ? 1 : n === 'Online (On Demand)' ? 2 : 0);
    return rank(a) - rank(b);
  });

  return names.map((name) => {
    const events = buckets.get(name) ?? [];
    return { name, events, priceSummary: getPriceSummary(events) };
  });
}

/**
 * Drops events whose topics intersect `data-topics-exclude` (comma-separated list on `el`).
 */
export function filterExcludedTopics(el: HTMLElement, events: APIResponse[]): APIResponse[] {
  const excludeAttr = el.getAttribute('data-topics-exclude');
  if (!excludeAttr) return events;

  const excluded = excludeAttr.split(',').map((t) => t.trim());
  return events.filter((event) => !event.topics.some((topic) => excluded.includes(topic)));
}
