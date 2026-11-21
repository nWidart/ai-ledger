# Grok fixtures

Trimmed `updates.jsonl` lines of Grok CLI 1.0.92, made neutral by `sanitize.py` (its docstring
gives the command and the rules). Each label is a Grok home: `<label>/sessions/%2Fwork%2Fapp/<session>/updates.jsonl`.
The working folder of every session is `/work/app`.

| Label | Source | What it holds |
|---|---|---|
| `probe` | the task 2.1 probe | Parent and child session. Turn 1: a `spawn_subagent` call, `ls missing-dir` marked `completed` with exit code 1, `git commit -m x`, a `use_tool` call that failed with `is_error`; 5 `modelCalls` reported for 3 parent calls. Turn 2 (resumed, `promptIndex` 1): `sleep 60` with only its in-progress update, then the process was killed; no `turn_completed`. The resumed run's event ids restart at 1, so two ids repeat. |
| `long-turn` | a real one-turn session | One turn cut to five model calls (the first four and the last), a prompt in two chunks, event ids out of file order. |
| `compaction` | a real one-turn session | The call that reaches 204,942 tokens, `auto_compact_started` (window 256,000), `pre_compact` hook, `compaction_checkpoint`, `auto_compact_completed`, the next call; four calls kept. |
| `cancelled` | a real one-turn session | A turn that ends with `stop_reason: cancelled` (`cancelTrigger`, `cancellationCategory` in its `_meta`); three `streamStartMs` values kept for 2 `modelCalls`, as in the real turn (51 for 50). |
| `tools` | two real sessions and the probe | One session of four turns moved in time one after the other: a `grep` marked `failed`; `use_tool` calls (one succeeded, one failed with `is_error`) and a shell command marked `completed` with exit code 1; a `git commit -m x` and a failed MCP call; a resumed turn with a call that only has its in-progress update. Event ids of turn k are offset by 100,000 × k. |

Hooks (`hook_execution`) appear in every label.

## Usage of cut turns

The probe's turns are whole and keep the reported figures. Each cut turn's `turn_completed`
is rewritten from its kept calls (rules in `sanitize.py`, `fit_usage`). The figures:

| Turn | inputTokens | cachedReadTokens | outputTokens | reasoningTokens | modelCalls | apiDurationMs | costUsdTicks |
|---|---|---|---|---|---|---|---|
| `long-turn` | 219,935 | 203,717 | 7,705 | 6,652 | 5 | 99,252 | 1,805,245,000 |
| `compaction` | 386,942 | 372,375 | 5,245 | 3,997 | 4 | 84,231 | 2,467,915,000 |
| `cancelled` | 389,835 | 373,011 | 4,001 | 2,557 | 2 | 55,059 | 2,441,595,000 |
| `tools` turn 1 | 289,535 | 273,236 | 5,270 | 4,824 | 2 | 85,437 | 2,008,360,000 |
| `tools` turn 2 | 477,744 | 466,551 | 3,379 | 2,610 | 3 | 56,329 | 2,759,355,000 |
| `tools` turn 3 | 46,154 | 19,850 | 556 | 402 | 2 | 9,067 | 658,690,000 |

`cacheCreationTokens` is 0, `totalTokens` is input plus output, `numTurns` equals `modelCalls`,
and `modelUsage` repeats the figures under `grok-4.7-build`.
