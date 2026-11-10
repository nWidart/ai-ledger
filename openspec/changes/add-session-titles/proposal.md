# Proposal

## Why

The Live page names a session only by its project, so two sessions in one repository look the same on the Wall and in the rail. Other pages do name sessions, but only from the first prompt, cut to 80 characters. That title is often a pasted path, a slash command or the start of a long brief. Both agents already write a better title into their own files, and the store does not read it yet:

- Claude Code writes an `ai-title` line, which it generates from the first prompt. It writes a `custom-title` line when the user runs `/rename` or a tool such as T3 names the thread. All 300 recent sessions in a sample had one or the other.
- Codex keeps a generated `thread_name` per session in `~/.codex/session_index.jsonl`. Renames append a new line there.

Reading these titles gives every session a readable name with no network call and no new dependency.

## What Changes

- **Resolve one title per session.** The order is: the newest `custom-title`, then the newest `ai-title` or Codex `thread_name`, then the title made from the first prompt (`prompt_title`, as today). The title is cut to 80 characters. Titles from subagent files are ignored.
- **Store agent titles in the derived layer.** Ingest and `rebuild` derive them from stored lines, so past Claude Code sessions get titles after one `rebuild`.
- **Ingest the Codex session index.** `session_index.jsonl` becomes a stored Codex file, so its lines are kept verbatim and replayed by `rebuild` like any other line.
- **Titles on Live.**
  - **Wall tile:** the title shows on one line under the project.
  - **Stream rail:** the title becomes the entry's main line, and the project moves into the second line.
  - **Stream header:** the title shows as a heading above the chips.
  - A long title is cut with an ellipsis, and the full title shows on hover.
- **Live keeps prompt text on request.** On Live, an agent-made title (custom, AI or Codex thread name) shows by default. A title made from the first prompt is prompt text, so Live sends it only while Full text is on. Until then, the entry shows the project in its place. Other pages keep showing first-prompt titles all the time, as they do today.
- **Titles where pages show a bare id.** The error-loops drawer on Activity, and the error loops and recent calls on the tool sheet, show `#1a2b3c4d` today. They will show the title in the same cell layout the Activity sessions drawer uses: the title cut to fit, the full title on hover, and the short id in the small line below.
- **Better titles everywhere titles already show.** These places get the better title with no layout change: the Activity sessions drawer, the Cost top sessions, drawer and "Biggest session" insight, the project sheet, the session sheet and palette session search.

Out of scope: generating titles with a model such as Haiku, and naming sessions by hand in the ledger. `/rename` in Claude Code already writes a `custom-title`.

## Capabilities

### New Capabilities
- `session-titles`: how a session's title is chosen from its agent-made titles and its first prompt, how titles are kept through ingest and rebuild, and how pages name a session by its title.

### Modified Capabilities
- `codex-transcripts`: the Codex session index is ingested, and its thread names become session titles.
- `live-sessions`: the active-session list and the session payload carry a title. A first-prompt title is transcript text and is sent only on request.
- `live-dashboard`: the rail, the stream header and the Wall tiles show the session title.

## Impact

- `store.py`: the Claude Code deriver reads `custom-title` and `ai-title` lines. A new derived table holds each session's agent titles. A store opened before this change needs one `rebuild` to fill titles for past Claude Code sessions. New lines get titles without one.
- `codex.py`: `files()` includes `session_index.jsonl`. Its lines get a key and a session id, and the Codex deriver records their thread names.
- `metrics.py`: `with_titles` and the session sheet use the resolved title. The error-loop and recent-call rows carry a title.
- `live.py`, `app.py`: `/api/live` and `/api/live/session` carry `title` and say whether it came from the agent or the prompt. `/api/live` accepts `text=1`.
- `web/src`: Live's `Wall.tsx` and `LivePage.tsx`, Activity's `tables.tsx`, and `ToolSheet.tsx`. Payload types go in `api.ts`. Fixtures are regenerated and `web/dist/` is rebuilt.
- `README.md`: Live shows session titles, and the note about the first-prompt fallback under Full text.
- No new dependency and no network call.
