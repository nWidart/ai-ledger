# AI Ledger user guide

This guide describes each page and the files you can use to configure AI Ledger. For install and setup, see the [README](../README.md).

- [Pages](#pages): [Activity](#activity), [Cost](#cost), [Context](#context), [Errors](#errors), [Limits](#limits), [Insights](#insights), [Live](#live)
- [Everywhere](#everywhere)
- [Automated sessions](#automated-sessions)
- [Configuration](#configuration): [Prices](#prices), [Plans](#plans), [Automated projects](#automated-projects)

## Pages

### Activity

What got done per day or week, stacked by project.

- The chart shows errors per 100 calls, and the change against the period before.
- Prompts by hour and weekday.
- A list of what needs attention, down to the failed test runs.
- Tables sort by column.
- A click on a day of the chart narrows Tools, MCP & hooks and Error loops to that day.
- The Sessions filters live in the URL.
- A session sheet shows the session's `/insights` judgment beside its measured figures.

### Cost

Estimated spend at API list prices, per project, model and session, against the period before.

- The daily chart stacks by project, model or agent. Today's bar is hatched as a partial day.
- The month's run rate.
- The project and session tables download as CSV or copy to the clipboard.
- Cost by project folds scratch projects into one "Small projects" row.
- A comparison with your plan: "You pay about $200 a month (Claude Max 20x); at list prices this period is 4.2× your plan." See [Plans](#plans).

### Context

How full the context window gets in Claude Code and Codex sessions, per project and per session, and what fills it.

- **Where sessions start**: for each project, the 10th to 90th percentile range of the first request with its median, its share of the model's window, and a weekly trend with its spread.
- **Growth**: how fast context grows per turn and per prompt, in tokens or as a share of the window, with the number of sessions each turn rests on.
- **First compaction**: how many turns and minutes pass before it.
- **Window pressure**: how full sessions peak for each window size. A click opens the sessions behind a bar.
- **Session map**: every session by its start and its peak. A click on a dot opens the session.
- **What fills context**: the tool and MCP results by total size beside their typical size (median to 95th percentile), with the largest linked to their sessions.
- **Cost**: cache reads, cache writes and uncached input over time, the cache-hit ratio, the cache breaks by cause, cache-read and long-prompt-tier spend, and the sessions where caching broke.
- **Tips**: each tip appears only when a fixed rule fires, with its evidence, its advice and the sessions that match.

Token figures from bytes are estimates (bytes ÷ 4) and are labelled as such. The page reads no config file such as `CLAUDE.md` or `.mcp.json`: everything comes from the transcripts.

After upgrading to a version with the Context page, run `ai-ledger rebuild` once with the app stopped. The rebuild fills three figures the page needs. Until then, the page shows a notice and those figures are missing.

### Errors

Failed tool calls by type, with the time each type lost in retry loops and a fix to paste into `CLAUDE.md` or `AGENTS.md`.

- **Where to start** ranks the open fixes by time lost.
- The summary shows the share of errors in the catch-all types (Other, Other non-zero exit, MCP tool error), split by agent when both agents have errors. A growing catch-all is visible at once.
- A click on a day or week of the chart narrows the type table and the examples to it. Opening a type from elsewhere clears a day that has none of its errors.
- An open type shows where it happens by project, tool and agent. An agent filters the page; a tool narrows that type's incidents and examples.
- The type's list can group the errors by message ("586× the same message", with paths, ids and numbers set aside). This shows a mislabelled type at once and turns Other into a to-do list.
- A link to an example the store no longer holds says so.
- **Fix applied**: mark a type on a day to see its error rate before and after.
- **Mute** a type you expect, for example `search_empty` (a grep that finds nothing). It counts as noise: "Hide noise and muted" leaves it out of the rate, and Where to start never suggests it.
- The type table sorts by type, errors, time lost, rate, unrecovered share and change (in points), and filters by name.

The markers and the muted types live in the store, so they follow you across ports and browsers.

### Limits

Each plan limit window.

- A status strip of open windows, each with its cap in money and a forecast to its reset, plus an "if the last 24 hours continue" line.
- What used each window, by project and model, with links to Cost.
- A scoped limit's share of the weekly allowance, and the week's use by surface (Claude Code, chat, cowork).
- Past windows as a strip of bars per limit, with hits, early ends and estimates marked. Each bar opens its own curve.

A dot on the Limits tab, on every page, shows when a window is at its limit, forecast to run out, or at 90% or more. Hover or focus the dot to read it.

On macOS, Limits reads the windows from Anthropic's usage endpoint. Elsewhere, it estimates them from transcripts. See Privacy in the [README](../README.md#privacy).

### Insights

How Claude Code's `/insights` judged your sessions.

- A section index jumps between the parts of the page.
- The analysed sessions sort and filter by outcome.
- A click on a friction, goal, outcome or helpfulness row or chip lists only those sessions. The selection is kept in the URL.
- Similar goal and friction labels are grouped into families that expand to the raw labels.
- An outcome trend shows the achieved share per week.
- Drawers that open on demand:
  - Goals, Session types and Coverage (analysed share by project and by `/insights` run).
  - How this works: what `/insights` is, and how many sessions a run analyses.
  - Session figures: what `/insights` counted from the transcripts (lines changed, files, pushes, duration, response time and languages). Each session line shows the same figures.

### Live

Every active session as it runs: prompts, tool calls, subagents, context and cost.

**Sessions.** Live lists the sessions that wrote in the last 10 minutes, grouped by who needs you first:

| Group | Meaning |
| --- | --- |
| **approval?** | A shell call pending for more than 30 seconds, likely waiting for your approval. |
| **your turn** | The agent finished its turn. Shows how long the session has waited. |
| **working** | The agent is running a tool or thinking. A session whose subagent still works reads working, even when the main thread has finished its turn. |
| **idle** | No line for 5 minutes. |
| **ended** | A Claude Code session you closed. |

- A session keeps its place in its group until its state changes.
- The tab title counts the sessions that need you: `(2) Live · AI Ledger`.
- Codex records no close, so a Codex session goes from your turn to idle.

**Stream.**

- A shell call shows the description the agent gave it. The opened row shows the command.
- Codex subagents appear as lanes under their session, like Claude Code's.
- A failed command inside a Codex `exec` script gets its own row.
- A finished subagent is folded. A running one shows its last 5 calls.
- Each subagent header gives its cost, model and errors.
- Filters under the stream head keep only the failed calls, hide subagents, or hide the calls that only read.

**Text.** By default, Live shows word counts, shortened tool inputs and subagent descriptions. **Full text** puts transcript content on screen, secrets included. Turn it off before you share your screen.

**Connection.** In a background tab, Live stops listening and catches up when you come back. A paused page says Paused and shows no live dot. A lost connection says it is reconnecting, and retries on its own.

## Everywhere

- Press **Cmd+K** to jump anywhere: `>errors #myproject #7d`. The `>context` term opens the Context page, keeping the project and range filters.
- The project picker on every page filters as you type.
- Every page works by keyboard and screen reader.
- Each chart has a data table.
- Forced-colors (high contrast) modes are supported.
- An active day is a day with a prompt.

## Automated sessions

The pages leave out sessions a tool started:

- claude-mem's `observer-sessions`.
- Sessions with no prompt.
- The one-prompt helpers that apps run in temporary folders (session titles and the like).

**Include automated** shows them. To leave out more projects, see [Automated projects](#automated-projects).

## Configuration

AI Ledger reads its configuration files from the folder that holds the store:

- macOS: `~/Library/Application Support/ai-ledger/`
- Linux: `~/.local/share/ai-ledger/`
- With `--db`: the folder of that file.

The app reads the files on every page load, so no restart or `rebuild` is needed; reload the page. If a file cannot be used, the app ignores it and the page that uses it says why.

### Prices

Cost uses the API list prices shipped with each version. `uv tool upgrade ai-ledger` brings new ones.

To price a model the Cost page lists as unpriced, or to change a price, create `prices.json`. It takes the shape of the [packaged file](../src/ai_ledger/prices.json), in USD per million tokens:

```json
{"models": {"my-model": {"input": 3, "output": 15, "cache_read": 0.3, "cache_5m": 3.75, "cache_1h": 6, "context": 200000}}}
```

An entry may also carry:

- `"long_above"` and `"long"`: the rates above that many input tokens.
- `"fast"`: the five rates for fast-mode requests, which replace the long rates. A fast-mode request on a model without `fast` costs its standard price.

Its entries add to the packaged prices, or replace a model of the same name, and survive upgrades.

### Plans

The Cost page compares the estimate with your plan. The plan comes from the newest plan-limit snapshot of each provider. Its monthly price comes from the packaged `plans` table (Claude Pro and Max, ChatGPT Plus and Pro).

To add a plan or change a price, put a `plans` object in the same `prices.json`. Key it by provider, then by the plan name the snapshots record (`pro`, `max/default_claude_max_20x`, `plus`, `prolite`):

```json
{"plans": {"claude": {"pro": {"label": "Claude Pro (annual)", "monthly": 17}}, "codex": {"team": {"label": "ChatGPT Team", "monthly": 30}}}}
```

A file may hold `models`, `plans` or both.

- When the plan is unknown, the comparison is left out.
- When an agent without a known plan also spent, the multiple counts only the agents with a known plan and names them: "at list prices this period's Codex use is 0.7× your plan."

### Automated projects

To leave out more projects, create `automated.json`:

```json
{"projects": ["my-bot"]}
```

Its names add to the built-in detection. If the file cannot be used, Activity says why.
