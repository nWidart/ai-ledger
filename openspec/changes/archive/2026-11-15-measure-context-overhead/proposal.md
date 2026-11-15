# Proposal

## Why

The Context block of the Project page draws a typical session's window, but its starting context is one block: transcripts record the tokens of each request, not what the prompt is made of. Claude Code's `/context` knows the split (system prompt, system tools, MCP tools, custom agents, memory files, skills) and, since at least 2.1.286, writes it to the transcript as a structured `contextUsage` object on the command's `system` line. A run of `claude -p "/context"` in a project's folder writes the same line without calling the model: no cost, about four seconds. The store can keep those snapshots and the grid can split the starting context with them.

## What Changes

- Ingest keeps every `/context` result a Claude Code transcript records: when, in which session, project and folder, for which model and window, the tokens of each category, and the tokens of each MCP tool, memory file, custom agent and skill. Rebuild derives them from the stored lines, so earlier runs count too.
- The Context payload, filtered to a project, carries the project's latest snapshot: its time, model, Claude Code version, categories and the largest MCP servers, memory files and skills.
- The Project page's grid splits the starting-context cells by the snapshot's categories that are loaded at the start (system prompt, system tools, MCP tools and their instructions, custom agents, memory files, skills), with the rest of the median start as "First prompt and other". The legend says when the snapshot was taken. Deferred tools, which are not in the context, are named in the legend but get no cells. Without a snapshot the grid stays as it is and offers to measure.
- "Measure now" on the Context block runs `claude -p "/context"` in the project's latest folder with the project's most used model, then ingests, so the block shows the new snapshot. The app chooses the folder and the model from the store; the page names only the project. The run starts the project's MCP servers and hooks like any new session, calls no model and costs nothing; the block says so before the user runs it.
- The measuring session has no API request, so it counts nowhere as a session.

## Impact

- `src/ai_ledger/store.py`: `context_snapshots` and `context_parts`, derived from `system` lines with `contextUsage`; both in `DERIVED`.
- `src/ai_ledger/context.py`: `overhead` in the payload.
- `src/ai_ledger/app.py`: `POST /api/context/measure`.
- `web/src/api.ts`, `web/src/pages/project/`: the split grid, its legend and Measure now.
- `tests/fixtures/claude/context-command.jsonl`: a trimmed `claude -p "/context"` transcript (2.1.325), paths replaced.
- Specs: `transcript-store`, `project-page`. Codex records no such command; its projects keep the one-part start.
- Users run `ai-ledger rebuild` once to pick up earlier `/context` runs.
