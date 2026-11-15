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

Every script runs `npm run sync` first. It writes two things from the repo, both git-ignored: `src/content/docs/changelog.md` from `../CHANGELOG.md`, and `public/media/`, holding the `../docs/*.gif` files a page names with `gif="…"` (and their `-light` variants). A bare `npx astro dev` skips it, so use the npm scripts. Never edit or commit those outputs: change `CHANGELOG.md` or `docs/*.gif` instead.

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
| `src/styles/custom.css` | The theme: the app's tokens mapped onto Starlight's, and a few element styles. See "Theme" below. |
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

When a spec changes, re-read the pages that name it. When a page and its spec disagree, read the code: the page follows the code, and the mismatch is reported so the spec gets fixed in its own change. A change to user-visible behavior updates the pages in the same change.

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

Use `###` inside a section when you need structure. `npm run check` fails on a missing, extra or misplaced `##` heading.

### The method

A playbook is a how-to guide: the reader has a goal and knows the app. Write each section to this checklist.

**Goal**

- One sentence. Name the figure that moves and its direction: "Sessions start with less context", not "Understand context".

**Signs you need it**

- One to five signs. Each names a page, a panel and a figure, in the words the app shows, and the value that means "this playbook applies".
- Use the threshold the app itself uses where one exists: a tip's rule, a Needs attention line, a Watch or Act mark, the Limits alert. Say that it is the app's.
- When you set a value of your own, start the sentence with "Rule of thumb:".
- Prefer a sign the app raises by itself (a tip, a mark, a dot) over one the reader must compute.
- Say which neighbouring signs belong to another playbook, with a link.

**Diagnose**

- Numbered steps, six at most. Each step says where to go (page, panel, sheet, filter or range) and what to look for there.
- End with a table: what you see, the cause, the Act subsection that fixes it. A playbook with one cause needs no table.
- Send the reader to no step that does not change what they do next.

**Act**

- One `###` per cause. Each gives one of these, and nothing softer:
  - a snippet to paste into `CLAUDE.md` or `AGENTS.md`, in a code block, with the file it goes in;
  - a setting, with the file and the key;
  - a command, in a code block;
  - a habit with a trigger: "When the meter turns to the warning color, run `/compact`."
- No "consider", "try to" or "be mindful of". When you cannot name what to paste, set, run or do, the playbook is not ready.
- Give the Claude Code and the Codex variant where they differ. Name a real-world case that changes the step (a file shared in git, a tool the agent lacks).

**Verify**

- Name four things: the figure, the direction it moves, the days to wait, and where to read it.
- The app has no custom date range. So either use a figure the app compares for you (the previous period of equal length, a weekly series, **Before and after the fix**), or tell the reader to note the figure before they act and to read it again with the range set to the days they waited.
- Give a same-day check when one exists.
- Say what to do when the figure did not move.

**Related**

- Three to seven links: the Pages pages the playbook reads, the Concepts page that explains why, the playbook to open next.

**Tone**

- Conditional imperatives: "If the tip fires, open …", "To find the server, select …".
- Do not teach. One clause of reminder at most, then a link to Concepts or the [Metric glossary](src/content/docs/reference/glossary.md).
- Use the app's own words, and put its labels in bold: **Needs attention**, **Added per prompt**.
- Mark every example value as an example.

**Check before you commit**

- Check every label against `web/src/` and every threshold, cap and definition against `src/ai_ledger/`, then against `openspec/specs/`. The pages under `pages/` are a map, not the source.
- Write what the app does. When the code and a spec disagree, the code is what the reader sees: follow it, and report the difference.
- Give the page alone to a fresh reader with these questions: "Does this apply to me?", "What exactly do I change?", "How do I know it worked?". Fix the page until the reader answers each.

Worked examples: `improve/lean-context.mdx` for a playbook with several causes, and `improve/weekly-review.md` for a routine, where Diagnose is the pass over the pages and Act sends the reader to one other playbook.

