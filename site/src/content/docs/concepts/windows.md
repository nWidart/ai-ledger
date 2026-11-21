---
title: Context windows and plan limit windows
description: A model's context window against a plan's 5-hour and weekly limit windows, and which pages show each.
---

AI Ledger uses the word "window" for two different limits. A **context window** is how many tokens one conversation can hold: it belongs to the model, and it fills within one session. A **plan limit window** is a stretch of time, such as 5 hours or a week, over which your subscription caps how much you can use: it belongs to your plan, and every session draws on it. This page explains each, and how they meet.

## The context window

A model reads its whole prompt on every turn: the system prompt, the tool definitions, memory files such as `CLAUDE.md` or `AGENTS.md`, the conversation so far and every tool result in it. The context window is the most it can read at once. As a session goes on, each turn adds to the prompt, and the session fills its window.

When the window is nearly full, the agent compacts: it replaces the conversation with a summary and goes on from there. Compaction frees room, but the session keeps only what the summary says.

### How AI Ledger measures it

AI Ledger reads no configuration file to measure context. It takes each request's prompt tokens from the transcript: input, cache reads and cache writes together. A session's **starting context** is the prompt of its first turn: its first main-thread request with at least 2,000 prompt tokens, since smaller ones are side requests that do not carry the conversation. Its **peak** is its largest prompt.

To turn tokens into a share of the window, AI Ledger needs the window's size:

- Codex states the window at each turn, so its sessions use that.
- Grok states the window in a compaction notice. A Grok session that compacted uses that; one that did not uses the window the price table gives the model.
- Claude Code states none, so its sessions use the window the price table gives the model.
- A session with neither has no share; the Context page counts how many sessions in the view have a known window.

A session at 80% or more of its window counts as **near the limit**.

The pages do not all resolve the window the same way. Context and Live use the window the session states, then the price table. Activity's near-limit count and its sessions table use only the price table's window for the session's peak model, so a session whose model has no window there never counts as near the limit on Activity.

### Where you see it

| Page | What it shows |
| --- | --- |
| [Context](/ai-ledger/pages/context/) | Starting context per project, growth per turn, turns and minutes to the first compaction, and peak fill by window size. |
| [Activity](/ai-ledger/pages/activity/) | Sessions that reached 80% or more of their window, in **Needs attention**. |
| [Live](/ai-ledger/pages/live/) | The selected session's context meter in the status strip, with a mark at each compaction. |
| [Project](/ai-ledger/pages/project/) | A typical session's window as a grid, in the style of Claude Code's `/context`. |

## The plan limit window

A subscription plan does not bill by token. It caps use instead, over windows of time: a 5-hour window, a weekly window, and on some plans a weekly window for one model. Each window reports a percent used and a reset time. At 100%, the provider holds back use of that limit until the window resets.

AI Ledger names a window by its length: 5-hour, daily, weekly or 30-day, followed by the model for a model-scoped one, such as "weekly · Fable".

### Where the readings come from

AI Ledger does not guess the percent. It reads it from the provider:

- **Claude Code.** On macOS, the app asks Anthropic's usage endpoint for the limits at most once every 5 minutes while it runs, with the token Claude Code keeps in the Keychain. Where it cannot read that token, as on Linux, it records no Claude Code reading.
- **Codex.** Codex writes its limits into its own transcripts, so its readings come with every ingest, on any system.
- **Grok.** The app asks xAI's billing endpoint every 5 minutes while it runs, with the token of the Grok CLI's grok.com login, read from `~/.grok/auth.json`. The answer is the percent of the period's credits used, and the period: weekly for SuperGrok, monthly possible. It names no plan. The window resets on Grok's billing schedule, at a fixed time, not on first use. Without a grok.com login, AI Ledger has no Grok window.

Between readings, AI Ledger estimates. It compares how the percent moved with the estimated API cost of the requests counted in the same window, which gives a price per 1% for each limit. Usage since the last reading, divided by that price, gives the percent now. Estimates are marked as such. The same price per 1%, times 100, is the "100% ≈" line on each window's card: the window's cap in list-price dollars. See [How cost is estimated](/ai-ledger/concepts/cost-estimates/).

From your activity by hour of day, AI Ledger also forecasts each open window: when it reaches 100%, or what percent it ends at when it resets.

### Where you see it

| Page | What it shows |
| --- | --- |
| [Limits](/ai-ledger/pages/limits/) | Every open window with its forecast, what used it by project and model, and past windows. |
| The **Limits** tab | A percent pill, on every page: the percent of the fullest open window, turning amber or red with a ring when a window is at its limit, forecast to run out, or at 90% or more. |
| [Live](/ai-ledger/pages/live/) | Each open plan limit of the selected session's agent in the status strip, with its reset time behind a toggletip. |
| [Project](/ai-ledger/pages/project/) | The project's share of the plan limits. |

## How the two meet

The two windows measure different things, but they move together. Every turn sends the whole context again, so a session with a full context window spends more tokens per turn, and so more of the plan limit window, than the same work in a lean session.

They also clear differently. A new session starts again from its starting context, and compaction shrinks a full one. Nothing empties a plan limit window but its reset. So a habit that keeps context small, such as a fresh session for each task, saves both.

## Related

- [Keep context lean](/ai-ledger/improve/lean-context/): act on the context window.
- [Stop hitting plan limits](/ai-ledger/improve/plan-limits/): act on the plan limit windows.
- [How AI Ledger works](/ai-ledger/concepts/how-it-works/): where the readings are stored.
