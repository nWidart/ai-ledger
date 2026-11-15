# Proposal

## Why

The Context page holds a lot of analysis and shows little of it. It has one real chart (the growth curve); the rest is four tables, a 96-pixel weekly strip, five-bin bars and single-number tiles. A review by three models (Claude Opus, GPT Sol, Gemini) agreed on what is wrong:

- **The peak-fill bars mislead.** Each window's bars scale to that window's own largest bin, so a window with one session looks like a window with a hundred. The bins are unequal (25, 25, 25, 15 and 10 points) and drawn as equal columns, and the 80% line the `near_limit` tip warns at falls inside a bin.
- **Starting context hides its spread.** The 90th percentile is computed and sent, and never shown. The inline bar draws the median alone, so a project where every session starts at 40,000 tokens looks like one where half start at 15,000 and half at 70,000. The weekly strip has no y-axis, stretches its labels and does not say how many sessions a week rests on.
- **The growth curve hides who is left.** Its last turns rest on a handful of long sessions, and the line reads as one population. It plots raw tokens, so sessions with a 200,000-token window and a 1,000,000-token window share one axis with no limit to read against. The project curves cannot be told apart or isolated.
- **No chart leads to a session.** The page shows medians and bins, never one session, although every session has a start, a peak, a window and a compaction count in the store.
- **The Cost section has no chart**, and nothing shows when caching got worse.
- **The tool tables bury the shape of the problem.** A 56-pixel bar per row cannot say whether a tool fills context with many small results or a few huge ones.

## What Changes

Six visualisations, each replacing or joining an existing one. No figure the page shows today changes meaning except the peak-fill bins.

1. **Window pressure** replaces the peak-fill bars: one full-width stacked bar per window size, each segment a share of that window's sessions, cut at 25%, 50%, 80% and 90% so the warning threshold is a segment edge. Selecting a segment lists its sessions, each opening its session sheet.
2. **Starting context ranges and trend** replace the inline bar and the weekly strip: each project row draws its 10th to 90th percentile range with the median marked, on one shared scale with the 30,000-token tip threshold; the weekly chart becomes a line with a 25th to 75th percentile band, a y-axis, calendar-spaced weeks and faded points for weeks with few sessions.
3. **Growth chart** gains a strip of the sessions still contributing at each turn, a switch between tokens and share of the window (with the 80% line), and a legend whose project keys isolate one project and draw its band.
4. **Session map** is new: one dot per session, starting context against peak share of the window, ringed when it compacted, with the 30,000-token and 80% lines dividing it into four regions. A dot opens the session sheet.
5. **Cache use over time** is new, in the Cost section: prompt tokens per day (or week, for a long view) stacked by cache read, cache write and uncached input, the cache-hit ratio as a line, and the cache breaks per bucket by cause.
6. **Tool contributors** replaces the inline bars of the tool tables: the largest contributors ranked by total result size, each beside its median to 95th percentile result size, with the main-thread and subagent totals as one split bar. The tables stay under it.

Also fixed while the section is open: the per-project growth table is shown whenever the view has more than one project, not only when a session compacted.

## Out of scope

- Attributing each rise in context to the tool calls before it. It needs a join of requests and tool calls by time and an assumption about how to split a rise; the review disagreed on whether it can be trusted.
- A per-compaction table (tokens before each compaction, automatic or manual). It needs a parser change and a rebuild.
- A new session viewer. Every drill goes to the existing session sheet and its timeline.
- CLI version markers on the weekly trend, and any figure from `/insights` facets.
- The cause of a Codex cache break after a pause of 5 to 30 minutes. That is a defect in the existing rule and is fixed in its own change, `fix-codex-cache-expiry`.

## Impact

- `src/ai_ledger/context.py`: new aggregates on the payload (see `design.md`), one changed bin edge. No parser change, no schema change, no rebuild.
- `web/src/api.ts` (`ContextPayload`), `web/src/pages/context/` (new chart components, `sections.tsx`, `ContextPage.tsx`, `context.ts`, `Charts.tsx` removed), `web/src/__fixtures__/context.ts`, and the build in `src/ai_ledger/web/`.
- `tests/test_context.py`, the page tests.
- Spec: `context-dashboard`.
- `README.md` (the Context paragraph) and `CHANGELOG.md`.
- `adopt-tanstack` is proposed and not started. It replaces `useApi` in `ContextPage.tsx`; this change does not touch how the page fetches, so the two do not overlap beyond that file's imports.
