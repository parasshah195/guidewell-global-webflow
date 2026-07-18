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
| `src/utils/alpineWebflow.ts` | The Webflow↔Alpine bridge (`:`→`.` rewrite, `<template>` wrapping). Required — Webflow can't author `<template>` or `.` in attribute names. **Authors never hand-place a `<template>` tag** — Webflow's Designer doesn't render `<template>` content in preview, so it'd be invisible/unstyleable in the canvas. Instead `x-for`/`x-if` go straight on the real element for live preview, and the bridge wraps it into a real `<template>` in JS before `Alpine.start()`. |
| Store-driven reactivity | One shared filter store; multiple lists react to it. Keep this pattern. |

### Keep these Summit dependencies (required)
| Dependency | Why it's required for GWG |
|---|---|
| **`dayjs`** (+ `utc`, `timezone`, `advancedFormat` plugins) | All event date/time handling goes through dayjs so values sent to and parsed from OneCanoe are **timezone-correct**. The API takes/returns timestamps with offsets and a `timezone` param; native `Intl` is not sufficient for the round-trip. Used in `event-format.ts` and in `eventList.applyFilters` (building `after`/`before`/`timezone`). **Loaded once as a global in `entry.ts`** (`window.dayjs`), not imported per component — see §3 and §7. |

dayjs is the **only** required non-native dependency. The filter date range uses **two native
`<input type="date">`** (start + end), not a date-picker library — the end input's `min` is bound
to the start value for the start-before-end constraint. (Summit used EasePick; dropped here.)

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
2. **One shared, behavioral `filters` Alpine store** — no separate `filterForm` component. The
   store owns its own `init()` (hydrate from URL → mirror back to URL), `toggleTest`/`toggleDay`/
   `reset` methods, and URL get/set. Webflow binds the filter UI **directly** to the store
   (`x-model="$store.filters.dateAfter"`, `@change="$store.filters.toggleTest('SAT')"`). Lists opt
   in via a `data-use-filters` attribute and re-query on change. Because Alpine runs store `init()`
   *before* any component `init()`, URL→store hydration completes before lists subscribe → single
   initial fetch, no double-query.
3. **Single `fetchEvents(params)` function** for all API access (no class hierarchy).
4. **Components never `import` Alpine.** They register on `window.addEventListener('alpine:init', …)`
   using the global `window.Alpine`. Only `src/alpine.ts` imports Alpine. (Prevents esbuild
   from bundling Alpine into every component file.)
5. **dayjs for all timezone handling; two native date inputs for the date range UI.** dayjs is the
   one required dep (see §2) and is loaded **once as a global** in `entry.ts` (`window.dayjs`) so
   it is not duplicated across component bundles (esbuild multi-entry has no code splitting). The
   date range is two native `<input type="date">` (start + end) bound straight to the store
   (`dateAfter`/`dateBefore`, YYYY-MM-DD), with the end input's `min` bound to the start value;
   `applyFilters` converts them through the global dayjs into timezone-correct `after`/`before` +
   `timezone` params for the API.
6. **API endpoint + topic IDs live in `src/constants.ts`** as the single config surface.
7. **`eventList`'s query body is derived, not mutated.** Base params (from `query-*` attrs) are set
   once into `baseParams`; `applyFilters` is a pure `store → Partial<QueryParams>` mapper; the body
   is computed fresh per query as `{ ...baseParams, ...filterParams, start, limit }`. A cleared
   filter is simply absent — no stale keys to delete.

**Component count target:** Summit ~29 → GWG Phase 1 = **1 component + 1 store**
(`eventList` + behavioral `filters` store).

---

## 4. Scope

