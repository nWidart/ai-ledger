# Design

## Context

The Limits page (`web/src/pages/limits/`) renders `/api/limits`. Each open window has a series of readings or estimates and, once calibrated, a forecast with these fields:

- `curve`: points with `mid`, `lo`, `hi` and `recent`.
- `hits_at`: when the middle line reaches 100%. `hits_at_early` and `hits_at_late` are the same for the high and low bounds.
- `pace_target`: the points a day that end at exactly 100% at reset, `(100 - current) / days left`.
- `pace_now`: the forecast's own pace. The forecast says `pace: "ahead"` when `pace_now > pace_target`.

All the figures that the new design needs are in this payload already.

## Goals / Non-Goals

**Goals:**
- One chart a reader can read without a key: whether the window will run out, and how fast it is going against the pace that would just fit.
- A card that answers "how much is left, am I going too fast, what is using it" in one row, with the detail one click away.
- Past windows visible, with a per-limit summary that replaces the single "Left unused" average.
- Filters only where they apply.

**Non-Goals:**
- Any change to the forecast math, the payload or `limits.py`.
- Other pages. `Drawer.tsx` does not change: another branch changes it.

## Decisions

### Safe pace is a straight line from now to 100% at reset

The diagonal runs from `(now, current)` to `(resets_at, 100)`. Its slope is `pace_target`, so the footer's "safe" figure and the line agree. The line is straight, while the cone follows the hour-of-day shape. A shaped cone can therefore cross the line during the night and back during the day. That is accurate: the line is the average pace that would just fit, not a forecast. The chart has no diagonal for a window at its limit, with no reading or on a closed window. `safePace(w, now)` in `limits.ts` returns the two end points, or null.

Rejected: a diagonal from the window's start (0%) to 100% at reset. It says whether the user was on pace overall. It does not say what pace is safe from now on, which the footer compares against.

### The cone tint follows the high bound

The cone takes the warning tint when its high bound reaches 100% before the reset (`hits_at_early` is set). The header's "runs out" stays tied to the middle line (`hits_at`), as the heading and the nav badge are. So a tinted cone with no "runs out" means "might run out". The words still say what is forecast. `coneCrosses(w)` holds the rule. A window at its limit has no cone.

### Four encodings, and the rest moves out of the chart

The chart draws the actual line, the cone, `now` and the diagonal. These four replace nine encodings.

- Measured and estimated are one line in two strengths (solid, faded), not two encodings with their own key entries.
- The reading dots go. The readout already reads every point.
- The forecast middle line becomes the cone's spine, in the cone's own colour.
- The 100% line is a grid line with its axis label, and "resets <time>" labels the right edge.
- The last-24-hours line is drawn only when the grid's "Last 24 h pace" toggle is on. When it is off, a forecast point's readout leaves out the scenario value, so the readout never names a line that is not drawn. The toggle is page state that resets on every load, like the data-table toggles.
- A plan change is a short tick at the top of the plot with a "plan: <name>" label. It does not span the plot.

### The card's details are one disclosure, a button controlling a region

The footer is a three-column grid: Headroom, Pace and Top. The `Details` control sits in the third column, as the target layout shows. A `<details>` element cannot put its summary in a grid column while its content spans the card below. So the control is a button with `aria-expanded` and `aria-controls`, and the region renders only while open. The region holds:

- the full forecast caption,
- the last-24-hours sentence,
- the usual and recent paces with the verdict,
- the weekly share and surfaces lines,
- the cap-money line,
- what used the window, with its Cost links,
- a data table of the chart.

The data table samples the chart at most at 12 times from start to reset, plus now. Each row gives the time, the percent (measured, estimated or forecast with its likely range) and the safe-pace value for times after now. The full series is far too long for a table (a weekly window polled every 5 minutes has about 2,000 readings).

### Pace column: forecast pace against safe pace

"Current" is `pace_now`, the pace the cone uses. It is not the last-day pace, so the figure, the cone and the ahead/behind verdict agree. Windows shorter than a day read per hour, as before. The usual and last-day paces move to Details.

### Past windows replace Left unused

Each strip row ends with "avg N% unused · K hits". N is the row's `unused.avg_unused` (provider and label match, as the old panel listed them). K counts the closed windows in range that hit their limit, not only the 60 shown. A limit whose windows all ended early reads "no full-length windows". The row's title says how many windows the average covers and how many ended early and are left out. So the panel's hint survives without a line of its own. The closed-window table moves behind the shared `ChartTable` toggle ("Show data table").

### Filters

The header's `Filters` shows Source only. `Filters` gains a `project` prop, true by default, and the range segment is exported as `RangeFilter` for the "Past windows" header. The range there also scopes "What a point buys", which sits right under it, and its hint says so.

The page sends no project to `/api/limits`. Its query key drops the project too, so a project picked on another page does not refetch Limits. The URL keeps the project for the other pages.

### What a point buys keeps no project scope

We keep the drawer and drop its project scope.

Kept, because cost and tokens per point by model are not shown anywhere else. They are the one way to turn a percent into money and work.

No project scope, because of three facts:

- With the page-level filter gone, a scope would need its own picker inside a closed drawer for one table. That is the hidden-filter problem the review raised.
- The Project page's "Plan limits" block already gives one project's commits per point.
- The table folds projects under one point into "N smaller projects", so the full list stays short.

The backend keeps its `project` parameter for the Project page.

### Heading at most two figures

- At its limit: "<window> is at its limit until <reset>."
- Runs out: "<window>, at N% now, runs out <time>."
- Otherwise: "No limit runs out at the current pace. Fullest: <window>, about N% at reset." With no forecast, "Fullest: <window>, at N% now."

The reset time of a window that runs out is on its card. The suggestion drops its reset time for the same reason.

## Risks / Trade-offs

- [Two dashed lines, the 100% grid line and the diagonal, can read alike.] The diagonal is solid, thin and faint. The 100% line is a dashed grid line with an axis label.
- [The cone tint (high bound) can disagree with the header (middle).] This is intended: the tint says "might", the words say "will". The Details caption gives both bounds.
- [A details region per card hides the cap money and surfaces.] They are reference figures. The review asked for them to be out of the scan path.
- [The tools/demo Limits GIF shows the old page.] `record.mjs` is updated. The GIF needs re-recording, which the PR notes.
