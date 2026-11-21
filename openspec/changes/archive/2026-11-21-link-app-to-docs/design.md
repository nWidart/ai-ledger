# Design

## D1. One registry

`web/src/docs.ts` exports the base URL and a map:

```ts
export const DOCS_BASE = "https://nwidart.github.io/ai-ledger/";
export const DOCS = {
  home: { path: "", title: "Dashboards for Claude Code and Codex" },
  "pages/cost": { path: "pages/cost/", title: "Cost" },
  "concepts/windows#context": { path: "concepts/windows/", anchor: "the-context-window", title: "Context windows and plan limit windows" },
  // …
} as const satisfies Record<string, DocsEntry>;
export type DocsKey = keyof typeof DOCS;
export const docsUrl = (key: DocsKey) => DOCS_BASE + DOCS[key].path + (DOCS[key].anchor ? "#" + DOCS[key].anchor : "");
```

The site sets `trailingSlash: "always"`, so every page path ends with `/`. The registry holds one entry per content page (the palette lists them, D4) plus the anchored entries the toggletips use (D5). The Changelog page is built from `CHANGELOG.md` and has no content file, so it is not in the registry. A key is a name, not a URL: when a docs page moves, the entry's `path` changes and no call site does.

`docsForRoute(path, search)` maps a route to its key: each page path to its page (`/usage` to `pages/activity`, `/usage` with `view=judgments` to `pages/insights`, `/project` to `pages/project`), anything else to `home`. The Nav link and the palette's "Docs: this page" both use it.

One component, `DocsLink`, draws every docs link (D3). No component builds a docs URL itself; a check in `docs.test.ts` searches `web/src` for the base URL's host outside `docs.ts` and fails if it finds one.

## D2. The drift test

`web/src/docs.test.ts` reads `../site/src/content/docs/` (the repository holds both projects; the web tests run from `web/`). For each entry:

- the path resolves to `<path>.md`, `<path>.mdx`, `<path>/index.md` or `<path>/index.mdx`, and `""` to `index.mdx`;
- the file's frontmatter `title` equals the entry's `title`, so the palette's names stay those of the pages;
- an anchor equals the slug of one of the file's Markdown headings, slugged as Starlight slugs them (github-slugger, with its counter for repeated headings).

A failure names the key and what is missing. The site's own build already fails on a broken internal link (`documentation-site`, "Fail the build on a broken internal link"); this test is the same guard for links that start in the app, run by `cd web && npm run check`. It catches a rename in the same pull request that makes it, whichever project the pull request touches, since CI runs the web check on every pull request.

## D3. Link behavior

`DocsLink` renders `<a href={docsUrl(key)} target="_blank" rel="noreferrer">`. `noreferrer` implies `noopener`; the app already sends `Referrer-Policy: no-referrer`, so the site learns nothing of the app's address either way. The accessible name keeps the visible text first, so speech input can say it, and adds where it goes: "Docs, Cost page documentation, opens in a new tab", "Learn more: How cost is estimated, documentation, opens in a new tab". An icon that marks a new tab is `aria-hidden`; the words carry it.

The app is local-only. A docs link is a plain anchor, not a router `Link`, so it starts no intent preload; the app adds no `preconnect`, `prefetch` or speculation rule for the docs origin, and loads no image or font from it. The page's `connect-src 'self'` already stops a script from fetching it. The first request to the docs site is the navigation the user starts.

## D4. Navigation and palette

The Docs link sits in the navigation after the palette button. It shows "Docs" with a book icon where the bar has room, and the icon alone at the step where the palette button becomes an icon, its word hidden visually so its name stays the same. At the phone step, where the page chooser takes the tabs' place, the bar has no room for it: measured in Chromium in the widest state (a long project filter, Stale, the Limits pill at "≈100%" in alert, waiting sessions), it left the row 16px short at 390px and 13px at 320px. So there it leaves the bar (`display: none`, which takes it out of the tab order and the accessibility tree) and becomes the last row of the chooser's list, set off from the two page groups as a group is: "Docs" with the book, the same `docsForRoute` key, never `aria-current`. Activating it opens the new tab and closes the list, which gives focus back to the chooser button. Only one of the two links is exposed at any width, and every other control keeps its target size. This changes the bar's shrink order ("Keep the navigation on one row"); the stylesheet test checks the rule, and a manual Chromium run measured the row from 1280px down to 320px.