### Phase 1 (this PRD) — Foundation + event lists + filters
Foundation (Alpine bridge, API layer, utils), the generic `eventList`, and the filter
system (behavioral `filters` store; UI binds directly to it). Covers CSV deliverables #1, #6, #7, #8 (list/filter
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
| 6 | Practice Tests page + filters | Mock Tests (v2) page uses **three separate `eventList` instances**: in-person (`query-is_online="false"` + `data-group-by="location"` → `groups` loop per location + `priceSummary`), online-live (`query-is_online="true"` → flat `events` loop), on-demand (static content — not independently queryable from the API). All with `data-use-filters`. Filter UI bound directly to the `filters` store (tests, location radios, date range via two native date inputs, ET, days, **proctored**). State shown via `x-show="status === '...'"` on wrapper divs around each ComponentInstance. |
| 7 | Group Classes (SAT only) | `eventList` with `query-category="['class']"` + SAT `query-topics`. |
| 8 | Webinars page | Two `eventList` instances: Featured (limit 3) + Upcoming (date-sorted). Tag images deferred. |
| 10 | Testing / edge cases | `status` (`loading`/`error`/`empty`/`ready`) + `depleted`/`moreLoading` states on `eventList`. |
| 3 | Combination sliders (blog + events) | Deferred — "nice to have, not a priority." |
| 2, 4, 5 | Google Sheets, Campaign Landing, Search | Later phases (see roadmap). |

---

## 6. The attribute contract (public API for Webflow authors)

These attributes go on the element that carries `x-data="eventList"` (its **root**).
The component reads them off `this.$root` — **no `x-ref` needed**.

### `query-*` — API parameters (parsed & type-coerced)
Any `QueryParams` key, prefixed with `query-`. Value type is auto-detected:
number (`12`), date (`2026-07-01`), boolean (`true`/`false`), array (`['SAT','ACT']` or `[134,49]`), else string.

> **Coercion ceiling (`parseAttrValue`):** detection is by string *shape*, not by target key. Edge:
> an all-digit `event_code` would coerce to a number, and `Date.parse` is loose. Acceptable for the
> current attrs; upgrade to per-key typed coercion (keyed off `QueryParamsProperties`) only if a
> real value ever collides. Covered by `event-attrs.test.ts`.

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
`events: APIResponse[]`, `groups: EventGroup[]`, and a single phase enum
`status: 'loading' | 'error' | 'empty' | 'ready'` (exactly one full-screen UI block shows — bind
`x-show="status === 'error'"` etc.; no contradictory/limbo combos), plus the orthogonal sub-flags
`depleted` and `moreLoading` (apply only while `ready`). Helpers: `dateRange(event)`,
`timeRange(start, end)`, `isProctored(event)` (reads the `'Proctored'` tag — for a per-event badge;
see §10), `viewMore()`.

### Filter UI bindings (Webflow → `filters` store)
There is **no `filterForm` component** — the Webflow filter controls bind **directly** to the
behavioral `filters` store:
- `x-model="$store.filters.location"`, `@change="$store.filters.toggleTest('SAT')"`,
  `@click="$store.filters.reset()"`.
- **Date range — two native date inputs:**
  ```html
  <input type="date" x-model="$store.filters.dateAfter">
  <input type="date" x-model="$store.filters.dateBefore" x-bind:min="$store.filters.dateAfter">
  ```
  The end input's `min` (bound to the start value) prevents an end-before-start selection — no
  picker library, no CDN CSS. The store keeps dates as plain `YYYY-MM-DD` strings; the global
  dayjs does the timezone conversion when building API params (see §3.5, §8).

**URL sync is one-directional:** the store's `init()` hydrates from the URL **once**
(`URL → store`), then an `Alpine.effect` mirrors `store → URL` on every change
(shareable/bookmarkable). The URL is never read again after init — this prevents sync loops.
`reset()` zeroes the store **in place** (never `window.location.reload()`); the lists' effects
re-query automatically.

---

## 7. File structure (Phase 1)

