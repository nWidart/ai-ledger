# Proposal

## Why

Every page mounts the page-wide filters in its own header, and each header lays them out its own way. On Activity, Cost, Context and the Project page they sit at the right of the lede and wrap onto two rows. On Errors they share a row with the kicker. On Live they sit in the toolbar between the view switch and Pause. On Limits there is only the source. Cost stacks them on top of the plan gauge. The user has to find the filters again on each page, and Tab reaches them at a different point on each page.

Two pages also stack a third bar on the sticky navigation: the section index on Cost and on Activity's Judgments view. With it, three bars cover the top of the window while the page scrolls, and every jump and focus target has to clear all three.

## What Changes

- **One scope bar.** The page-wide filters move out of the page headers into one bar directly under the navigation, the same place on every page: project, range, source, automated, in that order. The bar sticks under the navigation.
- **Same filter rules.** A page still shows only the filters that change it: Limits shows the source only, Activity's Judgments view has no source, Live has no range, Errors has no automated toggle. A page with none shows no bar. Controls that set only some sections stay where they act: Limits' range in Past windows, Errors' Day / Week in the rate chart, and Cost's plan gauge in Cost's header.
- **Brief.** With a project picked, the bar ends with a "Brief" link to the Project page. It replaces the "Project page →" link beside the picker. The Project page itself shows no Brief link.
- **At most two sticky bars.** The sticky section index leaves Cost and the Judgments view, with no sticky replacement. Their sections keep their headings, and actions that open a drawer still open it. `SectionIndex` is deleted. Errors keeps its sticky type header and example bar inside the detail pane, under both bars. Every sticky offset and scroll padding clears the nav and the scope bar.
- **Narrow screens.** Up to 56em wide, the bar is one row: a Filters button with the number of filters off their default, and the picked project with its Brief link. The button opens the page's filters over the page. The page does not scroll sideways at 390 px.
- **One keyboard order.** On every page Tab goes through the navigation, then the scope bar (project, clear, range, source, automated, Brief), then the page. Skip to content still lands on the page heading. Changing a filter keeps focus on the control.
- **First screen.** The bar is about 40 px tall. Pages start 12 px under it (20 px before), Activity's lede gets the width the filters left, and Live's stream page trims its padding, so every main chart still starts on the first screen at 1440×900 and Live's rail still holds 8 sessions.
- **Checks.** A new browser script, `tools/demo/sticky.mjs`, fails if any page keeps more than two bars stuck to the top at 1440×900 or 390×844, or if Errors' sticky headers do not stack under both bars. `tools/demo/firstscreen.mjs` also covers Cost, Errors, Limits, the Judgments view and Live.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: the scope bar, its narrow form, the two-bar limit, the keyboard order, filters per page in the bar, targets clear of both bars, no section index.
- `project-page`: the Brief link in the scope bar replaces the filter row's "Project page" link.
- `insights-dashboard`: the Judgments view has no section index and no filters in its header.
- `usage-dashboard`: Overview's header holds the lede alone.
- `limits-dashboard`: the source filter is in the scope bar.
- `errors-dashboard`: the page-level filters are in the scope bar; the page header holds none.

## Impact

- `web/src/components/`: new `ScopeBar.tsx` and `ScopeBar.css`; `Filters.tsx` loses its children slot and gains `BriefLink`; `SectionIndex.tsx` and `.css` are deleted; `jumpTo` moves to `Drawer.tsx`.
- `web/src/App.tsx` mounts the bar. Every page drops its `<Filters>` and hands its project list to the bar.
- `base.css`, `errors.css`, `live.css`: offsets use `--bars-h`, the nav's and the scope bar's heights together.
- No API, payload or stored data change.
