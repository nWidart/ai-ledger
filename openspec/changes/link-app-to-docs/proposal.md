# Proposal

## Why

The app has no link to the documentation site. The docs explain each page, how cost is estimated, what the two windows are and what to do when something goes wrong, but a user looking at a figure in the app has no way from there to the page that explains it. They have to know the site exists, find it, and find the right page.

The places where a link would help most are the ones the app already marks: a toggletip that says how a figure is measured, the page the user is on, and a state where the user is stuck (a page that failed to load, an ingest that failed, a store with no session in it).

## What Changes

One registry, four surfaces.

- **Registry.** `web/src/docs.ts` holds the docs base URL, `https://nwidart.github.io/ai-ledger/`, and a typed map from a docs key to a docs path, with an optional heading anchor and the page's title. Every docs link in the app goes through it, drawn by one link component. A web test fails when a path in the registry has no content file under `site/src/content/docs/`, when a given anchor matches no heading of that file, or when a title differs from the file's, so a renamed or removed docs page breaks the build instead of shipping a dead link.
- **Navigation.** The navigation gains a Docs link that opens the docs page for the current route: Cost opens `pages/cost/`, the Judgments view `pages/insights/`, the Project page `pages/project/`. A route with no page of its own opens the docs home.
- **Command palette.** A "Docs: this page" command opens the current route's docs page, and one command per docs page opens that page by name.
- **Toggletips.** `Toggletip` and `HowMeasured` take an optional docs key and then end their text with a "Learn more" link to the concept or glossary entry behind the figure, such as `concepts/cost-estimates`, `concepts/windows` or `reference/glossary`.
- **Stuck states.** A page's load failure, the freshness control's Failed and Offline states, and a store that holds no session after an ingest link to `reference/troubleshooting` or `start/install`.

Every docs link opens in a new tab with `rel="noreferrer"`, is a real anchor reachable by keyboard, and has an accessible name that says it opens the documentation. The app makes no request to the docs site until the user activates a link.

## Non-goals

- Embedding the docs in the app, or showing a docs page in a sheet.
- Offline docs, or shipping the docs with the package.
- Version-pinned docs URLs: the app links to the site built from `main`.
- Searching the docs from the app.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard-app`: the docs registry and its drift test, the link behavior and the no-request rule, the navigation's Docs link (and the one-row navigation that now holds it), the toggletip's Learn more link, and the links from stuck states.
- `command-palette`: the "Docs: this page" command and the per-page docs commands.
- `documentation-site`: a page the app links to keeps its address, or a redirect from it, when it is renamed or removed.

## Impact

- `web/src/docs.ts` (new) and a `DocsLink` component (new), `Nav.tsx` and `Nav.css`, `palette/suggest.ts`, `palette/resolve.ts` and `Palette.tsx`, `Toggletip.tsx`, `Toggletip.css` and `HowMeasured.tsx`, the toggletip call sites, the pages' failure banners and the freshness control's details.
- Tests: `docs.test.ts` (new, reads `site/src/content/docs/`), and Nav, palette, Toggletip and page tests.
- `README.md`, `CHANGELOG.md` and a note on the docs site.
- No API, payload or stored data change. The empty-store note reads the `counts` the status poll already returns.
