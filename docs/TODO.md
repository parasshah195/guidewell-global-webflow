# TODO — GWG OneCanoe Events Integration

Execution checklist for [`PRD.md`](./PRD.md). Do steps in order; each group ends with a verify.
Section refs (§) point to PRD sections. Keep it lean — see PRD §11.

---

## Phase 1 — Foundation + event lists + filters

### 0. Setup
- [x] `package.json`: add deps `alpinejs`, `dayjs`; devDep `@types/alpinejs`. Run `bun install`.
      (No EasePick — date range uses two native `<input type="date">` with an `x-bind:min` constraint.)
- [x] `tsconfig.json`: add path aliases under `compilerOptions.paths`:
      `"$api/*": ["src/api/*"]`, `"$stores/*": ["src/stores/*"]`, `"$constants": ["src/constants.ts"]`.
- [x] `bin/build.js`: add `'./src/alpine.ts'` to the `files` array (new entry point). Also dropped the
      `./src/pages/**/*.ts` glob — leftover from the starter template, no `src/pages/` dir exists and
      nothing in scope needs it; esbuild errors on a glob with zero matches.
- **Verify:** `bun install` succeeds; `bun run build` still runs. ✅

### 1. Config — `src/constants.ts`  (PRD §10)
- [x] Export `API_BASE` (placeholder slug, `// ponytail:` comment), `DEFAULT_EVENT_LIMIT = 12`,
      `DEFAULT_TIMEZONE = 'Europe/London'`,
      `TEST_TOPIC_IDS: Record<string, number[]>` with empty SAT/ACT/AP/PSAT arrays + TODO.
      (No `VIEW_MORE_LIMIT` — `viewMore` pages by the same `limit`.)
- **Verify:** file type-checks; values referenced by later modules resolve. ✅

### 2. API layer  (PRD §8)
- [x] `src/api/types.ts`: port Summit `eventQueryTypes.ts` — `QueryParams`, `QueryParamsProperties`,
      `APIResponse`, `APIResponseData`, `DaysOfWeek`, `QueryParamsCategories`. Add `proctored?: boolean`
      to `QueryParams` (+ to `QueryParamsProperties`) and `proctored?: boolean | null` to `APIResponse`.
- [x] `src/api/events.ts`: `fetchEvents(params)` — apply `{ start: 0, limit: DEFAULT_EVENT_LIMIT }`
      defaults, `POST ${API_BASE}/events`, try/catch → `null` on error, `!ok` → `null`, else `data ?? []`.
- **Verify:** imports resolve via `$api/*` and `$constants`. ✅

### 3. Utils  (PRD §8)
- [x] `src/utils/event-attrs.ts`: `setEventQueryFromAttr(el, component)` (loops `query-*` attrs,
      checks `QueryParamsProperties`, writes `component.baseParams[key]`) + **exported** `parseAttrValue(value)`
      (number → date → bool → array → string) + internal `arrayCheck`. Add a `// ponytail:` comment
      on `parseAttrValue` naming the coercion ceiling (all-digit `event_code` → number; loose `Date.parse`).
- [x] `src/utils/event-format.ts`: uses the **global `dayjs`** (initialised in `entry.ts` — do NOT
      `import dayjs` here, so esbuild keeps it external). Implement `isMultiDayEvent`,
      `getEventDateRange`, `getTimeRange`; add `getPriceSummary(events)` (£ min–max) and
      `filterExcludedTopics(el, events)` (reads `data-topics-exclude`). All formatting in `DEFAULT_TIMEZONE`.
      **Skip** `getDays`/`getTimings`/`getTestsList` and the Summit `DateTimeRange` type +
      `startDateShort`/`WithWeekday`/etc. fields — port only when a page needs them.
- [x] URL get/set: **no `utils/query-params.ts`** — folded `getQueryParam` + `setQueryParams` into
      `stores/filters.ts` (its only consumer; see step 5). Skipped `setQueryParam` single / `getAllQueryParams` / `removeAllQueryParams`.
- **Verify:** `bun run build` compiles these. ✅

### 4. Type helper — `src/types/alpine.ts`
- [x] Export `AlpineComponent<T>` = `T & ThisType<T & { $root; $el; $refs; $store; $nextTick; $watch }>`
      so component method `this` is typed.

### 5. Alpine bridge + store  (PRD §9)
- [x] `src/stores/filters.ts`: **behavioral store** (no separate filterForm component).
      `FiltersStore` interface, `FilterLocation`, `FILTERS_STORE = 'filters'`, `registerFiltersStore()`,
      `getFiltersStore()` accessor. Store includes: `init()` (hydrate from URL once via `getQueryParam`,
      then `Alpine.effect(() => syncUrl(this))` — one-directional: URL→store once, store→URL on change),
      `toggleTest`, `toggleDay`, `reset()` (zero all fields **in place — never `location.reload()`**),
      internal `syncUrl` (via `setQueryParams`), and the folded-in `getQueryParam`/`setQueryParams`.
- [x] `src/alpine.ts`: `import Alpine from 'alpinejs'` → `window.Alpine = Alpine`;
      `addEventListener('alpine:init', registerFiltersStore)`; port Webflow fixup
      (`replaceDotAttributes`, `wrapInTemplate`, `clearTransitionValues`) from Summit `alpineWebflow.ts`
      as plain functions; `boot()` = fixup + `Alpine.start()`, guarded on `DOMContentLoaded`.
- **Verify:** `bun run build` emits `dist/prod/alpine.js` (self-contained, bundles Alpine). ✅

