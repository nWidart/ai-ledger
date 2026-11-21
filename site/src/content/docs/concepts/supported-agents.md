---
title: Supported agents
description: What Claude Code, Codex and Grok record, and how each appears across AI Ledger.
---

AI Ledger reads three coding agents: Claude Code, Codex and Grok CLI. All three map onto the same derived tables, so every page counts them the same way. They do not record the same things, though, and a figure an agent never writes stays empty for its sessions. This page lists what each agent gives the app, in one place.

Every page has the **Source** filter (All, Claude Code, Codex, Grok) to show one agent at a time. See [Filters](/ai-ledger/everywhere/filters/).

## Transcripts

| | Claude Code | Codex | Grok |
| --- | --- | --- | --- |
| Where | `~/.claude/projects/<project>/<session>.jsonl` | `~/.codex/sessions/` and `~/.codex/archived_sessions/`, one rollout file per thread, `.jsonl` or `.jsonl.zst` | `~/.grok/sessions/*/*/updates.jsonl`, one folder per session |
| Option | `--projects` | `--codex` | `--grok` |
| Subagents | Their own transcripts, in `<session>/subagents/` | Rollout threads of their own, linked to the parent thread by their first `session_meta` | Session folders of their own, linked to the parent by its `subagent_spawned` line. Their tool calls show on the parent session; their tokens are part of the parent's turn and count once. |

See [How AI Ledger works](/ai-ledger/concepts/how-it-works/) for how ingest reads them, and [CLI and options](/ai-ledger/reference/cli/) for the options.

## Cost and plan limits

| | Claude Code | Codex | Grok |
| --- | --- | --- | --- |
| Cost | Estimated at API list prices from the price table | Estimated at API list prices from the price table | The cost Grok reported, not an estimate |
| Unpriced models | Possible: tokens count, cost is unknown | Possible: tokens count, cost is unknown | Never: Grok reports every request's cost |
| Cost by token kind | Included | Included | Left out: Grok's cost is not priced from the table |
| Plan limits | Anthropic's usage endpoint, polled at most once every 5 minutes with the token Claude Code keeps in the macOS Keychain. None on Linux. | The `rate_limits` Codex writes in its transcripts, on macOS and Linux | xAI's billing endpoint, polled every 5 minutes with the Grok CLI's grok.com login token from `~/.grok/auth.json`, on macOS and Linux. None with an API key or no grok.com login. |
| Limits cards and plan gauge | Yes, on macOS | Yes | Limits card with a grok.com login; no part in the Cost plan gauge (the response names no plan) |

See [How cost is estimated](/ai-ledger/concepts/cost-estimates/) and [Limits](/ai-ledger/pages/limits/).

## Context and cache

| | Claude Code | Codex | Grok |
| --- | --- | --- | --- |
| Context window | The `context` of the model in the price table | The turn's `model_context_window`, else the price table | The window a compaction notice states, else the price table |
| `/context` snapshots and **Measure now** | Yes | No | No |
| Cache writes | Two kinds: 5-minute and 1-hour | One kind | One kind |
| Cache lifetime for an **expired** break | 5 minutes, or 1 hour after a 1-hour write | 30 minutes | None stated by xAI, so a Grok break is never **expired** |
| Tool result sizes | Every finished call | Every call but `apply_patch` and `web_search` | Every finished call |

See [Context windows and plan limit windows](/ai-ledger/concepts/windows/) and [Context](/ai-ledger/pages/context/).

## Session figures

| | Claude Code | Codex | Grok |
| --- | --- | --- | --- |
| Reasoning effort | Yes | Yes | No |
| Fast mode | Yes | No | No |
| Model time and output speed | From the `cost-state` line Claude Code writes when a session ends, in versions from about late October 2026 | No | From the API time each turn reports |
| Tool time | From the same `cost-state` line | No | No |
| Lines added and removed | From the same `cost-state` line | No | No |
| Failed tool calls | The call's error result | The call's error result | The call's error result, and any `run_terminal_command` that exits non-zero, even when Grok marks it completed |
| `/insights` judgments | Yes | No: the Judgments view cannot be picked with Codex as the source | No: the Judgments view cannot be picked with Grok as the source |

Model time, tool time and output speed are on [Activity](/ai-ledger/pages/activity/#work-health) and in the [session sheet](/ai-ledger/everywhere/sheets/#session-sheet). Judgments are on [Judgments](/ai-ledger/pages/insights/).

## Sessions and Live

| | Claude Code | Codex | Grok |
| --- | --- | --- | --- |
| Session title | The newest `/rename` title, else Claude Code's AI title | The thread name | None recorded |
| Git branch | Yes | Yes | No |
| **ended** on Live | After you close the session | Never: Codex writes no close | After Grok exits |
| Shell tool for **approval?** | `Bash` | `exec` or `exec_command` | `run_terminal_command` |
| Resume command | `claude --resume <id>` | `codex resume <id>` | `grok --resume <id>` |

On [Live](/ai-ledger/pages/live/), a session with no recorded title shows a title made from its first prompt only with **Full text** on; on the other pages it always shows that fallback title.

## Related

- [How AI Ledger works](/ai-ledger/concepts/how-it-works/): where each agent's data comes from, and the derived tables they share.
- [How cost is estimated](/ai-ledger/concepts/cost-estimates/): list prices, and why Grok's cost is the reported one.
- [Context windows and plan limit windows](/ai-ledger/concepts/windows/): each agent's windows.
- [Compare Claude Code, Codex and Grok](/ai-ledger/improve/compare-sources/): which figures compare across agents.
- [CLI and options](/ai-ledger/reference/cli/): `--projects`, `--codex` and `--grok`.
