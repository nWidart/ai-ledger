# AI Ledger docs site

The documentation site at <https://nwidart.github.io/ai-ledger/>, built with [Starlight](https://starlight.astro.build/). It is its own npm project: it shares nothing with `web/` (the app), and nothing here enters the Python package.

## Run it

Needs Node 26, the version CI uses.

```bash
cd site
npm ci
npm run dev       # http://localhost:4321/ai-ledger/
npm run check     # what CI runs: sync, playbook check, astro check, build with link check
npm run preview   # serves the last build from dist/, search included
```

Every script runs `npm run sync` first. It writes two things from the repo, both git-ignored: `src/content/docs/changelog.md` from `../CHANGELOG.md`, and `public/media/*.gif` from `../docs/*.gif`. A bare `npx astro dev` skips it, so use the npm scripts. Never edit or commit those outputs: change `CHANGELOG.md` or `docs/*.gif` instead.

`npm run check` fails on:

- a link to a page or heading anchor of the site that does not exist;
- a playbook that does not follow the template below;
- a type error in a component or the configuration.

## Where things go

| Path | What |
| --- | --- |
| `astro.config.mjs` | Site URL and base, the sidebar (written out item by item), plugins. |
| `src/content/docs/` | The pages, one directory per sidebar group: `start/`, `improve/`, `pages/`, `everywhere/`, `concepts/`, `reference/`. |
| `src/content.config.ts` | The front matter schema: Starlight's, plus `spec`. |
| `src/components/ThemedImage.astro` | An image in dark and light variants. |
| `src/assets/shots/` | Screenshots, recorded from the demo store. |
| `src/styles/custom.css` | Site styles on top of Starlight's theme. |
| `scripts/sync.mjs` | Copies the changelog and the GIFs in (see above). |
| `scripts/check-playbooks.mjs` | The playbook template check. |

A new page is not in the sidebar until you add it to `sidebar` in `astro.config.mjs`.

## Links

Link between pages with absolute paths that include the base and end in a slash: `[Cost](/ai-ledger/pages/cost/)`, `[Configuration](/ai-ledger/reference/configuration/#prices)`. The build checks every such link and anchor. In a component, build URLs from `import.meta.env.BASE_URL`, never from a literal `/`.

## Reference pages follow the specs

`openspec/specs/` is the source of truth for what the app does. Each page under `pages/` and `everywhere/` names the specs it was written from in its front matter:

```yaml
---
title: Cost
description: Estimated spend at API list prices, per project, model and session, compared with your plan.
spec: [cost-dashboard]
---
```

When a spec changes, re-read the pages that name it. When a page and its spec disagree, the spec wins: fix the page. A change to user-visible behavior updates the pages in the same change.

## Playbooks

Every page in `improve/` has exactly these `##` headings, in this order, and no other `##` heading:

```md
## Goal
One sentence: what gets better.

## Signs you need it
The page and the figure to check, and the value that means this playbook applies.

## Diagnose
How to find the cause in the data: which panel, filter or sheet to open, and what to look for.

## Act
A concrete change: a CLAUDE.md or AGENTS.md snippet, a setting, or a habit.

## Verify
The figure that should move, in which direction, and over how many days.

## Related
Links to the Pages and Concepts pages it builds on.
```

Use `###` inside a section when you need structure. Writing rules:

- Every claim names a page and a figure the app shows. If the app does not show it, leave it out.
- Act gives something to paste, set or do, not advice.
- Verify names the metric and the number of days to wait.
- Check each figure against the page's specs before you commit.

The Metric glossary (`reference/glossary`) maps each metric to the page that shows it and the playbook that acts on it. Each page under `pages/` ends with links to the playbooks that start from it.

## Images

Every image has an `alt` that says what it shows. Use `ThemedImage` for anything that differs between themes; it shows the variant for the reader's theme and announces one `alt`.

```mdx
import ThemedImage from "../../../components/ThemedImage.astro";
import costSpend from "../../../assets/shots/cost-spend.png";
import costSpendLight from "../../../assets/shots/cost-spend-light.png";

<ThemedImage dark={costSpend} light={costSpendLight} alt="Cost's spend chart: daily estimated spend by model over 30 days." />

<ThemedImage gif="cost" width={960} height={600} dark={costSpend} light={costSpendLight} alt="…" />
```

- Screenshots are PNGs in `src/assets/shots/`, named `<page>-<panel>.png` (dark) and `<page>-<panel>-light.png` (light).
- GIFs are `docs/<name>.gif` and `docs/<name>-light.gif` in the repo, used by name (`gif="cost"`). With `dark` and `light` stills as well, the stills replace the GIF when the reader asks for reduced motion.

### Screenshots come only from the demo store

Never take a screenshot of your own store: it holds your transcripts, and any secret in them. Every screenshot comes from the synthetic store in `tools/demo/`:

```bash
uv run tools/demo/seed.py                 # build the synthetic store
cd tools/demo && npm ci
node record.mjs shots [page...]           # write the PNGs into site/src/assets/shots/
```

The `shots` mode starts the demo server itself, refuses to run when port 8799 already answers, and stops the server when it is done. See the header of `tools/demo/record.mjs` for its options. When a change alters a panel, re-record its shots in the same change.

## Deploy

`.github/workflows/docs.yml` runs `npm run check` on every pull request that touches `site/`, `docs/*.gif`, `CHANGELOG.md` or the workflow, and deploys `dist/` to GitHub Pages from `main`. Pull requests never deploy.
