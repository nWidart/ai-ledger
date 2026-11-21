# Tasks

Each task names the model that does it: Sonnet for mechanical edits, Opus for standard work, Fable for the parts where a wrong design costs most. A group starts when the groups it depends on are merged. Groups 4, 5 and 6 can run in parallel after group 3; group 7 after group 4.

## 1. Store groundwork (no dependency)

- [x] 1.1 (Opus) Add nullable `reported_cost DOUBLE` to `requests` in `DERIVED_SCHEMA`, add it on open with `ALTER TABLE requests ADD COLUMN IF NOT EXISTS`, and write it in `Deriver.flush`. Claude and Codex rows carry NULL. Verify with a `test_store` case that opens a store made by the current schema: the column exists, counts are unchanged, every request has a NULL `reported_cost`.
- [x] 1.2 (Opus) In `metrics.requests_cte`, compute `cost` as `coalesce(r.reported_cost, <estimate>)`. Check every reader of `cost_<kind>` and of `cost IS NULL`: a request with a reported cost and no price is not unpriced, and the cost-by-token-kind chart does not lose its total. Verify with `test_metrics`: an unpriced model with reported costs adding up to $0.134844 adds $0.134844 and is not in `unpriced`.
- [x] 1.3 (Opus) Give `store.Source` a `type` reader (default `d.get("type")`) and use it in `ingest_chunk` for `raw_lines.type`. Verify that the Claude and Codex tests pass unchanged.
- [x] 1.4 (Sonnet) Add `grok-4.7-build` to `prices.json` with `context: 256000` and no rates. Verify with a `test_metrics` case that the entry loads, prices nothing, and gives the window.

## 2. Probe and fixtures (no dependency)

- [x] 2.1 (Opus) Run a headless Grok 1.0.92 probe in the scratchpad: a turn that spawns a subagent, calls an MCP tool, runs a failing command and a `git commit`, then a second turn cancelled while a tool runs. Record in design.md what differs from "Context": the child's lines, the `spawn_subagent` result, the cancelled turn's lines, a prompt in a second turn (`promptIndex`).
- [x] 2.2 (Opus) Build fixtures under `tests/fixtures/grok/` from trimmed real 1.0.92 lines: the probe's parent and child, one long turn cut to five model calls with out-of-order event ids, a compaction, a `use_tool` call with an error result, a `failed` `grep`, hooks. Replace every text, path, command, id and title with neutral values by script, not by hand. Verify that each file parses as JSONL, holds no path under the real home and no string of the real sessions longer than 20 characters, and that the turn's usage figures still add up.

## 3. Grok parser (after 1 and 2)

- [x] 3.1 (Opus) Add `grok.py`: `files(root)` returns `sessions/*/*/updates.jsonl` sorted; `key` is `grok:<eventId>:<agentTimestampMs>`; `fields` gives the session, the event id and the `agentTimestampMs` time in the store's ISO form; `type` as the design says. Register `grok` in `store.SOURCES`, add `DEFAULT_GROK`, add `--grok` to `app.py` and to `roots`. Verify with `test_grok`: a missing home is skipped, a file read twice stores each line once, the working folder is the decoded folder name, a child sorts after its parent.
- [x] 3.2 (Fable) Implement `GrokDeriver` sessions and requests: model calls from `streamStartMs`, the split by context size with exact sums, the reported cost split, the fallback row, peak context, compactions and the context window. A `turn_completed` in a later chunk than its calls reads the turn's lines back from `raw_lines`. Verify the spec scenarios of "Count Grok usage per model call", "Keep the cost Grok reports" and "Record the context of a Grok session", and that an ingest cut at every line boundary of the long-turn fixture gives the same rows as one ingest of the whole file.
- [x] 3.3 (Fable) Implement subagent placement from the parent's stored `subagent_spawned` line: the child's lines belong to the parent with `subagent = true`, its usage makes no request, it has no session row. Verify the "Probe with a subagent" and "Rebuild" scenarios. The child's tool calls and prompts come with task 3.4.
- [x] 3.4 (Opus) Implement tool calls and errors, prompts and hooks as the design says; add `run_terminal_command` to `SHELL_TOOLS`. Verify the spec scenarios of "Record Grok tool calls and errors", "Recognize prompts in Grok sessions" and "Record Grok hooks".
- [x] 3.5 (Opus) Implement `grok.prompt_text` and the title fallback: a Grok session's title is its first prompt's. Verify with a `test_grok` case through `titles`.
- [x] 3.6 (Opus) Write one `session_runs` row per turn with `api_ms` and NULL tool time and lines. Check every reader of `session_runs` in `metrics.py` and the web types: a NULL reads "–". Verify the "Output speed" scenario and a `test_metrics` case for a session detail with NULL lines.
- [x] 3.7 (Opus) Verify with a test that ingest followed by rebuild gives identical derived rows for a store holding all three sources, `reported_cost` and `session_runs` included.

## 4. The source on every page, backend (after 3)