```
src/
  constants.ts            # CONFIG: API_BASE slug, limits, timezone, TEST_TOPIC_IDS  ← fill before go-live
  alpine.ts               # NEW entry: imports Alpine, Webflow bridge, registers filters store, starts Alpine
  entry.ts                # EDIT: add window.startAlpine() helper; init dayjs (+ plugins) → window.dayjs
  global.ts               # unchanged
  api/
    types.ts              # port of Summit eventQueryTypes.ts (+ proctored)
    events.ts             # fetchEvents(params)
  stores/
    filters.ts            # behavioral store: FiltersStore type, register/get accessors, init()
                          #   (URL hydrate + mirror), toggleTest/toggleDay/reset, getQueryParam/setQueryParams
  components/
    event-list.ts         # generic attribute-driven component (only component)
  utils/
    event-attrs.ts        # setEventQueryFromAttr() + parseAttrValue() (exported, tested)
    event-attrs.test.ts   # bun:test — parser type coercion
    event-format.ts       # date/time/price helpers — uses GLOBAL dayjs (not imported) + filterExcludedTopics()
  types/
    global.d.ts           # EDIT: window.Alpine, window.startAlpine, window.dayjs (+ global dayjs)
    alpine.ts             # AlpineComponent<T> ThisType helper for typing `this`
bin/build.js              # EDIT: add './src/alpine.ts' to entry list
tsconfig.json             # EDIT: add $api, $stores, $constants path aliases
package.json              # EDIT: add alpinejs, @types/alpinejs, dayjs  (no EasePick)
```

---

## 8. Module specs (signatures)

```ts
// api/events.ts
// Collapses Summit's QueryAPI + EventQuery into one function.
// Applies defaults { start: 0, limit: DEFAULT_EVENT_LIMIT }. POST to `${API_BASE}/events`.
// Returns events array, [] for empty, null on network/HTTP error (logged).
export async function fetchEvents(params: QueryParams): Promise<APIResponse[] | null>;

// utils/event-attrs.ts  (parseAttrValue: coercion-by-shape; see §6 ceiling note)
export function setEventQueryFromAttr(el: HTMLElement, component: { baseParams: QueryParams }): void;
export function parseAttrValue(value: string): number | boolean | string | Array<string | number> | Date;

// utils/event-format.ts  — uses the GLOBAL `dayjs` (initialised once in entry.ts, NOT imported here),
//                          so esbuild keeps it external and it isn't duplicated into this bundle.
export function isMultiDayEvent(event: APIResponse): boolean;
export function getEventDateRange(event: APIResponse): string;           // "Aug 12 (Mon, Tue)" / "Aug 12 - Aug 15 (...)" / "On demand"
export function getTimeRange(start: string | null, end?: string | null, includeTimeZone?: boolean): string; // "9:00 AM - 5:00 PM (GMT)"
export function getPriceSummary(events: APIResponse[]): string;          // "£X" or "£X - £Y" (per-group cost note, CSV #6) — VAT-inclusive, `event.price` is already rewritten by `applyVAT()`
export function applyVAT(price: string): string;                         // ex-VAT string -> VAT-inclusive string (`* VAT_MULTIPLIER`); non-numeric passes through unchanged
export function filterExcludedTopics(el: HTMLElement, events: APIResponse[]): APIResponse[];
// Deferred (port only when a page renders them): getDays() "Weekly (Mon, Tue)",
// getTimings() "Mornings/Afternoons", getTestsList() "SAT, ACT" — no Phase-1 page uses these.

// stores/filters.ts  — ONE behavioral store (no filterForm component). Owns state + behaviour + URL ops.
export type FilterLocation = 'online' | 'in-person' | 'both';
export interface FiltersStore {
  tests: string[]; location: FilterLocation;
  dateAfter: string | null; dateBefore: string | null;
  extendedTime: boolean; daysOfWeek: string[]; proctored: boolean;
  init(): void;                  // hydrate from URL once, then Alpine.effect(() => syncUrl(this))
  toggleTest(test: string): void;
  toggleDay(day: string): void;
  reset(): void;                 // zero all fields IN PLACE — never window.location.reload()
  // internal: syncUrl() via setQueryParams; getQueryParam/setQueryParams live here (ported subset,
  // were utils/query-params.ts — folded in as this is the only consumer).
}
export const FILTERS_STORE = 'filters';
export function registerFiltersStore(): void;     // window.Alpine.store(FILTERS_STORE, …)
export function getFiltersStore(): FiltersStore;   // window.Alpine.store(FILTERS_STORE)
// applyFilters lives on eventList (below) and READS this store → Partial<QueryParams>.
```

