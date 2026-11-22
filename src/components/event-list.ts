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
import type { DateParts, EventGroup } from '$utils/event-format';
import {
  applyLiveWindow,
  buildQueryFromFilters,
  filterExcludedTopics,
  filterNonLive,
  getDateParts,
  getEventDateRange,
  getPriceSummary,
  getTimeRange,
  groupEventsByLocation,
  isProctored,
} from '$utils/event-format';
import { collectTagImages, EMPTY_TAG_IMAGE, pickTagImage, type TagImage } from '$utils/tag-images';

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
  keepPlace(): void;
  query(): Promise<void>;
  viewMore(): void;
  applyFilters(f: FiltersStore): Partial<QueryParams>;
  groups: EventGroup[];
  priceSummary: string;
  price(event: APIResponse): string;
  getDays(events: APIResponse[]): string;
  getTime(events: APIResponse[]): string;
  getTests(events: APIResponse[]): string;
  dateRange(event: APIResponse): string;
  dateParts(value: string | null): DateParts | null;
  timeRange(start: string | null, end?: string | null): string;
  isProctored(event: APIResponse): boolean;
  tagImages: Record<number, TagImage>;
  tagImage(event: APIResponse): TagImage;
}

window.addEventListener('alpine:init', () => {
  window.Alpine.data('eventList', function () {
    let debounceTimer: ReturnType<typeof setTimeout>;
    let lastSig: string | null = null;

    return {
      baseParams: {},
      status: 'loading',
      depleted: false,
      moreLoading: false,
      events: [],
      start: 0,
      tagImages: {},

      init() {
        setEventQueryFromAttr(this.$root, this);

        if ('useFilters' in this.$root.dataset) {
          window.Alpine.effect(() => {
            // read every filter field so Alpine tracks them (getting the store proxy alone
            // registers no dependency); debounce so a date-range pair = one fetch
            const f = getFiltersStore();
            // Alpine tracks references, not values: reset() reassigns empty arrays, so guard on a
            // value signature to skip no-op refetches (nothing actually changed)
            const sig = JSON.stringify([
              f.tests,
              f.location,
              f.dateAfter,
              f.dateBefore,
              f.extendedTime,
              f.daysOfWeek,
              f.proctored,
            ]);
            if (sig === lastSig) return;
            lastSig = sig;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => this.reload(), 200);
          });
        } else {
          this.reload();
        }
      },

      reload() {
        this.start = this.baseParams.start ?? 0;
        this.events = [];
        this.tagImages = {};
        this.depleted = false;
        this.status = 'loading';
        this.keepPlace();
        this.query().finally(() => this.keepPlace());
      },

      keepPlace() {
        if (!('useFilters' in this.$root.dataset)) return;
        requestAnimationFrame(() => getFiltersStore().restoreAnchor());
      },

      async query() {
        const limit = this.baseParams.limit ?? 12;
        const nonLive = this.baseParams.live === false;
        const existingIds = new Set(this.events.map((e) => e.id));
        const fresh: APIResponse[] = [];
        let exhausted = false;

        // Non-live can't be bounded server-side, so keep pulling raw pages (advancing `start` by
        // what the API actually returned) until a full page survives the filter. Alpine only ever
        // sees the kept events, so pagination and "view more" stay clean.
        do {
          const results = await fetchEvents(
            applyLiveWindow({
              ...this.baseParams,
              ...this.applyFilters(getFiltersStore()),
              start: this.start,
              limit,
            })
          );

          if (results === null) {
            this.status = 'error';
            return;
          }

          this.start += results.length;
          exhausted = results.length < limit;
          const kept = filterExcludedTopics(this.$root, nonLive ? filterNonLive(results) : results);
          for (const e of kept) {
            if (!existingIds.has(e.id)) {
              existingIds.add(e.id);
              fresh.push(e);
            }
          }
        } while (nonLive && !exhausted && fresh.length < limit);

        this.events = [...this.events, ...fresh];

        if ('tagImages' in this.$root.dataset) {
          const bank = collectTagImages(document);
          const next = { ...this.tagImages };
          for (const event of fresh) {
            const picked = pickTagImage(event.tags, bank);
            if (picked) next[event.id] = picked;
          }
          this.tagImages = next;
        }

        this.status = this.events.length ? 'ready' : 'empty';
        // ponytail: naive depleted heuristic (fewer results than asked for) — good enough until
        // dedup against `is_online` near-duplicates starves it; switch to a server `has_more` flag if so.
        if (exhausted) this.depleted = true;
      },

      viewMore() {
        this.moreLoading = true;
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

      price(event) {
        return getPriceSummary(event);
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

      dateParts(value) {
        return getDateParts(value);
      },

      timeRange(start, end) {
        return getTimeRange(start, end);
      },

      isProctored(event) {
        return isProctored(event);
      },

      tagImage(event) {
        return this.tagImages[event.id] ?? EMPTY_TAG_IMAGE;
      },
    } as AlpineComponent<EventListState>;
  });
});
