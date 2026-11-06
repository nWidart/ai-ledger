# Design

## Context

- `tool_calls` holds one row per call: tool, `mcp_server` (parsed from `mcp__<server>__<tool>`), `skill` (set only on the `Skill` call itself), `input_summary`, start and end, error, category, followup, subagent, `is_commit`, `is_test`, `test_passed`.
- `metrics.view()` builds the shared filter (`scope()` plus the range start). `usage()` already computes the per-tool, per-MCP and per-skill rows from it.
- `metrics.incidents()` groups failures into incidents with their outcome, over the whole store. `error_loops()` takes the view filter.
- `previous_period()` compares requests only. It has no tool-call counts.
- `UsageSheets` hosts the project and session sheets on Activity and Cost. The hash says which one is open (`inspect`, `session`). A session opened over a project sheet gets ← Back to it. Errors does not mount `UsageSheets`.
- `categorize.SHELL_TOOLS` names the shell tools of both sources (`Bash`, `exec_command`).

## Goals / Non-Goals

**Goals:**
- One payload function and one endpoint serve tool, MCP server and skill sheets.
- The sheet uses the same `Sheet` host and hash conventions as the project and session sheets.

**Non-Goals:**
- No new ingest fields, no store schema change, no rebuild.
- No tool filter on the Errors page. The inspector links into Errors by category (`cat=`) and by example (`ex=`), which exist today.
- No tool sheet inside the project sheet.

## Decisions

### One subject, three kinds
`/api/tool?kind=tool|mcp|skill&name=…&project=…&range=…&source=…&automated=1`. The kind picks the column the subject matches: `tool`, `mcp_server` or `skill`. One function `metrics.tool_detail()` builds every section from one filtered CTE over `tool_calls JOIN sessions`, using `view()`'s `W` and `fp`.
- Alternative: three endpoints. Rejected. The sections are the same queries with a different `WHERE`.
- An unknown kind raises `ValueError`, which `app.py` already turns into a 400.
- A subject with no calls in the view returns a payload with zero calls and empty lists, not a 404. The name may still be valid in another range.

### Previous period from the same filter
Calls and failures for the previous period come from the same CTE with the previous period's dates. The date arithmetic is shared with `previous_period()` through a small helper that returns `(start, end)`, so both comparisons agree on what "previous" means.

### Input patterns in Python, next to `summarize_input`
`categorize.input_pattern(tool, summary)` returns one label:
- Shell tools (`SHELL_TOOLS`): the first word of the command, after skipping `cd … &&`, env assignments and `sudo`.
- `Read`, `Edit`, `Write`, `NotebookEdit`, `apply_patch`: the file extension, or the file name when it has none.
- `Grep`, `Glob`: the pattern, cut to 40 characters.
- `WebFetch`: the URL's host. `WebSearch`: "search".
- Anything else: "other".

The payload function fetches `(tool, input_summary, is_error)` for the subject's calls and groups in Python. It keeps the top 15 groups and folds the rest into "other".
- Alternative: SQL `regexp_extract`. Rejected. The rules are per tool, need tests, and belong where the input is summarized.
- Cost: one pass over the subject's calls in the view. A heavy `Bash` user has tens of thousands of rows, which DuckDB returns and Python groups in well under the page's budget.

### Recovery reuses `incidents()`
`tool_detail()` calls `incidents()` and keeps the incidents of the subject whose session is in the view and whose first failure is in range. The outcome counts therefore match the Errors page exactly.
- Alternative: a filtered incidents query. Rejected for now: it would duplicate the window logic. If the full scan proves slow, `incidents()` gains an optional `WHERE`.

### Hash keys and sheet stacking
New hash keys `tool`, `mcp` and `skill`, added to `PUSH_KEYS` and `TAIL` after `inspect`. At most one is set. Opening one clears the others and `inspect`.

| From | Action | Hash change | Back |
|---|---|---|---|
| Activity drawer row | open tool | set `tool` | browser Back closes |
| Tool sheet | open session | set `session`, keep `tool` | sheet ← Back clears `session` |
| Session sheet | open tool | clear `session`, set `tool` (push) | browser Back returns to session |
| MCP sheet | open one of its tools | clear `mcp`, set `tool` (push) | browser Back |

A sheet shows `session` over `tool`, `mcp` and `skill`, the way it shows `session` over `inspect` today, so the existing ← Back logic extends without change.
- Alternative: a single `tool=` key with a `mcp:` or `skill:` prefix. Rejected. Tool names can contain colons, and three plain keys read better in a copied URL.
- Alternative: keep `session` when opening a tool from a session, for an in-sheet ← Back. Rejected: `session` would then sit both over and under `tool`, depending on how the user got there, and the hash cannot record that order.

### Errors mounts `UsageSheets`
Errors renders `<UsageSheets data={undefined} />`, so the tool sheet and the session sheets it links to open there too. The view comes from the Errors hash (project, range, source, auto). No other Errors behavior changes: `ex`, `cat` and the narrow-screen detail sheet keep their keys. `Sheet` is a `<dialog>`, so it stacks above the narrow-screen detail.

### Frontend layout
- `api.ts`: `ToolPayload`, `toolUrl(kind, name, view)`. A new fixture `web/src/__fixtures__/tool.ts` is generated by the existing fixture generator from the test store.
- `components/sheets/ToolSheet.tsx`: the sheet body. It reuses `Facts`, `Toned`, `ProjectName`, `RateCells`-style cells and a small calls-per-day bar chart in the style of `pages/errors/Spark.tsx`.
- `session.ts`: `openToolSheet(kind, name)`. `errorsHref` gains `source` and `cat`.
- Openers:
  - `ToolsDrawer` and `ExtDrawer` rows use `pickRow` like `ProjectsDrawer`.
  - Session sheet tool rows use `pickRow`.
  - Errors example tool names become buttons.

## Risks / Trade-offs

- [`incidents()` scans the whole store on each sheet open] → The Errors page already pays this per load. Measure on the live store during verification. If it costs over 300 ms, add the optional `WHERE`.
- [Input patterns mislabel unusual commands, such as `bash -lc "…"` from Codex or `( cd x; npm test )`] → Unwrap `bash -lc` and leading `cd … &&` or `;`. Unit tests cover real `input_summary` samples from both sources. Anything else falls into "other", which is visible rather than wrong.
- [`input_summary` is a 300-character JSON dump for tools without a known key] → Those tools group under "other". The recent-calls list still shows the raw input.
- [Mounting `UsageSheets` on Errors adds a sheet host to a page with its own focus handling] → The tool and session keys are new on Errors, so no existing link opens them. Errors page tests cover opening and closing the tool sheet with `ex` set.

## Migration Plan

None. The change reads existing columns, and the hash keys are new. Rollback is a revert.
