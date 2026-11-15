---
title: How cost is estimated
description: API list prices applied to tokens and cache use, compared with a subscription plan, and what the estimate leaves out.
---

Every cost in AI Ledger is an estimate: the tokens the transcripts record, priced at the model's API list price. It answers "what would this usage cost on the API?", not "what did I pay?". This page explains how the estimate is made, how it compares with a subscription plan, and what it leaves out.

## Tokens times list prices

Each API response in a transcript records its tokens. AI Ledger counts them once per response and splits them into the five kinds the API bills:

| Kind | What it is |
| --- | --- |
| Input | Prompt tokens read without the cache. |
| Output | Tokens the model wrote, thinking included. |
| Cache read | Prompt tokens read from the cache. |
| 5-minute cache write | Prompt tokens written to the cache with a 5-minute lifetime. |
| 1-hour cache write | Prompt tokens written to the cache with a 1-hour lifetime. |

A request's cost is each kind's tokens times the model's price for that kind, in USD per million tokens, added up. Two rules change which prices apply:

- **Long prompts.** Some models charge more for a prompt above a set size. When a request's prompt (input, cache reads and cache writes together) is above it, the whole request is priced at the higher rates.
- **Fast mode.** A Claude Code request made in fast mode, on a model with fast-mode rates, costs those rates at any prompt size: they replace the long-prompt rates. On a model without them, it costs the standard price.

Codex reports one cache-write count, not two lifetimes. Its cache writes are priced at the model's one cache-write rate.

### Where the prices come from

Each version of AI Ledger ships a price table, `prices.json`, taken from Anthropic's and OpenAI's public pricing pages on the date the file names. Upgrading brings the newest table. Your own `prices.json`, next to the store, adds models or replaces the price of a model of the same name; see [Configuration](/ai-ledger/reference/configuration/).

The app prices the stored token counts each time a page loads; no cost is stored. A new price table, or an edit to your own file, applies on the next page load, with no rebuild. It also applies to all of history: a past request is priced at today's table, not at the price of its day.

### Models without a price

A request on a model the price table does not know still counts its tokens, but its cost is unknown, not zero. The Cost page lists such models under **Unpriced models**, with the path of the file where you can price them. A cost figure that leaves out unpriced requests carries a **+?** chip.

## Why cache reads matter

An agent sends the whole conversation again on every turn. Without a cache, each turn would pay full input price for everything said before. With prompt caching, the part of the prompt seen before is read from the cache at a small fraction of the input price, and only the new part is billed as input.

Writing to the cache costs more than plain input. In the packaged table, a Claude model's 5-minute cache write costs 1.25 times its input price and a 1-hour write 2 times. A write pays off when later turns read it back before it expires.

So in a long session, cache reads are often most of the tokens and a small part of the cost. When the cache breaks, for example after a pause longer than the cache's lifetime, the next turn writes the whole prompt again, and cost jumps.

The Cost page shows the **cache hit ratio**: cache read tokens divided by all prompt tokens (input, cache reads and cache writes). It also shows the share of cache writes that used the 1-hour lifetime. The [Context](/ai-ledger/pages/context/) page finds the sessions where caching broke, and why.

## The estimate against a plan

A subscription plan, such as Claude Pro or Max, or ChatGPT Plus or Pro, charges a flat monthly price, whatever the tokens. The estimate says what the same usage would cost at API list prices. Comparing the two shows how much API usage the plan covered.

AI Ledger learns your plan from the newest plan-limit snapshot of each agent: on macOS, Claude Code's from Anthropic's usage endpoint, and Codex's from its own transcripts. The plan's monthly price comes from the `plans` table in `prices.json`. The Cost page then prorates that price to the days of the view (monthly price × days ÷ 30) and gives the estimate as a multiple of it:

> You pay about $200 a month (Claude Max 20x); at list prices this period is 4.2× your plan.

A multiple of 4.2 means the period's usage would cost 4.2 times the plan's price for the same days on the API. A multiple below 1 means the plan cost more than the same usage on the API. The line states no savings and nothing about what you pay beyond the plan's price.

When only some agents have a known plan, the multiple counts only their usage, and the line names them: "at list prices this period's Codex use is 0.7× your plan." When no plan is known, there is no line.

The [Limits](/ai-ledger/pages/limits/) page uses the same estimate in another way: it measures each limit window in estimated dollars per 1% used. See [Context windows and plan limit windows](/ai-ledger/concepts/windows/).

## What the estimate leaves out

- **What you actually pay.** Subscription prices, taxes, discounts, credits and negotiated rates are not in the estimate.
- **Charges other than tokens.** Only the five token kinds are priced.
- **Unpriced models.** Their requests have no cost until you price them.
- **Past prices.** All of history is priced at the current table.
- **Use outside the transcripts.** Chat in a browser or a desktop app writes no Claude Code or Codex transcript, so it has no estimate.
- **Automated sessions, by default.** Sessions a tool started are left out until you turn on **Include automated**; see [Filters](/ai-ledger/everywhere/filters/).

## Related

- [Cost](/ai-ledger/pages/cost/): the page that shows the estimate.
- [Configuration](/ai-ledger/reference/configuration/): your own prices and plans.
- [Spend less for the same output](/ai-ledger/improve/spend-less/): what to do about it.
