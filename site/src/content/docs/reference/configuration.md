---
title: Configuration
description: Prices, plans and automated projects, where their files live and when they reload.
spec: [distribution, dashboard-app]
---

AI Ledger has two optional configuration files: `prices.json` (model prices and plan prices) and `automated.json` (extra automated projects). Neither exists by default. There are no environment variables or other settings; the command-line options are in [CLI and options](/ai-ledger/reference/cli/).

## Location and reload

Both files sit in the folder that holds the store:

| Setup | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/ai-ledger/` |
| Linux | `$XDG_DATA_HOME/ai-ledger/`, or `~/.local/share/ai-ledger/` when `XDG_DATA_HOME` is unset or empty |
| `--db <file>` | The folder of that file |

See [Data files and storage locations](/ai-ledger/reference/storage/).

The app reads each file on every page load. A change applies when you reload the page, with no restart and no `rebuild`: costs are computed from stored token counts when a page loads. An upgrade does not change either file.

A file that cannot be used is ignored whole, and the page that uses it says why (see each section).

## `prices.json`

One file holds `models`, `plans` or both.

### Prices

Cost uses the API list prices packaged with each version, in USD per million tokens. The packaged file is [`src/ai_ledger/prices.json`](https://github.com/nWidart/ai-ledger/blob/main/src/ai_ledger/prices.json). A new version brings new prices (`uv tool upgrade ai-ledger`).

The `models` object adds to the packaged models. An entry with the name of a packaged model replaces it. Key an entry by the model name as the transcripts record it. Cost's "Unpriced models" notice shows the name of each model without a price.

```json
{"models": {"my-model": {"input": 3, "output": 15, "cache_read": 0.3, "cache_5m": 3.75, "cache_1h": 6, "context": 200000}}}
```

Every rate is in USD per million tokens.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `input` | number | yes | Uncached input tokens. |
| `output` | number | yes | Output tokens, thinking included. |
| `cache_read` | number | yes | Cache reads. |
| `cache_5m` | number | yes | Cache writes with a 5-minute lifetime. |
| `cache_1h` | number | yes | Cache writes with a 1-hour lifetime. |
| `context` | number | no | The model's context window in tokens. |
| `long_above` | number | no | A request whose prompt tokens (uncached input plus cache reads and writes) exceed this uses the rates in `long`. |
| `long` | object | with `long_above` | The five rates above (`input`, `output`, `cache_read`, `cache_5m`, `cache_1h`, all required), for requests over `long_above`. |
| `fast` | object | no | The same five rates, all required, for fast-mode requests. A request is fast-mode when its response reports the speed `fast`. These rates replace the long rates. A fast-mode request on a model without `fast` costs its standard price. |

A model that a page lists as unpriced has no entry in either file. Cost names it in an "Unpriced models" notice, counts its tokens, and leaves its cost out of totals until it has a price.

When the file cannot be used, Cost shows "Prices file ignored", with the file's path and the reason, and the packaged prices apply. The file is ignored whole when it is not valid JSON, has neither a `models` nor a `plans` object, or has an entry that lacks a price or holds a value that is not a number.

### Plans

The Cost page compares the estimate with your plan. The plan comes from the newest plan-limit snapshot of each provider (`claude`, `codex`). Grok reports no plan limits, so it has no plan. Its monthly price comes from the `plans` table: the packaged one, plus the file's.

Key `plans` by provider, then by the plan name a snapshot records. A snapshot's plan matches an entry by its exact name, then by the part before a `/`.

```json
{"plans": {"claude": {"pro": {"label": "Claude Pro (annual)", "monthly": 17}}, "codex": {"team": {"label": "ChatGPT Team", "monthly": 30}}}}
```

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `label` | text | yes | The plan's name on the Cost page. |
| `monthly` | number | yes | The monthly price in USD. |

The packaged plans:

| Provider | Plan name | Label | Monthly |
| --- | --- | --- | --- |
| `claude` | `pro` | Claude Pro | 20 |
| `claude` | `max/default_claude_max_5x` | Claude Max 5x | 100 |
| `claude` | `max/default_claude_max_20x` | Claude Max 20x | 200 |
| `codex` | `plus` | ChatGPT Plus | 20 |
| `codex` | `prolite` | ChatGPT Pro 5x | 100 |
| `codex` | `pro` | ChatGPT Pro 20x | 200 |

An entry in the file adds to these or replaces one of the same name.

- When no snapshot names a known plan, the comparison is left out.
- When an agent without a known plan also spent, the multiple counts only the agents with a known plan, and names them: "at list prices this period's Codex use is 0.7× your plan."

## Automated projects

The file `automated.json` lists projects whose sessions count as automated, in addition to the built-in detection (see [Filters](/ai-ledger/everywhere/filters/#include-automated)).

```json
{"projects": ["my-bot"]}
```

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `projects` | list of text | yes | Project names. |

A missing file is no error. The "Include automated" control's hint names the file's path. When the file cannot be read, is not valid JSON, has no `projects` list, or has an entry that is not text, the app ignores the whole file and Activity shows "Automated projects file ignored", with the path and the reason; only the built-in detection applies.

For the workflow, see the playbook [Separate automated sessions from yours](/ai-ledger/improve/automated-sessions/).
