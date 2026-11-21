# Tasks

## 1. Registry, link and drift test

Comes first: every later task links through it.

- [x] 1.1 Add `web/src/docs.ts`: `DOCS_BASE`, the `DOCS` map (one entry per content page under `site/src/content/docs/`, with its title; the Changelog left out), `DocsKey`, `docsUrl()` and `docsForRoute()` (design D1). Verify with `docs.test.ts` ("maps each route to its page": `/cost` to `pages/cost/`, `/usage?view=judgments` to `pages/insights/`, `/project` to `pages/project/`, an unknown path to the home).
- [x] 1.2 Add `DocsLink` (`web/src/components/DocsLink.tsx`): an anchor with `target="_blank"`, `rel="noreferrer"`, and a name that starts with its visible text and says it opens the documentation in a new tab (design D3). Verify with `DocsLink.test.tsx` (href, target, rel, accessible name, reachable by Tab).
- [x] 1.3 Add the drift checks to `docs.test.ts`: each path has a content file, each title equals the file's frontmatter title, each anchor matches a heading slugged as Starlight slugs them, and no file in `web/src` outside `docs.ts` holds the docs host (design D2). Verify by renaming a heading and a file in a scratch copy: the test fails and names the key.

Done when: `cd web && npm run check` passes and a broken entry fails it.

## 2. Surfaces (independent of each other; each needs 1)

- [x] 2.1 Navigation: add the Docs link after the palette button in `Nav.tsx`, pointing at `docsForRoute()` of the current route; in `Nav.css`, show it as an icon at the step where the palette button becomes one. Verify with `Nav.test.tsx` (href per route, follows a page change, name) and the one-row checks at 1000px, 390px and 320px.
- [x] 2.2 Palette: add "Docs: this page" and one "Docs: <title>" command per registry page in `palette/suggest.ts`; commit opens the page with `window.open(url, "_blank", "noreferrer")`, takes the command slot and lets the other chips apply (`resolve.ts`, `Palette.tsx`); the footer names the docs page (design D4). Verify with `suggest.test.ts` (matches "docs", "help" and titles; `>cost` ranks the page first), `resolve.test.ts` (command slot, other chips kept) and `Palette.test.tsx` (`window.open` called with the URL and `noreferrer`, footer text).
- [x] 2.3 Toggletip: add `docs?: DocsKey` to `Toggletip` and `HowMeasured`; with it, end the popup with " Learn more" as a `DocsLink`, drop `role="tooltip"` from that popup, and keep a hover-opened popup open while the pointer is over it (design D5). Verify with `Toggletip.test.tsx` (Tab from the open button reaches the link, Escape from the link closes and returns focus, hover into the popup keeps it, role kept without a key).

Done when: `cd web && npm run check` passes.

## 3. Docs keys on toggletips (needs 2.3)

- [x] 3.1 List every `Toggletip` and `HowMeasured` call site (about 27 files) with the key it takes, or "none" when its text explains the figure fully, by the rules in design D5. Add any anchored entry the list needs to `docs.ts`.
- [x] 3.2 Apply the keys from 3.1. Verify with the page tests: Cost's How measured links to `concepts/cost-estimates/`, the Context meter's to `concepts/windows/#the-context-window`, a Limits figure's to `concepts/windows/#the-plan-limit-window`, and a toggletip listed "none" has no link.

## 4. Stuck states (needs 1)

- [x] 4.1 Add a Troubleshooting `DocsLink` beside Retry in each page's load failure and "Could not load" banner (Activity, Judgments, Cost, Context, Errors, Limits, Live, Project). Verify with each page's failed-load test.
- [x] 4.2 End the freshness control's details with a Troubleshooting link while it says Failed or Offline (`Nav.tsx`, `IngestDetails`). Verify with `Nav.test.tsx` (Failed and Offline show it; a fresh state does not).
- [x] 4.3 Show the no-session note, linking to `start/install/`, on every dashboard page when the status reports a finished ingest and `counts.sessions` is 0; remove it once a session is stored. Verify with `App.test.tsx` (note shown with zero sessions after an ingest, absent before the first ingest ends and once a session exists).
- [x] 4.4 Check that no docs request leaves the app: in a page test, spy on `fetch` and on `<link>` insertion while opening Cost, pointing at Docs and opening a toggletip with a link; none names the docs host. Verify with that test.

## 5. Docs, changelog and checks

- [x] 5.1 `README.md`: say that the app links to the documentation from the navigation, the palette and its explanations.
- [x] 5.2 `CHANGELOG.md` `[Unreleased]`, under Added: the Docs link, the palette's docs commands, Learn more in toggletips, and the links from failure and empty states.
- [x] 5.3 Docs site: on `everywhere/command-palette` add the docs commands; on `start/first-tour` mention the Docs link and Learn more; in `site/README.md` add the note that the app links through `web/src/docs.ts` and a rename needs a redirect (Astro's `redirects` option). Write the content with the `doc-coauthoring` skill.
- [x] 5.4 Run `uv run ruff check`, the Python tests, `cd web && npm run check`, `cd site && npm run check`, `openspec validate --specs --strict` and `openspec validate link-app-to-docs --strict`.
