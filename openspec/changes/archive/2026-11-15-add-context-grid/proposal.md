# Proposal

## Why

The Context block of the Project page lists five figures, but it does not show how full a session's window gets. Claude Code users know the grid that `/context` prints: one cell per slice of the window, coloured by what fills it, with a legend of tokens and percentages. The same picture, drawn from the store, shows at a glance how much of the window a typical session of the project starts with and how much it uses by its peak.

## What Changes

- The Context block of the Project page opens with a grid of 200 cells, ten rows of twenty, each cell half a percent of the context window, in the style of `/context`. The cells show the project's median starting context, the median context added by the peak and the free space left at the peak. A legend beside the grid gives each part's tokens and share of the window, and a heading names the most common window and the sessions measured.
- The transcripts do not record what makes up the prompt (system prompt, tools, MCP servers, memory, skills), so the grid shows the starting context as one part and says so.
- The Context payload gains the median peak context of the view's sessions, in tokens and as a share of the window, and the most common window of the sessions with a measured start.
- The block keeps its five figures below the grid. With no known window, the grid is left out.

## Impact

- `src/ai_ledger/context.py`: `starting.window` and `growth.peak`.
- `web/src/api.ts`, `web/src/pages/project/`: the grid and its legend.
- Spec: `project-page`.
