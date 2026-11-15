# Proposal

## Why

AI Ledger's documentation is a README and one long file, `docs/guide.md`. The guide says what each page shows, but not what to do with it: a user who sees a 70% cache hit or a context that fills in twelve turns has no path from the figure to a change in how they work. The guide has no search, no structure past one page, and nothing a coding agent can read in one fetch. As pages grow (Context, Project, the context menu), one file no longer holds them well.

A documentation site fixes this. It splits the docs by what the reader came for (learn, improve, look up, understand), adds goal-first playbooks that tie each metric to an action, and stays in step with the app because its reference pages are written from `openspec/specs/`.

## What Changes

- **A Starlight site in `site/`.** Its own npm project, separate from `web/` (the app), with exact dependency versions and the Node version CI uses for `web/`. It has light and dark themes, works by keyboard and screen reader, and has Starlight's built-in Pagefind search, which runs in the static site with no hosted service.
- **Hosted on GitHub Pages** at https://nwidart.github.io/ai-ledger. A new workflow builds the site on pull requests that touch it and deploys it from `main` with the official Pages actions.
- **Built for agents too.** The build publishes `llms.txt` and a full variant, through a maintained Starlight plugin, so a user's coding agent can read the docs.
- **Links are checked.** A broken internal link fails the build.
- **Diátaxis structure**, in this sidebar order:
  1. Home: what AI Ledger does, the tour GIF, and three cards: Start, Improve, Look up.
  2. Get started (tutorials): Install and first run; 15-minute first tour; Upgrade and rebuild.
  3. Improve your workflow (playbooks), eleven pages: Weekly 15-minute review; Spend less for the same output; Stop hitting plan limits; Keep context lean; Kill repeated tool failures; Babysit agents less; Get sessions to finish; Retro on one project; Compare Claude Code and Codex; Separate automated sessions from yours; Share your screen safely.
  4. Pages (reference): Activity, Cost, Context, Errors, Limits, Insights, Live, Project.
  5. Everywhere: command palette syntax, context menu, filters, keyboard and screen reader use, data tables.
  6. Concepts (explanation): How AI Ledger works; How cost is estimated; Context windows and plan limit windows; Privacy and security model.
  7. Reference: CLI and options; Configuration; Metric glossary; Data files and storage locations; Troubleshooting and FAQ.
  8. Changelog, rendered from `CHANGELOG.md` at build time.
- **Playbooks share one template**: Goal, Signs you need it, Diagnose, Act, Verify, Related. Every claim in a playbook is something the app shows.
- **Content rules.** `openspec/specs/` stays the source of truth for app behavior. Every screenshot comes from the synthetic demo store in `tools/demo/`, never from a real store. The GIFs in `docs/*.gif` stay where they are, because READMEs already on PyPI link to their raw GitHub URLs.
- **`docs/guide.md` folds into the site** and becomes a short stub that keeps its old headings, each linking to the site page that replaced it.
- **Repo docs.** `pyproject.toml` gains a `Documentation` URL; `README.md` links to the site; `CHANGELOG.md` gets an `[Unreleased]` entry; `AGENTS.md` gets the site's check command and a rule to update the docs when user-visible behavior changes.

## Capabilities

### New Capabilities
- `documentation-site`: the public documentation site: how it builds and deploys, its structure and sidebar order, the playbook template, search, `llms.txt`, link checking, themes and accessibility, where its screenshots and GIFs come from, the changelog page, and where the repo links to it.

### Modified Capabilities
None. The app's behavior does not change.

## Impact

- New `site/`: Starlight project (`package.json`, lock file, `astro.config.mjs`, content in `src/content/docs/`, components, styles, scripts).
- New `.github/workflows/docs.yml`: build on pull requests, deploy from `main`.
- `tools/demo/`: a screenshot mode that writes PNGs into the site.
- `docs/guide.md`: becomes a stub. `docs/*.gif` unchanged.
- `README.md`, `CHANGELOG.md`, `AGENTS.md`, `CONTRIBUTING.md`, `pyproject.toml`.
- One-time repository setting: Pages source set to GitHub Actions.
- No change to `src/ai_ledger/`, `web/`, the store or any payload.
- Out of scope: versioned docs, translations, a custom domain, hosted search, analytics.
