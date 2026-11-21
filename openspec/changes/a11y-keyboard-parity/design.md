# Design

## D1. A wall tile: the action in the name, what it shows in the description

The tile is a toggle button. Its name stays "Pin <session>", the same whether pinned or not, and `aria-pressed` carries the state, as the WAI-ARIA button pattern asks of a toggle. The telemetry goes in `aria-description`, built from the session as one string: the project (when a title names the tile), the state with its detail, the latest action in words ("your prompt", "in a subagent, Bash: …"), the figures, then branch, source and model. Naming the tile from its content instead would put the glyphs (▸, ⤷) and the meter's empty box in the name, and the name would change on every tick of the state timer.

## D2. One modifier check

`modified(ev, shift = false)` in `web/src/components/keys.ts`, a module of its own so the tab lists need not import the chart helpers and their stylesheet. Every chart, strip and tab list that reads keys returns on it first, Escape and Enter included. The session timeline passes `shift = true`, because Shift+Left and Shift+Right are its ten-request step. The four handlers that had their own copy of the check use it too.

## D3. Tab panels are tab stops

The WAI-ARIA tabs pattern makes the selected panel focusable with `tabindex="0"` when its first content is not focusable, and its examples do so for every panel. Context already did; Activity's panel had `tabindex="-1"`, focusable from a script (a vital moves focus there) but skipped by Tab. Both now use `0`, so Tab from the tab list lands on the panel on both pages. The context-dashboard spec already says so ("the selected panel takes focus after the tablist"); the usage-dashboard spec now does too.

## D4. New events: follow the spec

The spec asks for a visible count beside Jump to latest, updated at most once every 5 seconds. The code showed it to screen readers only, after the count held still for 1.5 s. Neither the archived live-view-strip design nor the other Live changes record a reason for that, so the code follows the spec.

The count takes its first value at once, then at most once every 5 s: a change sooner waits for the rest of the interval, so a busy stream still shows its latest count within 5 s, where a debounce would wait for the stream to go quiet. With Follow on the count is 0 and the status empty.

The status sits in a row with Jump to latest at the foot of the stream box, inside the log, and is always drawn so it is in place before its first change. The log is `aria-live="off"`; the status sets `aria-live="polite"` itself, and the nearest live region of a change decides how it is announced.

## D5. Forced-colors rules guarded by a test

`css.test.ts` reads every `@media (forced-colors: active)` block and checks that each class it names is set somewhere in the components' source, as a word or as a prefix of a built class (`"st-" + kind`). It also rejects class attribute selectors (`[class^=…]`), which break when an element gains a class in front. The test found one more dead rule, `.pg-cost .daystrip`, which no component draws any more; it is removed. The cache chart's segments are already edged in `CacheChart.css`, so the dead `rect[class^="seg-"]` rule is removed rather than fixed.
