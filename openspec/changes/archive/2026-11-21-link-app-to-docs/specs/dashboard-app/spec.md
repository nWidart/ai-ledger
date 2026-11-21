## ADDED Requirements

### Requirement: Link to the docs through one registry
Every link from the app to the documentation site SHALL take its address from one registry in `web/src/docs.ts`, which holds the site's base URL, `https://nwidart.github.io/ai-ledger/`, and maps each docs key to a page path, an optional heading anchor and the page's title. No other module SHALL hold a docs URL. The web check SHALL fail when a registry path has no content file under `site/src/content/docs/`, when an anchor matches no heading of that file, or when a title differs from the file's.

#### Scenario: A docs page is renamed
- **WHEN** a pull request renames `site/src/content/docs/concepts/windows.md` and the registry still names `concepts/windows/`
- **THEN** `npm run check` in `web/` fails and names the key whose page is missing

#### Scenario: A heading is reworded
- **WHEN** the heading "The context window" in `concepts/windows.md` is reworded and the registry still names its anchor
- **THEN** `npm run check` in `web/` fails and names the key whose anchor is missing

#### Scenario: A component hard-codes a docs URL
- **WHEN** a component outside `web/src/docs.ts` writes `https://nwidart.github.io/ai-ledger/pages/cost/`
- **THEN** `npm run check` in `web/` fails

### Requirement: Open docs links in a new tab
A link to the documentation SHALL be an anchor that opens its page in a new tab with `rel="noreferrer"`, reachable by keyboard. Its accessible name SHALL start with its visible text and say that it opens the documentation in a new tab.

#### Scenario: Activate from the keyboard
- **WHEN** the user tabs to a docs link and presses Enter
- **THEN** the docs page opens in a new tab, and the app stays as it was in its own tab

#### Scenario: Screen reader
- **WHEN** a screen reader user reaches the navigation's Docs link on Cost
- **THEN** it reads as a link whose name starts with "Docs" and says it opens the Cost page documentation in a new tab

### Requirement: Make no request to the docs site until asked
The app SHALL make no network request to the documentation site, and SHALL load nothing from it, until the user activates a docs link. A docs link SHALL NOT preload or prefetch its page, and the app SHALL NOT preconnect to the site.

#### Scenario: Pages with docs links
- **WHEN** the user opens Cost, points at its Docs link and opens a toggletip with a Learn more link
- **THEN** the browser has sent no request to `nwidart.github.io`

#### Scenario: Following a link
- **WHEN** the user activates the Docs link
- **THEN** the first request to the docs site is the new tab's navigation to the page

### Requirement: Link the current page's docs from the navigation
The navigation SHALL show a Docs link, after the palette button, that opens the documentation page for the current page: Live, Limits, Activity, Cost, Context, Errors and Project each open their own page, and Activity's Judgments view the Judgments page; any other route opens the docs home. On a phone the link SHALL be the last row of the page chooser's list instead, never marked current. The link SHALL follow the docs link requirements.

#### Scenario: On Cost
- **WHEN** the user views Cost and activates Docs
- **THEN** `https://nwidart.github.io/ai-ledger/pages/cost/` opens in a new tab

#### Scenario: On the Judgments view
- **WHEN** the user views `/usage?view=judgments` and activates Docs
- **THEN** `https://nwidart.github.io/ai-ledger/pages/insights/` opens in a new tab

#### Scenario: The page changes
- **WHEN** the user moves from Cost to Errors
- **THEN** the Docs link points at `pages/errors/`

#### Scenario: On a phone
- **WHEN** the user views Cost on a phone, opens the page chooser and activates its last row, Docs
- **THEN** `pages/cost/` opens in a new tab and the chooser closes

### Requirement: Link a toggletip to the concept it uses
A toggletip, How measured included, MAY name a docs key. When it does, its text SHALL end with a "Learn more" docs link to the concept or glossary entry that explains the figure. A toggletip whose text explains its figure fully SHALL name no docs key.

