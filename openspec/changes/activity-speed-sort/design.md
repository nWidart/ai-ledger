# Design

## Run figures on the sessions list only

`metrics.sessions()` builds the rows of both the usage payload (`sessions`, `top_sessions`, `near_limit`) and `/api/sessions`. The run figures were kept off those rows on purpose: only the totals and the session sheet carried them. Adding them to `sessions()` would grow the usage payload for figures no page there reads. So `session_list` alone adds them, after its filters and before its sort, with one query over `runs_cte` for the matching ids (`unnest(?)`). The figures are whole-session, as the vital and the session sheet count them, so the columns are marked whole-session on a selected day like Peak context and Compactions.

`model_ms` is `null`, not 0, for a session with a run but no model time, so that session sorts with those that record no run.

## Fitting 13 columns

With the two columns the table was 57px wider than its 1208px box at 1440px. Three changes make it fit without dropping a column:

- Short headers, "Model" and "Tok/s", with the full names ("Model time", "Output speed") in their toggletips.
- The speed cell is a bare number, the unit being in the header.
- The Session column is capped at 16rem on wide screens (21.25rem before), its second line cut with an ellipsis as it already was under 78.75em. The title keeps its full text in the button's title.

Both new columns are `opt2`, so they hide first under 78.75em with Tokens and Compactions.

## First-screen spacing

The 20px comes from five places in `activity.css`, each scoped to `.pg-activity` so the Judgments view (`.pg-judgments`) and other pages keep theirs: the view switch's bottom margin (14 to 10), the header's (20 to 16, with the pending line's negative margin and height to match), the work chart panel's top padding (18 to 14), the vitals' bottom margin (12 to 8) and each vital's padding (10 to 8, top and bottom).
