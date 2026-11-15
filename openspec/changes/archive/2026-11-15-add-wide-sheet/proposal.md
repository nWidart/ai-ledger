# Proposal

## Why

The inspector sheet is 640px wide. That suits the project sheet, which is a quick look and has the Project page behind it. It is tight for the two sheets that hold the most detail. The session sheet draws a whole session's timeline in about 600px, so a long session is a dense strip. The tool sheet has nine sections, and its Inputs and Recent calls tables hold long commands and paths that wrap over many lines.

A centered modal was considered and rejected: the sheet already is a modal `<dialog>` with focus return, Back handling and URL state, so a modal gains nothing over a wider sheet.

## What Changes

- **Wide toggle.** The session sheet and the tool, MCP server and skill sheet gain a "Wide" toggle button in the sheet head. Wide makes the sheet up to 1100px, capped at the viewport. Pressing it again makes the sheet narrow.
- **Per browser.** The choice is saved in the browser, like the theme, and applies to both sheet kinds on every page and later visit. It is not in the URL.
- **Wide layout.** The session timeline spans the wide sheet and its plot is taller. Short sections sit side by side when the sheet has room for two columns: calls per day beside where the subject is used, failures by type beside recovery and error loops, and a session's models beside its tools. The Inputs and Recent calls tables span the sheet.
- **Project sheet unchanged.** It stays narrow and has no toggle.
- **Narrow screens.** On a viewport no wider than the narrow sheet the toggle is not shown, because it would change nothing. The saved choice is kept.
- No payload change, no new URL key.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `dashboard-app`: the sheet has a wide mode for the session and tool sheets, saved per browser, with an accessible toggle.
- `tool-inspector`: what the inspector does with the room of a wide sheet.
- `usage-dashboard`: what the session sheet does with the room of a wide sheet.

## Impact

- `web/src/sheetWide.ts` (new): the saved choice.
- `web/src/components/Sheet.tsx`, `Sheet.css`, `web/src/theme.css`: the toggle, the wide width, forced colors.
- `web/src/components/sheets/UsageSheets.tsx`, `ToolSheet.tsx`, `SessionSheet.tsx`, `session.ts`, `sheets.css`: which sheets offer wide, and the wide layout.
- Tests beside those files. `src/ai_ledger/web/` rebuilt. `docs/guide.md`, `CHANGELOG.md`.
- Out of scope: a `/session/<id>` page, the project sheet, the Project page, new metrics.
