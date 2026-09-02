# University Fair Events Alpine component — research and initial plan

## Recommendation

For the public University Fairs feed, use Google Sheets **Publish to web** for one specific tab and
fetch the generated CSV URL with native `fetch`.

This is the best default for this site because it:

- needs no OAuth flow, service account, browser API key, Google client library, or proxy;
- is intended by Google for publishing a file to a large public audience;
- keeps the Google-specific transport inside one small component; and
- fits the repo's existing per-page Alpine bundle and loading/error/empty-state pattern.

The tradeoff is freshness: Google says published edits can take a few minutes to appear. If the
feed later needs immediate updates or a stronger JSON contract, move the adapter to the versioned
Sheets API v4 `spreadsheets.values.get` endpoint, preferably behind a cached first-party endpoint.

“Anyone with the link” sharing and “Publish to web” are different. The owner must explicitly
publish only the intended tab. Everything in that tab must be safe for unrestricted public access.

## Proposed architecture

Use one production file: `src/components/university-fair-events.ts`.

The `universityFairEvents` Alpine component owns the complete flow:

- read the published CSV URL from `this.$root.dataset.sheetUrl`;
- fetch once from `init()`;
- reject missing URLs and non-2xx responses;
- parse CSV correctly, including quoted commas, quotes, and newlines;
- turn the first row into dynamic property names;
- turn every subsequent row into a `Record<string, string>`;
- expose the parsed data and UI state to Webflow; and
- catch transport and parsing failures and set the error state.

Its Webflow-facing state is:

```ts
columns: string[];
rows: Array<Record<string, string>>;
status: 'loading' | 'error' | 'empty' | 'ready';
```

Every unique, non-empty header is preserved exactly and becomes a property on every row. Webflow
can use dot notation for identifier-safe names (`row.name`) or bracket notation for any header
(`row['University Name']`). `columns` lets Webflow iterate without knowing the headers in advance:

```html
<div x-data="universityFairEvents" data-sheet-url="PUBLISHED_CSV_URL">
  <div x-show="status === 'loading'">Loading…</div>
  <div x-show="status === 'error'">Unable to load data.</div>
  <div x-show="status === 'empty'">No data found.</div>

  <div x-for="row in rows">
    <div x-for="column in columns">
      <span x-text="row[column]"></span>
    </div>
  </div>
</div>
```

The real Webflow frontend can still bind known headings directly when it wants a designed card;
the JavaScript does not define or whitelist those headings.

### Current live behavior to preserve

The supplied implementation currently reads ten positional columns:

| Live sheet header | Current use |
|---|---|
| School Name | Card heading; falls back to `TBC`; rows without it are discarded |
| Region | Location text; location block hidden when empty |
| Date | Required for display; past and invalid dates discarded; upcoming rows sorted ascending |
| Time | Time text; time block hidden when empty |
| Audience | Loaded but not displayed |
| How to Register | First URL becomes a Register link; otherwise first email becomes a `mailto:` link; button hidden for other/empty values |
| Additional Info | Plain text; information block hidden when empty |
| Online/In-Person | Loaded but not displayed |
| Event Type | Loaded but not displayed |
| School Website | Website link; button hidden when empty |

The date badge is derived from `Date` as weekday, day, and abbreviated month plus year. The live
markup also has distinct loading, empty, and error states.

The Alpine port preserves the useful transformations without embedding those column names in
TypeScript. The component exposes column-agnostic helpers that accept a cell value:

```ts
dateParts(value: string): { weekday: string; day: string; monthYear: string } | null;
isUpcoming(value: string): boolean;
upcomingRows(dateColumn: string, requiredColumn?: string): Array<Record<string, string>>;
registration(value: string): { kind: 'url' | 'email' | 'none'; href: string; label: string };
websiteUrl(value: string): string;
```

Webflow chooses the columns when binding the card, for example:

```html
<div x-for="row in upcomingRows('Date', 'School Name')">
  <h3 x-text="row['School Name'] || 'TBC'"></h3>
  <div x-show="row['Region']" x-text="row['Region']"></div>
  <div x-show="row['Time']" x-text="row['Time']"></div>
  <div x-show="row['Additional Info']" x-text="row['Additional Info']"></div>
</div>
```

This keeps every column available in `rows`, including currently unused `Audience`,
`Online/In-Person`, and `Event Type`, while allowing a future sheet to use entirely different
headers. If the actual header is renamed, only the Webflow binding changes.

`status === 'empty'` means the published sheet has no data rows. For the current page, the empty
block also checks
`status === 'ready' && upcomingRows('Date', 'School Name').length === 0`, preserving the old “no
upcoming events” behavior without making `Date` or `School Name` component-level constants.

The Alpine component does not clone cards, query `[data-role]` elements, or construct UI with
`innerHTML`. Webflow owns the existing card and state markup; Alpine supplies `x-for`, `x-show`,
`x-text`, and `x-bind:href`. Put `x-for` directly on the visible Webflow card so the existing
Webflow bridge wraps it at runtime.

Do not add `gapi`, OAuth, Apps Script, a service class, generic repository abstraction, pagination,
client caching, a separate API module, a separate type module, or an `APIResponse` mapping. A short
public sheet does not need them.

