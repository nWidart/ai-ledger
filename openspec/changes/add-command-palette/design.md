# Design

## Context

See `proposal.md` for why, and `specs/command-palette/spec.md` for the behavior. The current state that shapes the approach:

- `web/src/hash.ts` is the single URL layer. `parseHash()` reads the hash into `HashState` plus `raw`; `applyPatch()` and `formatHash()` build a canonical hash; `setHash(patch)` pushes when a `PUSH_KEYS` key changes and replaces otherwise; `navigate(href)` pushes one entry for a page switch and scrolls to the top. `SHARED_KEYS` (`project`, `range`, `source`, `auto`) travel between pages through `sharedHash()`. Page-only keys (Errors: `sub`, `noise`, `gran`, `ex`, `cat`) stay behind.
- Today one user action writes the URL once: a filter is one `setHash`, a nav tab is one `navigate`. Nothing yet changes page and hash together, and calling `navigate` then `setHash` would add two entries.
- `App.tsx` maps `/usage`, `/cost`, `/errors` and `/limits` to pages and renders `<Nav />` and the page. Nav owns the ingest status poll and the Refresh button state (`refresh()` is local to `Nav`).
- Sheets: `UsageSheets` is mounted on Activity, Cost and Errors (Errors passes `automated`). It opens the project sheet (`inspect`), the tool, MCP and skill inspector (`tool`, `mcp`, `skill`, at most one) and the session sheet (`session`). Limits mounts no sheet host. An error category is Errors' own `cat` key, which only Errors reads.
- Errors keeps its view in the hash and its last view in `localStorage` (`claude-errors-view`). `readView()` takes the saved view only when the hash has none of its keys (`project`, `range`, `source`, `sub`, `noise`, `gran`, `cat`, `ex`); any one of them makes the hash the whole view. After load, Errors writes its view back with a replace (`setHash(viewPatch(view), { push: false })`) and saves it. Errors ignores `auto`: it always includes automated sessions.
- `Filters` clears `session` and `inspect` when the project or source changes; tool sheets stay.
- Data: `/api/usage` returns the heavy page payload (daily series, sessions, timelines' inputs) with `projects` as plain names, and `tools`, `mcp` and `skills` with calls and failure rate for the view. It has no error categories. `/api/errors` is all-time and holds every failed call. `/api/sessions?q=` filters the view's sessions on id, project and branch and returns titles. `useApi` and `fetchCached` cache answers by URL until an ingest lands.
- Category ids and labels come from `categorize.RULES`.

## Goals / Non-Goals

**Goals:**
- One pure, unit-tested function turns the palette's chips and the current location into the target path and hash, and the footer text.
- One commit is one `pushState`.
- Suggestions come from one small, cached request per facet combination.

**Non-Goals:**
- No new hash keys and no change to how pages read the hash.
- No session search on titles: `/api/sessions?q=` keeps its current matching.
- No palette entry for the project sheet (`inspect`): a project is a `#` filter.
- No change to Errors' saved-view logic.

## Decisions

### Suggestions from a new `/api/palette` endpoint
`GET /api/palette?project=&range=&source=&automated=1` returns, for the view the palette's filter chips describe:

```
projects:   [{ name, sessions }]            # under range, source, automated; ignores the project chip
sources:    [{ source, sessions }]          # under project, range, automated; ignores the source chip
tools:      [{ name, calls, errors, failure_rate }]   # under the whole view, calls > 0 only
mcp, skills: same shape as tools
categories: [{ id, label, errors }]         # under project, range, source, automated always on (Errors' rule)
```

`metrics.palette()` builds it from `view()` and `scope()`, with the same `tool_calls JOIN sessions` filter that `usage()` uses for its tool rows, so counts agree with Activity. Each facet's own counts leave that facet out, so `#alpha` still shows how many sessions `beta` has. Pages, ranges, the automated filter and commands are static lists in the frontend. Sessions come from `/api/sessions?q=` with the same view, only when the term has two or more characters and could be a session (bare text or `>`), debounced by 150 ms, showing the first five.

The palette fetches through `useApi(paletteUrl(view), { keepPrevious: true })`, so reopening the palette or going back to a facet combination costs nothing, and the list keeps its rows while a new combination loads. The cache clears on ingest like every other payload.

- Alternative: reuse the cached `/api/usage` payload. Rejected. It has no project counts and no categories, so it needs `/api/errors` too (every failed call, all time). And each new facet combination in the palette would compute a whole usage payload, sessions and series included, to read four lists. That is too slow for a list that should update as chips change.
- Alternative: compute counts client side from `/api/errors` and `/api/usage`. Rejected for the same size reasons, and the per-project tool counts do not exist in either payload.
- Cost: one endpoint, one metrics function, Python tests, and one new fixture. The queries are group-bys over `tool_calls` and `sessions`, cheaper than the usage payload.

### Parser model: terms, chips, resolution
Three pure steps in `web/src/components/palette/`, with no React and no DOM, each unit-tested:

1. `terms(text)`: splits the input at a `#` or `>` that starts the text or follows a space. Each term has a sigil (`#`, `>` or none) and its text, so `>copy link` stays one term. The term under the caret drives suggestions.
2. `suggest(term, data, chips)`: ranked rows of `{ kind, value, label, sigil, counts }`. Kinds: `project`, `source`, `range`, `automated`, `page`, `tool`, `mcp`, `skill`, `session`, `category`, `command`. `#` limits to filter kinds and adds the "open inspector (>)" row for a matching tool, MCP server or skill. `>` limits to the other kinds. No sigil allows every kind. Picking a row returns a chip.
3. `resolve(chips, here)`: `here` is the current path and `parseHash(location.hash)`. It returns `{ path, raw, href, changed, footer, status }`, where `status` marks each chip as applied, replaced or dropped. Rules, in order:
   - Filters: one slot per key (`project`, `source`, `range`, `auto`). A later chip of the same key replaces the earlier one. Pre-filled chips fill the slots first, so removing one empties that slot and the key is cleared.
   - Sheets: one slot. A later sheet chip replaces the earlier one.
   - Pages: walk the chips in order. A page chip sets the page. A category chip sets the page to `/errors`, as if a page chip stood in its place. The last page wins and earlier page chips are marked replaced. If the winning page cannot host the sheet (a category on anything but Errors), the sheet is marked dropped.
   - No page: the current page when it hosts the sheet (Activity, Cost and Errors host tool, MCP, skill and session sheets; Errors hosts categories), else `/usage`. With no sheet, the current page.
   - Commands: one slot, the last wins. A command does not take the page or sheet slot.
   - Hash: staying on the page starts from the current `raw`; moving starts from the current shared keys only, as `sharedHash()` does. Then the filter slots apply. A project or source change clears `session` and `inspect`, as `Filters` does. A sheet clears `inspect`, `tool`, `mcp`, `skill` and `session` and sets its own key (`tool`, `mcp`, `skill`, `session`, or `cat` with `ex` cleared). On `/errors`, when the hash would hold none of Errors' view keys, `range` is written too, so `readView()` treats the hash as the whole view and does not substitute the saved view (see "Errors and its saved view"). `>errors #myproject` therefore still writes `/errors#project=myproject`.
   - `changed` is false when `href` equals the current path and hash and no command is set. Enter then just closes.

Typed terms before the caret become chips when they have exactly one exact match (case-insensitive name or label) as soon as the user types the next sigil. A term with no exact match stays text, and the footer says what does not match. Enter on it picks the highlighted row.

- Alternative: parse the whole line on Enter with no chips. Rejected. The proposal asks for chips, pre-fill and per-chip clash display, which need resolved terms while typing.

### One commit, one history entry
`hash.ts` gains `go(href)`: it does nothing when `href` equals the current location; otherwise it calls `history.pushState` once, notifies subscribers, and scrolls to the top only when the path changed. `navigate()` becomes `go()` with the path always changing, so the nav keeps its behavior. The palette computes the full `href` with `resolve()` and calls `go(href)`. It never calls `setHash` or `navigate` after it.

Writes that follow a commit are replaces and add no entry: `App`'s route normalization, `Filters` dropping an unknown source, and Errors writing its settled view back. Browser Back therefore returns to the pre-commit entry.

- Alternative: `navigate(path + sharedHash())` then `setHash(patch)`. Rejected: two pushes.
- Alternative: `setHash(..., { push: true })` for same-page commits and `navigate` for page changes. Works, but two code paths for one rule; `go(href)` covers both.

### Errors and its saved view
Errors only falls back to `claude-errors-view` when its hash has none of its view keys. Because `resolve()` writes `range` for `/errors` whenever the hash would otherwise hold none of those keys, a palette commit is never replaced by the saved view, and `>errors` from an unfiltered page shows an unfiltered Errors (spec "No filters set"). When the palette stays on Errors, the current `raw` keeps `sub`, `noise` and `gran`. When it moves to Errors, those take their defaults, as they do after a nav tab with a project set. Errors then saves the committed view as its new last view, through its existing effect. No change to `pages/errors/view.ts` is needed.

`#automated` on Errors writes `auto=1` like on any page. Errors ignores it; the footer notes that Errors always includes automated sessions.

### Fuzzy matching without a dependency
A scorer of about 40 lines in `palette/match.ts`, case-insensitive on the name and the label (so `claude code` and `claude` both match the source):

1. exact match,
2. prefix,
3. prefix of a word (after a space, `-`, `_`, `/`, `.` or `__`, so `gith` matches `mcp__github__…` and `time` matches `Command timed out`),
4. substring,
5. subsequence (`edt` matches `Edit`).

Ties go to the larger count (calls, sessions or errors), then to the shorter name. The list shows at most 8 rows per kind and 20 in all, kinds in a fixed order with the best score first. Matched characters are wrapped in `<mark>`.

- Alternative: a fuzzy-search library. Rejected: the lists hold at most a few hundred names, the project has no runtime dependency beyond React, and the proposal rules out new dependencies.

### Component placement and opening
- `components/palette/Palette.tsx`: a modal `<dialog>` (like `Sheet`), mounted once in `App` after the page: `<><Nav /><Page /><Palette /></>`. It stays mounted across page switches, so its state does not reset mid-gesture.
- `components/palette/store.ts`: a tiny external store (`openPalette()`, `closePalette()`, `usePaletteOpen()`) so `Nav`'s button and the global shortcut open the same instance.
- The shortcut is a `keydown` listener on `window` in `Palette`: `metaKey` on macOS, `ctrlKey` elsewhere, with `key === "k"`, ignored while `isComposing`. It calls `preventDefault()`. macOS is detected from `navigator.userAgentData?.platform` with `navigator.platform` as a fallback; the same check picks the button hint (`⌘K` or `Ctrl K`).
- On open, `prefill(parseHash(location.hash))` makes the filter chips: one per set shared key (`range` only when the hash names one).
- `Nav` gains the palette button before the status. Refresh moves from `Nav`'s local function to `components/refresh.ts`, a small store with `refresh()` and `useRefreshState()`, so `Nav` and the `>refresh` command run the same code and `Nav` shows the same status text.
- `>copy link` commits through `go(href)`, then writes `location.origin + href` with `navigator.clipboard.writeText`, and announces "Link copied" or "Could not copy the link" in the palette's page-level live region, which stays mounted after the dialog closes. `127.0.0.1` is a secure context, so the clipboard API is available.

### Accessibility: WAI-ARIA combobox with a listbox popup
- The dialog has `aria-label="Command palette"`. `showModal()` makes the page inert, as the sheets do. Focus returns to the element that had it before opening.
- The input has `role="combobox"`, `aria-expanded`, `aria-controls` pointing at the list, `aria-autocomplete="list"` and `aria-activedescendant` set to the highlighted option. Focus never leaves the input while the user moves through the list.
- The list has `role="listbox"`. Each row has `role="option"`, `aria-selected` on the highlighted row, and an accessible name that includes the kind and counts ("Bash, tool, 1,204 calls, 6% failed"). The browser derives the position from the listbox.
- Chips are buttons in a labelled group ("Filters", "Destination"), each named like "Remove project filter myproject". A replaced or dropped chip adds "replaced by Cost" or "not applied" to its name.
- A visually hidden live region announces chip changes ("Codex filter removed"). The footer is not live on every keystroke: it is the input's `aria-describedby`, so it is read on focus and on request.
- Up, Down, Home, End, Tab, Enter, Esc and Backspace as in the spec. Esc is handled before the dialog's own cancel so the palette state resets.

## Risks / Trade-offs

- [A project shares a name with a reserved term, such as a project called `codex` or `7d`] → Bare and `#` text lists both rows with their kind badges; exact matches of reserved terms rank first, and the auto-chip on the next sigil only fires for a unique exact match, so an ambiguous term stays text until the user picks a row.
- [The palette opens over a modal sheet] → Both are `<dialog>` in the top layer, and the later `showModal()` stacks on top. A commit that changes sheet keys closes the sheet through `UsageSheets` as today. Component tests cover opening the palette with a sheet open.
- [Cmd+K or Ctrl+K is taken by the browser's search bar in some browsers] → `preventDefault()` on the page's `keydown` wins while the page has focus. When focus is in the address bar the browser keeps the key; the nav button stays available.
- [Moving to Errors resets its `sub`, `noise` and `gran` to defaults] → Same as a nav tab with filters set today. The palette never expresses those keys, so keeping them from the saved view would mix two sources of truth.
- [`/api/sessions?q=` computes the view's full session list per query] → Debounce, a two-character minimum, and the URL cache. If it is slow on the live store, cap the server work with the existing `limit` and measure during verification.
- [Facet counts disagree with a page] → Tool counts reuse `usage()`'s filter; category counts use Errors' rule of always including automated sessions. Python tests compare `palette()` with `usage()` and `errors_payload()` on the test store.
- [Chips typed by hand turn into chips unexpectedly] → Only on a unique exact match, and only once the next sigil is typed; Backspace in an empty input removes it.

## Migration Plan

None. The endpoint and the component are new, no hash key changes, and no store change. Rollback is a revert.

## Open Questions

- The palette button's label on narrow screens: icon with the hint only, or "Search" text too. This only changes `Nav.css`.
- Whether the shortcut hint uses `navigator.userAgentData` everywhere or `navigator.platform` alone. Either meets the spec.
