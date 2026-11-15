# Design

## Context

See proposal.md for why. Today `Nav.tsx` draws, from left to right:

- the brand and the tabs, which are TanStack `Link`s that preload on intent;
- the project chip `#navFilter`, with its `.appnav-go` link and Clear button;
- the palette button;
- `#navStatus`, the ingest text, in an `aria-live="polite"` span;
- `#navRefresh` and `#navTheme`.

`.appnav-in` is a wrapping flex row. Phones (`max-width: 520px`) put the chip on a row of its own and hide the status text.

`refresh.ts` holds the state the nav and the palette's `>refresh` share. `refreshState()` turns the `["status"]` query and the refresh mutation into `{ text, failed, busy, retry, alert }`. `noteStatus()` already detects a new `last_change`. `/api/status` already sends `interval`, `last_ingest`, `last_stats.inserted`, `last_change` and `error`.

`focusLede()` moves focus to `#lede` after a nav pick. It stops following once focus lands anywhere other than the body, the element clicked or the heading. `Toggletip` wraps Base UI's `Popover` and puts its text in a polite region beside the button.

The `respect-text-size` change, not yet merged, moves the font sizes in `Nav.css` and `Filters.css` to `rem`.

## Goals / Non-Goals

**Goals:**
- Keep one row at every width, using CSS steps and no JS measurement.
- Reuse what exists: `refreshState`, `noteStatus`, `Toggletip`, Base UI `Popover` and `Link`.
- Keep the ids and names that other code and tests rely on: `#navRefresh` with its "Refresh" and "Retry" names, and the Search name.

