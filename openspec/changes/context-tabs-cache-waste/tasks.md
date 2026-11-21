# Tasks

## 1. Payload

- [x] 1.1 `sessions_map` points carry `title`, through the payload's one `titles.with_titles` call. Verify with `test_context.py` (`test_eligible_sessions_only_with_their_title`).
- [x] 1.2 `growth.peak.by_project`: each project's sessions, median peak and median peak share of the window, most sessions first. Verify with `test_peak_per_project_most_sessions_first`.
- [x] 1.3 Tip advice takes the sources of the rule's matching sessions (`per_agent`): compactions, long tier and large start name Codex's commands for Codex sessions and both agents' for a mix. Verify with `test_advice_names_the_commands_of_the_matching_sessions_agents`.
- [x] 1.4 `api.ts` types; regenerate `web/src/__fixtures__/`.

## 2. Tabs and tips

- [x] 2.1 `search.ts` keeps `tab` (`growth`, `cache`; the default is never written). Verify with `search.test.ts`.
- [x] 2.2 `Tabs.tsx`: WAI-ARIA tabs with a roving tab stop, arrow keys (wrapping), Home and End, one labelled tabpanel. `ContextPage` drops `SectionIndex`, puts each section and drawer in its tab, and opens the tab of a section a URL hash names. Verify with `ContextPage.test.tsx`: three tabs, URL, keyboard, hash link.
- [x] 2.3 `TipStrip`: short items with a severity mark and word, at most four before "Show N more", one open at a time under the strip. Verify with `ContextPage.test.tsx`.
- [x] 2.4 First screen: `tools/demo/firstscreen.mjs` checks in Chromium at 1440 × 900, with all six rules firing, that the tablist and the first chart start within the window, light and dark.

## 3. Cache chart

- [x] 3.1 Design with the Fable agent; recorded in `design.md`.
- [x] 3.2 `CacheChart.tsx`: waste bars (uncached input, cache write), breaks strip, hit-ratio track with its floor, a "Cache reads" toggle, 1px inset between stacked segments and a 2px minimum, readout, tooltip and table with cache reads. Light-theme break fills at 3:1; forced-colors rules, the toggle's pressed state in `theme.css`. Verify with `CacheChart.test.tsx`.

## 4. Session map and pressure

- [x] 4.1 Titles in the map's tooltip, readout and table, and in the pressure and quadrant lists. Verify with `SessionMap.test.tsx` and `PressureBars.test.tsx`.
- [x] 4.2 Quadrants: names in the corners, a button per quadrant with its count, a click on the plot away from a mark, Escape and Clear. The Pressure section narrows the bars (`fillOf`) and lists the quadrant's sessions. Verify with `SessionMap.test.tsx` (keyboard, click, Escape) and `PressureBars.test.tsx` (`fillOf`).

## 5. Window grids

- [x] 5.1 `typicalGrid` builds a grid from one project's figures; `contextGrid` uses it. `ContextGrid` gets a compact form and `GridDefs`; its rules move to `ContextGrid.css`. Verify with `project.test.ts` and `ProjectPage.test.tsx` unchanged.
- [x] 5.2 `Grids.tsx` on Overhead and pressure: six small grids, or the one full grid with a project selected. Verify with `Grids.test.tsx`.

## 6. Specs, docs and build

- [x] 6.1 Delta spec for `context-dashboard`; every requirement's prose under 500 characters. `openspec validate context-tabs-cache-waste --strict`.
- [x] 6.2 README, `CHANGELOG.md`, the docs site's Context page and first tour (`doc-coauthoring`).
- [x] 6.3 `record.mjs`: Context shots and scene open the tab that holds each panel; a new `context-grids` shot. Regenerate the Context shots that changed (tips, grids, pressure, cost) and the Context GIF.
- [x] 6.4 `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `cd site && npm run check`, `openspec validate --specs --strict`.