The palette gets a "Docs: this page" command and one "Docs: <title>" command per registry page entry (not per anchored entry). They are commands, with the Command badge and `>`, matched on "docs", "documentation", "help" and the page's title. A palette row is a listbox option, not an anchor, so here the real-anchor rule cannot hold: committing a docs command calls `window.open(url, "_blank", "noreferrer")` from the Enter or click handler, which is a user activation, so no popup blocker stops it. The docs command takes the command slot, as `>refresh` and `>copy link` do; the other chips still apply to the view. The footer says "Enter: open the Cost docs in a new tab". A page name typed alone (`>cost`) still ranks the page above its docs command.

## D5. Toggletips

`Toggletip` and `HowMeasured` take `docs?: DocsKey`. With it, the popup ends with " Learn more" as a `DocsLink`, after the text. Since the popup renders right after the button in the DOM, Tab from an open toggletip's button reaches the link; Escape still closes the popup and returns focus to the button. A popup opened by hover stays open while the pointer is over it, so the link can be clicked.

The popup has `role="tooltip"`, and ARIA does not allow interactive content in a tooltip. A toggletip with a link therefore drops that role (it is a non-modal popover next to its button, which is what the toggletip pattern describes); one without a link keeps it. The test covers both.

Which key a call site takes: a figure estimated from list prices links to `concepts/cost-estimates`; the context meter and context figures to `concepts/windows#the-context-window`; plan limit figures to `concepts/windows#the-plan-limit-window`; a page term to the glossary's section for that page (`reference/glossary#cost`, `#errors`, …). A toggletip whose text is complete on its own, such as a Change cell's rates or the freshness time, takes none. Task 3.1 lists each call site with its key or "none".

## D6. Stuck states

Three states link to the docs:

- A page's load failure (the failure message and Retry that replace the placeholder, and the "Could not load …" banner) adds "Troubleshooting" to `reference/troubleshooting`.
- The freshness control's details, when it says Failed or Offline, end with a link to `reference/troubleshooting`: the nav passes `docs="reference/troubleshooting"` to that toggletip in those two states only, so it drops `role="tooltip"` then (D5) and keeps it in every other state. Retry (a failed manual Refresh) and Stale take none. Offline means the app stopped answering; the link still works, since it goes to another origin.
- When the status poll reports a finished ingest and `counts.sessions` is 0, each dashboard page says the store holds no session yet and links to `start/install`, which says where the agents' transcripts must be. The note does not replace the page; the page still shows its zero figures under it.

The 503 "frontend build missing" answer is plain text written by the Python server before any of the app loads (`distribution`, "Build the frontend in CI"), so the app cannot add a link there. It stays out of this change. Sheets' and table rows' "Could not load" lines keep only Retry: they are one request in a page that works.

## Risks

- **An installed app links to docs built from `main`.** A user on an older version follows a link to a page that `main` has since renamed or removed. The registry test catches it for the current app only. So a page the app links to keeps its address, or the site serves a redirect from it (`documentation-site`, new requirement). The site keeps no redirect today: when Insights became Activity's Judgments view, its docs page kept the address `pages/insights/` instead. Astro's `redirects` option is the way to add one.
- **The docs describe `main`, not the user's version.** A link can open a description of a feature the user's version lacks. Version-pinned URLs are a non-goal; the docs' Changelog page and the Upgrade page are the answer for now.
- **The navigation fills.** One more control in a bar that must stay one row at 320px. It did not fit at the phone step, so the fallback this risk named was taken: the Docs link moves into the page chooser's list there (D4). The phone rows are back to what they needed before (384px and 315px on Context, the longest chooser label). Above the phone step the link stays in the bar, where the row's spare room is smaller by its width.
