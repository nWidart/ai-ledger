# Proposal

## Why

The docs site's Home page is the project's landing page, and the conversion it should drive is an install. Today it does not: the large heading is the product name, the tagline never names Claude Code or Codex, there is no install button and no install command above the fold, the body lists page names rather than the questions they answer, nothing answers the first objection to a tool that reads every transcript (is my data safe?), and the tour GIF, the first thing on screen, is lazy-loaded. (A GIF loaded eagerly would download both theme variants, 11 MB, so the fix is a smaller format, left for later.)

## What Changes

- The hero heading becomes "See what Claude Code and Codex did, what it cost, and where they got stuck.", with a tagline that says what AI Ledger is, that it is free and open source, and that transcripts stay on the machine.
- The hero offers a primary "Install with one command" action that jumps to the install command, and a secondary GitHub action.
- The `uvx ai-ledger` command sits right under the hero, with what it needs (uv, macOS or Linux) and how long the first read takes.
- New sections: "Questions it answers" (six cards, one per dashboard question), "Keep the history your agents throw away", "Built for a file full of secrets" (the privacy model in plain terms), a short FAQ, and a closing install command.
- The Start, Improve and Look up cards stay, below the closing install command.
- `README.md` opens with the same heading.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `documentation-site`: the Home page scenario changes, and a requirement for the Home page's install path and privacy answer is added.

## Impact

- `site/src/content/docs/index.mdx`, `site/src/styles/custom.css`, `README.md`.
- No app, payload, store or API change.
