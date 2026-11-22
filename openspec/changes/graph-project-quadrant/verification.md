# Verification

How each scenario of this change's two spec deltas is proven, as built, on the branch rebased on main `91d644ff`. A test is named by its file and its title; a browser check by its line in `tools/demo/chartfit/quadrant.mjs` (`node tools/demo/chartfit.mjs quadrant`, 80 lines, all "ok" in three runs in a row), numbered in the order the module prints them. Test files are under `web/src/pages/project/` unless the path says otherwise.

## project-page

| Scenario | Proof |
|---|---|
| A project's sessions | Browser lines 3 ("93 dots drawn, 37 filled for a commit and 56 hollow") and 4 (each session's dot at its cost and tool calls within 1px). `ProjectPage.test.tsx`: "plots the payload's sessions, not the eight costliest, and opens the one read on Enter". |
| Sessions from three agents | Partly. The model reads no source (`quadrant.ts`, `QuadRow`), and browser line 4 places every session of atlas-api's usage answer, which on the demo store holds Claude Code and Codex sessions (`seed.py` gives atlas-api a 0.2 Codex share). No test names a source, and none proves a Grok session's dot. |
| A source filter | No proof of its own. The block reads the page's one usage request, whose source filter every usage block shares; `ProjectPage.test.tsx` proves only that the block's link keeps the source ("…source=claude…"). |
| Wide labels | `quadrant/quadrant.test.ts`: "sizes the box at text scale %d" (120,000 tool calls and $1,500: the left margin and the tool-call name's gap past the widest label, the right margin half the last cost label, the cost axis name moved left inside the box). `quadrant/quadrantOption.test.ts`: "draws two log axes over the fit's extents on a grid at the fit's plot, …" (the option takes the fit's name gap and the name's shift). Browser lines 50 to 57 (400,000 tool calls and $4,000 at 1440px and in a 343px box at 32px text: every label and both axis names inside the box and apart, "500,000" and "$5,000" drawn at 1440px). |
| A commit | `quadrant/quadrantOption.test.ts`: "draws a filled dot in the hue in a surface ring and a hollow one in a ring of the hue, at its values". `quadrant/SessionQuadrant.real.test.tsx`: "draws a dot per session at the fit's pixel, …" (filled in the project's token, hollow in the surface). Browser lines 3 and 67. |
| Four quadrants | `quadrant/quadrant.test.ts`: "splits at the medians, a dot on a line counting as cheap or as little done"; "reads a dot in words" ($4.20 and 12 tool calls against medians of $1.42 and 23: "Costly, little done"). |
| A session on a line | `quadrant/quadrant.test.ts`: "splits at the medians, a dot on a line counting as cheap or as little done". |
| Counts | `quadrant/SessionQuadrant.test.tsx`: "labels the plot with the split and lists the quadrants' counts, under the hint". Browser line 7. |
| A name with no room | `quadrant/quadrant.test.ts`: "draws a corner name only where it fits". Browser lines 43 and 48 (a 343px box at 16px and 32px text: each name with room drawn) with 44 and 49 (the list names all four). |
| Two sessions | `quadrant/SessionQuadrant.test.tsx`: "says two dots are too few to split under the plot, with no quadrant list". `quadrant/SessionQuadrant.real.test.tsx` (two rows: two dots, no guide). Browser line 63. |
| No known cost | `quadrant/SessionQuadrant.test.tsx`: "says the cut-off above the plot and the sessions left out under it, and has no plot when no session has a cost". |
| More than 300 sessions | The same test. Browser line 65. |
| Unknown costs | `quadrant/quadrant.test.ts`: "leaves out and counts the sessions with no known cost, and says the cut-off". `quadrant/SessionQuadrant.test.tsx`: "says the cut-off above the plot and the sessions left out under it, …". Browser line 65. |
| A cost below $0 | `quadrant/quadrant.test.ts`: "leaves out and counts the sessions with no known cost, and says the cut-off" (two sessions below $0 and one unpriced: no dot, no zero lane, "3 sessions are left out: 1 with no known cost and 2 with a negative cost."; one alone: "1 session with a negative cost is left out."; none placed: "…a known cost of $0 or more…"). |
| No tool call | `quadrant/quadrant.test.ts`: "gives an axis a lane only when a 0 is shown" and "reads a dot in words" ("no tool call"). `quadrant/quadrantOption.test.ts`: "labels the ticks in dollars and counts, and a lane's min as zero". `quadrant/SessionQuadrant.real.test.tsx` (the dot at 0 tool calls at the fit's pixel; "0" drawn). Browser lines 30 to 32. |
| A session at no cost | `quadrant/quadrant.test.ts`: "reads a dot in words" ("$0, no tool call"). `quadrant/SessionQuadrant.real.test.tsx` ("$0" drawn). Browser line 32. |
| No session at zero | `quadrant/quadrant.test.ts`: "gives an axis a lane only when a 0 is shown". |
| First key | `quadrant/SessionQuadrant.test.tsx`: "reads the cheapest dot on Right with its sentence, its tooltip and the mark, and Escape on the box ends it". `quadrant/quadrant.test.ts`: "reads a dot in words" (the example's sentence, its time through `when()`). Browser line 10. |
| Sessions in one place | `quadrant/quadrant.test.ts`: "picks the nearest dot within 12px, ties to the costlier, and counts a pile". `quadrant/SessionQuadrant.test.tsx`: "says how many more sessions sit under the pointer in a pile". Browser lines 27 and 28. |
| A cost under a cent | `quadrant/quadrant.test.ts`: "reads a dot in words" (the sub-cent rows: "under $0.01", "<$0.01", "more than $0"). |
| Open a session | `quadrant/SessionQuadrant.test.tsx`: "opens the read session's sheet on Enter, ending the reading but not its place, and the clicked one's on a click". `ProjectPage.test.tsx`: "plots the payload's sessions, not the eight costliest, and opens the one read on Enter". Browser lines 17, 18, 23, 24, 74 and 75. |
| The data table | `quadrant/SessionQuadrant.test.tsx`: "lists every dot costliest first in its data table, and a row opens the session's sheet". |
| Wide screen | `ProjectPage.test.tsx`: "puts Activity, Cost and Context in the left column, and Errors, Plan limits, Sessions, Sessions by cost and tool calls and Session judgments in the right". Browser line 1. |
| Narrow screen | The same layout test proves the order of the blocks in the page; that one column stacks them in that order is the page's stylesheet, which this change does not touch. Browser line 61 shows a 375px window draws the plot with no sideways scroll; no line checks the stacked order. |

## dashboard-app

| Scenario | Proof |
|---|---|
| Two dots at one cost | `quadrant/quadrant.test.ts`: "picks the nearest dot within 12px, ties to the costlier, and counts a pile". Browser line 29. |
| Reading before the chart has drawn | `quadrant/SessionQuadrant.test.tsx`: "reads the cheapest dot on Right with its sentence, its tooltip and the mark, and Escape on the box ends it". It runs on the fake runtime, which draws nothing. |
| Forced colors | Browser line 72 (the mark is `Highlight`). The rule is CSS (`quadrant.css`), which jsdom does not apply: no unit test. |
| A zero among positive values | `quadrant/quadrant.test.ts`: "gives an axis a lane only when a 0 is shown" (the 0 under the 1 tick) and "keeps a lane to a decade, so no other power of ten is ticked in it". `quadrant/SessionQuadrant.real.test.tsx`. Browser line 30. |
| Large text | Browser lines 46 and 47 (a 343px box at 32px text: no label overlaps another or leaves the box; the tool-call lane's "0" drawn, and the cost lane's "$0" gives way to the next tick's label). |

Scenarios without a full proof: "Sessions from three agents" (no Grok dot proven), "A source filter" (no test of the block under a source filter), and the stacked order of "Narrow screen".

## Edge cases

Checked against the classes a review of the sibling graphs found. Where the quadrant had the fault, the proof is the test above or a browser line, each shown failing on a deliberate break before its fix:

- A session with no title, start, project, branch or model, from any source: browser line 59 (it reads "started –", nothing in the block says "Invalid Date", NaN, undefined or null, no page error). `quadrant/quadrant.test.ts`: "reads a dot in words" (a null start reads "–").
- A cost below $0: "A cost below $0" above.
- Wide tick labels: "Wide labels" above.
- A 300-character title with no space and a right-to-left one in a 343px box: browser line 58 (the tooltip, wrapped, beside the dot and inside the box) and line 60 (the open data table does not make the page scroll sideways).
- Lines that see a reading closed first prove it open: browser lines 16 (the reading End made, before Escape), 18, 24 and 75 (the sheet open, before it closes) and 79 (the session read, before newer figures drop it).

## Net test lines

Against main `91d644ff`, added minus removed in `*.test.*` and `tests/`: 642 added, 7 removed, **635 net**. By file: `tests/test_metrics.py` 26, `quadrant/quadrant.test.ts` 189, `quadrant/quadrantOption.test.ts` 109, `quadrant/SessionQuadrant.test.tsx` 205, `quadrant/SessionQuadrant.real.test.tsx` 89, `ProjectPage.test.tsx` 17. Not counted: `tools/demo/chartfit/quadrant.mjs` (778 lines, a browser check that runs locally, not in CI) and the regenerated usage fixtures.

That is over the repo's advice of 400 (about 360 were planned). Most of the excess is the plot's own reading. The shared chart wrapper's reading does not work on a log axis: its pointer reads the x axis value as a point index, so over a cost it reads "point 1.42", and its key tooltip and band go to the pixel of the index as a cost. No prop changes that, and the wrapper is not this change's to edit, so the plot owns its keys, pointer test, tooltip, mark and live region, and their tests: the pointer and pile cases, Escape from the document, the reading kept or ended on newer figures, the place kept after a sheet. The rest is the model's: the medians and quadrants, the zero lanes (a lane kept to one decade; every figure finite with no dot, equal dots, every session at 0 or a 0 cost), and the sentences, including the cost wordings found while building ("under $0.01", "more than $0", "$0") and a half median ("22.5 tool calls"). The Python test is its own fixture because it needs sessions past the `top_sessions` cut. If the wrapper gains a pointer test and the place of a point (`design.md`, "For the owner of the shared chart component"), a later change can drop `dotAt`, `stepDot`, the tooltip, the mark, the live region and most of the component's tests.

## Accepted limits

- A browser text-size change is picked up at the next render, as on Activity's chart.
- In a 343px box at 32px text the cost lane's "$0" label is hidden: it gives way to the next tick's label. The tool-call axis's "0" is drawn.
- The tooltip below a dot at the bottom of the plot runs over the list under the plot.

## Bundle

As `node web/scripts/check-bundle.mjs` printed it on the rebased build:

```
ok   index-CeY0mOrb.js  109.9 kB gzip  (limit 130 kB)
ok   CostPage-BLxjSoUq.js  12.1 kB gzip  (limit 20 kB)
ok   ActivityPage-TWPe0HRt.js  28.3 kB gzip  (limit 31 kB)
ok   ErrorsPage-DIBi3Nyp.js  21.0 kB gzip  (limit 26 kB)
ok   ProjectPage-CidL2tGu.js  9.3 kB gzip  (limit 11 kB)
ok   EChart-C9M_aUYA.js  6.3 kB gzip  (limit 8 kB)
ok   zoomReset-B2n7bpVN.js  1.2 kB gzip  (limit 3 kB)
ok   echarts-CZ7cuwNT.js  176.5 kB gzip  (limit 195 kB)
```

The ECharts chunk did not grow. After the edge-case fixes the `ProjectPage` limit set to 1 kB failed again, naming the chunk. With the `ProjectPage`, `EChart` and `zoomReset` limits set to 1 kB, the check failed and named each chunk; with the `EChart` chunk moved away, it failed on "expected exactly one EChart-*.js chunk, found 0".
