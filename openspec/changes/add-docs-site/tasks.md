# Tasks

Group 1 has no dependency. 2, 3, 4, 7 and 8 need 1. 5 needs 3 and 4 (playbooks link to Pages and Concepts). 6 needs 5 (it follows the method 5 sets). 9 needs all others. Each group touches its own files: 2 to 6 write only their own pages under `site/src/content/docs/`, 7 writes only `tools/demo/` and `site/src/assets/shots/` and never edits pages, 8 only repo docs. Section 9 puts section 7's shots into the pages.

## 1. Scaffold

- [x] 1.1 `site/package.json`: Astro, `@astrojs/starlight`, `starlight-links-validator`, `starlight-llms-txt`, `@astrojs/check`, `typescript`, all exact versions; `engines.node` the Node major CI uses for `web/` (26); scripts `sync`, `dev`, `build`, `preview`, `check` as design D1. Commit `package-lock.json`. If the pinned Astro does not support that Node version, stop and report.
- [x] 1.2 `astro.config.mjs`: `site: "https://nwidart.github.io"`, `base: "/ai-ledger"`, `trailingSlash: "always"`; Starlight with the title, the GitHub social link, an edit link to `site/` on `main`, `customCss`, and the plugins of 1.5 and 1.6.
- [x] 1.3 Sidebar written out item by item in the order and with the slugs of design D7. Every page exists as a stub with its title and a one-line description, so the build and link check pass from the start.
- [x] 1.4 `src/content.config.ts`: Starlight's `docsSchema` extended with an optional `spec: string[]` (design D12).
- [x] 1.5 `starlight-llms-txt` with project name and description; check `dist/llms.txt` and `dist/llms-full.txt` after a build.
- [x] 1.6 `starlight-links-validator`; verify a deliberately broken link and a broken anchor fail `astro build`, then remove them.
- [x] 1.7 `scripts/sync.mjs` (design D9): changelog page from `../CHANGELOG.md` with its links rewritten, GIFs copied to `public/media/`; both outputs in `site/.gitignore`. `scripts/check-playbooks.mjs` (design D8), failing on a missing, extra or out-of-order `##` heading in `improve/*`, naming file and heading. While playbooks are stubs, each stub carries the six headings.
- [x] 1.8 `src/components/ThemedImage.astro` and `src/styles/custom.css` (design D10): theme switching by `data-theme`, one `alt` announced, the reduced-motion still, `BASE_URL` paths. Home page (`index.mdx`): splash, the tour GIF, three `LinkCard`s.
- [x] 1.9 `.github/workflows/docs.yml` (design D3). Note in the step report that the repository's Pages source must be set to GitHub Actions by an admin.
- [x] 1.10 `site/README.md`: how to run, the check, the playbook template and writing rules, the screenshot steps, and that reference pages follow `openspec/specs/`.
- [x] 1.11 `cd site && npm run check` passes; Pagefind search works on `npm run preview`; light and dark both render.

## 2. Port the user guide

- [ ] 2.1 Everywhere pages from `docs/guide.md` "Everywhere" and the specs (`command-palette`, `context-menu`, `dashboard-app`): `command-palette` (syntax: `>page`, `#project`, ranges, examples), `context-menu` (per target, Shift+F10, menu key, long press), `filters` (project picker, range, source, Include automated, with the "Automated sessions" section of the guide), `keyboard-screen-reader`, `data-tables`. Each with `spec:` front matter.
- [ ] 2.2 `reference/configuration` from the guide's Configuration, Prices, Plans and Automated projects sections, with the file locations and the reload rule.
- [ ] 2.3 The other Reference pages, from `README.md`, `src/ai_ledger/` (`--help`) and the `distribution` and `transcript-store` specs: `reference/cli` (commands and options), `reference/storage` (store and configuration locations on macOS and Linux, `--db`), `reference/troubleshooting` (port in use, `localhost` against `127.0.0.1`, ingest and rebuild need the app stopped, the Context figures unavailable before `rebuild`).
- [ ] 2.4 `docs/guide.md` becomes the stub of design D13: title, one line to the site, the old headings each with one link to its new page.
- [ ] 2.5 `npm run check` passes.

## 3. Dashboard reference pages

- [ ] 3.1 Write `pages/activity`, `cost`, `context`, `errors`, `limits`, `insights`, `live`, `project` from their specs (`usage-dashboard`, `cost-dashboard`, `context-dashboard`, `errors-dashboard`, `limits-dashboard` and `plan-limits`, `insights-dashboard` and `session-insights`, `live-dashboard` and `live-sessions`, `project-page`), starting from that page's section in `docs/guide.md` as it stands at the change's base commit (`git show 37eeee8:docs/guide.md`). Each page: what it answers, its panels in page order, its filters, its sheets, what each figure means, and `spec:` front matter.
- [ ] 3.2 Each page ends with "Playbooks that start here", linking the playbooks of section 5 and 6 that start from it (stub links are fine until they are written).
- [ ] 3.3 Screenshot slots use `ThemedImage` with the file names section 7 will write; until then, no image, no broken path.
- [ ] 3.4 `npm run check` passes.

## 4. Concepts and tutorials

The Get started tutorials sit here: like the concepts, they are written from the README and the specs, and they link to the Pages stubs of section 1.

