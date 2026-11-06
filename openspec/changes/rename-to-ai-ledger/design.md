# Design

## Context

See proposal.md for why. Three facts shape the approach:

- The store at `data/claude.duckdb` is the only copy of lines whose transcripts Claude Code has since deleted. It sits next to a write-ahead log (`data/claude.duckdb.wal` exists today) that can hold committed data not yet checkpointed into the main file.
- A session's project is resolved once per `cwd` and cached in `projects_by_cwd`. That table is part of the raw layer, so it survives `rebuild`. `sessions.project` is copied from it during derive. After the folder rename, old `cwd`s no longer exist on disk, and the path fallback in `resolve_project` keeps naming them `claude-errors-dashboard`.
- The pages keep user state in localStorage under keys starting with `claude-` (`claude-errors-fixes`, `claude-errors-view`, `claude-errors-mode`, `claude-activity-metric`, `claude-usage-metric`, `claude-usage-hidden`, and the Drawer key). The origin `127.0.0.1:8765` does not change.

## Goals / Non-Goals

**Goals:**
- Rename the app's identity with no loss of stored lines, saved browser state or project history.
- Leave the code ready for a second transcript source without doing any of that work here.

**Non-Goals:**
- Renaming anything that means Claude itself: Claude tool names, `claude-*` prices, `~/.claude/projects`, and the Claude Code wording on Activity and Cost. The multi-source change rewords those pages once they show more than one source.
- Moving Claude Code's own transcript folders under `~/.claude/projects`. Ingest reads every folder there, so old and new folders are both ingested.

## Decisions

### Move the store file on open, only for the default path
`open_store` checks for the move before it connects. If the path is the default `data/ai-ledger.duckdb`, that file is missing, and `data/claude.duckdb` exists, it renames the file with `os.replace` and then renames `claude.duckdb.wal` the same way. Both moves stay in the same directory, so each is atomic. When both files exist, nothing moves and a log line says so; merging two stores is out of scope. An explicit `--db` is never touched.
- Alternative: copy, then delete the old file. Rejected: it doubles 3+ GB on disk and leaves a window where two stores exist.
- Alternative: keep the file name `claude.duckdb`. Rejected: the multi-source store would carry a misleading name for good, and the move is cheapest while the rename is the only change.
- Ordering: the old file moves before the WAL. If the process dies between the two moves, the next open finds the new file and an orphan `claude.duckdb.wal`. That case is detected and finished, by moving the WAL whenever the new WAL is absent, before connecting.

### Project alias applied where projects are named, plus a one-time rewrite
A small map in `store.py`, `PROJECT_ALIASES = {"claude-errors-dashboard": "ai-ledger"}`, is applied to the result of `resolve_project`, so new `cwd`s under either folder resolve to `ai-ledger`. On open, two idempotent updates rewrite stored names: `projects_by_cwd` and `sessions` rows with an aliased project get the new name. Because `rebuild` reads projects from `projects_by_cwd`, the alias survives a rebuild without any rebuild-specific code.
- Alternative: alias at query time in `metrics.py`. Rejected: every query, filter and URL would have to know both names, and `#project=claude-errors-dashboard` links would still split the view.
- Alternative: a one-off SQL fix with no map. Rejected: a worktree `cwd` under the old folder first seen after the rename, for example from a transcript ingested late, would bring the old name back.

### Keep the localStorage keys
The keys are internal identifiers that users never see. Renaming them would need a read-old, write-new migration in four modules, and a failed migration would silently lose applied-fix dates. Keeping them meets the spec with no code. `view.ts` already documents that it keeps the old page's keys.

### Title format `<Page> · AI Ledger`
The page name comes first, so browser tabs stay distinguishable when truncated. The navigation brand keeps its current two-tone treatment ("AI **Ledger**").

### Folder rename is a documented manual step, after the code lands
The rename moves the working directory out from under any running agent session or app, so it cannot run from inside the repository. The README gets a short "Renamed from claude-errors-dashboard" note with the steps (see Migration Plan).

## Risks / Trade-offs

- [The app is running during the move] → The move happens inside `open_store`, which already fails with `StoreBusy` when another process holds the lock. Only the first opener moves the file, and a second process then sees the new file.
- [WAL left behind by a crash between the two renames] → The orphan-WAL check before connecting finishes the move. Covered by a test.
- [Old `#project=claude-errors-dashboard` links] → They show an empty project. Accepted: only this repository is affected, and only links saved before the rename.
- [Claude Code memory for this project does not follow the folder] → A manual `mv` of the memory folder, listed in the steps. claude-mem and T3 Code also key projects by path. They are repointed by the user and are out of scope for the code.

## Migration Plan

1. Land the change and run the app once from the old folder, so the store moves to `data/ai-ledger.duckdb` and the project rows are rewritten.
2. Stop the app and any agent sessions in the folder.
3. `mv ~/Sites/projects/claude-errors-dashboard ~/Sites/projects/ai-ledger`.
4. Move the Claude Code memory: `mv ~/.claude/projects/-Users-nicolaswidart-Sites-projects-claude-errors-dashboard/memory ~/.claude/projects/-Users-nicolaswidart-Sites-projects-ai-ledger/memory` (create the target's parent first if no session has run there yet). Leave the transcript `.jsonl` files where they are.
5. Run `uv sync` in the new folder (the virtualenv holds absolute paths), repoint T3 Code and any shell aliases, then start the app.

Rollback: before step 3, rename `data/ai-ledger.duckdb` (and its `.wal`) back to `data/claude.duckdb` and check out the previous commit. After step 3, move the folder back first.
