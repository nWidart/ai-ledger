# Design

## Context

See proposal.md for why. The current state:

- `metrics.prompt_title()` builds a title from the first prompt. `metrics.with_titles()` adds it to session rows for the Activity and Cost session lists and for palette search. The session sheet calls `prompt_title()` itself. Each call runs `first_prompts()`, which looks up each session's first prompt line in `raw_lines`.
- The web side names sessions with `sessName()` in `web/src/components/sheets/session.ts`, which falls back to `#` and the first eight characters of the id. The error-loop rows and the tool sheet call `shortId()` directly, because their payloads carry no title.
- `raw_lines` already keeps every Claude Code `custom-title` and `ai-title` line, because ingest stores every line. The `Deriver` ignores them. These lines carry `sessionId`, but no `uuid` and no `timestamp`.
- Codex writes `~/.codex/session_index.jsonl`, one `{id, thread_name, updated_at}` object per line. It is append-only: a rename appends a new line. One sample held 33 lines for 28 ids. `codex.files()` reads only `sessions/` and `archived_sessions/`.
- Live lists come from `live.sessions()`, which reads the `sessions` table. `/api/live` has no `text` parameter today. Only `/api/live/session` has one.

## Goals / Non-Goals

**Goals:**
- One place decides a session's title, and every payload that names a session uses it.
- Titles come back after `rebuild`, from stored lines alone.
- Live never sends prompt-derived text without `text=1`.

**Non-Goals:**
- No change to how `prompt_title()` reads a prompt.
- No title history: only the current title is kept.

## Decisions

### 1. A derived `session_titles` table, not columns on `sessions`

`session_titles(session_id PRIMARY KEY, custom VARCHAR, agent VARCHAR)` is a new derived table. It is listed in `DERIVED`, so `rebuild` drops it and replays it. Each deriver fills `self.titles[sid]` and `flush()` upserts it: `custom = coalesce(excluded.custom, session_titles.custom)`, and the same for `agent`. Lines are replayed in byte order, so the newest line wins.

*Why not columns on `sessions`?* The Codex index can name a session before its rollout file is read. On a first ingest the index sorts before `sessions/`, and the index also names sessions whose rollouts are gone. A `sessions` upsert would then create rows with no project or timestamps, and those rows would show up in session lists. A separate table holds those names without creating a session. It joins only to sessions that exist.

*Why two columns and not one?* The spec says a custom title beats an AI title whatever their order. One column would need the kind stored beside it anyway.

### 2. Resolve the title in one SQL-plus-Python helper in `metrics.py`

`metrics.titles(cur, sids)` returns `{sid: (title, "agent" | "prompt")}`. It works in three steps:
1. Read `coalesce(custom, agent)` from `session_titles`.
2. For sessions with neither, fall back to `prompt_title(first_prompts(...))`.
3. Apply the 80-character cap and whitespace collapse to every source, reusing the end of `prompt_title()`.

`with_titles()` and the session sheet call `titles()`. `live.py` calls it too, and drops `"prompt"` titles unless `text`.

Step 1 serves most sessions, so the `first_prompts()` raw-lines scan now runs only for the few without an agent title. That makes the Cost and palette payloads cheaper than today.

### 3. The Codex index becomes a Codex "transcript" file

- `codex.files()` adds `<root>/session_index.jsonl` when it exists, so ingest reads it incrementally and `rebuild` replays it like any file.
- `codex.key()` gives index lines `codex-index:<id>:<updated_at>`. A line written again after a rewrite of the file is then stored once.
- `codex.fields()` returns `d["id"]` as the session id for index lines.
- `codex.subagent()` is false for the index.
- `CodexDeriver.add()` sees an object with `thread_name` and no `type`, and sets `titles[id]["agent"]`.

The index file sorts before `sessions/`, and `session_titles` does not need its session to exist yet. So order does not matter.

*Alternative considered:* a separate reader like `insights.ingest`, with its own raw table. That adds a raw table and a second rebuild path for one small file. Reusing the transcript path costs four small functions.

### 4. Live: `title` and `title_from` on list entries and on the session payload

- `/api/live` accepts `text=1`, as `/api/live/session` does.
- Both payloads carry `title: string | null` and `title_from: "agent" | "prompt" | null`. Without `text`, a `"prompt"` title is sent as `null`.
- `useLive` already knows the Full text state. It passes `text=1` to the list request too, and refetches the list when the toggle changes.

### 5. UI fit

| Place | Layout | Fallback when no title |
|---|---|---|
| Wall tile | New one-line row under `.top`: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`, `title` attribute set to the full title. The tile grows by one line. | Row left out |
| Rail entry | Title becomes the main line in place of `ProjectName`, with ellipsis. `ProjectName` moves to the front of `.sub`: project · state · source, with branch dropped there because the stream header shows it. Cost stays on the main line. | `ProjectName` stays the main line, as today |
| Stream header | The title goes in an `h2` above the existing chips row. The project keeps its place in the chips row. | No `h2`, as today |
| Error-loops drawer (Activity), tool sheet error loops and recent calls | The `when sess` cell pattern from `SessionsDrawer`: a `cellbtn` showing `sessName(s)` with `title` set to the full title, and the small line holding the short id. The error-loop sentence in the tool sheet keeps its inline link, with the label changed from `shortId` to `sessName` and the tooltip set to the full title. | `sessName` shows the short id, as today |

The rail is the tightest spot. Moving the branch out of `.sub` keeps the second line from wrapping at the rail's width. The rail's aria label and the Wall button's `aria-label` become `Open <title or project>`.

## Risks / Trade-offs

- [A store opened before this change has no `session_titles` rows for past sessions] → Past Claude Code titles appear only after `uv run app.py rebuild`. Until then those sessions fall back to the first-prompt title, which is what they show today, so nothing gets worse. New lines are titled on ingest. The README notes the rebuild.
- [Codex index rows for past sessions] → The index is a new file to ingest, so the first ingest after this change reads it whole. No rebuild is needed for Codex.
- [`ai-title` can lag the first prompt by a few seconds] → Live shows the project until the title arrives. The change notice for that line triggers a refetch.
- [Claude Code changes the `custom-title` or `ai-title` line format] → The deriver ignores lines without a string title, and the session falls back to its first-prompt title.
- [Repeated `custom-title` lines: Claude Code rewrites them often, and one sample had 1,624 lines across 57 files] → Each repeat is a cheap upsert of the same value. No dedup is needed beyond what raw lines already do.
- [The agent title is still a summary of the user's prompt, shown on Live without Full text] → It is what Claude Code, Codex and T3 already show in their own UIs. This was accepted during exploration.

## Migration Plan

1. Deploy. `open_store` creates `session_titles` through `DERIVED_SCHEMA`.
2. Stop the app and run `uv run app.py rebuild` once to fill titles for past Claude Code sessions.
3. Rollback: revert the change. The extra table and the stored index lines do no harm. A `rebuild` on the old code leaves the table in place and unread, since the table is not in its `DERIVED`, and keeps the index lines in `raw_lines`. Old code never reads the file again, because its `codex.files()` does not list it. Its `rebuild` still gives the stored index lines to the Codex deriver, since the `files` row says `codex`. That deriver returns on a line with no `payload` object. Checked during apply on `main`'s `codex.py`: an index line given to `CodexDeriver.add` and flushed adds no row to any derived table.
