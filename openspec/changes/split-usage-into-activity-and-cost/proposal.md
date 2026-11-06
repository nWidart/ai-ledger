# Proposal

## Why

The Usage page answers two questions at once: what Claude did, and what it cost. Cost wins the page: the headline, the sparkline, "What changed", the daily chart, both ledgers and three of the four insight cards are about money. Everything about how Claude worked (sessions, tools, error loops, context health) sits folded below them. A reader who opens the page to see where Claude struggled has to scroll past the bill first.

The pages are also hard to change. Each page is one HTML file with its script inline (`usage.html` is 1,736 lines, `dashboard_template.html` 1,083), and the shared parts (navigation, project colors, filters, formatters, sheets, charts) are either copied or injected as raw HTML. A third page would copy them again.

## What Changes

- Split the Usage page into two pages behind the same filters:
  - **Activity** (`/usage`): what Claude did and where it struggled. It leads with what needs attention, then work health (errors per 100 calls, test pass rate, interruptions, subagent share, session length), a work-per-day chart, and the sessions, project, tools, MCP/skills/hooks and error-loop tables. No cost figure above the fold; the session table keeps its cost column.
  - **Cost** (`/cost`): what it cost and why that changed. It takes today's top of the Usage page: the cost headline with the previous-period comparison, the sparkline, "What changed", the cost-per-day chart, where the spend went, models and effort, cost per commit, and the token, cache and per-prompt totals.
- The navigation shows Activity, Cost and Errors. `/` opens Activity. The project and range carry across all three pages, as they do today between Usage and Errors.
- Sessions from automated tools that run Claude Code in the background (today: claude-mem's `observer-sessions`, 631 of 1,503 sessions in the last 30 days, with no commits) are left out of Activity and Cost by default, with a control to include them.
- Add daily counts of sessions, prompts, commits and failed tool calls to `/api/usage`, for the Activity chart.
- Rebuild all three pages as one React and TypeScript app (Vite), with shared components for navigation, filters, sheets, charts and formatting. The built files are committed, so `uv run app.py` keeps working without Node; Node is only needed to change the pages.
- **BREAKING**: `nav.html`, `usage.html` and `dashboard_template.html` are removed. Existing URLs keep working: `/usage` and `/errors` with their hash state (`#project`, `#range`, `#session`, `#ex`, `#cat`), and applied-fix markers in the browser's localStorage.

## Capabilities

### New Capabilities

- `cost-dashboard`: the Cost page: estimated cost and its change against the previous period, tokens by kind, cache efficiency, model mix, and cost per project, session and commit.

### Modified Capabilities

- `usage-dashboard`: becomes the Activity page. Cost, token-kind and cache requirements move to `cost-dashboard`; it gains a lead attention summary, a work-per-day chart, and work-only versions of the subagent and outcome requirements.
- `dashboard-app`: the navigation lists Activity, Cost and Errors and `/` opens Activity; the app serves a committed frontend build without needing Node; automated sessions are excluded from Activity and Cost by default; the Errors dashboard keeps its permalinks and applied-fix markers through the rebuild.

## Impact

- **Code**: `usage.html`, `dashboard_template.html` and `nav.html` are replaced by a `web/` source tree (React, TypeScript) and its committed build in `web/dist/`. `theme.css` moves into `web/`. `app.py` serves the build and routes `/usage`, `/cost` and `/errors` to it. `metrics.py` gains daily work counts and the automated-session filter.
- **API**: `/api/usage` and `/api/sessions` gain an `automated` parameter (default: excluded) and `/api/usage` gains daily work counts. Existing fields stay.
- **Dependencies**: a Node toolchain (npm, Vite, React, TypeScript, Vitest) for development only. Running the app still needs only Python and `uv`.
- **Docs**: README sections on pages, files and development.
