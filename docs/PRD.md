# PRD — GuideWell Global Webflow × OneCanoe Events API

> Spec for implementing OneCanoe Events on the GuideWell Global (GWG) Webflow site.
> Written to be executed by an LLM/dev with no prior context. Pair with [`TODO.md`](./TODO.md).

---

## 1. Context & goal

`guidewell-global-webflow` is a fresh repo from the `webflow-js-starter` template
(esbuild + TypeScript + bun; deploys to jsDelivr). The site is built in Webflow;
JavaScript behaviour is layered on top via **Alpine.js components configured through
HTML attributes** placed on the Webflow-authored structure.

**Goal:** surface OneCanoe **Events** (public events) across GWG pages — lists, filters,
search — driven by a small, reusable set of Alpine components.

**Reference build:** the **Summit** project (`summit-project-webflow-site`), which targets
the *same* OneCanoe org (`guidewelleducation.onecanoe.com`). Summit works but grew to
**~29 Alpine components/stores** with heavy duplication. This project keeps Summit's good
parts and collapses the duplication.

**Already solved by the starter — do not rebuild:** the "localhost server to swap JS during
dev" requirement is the starter's `window.loadScript()` + `window.setScriptMode('local'|'cdn')`
with auto-fallback to CDN (see `src/entry.ts`, `src/dev/env.ts`, `bin/build.js`).

---

## 2. Background: Summit reference — reuse vs. drop

### Reuse (port, lightly slimmed)
| Summit source | Why it's good |
|---|---|
| `src/api/eventQueryTypes.ts` | Accurate request/response types for the same API. ~90% reusable. |
| `src/utils/setEventQueryFromAttr.ts` + `arrayCheck.ts` | The `query-*` attribute → API-param parser. This is the core of attribute-driven config. |
| `src/utils/getDateTime.ts` + `isMultiDayEvent.ts` | Date/time range, day/timing/test summaries, multi-day check. |
| `src/utils/queryParamOps.ts` | URL query get/set (filters ↔ shareable URLs). |
| `src/utils/alpineWebflow.ts` | The Webflow↔Alpine bridge (`:`→`.` rewrite, `<template>` wrapping). Required — Webflow can't author `<template>` or `.` in attribute names. |
| Store-driven reactivity | One shared filter store; multiple lists react to it. Keep this pattern. |

### Keep these Summit dependencies (required)
| Dependency | Why it's required for GWG |
|---|---|
| **`dayjs`** (+ `utc`, `timezone`, `advancedFormat` plugins) | All event date/time handling goes through dayjs so values sent to and parsed from OneCanoe are **timezone-correct**. The API takes/returns timestamps with offsets and a `timezone` param; native `Intl` is not sufficient for the round-trip. Used in `event-format.ts` and in `eventList.applyFilters` (building `after`/`before`/`timezone`). |
| **`@easepick/core` + `@easepick/range-plugin`** | The filter date range is a **single input** that captures both start and end dates (one EasePick range field), per design. Also pull `@easepick/lock-plugin` if a min-date (today) constraint is needed. |

### Drop / don't port (YAGNI for Phase 1)
- The `QueryAPI` **abstract class + `EventQuery` subclass** → collapse to one `fetchEvents()` function. One endpoint, one function.
- Six near-identical list components (`eventsList`, `filterEventsOnline`, `filterEventsOnlineOnDemand`, `filterEventsLocations`, `psatPathwaysEvents`, `sbwEvents`) → **one** generic `eventList`.
- Blog-post shuffling, Webflow slider re-init, webinar tag-image randomisation (Summit `events-list.ts`) → add later **only** if a specific GWG page needs it.
- Per-page stores, per-campaign thank-you/form components → not in Phase 1.

---

## 3. Architecture decisions (locked)

1. **One generic, attribute-driven `eventList` component** covers every events feed
   (Home, Practice Tests, Group Classes, Webinars, Events page). Behaviour is configured
   entirely by HTML attributes on the `x-data` element — no per-page JS.
2. **One shared `filters` Alpine store** + **one `filterForm` component**. Lists opt into
   the store via a `data-use-filters` attribute and re-query on change.
3. **Single `fetchEvents(params)` function** for all API access (no class hierarchy).
4. **Components never `import` Alpine.** They register on `window.addEventListener('alpine:init', …)`
   using the global `window.Alpine`. Only `src/alpine.ts` imports Alpine. (Prevents esbuild
   from bundling Alpine into every component file.)