**`eventList` behaviour (query body is DERIVED, not mutated):**
- Holds `baseParams: QueryParams` (set once at init) + the page enum `status` + `depleted`/`moreLoading`.
- `init()`: `setEventQueryFromAttr(this.$root, this)` → fills `baseParams`. If `data-use-filters` →
  `Alpine.effect(() => { readFiltersStore(); debouncedReload() })` (effect tracks the store; ~200ms
  trailing debounce so a two-input date range / rapid toggles = one fetch). Else `reload()` once.
- `reload()`: `start = 0`, `events = []`, `depleted = false`, `status = 'loading'`, then `query()`.
- `query()`: build `apiBody = { ...baseParams, ...applyFilters(getFiltersStore()), start, limit }`;
  `fetchEvents(apiBody)`; on `null` → `status = 'error'`; else filter excluded topics, dedupe
  against shown, push; `status = events.length ? 'ready' : 'empty'`; if returned `< limit` → `depleted`.
- `viewMore()`: `moreLoading = true`, bump `start += limit`, `query()` (append), `moreLoading = false`.
- `applyFilters(f): Partial<QueryParams>` — **pure mapper, no mutation.** tests→`topics` (via
  `TEST_TOPIC_IDS`), location→`is_online` (`both` → omit key entirely), `dateAfter`/`dateBefore`
  strings→`after`/`before` via the global dayjs in `DEFAULT_TIMEZONE` (+ `timezone`), ET→
  `extended_time_available`, days→`days_of_week`, proctored→`proctored`. A cleared filter is simply
  absent from the returned partial — no stale keys (see §3.7).
- `get groups()`: bucket `events` by `location_name ?? (starts_at ? 'Online' : 'Online (On Demand)')`;
  in-person first; each `{ name, events, priceSummary }`.

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
  window.Webflow.push(() => window.startAlpine(['event-list']));
</script>
```

**Ordering guarantee:** component bundles load first (registering their `alpine:init` listeners),
then `alpine.js` loads last and calls `Alpine.start()` — so every component is registered before
start. `alpine.ts` sets `window.Alpine`, registers the filters store, runs the Webflow DOM fixup,
then starts (guarded on `DOMContentLoaded`).

---

## 10. Config & open items

`src/constants.ts` is the only file needing real values before go-live:
- `API_BASE` — **Confirmed** by Ashley Rose (2026-07-16): `https://guidewelleducation.onecanoe.com/api/gwg/public/v2`
  (same `/api/{project}/public/v2` pattern as Summit, `gwg` slug).
- `TEST_TOPIC_IDS` — **Confirmed 2026-07-16 (user-supplied):** full mapping of SAT, ACT, PSAT, SHSAT, EACT, EF Coaching, AP (all subjects + per-subject), SSAT (all levels), ISEE (all levels). Live in `src/constants.ts`.

