# Proposal

## Why

A design re-review of `main` found places where the keyboard and screen-reader experience falls short of what other parts of the app already do:

- A Live wall tile is named "Pin <session>" and nothing else, so a screen reader hears none of what the tile shows: its state, latest action, context, tools, errors, cost, branch and model.
- Nine charts and both tab lists handle Left, Right, Home and End without checking for modifiers, so Alt+Left (Back) and Ctrl+Home (page top) do nothing while they have focus. The Limits charts, the history strips, Live's pulse and the Judgments outcome trend already leave those keys to the browser, each with its own copy of the check.
- Four forced-colors rules match nothing: Live's pressed Errors figure is targeted under a class the strip no longer has, Activity's selected workbench tab is left out, the cache chart's segments are matched by a `class^=` prefix their class never starts with, and Limits' "Last 24 h pace" toggle has no rule.
- When a sheet closes and its opener is gone, focus falls back to `.lede`. Live's heading has `id="lede"` but not the class, so on Live focus is lost.
- Context's selected tab panel is a tab stop, Activity's is not.
- The Live spec asks for a visible "N new events" beside Jump to latest, updated at most once every 5 seconds. The page shows the count to screen readers only, after it holds still for 1.5 seconds.

## What Changes

- **Wall tiles.** A tile keeps the name "Pin <session>" and its pressed state, and gains a description with all it shows.
- **Modified keys.** One shared check, `modified()` in `web/src/components/keys.ts`, used by every chart and tab list that reads keys: a key with Alt, Ctrl, Meta or Shift goes to the browser. The session timeline keeps Shift for its longer step.
- **Forced colors.** The four rules match their elements again. A stylesheet test fails when a forced-colors rule names a class no component sets, or matches a class by attribute.
- **Sheet focus.** The fallback is the page heading, `#lede`, which every page has.
- **Tab panels.** Activity's selected panel is the next tab stop after the tab list, as on Context and in the WAI-ARIA tabs pattern.
- **New events.** The count shows beside Jump to latest, in a polite status, at once and then at most once every 5 seconds.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: modified keys go to the browser on every chart and tab list; focus returns to the page heading when a sheet's opener is gone; the forced-colors requirement names the controls it missed.
- `live-dashboard`: a wall tile's name, pressed state and description.
- `usage-dashboard`: the workbench's selected panel is a tab stop.

## Impact

- `web/src/components/keys.ts` (new), the charts and tab lists that read keys, `UsageSheets.tsx`, `Wall.tsx`, `Stream.tsx`, `Workbench.tsx`, `theme.css`, `live.css`.
- Tests: `css.test.ts`, `keys.test.ts`, a `prevented()` helper in `testing.tsx`, and page and chart tests.
- No API, payload or stored data change.
