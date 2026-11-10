export type FilterLocation = 'online' | 'in-person' | 'both';

export interface FiltersStore {
  tests: string;
  location: FilterLocation;
  dateAfter: string | null;
  dateBefore: string | null;
  extendedTime: boolean;
  daysOfWeek: string[];
  proctored: boolean;
  init(): void;
  reset(): void;
  resetDays(): void;
  filterOnDemandRows(root: HTMLElement): boolean;
}

export const FILTERS_STORE = 'filters';

export function matchesOnDemandTest(name: string, test: string): boolean {
  if (!test) return true;
  const isWord = (c: string | undefined) => !!c && /[A-Za-z0-9]/.test(c);
  for (let i = name.indexOf(test); i !== -1; i = name.indexOf(test, i + 1)) {
    if (!isWord(name[i - 1]) && !isWord(name[i + test.length])) return true;
  }
  return false;
}

const onDemandRowDisplay = new WeakMap<HTMLElement, { original: string; visible: boolean }>();

type FilterField = keyof Omit<FiltersStore, 'init' | 'reset' | 'resetDays' | 'filterOnDemandRows'>;

const QUERY_KEYS: Record<FilterField, string> = {
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
    tests: '',
    location: 'both',
    dateAfter: null,
    dateBefore: null,
    extendedTime: false,
    daysOfWeek: [],
    proctored: false,

    init() {
      // Precedence (increasing): store default (the literals above) < HTML `checked` on registered
      // inputs < URL query param. Inputs opt in with `data-filter="<field>"`; type of the current
      // default decides how each tier is parsed. Runs before Alpine renders the inputs' bindings.
      const params = new URLSearchParams(window.location.search);

      (Object.keys(QUERY_KEYS) as FilterField[]).forEach((field) => {
        const key = QUERY_KEYS[field];
        const inputs = [...document.querySelectorAll<HTMLInputElement>(`[data-filter="${field}"]`)];
        const current = this[field];

        if (Array.isArray(current)) {
          if (inputs.length)
            this[field] = inputs
              .filter((i) => i.hasAttribute('checked'))
              .map((i) => i.value) as never;
          if (params.has(key))
            this[field] = (getQueryParam(key) ? getQueryParam(key).split(',') : []) as never;
        } else if (typeof current === 'boolean') {
          if (inputs.length) this[field] = inputs[0].hasAttribute('checked') as never;
          if (params.has(key)) this[field] = (getQueryParam(key) === 'true') as never;
        } else {
          // scalar (location, dateAfter/before): first checked input, then URL value
          const picked = inputs.find((i) => i.hasAttribute('checked'))?.value;
          if (picked) this[field] = picked as never;
          if (params.has(key)) this[field] = (getQueryParam(key) || null) as never;
        }
      });

      window.Alpine.effect(() => {
        setQueryParams([
          { param: QUERY_KEYS.tests, value: this.tests || null },
          { param: QUERY_KEYS.location, value: this.location !== 'both' ? this.location : null },
          { param: QUERY_KEYS.dateAfter, value: this.dateAfter },
          { param: QUERY_KEYS.dateBefore, value: this.dateBefore },
          { param: QUERY_KEYS.extendedTime, value: this.extendedTime ? 'true' : null },
          // daysOfWeek is intentionally not URL-synced (HTML default only) — noisy in the query string
          { param: QUERY_KEYS.proctored, value: this.proctored ? 'true' : null },
        ]);
      });
    },

    reset() {
      this.tests = '';
      this.location = 'both';
      this.dateAfter = null;
      this.dateBefore = null;
      this.extendedTime = false;
      this.daysOfWeek = [];
      this.proctored = false;
    },

    // Select every day — derives the full set from the rendered checkboxes so there's no day list
    // duplicated in code (single source of truth is the Webflow markup).
    resetDays() {
      this.daysOfWeek = [
        ...document.querySelectorAll<HTMLInputElement>('[data-filter="daysOfWeek"]'),
      ].map((i) => i.value);
    },

    filterOnDemandRows(root) {
      const test = this.tests;
      let hasMatch = false;
      root.querySelectorAll<HTMLElement>('[data-event-row]').forEach((row) => {
        let display = onDemandRowDisplay.get(row);
        if (!display) {
          const style = getComputedStyle(row);
          display = {
            original: row.style.display,
            visible: !row.hidden && style.display !== 'none' && style.visibility === 'visible',
          };
          onDemandRowDisplay.set(row, display);
        }
        const name =
          row.dataset.test || row.querySelector('[data-event-name]')?.textContent?.trim() || '';
        const matches = matchesOnDemandTest(name, test);
        row.style.display = matches ? display.original : 'none';
        if (display.visible && matches) hasMatch = true;
      });
      return hasMatch;
    },
  } as FiltersStore);
}

export function getFiltersStore(): FiltersStore {
  return window.Alpine.store(FILTERS_STORE) as unknown as FiltersStore;
}
