# Design

## Context

The navigation is one flat row of seven tabs with a 7px alert dot on Limits. Insights is a page of its own with its own header layout. Each page mounts `UsageSheets`, so Limits, which mounts none, cannot show a session. Every page shows the same filter bar.

The user decided that Insights folds into Activity as a second view. The rest of the design is this change's.

Two other changes run in parallel: `errors-unify-triage` rewrites `web/src/pages/errors/`, and `context-tabs-cache-waste` rewrites `web/src/pages/context/`. This change touches those folders only to remove their `UsageSheets` mount, and in their tests only to render the shell's sheet host beside the page.

## Goals / Non-Goals

**Goals**

- The bar says what is urgent now without opening a page: sessions waiting, and the fullest limit window.
- One place for "what did the sessions do": measured (Overview) and judged (Judgments).
- A session or a tool opens in place on every page.
- No filter that changes nothing, and no page that only says "nothing here".

**Non-Goals**

- No new endpoint and no new stored table.
- No change to how `/insights` data is read or grouped into families.
- No redesign of Errors or Context: other changes own them.
- No re-recorded screenshots or GIFs in this change (see Risks).

## Decisions

### Navigation

- **Now first, then Review.** Order: Live, Limits, Activity, Cost, Context, Errors. "Now" is what a returning user checks first; it is short, so it does not push Review far. Activity stays the default page.
- **Groups are `role="group"` with `aria-label`.** The visible group name is the same word, so it is `aria-hidden`: it is read once. No list or heading markup: the tabs stay plain links in a `nav`, as before. The page chooser's list uses the same groups, each with its own `ul`.
- **The group names give way before the tabs do.** A new step (56.5em) hides the visible names; the rule between the groups stays. The other steps moved to what the row now needs, measured with the widest state: "Stale" with its time, a long project name, the pill at "≈100%" and the badge. Wordmark 64em, palette icon 59.5em, names 56.5em, tighter tabs 51em, page chooser 48.5em, logo and caret 24em. The row fits at 320px.
- **One active style.** The Errors rule is deleted. A page tint on one tab out of six read as an alert, which it never was.

### Live badge

- **What it counts.** Active sessions whose state is `wait` (a likely approval wait) or `you` (your turn): the two states Live's own "waiting for you" count and tab title use. Every project and source, automated sessions left out. Not filtered by the URL: the badge is the same on every page, as the limits alert is.
- **Where it is worked out: in `/api/status`, on request, kept for 15 seconds.** A session's state depends on the clock (a shell call turns into a wait after 30 s), so a value worked out once per 60-second ingest cycle would lag by up to two polls. On request, it is at most one poll old, and the poll also runs when the user returns to the tab, which is when the badge matters. The 15-second keep means any number of open pages cost one read. `live.waiting()` reuses the state rules of `live.sessions()` and skips its titles and figures. A failure gives `null` and logs the type only, as the limits alert does.
  - *Alternative: once per cycle, beside the limits alert.* Cheaper, but stale for the one figure whose point is "now".
  - *Alternative: the nav polls `/api/live` itself.* A second poll, a heavier payload, and a count that would follow the page's filters.
- **Drawn as a corner badge, out of the flow.** It comes and goes often. In the flow it would shift every tab to its right each time. It caps at "9+"; the tab's name keeps the real count.
- **No live region.** The count changes often and is not an alarm. It is in the tab's name for whoever reads the bar.

### Limits pill

- **The percent is the fullest open window's; the tone is the alert's.** `limits.peak_of()` picks the open window with the highest percent; the app keeps it beside the alert, worked out in the same once-per-cycle step from the same payload. Tone: critical for `at_limit` and `runs_out`, warning for `high`, quiet otherwise, as the dot was toned.
- **The two can name different windows.** A forecast alert is for the window that runs out first, which need not be the fullest. The pill still shows the fullest: one rule for the number. The tab's name then says both: the alert's sentence, then "Highest open window: …". For `at_limit` and `high` the sentence already states the pill's percent, so nothing is added.
- **In the flow, with a fixed width.** Unlike the badge it is nearly always there, so it does not come and go; a fixed width means a changed percent moves nothing. "≈" marks an estimate.
- **On the page chooser's button only in alert.** The button has little room on a phone. A quiet percent is not worth it there; it stays on the Limits link in the list.
- **Color is not the only signal.** A pill in alert has a ring; the tab's name says the alert.

### Insights as Activity's Judgments view

- **The view is a key of Activity's URL: `view=judgments`.** Overview has no key, so every existing Activity link is unchanged. `view` is a push key: Back returns to the view before. It is written after the shared filters and before the view's own keys.
- **A switch drops the other view's keys.** `q`, `near` and `day` are Overview's; `outcome`, `friction`, `help`, `goal`, `fr`, `goalf` and `frf` are Judgments'. Left behind, they would narrow a list the user cannot see.
- **`/insights` redirects in the router,** with every key kept and the entry replaced, as the old hash form does. The server still serves the app at `/insights`. The redirect is client-side so it also covers a link followed inside the app.
- **Each view renders its own `main`.** `ActivityPage` picks `Overview` or `Judgments` and hands both the same `ViewSwitch`. The views have different payloads, loading states and section indexes; one shared `main` would tangle them. The switch is drawn again on a switch, so the clicked button's focus is handed to the new one.
- **The view does not flip while the app leaves Activity.** The URL changes before the route does. Reading the view from the URL alone drew Overview for a moment on the way out of Judgments and started, then abandoned, its request. The page keeps the view it showed until it is on `/usage` again.
- **The route's loader starts the view's own request.** `view=judgments` starts `/api/insights`, not `/api/usage`.
- **Files.** `pages/insights/` moves to `pages/activity/judgments/`. The CSS scope is `.pg-judgments`. The view's helper module is `figures.ts`, not `judgments.ts`: beside `Judgments.tsx` that name collides on a case-insensitive file system.
- **Section index.** Its first entry is "Summary", not "Overview", which now names the other view.

