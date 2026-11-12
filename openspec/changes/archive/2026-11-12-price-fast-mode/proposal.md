# Proposal

## Why

Claude Code transcripts record each response's `usage.speed`: `"fast"` for a fast-mode request, `"standard"` otherwise. The parser ignores it, so fast-mode requests are priced at the standard rates. Anthropic charges fast mode at twice the standard input and output rates (read 2026-11-12 on the [pricing page](https://platform.claude.com/docs/en/about-claude/pricing) and the [fast mode page](https://platform.claude.com/docs/en/build-with-claude/fast-mode)), so the Cost page under-states what fast mode cost.

## What Changes

- **Store the speed**: the derived `requests` table gains a nullable `speed` column. The Claude Code parser stores `message.usage.speed` as written, NULL when absent. Codex rows keep NULL. A store from before this change gains the empty column when it is opened; `ai-ledger rebuild` fills it from the stored lines.
- **Price fast mode**: a model entry in `prices.json` (packaged or user) may carry an optional `fast` object with the five rates, as it may carry `long`. Fable 5.2 and Opus 5.5 have one. A request whose speed is `fast` on such a model costs the fast rates. Fast pricing applies across the full context window, so it replaces the long-prompt tier. A fast request on a model without fast rates costs the standard price (it is not unpriced).
- **Validate `fast`** in the user prices file as `long` is: a malformed `fast` object is reported and the file ignored.
- **Show it**: the Cost page's "Models and effort" ledger separates fast-mode requests into their own row, marked "fast".

Out of scope: Codex service tiers (Codex writes `service_tier` in `thread_settings`; mapping it to a price is a follow-up), fast-mode marks elsewhere in the UI.

## Capabilities

### Modified Capabilities
- `cost-dashboard`: fast-mode requests are priced at fast rates and shown apart in the model mix.
- `transcript-store`: derived requests carry the response's speed.

## Impact

- `src/ai_ledger/store.py`, `src/ai_ledger/codex.py`: `speed` column, parser, open-time column add.
- `src/ai_ledger/metrics.py`, `src/ai_ledger/prices.json`: `fast` tier in `price_cte`, `requests_cte`, `user_prices`; `fast` flag on the Cost page's model rows.
- `web/src/components/sheets/ProjectSheet.tsx`, `web/src/api.ts`: the "fast" mark.
- `README.md`, `CHANGELOG.md`.
