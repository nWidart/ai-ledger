# Proposal

## Why

While a Live page is open, the app ingests every second and the page asks for the active list after each notice. Each answer reads and parses the newest 200 stored lines of every active session again, even when only a few lines are new. With about 15 active sessions, one `/api/live` answer took about 2 s of DuckDB and Python work. Requests came in faster than they finished, and one app held about five CPU cores for as long as the page stayed open.

Measured on a copy of a store with 928,000 lines and 15 active sessions:

- Picking the newest lines by key took 15 ms. Reading their stored JSON took about 1 s: 16.6 MB, spread over many compressed segments.
- Turning those lines into events took 0.5 s, nearly all of it in the per-source item code (`live_items`), not in `json.loads`.
- The turn-mark queries took 0.3 to 1.5 s, even when they found nothing. They project or test the JSON of every line of the active sessions. A keys-only Grok query took 14 ms.
- The forked-thread query took 0.15 s, for the same reason.
- Reading the JSON of the 30 newest lines took 10 ms.

So almost all of the cost is reading lines the app already read one second earlier.

## What Changes

- The app keeps what it derives from each stored line between requests: the line's Live items and the few values the Live queries read from its JSON. Stored lines never change their content, so an entry stays valid for as long as the app keeps it.
- The active list, the session states (nav badge, `/metrics` gauges) and the state part of the session payload pick their lines with queries that read no JSON. They then read the stored JSON only for lines that are not kept yet.
- The turn-mark and forked-thread lookups get the same treatment. They select candidates by type, session and file, and they read a JSON value only once per line.
- What the app keeps is bounded. When an entry is dropped, the line is read again the next time it is needed.
- Payloads stay the same: same fields, same values, same order. Only the cost changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `live-sessions`: adds a requirement that a repeated Live read parses only lines it has not parsed before, with the same answer as a fresh read.

## Impact

- `src/ai_ledger/live.py`: `recent`, `turn_mark_rows`, `forked`, `assemble`, and their callers `sessions`, `states` and `session`.
- `src/ai_ledger/app.py`: the `App` owns the kept lines and passes them to the Live routes, `live_waiting` and the `/metrics` gauges.
- `tests/test_live.py`: equality with a fresh read, and the incremental read.
- No change to the store schema, the derived tables or `rebuild`, and no new dependency.
- No change to the web page or to any payload. The README and docs site describe no internals affected here. The CHANGELOG gets one line, because the CPU drop is visible to users.
