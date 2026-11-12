# Proposal

## Why

GitHub issue #5 (Limits page UX review, one item): the app keeps every Claude usage response whole, and reads only the limits' percents from it. The response also says how much of the weekly allowance a model-scoped limit may use, and which surface (Claude Code, chat, cowork) the week's use came from. Without them a scoped card reads as a second, unexplained percent, and use made outside the terminal stays invisible until it shows in a percent.

## What Changes

- **Extras from the newest poll.** The Claude poll parser gains a sibling that reads, from one stored poll, the scoped limits' shares of the weekly allowance (`weekly_scoped_shares`) and the week's use by surface (`seven_day_breakdown`). It is registered per provider, as the snapshot parser is. It never raises: a key that is missing, null, of another type, or an entry that is out of range or points at no limit is left out.
- **Payload.** Each open window gains `weekly_share` (`{used, allowance}`, in percent of the whole weekly allowance) and `surfaces` (`{as_of, rows: [{key, label, percent}]}`). Both come from the provider's newest stored poll only, and only when that poll describes the window open now: the same limit, with a reset time within the usual drift of the window's. Otherwise, for an estimated window, for a provider without a parser (Codex) and with no stored poll, both are null. Nothing new is stored, and snapshots, calibration and the forecast do not change.
- **Cards.** A card with a share says "This limit is 50% of the weekly allowance; 21% of the weekly allowance is used through it". A card with surfaces says "All of this week's use so far came from Claude Code" when one surface has all of it, else "This week's use by surface: Claude Code 80%, Chats 15%, Cowork 5%", most first. Both are small, muted lines under the forecast lines.

Out of scope: the response's other keys (extra usage, spend, promotions), the breakdown over time, a breakdown of closed windows, any change to snapshots or calibration.

## Impact

- `src/ai_ledger/limits.py` (`claude_extras`, `POLL_EXTRAS`, `payload`), `tests/test_limits.py`, `web/src/api.ts`, `web/src/pages/limits/`, the page-test fixtures in `web/src/__fixtures__/`, the build in `src/ai_ledger/web/`, `README.md`, `CHANGELOG.md`. The `/api/limits` payload gains two fields on each open window. No `rebuild` is needed.

## Capabilities

### Modified Capabilities
- `plan-limits`: the newest stored Claude poll yields a scoped limit's share of the weekly allowance and the week's use by surface.
- `limits-dashboard`: the cards show them.
