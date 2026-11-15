# Spec Delta

## MODIFIED Requirements

### Requirement: Errors dashboard served from the store
The errors dashboard SHALL read its data from the store and SHALL keep its existing behavior: error categories with suggested fixes, per-example (`?ex=<tool_use_id>`) and per-category (`?cat=<type>`) permalinks, and applied-fix markers. A link in the earlier `#ex=` or `#cat=` form SHALL still open.

#### Scenario: Existing permalink
- **WHEN** the user opens an errors dashboard URL with `#ex=<tool_use_id>` copied before this change
- **THEN** that example is focused, as before
- **AND** the URL reads `?ex=<tool_use_id>` in place of the hash

#### Scenario: Permalink in the query string
- **WHEN** the user opens an errors dashboard URL with `?ex=<tool_use_id>`
- **THEN** that example is focused, as before

#### Scenario: Error from a deleted transcript
- **WHEN** an error's transcript file was deleted after ingest
- **THEN** the error still appears in the errors dashboard

#### Scenario: Fix marked before the rebuild
- **WHEN** the user marked a fix as applied on the errors dashboard before this change
- **THEN** the marker still shows on its date with the before and after error rate

### Requirement: Exclude automated sessions by default
Every page with the automated filter (Activity, Cost, Context, Insights, Live) SHALL leave out automated sessions from every figure, chart and table, and SHALL offer a control to include them. The choice SHALL be kept in the page URL and carried across pages. A project filter that names an automated project SHALL include that project's sessions; naming `(temp)` SHALL NOT include its automated sessions.

#### Scenario: Default view
- **WHEN** the store holds 631 `observer-sessions` sessions and 872 other sessions in the last 30 days
- **THEN** Activity counts 872 sessions for that range and `observer-sessions` does not appear in its tables or the project picker

#### Scenario: Include automated sessions
- **WHEN** the user turns on the control to include automated sessions
- **THEN** Activity counts 1,503 sessions, `observer-sessions` appears in its tables, and the URL records the choice

#### Scenario: Filter names an automated project
- **WHEN** the user opens Activity with `?project=observer-sessions` and the control off
- **THEN** Activity shows the `observer-sessions` sessions, and the project picker shows `observer-sessions` as the selected project

#### Scenario: Context leaves automated sessions out
- **WHEN** the user opens Context with the control off
- **THEN** no automated session takes part in any Context figure or tip

## ADDED Requirements

### Requirement: Keep the view in the query string
The app SHALL keep the page in the URL path and the view in the URL query string: the project, range, source and automated toggle, the open sheet, and each page's own keys. Reloading the page or opening a copied URL SHALL show the same view. Keys and values SHALL be written as plain text, with no quoting added to a value. A key the page does not know SHALL be ignored.

#### Scenario: Reload keeps the view
- **WHEN** the user on `/usage?project=myproject&range=7&session=<id>` reloads the page
- **THEN** Activity shows `myproject` over 7 days with that session's sheet open

#### Scenario: Value that reads as a number
- **WHEN** the user filters to a project named `123`
- **THEN** the URL holds `project=123`, and opening that URL shows the project `123`

#### Scenario: Unknown key
- **WHEN** the user opens `/cost?project=myproject&nosuchkey=1`
- **THEN** Cost shows `myproject` as it would without `nosuchkey`

### Requirement: Open links in the earlier hash form
The app SHALL open a URL whose hash holds a view in the form used before the query string, such as `/usage#project=myproject&range=7`, as the same view. It SHALL rewrite the URL to the query-string form in place, with no reload and no added history entry. A hash that holds no `=` SHALL be left as it is.

#### Scenario: Old bookmark
- **WHEN** the user opens `/usage#project=myproject&range=7&session=<id>`
- **THEN** Activity shows `myproject` over 7 days with that session's sheet open
- **AND** the URL reads `/usage?project=myproject&range=7&session=<id>`
- **AND** browser Back leaves the app for where the user was before the link

