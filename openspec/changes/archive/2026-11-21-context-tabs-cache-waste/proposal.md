# Proposal

## Why

The Context page is about 4,000 px tall, with a 9-pill section bar over seven panels and two drawers. The tips take a row of cards above the first chart. The cache chart stacks cache reads with the costly tokens on one axis: reads are often 90% of prompt tokens, so uncached input and cache writes, the part a user can reduce, shrink to slivers, and a second axis lays the hit ratio over the bars. The session map and the pressure bars name sessions by a short id only. The four regions the 30k-start and 80%-peak lines cut are not named, and cannot narrow anything. The window grid of a typical session is only on the Project page. The compaction and long-tier tips advise `/clear` and `/compact` on a Codex-only view, where those are not the commands.

## What Changes

- **Tips strip.** Under the lede, firing tips show as one compact strip of short items, at most four before "Show N more". An item expands its evidence, advice and sessions in place. The first chart starts on the first screen at 1440 × 900.
- **Three tabs replace the section bar.** Overhead and pressure (starting context, window grids, window pressure, session map), Growth and bloat (growth, what fills context, the largest results drawer), Cache health (cache chart, cost by project, the cache breaks drawer). The tab is kept in the URL (`tab=growth|cache`). The tabs follow the WAI-ARIA tabs pattern with arrow keys, Home and End.
- **Cache chart shows waste.** The main volume is uncached input and cache writes. Cache breaks by cause sit on an aligned strip under it, and the cache-hit ratio on its own thin track. Cache reads show only when the user turns them on.
- **Session titles.** The session map and the pressure lists show session titles in tooltips, readouts and tables. The payload's map points carry `title`.
- **Quadrants.** The map names its four quadrants. Selecting one, by click or by its button, narrows the pressure bars to its sessions and lists them. Escape or Clear restores the view.
- **Window grids.** The Overhead tab shows the `ContextGrid` of the Project page as small multiples for the view's top projects, at most six: start, median peak and free space. With one project selected, it shows the single full grid. The payload adds `growth.peak.by_project`.
- **Source-aware tips.** The compaction, long-tier and large-start advice names Claude Code's commands only when matching sessions are Claude Code's. For Codex sessions it names Codex's own (`/new`, `/compact`, `codex mcp list`). For both, it names each.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `context-dashboard`: tips strip and tabs; cache chart; session titles; quadrants; window grids; source-aware advice.

## Impact

- `src/ai_ledger/context.py`: `sessions_map` points carry `title`; `growth.peak.by_project`; tip advice takes the matching sessions' sources. Tests in `tests/test_context.py`; fixtures regenerated.
- `web/src/pages/context/`: `ContextPage`, `sections`, `tips`, `CacheChart`, `SessionMap`, `PressureBars`, new `Tabs` and `Grids`; `search.ts` gains `tab`.
- `web/src/pages/project/`: `contextGrid` splits into a builder that Context reuses; `ContextGrid` gets a compact form and its own stylesheet.
- `web/src/api.ts`: `SessionPoint.title`, `growth.peak.by_project`.
- `tools/demo/record.mjs`: Context shots and the GIF scene open the tab that holds each panel.
- README, docs site, `CHANGELOG.md`, Context screenshots and the Context GIF.
