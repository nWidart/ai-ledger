# Tasks

## 1. Ownership (D1)

- [ ] 1.1 Add `codex.thread_class` and the `Source.placement` hook; use them in `ingest_chunk`, `CodexDeriver.start` and `rebuild`. Tests: a subagent in a plain `<thread>` file, a continuation file, a chunk with no `session_meta`, the file-name fallback, a rebuild that corrects an old store, existing tests moved to the metadata rule.

## 2. Live evidence (D2, D3, D4)

- [ ] 2.1 Skip a forked subagent's copied history in `live.session` and `live.sessions`.
- [ ] 2.2 Read Codex turn marks from the main thread only; keep a session thinking while a subagent works; read the state window per thread and the newest main-thread turn mark.

## 3. Events (D5, D6)

- [ ] 3.1 Turn a failed inner call of `exec` into a tool event.
- [ ] 3.2 Name a Codex lane from the `SubAgentActivity` start item.

## 4. Resumed session (D7)

- [ ] 4.1 State the limit in the spec.

## 5. Verify

- [ ] 5.1 Update README and CHANGELOG. Run `uv run ruff check && uv run python -m unittest discover -s tests && (cd web && npm run check) && openspec validate live-state-accuracy --strict`, rebuild a copy of the real store, apply the deltas and archive.
