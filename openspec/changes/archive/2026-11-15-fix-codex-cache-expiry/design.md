# Design

## Where the lifetime comes from

`prices.json` has no lifetime field: it holds rates, and its `openai` note only says what the `cache_5m` column means. Adding a field would be configuration for a fixed fact. The lifetime depends on the session's source (`sessions.source`, `claude` when null), which `context.sess` already carries. So `context.py` keeps one constant per source next to `CACHE_TTL_S`: `CACHE_TTL_S = 300` (Claude Code) and `CACHE_TTL_CODEX_S = 1800`.

## The rule

In `session_breaks`, the lifetime of a break is, in order:

1. `CACHE_TTL_1H_S` when the previous request wrote 1-hour cache entries (`cache_1h > 0`). Codex reports no 1-hour writes (`prices.json`: `cache_1h` is 0), so this only ever applies to Claude Code.
2. `CACHE_TTL_CODEX_S` when the session's source is `codex`.
3. `CACHE_TTL_S` otherwise.

The pause is compared as before: `expired` when it is longer than the lifetime, else `other`. A model switch is still checked first.

## Text

The cause totals of the tip mix sources, so its advice cannot name one lifetime. It says "5 minutes in Claude Code, 30 in Codex". The drawer hint shows for every source and names no agent, so it says "5 minutes, or 30 for OpenAI's cache".
