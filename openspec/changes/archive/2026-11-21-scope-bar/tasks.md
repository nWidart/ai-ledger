# Tasks

## 1. The scope bar

- [x] 1.1 Add `ScopeBar` to the app shell, between the nav and the page, with `scopeOf(path, judgments)` picking the filters and `useScopeProjects` taking each page's project list. Verify with `ScopeBar.test.tsx` ("scopeOf", "lists the projects the page hands it") and `Filters.test.tsx` ("per page").
- [x] 1.2 Remove `<Filters>` from the headers of Activity, the Judgments view, Cost, Context, Errors, Limits, Live and the Project page; keep Cost's plan gauge, Limits' range in Past windows and Errors' Day / Week where they are. Verify with `CostPage.test.tsx` ("plan gauge"), `ErrorsPage.test.tsx` ("controls where they act"), `Judgments.test.tsx` and `LimitsPage.test.tsx`.
- [x] 1.3 Replace the "Project page →" link with `BriefLink`, the bar's last control. Verify with `ScopeBar.test.tsx` ("shows Brief …", "no Brief on Limits"), `Filters.test.tsx` ("Brief link and clear button") and `router.test.tsx`.
- [x] 1.4 Keep URL keys and focus on a filter change. Verify with `ScopeBar.test.tsx` ("keeps the URL keys and the focus") and `Judgments.test.tsx` (the range change keeps `source=claude`).

## 2. Two sticky bars

- [x] 2.1 Delete `SectionIndex` and its CSS; remove it from Cost and the Judgments view; move `jumpTo` to `Drawer.tsx`. Verify with `Drawer.test.tsx` ("jumpTo"), `CostPage.test.tsx` ("sections") and `Judgments.test.tsx` ("has no sticky section index").
- [x] 2.2 Measure the bar into `--scope-h`, add `--bars-h`, and move the scroll padding, Errors' type list, type header and example bar, and Live's fit height onto it. Verify with `ScopeBar.test.tsx` ("keeps its height in --scope-h") and `theme.test.ts` ("scroll padding").
- [x] 2.3 Add `tools/demo/sticky.mjs`: at most two stuck page bars on every page and the Judgments view at 1440×900 and 390×844, the bar under the nav, no sideways scroll, and Errors' headers under both bars. Verified locally on the demo store; it also catches an injected third bar.

## 3. Narrow screens and the keyboard

- [x] 3.1 Collapse the bar to a Filters button with its count up to 56em, with the project and Brief beside it, and the filters in a popover. Verify with `ScopeBar.test.tsx` ("narrow").
- [x] 3.2 Keep the wide bar on one row down to 56em: compact controls, a shrinking project field, "sessions" dropped under 64em. Verified in a browser at 897, 960, 1024 and 1440 px: one row, 41 px.
- [x] 3.3 Keep the tab order nav, bar, page on every page. Verify with `ScopeBar.test.tsx` ("the app shell's scope bar").

## 4. First screen

- [x] 4.1 Trim the page's top padding, widen Activity's lede and tighten Live's stream page. Verify with `ErrorsPage.test.tsx` (the width budget) and, in a browser, `firstscreen.mjs` and `livefit.mjs`.
- [x] 4.2 Extend `tools/demo/firstscreen.mjs` to Cost, Errors, Limits, the Judgments view and Live. Verified locally: every first chart starts inside 900 px.

## 5. Docs

- [x] 5.1 Update `README.md`, the docs site and `CHANGELOG.md`.
- [x] 5.2 Regenerate the screenshots and README GIFs that show the bar.
