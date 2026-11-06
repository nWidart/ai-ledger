# Proposal

## Why

Reaching a view that combines several filters takes many clicks today. To see Bash failures in one project for Codex over the last 7 days, the user switches page, picks the project, the source and the range one by one, then finds Bash in a drawer and opens its sheet. The URL already holds this whole view (page in the path, filters and the open sheet in the hash), so a keyboard palette can build it in one gesture without any new query engine.

## What Changes

- Add a command palette, opened with Cmd+K on macOS and Ctrl+K elsewhere, on every dashboard page, plus a button with the shortcut hint in the navigation.
- A small grammar with two sigils, in any order:
  - `#` narrows: project, source (Claude Code, Codex), range (7d, 14d, 30d, 90d, all) and automated sessions. Several `#` terms combine.
  - `>` goes or does, following the VS Code command convention: a page (`>errors`), an inspector (a tool such as `>bash`, an MCP server, a skill, a session, an error category), or a command (`>refresh`, `>copy link`). A commit holds at most one page and one sheet.
  - Order does not matter: `>errors #myproject` and `#myproject >errors` are the same.
  - Sigils are optional. Bare text searches every kind; each suggestion row shows its kind badge and the sigil it becomes.
- Examples:
  - `>errors` opens Errors and keeps the current filters.
  - `>errors #myproject` opens `/errors#project=myproject`.
  - `#myproject >bash` opens the Bash inspector on the current page, scoped to `myproject`.
  - `#myproject #codex #7d >cost` opens Cost with those three filters.
  - `>errors >bash` opens Errors, then the Bash inspector there.
  - `bash` alone lists every kind that matches.
- Picked suggestions become chips: filters on the left, the destination on the right. Backspace removes the last chip. Opening the palette on a filtered page pre-fills chips from the current view, so the palette also edits the filters in place.
- Suggestions narrow by the chosen facets. With `#myproject` chosen, tool rows list only tools used in that project, with their call count and failure rate, so the user sees whether a combination has data before pressing Enter.
- A footer states what Enter will do, for example "Enter: open Bash inspector · myproject · Claude Code · 30d". Tab adds the highlighted suggestion as a chip; Esc closes.
- One commit writes the URL once and adds one history entry, so Back undoes the whole commit.
- Clash rules:
  - Two pages: the last one wins, and its chip shows the replacement.
  - Single-valued filters (project, source, range): the last one wins.
  - A sheet that lives on one page implies that page. `>timeout` (an error category) opens Errors, and the footer says so.
  - A `>` sheet without a page stays on the current page when that page hosts the sheet, and otherwise goes to Activity.
- `#bash` (a tool used as a filter) is not supported. The palette suggests "Bash · open inspector (>)" instead. `#tool` stays reserved for the parked `add-tool-filter` change.
- The palette is fully usable by keyboard and by screen reader, with combobox and listbox semantics.

Non-goals: filtering pages by tool (see `openspec/changes/add-tool-filter`), and selecting more than one project at once.

## Capabilities

### New Capabilities
- `command-palette`: the Cmd+K palette: how it opens, its `#`/`>` grammar, suggestions and their facet narrowing, chips and pre-fill from the current view, the Enter footer, clash rules, history behavior, commands, and keyboard and screen-reader access.

### Modified Capabilities

None. The palette only writes URL state the pages already read: the shared filters (`dashboard-app`), the inspector sheets (`tool-inspector`) and the Errors and Activity sheets keep their current requirements. The navigation keeps its entries and filter carry-over; the palette button it gains is specified in `command-palette`.

## Impact

- `web/src/components/`: new palette component (input, chips, suggestion list, footer) and its global shortcut, mounted once for every page.
- `web/src/hash.ts`: reused to read the current view for pre-fill and to write the committed view as one history entry; no new hash keys.
- `web/src/components/Nav.tsx`: palette button with the shortcut hint.
- Suggestion data: projects, tools, MCP servers, skills and error categories with counts for the current facets, and session search through `/api/sessions?q=`. Whether this needs a small suggestion endpoint in `app.py` and `metrics.py` is left to design.
- Page tests for the palette, and fixtures in `web/src/__fixtures__/` if a payload is added.
- `web/dist/` rebuilt and committed with the `web/src` change.
- `README.md`: document the palette, its shortcut and its grammar.
- No new dependency, no schema change, no rebuild.
