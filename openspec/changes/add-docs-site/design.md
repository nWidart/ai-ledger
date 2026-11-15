# Design

## Context

The docs today are `README.md` (setup, the GIF grid) and `docs/guide.md` (one page per dashboard, Everywhere, Automated sessions, Configuration). The README published on PyPI links to `docs/guide.md` and to raw GitHub URLs of `docs/*.gif`, so those paths must keep working. `openspec/specs/` describes what every page shows. `tools/demo/` seeds a synthetic store (`seed.py`), serves it on 127.0.0.1:8799 with no limit polling and no real transcript root (`serve.py`), plays synthetic live sessions (`replay.py`), and records the GIFs with Playwright (`record.mjs`). CI runs Node 26 for `web/`.

The framework (Starlight), the host (GitHub Pages), the search (Pagefind), `llms.txt`, link validation, the structure and the playbook template are decided. This design records how they fit the repo.

## Goals / Non-Goals

**Goals**
- A static site that builds in CI, deploys from `main`, and fails its build on a broken internal link or a malformed playbook.
- Docs that stay in step with the app: reference pages from the specs, the changelog from `CHANGELOG.md`, no hand-copied duplicate.
- Screenshots that can only come from the synthetic store.
- A site usable by keyboard and screen reader, in light and dark.

**Non-Goals**
- Versioned docs, translations, a custom domain, analytics, hosted search.
- Generating reference pages from specs automatically. The specs are written for builders, the pages for users; a person writes the page from the spec.
- Changing the app, the store or `docs/*.gif`.

## Decisions

### D1. `site/` is its own npm project
`site/package.json` with Astro, `@astrojs/starlight`, `starlight-links-validator`, `starlight-llms-txt`, `@astrojs/check` and `typescript`, every version exact (no `^` or `~`), with a committed `package-lock.json`, as `web/` does. `engines.node` matches the Node major CI uses for `web/` (26). Scripts:

- `dev`, `build`, `preview`: Astro's, each preceded by `sync` (D9).
- `check`: `npm run sync && node scripts/check-playbooks.mjs && astro check && astro build`. This is the site's one check command, run locally and in CI.

`site/` shares nothing with `web/`: no workspace, no shared lock file. The app's build and tests do not see the site, and the site's dependencies never enter the Python package.

