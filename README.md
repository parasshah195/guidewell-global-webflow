# Webflow JS Starter

This GitHub project provides a development workflow for JavaScript files in Webflow JS Starter.

In essence, it uses bun to start a development server on [localhost:3000](http://localhost:3000), bundle, build and serve any working file (from the `/src` directory) in local mode. Once pushed up and merged into `main`, it's auto-tagged with the latest semver tag version (using Github CI), and the production code will be auto-loaded from [jsDelivr CDN](https://www.jsdelivr.com/).

**Keep the repository public for jsDelivr to access and serve the file via CDN**

## Install

### Prerequisites

- Have [bun](https://bun.sh/) installed locally. Installation guidelines [here](https://bun.sh/docs/installation) (recommended approach - homebrew / curl)
   - Alternatively, `pnpm` or `npm` will work too.

### Setup

- Run `bun install`
   - Alternatively, `pnpm install` or `npm install`

## Usage

After repository migration, update the repo name and URL in this README file, and the `./src/entry.ts`.

### Output

The project will process and output the files mentioned in the `files` const of `./bin/build.js` file. The output minified files will be in the `./dist/prod` folder for production (pushed to github), and in the `./dist/dev` used for local file serving (excluded from Git).

### Development

1. The initial `entry.js` file needs to be made available via external server first for this system to work (in the `<head>` area of the site).

   ```html
   <script src="https://cdn.jsdelivr.net/gh/parasshah195/guidewell-global-webflow/dist/prod/entry.js"></script>
   ```

   For occasional localhost testing when editing `entry.js`, you'll have to manually include that script like following:
   ```html
   <script src="http://localhost:3000/entry.js"></script>
   ```

2. **Load scripts dynamically using `window.loadScript`**

   You can load any script (relative to your repo or a full CDN URL) as a module using the global `window.loadScript` function. This is the recommended way to load scripts in this setup.

   **Usage:**
   ```js
   // Load a relative script (from CDN or localhost, depending on env)
   window.loadScript('global.js');

   // Load an external library from a CDN, with options
   window.loadScript('https://cdn.jsdelivr.net/npm/some-lib@1.0.0/dist/index.js', {
     placement: 'head', // 'head' or 'body' (default: 'body')
     scriptName: 'some-lib', // Optional: emits a custom event 'scriptLoaded:some-lib' when loaded
     defer: true, // (default: true)
     isModule: true // (default: true)
   });
   ```
   - All scripts are loaded as ES modules by default.
   - The function deduplicates by URL (won't load the same script twice).
   - You can listen for a custom event when a script is loaded:

      ```js
      document.addEventListener('scriptLoaded:some-lib', (e) => {
        // e.detail.url, e.detail.scriptName
        // Your code here
      });
      ```

   - **Options:**
     - `placement`: `'head' | 'body'` (default: `'body'`)
     - `defer`: `boolean` (default: `true`)
     - `isModule`: `boolean` (default: `true`)
     - `scriptName`: `string` (optional, for custom event)

   **Do not use the old `window.JS_SCRIPTS` set or batch loading. Use `window.loadScript` for all dynamic script loading.**

3. Whilst working locally, run `bun run dev` to start a development server on [localhost:3000](http://localhost:3000)
   - Alternatively, `pnpm run dev` or `npm run dev`

4. To switch between serving scripts from localhost or CDN, use the following in your browser console:

   - To serve scripts from localhost (when running the dev server):
     ```js
     window.setScriptMode('local');
     ```
   - To switch back to CDN serving mode:
     ```js
     window.setScriptMode('cdn');
     ```
   This preference is saved in the browser's localStorage. If the local server is not running, it will automatically fall back to CDN.

5. As you make changes to your code locally and save, the [localhost:3000](http://localhost:3000) server will serve those files.

#### Debugging

- Add any debug console logs in the code using the `console.debug` function instead of `console.log`. This way, they can be toggled on/off using the browser native "Verbose/Debug" level.
- There is an optional debug mode setup for development that can execute conditional logic using `window.IS_DEBUG` check. Execute `window.setDebugMode(true)` in the browser console to enable the debug mode. Execute `window.setDebugMode(false)` to disable the mode.

### Tests & CI

Unit tests run on `bun test` (colocated `*.test.ts`, no extra config; `bunfig.toml` preloads the
dayjs global). They gate two moments:

- **Before build:** `bun run build` runs `bun test` first (`"build": "bun test && …"`) and aborts if
  a test fails, so a red suite never produces `dist/prod/`.
- **Before merge:** `.github/workflows/ci.yml` runs `bun test` on every PR (a PR into `main` runs it)
  and on pushes to `dev`. Make the `CI` check **required** on `main` in branch protection so it
  actually blocks the merge.

> **Planned production CI (see [`docs/PRD.md`](docs/PRD.md) §13).** The current setup is temporary:
> the build is local and `dist/prod/` is committed for jsDelivr to serve. When the build moves into
> CI and pushes to a custom CDN, `dist/prod/` gets gitignored and the deploy job runs one fail-fast
> sequence `install → bun test → bun run build → push to CDN` (a red test blocks the deploy). At that
> point the `bun test &&` chain is dropped from the `build` script — CI becomes the single gate.

### Publishing the code to CDN

1. Run `bun run build` to generate the production files in `./dist/prod` folder (it runs `bun test`
   first and stops on failure)
   - Alternatively, `pnpm run build` or `npm run build`

2. To push code to production, merge the working branch into `main`. A Github Actions workflow will run tagging that version with an incremented [semver](https://semver.org/) tag. Once pushed, the production code will be auto loaded from [jsDelivr CDN](https://www.jsdelivr.com/).
   - By default, the version bump is a patch (`x.y.{{patch number}}`). To bump the version by a higher amount, mention a hashtag in the merge commit message, like `#major` or `#minor`

3. To create separate environments for `dev` and `staging`, respective branches can be used, and the [jsDelivr file path can be set to load the latest scripts from those respective branches](https://www.jsdelivr.com/documentation#id-github). Note: The [caching for branches lasts 12 hours](https://www.jsdelivr.com/documentation#id-caching) and would hence require a manual purge.
   - To do so, override the `window.PRODUCTION_BASE` variable in the HTML file after the inclusion of `entry.js` script.

#### jsDelivr Notes & Caveats

- Direct jsDelivr links directly use semver tagged releases when available, else falls back to the master branch [[info discussion link](https://github.com/jsdelivr/jsdelivr/issues/18376#issuecomment-1046876129)]
- Tagged version branches are purged every 12 hours from their servers [[info discussion link](https://github.com/jsdelivr/jsdelivr/issues/18376#issuecomment-1046918481)]
- To manually purge a tagged version's files, wait for 10 minutes after the new release tag is added [[info discussion link](https://github.com/jsdelivr/jsdelivr/issues/18376#issuecomment-1047040896)]

[**JSDelivr CDN Purge URL**](https://www.jsdelivr.com/tools/purge)

## OneCanoe Events integration

On top of the starter above, this repo layers Alpine.js components — configured entirely through
HTML attributes — that surface the OneCanoe Events API on GWG pages. Full spec/rationale lives in
[`docs/PRD.md`](docs/PRD.md); this section is the quick reference for Webflow authors wiring up a page.

### Loading components on a page

Each page loads only the components it uses via `window.startAlpine`, in a footer embed
(inside `Webflow.push` so the DOM is ready):

```html
<script>
  window.Webflow ||= [];
  window.Webflow.push(() => window.startAlpine(['event-list']));
</script>
```

Component bundles load first (so their `alpine:init` listeners are registered), then `alpine.js`
loads last and calls `Alpine.start()`. Pass every component name the page uses, e.g.
`window.startAlpine(['event-list', 'event-code-search'])`.

### `eventList` — the one events component

Covers every events feed (Home, Practice Tests, Group Classes, Webinars, Events page). Put these
attributes on the element carrying `x-data="eventList"` (its root — read via `this.$root`, no
`x-ref` needed):

**`query-*`** — API parameters, type-coerced by shape (number/date/bool/array/string). Any
`QueryParams` key from `src/api/types.ts`, prefixed `query-`:

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

**`data-*`** — display config:

| Attribute | Values | Effect |
|---|---|---|
| `data-group-by` | `location` \| (absent) | `location`: exposes `groups` (in-person first, then Online, then Online (On Demand)), each with a `priceSummary`. Absent: flat `events` list. |
| `data-use-filters` | present / absent | Subscribes to the `filters` store; re-queries (debounced) on change. |
| `data-topics-exclude` | `SAT,ACT` | Drops events whose topics intersect this list. |

Template state: `events`, `groups`, `status` (`'loading' | 'error' | 'empty' | 'ready'` — bind
exactly one block per value, e.g. `x-show="status === 'error'"`), plus `depleted` / `moreLoading`
(apply only while `ready`). Helpers: `dateRange(event)`, `timeRange(start, end)`,
`isProctored(event)` (badge an event as proctored — reads its `'Proctored'` tag; there's no
`proctored` field on the API), `viewMore()`. A `filters.proctored` toggle (below) sends
`tags: ['Proctored']` as a real, server-side-filtered request param — confirmed the API filters
`tags` correctly, so this doesn't fetch-then-filter (which would break pagination/"load more").

```html
<div x-data="eventList" query-category="['marketing_event']" query-limit="12" data-use-filters>
  <template x-if="status === 'loading'"><div>Loading…</div></template>
  <template x-if="status === 'error'"><div>Something went wrong.</div></template>
  <template x-if="status === 'empty'"><div>No events found.</div></template>
  <template x-for="event in events" :key="event.id">
    <div>
      <span x-text="event.name"></span>
      <span x-text="dateRange(event)"></span>
    </div>
  </template>
  <button x-show="status === 'ready' && !depleted" x-bind:disabled="moreLoading" @click="viewMore()">
    View more
  </button>
</div>
```

### Filter UI — bind directly to the `filters` store

There's no separate filter-form component; Webflow filter controls bind straight to the
behavioral `filters` store (`src/stores/filters.ts`):

```html
<input type="checkbox" @change="$store.filters.toggleTest('SAT')">
<select x-model="$store.filters.location">
  <option value="both">All</option>
  <option value="online">Online</option>
  <option value="in-person">In-person</option>
</select>
<input type="date" x-model="$store.filters.dateAfter">
<input type="date" x-model="$store.filters.dateBefore" x-bind:min="$store.filters.dateAfter">
<button @click="$store.filters.reset()">Reset</button>
```

The store hydrates from the URL once on load, then mirrors changes back to the URL (shareable/
bookmarkable filters). Any `eventList` with `data-use-filters` re-queries automatically.

### `eventCodeSearch` — find event by code

Redirects to the matching event's page, or exposes `isError` for a Webflow-authored error message:

```html
<div x-data="eventCodeSearch">
  <input type="text" x-model="eventCode">
  <button x-bind:disabled="isLoading" @click="search()">Find</button>
  <span x-show="isError">No event found for that code.</span>
</div>
```

### Config

`src/constants.ts` is the single config surface: `API_BASE` (OneCanoe path slug),
`DEFAULT_EVENT_LIMIT`, `DEFAULT_TIMEZONE`, and `TEST_TOPIC_IDS` (per-test topic IDs used by the
filter store's `tests` → `topics` mapping). `API_BASE` and `TEST_TOPIC_IDS` are placeholders until
confirmed by GWG/OneCanoe (see PRD §10) — everything else is wired around them.
