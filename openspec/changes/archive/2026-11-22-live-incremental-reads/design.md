# Design

## Context

See proposal.md for the motivation and the measurements.

Today every Live read goes through the same steps:

- `recent(cur, sids)` ranks the lines of the given sessions with a window function and projects `r.json` with them. DuckDB therefore decompresses the JSON of every line of the active sessions before `QUALIFY` keeps the newest 200 per session and thread kind.
- `turn_mark_rows` and `forked` filter on `contains(json, …)` or `json_extract_string(json, …)`, so they decompress the same JSON again.
- `assemble(rows, copied)` runs `json.loads` and the source's `live_items` on every row.
- `sessions` (`/api/live`), `states` (the nav badge through `live_waiting`, and the `/metrics` gauges) and `session` (the state and window of `/api/live/session`) each repeat this work on every call.

These facts make it safe to keep per-line results:

- `raw_lines` only grows. `store.ingest` inserts deduplicated rows. No code deletes a row or changes a row's `json`, `type`, `parsed`, `file` or `ts`. Only `session_id` and `subagent` change: `store.rebuild` reassigns files, and `grok.py` folds a subagent thread into its parent. `rebuild` runs only while the app is stopped.
- A line's source never changes: the source comes from its `files` row.
- What `live_items` gives for a line depends only on the line's JSON and its source.

So whatever the app derives from a line's JSON stays valid as long as the line exists. Which lines a read needs, and the session, thread kind and time of each one, must still come from the store on every read.

The server answers each request on its own thread (`ThreadingHTTPServer`), and every request uses its own cursor.

## Goals / Non-Goals

**Goals:**
- A repeated Live read costs about as much as its JSON-free queries plus the lines that are new. Target: under 100 ms for `/api/live` with 15 active sessions on the measured store, against about 2 s today.
- Answers stay exactly as they are now.

**Non-Goals:**
- The rest of `session()`: `head_rows`, `started_by`, `spawned`, `earlier_uses`, `open_before`'s range read, `lanes`, `compactions` and `pulse`. They are scoped to one session and measured at 70 to 280 ms per payload. They can use the kept lines in a later change if they matter.
- How often notices go out, the one-second ingest, and the page's refetch rules.
- The `/metrics` counters. They are rebuilt on each scrape after any store change, at about 2 s. That is a separate issue with a separate fix.
- Store schema changes, such as a derived turn-mark table.

## Decisions

### D1. Keep results per line, keyed by `raw_lines.key`

A new `live.Lines` object maps a line's key to what Live derives from its JSON:

- `items`: the result of `live_items`, read-only;
- `ordinal`: the line's `ordinal`, used to skip a fork's copied history;
- named JSON values that a lookup asks for: the Codex turn-mark value at `Turns.path`, and `subagent_history_start_ordinal`.

Each read gets its rows from JSON-free queries (key, file, `ts`, `subagent`, source, `line_no`, `type`). It then asks `Lines` for the entries of those keys. `Lines` fetches the JSON of the missing keys in one query (`WHERE list_contains(?, key)`), derives the entries and drops the JSON text.

Rows that a caller has already read with their JSON, such as the range reads of `session()`, give their text to `Lines` so it is not read twice.

Alternatives considered:
- **A watermark per session** (newest `ts` or `rowid`, then read only newer lines). A late line can be stamped before the watermark, and a moved line changes session without becoming newer. Both would need special handling. Diffing by key is exact by construction, and the key-only ranking costs 15 ms.
- **Caching each session's whole answer until the session gains a line.** With 15 sessions writing all the time, nearly every session changes every second, so this saves almost nothing.
- **A derived table of turn marks and live items, filled at ingest.** This would need a schema change, `rebuild`, and changes to the session moves in `rebuild` and `grok.py`. It costs more than the problem, and the key memo gets the same steady-state cost.

### D2. Rank lines without their JSON

`recent` keeps its window function but projects only JSON-free columns. `assemble` takes rows with no JSON and gets each row's items and ordinal from `Lines`. It keeps its current behavior for joins, groups, forked lanes and the closing of interrupted turns.

### D3. Select turn-mark and fork candidates by column, read their values once

- **Grok marks** (`Turns.path` is `None`): the mark is the row's `type`. The query projects no JSON, which measured 14 ms.
- **Codex marks**: candidates are the `event_msg` rows of the sessions, selected without JSON. Each candidate's value at `Turns.path` comes from `Lines`, fetched once per key with `json_extract_string`, so the text is never held. The newest start and end per session and file, and the `before` cut used by `open_before`, are chosen in Python. They follow the same order the SQL uses today: `ts` descending, then `line_no` descending.
- **`forked`**: candidates are the `session_meta` subagent rows whose key starts with `codex:`. Each one's `subagent_history_start_ordinal` comes from `Lines` in the same way. The minimum per thread is taken in Python.

A key that has a value but no items is a full entry once its items are needed. Both kinds of entry share one map.

### D4. The App owns one `Lines`; callers pass it in

`App.__init__` creates `self.lines = live.Lines()`. `/api/live`, `/api/live/session`, `live_waiting` and the `/metrics` gauges pass it to `sessions`, `session` and `states`. These functions take `lines=None`, and `None` means a new, empty `Lines` for that call. Tests and other callers can then call them as they do now, and get the same answer with no shared state.

### D5. One lock, the fetch outside it

`Lines` guards its map with a `threading.Lock`. A lookup takes the lock to collect hits and missing keys, and releases it. It then fetches the missing keys on the caller's cursor with the lock released, and takes the lock again to insert. Two threads can fetch the same key at the same time. That is harmless: both derive the same entry, and the second insert overwrites the first. Holding the lock during the fetch would make every open page wait behind one slow read.

### D6. A size bound with least-recently-used eviction

The map is an `OrderedDict`. A hit moves the entry to the end. Each entry weighs the length of the JSON text it came from, or 0 for an entry with only values. When the total weight passes `KEPT_BYTES` (64 MB), entries are evicted from the front until the total is under the bound again. Entries with only values carry no weight, so they also count toward `KEPT_LINES` (200,000 entries) to bound their number.

On the measured store, the window of 15 active sessions weighs 16.6 MB, so the bound holds several sessions' turnover. An evicted line is read again on demand, so the bound affects only cost, never answers.

## Risks / Trade-offs

- **An answer differs from a fresh read** because of a mistake in the row order or the mark selection. Mitigation: tests compare each changed function, with kept lines and without, over the Claude Code, Codex and Grok fixtures that the Live tests already build, before and after new lines are added.
- **A caller mutates items that are shared.** `assemble` copies every item into a new event dict. Nested values, such as tool input dicts, are shared. Mitigation: `Lines` hands out items as read-only by contract, and a test asserts that a second `assemble` over the same kept lines equals the first.
- **Memory.** The bound is at most 64 MB of source text, plus the overhead of Python objects, which could double it. This is acceptable for a local app, and the constant can be lowered without changing any answer.
- **The first read after start, or after a new session appears, still pays the full cost** (about 1 s with 15 active sessions). After that, reads cost only the new lines.
- **Overlap with `feat/live-readability`**, which also edits `live.py` (34 lines) and the `live-sessions` spec. The two changes do not depend on each other. Whichever merges second rebases, and `assemble` and `recent` are the likely places for conflicts.

## Migration Plan

There is no data migration. Deploying means shipping the new version. Rolling back means shipping the old version: nothing is stored, and the kept lines live only in the process's memory.