### 6. Components  (PRD §6, §8)
- [x] `src/components/event-list.ts` (the **only** component): register `eventList` on `alpine:init`
      (no Alpine import). `EventListState` interface + cast `as AlpineComponent<EventListState>`.
      State: `baseParams: QueryParams` (set once at init), `status: 'loading'|'error'|'empty'|'ready'`
      (single phase enum — replaces `isLoading`/`isError`/`isEmpty`), plus `depleted`/`moreLoading`.
      Implement `init/reload/query/viewMore`, `get groups`, `dateRange`/`timeRange` helpers, and
      `applyFilters(f): Partial<QueryParams>` as a **pure mapper** (no mutation; `both` → omit
      `is_online`). `query()` builds `apiBody = { ...baseParams, ...applyFilters(store), start, limit }`
      fresh each call and sets `status` along its branches. `init()` with `data-use-filters` wraps the
      re-query in an `Alpine.effect` with a **~200ms trailing debounce** (date range = two inputs → one
      fetch, not two). Read attrs from `this.$root`. **Don't** port slider/blog-shuffle/tag-image code.
- (No `filter-form.ts` — the filter UI binds directly to `$store.filters`; behaviour lives in the store, step 5.)
- **Verify:** `bun run build` emits `dist/prod/components/event-list.js`, no errors. ✅

### 7. Wiring  (PRD §9)
- [x] `src/entry.ts`: add `window.startAlpine = (components) => Promise.all(...loadScript).then(loadScript('alpine.js'))`.
      Also init dayjs **once** here: `import dayjs` + extend `utc`/`timezone`/`advancedFormat`, then
      `window.dayjs = dayjs` (single global; date modules use it without importing — see PRD §3/§7/§11).
- [x] `src/types/global.d.ts`: add to `Window` — `Alpine: typeof import('alpinejs').default;`,
      `startAlpine(components: string[]): Promise<void>;`, and `dayjs: typeof import('dayjs').default;`.
- **Verify:** `bun run build` compiles entry with new global types. ✅

### 8. Test  (PRD §11)
- [x] `src/utils/event-attrs.test.ts` (`bun:test`): assert `parseAttrValue` →
      `'12'`→`12`, `'2026-07-01'`→`Date`, `'true'/'false'`→bool, `"['SAT','ACT']"`→array,
      `'marketing_event'`→string.
- **Verify:** `bun test` passes. ✅

### 9. Build verification  (PRD §12 steps 1–3)
- [x] `bun run dev` serves `localhost:3000/alpine.js` + `/components/*.js`.
- [x] `bun run build` → clean `dist/prod/` with `entry.js`, `alpine.js`, `components/*.js`.
- [x] `bun test` green.

### 10. Live verification (needs real API_BASE slug + topic IDs — PRD §10, §12 steps 4–6)
- [x] Fill `API_BASE` slug from GWG. Confirmed by Ashley Rose (2026-07-16):
      `https://guidewelleducation.onecanoe.com/api/gwg/public/v2` (matches Summit's
      `/api/{project}/public/v2` pattern, `gwg` in place of `summit`).
- [ ] Fill `TEST_TOPIC_IDS` from GWG — still empty placeholders.
- [ ] On GWG staging: `setScriptMode('local')`, place an `eventList` + `x-for` template → events render.
- [ ] Bind a filter UI to `$store.filters` + a `data-use-filters` list → filtering re-queries (once,
      debounced); URL syncs; reload restores; `reset()` clears in place (no page reload).
- [ ] Confirm `status` (`loading`/`error`/`empty`/`ready`) + `depleted` states (CSV #10); exactly one block shows.
- [ ] Practice Tests: `data-group-by="location"` → in-person groups first, online last, per-group price note.

---

## Roadmap (later phases — NOT Phase 1)

### Phase 2 — Search & event-code (CSV #1, #5)
- [x] `components/event-code-search.ts`: input → `fetchEvents({ event_code })` → redirect to `event_page_url`.
      `eventCodeSearch` component: `eventCode`/`isLoading`/`isError` state + `search()`. No
      per-field IX2 error-animation trigger (Summit's `event-code-find.ts` had one via `$refs`) —
      YAGNI until a GWG page's Webflow markup needs it; `isError` is enough to bind a message.
- [ ] Search Results page: `eventList` instances (Group Classes, Practice Tests, Webinars) beside native search.
      No new component needed — reuse `eventList` with page-specific `query-*` attrs (per PRD §4).
      Blocked on GWG confirming which pages/queries; not foundation work.

### Phase 3 — Campaign Landing registration (CSV #4) — confirm need first
- [ ] `components/event-registration.ts`: select events → POST to OneCanoe → redirect to Thank You.
- [ ] `components/thank-you.ts`: read selected events from URL, confirm + show Program Director.

### Phase 4 — Google Sheets University Fairs (CSV #2)
- [ ] Fetch adapter (public Sheets API) mapping rows → `APIResponse`-like shape → reuse `eventList` rendering.

### Handover (CSV #11)
- [x] README: document the `query-*` / `data-*` attribute contract + `startAlpine` per-page pattern + config.

---

## Open questions (track, don't block)
- [x] GWG OneCanoe path slug — confirmed (see §10 above).
- [ ] Per-test topic IDs (`TEST_TOPIC_IDS`).
- [x] API returns `proctored` / `extended_time_available`? Confirmed live (2026-07-16): no
      `proctored` field at all (conveyed via a `'Proctored'` tag instead); `extended_time_available`
      is a real boolean. `price` is inc/ex-VAT still unconfirmed. (CSV #6)
- [ ] Audience filter for live events (students/schools/all)? (CSV #1)
- [ ] On-demand test links + location images for Practice Tests. (CSV #6)
