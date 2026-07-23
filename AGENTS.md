# AGENTS.md — GuideWell Global Webflow

Master context for working in this repo. Read this first, then [`docs/PRD.md`](docs/PRD.md)
before writing any code.

---

## What this repo is

Custom JavaScript for the **GuideWell Global (GWG)** Webflow marketing site. The site is built
in Webflow; we layer behaviour on top with **Alpine.js components configured via HTML attributes**
placed on the Webflow-authored structure. The main job is integrating the **OneCanoe Events API**
(public events) across pages — lists, filters, search.

It started from the `webflow-js-starter` template (esbuild + TypeScript + bun; deploys to jsDelivr).

**Reference build:** the **Summit** project (`../summit-project-webflow-site`) targets the *same*
OneCanoe org and solves the same problems. Consult it for working patterns — but it's over-grown
(~29 components); we're building a leaner version. See PRD §2 for what to reuse vs. drop.

---

## Working agreement (how to work in this repo)

1. **The PRD is the spec.** [`docs/PRD.md`](docs/PRD.md) defines scope, architecture, the attribute
   contract, module signatures, and config. Implement to it. If reality diverges from the PRD,
   update the PRD in the same change — don't let them drift.
2. **The TODO is the plan of record.** [`docs/TODO.md`](docs/TODO.md) is an ordered, phased
   checklist. Work through it in order.
3. **Mirror TODO items into tasks, and check them off.** When you start a TODO step, create a task
   (TaskCreate) for it and mark it `in_progress`; when it's done **and its verify passes**, mark the
   task `completed` **and tick the matching `- [ ]` → `- [x]` in `docs/TODO.md`**. The checkboxes are
   the durable progress record across sessions; the task list is the in-session view. Keep them in sync.
4. **Don't mark anything done on a failing verify.** Each TODO group ends with a verify step
   (`bun run build`, `bun test`, etc.). Green before checked.
5. **Confirm the open items, don't guess.** API slug, topic IDs, and the API's `proctored`/VAT
   behaviour are unknown (PRD §10). They block *live* verification, not foundation work — leave the
   `constants.ts` placeholders until GWG confirms.

---

## Tech stack

| Concern | Choice |
|---|---|
| Language | TypeScript (ESM) |
| Bundler | esbuild (via `bin/build.js`) |
| Runtime/PM | **bun** (recommended); pnpm/npm also work |
| Frontend | **Alpine.js** (attribute-driven, no build-time framework) |
| Dates/timezones | **dayjs** (+ `utc`, `timezone`, `advancedFormat`) — required for tz-correct API round-trip |
| Date-range UI | **EasePick** (`@easepick/core` + `range-plugin`) — single input, start+end |
| API | OneCanoe Events REST (`POST /events`), same host as Summit, GWG-specific slug |
| Hosting | jsDelivr CDN (serves `dist/prod/` from the public GitHub repo) |
| Lint/format | ESLint (`@finsweet`) + Prettier (configs present) |
| Tests | `bun test` (built-in; used for pure-logic checks like the attribute parser) |

---

## Setup & dev workflow

```bash
bun install
bun run dev      # esbuild watch + serves dist/dev at http://localhost:3000
bun run build    # production: minified, tree-shaken → dist/prod/
bun test         # unit checks
```

