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

## 7. Review fixes

- [x] 7.1 Draw the view switch in every state of both views and hand focus back in a layout effect. Verify with `Judgments.test.tsx` ("keeps the focus on the switch while … first request is pending"): focus and Tab order before the request settles, both ways.
- [x] 7.2 Give the Limits pill one fixed width and opaque fills, keep its room on the page chooser, mark an alert in forced colors, and say the percent in the chooser's name. Verify with `Nav.test.tsx` ("Limits pill", "page chooser"); contrast worked out in design.md.
- [x] 7.3 Fill the Live waiting count under a lock. Verify with `tests/test_app.py` (`test_concurrent_status_requests_work_out_the_waiting_count_once`: five callers behind a barrier, one read).
- [x] 7.4 Outcome trend: slots from `stackHeights()`, counts thinned on narrow charts, few weeks at half width, modified keys left alone. Verify with `Judgments.test.tsx` ("outcome trend": 1 in 150, 26 weeks at phone width, modified keys).
- [x] 7.5 Friction: an unpriced session adds its active time, not cost; every weight shows the report count. Verify with `tests/test_insights.py` (`test_an_unpriced_session_adds_no_cost_to_its_friction_but_its_active_time`) and `Judgments.test.tsx` ("friction weights").
- [x] 7.6 Mark Limits' project rows as menu subjects. Verify with `LimitsPage.test.tsx` ("opens a project's menu from …").
- [x] 7.7 Keep a section anchor through the `/insights` redirect; drop a Codex source from the sheet's Judgments link; replace the Project page's link with the reason for Codex. Verify with `router.test.tsx`, `sheets.test.tsx` and `ProjectPage.test.tsx`.
- [x] 7.8 Reconcile the deltas: Judgments inside Activity (purpose and requirement names), filter placement, one shared sheet host, the index's empty cases, payload order, the old-app pill rule, and the Codex cases.