This intentionally replaces the current PRD's proposed “adapter → `APIResponse` → `eventList`”
direction. The implementation change must update `docs/PRD.md` and `docs/TODO.md` before checking
off Phase 4.

## Dynamic sheet contract

There is no predefined column schema:

- Row 1 supplies the property names.
- Headers are preserved exactly; their order is preserved in `columns`.
- Headers must be non-empty and unique because an object cannot safely expose duplicate keys.
- Each non-blank data row becomes one object in `rows`.
- Short rows receive `''` for missing trailing cells.
- Extra cells beyond the header count are ignored.
- Entirely blank rows are ignored.
- Cell values remain strings as published; the component does not guess dates, numbers, or booleans.
- Trimming is done only inside display helpers; the raw published strings remain available in `rows`.
- Formulas are acceptable only when the published output contains the final value needed by the UI.
- No personal, private, draft, or operational data belongs in the published tab.

## Implementation plan

### 1. Confirm inputs

- Confirm the published URL currently in use remains the intended source, but pass it through a
  Webflow component property rendered as `data-sheet-url`; never hardcode it in TypeScript.
- Confirm the live sheet's exact header text and a representative sample row.
- Confirm whether the page should keep the current upcoming-only date filtering and sort.
- Confirm how the frontend will address arbitrary headers: `row.header` or `row['Header label']`.
- Confirm that explicit public publishing is acceptable.

### 2. Run a transport spike

- Publish only a disposable/sample tab as CSV.
- From the deployed GWG staging origin, fetch the exact generated URL.
- Verify CORS, redirects, response content type, UTF-8 characters, quoted fields, blank cells, and
  how quickly an edit appears.
- Stop if browser JavaScript cannot read the response. Do not use `mode: 'no-cors'`, because that
  produces an unreadable opaque response.

### 3. Lock the contract and update the plan of record

- Replace the PRD's `APIResponse` mapping with the single-file, dynamic-column contract above.
- Expand the single Phase 4 item in `docs/TODO.md` into ordered build/test/wiring/live-verify items.

### 4. Build the single component

- Add `src/components/university-fair-events.ts` containing registration, state, fetch, CSV
  parsing, dynamic row mapping, and error handling.
- Follow the repo's existing `alpine:init`, `AlpineComponent<T>`, `status`, and Webflow bridge pattern.
- Keep the parser local to this file. It must handle standard CSV quoting; do not use `split(',')`.
- Add the column-agnostic date, upcoming-row, registration, and website helpers needed to reproduce
  the supplied frontend.
- Validate generated links: allow only `http:`, `https:`, and the explicitly generated `mailto:`
  registration link.
- Add `university-fair-events` to the page's `window.startAlpine([...])` call.
- Keep all display markup in Webflow.

### 5. Leave one runnable check

- Add `src/utils/university-fair-events.test.ts`, importing the parser from the component and
  covering quoted commas,
  escaped quotes, quoted newlines, dynamic headers, missing trailing cells, duplicate headers, and
  blank rows.
- Cover the preserved live behavior once: local-calendar date parsing, past-event removal,
  chronological sorting, registration URL/email parsing, and website URL validation.
- This is the only additional source file: production behavior remains entirely in the component.

### 6. Wire and verify

- `bun test`
- `bunx tsc --noEmit`
- `bun run build`
- Staging checks: ready, empty, network error, duplicate/blank headers, arbitrary column names,
  special characters, upcoming-only ordering, optional blocks/buttons, safe links, responsive
  markup, and a real sheet edit propagating to the page.
- Tick the matching `docs/TODO.md` items only after their verification passes.

## When to choose another transport

| Option                          | Use when                                                                            | Why not the default                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Sheets API v4 `values.get`      | Near-immediate freshness, explicit A1 ranges/value rendering, or JSON is required   | Needs a Cloud project and API key for public data; browser keys must be tightly restricted and public traffic consumes shared quota |
| Google Visualization `/gviz/tq` | The sheet is only link-shared and keyless querying by range/filter is essential     | Official but returns Visualization/JSONP-shaped data; column queries use letters and add parsing/protocol coupling                  |
| Apps Script web app             | The source becomes private or needs server-side transformation/sanitization/caching | Adds deployment ownership, quotas, redirects, and another runtime                                                                   |
| First-party cached endpoint     | Traffic or reliability exceeds direct Google-hosted delivery                        | Additional infrastructure is unnecessary until measurements justify it                                                              |

## Primary sources

- [Google Docs Editors Help: publish files to the web](https://support.google.com/docs/answer/183965)
- [Google Sheets API: `spreadsheets.values.get`](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get)
- [Google Sheets API usage limits](https://developers.google.com/workspace/sheets/api/limits)
- [Google Workspace: create credentials for public data](https://developers.google.com/workspace/guides/create-credentials)
- [Google Cloud: manage and restrict API keys](https://docs.cloud.google.com/docs/authentication/api-keys)
- [Google Charts: Google Spreadsheets data sources](https://developers.google.com/chart/interactive/docs/spreadsheets)
- [Google Visualization datasource protocol](https://developers.google.com/chart/interactive/docs/dev/implementing_data_source)
- [Google Apps Script web apps](https://developers.google.com/apps-script/guides/web)
- [Google Apps Script Content Service](https://developers.google.com/apps-script/guides/content)
- [MDN: Cross-Origin Resource Sharing](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)