#### Scenario: Cost's How measured
- **WHEN** the user activates Cost's How measured and presses Tab until the Learn more link has focus, then Enter
- **THEN** `concepts/cost-estimates/` opens in a new tab

#### Scenario: A complete explanation
- **WHEN** the user opens the toggletip on an Errors Change cell
- **THEN** it shows the rates before and after, and no Learn more link

### Requirement: Reach a toggletip's link by keyboard and pointer
Tab from a toggletip's button SHALL reach its Learn more link while the text shows. A toggletip with a link SHALL still close on Escape, on activating its button again and on a click outside it, and a text opened by hover SHALL stay while the pointer is over it, so the link can be clicked.

#### Scenario: Pointer into the text
- **WHEN** the user rests the pointer on a toggletip with a Learn more link, moves it onto the text and clicks the link
- **THEN** the text stays open while the pointer moves, and the docs page opens in a new tab

#### Scenario: Escape from the link
- **WHEN** focus is on a toggletip's Learn more link and the user presses Escape
- **THEN** the text hides and focus returns to the toggletip's button

### Requirement: Point a stuck state to the docs
A page whose load failed, in its failure message or its "Could not load" banner, SHALL link to the Troubleshooting page beside Retry. The freshness control's details SHALL end with a link to the Troubleshooting page while it says Failed or Offline. When the status reports a finished ingest and the store holds no session, every dashboard page SHALL say that the store holds no session yet, above its figures, and link to the Install page. Each link SHALL follow the docs link requirements.

#### Scenario: A page fails to load
- **WHEN** Activity's first load fails
- **THEN** the failure message shows Retry and a Troubleshooting link to `reference/troubleshooting/`

#### Scenario: Ingest failed
- **WHEN** the freshness control says "Failed" and the user opens its details
- **THEN** the details show the error's full text and end with a link to `reference/troubleshooting/`

#### Scenario: A fresh install with no transcripts
- **WHEN** the first ingest ends and the store holds no session
- **THEN** Activity says the store holds no session yet, links to `start/install/`, and still shows its figures below

#### Scenario: Data arrives
- **WHEN** a later ingest stores a session
- **THEN** the no-session note goes away

## MODIFIED Requirements

### Requirement: Keep the navigation on one row
The navigation SHALL be one row at every window width and zoom level, every entry and control in reach with no sideways scroll. As space shrinks it SHALL hide the app's wordmark, then show the palette button and the Docs link as icons, then hide the groups' visible names, then replace the tabs with the page chooser, whose list takes the Docs link. A tab SHALL NOT move into an overflow menu. A changed count or percent SHALL NOT move a tab or a control, and the Live badge SHALL take no room.

#### Scenario: Laptop window with a project filter
- **WHEN** the user views Errors with the project filter `ai-ledger` in a window 1000px wide
- **THEN** the brand, all six tabs in their two groups, the palette button, the Docs link, the freshness control and the theme button sit on one row

#### Scenario: Phone
- **WHEN** the user views Errors on a phone 390px wide
- **THEN** the navigation is one row with the logo, the page chooser, the palette button, the freshness control and the theme button, and the Docs link is in the page chooser's list

#### Scenario: Zoomed in
- **WHEN** the user views Activity in a 1280px window at 200% browser zoom
- **THEN** the navigation is one row, and no page entry is out of reach

#### Scenario: An alert arrives
- **WHEN** a status poll brings a limits alert and a waiting session while the user views Cost in a narrow window
- **THEN** no tab or control moves: the pill changes its tone and the badge shows in the Live tab's corner

#### Scenario: The widest state on a small phone
- **WHEN** the last ingest is stale, a limits alert is present and sessions wait, on a phone 320px wide
- **THEN** the navigation is still one row with no sideways scroll, and the Docs link is in the page chooser's list
