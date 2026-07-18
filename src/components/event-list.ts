/**
 * The only events component (PRD §3.1, §8) — every feed (Home, Practice Tests, Group Classes,
 * Webinars, Events page) is one of these, configured entirely by `query-*`/`data-*` attributes.
 * Registers on `alpine:init` using the global `window.Alpine` — never imports Alpine (PRD §3.4).
 */
import { fetchEvents } from '$api/events';
import type { APIResponse, QueryParams } from '$api/types';
import type { FiltersStore } from '$stores/filters';
import { getFiltersStore } from '$stores/filters';
import type { AlpineComponent } from '$types/alpine';
import { setEventQueryFromAttr } from '$utils/event-attrs';
import type { EventGroup } from '$utils/event-format';
import {
  buildQueryFromFilters,
  filterExcludedTopics,
  getEventDateRange,
  getPriceSummary,
  getTimeRange,
  groupEventsByLocation,
  isProctored,
} from '$utils/event-format';

type Status = 'loading' | 'error' | 'empty' | 'ready';

interface EventListState {
  baseParams: QueryParams;
  status: Status;
  depleted: boolean;
  moreLoading: boolean;
  events: APIResponse[];
  start: number;
  init(): void;
  reload(): void;
  query(): Promise<void>;
  viewMore(): void;
  applyFilters(f: FiltersStore): Partial<QueryParams>;
  groups: EventGroup[];
  priceSummary: string;
  getDays(events: APIResponse[]): string;
  getTime(events: APIResponse[]): string;
  getTests(events: APIResponse[]): string;
  dateRange(event: APIResponse): string;
  timeRange(start: string | null, end?: string | null): string;
  isProctored(event: APIResponse): boolean;
}

window.addEventListener('alpine:init', () => {
  window.Alpine.data('eventList', function () {
    let debounceTimer: ReturnType<typeof setTimeout>;

    return {
      baseParams: {},
      status: 'loading',
      depleted: false,
      moreLoading: false,
      events: [],
      start: 0,

      init() {
        setEventQueryFromAttr(this.$root, this);

        if ('useFilters' in this.$root.dataset) {
          window.Alpine.effect(() => {
            // touch the store so Alpine tracks it, debounce so a date-range pair = one fetch
            getFiltersStore();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => this.reload(), 200);
          });
        } else {
          this.reload();
        }
      },

      reload() {
        this.start = 0;
        this.events = [];
        this.depleted = false;
        this.status = 'loading';
        this.query();
      },

      async query() {
        const limit = this.baseParams.limit ?? 12;
        const apiBody: QueryParams = {
          ...this.baseParams,
          ...this.applyFilters(getFiltersStore()),
          start: this.start,
          limit,
        };

        const results = await fetchEvents(apiBody);

        if (results === null) {
          this.status = 'error';
          return;
        }

        const filtered = filterExcludedTopics(this.$root, results);
        const existingIds = new Set(this.events.map((e) => e.id));
        const fresh = filtered.filter((e) => !existingIds.has(e.id));

        this.events = [...this.events, ...fresh];
        this.status = this.events.length ? 'ready' : 'empty';
        // ponytail: naive depleted heuristic (fewer results than asked for) — good enough until
        // dedup against `is_online` near-duplicates starves it; switch to a server `has_more` flag if so.
        if (results.length < limit) this.depleted = true;
      },

      viewMore() {
        this.moreLoading = true;
        this.start += this.baseParams.limit ?? 12;
        this.query().finally(() => {
          this.moreLoading = false;
        });
      },

      applyFilters(f) {
        return buildQueryFromFilters(f, this.baseParams);
      },

      get groups() {
        if (!('groupBy' in this.$root.dataset)) return [];
        return groupEventsByLocation(this.events);
      },

      get priceSummary() {
        return getPriceSummary(this.events);
      },

      getDays(events) {
        return [...new Set(events.flatMap((e) => e.days_of_week))].join(', ');
      },

      getTime(events) {
        return getTimeRange(events[0]?.starts_at ?? null, events[0]?.ends_at);
      },

      getTests(events) {
        return [...new Set(events.flatMap((e) => e.topics))].join(', ');
      },

      dateRange(event) {
        return getEventDateRange(event);
      },

      timeRange(start, end) {
        return getTimeRange(start, end);
      },

      isProctored(event) {
        return isProctored(event);
      },
    } as AlpineComponent<EventListState>;
  });
});
