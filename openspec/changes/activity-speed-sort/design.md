# Design

## Run figures on the sessions list only

`metrics.sessions()` builds the rows of both the usage payload (`sessions`, `top_sessions`, `near_limit`) and `/api/sessions`. The run figures were kept off those rows on purpose: only the totals and the session sheet carried them. Adding them to `sessions()` would grow the usage payload for figures no page there reads. So `session_list` alone adds them, after its filters and before its sort, with one query over `runs_cte` for the matching ids (`unnest(?)`). The figures are whole-session, as the vital and the session sheet count them, so the columns are marked whole-session on a selected day like Peak context and Compactions.

`model_ms` is `null`, not 0, for a session with a run but no model time, so that session sorts with those that record no run.

## Fitting 13 columns

With the two columns the table was 57px wider than its 1208px box at 1440px. Three changes make it fit without dropping a column:

- Short headers, "Model" and "Tok/s", with the full names ("Model time", "Output speed") in their toggletips.
- The speed cell is a bare number, the unit being in the header.
- The Session column is capped at 16rem on wide screens (21.25rem before), its second line cut with an ellipsis as it already was under 78.75em. The title keeps its full text in the button's title.

Both new columns are `opt1`, a tier between `opt2` (Tokens and Compactions, hidden under 78.75em) and `opt` (hidden under 43.75em): they hide under 66em, the narrowest width at which all 11 remaining columns still fit. The sorted column's header and cells carry `sorted`, which shows them at any width, so the Output speed vital never lands on a hidden column. Under 66em a sorted `opt1` column takes its room from the Session column (`:has(th.opt1.sorted)`), so the table still fits from 900px up. Measured on the demo store: no sideways scroll at 900 to 1440px, sorted or not. Under 56.25em the table scrolled sideways before this change.

## One rule for speed

`runs_cte` counts a session's output only when its runs record model time (`model_ms > 0`). A session whose runs record 0 ms reads "–" in Sessions, and its output stays out of the vital and the trend too, so the vital is the speed of the same sessions the rows show.

## The agents of the large results

The tip's matching sessions are those with a request in the view, but a large result can fall in the view while its session's requests do not. The advice therefore takes the agents from the results' own sessions (`ctx.calls` returns `s.source`), falling back to the matching sessions'. The generic line goes in whenever a Codex result's tool has no remedy of its own, whatever the other results.

## First-screen spacing

The 20px comes from five places in `activity.css`, each scoped to `.pg-activity` so the Judgments view (`.pg-judgments`) and other pages keep theirs: the view switch's bottom margin (14 to 10), the header's (20 to 16, with the pending line's negative margin and height to match), the work chart panel's top padding (18 to 14), the vitals' bottom margin (12 to 8) and each vital's padding (10 to 8, top and bottom).