Rejected: a workspace with `web/` (couples two unrelated dependency trees and their upgrade cycles); Starlight inside `web/` (the app's Vite build would carry the docs).

### D2. URL and base
`astro.config.mjs` sets `site: "https://nwidart.github.io"` and `base: "/ai-ledger"`, with `trailingSlash: "always"`. Content links between pages are absolute paths that include the base (`/ai-ledger/pages/cost/`), the form Starlight renders unchanged and the links validator checks. Components that build URLs use `import.meta.env.BASE_URL`, never a literal `/`.

### D3. Pages workflow
New `.github/workflows/docs.yml`, separate from `ci.yml` so a docs-only change does not run the Python and web jobs and an app-only change does not build the site.

- Triggers: `pull_request` and `push` to `main`, both with `paths: site/**, docs/*.gif, CHANGELOG.md, .github/workflows/docs.yml`; and `workflow_dispatch`.
- `build` job: checkout, `actions/setup-node` with Node 26 and npm cache on `site/package-lock.json`, `npm ci`, `npm run check` in `site/`, then `actions/upload-pages-artifact` with `site/dist`.
- `deploy` job: only on `push` to `main` or `workflow_dispatch` on `main`; `needs: build`; `environment: github-pages`; `actions/deploy-pages`. Permissions are set per job: `contents: read` for build, `pages: write` and `id-token: write` for deploy only.
- The `deploy` job has `concurrency: { group: pages, cancel-in-progress: false }`, so a running deploy finishes. The workflow's own concurrency group is per ref, as in `ci.yml`, so one pull request's build never waits on or cancels another's.

The repository's Pages source must be set to GitHub Actions once, by hand (task 1.9). The workflow uses the official `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages`, pinned to major versions as `ci.yml` pins its actions.

### D4. Search
Starlight's built-in Pagefind, unchanged. The index is built into `dist/pagefind/` at build time and runs in the browser, so search works on Pages and on `astro preview` with no service. The generated changelog (D9) is indexed like any page.

### D5. `llms.txt`
`starlight-llms-txt` publishes `/ai-ledger/llms.txt` (an index with the project description and links), `/ai-ledger/llms-full.txt` (every page's text) and `/ai-ledger/llms-small.txt` (the plugin's trimmed variant). Configured with the project name and a one-paragraph description. Through the plugin's ordering options (`promote`), `llms-full.txt` puts the playbooks before the reference, the order an agent helping a user would want; when the pinned version lacks them, the sidebar order is kept. Rejected: a hand-written `llms.txt` (drifts from the pages).

### D6. Link validation
`starlight-links-validator` with its defaults: a link to a page or heading anchor that does not exist fails `astro build`, and so fails `check` and CI. External links are not fetched; they are not part of the build's correctness and would make it flaky.

### D7. Content layout and sidebar
Content lives in `site/src/content/docs/`. The sidebar is written out in `astro.config.mjs`, item by item, not autogenerated, so its order is the one below and a new file does not appear in it by accident.

| Sidebar group | Directory | Pages (slug) |
| --- | --- | --- |
| Home | `index.mdx` | `/` |
| Get started | `start/` | `install`, `first-tour`, `upgrade` |
| Improve your workflow | `improve/` | `weekly-review`, `spend-less`, `plan-limits`, `lean-context`, `tool-failures`, `babysit-less`, `finish-sessions`, `project-retro`, `compare-sources`, `automated-sessions`, `share-screen` |
| Pages | `pages/` | `activity`, `cost`, `context`, `errors`, `limits`, `insights`, `live`, `project` |
| Everywhere | `everywhere/` | `command-palette`, `context-menu`, `filters`, `keyboard-screen-reader`, `data-tables` |
| Concepts | `concepts/` | `how-it-works`, `cost-estimates`, `windows`, `privacy-security` |
| Reference | `reference/` | `cli`, `configuration`, `glossary`, `storage`, `troubleshooting` |
| Changelog | generated `changelog.md` | `changelog` |

The Home page uses Starlight's splash template, the tour GIF (D10) and three `LinkCard`s: Start (`start/install`), Improve (`improve/weekly-review`), Look up (`pages/activity`).

Rejected: one Starlight group per Diátaxis quadrant with nested playbooks (the brief's order puts Pages and Everywhere between them, and two levels of nesting hide the playbooks).

### D8. Playbooks and the reference link to each other
Every file in `improve/` has exactly these `##` headings, in this order: `Goal`, `Signs you need it`, `Diagnose`, `Act`, `Verify`, `Related`. `site/scripts/check-playbooks.mjs` reads each file's `##` headings and fails `check` when one is missing, extra or out of order; it names the file and the heading. The template and the writing rules (each claim names a page and a figure the app shows; Act gives a concrete snippet, setting or habit; Verify names the metric and the number of days) are in `site/README.md`, the authors' guide.

The metric-to-action mapping lives in the Metric glossary (`reference/glossary`): each metric names the page that shows it and, where one exists, the playbook that acts on it. Each Pages page ends with links to the playbooks that start from it. This keeps the sidebar to the eleven playbooks.

### D9. Repo files the site reads: `scripts/sync.mjs`
One script, run before `dev`, `build`, `preview` and `check`, prepares the files the site takes from the repo. Its outputs are git-ignored, so there is one copy of each in git.

- **Changelog.** Reads `../CHANGELOG.md`, drops its `# Changelog` heading, adds front matter (`title: Changelog`), rewrites repo-relative links (`docs/guide.md`, `CONTRIBUTING.md`) to `https://github.com/nWidart/ai-ledger/blob/main/<path>`, and writes `src/content/docs/changelog.md`. The page is then an ordinary doc: in the sidebar, the search index, `llms-full.txt`, and the link check. Any later edit to `CHANGELOG.md` shows on the next build; the workflow's `paths` include it.
- **GIFs.** Copies `../docs/*.gif` into `public/media/`. `docs/*.gif` stays the only copy in git and stays at its path, so the raw GitHub URLs in published READMEs keep working.

Rejected for the changelog: importing `CHANGELOG.md` into an Astro page (the page leaves the docs collection, so the link check, `llms.txt` and the sidebar's current-page marking need special cases); a hand-kept copy (drifts). Rejected for the GIFs: hot-linking raw GitHub URLs (the site breaks when `main` moves the file, and the browser loads from a second origin); moving them into `site/` (breaks published READMEs).

### D10. Images and themes
`site/src/components/ThemedImage.astro` takes a dark and a light source and an `alt`, renders both, and shows one by Starlight's theme: `:root[data-theme="light"]` hides the dark one, otherwise the light one is hidden. Starlight sets `data-theme` from the user's toggle or the system setting, so the image follows the toggle, which a `<picture>` with `prefers-color-scheme` would not. The hidden image is `display: none`, so a screen reader reads one `alt`.

- GIFs come from `public/media/` (D9) by `BASE_URL`, as `<name>.gif` (dark) and `<name>-light.gif` (light).
- Screenshots are PNGs in `site/src/assets/shots/`, committed, as `<page>-<panel>.png` and `<page>-<panel>-light.png`, through Astro's image pipeline.
- Under `prefers-reduced-motion: reduce`, a GIF is replaced by the matching still screenshot of the same page.

Every image has an `alt` that says what it shows. Starlight's default theme colors are kept; any accent color added in `site/src/styles/custom.css` passes WCAG AA contrast in both themes.

### D11. Screenshots only from the demo store
`tools/demo/record.mjs` gains a `shots` mode (`node record.mjs shots [page...]`) that reuses its browser and scheme setup and writes the PNGs of D10 into `site/src/assets/shots/`, each cropped to one panel's locator. In this mode the script starts `serve.py` itself and stops it at the end, and exits with an error before taking any shot when port 8799 already answers. `serve.py` opens only `tools/demo/demo.duckdb` and ingests only `tools/demo/live/`, so a screenshot cannot come from a real store. The Live shots use `replay.py` as the Live GIF does. The existing GIF scenes keep their behavior. The steps (seed, then shots) are in `tools/demo/`'s header comment and `site/README.md`.

### D12. Reference pages from the specs
Each page under `pages/` and each Everywhere page carries `spec:` front matter naming the specs it was written from (`spec: [cost-dashboard]`), through a `docsSchema` extension in `src/content.config.ts`. The field is not rendered; it tells an author which spec to re-read when it changes, and drives the accuracy spot-check (task 9.4). Where a page and a spec disagree, the page follows the code, and the mismatch is reported so the spec is fixed in its own change.

### D13. `docs/guide.md` becomes a stub
Its content moves into the site (Pages, Everywhere, Configuration, Automated sessions). The stub keeps the title, one line pointing to the site, and the old `##`/`###` headings, each followed by one link to the site page that replaced it, so old links such as `docs/guide.md#configuration` (in READMEs on PyPI) land on a heading that sends the reader on.

### D14. Repo docs
- `pyproject.toml`: `Documentation = "https://nwidart.github.io/ai-ledger/"` in `[project.urls]`.
- `README.md`: links to the site where it now links to the guide; the GIF grid stays.
- `CHANGELOG.md`: `[Unreleased]` "Added" entry for the site.
- `AGENTS.md`: `cd site && npm run check` under Commands; a rule to update the docs site when user-visible behavior changes, next to the README rule.
- `CONTRIBUTING.md`: its "update `docs/guide.md`" line points to `site/` instead.

## Risks / Trade-offs

- **Pages may drift from the app** → reference pages name their specs (D12); the AGENTS.md rule makes docs part of a user-visible change; task 9.4 spot-checks.
- **Node 26 and Astro** → if the pinned Astro does not support Node 26, the scaffold step stops and reports instead of picking another Node version silently.
- **The sync step's outputs are not in git** → a fresh clone must run `sync` before `astro dev`; the npm scripts run it, so only a bare `npx astro dev` misses it.
- **Screenshots age as the app changes** → the shots mode re-records them all in one command; a page change that alters a panel re-records its shots in the same change.
- **Deploy needs a repository setting** → task 1.9; until it is set, the deploy job fails and the build job still guards pull requests.

## Open Questions

- Who sets the Pages source to GitHub Actions: it needs repository admin and cannot be done from a branch.
