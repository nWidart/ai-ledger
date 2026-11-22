# Proposal

## Why

An audit of Live with real data (13 active sessions, titles of 25 to 72 characters, latest actions at the 200-character cap, MCP calls with JSON targets, branches up to 32 characters) found the page hard to read:

- Rail cards pack title, project, state, source, branch, cost, a meter and the latest action into three lines. Long titles and actions push the state tag out, so the one fact the rail is for gets cut.
- Wall tiles show eleven facts each and grow to different heights, so the grid looks ragged and nothing stands out.
- The status strip mixes the conversation with account facts (plan limits) and the working directory, and wraps on most widths. The pulse is a 160px thumbnail.
- Hovering a `?` toggletip in the strip shifts the text beside it by the flex gap.
- Follow turns off on any upward scroll but only comes back through Jump to latest, even when the user scrolls back to the bottom.
- Two controls filter to failed calls: the strip's Errors button and the stream's "N errors" chip with its hint.
- Full text and its warning show on the Wall, where nothing reads them, and the warning stays until dismissed.
- Prompts and replies are Markdown, but the stream shows them as raw text.

## What Changes

- **Rail cards.** Two lines, one height: the title (or project) with an `✕N` error badge, then the state tag, which never shrinks, the project when titled, and the context percent. Cost, source, latest action, the meter and the branch leave the card.
- **Wall tiles.** Four lines, one height per row: state with errors and the pinned mark; the title on two lines at most; the project and model; the context meter. Latest action, tools, cost, branch and source leave the tile and its accessible name.
- **Status strip.** About the conversation only. Row one: state and detail, then cost, tools, errors as a plain number and cache read. Row two: Context (readout over a full-width meter with compaction marks) beside Last 10 min (the pulse at full column width). Plan limits, the working directory and Copy resume leave the strip. **BREAKING**: `/api/live/session` drops `limits` and `cwd`.
- **Toggletips.** A toggletip is one inline element, so showing it on hover moves nothing around it.
- **Follow.** Scrolling back to the bottom turns Follow back on.
- **One errors filter.** "Failed calls only", a checkbox with the count, in the filter row.
- **Full text.** Stream view only; the warning dismisses itself after 6 seconds, paused while hovered or focused.
- **Markdown.** With Full text on, prompts and replies render as Markdown, with raw HTML shown as text, safe links and no image requests.
- **Test data.** The page-test fixtures, the demo seed and `tools/demo/livefit.mjs` use realistic sessions and check the new layout.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `live-dashboard`: rail entries, wall tiles, the status strip, Follow, the stream filters, Full text, Markdown bodies and the narrow layout.
- `live-sessions`: the session payload loses plan-limit use and the working directory.
- `dashboard-app`: showing a toggletip moves nothing around it.

## Impact

- `src/ai_ledger/live.py`: `session()` stops calling `plan_limits` and returning `cwd`.
- `web/src/api.ts`: `LiveSession` loses `limits` and `cwd`.
- `web/src/pages/live/`: `LivePage.tsx`, `Wall.tsx`, `Strip.tsx`, `Pulse.tsx`, `Stream.tsx`, `useLive.ts`, `live.css`; a Markdown component.
- `web/src/components/Toggletip.tsx` and `Toggletip.css`.
- `web/package.json`: adds `markdown-to-jsx`.
- Tests and data: `tests/test_live.py`, `web/src/__fixtures__/live*.ts`, `tools/demo/seed.py`, `tools/demo/livefit.mjs`.
- Docs: README, the Live docs page in `site/`, CHANGELOG.