- [x] 4.1 (Sonnet) Add `grok` to `metrics.SOURCES`. Move every Python test that uses `grok` as the unknown source to `gemini` (`test_metrics`, `test_live`, `test_context`, `test_insights`, `test_limits`, `test_app`). Verify that `source=grok` is accepted and `source=gemini` gets a 400.
- [x] 4.2 (Opus) `context.py`: no `expired` cause for a Grok break; `per_agent` and the advice texts for views with Grok sessions; the large-results advice for `run_terminal_command`; the stated window. Verify the context-dashboard delta scenarios in `test_context`.
- [x] 4.3 (Opus) `insights.py` and `limits.py`: no judgments for a source other than Claude Code; Limits for `source=grok` sends no window and says why. Verify the insights-dashboard and limits-dashboard delta scenarios.
- [x] 4.4 (Opus) Add a Grok session to the `test_metrics` fixture store and to the stores `tests/test_web_fixtures.py` builds, then regenerate `web/src/__fixtures__/`. Verify that `tests/test_web_fixtures.py` passes and a second run leaves the fixtures unchanged.

## 5. Live (after 3)

- [x] 5.1 (Fable) Make the turn marks a property of the source: `live.recent`, `live.state`, `subagent_work`, `lane_of`, `started_by`, `spawned` and the compaction filters (also `metrics.session_timeline`) read them from `store.SOURCES`, not from `source == "codex"`. Codex behaviour must not change. Verify that `test_live` passes unchanged before any Grok case is added.
- [x] 5.2 (Opus) Implement `grok.live_items` and `close_type`; add `run_terminal_command` to the approval and read-only rules. Verify the live-sessions delta scenarios in `test_live` with the Grok fixtures: working during a turn, your turn after `turn_completed`, interrupt on `cancelled`, a subagent lane, closed after `session_end`.

## 6. Web (after 4.4)

- [x] 6.1 (Sonnet) Add `grok` to `Source` (`api.ts`), `SOURCES` (`url.ts`), `SOURCE_LABELS` (`Filters.tsx`), `SOURCE_COLORS` (`cost/cost.ts`), the inline scope type in `project/blocks.tsx`, and the palette's `#grok` term. Move the web tests that use `grok` as the unknown source to `gemini` (`url.test.ts`, `Filters.test.tsx`, `errors/model.test.ts`). Verify with `url.test.ts` and `Filters.test.tsx` that picking Grok writes `source=grok`.
- [x] 6.2 (Opus) Replace every `=== "codex"` that means "not Claude Code" with a test for Claude Code, and name the picked agent in the text: `router.tsx`, `ScopeBar.tsx`, `ActivityPage.tsx`, `ViewSwitch.tsx`, `sheets/session.ts`, `palette/resolve.ts`, `ProjectPage.tsx`, `project/blocks.tsx`, `facets.tsx`. Leave `codexOnly` (no model time) as it is. Verify with the page tests: a Grok view offers no Judgments and says "Grok writes no facets"; a Codex view behaves as before.
- [x] 6.3 (Sonnet) `menu/resume.ts`: `grok --resume <id>` for a Grok session. Verify with `resume.test.ts`.
- [x] 6.4 (Opus) Check the pages against the regenerated fixtures: the session sheet with NULL tool time and lines, the Limits text for Grok, the Cost Agent stack with three series, Live's thinking text. Fix `tokenPairs` in `cost/cost.ts`: it divides each kind.s cost by a total that now includes reported costs, so the kind shares fall short of 100% with Grok in view. Run `npm run check` in `web/`, then verify that `tests/test_web_build.py` passes.

## 7. Docs (after 4; parallel with 6)

- [x] 7.1 (Opus, with the `doc-coauthoring` skill) Update the docs site: `how-it-works.md` (paths, `--grok`, one shape for three agents), `compare-sources.md` (what Grok records and what it does not: usage per turn, the per-call split as an estimate, no effort, branch, limits or judgments), `cost-estimates.md` (reported cost), `cli.md`, `storage.md`, `glossary.md`, `filters.md`, `command-palette.mdx`, `context-menu.mdx`, `context.mdx` (cache lifetime), `limits.mdx`, `live.mdx`, `index.mdx`, `install.md`, `privacy-security.md`. Run `npm run check` in `site/`.
- [x] 7.2 (Sonnet) Update `README.md` (tagline, what is ingested, `--grok`, the Grok caveats) and add the change to `[Unreleased]` in `CHANGELOG.md`.
- [x] 7.3 (Sonnet) Add Grok sessions to `tools/demo/seed.py` and `serve.py`. Verify that the demo store builds and the source filter shows Grok. Do not record the GIFs again.

## 8. Integration (after all; the lead)

- [ ] 8.1 (Fable) Review each group's diff before it merges. Run `uv run ruff check`, the Python tests, `npm run check` in `web/` and `site/`, and `openspec validate --specs --strict`.
- [ ] 8.2 (Fable) Against a copy of the real store, ingest with the real `~/.grok`. Verify: each Grok session's requests equal its `modelCalls`, and its tokens and cost equal the sums of its `turn_completed` lines; the probe has 1 subagent tool call and no child session; Claude and Codex totals are unchanged. Run `rebuild` and check that the totals match.
- [ ] 8.3 (Fable) Start the app on the copy with a free port. In the browser, pick Grok on Activity, Cost, Context, Errors, Limits and Live; open a Grok session's sheet; confirm the compacted session's curve on Context and a failing command on Errors.

## Workflow follow-up

- On archive, update the `transcript-store` Purpose to name Claude Code, Codex and Grok, and the `cost-dashboard`, `context-dashboard`, `live-sessions` and `usage-dashboard` Purposes where they name the agents.
