# Tasks

## 1. Status and payload

- [x] 1.1 Add `live.waiting()`: the active sessions in a `wait` or `you` state, every project and source, automated sessions left out. Verify with `tests/test_live.py`: it counts your turn and a likely approval wait, as the list does, and is 0 with no active session.
- [x] 1.2 Add `limits.peak_of()` and keep it beside the alert in `App.refresh_alert`. Verify with `tests/test_limits.py` and `tests/test_app.py`: the fullest window, none without a percent, both cleared by a failure.
- [x] 1.3 Return `live_waiting` and `limits_peak` in `/api/status`, the count kept for 15 seconds. Verify with `tests/test_app.py`: one read for several requests, `null` and the type only on a failure.
- [x] 1.4 Extend the Insights payload: per-outcome counts in each trend week; `cost`, `errors` and `context_share` on each listed session; `cost` and `active_s` on each friction family and label. Verify with `tests/test_insights.py` (`MeasuredTest`, `TrendTest`).
- [x] 1.5 Type the new fields in `web/src/api.ts` and regenerate `web/src/__fixtures__/` (`uv run python -m unittest tests.test_web_fixtures`).

## 2. Navigation

- [x] 2.1 Group the tabs and the page chooser's list into Now and Review, named for assistive technology. Verify with `Nav.test.tsx`: the two groups, their links, their names, and no Insights tab.
- [x] 2.2 Draw the Live badge with its text alternative. Verify with `Nav.test.tsx` ("Live badge"): the count, "9+", the tab's name, none at 0, `null` or from an older app.
- [x] 2.3 Draw the Limits pill in place of the dot, toned by the alert, with its text alternative. Verify with `Nav.test.tsx` ("Limits pill"): quiet, estimated, each alert kind, the forecast for another window, none without data.
- [x] 2.4 Carry both on the page chooser. Verify with `Nav.test.tsx` ("page chooser").
- [x] 2.5 Remove Errors' own active tint. Verify with `Nav.test.tsx`: one `aria-current` rule.
- [x] 2.6 Re-measure the one-row steps with the widest state and set them in `Nav.css`. Verified in a browser at 320px to 1600px: no sideways scroll.

## 3. One sheet host

- [x] 3.1 Mount `UsageSheets` once in `App`, with no props, and remove the mounts in Activity, Cost, Context, Errors, Live and the Project page. Verify with `App.test.tsx` ("one sheet host").
- [x] 3.2 Open sheets in place on Limits from the palette and the context menu; drop the list of hosting pages. Verify with `LimitsPage.test.tsx`, `resolve.test.ts` and `items.test.ts`.
- [x] 3.3 Keep the host from holding a page's answer. Verify with `visits.test.tsx`: the five-minute drop still holds.

## 4. Judgments as a view of Activity

- [x] 4.1 Add the `view` key and the view switch; move `pages/insights/` to `pages/activity/judgments/`. Verify with `Judgments.test.tsx` ("Activity's view switch") and `url.test.ts`.
- [x] 4.2 Redirect `/insights` with every key kept. Verify with `router.test.tsx` ("the old /insights address").
- [x] 4.3 Make Judgments unavailable for Codex alone, and open Overview for a link to it. Verify with `Judgments.test.tsx` ("with the source filter on Codex alone") and `router.test.tsx`.
- [x] 4.4 Start the view's own request in the route's loader, and keep the view while leaving Activity. Verify with `preload.test.tsx` and `visits.test.tsx`.
- [x] 4.5 Draw the outcome trend as stacked weekly bars with its readout and table. Verify with `Judgments.test.tsx` ("outcome trend").
- [x] 4.6 Show cost, peak context share and tool errors on session cards. Verify with `Judgments.test.tsx` ("stored figures on a session card").
- [x] 4.7 Weigh friction by cost, active time or reports. Verify with `Judgments.test.tsx` ("friction weights").
- [x] 4.8 Open a session sheet in place on the Judgments view. Verify with `Judgments.test.tsx`: the URL, the view under the sheet, focus back on the link.

## 5. Filters, palette and links

- [x] 5.1 Add `source` to `Filters`; Judgments shows none, in the header beside the heading. Verify with `Filters.test.tsx` ("per page") and `Judgments.test.tsx`.
- [x] 5.2 Add the Judgments destination to the palette (`>judgments`, `>insights`). Verify with `suggest.test.ts` and `resolve.test.ts`.
- [x] 5.3 Point "Open in Judgments" (session sheet, Project page) at the view. Verify with `sheets.test.tsx` and `ProjectPage.test.tsx`.

## 6. Docs and checks

- [x] 6.1 Update `tools/demo/record.mjs` for the Judgments view. Screenshots and GIFs are not re-recorded: the pinned Playwright has no browser on this machine (see design.md, Risks).
- [x] 6.2 Update `README.md`, the docs site and `CHANGELOG.md` `[Unreleased]`.
- [x] 6.3 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `cd web && npm run check`, `cd site && npm run check`, `openspec validate --specs --strict` and `openspec validate regroup-nav-and-judgments --strict`.
