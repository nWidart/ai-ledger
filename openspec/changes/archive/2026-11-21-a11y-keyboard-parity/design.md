# Design

## D1. A wall tile: named from its content

The tile is a toggle button; `aria-pressed` carries the pin state. It has no `aria-label` and no `aria-description`: VoiceOver on iOS is reported to read a stale description after an update, and a label would hide the content. The name comes from the content, so it is the text drawn now. The first child is a screen-reader-only line: "Pin" and the session's name, then, in words, the project (when a title names the tile), the state with its detail, the latest action ("your prompt", "in a subagent, Bash: …"), the figures, then branch, source and model. The drawn parts are `aria-hidden`: read as they are, they give glyphs (▸, ⤷, – for a missing branch) and run together with no separators, since name computation adds no space between inline spans. The name changes as the state timer ticks; that is the price of a name that is never stale.

## D2. One modifier check

`modified(ev, shift = false)` in `web/src/components/keys.ts`, a module of its own so the tab lists need not import the chart helpers and their stylesheet. Every chart, strip and tab list that reads keys returns on it first, Escape and Enter included. The session timeline passes `shift = true` for Left and Right only, because Shift+Left and Shift+Right are its ten-request step; Shift+Home and Shift+End go to the browser. The work chart's document-level Escape listener, which closes a reading the pointer opened, checks it too. The four handlers that had their own copy of the check use it.

## D3. Tab panels are tab stops

The WAI-ARIA tabs pattern makes the selected panel focusable with `tabindex="0"` when its first content is not focusable, and its examples do so for every panel. Context already did; Activity's panel had `tabindex="-1"`, focusable from a script (a vital moves focus there) but skipped by Tab. Both now use `0`, so Tab from the tab list lands on the panel on both pages. The context-dashboard spec already says so ("the selected panel takes focus after the tablist"); the usage-dashboard spec now does too.

## D4. New events: follow the spec

The spec asks for a visible count beside Jump to latest, updated at most once every 5 seconds. The code showed it to screen readers only, after the count held still for 1.5 s. Neither the archived live-view-strip design nor the other Live changes record a reason for that, so the code follows the spec.

What counts as new: the events whose key was not held when Follow last turned off. The stream notes the held keys whenever Follow goes from on to off, whichever way (a scroll, an opened row, the Follow checkbox, a pin's own Follow), while it renders. Keys, not a count: once the buffer holds its 2,000 events, a new one drops the oldest and the length stays the same.

The count takes its first value at once, then at most once every 5 s: a change sooner waits for the rest of the interval, so a busy stream still shows its latest count within 5 s, where a debounce would wait for the stream to go quiet. With Follow on the count is 0 and the status empty.

The status sits in a row with Jump to latest at the foot of the stream box, inside the log, and is always drawn so it is in place before its first change. The log is `aria-live="off"`; the status sets `aria-live="polite"` itself, and the nearest live region of a change decides how it is announced.

## D5. Forced-colors rules guarded by a test

`css.test.ts` reads every `@media (forced-colors: active)` block and checks that each class it names is set somewhere in the components' source, as a word or as a prefix of a built class (`"st-" + kind`). It also rejects class attribute selectors (`[class^=…]`), which break when an element gains a class in front. The test found one more dead rule, `.pg-cost .daystrip`, which no component draws any more; it is removed. The cache chart's segments are already edged in `CacheChart.css`, so the dead `rect[class^="seg-"]` rule is removed rather than fixed. A third check names the controls that must keep a rule (Live's strip figure, both tab lists, Last 24 h pace, the cache chart's segments), reading each selector list with its `:is()` spelled out, so dropping one page from `:is(.pg-context, .pg-activity)` fails.

Last 24 h pace leaves the shared outline list: that outline steps aside under keyboard focus, and forced colors drops the toggle's inset shadow, so pressed and unpressed looked the same while focused. It takes the system selection pair as a fill instead, as a pressed segment does, and its focus ring stays outside it in CanvasText.
