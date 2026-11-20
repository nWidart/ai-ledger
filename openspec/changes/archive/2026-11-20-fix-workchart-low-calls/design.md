# Design

## Context

The Errors page's `RateChart` marks a bucket as low when it has 1 to 49 calls and another bucket has 50 or more. Low buckets get a hollow dot and add nothing to the rate axis maximum. The line is drawn through all buckets with calls, and a rate above the axis stops at its top.

The work chart's rate line used the maximum of every bar's rate.

## Decisions

- **Match the Errors page.** Same threshold (50), same condition (some other bar has enough calls), same line (connected through low bars). Two charts of the same figure should read alike.
- **One shared rule.** `LOW_CALLS` and `lowVolume(calls)` live in `components/chart.ts`, which both charts already import for their helpers. `errors/model.ts` no longer owns the constant. A rule in the Errors page module would make Activity depend on a sibling page.
- **A rate above the axis stops at its top.** A low bar's rate can exceed the axis. The dot sits on the top edge; the tooltip, screen-reader text and table give the true value.
- **Wording.** "too few calls for a steady rate", as the Errors tooltip says it. The legend key reads "Under 50 calls", as the Errors legend does.

## Risks

A low bar with a very high rate shows as a dot on the top edge, not at its height. The text alternatives carry the value.
