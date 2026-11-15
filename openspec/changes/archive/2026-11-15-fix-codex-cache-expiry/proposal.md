# Proposal

## Why

The Context page labels a cache break `expired` when the pause before it is longer than 5 minutes (1 hour when the previous request wrote to the 1-hour cache). That is Claude Code's prompt cache. OpenAI's cache, which Codex uses, lives 30 minutes: `prices.json` says so, as it prices the `cache_5m` column of OpenAI models as the 30-minute cache write. So a Codex break after a pause of 5 to 30 minutes is shown as an expiry when the cache had not expired, and the cache-breaks tip tells the user to keep turns within 5 minutes when that does not apply.

## What Changes

- A cache break's cause is `expired` when the pause before it is longer than the cache lifetime of its session's source: 5 minutes for Claude Code (1 hour after a request that wrote 1-hour cache entries, as before), 30 minutes for Codex. A shorter pause leaves the cause `other`.
- The advice of the cache-breaks tip and the hint of the "Sessions where caching broke" drawer name the lifetime per source instead of 5 minutes alone.

## Impact

- `src/ai_ledger/context.py`: the cache-break rule and the tip's advice text only.
- `web/src/pages/context/drawers.tsx` (hint text), the rebuilt `src/ai_ledger/web/` and the page-test fixtures (the advice text is in the payload).
- Stored data and the derived tables are unchanged; no rebuild is needed.

## Capabilities

### Modified Capabilities

- `context-dashboard`: the cache-break cause rule and the cache-breaks tip.
