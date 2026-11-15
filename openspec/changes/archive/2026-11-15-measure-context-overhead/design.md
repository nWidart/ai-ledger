# Design

## Source: the `contextUsage` line

`/context` writes one line per run: `type: "system"`, `subtype: "local_command"`, `commandRun.command: "context"`, and `contextUsage`:

```
model, total_tokens, raw_max_tokens, percentage,
categories[{name, tokens, kind: used | deferred | buffer | free}],
mcp_tools[{name, server_name, tokens}], memory_files[{path, type, tokens}],
agents[{agent_type, source, tokens}], skills[{name, source, tokens}]
```

The line also carries `sessionId`, `timestamp`, `cwd`, `version` and `uuid`. Interactive runs in some versions write no `contextUsage`; those are skipped. The Markdown in `content` is never parsed: only the structured object is read, and a line whose object lacks `categories` is skipped.

## Tables

Derived, in `DERIVED`, so rebuild regenerates them:

- `context_snapshots (uuid PK, session_id, ts, project, cwd, version, model, window, total)` — `window` is `raw_max_tokens`, `project` comes from `cwd` through `Projects` as for sessions.
- `context_parts (uuid, kind, name, detail, state, tokens)` — `kind` is `category`, `mcp_tool`, `memory_file`, `agent` or `skill`; `detail` is the MCP server, the memory file type or the source; `state` is the category's `kind` (`used`, `deferred`, `buffer`, `free`), null for the others.

Only the Claude deriver fills them. The Codex deriver leaves them empty: the tables are not one of the shared session records, so the two-sources rule holds.

## What the grid takes from a snapshot

Overhead is a property of the project's configuration, not of a session, so the latest snapshot of the project is used, whatever session it came from. Its `used` categories other than `Messages` are the overhead: they are loaded before the first prompt. `Messages`, `Free space` and `Autocompact buffer` describe the session the command ran in and are ignored. `deferred` categories are not in the context; the legend names their total, without cells.

Let S be the median starting context and O the sum of the overhead categories. The starting cells (from S's share, as today) are split in proportion to each category's tokens, with S − O as "First prompt and other". When O > S, the configuration measured is larger than what most sessions started with (it grew, or the model differs): the starting cells are split in proportion to the categories alone, and the legend shows each category's measured tokens and says the snapshot is larger than the median start. Cell counts are rounded so that their sum stays the starting cell count (largest remainder).

## Measure now

`POST /api/context/measure` with `{"project": name}`:

1. The project must be one the store knows. The folder is the `cwd` of the project's latest Claude Code session that still exists as a directory; the model is the project's most used main-thread model over the last 30 days, else its latest. Neither comes from the request.
2. The app runs `[claude, "-p", "/context", "--model", model, "--output-format", "json"]` with that `cwd`, no shell, stdin closed and a 60-second timeout. `claude` is found on `PATH`; without it the endpoint answers 503 and the block says Claude Code was not found.
3. One run at a time: a second request while one runs answers 409.
4. It then ingests (as Refresh does) and answers with the session id, or with the error and the command's stderr tail.

The existing same-site guard for POST refuses cross-site requests. The run inherits the user's environment, as a terminal would.

## Not done

- No scheduled measuring: a run starts MCP servers and hooks, so it happens only on the user's click.
- No Context-page section: the payload carries the snapshot only when a project is set. A per-project overhead table on Context is a follow-up.
- No `ai-ledger measure-context` command: `claude -p "/context"` in the project folder does the same, and the next ingest picks it up. The README says so.