**Confirmed against the live API (2026-07-16, unfiltered `GET /events` sample):**
- No `proctored` field or request filter param exists at all — confirmed by Ashley Rose/Luke
  Anthony (GWG team, Jun–Jul 2026 thread): proctored-ness is conveyed by a `'Proctored'` string in
  the `tags` array; absence of the tag means non-proctored. Luke's own reference implementation
  (a vanilla-JS Mock Tests page script) filters this client-side after fetching everything
  unfiltered — but we tested the `tags` request param directly against the live API and confirmed
  it **does** filter server-side correctly (exact-match counts on multiple tags, respects
  `limit`/`start`; multiple tags in the array are OR'd). `filters.proctored` sends
  `tags: [...baseParams.tags, 'Proctored']` in `applyFilters()` rather than filtering client-side —
  fetch-then-filter can't guarantee a controlled result count for pagination/"load more" UI, so we
  deliberately did **not** copy Luke's client-side approach. `isProctored()` in `event-format.ts` /
  `eventList.isProctored(event)` still exists as a per-event display helper (e.g. a badge), just not
  for filtering.
- `extended_time_available` reliably comes back as a real boolean (not missing).
- `price` is a single string (e.g. `"687.50"`) or `null` — no separate ex-VAT/inc-VAT fields, and
  the raw API value is always ex-VAT. **Confirmed (2026-07-16):** UK VAT is a flat 20%
  (`VAT_MULTIPLIER = 1.2` in `constants.ts`), and the frontend always shows VAT-inclusive pricing.
  `fetchEvents()` (`api/events.ts`) applies `applyVAT()` (`utils/event-format.ts`) to `price` on
  every event as it comes back from the API, so `event.price` and `getPriceSummary()` are already
  VAT-inclusive everywhere downstream — no separate ex/inc-VAT field or client-side `*1.2`. Treat
  `null`/`0`/non-numeric as "Free" (`applyVAT` passes non-numeric prices through unchanged).
- Response `type` values are `'class' | 'marketing_event' | 'practice_test_event'` — note
  `practice_test_event`, not `'practice_test'` (that string is only valid for the *request*
  `category` filter; see `EventType` vs `QueryParamsCategories` in `api/types.ts`).
- On-demand practice tests aren't part of the events API at all — GWG's Mock Tests page hardcodes
  a small list of `{ name, topic, url }` with `on_demand=<id>` query params on the registration URL.
  Not built here yet; page-specific work if/when the Practice Tests page needs it.

**Still to confirm with GWG/OneCanoe (do not block foundation work):**
- Audience filter for live events (students/schools/all)? (CSV #1)
- Location images for Practice Tests page. (CSV #6)

**Known edge (build only if it bites):** rapid filter changes can let an earlier `fetchEvents`
resolve *after* a later one and overwrite fresh results. The ~200ms re-query debounce (§8) shrinks
the window; the full fix is an `AbortController` per list (thread a `signal` through `fetchEvents`)
to cancel the in-flight request before issuing the next. Not built in Phase 1.

---

## 11. Implementation principles (keep it lean)

- **YAGNI / surgical:** build only Phase 1 scope. Don't port Summit features no GWG page uses yet.
- **Native first, with one deliberate exception:** dayjs (timezone-correct API round-trip) is the only required non-native dep — see §2. The date range uses two native `<input type="date">` (no picker lib). Otherwise no new dependency for a few lines.
- **dayjs is a single global** initialised once in `entry.ts` (`window.dayjs`); date/format modules use the global, never `import dayjs` — esbuild multi-entry has no code splitting, so a per-component import would ship the library more than once.
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
   `eventList` element with `query-*` attrs and `x-for` placed directly on the (visible, editable)
   repeated element — **not** wrapped in a hand-authored `<template>`; the Webflow bridge does that at
   runtime (see §2, §3.4) — footer-call `window.startAlpine(['event-list'])` → events render live from
   the API. Toggle `setScriptMode('cdn')` to confirm fallback.
5. **Filters:** bind a Webflow filter UI directly to `$store.filters` + a `data-use-filters`
   `eventList` → changing a filter re-queries (once, debounced) and updates the list; URL reflects
   filter state; reload restores filters from URL; `reset()` clears in place (no page reload).
6. **Edge states (CSV #10):** kill network → `status==='error'`; query with no matches →
   `status==='empty'`; paginate to end → `depleted`. Confirm exactly one state block shows.

> Note: `API_BASE` is now confirmed (§10), so step 4 (basic list rendering) just needs a GWG staging
> page to test on. Step 5's test-filter toggles still need `TEST_TOPIC_IDS`. Steps 1–3 need neither.
