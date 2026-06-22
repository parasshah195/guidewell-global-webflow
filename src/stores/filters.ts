export type FilterLocation = 'online' | 'in-person' | 'both';

export interface FiltersStore {
  tests: string[];
  location: FilterLocation;
  dateAfter: string | null;
  dateBefore: string | null;
  extendedTime: boolean;
  daysOfWeek: string[];
  proctored: boolean;
  init(): void;
  toggleTest(test: string): void;
  toggleDay(day: string): void;
  reset(): void;
}

export const FILTERS_STORE = 'filters';

const QUERY_KEYS: Record<keyof Omit<FiltersStore, 'init' | 'toggleTest' | 'toggleDay' | 'reset'>, string> = {
  tests: 'tests',
  location: 'location',
  dateAfter: 'after',
  dateBefore: 'before',
  extendedTime: 'et',
  daysOfWeek: 'days',
  proctored: 'proctored',
};

function getQueryParam(param: string): string {
  return new URLSearchParams(window.location.search).get(param) || '';
}

function setQueryParams(records: { param: string; value: string | null }[]): void {
  const url = new URL(window.location.href);
  for (const { param, value } of records) {
    if (!value) url.searchParams.delete(param);
    else url.searchParams.set(param, value);
  }
  window.history.replaceState({}, '', url.href);
}

export function registerFiltersStore(): void {
  window.Alpine.store(FILTERS_STORE, {
    tests: [],
    location: 'both',
    dateAfter: null,
    dateBefore: null,
    extendedTime: false,
    daysOfWeek: [],
    proctored: false,

    init() {
      const tests = getQueryParam(QUERY_KEYS.tests);
      this.tests = tests ? tests.split(',') : [];
      const location = getQueryParam(QUERY_KEYS.location);
      this.location = (location as FilterLocation) || 'both';
      this.dateAfter = getQueryParam(QUERY_KEYS.dateAfter) || null;
      this.dateBefore = getQueryParam(QUERY_KEYS.dateBefore) || null;
      this.extendedTime = getQueryParam(QUERY_KEYS.extendedTime) === 'true';
      const days = getQueryParam(QUERY_KEYS.daysOfWeek);
      this.daysOfWeek = days ? days.split(',') : [];
      this.proctored = getQueryParam(QUERY_KEYS.proctored) === 'true';

      window.Alpine.effect(() => {
        setQueryParams([
          { param: QUERY_KEYS.tests, value: this.tests.join(',') || null },
          { param: QUERY_KEYS.location, value: this.location !== 'both' ? this.location : null },
          { param: QUERY_KEYS.dateAfter, value: this.dateAfter },
          { param: QUERY_KEYS.dateBefore, value: this.dateBefore },
          { param: QUERY_KEYS.extendedTime, value: this.extendedTime ? 'true' : null },
          { param: QUERY_KEYS.daysOfWeek, value: this.daysOfWeek.join(',') || null },
          { param: QUERY_KEYS.proctored, value: this.proctored ? 'true' : null },
        ]);
      });
    },

    toggleTest(test: string) {
      this.tests = this.tests.includes(test)
        ? this.tests.filter((t) => t !== test)
        : [...this.tests, test];
    },

    toggleDay(day: string) {
      this.daysOfWeek = this.daysOfWeek.includes(day)
        ? this.daysOfWeek.filter((d) => d !== day)
        : [...this.daysOfWeek, day];
    },

    reset() {
      this.tests = [];
      this.location = 'both';
      this.dateAfter = null;
      this.dateBefore = null;
      this.extendedTime = false;
      this.daysOfWeek = [];
      this.proctored = false;
    },
  } as FiltersStore);
}

export function getFiltersStore(): FiltersStore {
  return window.Alpine.store(FILTERS_STORE) as unknown as FiltersStore;
}
