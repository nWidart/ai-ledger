# Tasks

## 1. Payload

- [x] 1.1 Replace `live.spark()` with `live.pulse()`: main-thread request contexts since 10 minutes ago, with the last one before as the starting level, and the tool calls that ended since, with `failed`. Return it as `pulse`, and the session's `cwd`, from `live.session()`. Verify with `tests/test_live.py`: the starting level, no subagent request, a failed subagent call, nothing outside the window.
- [x] 1.2 Type `cwd` and `pulse` in `web/src/api.ts` and regenerate `web/src/__fixtures__/` (`uv run python -m unittest tests.test_web_fixtures`).

## 2. Status strip and pulse

- [x] 2.1 Add `Strip.tsx` (state, context meter, cost, tools, errors toggle, cache read, plan limits, pulse, `cwd`, Copy resume) and remove `AgentPanel.tsx`. Verify with `LivePage.test.tsx`: the strip's contents, the inferred reason behind its toggletip, the Errors toggle with the bar, an unknown window, a limit near full, Copy resume.
- [x] 2.2 Add `Pulse.tsx` with its buckets in `live.ts`, keyboard readout, text alternative and forced-colors rules. Verify with `LivePage.test.tsx`: bucket values, ✓ and ✕ ticks, the name, Left, Right, Home, End and Escape.
- [x] 2.3 Move the connection status into the bar; give the stream the panel's width. Verify in a browser with `tools/demo/livefit.mjs`: the stream width at 1440x900.

## 3. Rail

- [x] 3.1 Add each entry's third line: context meter and percent, latest action, error count. Verify with `LivePage.test.tsx`, and in a browser: 8 sessions fit the rail at 1440x900.
- [x] 3.2 Make the narrow rail one row that scrolls inside itself. Verify in a browser at 390x844: no horizontal page scroll, the first event on the first screen.

## 4. Full text warning

- [x] 4.1 Make the warning a dismissible note over the page, and tint the toggle while on. Verify with `LivePage.test.tsx` (the grid keeps its place in the page, Dismiss) and in a browser: the stream does not move.

## 5. Wall pins

- [x] 5.1 Add `pin` to `search.ts`: ids without a comma, 2 at most, oldest first. Verify with `search.test.ts`.
- [x] 5.2 Fetch the pinned sessions in `useLive` beside the list and the selected session, refetched by notices and the recheck, with no stream session on the Wall. Verify with `LivePage.test.tsx`: one `EventSource` across pin, unpin, Stream and Wall, and a sheet opened and closed; a notice refetches a pinned session.
- [x] 5.3 Pin by tile, toggle, the 2-pin cap with its announcement, Unpin with focus back on the tile, Open in Stream, and the layout beside the tiles. Verify with `LivePage.test.tsx`: click and keyboard, the third pin, Unpin, the URL.
- [x] 5.4 Give each stream its own ids, so two pinned streams on a page do not share one. Verify with `LivePage.test.tsx`.

## 6. Docs and checks

- [x] 6.1 Update README, CHANGELOG `[Unreleased]`, the Live docs page, the glossary and the playbooks that name the agent panel.
- [x] 6.2 Record the Live screenshots (`live-strip` in place of `live-status`, `live-rail`, `live-stream`, `live-wall`) and the Live GIF.
- [x] 6.3 Run `uv run ruff check`, the Python tests, `cd web && npm run check`, `cd site && npm run check`, `openspec validate --specs --strict` and `openspec validate live-view-strip --strict`.