**How JS reaches Webflow (the local-swap dev loop — already built, don't rebuild):**
- `entry.js` is loaded once in the Webflow site `<head>` (jsDelivr URL; or `localhost:3000/entry.js`
  when editing entry itself). It defines `window.loadScript` and (to be added) `window.startAlpine`.
- Per page, a footer embed calls `window.startAlpine([...component names])` (see PRD §9).
- In the browser console: `window.setScriptMode('local')` serves bundles from `localhost:3000`;
  `window.setScriptMode('cdn')` switches back. Preference persists in localStorage and **auto-falls
  back to CDN** if the local server isn't running (`src/dev/env.ts`).
- Debug logs: use `console.debug` (toggle via browser Verbose level) or gate on `window.IS_DEBUG_MODE`
  (`window.setDebugMode(true)`).

**Deploy:** merge to `main` → GitHub Actions auto-tags a semver release and jsDelivr serves it.
Default bump is patch; put `#minor` / `#major` in the merge commit message to bump higher.
Current branch is `dev`; do feature work off `dev`, PR into `main`.

---

## Architecture essentials (the non-obvious rules)

- **Only `src/alpine.ts` imports Alpine.** It sets `window.Alpine`, runs the Webflow DOM fixup,
  registers the `filters` store, and calls `Alpine.start()`. Components use the global `window.Alpine`.
- **Components never import Alpine.** Each registers on `window.addEventListener('alpine:init', () =>
  window.Alpine.data('name', …))`. This keeps esbuild from bundling Alpine into every component file.
- **Load order matters:** `startAlpine` loads component bundles first, then `alpine.js` last, so every
  component's `alpine:init` listener exists before `Alpine.start()` fires.
- **Webflow bridge is mandatory** (`src/alpine.ts`, ported from Summit `alpineWebflow.ts`): Webflow
  can't author `<template>` elements or `.` in attribute names, so we rewrite `x-bind:foo`→`.` syntax
  and wrap bare `x-for`/`x-if` in `<template>` before start.
  - **Never hand-author `<template>` tags in Webflow.** The Designer doesn't render `<template>`
    content in preview/canvas — an author who wrapped an element in one would be editing invisible
    markup. Instead, put `x-for`/`x-if` directly on the real, visible element in the Designer; the
    `wrapInTemplate()` helper in `alpine.ts` (via `webflowBridge()`) moves that element into an actual
    `<template>` in JS at runtime, before `Alpine.start()`. This keeps the element visible/editable in
    Webflow's live preview while still behaving correctly once Alpine boots.
- **One API function:** `fetchEvents(params)` in `src/api/events.ts`. No class hierarchy.
- **One generic component:** `eventList` covers every events feed; behaviour is set by `query-*`
  (API params) and `data-*` (display) attributes read off `this.$root`. See the **attribute contract**
  in PRD §6 — that's the public API Webflow authors use.
- **One shared store:** `filters` (PRD §8). Lists opt in via `data-use-filters`. `filterForm` binds the
  Webflow filter UI to it and mirrors it to the URL (shareable/bookmarkable).

---

## Repo layout

```
docs/PRD.md, docs/TODO.md   # spec + checklist (source of truth)
bin/build.js                # esbuild config + dev server; `files[]` = entry points
src/
  entry.ts                  # loadScript + startAlpine (loaded in Webflow <head>)
  alpine.ts                 # Alpine bootstrap + Webflow bridge (only Alpine import)
  global.ts                 # site-wide bits (current year)
  constants.ts              # CONFIG: API_BASE slug, limits, timezone, TEST_TOPIC_IDS
  api/        types.ts, events.ts
  stores/     filters.ts
  components/ *.ts           # one Alpine component per file; auto-bundled by build.js glob
  utils/      *.ts (+ *.test.ts)
  dev/        debug, env, console-styles (local/CDN switching, debug mode)
  types/      global.d.ts (window globals), alpine.ts (ThisType helper)
```

Adding a new component = drop a `.ts` in `src/components/` (the build globs it) and list it in the
page's `startAlpine([...])` call. New top-level entry files (like `alpine.ts`) must be added to the
`files` array in `bin/build.js`.

---

## Coding conventions

- **TypeScript path aliases** (`tsconfig.json`): `$utils/*`, `$types/*`, `$dev/*`, plus this project's
  `$api/*`, `$stores/*`, `$constants`. esbuild resolves these too — prefer them over deep relative paths.
- **Prettier:** single quotes, semicolons, 2-space, width 100, `es5` trailing commas, sorted imports.
  **ESLint:** `@finsweet` config; `console` allowed.
- **Type the boundary, not everything:** API request/response types are strict (`src/api/types.ts`);
  component internals use the `AlpineComponent<T>` `ThisType` helper. Note esbuild does **not**
  type-check — keep types honest manually (run `bunx tsc --noEmit` if you want a gate).
- **Lazy/minimal by default (ponytail + karpathy guidelines are active):**
  - YAGNI — build only what the PRD's current phase asks. Don't port Summit features no GWG page uses.
  - Surgical changes — touch only what the task needs; match surrounding style; don't refactor working code.
  - Native first, with two deliberate exceptions (dayjs, EasePick — PRD §2). No new dependency for a few lines.
  - Mark intentional shortcuts with a `// ponytail:` comment naming the ceiling/upgrade path
    (e.g. the placeholder API slug, the naive `depleted` heuristic).
  - Leave one runnable check on risky pure logic (e.g. `parseAttrValue` coercion via `bun test`).
- **Naming:** files kebab-case (`event-list.ts`); Alpine component/store names camelCase (`eventList`,
  `filters`); attributes kebab/`query-`/`data-` per the contract.

---

## Implementation gotchas

- **dayjs for all event time math** — the API exchanges timestamps with offsets + a `timezone` param.
  Format and build `after`/`before` in `DEFAULT_TIMEZONE` (Europe/London) via dayjs; don't use raw
  `Date` formatting for display.
- **EasePick needs its CSS** — add the pinned CDN `<link>` in the Webflow page `<head>` (or inject in
  `filterForm.init()`). The store holds dates as plain `YYYY-MM-DD` strings; dayjs converts on query.
- **`constants.ts` is the only file needing real values before go-live** — `API_BASE` slug and
  `TEST_TOPIC_IDS`. Everything else is wired around them.
- **Error/empty/depleted states are part of the deliverable** (CSV #10) — `eventList` exposes
  `isLoading` / `isEmpty` / `isError` / `depleted`; wire them in the Webflow markup.

---

## Source-of-truth docs
- [`docs/PRD.md`](docs/PRD.md) — full spec (scope, architecture, attribute contract, signatures, config, verification).
- [`docs/TODO.md`](docs/TODO.md) — phased execution checklist; keep checkboxes in sync with progress.