### Codex and Judgments

- **Judgments has no source filter.** Only Claude Code sessions have facets, so All and Claude Code show the same judgments. The view asks the API with no source, whatever the URL holds, and says "Claude Code sessions" in its sub line. The Codex coverage line and the Codex-only page are gone: the view no longer offers what it would disclaim.
- **For Codex alone, Judgments is unavailable, not hidden.** `aria-disabled`, still focusable, with the reason as visible text beside the switch and as its description. A hidden button would leave the user wondering where the view went.
- **A URL with `source=codex&view=judgments` opens Overview and drops the view,** as a replace. The URL then says what the page shows. This is the one way to arrive there: an old link, or `#codex` in the palette while on Judgments.

### Judgments improvements

- **Outcome trend: one bar per week, each 100% tall, stacked by outcome.** The question is "is the mix getting better?", which a share answers. A 100% bar hides the sample size, so the count sits over each bar, and a week with fewer than 5 sessions is drawn faint with a legend key. Under five, one session moves the bar by 25 points or more.
  - Parts, bottom up: fully, mostly, partially, not achieved, no clear outcome. The last is what the four leave of the week's sessions (unclear, or an outcome `/insights` adds later).
  - It follows the work chart's pattern: a focusable group, arrow keys, Home, End, Escape, a tooltip and a polite live readout, and a `ChartTable`. `chart.css` and the theme's forced-colors rules now cover `.pg-judgments`. No new chart helper.
  - The payload's trend rows gain `fully`, `mostly`, `partially` and `not_achieved`; `achieved` stays.
- **Session cards: cost, peak context share, tool errors.** The Insights payload did not hold them, and the Sessions endpoint is paged by another rule (requests in the range), so a client join would be partial. `insights.measured()` reads them from the store for the view's stored sessions, with the definitions the Sessions table uses, over the whole session. A session with no transcript has none. A peak at 80% or more and a failed call are marked, in words as well as ink.
- **Friction weights.** `families.group()` already holds the sessions behind each family and label; it now sums their cost and active time, each session once. The section has a switch: Cost (default), Active time, Reports. It orders the rows and sets the bar and the value; the other figures stand beside it. The weight is a way to read the ledger, so it is component state, not a URL key.
  - The weights are of the whole sessions that reported a friction. The hint says so: a costly session with one small friction is not a costly friction. It is still the best signal the data has for "which friction is worth fixing first".
  - The lede still names the most reported family: that sentence is about how often, and the vitals do not repeat it.

### One sheet host

- **`UsageSheets` is mounted once in `App`,** inside the context menu's wrapper and outside the page. It takes no props.
  - *The page's project* is the URL's.
  - *Errors shows automated sessions whatever the URL says:* the host reads that from the path.
  - *Session titles before the details arrive:* the host reads the cached usage payload as a sheet opens, with `getQueryData`. It holds no observer, so it neither fetches nor keeps a page's answer alive past its five minutes.
- **The sheet key stays per page** (`sheetKey`): `sheet` on Live, `session` elsewhere. Focus return (`twin()`) queries the document, so it works from the shell.
- **Errors' type sheet** already opens under any open dialog (`showModalUnder`), so a deep link to both still stacks the session sheet on top, though the shell's dialog now exists first.
- **The palette and the context menu** no longer keep a list of hosting pages. A sheet opens where the user is.
- **Tests** that open a sheet from a page render the page with `renderPage()`, which adds the host as the shell does.

### Filters

- `Filters` gains `source` (default shown), beside `project`, `range` and `automated`. The order stays project, range, source, automated.
- Judgments moves its filters into the header's right side, beside the heading, as Activity, Cost, Context, Limits and the Project page have them.

## Risks / Trade-offs

- **The waiting count costs a read of the newest lines of the active sessions** → kept for 15 seconds; with no active session it is one small query.
- **The pill's percent and the alert's sentence can be about two windows** → the tab's name says both; the Limits page leads with the binding window as before.
- **The friction cost is the session's, not the friction's** → said in the hint and behind How measured; Reports is one click away.
- **`/insights` bookmarks** → redirected with every key; the server keeps the path.
- **Screenshots and GIFs are stale.** The navigation shows in every GIF and in `tour-overview`, and the Judgments shots changed. `tools/demo`'s pinned Playwright has no browser installed on this machine, and the task forbids `playwright install`, so nothing was re-recorded. `record.mjs` is updated: the `insights` scene and shots now record the Judgments view, under the same file names, since published READMEs link to them. Re-record with `node record.mjs` and `node record.mjs shots` where the browser is installed.
- **Parallel changes** to Errors and Context will conflict where they touch their `UsageSheets` mount or their test render helper → both are one-line changes here.

## Migration Plan

No data migration. The payload fields are additions. Deploying the app and the page together is the normal release; an older app that sends no `live_waiting` or `limits_peak` shows no badge and no pill.

## Open Questions

None.
