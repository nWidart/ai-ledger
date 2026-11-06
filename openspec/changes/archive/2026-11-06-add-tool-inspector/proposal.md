# Proposal

## Why

Activity lists each tool, MCP server and skill as one row: calls, failure rate and latency. The row cannot say why a tool fails, which commands or files it runs on, where it is used, or whether its failures are new. Bash hides many tools in one row (git, npm, pytest, uv), so its failure rate says little. The store already records each call's input, error, category, followup, session and timing, so all of this can be shown without new capture.

## What Changes

- Add an inspector sheet for one tool, MCP server or skill, in the style of the project and session sheets.
  - Headline: calls, failure rate, p50 and p95 latency, with the change against the previous period.
  - Calls per day, split into succeeded and failed.
  - Where it is used: per project, per source (Claude Code, Codex), and main thread against subagents.
  - Top inputs grouped by pattern, each with its call count and failure rate:
    - Shell tools: the first word of the command (`git`, `npm`, `pytest`).
    - File tools: the file extension.
    - Search tools: the pattern.
    - Web tools: the domain.
  - Failures by error category, with the category's explanation and links into Errors.
  - Recovery after a failure: how often the next call of the same tool succeeds, fails again, or never comes.
  - Error loops of this tool.
  - For shell tools: test runs, test pass rate and commits.
  - Recent calls with their input, each linking to its session, or to Errors when it failed.
  - For an MCP server: the same sections, plus its tools.
  - For a skill: the same sections over its invocations. The store marks only the `Skill` call itself, not the calls made while the skill runs, so a skill sheet cannot list the tools the skill used.
- Open the sheet from these places:
  - Tool rows in the Activity tools drawer.
  - MCP server and skill rows in the Activity extensions drawer.
  - Tool rows in the session sheet.
  - Tool names on the Errors page.
- Keep the open tool, MCP server or skill in the page URL, so Back, reload and shared links reopen it. A session opened from the inspector gets ← Back to it. Errors also hosts the session sheet, so session links from the inspector work there.
- Add an `/api/tool` endpoint that takes the usual view filters (project, range, source, automated).

Out of scope: result size per call and context tokens per tool. Both need new ingest fields and a store rebuild, so they come in a later change.

## Capabilities

### New Capabilities
- `tool-inspector`: the sheet for one tool, MCP server or skill: what it shows, where it opens, and its URL state.

### Modified Capabilities
- `usage-dashboard`: the page URL also keeps the inspected tool, MCP server or skill, and Back retraces it.

## Impact

- `metrics.py`: new tool payload function built on `view()`, reusing `incidents()`, `error_loops()` and `previous_period()` logic.
- `categorize.py`: input pattern grouping, next to `summarize_input` and `SHELL_TOOLS`.
- `app.py`: `/api/tool` route.
- `web/src/api.ts`: `ToolPayload` type and URL helper. New fixture in `web/src/__fixtures__/`.
- `web/src/hash.ts`: `tool`, `mcp` and `skill` keys, pushed like `inspect`.
- `web/src/components/sheets/`: new tool sheet, wired into `UsageSheets`. Errors page gains the same sheet host.
- `web/src/pages/activity/tables.tsx`, `SessionSheet.tsx`, Errors examples: rows and names open the sheet.
- No new dependency, no schema change, no rebuild.
