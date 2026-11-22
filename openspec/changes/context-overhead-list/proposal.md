# Proposal

## Why

A reader with one Claude Code project asks what is loaded into every session before they type, and which single thing would save the most if they removed it. The window grid answers the first half by category ("System tools", "Skills", "MCP tools", …). The collapsed "Largest overhead items" list under it answers the second half only in part: five items per group, no custom agents, no idea of how many items there are, and nothing on whether an item is used at all.

The owner first asked for a treemap. A study of the data (`.claude/plans/recommendation-treemap-flamechart.md` in the main checkout, accepted by the owner on 2026-11-22) found it the wrong picture: two thirds of the overhead (system tools, system prompt, MCP server instructions) has no items to nest, and the one large category with items, Skills, is a hundred or more near-equal slivers that no phone can label. A ranked list with a bar per row, a count and a median per category, and "called N times" per MCP server and skill answers "what can I remove" directly. This change plans that list.

## What Changes

- **"What loads before your first prompt" replaces "Largest overhead items"** in the window grid that the Project page's Context block and the Context page (one project selected) share. Like the list it replaces, it is a closed disclosure, so the first screen of both pages does not change. Its summary gives the total.
- **Categories ranked by tokens.** Each row gives the category's tokens, its share of what loads before the first prompt, and a bar on one scale.
- **Items under their category, ranked by tokens.** MCP servers (their tools summed, the tools behind a disclosure on each server), memory files (the file name, with its type and folder below), custom agents (new: the payload never sent them) and skills. Each category says how many items it holds and their median, so "many small" reads in words ("214 skills, median 40 tokens"). A list of more than six shows five and folds the rest into "209 more, 8.4k tokens" with Show all.
- **"Called N times by Claude Code in this view"** on each MCP server row and skill row. The view's range and automated filter apply, and subagents' calls count. The name opens the server's or the skill's tool sheet.
- **Items that do not fit their category are not drawn as if they did.** In the repo's real `/context` fixture the MCP tools listed hold 805 tokens and the "MCP tools" category 619: the list includes tools that are not loaded, and the snapshot does not say which. Such items get no bar, and the category says why. Items whose category is missing or at 0 are listed after the categories, with no bar and no share.
- **The snapshot's age.** A snapshot taken before the view's first day says that the configuration may have changed since.
- **`/api/context` `overhead`** loses `top` (three top-five lists) and gains `items` (every MCP tool, memory file, custom agent and skill of the snapshot, with its `seq` and, for an MCP tool, the server key its calls are stored under), `calls` (calls per MCP server and per skill in the view, Claude Code's only) and `before_view`. The whole Context payload is read in one transaction, as the usage payload is, so the snapshot and the call counts belong to one moment.
- **No chart, no chart library, no new dependency.** HTML lists and CSS bars, with native disclosures and buttons.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-page`: "List the largest overhead items" is removed. New requirements cover the list, the snapshot's age, the items under their category, the call counts, the items that do not fit their category, and the list's fit on a phone, at 32px text and under forced colors.
- `context-dashboard`: "Draw each project's window as a grid" now says that the one-project grid carries the same list. No requirement that the `echart-context` change adds or modifies is touched.

## Impact

- **Server.** `src/ai_ledger/context.py`: `overhead()` reads every item and the call counts, and `payload()` runs in one read transaction. `src/ai_ledger/store.py`: the rule that names an MCP tool's server (`mcp__<server>__<tool>`) becomes a function, `mcp_server_of()`, that the parser and `overhead()` share. No stored data changes, and no `rebuild` is needed.
- **Web.** `web/src/api.ts` (the `ContextOverhead` type), a new pure model `web/src/pages/project/overhead.ts`, a new component `OverheadList.tsx` with its `OverheadList.css`, and `ContextGrid.tsx` (its `TopItems` goes). `project.ts` drops `top` from `GridOverhead`. `Grids.tsx` and `blocks.tsx` do not change: both already pass the snapshot to `ContextGrid`.
- **Bundle.** `ContextGrid-*.js` is 3.7 kB gzip today with no limit. The plan expects about 6 kB and adds an 8 kB limit to `web/scripts/check-bundle.mjs` once `echart-context` has merged.
- **Payload.** With 300 skills and 60 MCP tools, `overhead` grows from 1.1 KB to 37.3 KB of JSON (3.2 KB gzipped; the app does not compress responses), and the payload takes about 6 ms more (design decision 2).
- **Tests.** The context payload's Python tests, a model test, a component test, and one assertion block on each page's existing grid test. About 300 net test lines.
- **Docs.** `CHANGELOG.md`; the docs site's Project page, Keep context lean, Share your screen and the glossary; the Context page's docs after `echart-context` merges. The `project-context` and `project-layout` shots are recorded again. `README.md` names neither list and does not change.
- **Collisions.** The change edits no file that `echart-context` edits, except three: `site/src/content/docs/pages/context.mdx` and `web/scripts/check-bundle.mjs`, whose steps wait for that change to merge (`tasks.md` 4.2 and 4.3), and `CHANGELOG.md`, where each change only adds bullets to `[Unreleased]`. It records no Context shot and does not edit `tools/demo/record.mjs` or `site/src/assets/shots/README.md`.
- **Open to the owner.** The questions at the end of `design.md`.
