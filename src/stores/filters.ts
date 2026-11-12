import { holdAnchor } from '$utils/scroll-anchor';

export type FilterLocation = 'online' | 'in-person' | 'both';

export interface FiltersStore {
  tests: string;
  location: FilterLocation;
  dateAfter: string | null;
  dateBefore: string | null;
  extendedTime: boolean;
  daysOfWeek: string[];
  proctored: boolean;
  onDemandVisible: number;
  init(): void;
  restoreAnchor(): void;
  reset(): void;
  resetDays(): void;
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

// Static on-demand cards live in the Webflow markup, not the API: hide the rows whose name
// doesn't match the selected test. The block itself stays visible either way.
const ON_DEMAND_ROW = '[data-on-demand-row]';

function filterOnDemandRows(test: string): number {
  let visible = 0;
  document.querySelectorAll<HTMLElement>(ON_DEMAND_ROW).forEach((row) => {
    const name =
      row.dataset.test || row.querySelector('[data-event-name]')?.textContent?.trim() || '';
    const show = matchesOnDemandTest(name, test);
    row.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  return visible;
}

type FilterField = keyof Omit<FiltersStore, 'onDemandVisible' | 'init' | 'restoreAnchor' | 'reset' | 'resetDays'>;

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
  // Keeps the section the visitor is looking at in place while filtered lists re-render.
  let restore = () => {};
  const release = () => {
    restore = () => {};
  };

  window.Alpine.store(FILTERS_STORE, {
    tests: '',
    location: 'both',
    dateAfter: null,
    dateBefore: null,
    extendedTime: false,
    daysOfWeek: [],
    proctored: false,
    onDemandVisible: 0,

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

      // Registered before any effect that changes layout, so it measures the pre-change page.
      window.Alpine.effect(() => {
        void [
          this.tests,
          this.location,
          this.dateAfter,
          this.dateBefore,
          this.extendedTime,
          [...this.daysOfWeek],
          this.proctored,
        ];
        restore = holdAnchor();
        requestAnimationFrame(() => restore());
      });
      // The visitor taking over scrolling ends the hold.
      ['wheel', 'touchmove', 'keydown'].forEach((type) =>
        window.addEventListener(type, release, { passive: true })
      );

      window.Alpine.effect(() => {
        this.onDemandVisible = filterOnDemandRows(this.tests);
      });
      // The cards are rendered by Alpine after init, so re-apply when they appear.
      new MutationObserver((records) => {
        const added = records.some((r) =>
          [...r.addedNodes].some(
            (n) =>
              n instanceof HTMLElement &&
              (n.matches(ON_DEMAND_ROW) || n.querySelector(ON_DEMAND_ROW))
          )
        );
        if (added) this.onDemandVisible = filterOnDemandRows(this.tests);
      }).observe(document.body, { childList: true, subtree: true });

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

    restoreAnchor() {
      restore();
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
  } as FiltersStore);
}

export function getFiltersStore(): FiltersStore {
  return window.Alpine.store(FILTERS_STORE) as unknown as FiltersStore;
}
