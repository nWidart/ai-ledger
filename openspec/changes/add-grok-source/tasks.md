# Tasks

## 1. Reported cost in the store and metrics

- [ ] 1.1 Add nullable `reported_cost DOUBLE` to `requests` in `DERIVED_SCHEMA`, and add it on open with `ALTER TABLE requests ADD COLUMN IF NOT EXISTS`. Claude and Codex derivers write NULL. Verify with a test that opens a store created by the current schema: the column exists, counts are unchanged, and every existing request has a NULL `reported_cost`.
- [ ] 1.2 In `metrics.requests_cte`, compute `cost` as `coalesce(r.reported_cost, <estimate>)`. A request with a reported cost no longer counts as unpriced. Verify with a `test_metrics` case: an unpriced model with a reported cost of $0.134844 adds $0.134844 and is not listed in `unpriced`.

## 2. Grok parser

- [ ] 2.1 Run a probe Grok session in the scratchpad, and cancel its turn while a tool runs. Record whether `turn_completed` is written, and its `stop_reason`. Update the "Cancelled turn" scenario and the design risk with what you find.
- [ ] 2.2 Build Grok fixtures in `tests/` from trimmed real 1.0.77 lines: the probe parent and child sessions (spawn, finish, failing `ls`, `turn_completed` with `modelUsage`), plus `hook_execution`, `read_file`, `grep`, `search_replace` and one MCP-namespace tool call. Replace message text, paths and ids with neutral values. Verify that the fixtures parse as JSONL and contain no path under the real home.
- [ ] 2.3 Add `grok.py`: `files(root)` returns `sessions/*/*/updates.jsonl`, sorted. `key` is `grok:<eventId>`. `fields` gives the session id, the event id and the `agentTimestampMs` time. Register `grok` in `store.SOURCES`, add `DEFAULT_GROK = ~/.grok`, and add `--grok` to `app.py`. Verify with tests: a missing Grok home is skipped, a file read twice stores each line once, discovery puts a child after its parent, and the cwd comes from the decoded folder name.
- [ ] 2.4 Implement `GrokDeriver` sessions and requests. One request per `modelUsage` model per `turn_completed`, with the token mapping and `reported_cost = costUsdTicks / 1e10`. Peak context is the max `_meta.totalTokens`. Verify the spec scenarios: 97,245 / 41,600 / 459 / 230 gives input 55,645 and total 97,704 at $0.134844; two models in one turn give two rows; a turn with no `turn_completed` gives no request.
- [ ] 2.5 Implement subagent attribution: look up the parent's stored `subagent_spawned` line by `child_session_id`. A child's tool calls and prompts go to the parent with `subagent = true`. Its usage is skipped, and it gets no session row. Verify the probe scenario: one subagent `read_file` on the parent, 5 calls' tokens counted once, and no child session.
- [ ] 2.6 Implement tool calls and errors from `tool_call` / `tool_call_update`, with `run_terminal_command` added to `SHELL_TOOLS` and non-`grok_build` namespaces mapped to `mcp__<ns>__<name>`. Add follow-ups from agent message chunks, and prompts from `user_message_chunk` (one per turn, interrupted on a cancelled stop reason). Hooks come from `hook_execution`. Verify the spec scenarios: the failing `ls` is an error with category and `Exit code 1`, `git commit` counts as a commit, the MCP tool name and server, two `session_start` hooks, and one prompt per turn.
- [ ] 2.7 Verify with a test that ingest followed by rebuild gives identical derived rows for a store holding all three sources, `reported_cost` included.

## 3. Source filter

- [ ] 3.1 Add `grok` to `metrics.SOURCES`, so `source=grok` is accepted and `source=gemini` gets a 400. Extend the `test_metrics` fixture with a Grok session, and regenerate `web/src/__fixtures__/`. Verify that `tests/test_web_fixtures.py` passes and that a second run leaves the fixtures unchanged.
- [ ] 3.2 Add `grok` to `Source` in `api.ts` and `SOURCES` in `hash.ts`, and label it "Grok" in `Filters`. Change the unknown-source test value from `grok` to `gemini`. Verify with `hash.test.ts` and a page test that picking Grok writes `source=grok` and narrows the figures.
- [ ] 3.3 Run `npm run check` in `web/`, commit the rebuilt `web/dist/`, and verify that `tests/test_web_build.py` passes.

## 4. Integration

- [ ] 4.1 Against an instant copy of the real store, ingest with the real `~/.grok`. Verify that the review and probe sessions appear, the probe's cost is $0.134844 with 1 subagent tool call and no child session, and Claude and Codex totals are unchanged. Then run `rebuild` and check that totals match.
- [ ] 4.2 Start the app on the copy with a free port. In the browser, pick Grok on Activity, Cost and Errors, and confirm the failing `ls` appears on Errors. Update the README: what is ingested, `--grok`, usage arriving per turn, and the missing Grok effort, branch and limits.

## Workflow follow-up

- On archive, update the `transcript-store` Purpose to name Claude Code, Codex and Grok.
- Whichever of this change and `add-command-palette` merges second adds `grok` to the palette's `#` source terms.
