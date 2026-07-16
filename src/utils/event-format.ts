/**
 * Date/time/price formatting for events. Uses the GLOBAL `dayjs` (initialised once in entry.ts) —
 * never `import dayjs` here, so esbuild's multi-entry build doesn't duplicate the library (PRD §3.5).
 */
import { DEFAULT_TIMEZONE, PROCTORED_TAG, VAT_MULTIPLIER } from '$constants';
import type { APIResponse } from '$api/types';

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
 * Drops events whose topics intersect `data-topics-exclude` (comma-separated list on `el`).
 */
export function filterExcludedTopics(el: HTMLElement, events: APIResponse[]): APIResponse[] {
  const excludeAttr = el.getAttribute('data-topics-exclude');
  if (!excludeAttr) return events;

  const excluded = excludeAttr.split(',').map((t) => t.trim());
  return events.filter((event) => !event.topics.some((topic) => excluded.includes(topic)));
}