5. **dayjs for all timezone handling; EasePick (single input, range plugin) for the date range UI.**
   These two deps are required (see §2). The date range is one EasePick field that captures start
   *and* end; on select it writes `dateAfter`/`dateBefore` (YYYY-MM-DD) to the store, and
   `applyFilters` converts them through dayjs into timezone-correct `after`/`before` + `timezone`
   params for the API.
6. **API endpoint + topic IDs live in `src/constants.ts`** as the single config surface.

**Component count target:** Summit ~29 → GWG Phase 1 = **2 components + 1 store**
(`eventList`, `filterForm`, `filters` store).

---

## 4. Scope

### Phase 1 (this PRD) — Foundation + event lists + filters
Foundation (Alpine bridge, API layer, utils), the generic `eventList`, and the filter
system (`filters` store + `filterForm`). Covers CSV deliverables #1, #6, #7, #8 (list/filter
parts) and the error/empty states of #10.

### Roadmap (later phases, NOT built now)
- **Phase 2 — Search & event-code (CSV #1, #5):** `eventCodeSearch` (find by code → redirect);
  Search Results custom sections = `eventList` instances beside native Webflow search.
- **Phase 3 — Campaign Landing registration (CSV #4):** `eventRegistration` + `thankYou`.
  CSV: "TBC if needed July/August." Defer until confirmed.
- **Phase 4 — Google Sheets University Fairs (CSV #2):** thin fetch adapter feeding the **same**
  `eventList` renderer. Undocumented public API → isolate.
- **Handover (CSV #11):** document the attribute API + `startAlpine` pattern in the README.

---

## 5. CSV deliverables → implementation map

| CSV # | Deliverable | Phase 1 implementation |
|---|---|---|
| 1 | Events API across pages | `eventList` instances with different `query-*` attrs per page. |
| 6 | Practice Tests page + filters | `eventList` with `data-group-by="location"` + `data-use-filters`; `filterForm` (tests, location, date range, ET, days, **proctored**); per-group cost note via `getPriceSummary`. |
| 7 | Group Classes (SAT only) | `eventList` with `query-category="['class']"` + SAT `query-topics`. |
| 8 | Webinars page | Two `eventList` instances: Featured (limit 3) + Upcoming (date-sorted). Tag images deferred. |
| 10 | Testing / edge cases | `isLoading` / `isEmpty` / `isError` / `depleted` states on `eventList`. |
| 3 | Combination sliders (blog + events) | Deferred — "nice to have, not a priority." |
| 2, 4, 5 | Google Sheets, Campaign Landing, Search | Later phases (see roadmap). |

---

## 6. The attribute contract (public API for Webflow authors)

These attributes go on the element that carries `x-data="eventList"` (its **root**).
The component reads them off `this.$root` — **no `x-ref` needed**.

### `query-*` — API parameters (parsed & type-coerced)
Any `QueryParams` key, prefixed with `query-`. Value type is auto-detected:
number (`12`), date (`2026-07-01`), boolean (`true`/`false`), array (`['SAT','ACT']` or `[134,49]`), else string.

| Attribute | Example | Maps to |
|---|---|---|
| `query-category` | `['marketing_event']` | `category` |
| `query-topics` | `[134, 49]` | `topics` (test IDs) |
| `query-limit` | `12` | `limit` |
| `query-is_online` | `true` | `is_online` |
| `query-location_id` | `5` | `location_id` |
| `query-before` / `query-after` | `2026-09-01` | date range |
| `query-event_code` | `EVT83DD6` | `event_code` |
| `query-tags` | `['SAT Prep']` | `tags` |

### `data-*` — display config
| Attribute | Values | Effect |
|---|---|---|
| `data-group-by` | `location` \| (absent) | `location`: expose `groups` (in-person locations first, then `Online`, then `Online (On Demand)`), each with a `priceSummary`. Absent: flat `events` list. |
| `data-use-filters` | present / absent | Subscribe to the `filters` store; re-query on change. |
| `data-topics-exclude` | `SAT,ACT` | Drop events whose topics intersect this list. |

### Component state exposed to the template
`events: APIResponse[]`, `groups: EventGroup[]`, `isLoading`, `isEmpty`, `isError`,
`depleted`, `moreLoading`. Helpers: `dateRange(event)`, `timeRange(start, end)`, `viewMore()`.

### `filterForm` bindings (Webflow filter UI)
Bind controls directly to the store, e.g. `x-model="$store.filters.location"`,
`@change="toggleTest('SAT')"`, `@click="reset()"`. The form hydrates the store from URL
params on load and mirrors store → URL on change (shareable/bookmarkable filters).

**Date range — EasePick single input:** `filterForm.init()` instantiates one EasePick instance
(`@easepick/core` + `RangePlugin`) on the date input referenced by `x-ref="dateRange"`. Its
`select` callback writes `dateAfter`/`dateBefore` (YYYY-MM-DD) to the store; `reset()` clears
the picker too. EasePick CSS must be present — add the pinned CDN `<link>` in the Webflow page
`<head>` (or inject it in `init`). The store keeps dates as plain strings; dayjs does the
timezone conversion when building API params (see §3.5, §8).

---

## 7. File structure (Phase 1)

```
src/
  constants.ts            # CONFIG: API_BASE slug, limits, timezone, TEST_TOPIC_IDS  ← fill before go-live
  alpine.ts               # NEW entry: imports Alpine, Webflow bridge, registers filters store, starts Alpine
  entry.ts                # EDIT: add window.startAlpine() helper
  global.ts               # unchanged
  api/
    types.ts              # port of Summit eventQueryTypes.ts (+ proctored)
    events.ts             # fetchEvents(params)
  stores/
    filters.ts            # FiltersStore type + registerFiltersStore() + getFiltersStore()
  components/
    event-list.ts         # generic attribute-driven component
    filter-form.ts        # filter UI ↔ store ↔ URL
  utils/
    event-attrs.ts        # setEventQueryFromAttr() + parseAttrValue() (exported, tested)
    event-attrs.test.ts   # bun:test — parser type coercion
    event-format.ts       # date/time/day/price helpers (dayjs + utc/timezone) + filterExcludedTopics()
    query-params.ts       # setQueryParam / setQueryParams
  types/
    global.d.ts           # EDIT: window.Alpine, window.startAlpine
    alpine.ts             # AlpineComponent<T> ThisType helper for typing `this`
bin/build.js              # EDIT: add './src/alpine.ts' to entry list
tsconfig.json             # EDIT: add $api, $stores, $constants path aliases
package.json              # EDIT: add alpinejs, @types/alpinejs, dayjs, @easepick/core, @easepick/range-plugin
```

---

## 8. Module specs (signatures)

```ts
// api/events.ts
// Collapses Summit's QueryAPI + EventQuery into one function.
// Applies defaults { start: 0, limit: DEFAULT_EVENT_LIMIT }. POST to `${API_BASE}/events`.
// Returns events array, [] for empty, null on network/HTTP error (logged).
export async function fetchEvents(params: QueryParams): Promise<APIResponse[] | null>;

// utils/event-attrs.ts
export function setEventQueryFromAttr(el: HTMLElement, component: { apiBody: QueryParams }): void;
export function parseAttrValue(value: string): number | boolean | string | Array<string | number> | Date;

// utils/event-format.ts  (dayjs + utc/timezone/advancedFormat plugins, DEFAULT_TIMEZONE)
export function isMultiDayEvent(event: APIResponse): boolean;
export function getEventDateRange(event: APIResponse): string;           // "Aug 12 (Mon, Tue)" / "Aug 12 - Aug 15 (...)" / "On demand"
export function getTimeRange(start: string | null, end?: string | null, includeTimeZone?: boolean): string; // "9:00 AM - 5:00 PM (GMT)"
export function getDays(events: APIResponse[]): string;                  // "Weekly (Mon, Tue)"
export function getTimings(events: APIResponse[]): string;               // "Mornings/Afternoons"
export function getTestsList(events: APIResponse[]): string;             // "SAT, ACT"
export function getPriceSummary(events: APIResponse[]): string;          // "£X" or "£X - £Y" (per-group cost note, CSV #6)
export function filterExcludedTopics(el: HTMLElement, events: APIResponse[]): APIResponse[];

// stores/filters.ts
export type FilterLocation = 'online' | 'in-person' | 'both';
export interface FiltersStore {
  tests: string[]; location: FilterLocation;
  dateAfter: string | null; dateBefore: string | null;
  extendedTime: boolean; daysOfWeek: string[]; proctored: boolean;
  reset(): void;
}
export const FILTERS_STORE = 'filters';
export function registerFiltersStore(): void;     // window.Alpine.store(FILTERS_STORE, …)
export function getFiltersStore(): FiltersStore;   // window.Alpine.store(FILTERS_STORE)

// utils/query-params.ts  (ported subset)
export function setQueryParam(param: string, value: string | null | undefined, pushHistory?: boolean): void;
export function setQueryParams(records: { param: string; value: string | null | undefined }[], pushHistory?: boolean): void;
```

**`eventList` behaviour:**
- `init()`: `setEventQueryFromAttr(this.$root, this)`. If `data-use-filters` → `Alpine.effect(() => { applyFilters(getFiltersStore()); $nextTick(reload) })`; else `reload()`.
- `reload()`: reset `start=0`, `events=[]`, `depleted=false`, query, toggle `isLoading`.
- `query()`: `fetchEvents(apiBody)`; on `null` → `isError`; filter excluded topics; dedupe against shown; if `< limit` → `depleted`; push; set `isEmpty`.
- `viewMore()`: bump `start += limit`, query (append).
- `applyFilters(f)`: tests→`topics` (via `TEST_TOPIC_IDS`), location→`is_online` (`both`=undefined), `dateAfter`/`dateBefore` strings→`after`/`before` via dayjs in `DEFAULT_TIMEZONE` (+ set `timezone` param), ET→`extended_time_available`, days→`days_of_week`, proctored→`proctored`.
- `get groups()`: bucket `events` by `location_name ?? (starts_at ? 'Online' : 'Online (On Demand)')`; in-person first; each `{ name, events, priceSummary }`.

---

## 9. Loading & orchestration model

`entry.js` is loaded once in the Webflow site `<head>` (CDN URL, or localhost when editing entry itself).
It defines `window.loadScript` (exists) and `window.startAlpine` (to add):

```ts
window.startAlpine = (components) =>
  Promise.all(components.map((name) => window.loadScript(`components/${name}.js`)))
    .then(() => window.loadScript('alpine.js'));
```

**Per-page footer embed** (inside `Webflow.push` so the DOM is ready):
```html
<script>
  window.Webflow ||= [];
  window.Webflow.push(() => window.startAlpine(['event-list', 'filter-form']));
</script>
```

**Ordering guarantee:** component bundles load first (registering their `alpine:init` listeners),
then `alpine.js` loads last and calls `Alpine.start()` — so every component is registered before
start. `alpine.ts` sets `window.Alpine`, registers the filters store, runs the Webflow DOM fixup,
then starts (guarded on `DOMContentLoaded`).

---

## 10. Config & open items

`src/constants.ts` is the only file needing real values before go-live:
- `API_BASE` — GWG path slug (same host as Summit, GWG-specific slug). **Placeholder until confirmed.**
- `TEST_TOPIC_IDS` — OneCanoe topic IDs per test (SAT/ACT/AP/PSAT). **Empty until GWG provides.**

**To confirm with GWG/OneCanoe (do not block foundation work):**
- Does the API return `proctored`, `extended_time_available`, and full (inc-VAT) price, or ex-VAT only? (CSV #6)
- Audience filter for live events (students/schools/all)? (CSV #1)
- On-demand test links + location images for Practice Tests page. (CSV #6)

---

## 11. Implementation principles (keep it lean)

- **YAGNI / surgical:** build only Phase 1 scope. Don't port Summit features no GWG page uses yet.
- **Native first, with two deliberate exceptions:** dayjs (timezone-correct API round-trip) and EasePick (single-input date range) are required deps — see §2. Otherwise no new dependency for a few lines.
- **One endpoint, one function.** No abstract base classes for a single API.
- **Mark deliberate shortcuts** with `// ponytail:` comments (e.g. placeholder slug, naive `depleted` heuristic).
- **Type the boundary:** API request/response strictly typed; component internals via `AlpineComponent<T>`.
- **One runnable check** on the riskiest pure logic: `parseAttrValue` type coercion (`bun test`, zero new deps).

---

## 12. Verification

1. `bun install` → `bun run dev` serves `http://localhost:3000/alpine.js`, `/components/event-list.js`, etc.
2. `bun test` → `parseAttrValue` coercion asserts pass (number/date/bool/array/string).
3. `bun run build` → `dist/prod/` contains `entry.js`, `alpine.js`, `components/*.js` with no esbuild errors.
4. **On a GWG staging page:** `entry.js` in `<head>`, run `window.setScriptMode('local')`, add an
   `eventList` element with `query-*` attrs + an `x-for` template, footer-call
   `window.startAlpine(['event-list'])` → events render live from the API. Toggle
   `setScriptMode('cdn')` to confirm fallback.
5. **Filters:** wire `filterForm` + a `data-use-filters` `eventList` → changing a filter re-queries
   and updates the list; URL reflects filter state; reload restores filters from URL.
6. **Edge states (CSV #10):** kill network → `isError`; query with no matches → `isEmpty`; paginate to end → `depleted`.

> Note: steps 4–6 need the real `API_BASE` slug + topic IDs (section 10). Steps 1–3 do not.