#### Scenario: Old link entered in an open tab
- **WHEN** the user on `/usage` enters `/usage#project=myproject` in the address bar
- **THEN** Activity shows `myproject` without a reload, and the URL reads `/usage?project=myproject`

#### Scenario: Old link over a view
- **WHEN** the URL holds both a query string and a hash in the earlier form
- **THEN** the app shows the view the hash names and drops the query string's

### Requirement: Animate a page switch
Selecting another page SHALL animate the change with a view transition when the browser supports view transitions and the user has not asked for reduced motion. A change of filter, sheet or other view state on the same page SHALL NOT start one. Without support, or with reduced motion, the page SHALL switch at once.

#### Scenario: Page switch
- **WHEN** the user selects Cost on Activity in a browser with view transitions and no reduced-motion preference
- **THEN** the change from Activity to Cost is one view transition

#### Scenario: Reduced motion
- **WHEN** the user who prefers reduced motion selects Cost
- **THEN** Cost replaces Activity with no animation

#### Scenario: Filter change
- **WHEN** the user changes the range on Activity
- **THEN** no view transition starts

### Requirement: Restore the scroll position on Back and Forward
Browser Back and Forward SHALL return the page to the scroll position it had when the user left that history entry. Selecting another page SHALL start it at the top. A change of filter or sheet on the same page SHALL leave the scroll position where it is.

#### Scenario: Back to a scrolled page
- **WHEN** the user scrolls down Activity, selects Cost, then presses browser Back
- **THEN** Activity is shown at the scroll position the user left it at

#### Scenario: New page starts at the top
- **WHEN** the user scrolls down Activity and selects Cost
- **THEN** Cost is shown from its top

#### Scenario: Filter change keeps the position
- **WHEN** the user scrolls down Activity and changes the range
- **THEN** the page stays at the same scroll position

### Requirement: Start loading a page from its tab
Pointing at or focusing a page's tab in the navigation SHALL start loading that page's code and its main data for the current filters, so that selecting the tab shows the page sooner. It SHALL NOT change the URL, the history or the page shown. The Live tab SHALL load its code only.

#### Scenario: Point, then select
- **WHEN** the user points at the Cost tab and then selects it
- **THEN** the app asks for Cost's data once, and the request started by pointing is the one the page uses

#### Scenario: Point without selecting
- **WHEN** the user points at the Cost tab and moves away
- **THEN** the page shown, the URL and the history are unchanged

#### Scenario: Live tab
- **WHEN** the user points at the Live tab
- **THEN** no Live data is requested until the tab is selected

### Requirement: Show a placeholder while a page first loads
A page that has nothing to show yet, because its code or its first data is still loading, SHALL show gray placeholder blocks in the outline of a page (a heading line, summary blocks and a panel) with a moving sheen, once the wait passes 150 ms. The blocks SHALL be hidden from assistive technology and the content area SHALL stay `aria-busy`. With reduced motion the sheen SHALL NOT move. A page that already shows data SHALL keep it on screen while new data loads.

#### Scenario: First visit to a page
- **WHEN** the user opens Activity and its data takes longer than 150 ms
- **THEN** gray placeholder blocks show until the data arrives, and the page then takes their place

#### Scenario: Fast load
- **WHEN** the page's data arrives within 150 ms
- **THEN** no placeholder is shown

#### Scenario: Reduced motion
- **WHEN** the user who prefers reduced motion opens a page that is loading
- **THEN** the blocks show with no moving sheen

#### Scenario: Filter change
- **WHEN** the user changes the range on a page that shows data
- **THEN** the earlier figures stay on screen while the new ones load, and no placeholder shows

#### Scenario: Failed first load
- **WHEN** the page's first load fails
- **THEN** the page's failure message and Retry take the place of the blocks

#### Scenario: Screen reader
- **WHEN** a screen reader user opens a page that is loading
- **THEN** the blocks are not announced, and the content area is `aria-busy` until the data arrives
