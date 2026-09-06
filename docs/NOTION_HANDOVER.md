# Notion handover notes — writing guide

Use this when a **page or component is live on staging** and the wider team or client needs to know how it behaves in Webflow, without reading the PRD.

Paste the note into Notion as Markdown. Keep a copy in the task thread. Do **not** treat this guide as a substitute for [`PRD.md`](./PRD.md) or [`TODO.md`](./TODO.md).

---

## Who it is for

Write for **two readers at once**:

| Reader | They need |
|---|---|
| Client / producer | What visitors see, intentional empty/error UX, what not to “fix” in Designer |
| Webflow author / engineer | Attributes, wrappers, CMS hooks, Summit → GWG binding names |

If a sentence only helps one of those readers, put it in a short **Authoring notes** section at the end, not in the opening.

---

## When to write one

Write a note after **staging verify**, when the DOM is the contract (attributes, section hide/show, CMS bank). Skip it for pure JS chores with no page behaviour (renaming a constant, CI).

One note **per page or distinct visitor surface** (Webinars, Mock Tests, University Fairs). Two lists on one page stay in **one** note if they share a story (Featured + Upcoming).

---

## Voice

- **Lead with what is true for the visitor**, then how the DOM makes that happen.
- Short sentences. Tables over prose for attributes and flags.
- Name **intentional** UX (e.g. hide the whole upcoming section when empty) so nobody “fixes” it with a no-results message.
- Use **GWG names** (`status === 'ready'`, `viewMore()`). If Summit leftovers exist, one mapping table — then stop mentioning Summit.
- Status line at the top: where it is live, and the date.

Skip: architecture essays, esbuild, store internals, commit SHAs, “we decided to…”. Those live in the PRD.

---

## Shape (copy this outline)

### 1. Title + status

`# {Page name} — how it works (DOM)`

One line: **Status**, environment (staging / production), date, where data comes from (API vs CMS vs Sheet).

### 2. What visitors see

Numbered blocks on the page. For each: what it shows, limits, pagination.

Call out empty/error behaviour in **plain language** before any `x-show`. If a section vanishes instead of showing “no results”, say that in this section — it is the most likely support question.

### 3. How the lists (or component) are configured

- Alpine `x-data` name.
- Table: instance → attributes → role.
- Footer `startAlpine([...])` snippet if the page needed a new component name.

### 4. States in the Designer

Table: visitor outcome → Alpine expression. Prefer `status === '…'` over old flag names.

If a **whole Webflow section** should hide, say which wrapper to bind and which status hides it. That is the webinars upcoming pattern: loading may show; `empty` hides the section; no empty-state copy.

### 5. Card / row fields

Bullet the bindings authors actually type (`event.name`, `dateRange(event)`, `tagImage(event).src`). One line on `x-for` on the **visible** card (the Alpine bridge wraps `<template>` at runtime).

### 6. Extra data sources (only if the page has them)

CMS image bank, Google Sheet URL, hidden collection lists: **where** they sit (page-level vs inside `x-data`), **which attributes**, and the gotcha (e.g. empty `srcset` / `sizes`).

### 7. Authoring notes

Short bullets: optional attributes (`query-is_online`), filters this page does **not** use, local script mode for debugging. Positive phrasing: “Upcoming empty → hide section” rather than a long list of bans.

---

## What stays out of Notion

| Lives in | Examples |
|---|---|
| PRD | Module signatures, why one `eventList`, API types |
| TODO | Checkbox progress, “blocked on GWG” |
| README | Full attribute catalogue for every page |
| Notion note | This page’s instances, visitor UX, Designer bindings, intentional empty behaviour |

If the attribute already has a full table in the README, the Notion note only lists **the values this page uses**.

---

## Markdown that pastes cleanly

Notion handles: `#` / `##`, tables, fenced `html` / `js` blocks, **bold**, bullet and numbered lists.

- Keep tables to **3–4 columns**.
- Fence real markup (`html`) so attributes are copyable.
- Avoid nested tables and HTML `<details>`.
- Relative repo links (`docs/PRD.md`) are useless in Notion — say “repo PRD §6” or paste a Notion/Google link if the team has one.

---

## Done when

A producer can answer: what the visitor sees, what happens with too few items, and that empty hide is deliberate.  
An author can wire or repair the page from the tables and snippets without opening `event-list.ts`.