### The metric-to-action mapping

The Metric glossary (`reference/glossary`) maps each figure to the page that shows it and the playbook that acts on it. A new playbook adds its figures to the glossary's Playbook column. Each page under `pages/` ends with links to the playbooks that start from it.

## Images

Every image has an `alt` that says what it shows. Use `ThemedImage` for anything that differs between themes; it shows the variant for the reader's theme and announces one `alt`.

```mdx
import ThemedImage from "../../../components/ThemedImage.astro";
import costSpend from "../../../assets/shots/cost-spend.png";
import costSpendLight from "../../../assets/shots/cost-spend-light.png";
import tourStill from "../../../assets/shots/tour-overview.png";
import tourStillLight from "../../../assets/shots/tour-overview-light.png";

<ThemedImage dark={costSpend} light={costSpendLight} alt="Cost's spend chart: daily estimated spend by project over 30 days." />

<ThemedImage gif="tour" width={960} height={600} dark={tourStill} light={tourStillLight} alt="…" />
```

- Screenshots are PNGs in `src/assets/shots/`, named `<page>-<panel>.png` (dark) and `<page>-<panel>-light.png` (light). Astro serves them optimized.
- GIFs are `docs/<name>.gif` and `docs/<name>-light.gif` in the repo, used by name (`gif="cost"`). With `dark` and `light` stills as well, the stills replace the GIF when the reader asks for reduced motion. The home page's tour GIF has `tour-overview` as its still.
- A page that shows an image is an `.mdx` file (the component needs it). In `.mdx`, a `<` or `{` in prose starts JSX: write `\<project>` or `\{name}`, or put the text in backticks. Put the imports where the first image is needed, not in front matter.
- Add an image only where a picture shows the figure the reader must find. A shot no page uses is deleted (see `src/assets/shots/README.md`).

### Screenshots come only from the demo store

Never take a screenshot of your own store: it holds your transcripts, and any secret in them. Every screenshot comes from the synthetic store in `tools/demo/`:

```bash
uv sync                                   # once: the app, which seed.py and serve.py import
(cd site && npm ci)                       # once: sharp, which quantizes each PNG
cd tools/demo && npm ci                   # once: Playwright (`npx playwright install chromium` if it has no browser yet)
node record.mjs shots [page...]           # write the PNGs into site/src/assets/shots/
node record.mjs quantize                  # re-encode the PNGs already there, without recording
```

The `shots` mode seeds the demo store (`seed.py`), starts the demo server itself, and stops it when it is done. It refuses to run when port 8799 already answers, before any shot. Pages: `activity cost context errors limits insights project live everywhere`; with none named it records all (about 4 minutes). `site/src/assets/shots/README.md` lists every shot. See the header of `tools/demo/record.mjs` for its options. When a change alters a panel, re-record its shots in the same change.

## Theme

The site looks like the app. `src/styles/custom.css` copies the app's color tokens from `web/src/theme.css` under an `--ai-` prefix, each a `light-dark()` pair, and maps them onto Starlight's `--sl-color-*` properties. A few element styles follow: the title bar, sidebar, search, asides, cards and the focus ring. The font is IBM Plex Sans from `@fontsource/ibm-plex-sans`, served by the site itself. The logo and favicon are the app's mark.

- When the app's palette changes, change the tokens here in the same change. The two share no build.
- Style with tokens and CSS. Override a Starlight component only when CSS cannot do the job.
- Every text, link and control state passes WCAG AA in both themes. Check a new color against its background before you add it. `openspec/changes/archive/*-add-docs-theme/design.md` lists the current ratios.
- Load no font or stylesheet from a third party.

## Deploy

`.github/workflows/docs.yml` runs `npm run check` on every pull request that touches `site/`, `docs/*.gif`, `CHANGELOG.md` or the workflow, and deploys `dist/` to GitHub Pages from `main`. Pull requests never deploy.