- [ ] 4.1 `start/install`: install with `uvx`, the first run, the first ingest (about 4 minutes for 3.4 GB of transcripts), and what the reader sees when it is done.
- [ ] 4.2 `start/first-tour`: a 15-minute tour that reads each page once with the reader's own data, one stop per page, each linking its Pages page.
- [ ] 4.3 `start/upgrade`: upgrading, and when and how to run `ai-ledger rebuild` with the app stopped.
- [ ] 4.4 `concepts/how-it-works`: sources (Claude Code, Codex transcripts), ingest and the first ingest's duration, 60-second polling, derived tables and when `rebuild` is needed, from `transcript-store`, `codex-transcripts` and `dashboard-app`.
- [ ] 4.5 `concepts/cost-estimates`: API list prices applied to tokens, cache reads and writes, how that compares with a subscription plan, and what the estimate leaves out; from `cost-dashboard` and the price files.
- [ ] 4.6 `concepts/windows`: a model's context window against a plan's 5-hour and weekly limit windows, and which pages show each; from `context-dashboard`, `plan-limits`, `limits-dashboard`.
- [ ] 4.7 `concepts/privacy-security`: everything local, the store holds full transcripts with any secrets in them, the server binds to 127.0.0.1, what never leaves the machine, and what to check before sharing a screen; from `dashboard-app` and the server hardening in the specs.
- [ ] 4.8 `npm run check` passes.

## 5. Playbook method and the first two playbooks

- [ ] 5.1 Metric glossary (`reference/glossary`): every figure the pages show, its definition, the page that shows it, and the playbook that acts on it (design D8).
- [ ] 5.2 `improve/weekly-review`: a 15-minute routine across Activity, Cost, Context, Errors, Limits, Insights and Live, each stop naming the figure to look at and the playbook to open when it is off.
- [ ] 5.3 `improve/lean-context`: Context page fill, growth per turn, what fills context, CLAUDE.md and MCP overhead; Act with a CLAUDE.md snippet and MCP pruning; Verify with starting context and turns to first compaction over 7 days.
- [ ] 5.4 Each claim in 5.2 and 5.3 checked against its spec; `npm run check` passes (the playbook check included).

## 6. The other nine playbooks

- [ ] 6.1 `spend-less` (Cost: model mix, cache hit, expensive sessions, plan fit).
- [ ] 6.2 `plan-limits` (Limits: what used the window, forecast, pacing).
- [ ] 6.3 `tool-failures` (Errors: error types, loops; fix snippets for CLAUDE.md and AGENTS.md).
- [ ] 6.4 `babysit-less` (Live, Activity's "needs attention").
- [ ] 6.5 `finish-sessions` (Insights: outcomes, friction).
- [ ] 6.6 `project-retro` (Project page).
- [ ] 6.7 `compare-sources` (the source filter across pages).
- [ ] 6.8 `automated-sessions` (Include automated, automated projects configuration).
- [ ] 6.9 `share-screen` (what the pages reveal, project filter, muting, what to close first).
- [ ] 6.10 Each claim checked against its spec; `npm run check` passes.

## 7. Screenshots

- [ ] 7.1 `tools/demo/record.mjs`: a `shots` mode (design D11) that starts `serve.py`, refuses when 8799 already answers, writes `site/src/assets/shots/<page>-<panel>.png` and `-light.png` cropped to each panel, and stops the server. Live shots use `replay.py`. The GIF scenes are unchanged. Update the header comment.
- [ ] 7.2 Seed (`uv run tools/demo/seed.py`) and record every shot the pages, concepts and playbooks reference, plus the reduced-motion stills for each GIF used on the site.
- [ ] 7.3 Check that no shot shows anything but demo data (project names from `seed.py`); `npm run check` passes.

## 8. Repo docs

- [ ] 8.1 `pyproject.toml`: `Documentation = "https://nwidart.github.io/ai-ledger/"` in `[project.urls]`.
- [ ] 8.2 `README.md`: link to the site where it links to `docs/guide.md`, and a Documentation link near the top; GIF grid unchanged.
- [ ] 8.3 `CHANGELOG.md`: `[Unreleased]` "Added" entry for the documentation site.
- [ ] 8.4 `AGENTS.md`: `cd site && npm run check` under Commands; a rule to update the docs site when user-visible behavior changes.
- [ ] 8.5 `CONTRIBUTING.md`: point its `docs/guide.md` line to `site/`.
- [ ] 8.6 `uv run ruff check`, `uv run python -m unittest discover -s tests` pass (no Python change expected).

## 9. Verify

- [ ] 9.1 Fill the image slots left by sections 3–6 with the shots from section 7; every image has an `alt`.
- [ ] 9.2 `cd site && npm run check` passes from a clean clone (`npm ci` first); the built `dist/` has `llms.txt`, `llms-full.txt` and `pagefind/`.
- [ ] 9.3 Link check: a broken link and a broken anchor fail the build; removing a Verify heading fails the playbook check.
- [ ] 9.4 Accuracy spot-check: for each `pages/` page and three playbooks, compare every figure named with its `spec:` specs; fix the page where they differ.
- [ ] 9.5 `npm run preview`: search offline, theme toggle with images, keyboard-only pass, reduced motion, a 390px viewport.
- [ ] 9.6 `openspec validate --specs --strict` and `openspec validate add-docs-site --strict` pass.
- [ ] 9.7 After the first deploy from `main`: `https://nwidart.github.io/ai-ledger/` and `/ai-ledger/llms.txt` load.
