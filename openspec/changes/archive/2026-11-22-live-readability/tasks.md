# Tasks

## T2. Status strip

- [ ] T2.1 Drop the `plan_limits` call and the `limits` and `cwd` fields from `live.session()` in `src/ai_ledger/live.py`, and from `LiveSession` in `web/src/api.ts`. Verify with `tests/test_live.py`: the session payload holds neither field.
- [ ] T2.2 Lay out `Strip.tsx` in two rows: state and detail | Cost, Tools, Errors (plain number, error color above zero), Cache read; then Context (readout over a full-width 8px meter with compaction marks) beside Last 10 min. Stack the columns below 721px and in a pinned stream. Remove the plan limits, `CopyResume`, the `full` prop and the `.where` CSS; keep `resumeCommand`. Verify with `LivePage.test.tsx`: the readout with and without compactions, an unknown window, no limits, directory or Copy resume.
- [ ] T2.3 Make `Pulse.tsx` fill its column (about 40px tall), keeping its name and keyboard readout. Verify in a browser: at least 200px wide at 1440x900.

## T3. Stream

- [ ] T3.1 Follow: turn Follow on when a user scroll reaches within 2px of the bottom with an unchanged scroll height; not after a resize or new content, and not at once after the user clears Follow at the bottom. Verify with `LivePage.test.tsx`.
- [ ] T3.2 Replace the "N errors" chip, its hint and the strip's Errors button with a "Failed calls only" checkbox, with ` (N)` when N > 0; remove the `failedOnly` and `setFailedOnly` strip props. Lanes still open on that filter. Verify with `LivePage.test.tsx`.
- [ ] T3.3 Add `markdown-to-jsx` at an exact version at least two weeks old, and a Markdown component: `disableParsingRawHTML`, links limited to `http:`, `https:` and `mailto:` with `target="_blank" rel="noreferrer noopener"`, images as links, GFM tables, code blocks that scroll sideways. Render prompt and reply bodies with it inside the memoized event; tool output stays plain text. Verify with a component test: raw HTML as text, an unsafe link as text, an image as a link, a table.

## T4. Rail, Wall and Full text

- [ ] T4.1 Rail entries: two lines of one height (title or project with `✕N`; state, project when titled, context %). Remove cost, source, latest action, meter and branch. Keep the accessible name in step. Verify with `LivePage.test.tsx`, and in a browser: no state cut, one height, 8 sessions at 1440x900.
- [ ] T4.2 Wall tiles: state with `✕N` and the pinned mark; title on two lines at most; project and model without `claude-`; context meter. Remove latest action, tools, cost, branch and source from the tile and `tileText`. One height per row. Verify with `LivePage.test.tsx` and in a browser.
- [ ] T4.3 Full text: show the toggle and its warning in the Stream view only; on the Wall, request without full text. The warning closes after 6 s, paused while hovered or focused, moving no focus; Dismiss stays. Verify with `LivePage.test.tsx` using fake timers.

## T5. Toggletip

- [ ] T5.1 Wrap the trigger and the popup host of `web/src/components/Toggletip.tsx` in one inline span, so hover adds no flex item beside the trigger. Verify in a browser: hovering each `?` in the strip moves nothing; and check the other callers keep their look.

## T6. Mock data

- [ ] T6.1 Enrich the fixture builders in `tests/test_live.py`: 12+ active sessions with 40-80 character titles, 7+ in one group; 200-character shell commands with absolute paths; `mcp__t3-code__delegate_task` with a ~300-character JSON target; a 30-character branch; 2-3 errors on one session; a Codex session on `gpt-6.2-sol` with null cost; Markdown prompts and replies (heading, list, bold, inline code, link, GFM table, code fence). Regenerate `web/src/__fixtures__/` with `uv run python -m unittest tests.test_web_fixtures`.
- [ ] T6.2 Apply the same data to `tools/demo/seed.py`.
- [ ] T6.3 Update `tools/demo/livefit.mjs`: each session its own detail; at 1440x900, 1280x800 and 390x844 assert no rail state tag is cut, one height for rail entries and for wall tiles, no move on hovering each strip `?`, a pulse at least 200px wide on desktop, Follow on after wheeling to the bottom, the Full text warning gone after 7 s. Remove the directory check.

## T7. Docs and checks

- [ ] T7.1 Update README and the Live docs page in `site/` (with the `doc-coauthoring` skill): rail, Wall, strip, Failed calls only, Follow, Full text, Markdown. Record the Live screenshots and GIF again.
- [ ] T7.2 Add the changes to `[Unreleased]` in `CHANGELOG.md`, with the payload's loss of `limits` and `cwd`.
- [ ] T7.3 Run `uv run ruff check`, `uv run pytest`, `cd web && npm run check`, `cd site && npm run check`, `openspec validate --specs --strict` and `openspec validate live-readability --strict`.
