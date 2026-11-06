# Tasks

## 1. Tool payload

- [ ] 1.1 Add `categorize.input_pattern(tool, summary)` with the rules from design "Input patterns": shell first word (unwrapping `bash -lc`, leading `cd … &&` or `;`, env assignments and `sudo`), file extension, search pattern cut to 40 characters, URL host, and "other". Verify with unit tests on real `input_summary` samples from the Claude and Codex fixtures, including `npm test`, `cd web && npm run build`, a Codex `bash -lc` script, `a.py`, `Makefile`, a Grep pattern and a `docs.python.org` URL.
- [ ] 1.2 Extract the previous-period date arithmetic from `previous_period()` into a helper returning `(start, end)`, and use it there. Verify that the existing `test_metrics` previous-period cases still pass unchanged.
- [ ] 1.3 Add `metrics.tool_detail(cur, kind, name, project, range_days, today, automated, source)` over `view()`'s filter: headline (calls, errors, failure rate, p50 and p95), previous-period calls and failure rate, calls per day split into ok and failed, per project, per source, main against subagent, input-pattern groups (top 15 plus "other"; none for a skill), failures per category, recovery outcome counts from `incidents()` filtered to the subject and view, error loops of the subject, shell test runs, test pass rate and commits, the 50 most recent calls, and for an MCP server its tools. Raise `ValueError` for an unknown kind. Verify with `test_metrics` cases for each spec scenario in `specs/tool-inspector/spec.md`: filtered view, empty subject, failure rate rise, all-time view without change, subagent share, `git`/`npm` groups, `.py`/`.tsx` groups, the given-up incident count matching `errors_payload()`, the four-failure loop, `Bash` tests and commits with none for `Read`, MCP server tools, and the skill sheet without patterns.
- [ ] 1.4 Add the `/api/tool` route in `app.py` with `kind`, `name` and the usual view parameters. Verify with `test_app` cases: a known tool returns 200, an unknown kind returns 400, a tool with no calls returns 200 with zero calls, and `source=grok` returns 400.
- [ ] 1.5 Add tool, MCP server and skill payloads to the web fixture generator and regenerate `web/src/__fixtures__/`. Verify that `tests/test_web_fixtures.py` passes and that a second run leaves the fixtures unchanged.

## 2. Hash and sheet

- [ ] 2.1 Add `tool`, `mcp` and `skill` to `HashState`, `PUSH_KEYS` and `TAIL` in `web/src/hash.ts`. Add `openToolSheet(kind, name)` to `components/sheets/session.ts`: it clears the other two keys, `inspect` and `session`. Extend `errorsHref` with `source` and `cat`. Verify with `hash.test.ts` cases for parsing, canonical order, push on open, and the mutual clearing.
- [ ] 2.2 Add `ToolPayload` and `toolUrl()` to `api.ts`. Verify with `npm run typecheck` against the new fixtures.
- [ ] 2.3 Build `components/sheets/ToolSheet.tsx` with every section from the spec, reusing `Facts`, `Toned` and `ProjectName`, and a calls-per-day chart in the style of `pages/errors/Spark.tsx`. Show the no-calls message for an empty subject. Hide the test and commit section for non-shell tools and the pattern section for skills. Verify with `sheets.test.tsx` cases on the fixtures: headline with previous-period change, `npm` at 40% failed, category link to `/errors#…cat=…`, recent failed call link with `ex=`, MCP tool rows opening their own sheet, and the empty-subject message.
- [ ] 2.4 Wire the tool sheet into `UsageSheets`: `session` shows over `tool`, `mcp` and `skill`, and the session sheet offers ← Back to the tool sheet. Verify with `sheets.test.tsx` cases for reload with `tool=Grep` open and for ← Back from a session to the `Bash` sheet.

## 3. Openers

- [ ] 3.1 Make `ToolsDrawer` rows and `ExtDrawer` MCP and skill rows open the sheet through `pickRow`, with focus returning to the row when the sheet closes. Verify with `ActivityPage.test.tsx` cases: clicking `Bash` opens its sheet, and Escape returns focus to the row.
- [ ] 3.2 Make session sheet tool rows open the tool sheet in place of the session (push). Verify with a `sheets.test.tsx` case: the tool sheet opens, `session` leaves the hash, and history Back restores the session.
- [ ] 3.3 Mount `UsageSheets` on the Errors page and make example tool names buttons that open the tool sheet in the Errors view. Verify with `ErrorsPage.test.tsx` cases: clicking a tool name opens its sheet, closing it keeps `ex` and `cat`, and the narrow-screen detail sheet still opens.

## 4. Integration

- [ ] 4.1 Update the README's page description with the tool inspector and `/api/tool`. Verify that the documented URL `http://127.0.0.1:8765/usage#tool=Bash` opens the sheet.
- [ ] 4.2 Run the app on a copy of the live store and open the `Bash`, one MCP server and one skill sheet. Check light and dark themes, a 390 px width with no horizontal overflow, and an `/api/tool?kind=tool&name=Bash` response under 300 ms. If it is slower, add the optional filter to `incidents()` from design "Risks".
- [ ] 4.3 Run `npm run check` in `web/`, commit the rebuilt `web/dist/`, and verify that the full Python suite, including `tests/test_web_build.py`, passes.