**Non-Goals:**
- Container queries elsewhere in the app (issue #67).
- A settings menu, a `>theme` palette command, or Live session counts in the nav.
- Any change to the API or payloads.

## Decisions

### 1. Project link and clear button live in `Filters`, not the nav

`Filters` renders on every page and already holds the picker, so it can own the link and clear button. On `/project`, `Filters` omits the link and keeps the clear button. Clearing on that page goes through the same "leave the Project page" rule as today.

The clear button sets `project: null, session: null` and focuses `#fProject`, which is what `Nav.clear()` does now. That code moves with the button.

Alternatives considered:
- Keep a slim chip in the nav. Rejected: the chip is the widest item and repeats the picker.
- Put the link in the page heading. Rejected: the heading differs per page, and the filter row is shared.

### 2. Search button as the scope readout

With a project set, the button's label becomes the project dot and the name. The name is truncated with CSS (`max-width` in `ch`, then an ellipsis). The `aria-label` becomes `Search in <project>, open command palette (<shortcut>)`. That name contains the visible text, which satisfies label-in-name, and keeps "Search" for speech input. The palette is untouched, since it already pre-fills chips from the URL.

Alternative considered: chips inside a search field (the "scope omnibox"). Rejected: it would be a second filter editor, it clashes with the palette's "pick, then Apply" model, and Live ignores the range.

### 3. Freshness control: two buttons in one group

- The left button is `#navRefresh`. It keeps its id, its `aria-disabled` busy behavior and its "Refresh"/"Retry" name. It is icon-only, except that on failure "Retry" shows as text.
- The right button is a `Toggletip` with `label` set to the state text. The popup lists the details.
- One CSS group with a shared border draws the two as a split control.

`refreshState()` gains structured fields beside `text`:

- `kind`: `"idle" | "busy" | "stale" | "failed" | "offline" | "retry"`
- `at`: the last ingest as a `Date`, or `null`
- `inserted`: the lines the last ingest stored
- `changedAt`: the last ingest that changed data
- `interval`: the ingest interval
- `error`: the full error text

`text` stays, so the palette and the existing tests keep working. The state checks run in today's order, so a running or failed manual refresh still wins over the status answer.

Stale is `now - last_ingest > 3 * interval * 1000`. It is computed in `refreshState` with the time of the status answer (`dataUpdatedAt`), so no timer runs. The hidden-tab poll already refetches on return, which re-judges it.

Alternatives considered:
- A relative age ("2m ago"). Rejected: with a 60s ingest and a 60s poll, the age shows where the poll cycle is, not how fresh the data is. On Live it reads stale while the store is current.
- A live dot. Rejected: it implies streaming.

### 4. "+N lines" flash

A small piece of state in the nav: `{ n, until }`, set when `noteStatus` sees a new `last_change`, or a manual refresh's answer stored lines. `n` is `last_stats.inserted`. A 4s timeout clears it. It is `aria-hidden`. Its fade-in is wrapped in `@media (prefers-reduced-motion: no-preference)`.

To keep components out of `noteStatus`, the flash state lives in the same per-client `WeakMap` as `seen`. It is exposed through a tiny subscribe and get pair, the same way the refresh observer is shared.

### 5. Live regions

- `#navStatus` loses `aria-live`. The visible time is not a live region.
- A new visually hidden `role="status"` span carries only manual refresh results. It is set by the mutation's `onSuccess` ("Refreshed: 5 new lines", or "Refreshed: nothing new") and `onError` (the failure text). It is cleared when the next refresh starts.
- The limits alert's region is unchanged and stays separate.
- The `Toggletip`'s own polite region stays: it speaks the details only when the user opens them.

### 6. Narrow layouts with CSS steps, page chooser with Base UI `Popover`

Breakpoints are written in `em`, as `respect-text-size` left the existing ones (`32.5em`, `22.5em`). In a media query, `em` is the browser's default font size, so a larger default text size triggers them too. Values are set by measuring the real bar after implementation. The estimates are:

| Width | Step |
|---|---|
| ≤ 60em | Hide the wordmark. |
| ≤ 52em | The palette button shows its icon only, plus the dot. |
| ≤ 46em | Tab padding 10px → 7px. |
| ≤ 38em | Hide the tabs and show the page chooser. Hide the time text in the freshness control. |

The page chooser:

- It is a `Popover` with a trigger button. The popup holds a `<ul>` of the same `Link`s the tabs use, rendered by a shared `PageLinks` component. That keeps preload on intent, `href`, modified clicks and the `go()` rule.
- It is a disclosure, not `role="menu"`: the items are links, and a menu's arrow-key model would hide their link semantics.
- The trigger is named for the current page, or "Pages" off the tabs. It has `aria-expanded`. With an alert, its name adds "Limits alert", and it carries the dot. The dot is positioned so it does not move the trigger.
- On a link pick, the popover closes with `finalFocus={false}`, so focus is not returned to the trigger. `focusLede()` then sees focus on the body and moves it to `#lede`. On Escape it returns focus to the trigger, which is Base UI's default.
- The popup is portaled and absolutely positioned. It never changes the nav's height, so `--appnav-h` and the six stylesheets that use it are untouched.

Alternatives considered:
- A priority+ "More" menu. Rejected: it needs JS measurement, moves tabs when an alert arrives (against "the dot SHALL NOT change … the navigation's wrapping"), and is worst when it holds one or two items.
- A native `<select>`. Rejected: no `href`, no preload, no modified click, and it can't carry the dot.
- A horizontal scroll-snap tab strip. Rejected: at 390px, Limits and its dot sit off-screen.

### 7. Theme button and brand

Unchanged, apart from the wordmark step above. The 360px rule that hides the logo stays.

## Risks / Trade-offs

- **The bar may still wrap at some width between steps.** Measure the real bar at 1280, 1000, 800, 640, 390 and 320px, at 100% and 200% zoom, and set the breakpoints from that. A test asserts that `.appnav-in` uses `flex-wrap: nowrap`, so a wrap shows as overflow in review, not as a silent second row.
- **The project name in the Search button can be long.** The cap is in `ch` with an ellipsis, and the full name is in the accessible name and the title.
- **Users lose the always-visible "Last ingest" sentence.** The clock time is still visible, and the details are one click or hover away. The Stale, Failed and Offline states make problems louder than today.
- **`focusLede` and the popover's focus return could race.** `finalFocus={false}` on a pick, plus a test that a keyboard pick lands on `#lede`.
- **Merge conflict with `respect-text-size` in `Nav.css` and `Filters.css`.** Apply after it merges, and rebase the branch first.
- **README GIFs go stale.** Re-record with `tools/demo/` after updating `record.mjs`, which clicks `.appnav-go` today.

## Migration Plan

This is a frontend-only change, shipped in one release. Rollback is reverting the merge commit. There is no stored state, except that the theme key is untouched.
