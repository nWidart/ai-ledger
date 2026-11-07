# Proposal

**Status: parked.** Recorded during the command palette exploration (`add-command-palette`). Not scheduled. The open questions below need answers before anyone writes specs, design or tasks.

## Why

A tool is only a destination today. `>bash` in the palette, or `tool=Bash` in the hash, opens the tool inspector sheet for the current view, but the pages around it stay the same. A user who wants to know what Bash work costs, which projects lean on it, or what its failures look like next to everything else cannot narrow the pages to it the way they can narrow them to a project or a source.

## What Changes

- Add a tool, MCP server or skill as a page-wide filter, next to project and source. `#bash` narrows every page to the sessions or calls that involve Bash:
  - Activity: lead, problems, daily chart, drawers and sheets.
  - Cost: lead, per-project change, token and cost breakdowns.
  - Errors: categories, rate over time and examples.
  - Limits: in or out is undecided (see open questions).
- Add a shared hash key for the filter that travels between pages with `project`, `range`, `source` and `auto` (`SHARED_KEYS` in `web/src/hash.ts`). It must be distinct from the `tool`, `mcp` and `skill` sheet keys, which open the inspector and do not filter.
- Show the active filter as a chip with the other filters, removable in one click.
- The command palette reserves `#<tool>` for this filter. This change gives that syntax its meaning.

### Why it is parked

- Every query in `metrics.py` (and `limits.py`, if Limits joins) has to take the filter. That reaches every payload on every page, not one sheet.
- It needs a new shared hash key, separate from the `tool` sheet key, and the rules for carrying it between pages.
- Every API endpoint that takes the view filters (`/api/usage`, `/api/errors`, `/api/sessions`, `/api/session`, `/api/tool`, and `/api/limits` if Limits joins) has to accept it.
- `add-command-palette` ships tool-as-destination first, which covers the common need (look at one tool) without any of this.

### Open questions

- **Session-level or call-level.** Does a session that used Bash count in full, or only its Bash calls? Session-level is simple for Activity counts but inflates Cost. Call-level fits Errors but leaves Cost ambiguous: a turn's tokens are not attributed to the tool it called, so "cost of Bash" has no clean definition.
- **Two chips.** What does `#bash #read` mean: sessions that used both (AND) or either (OR)? The hash holds one value per key today, so more than one tool needs a list encoding.
- **MCP servers and skills.** Do they filter the same way as built-in tools? A skill marks only its own `Skill` call, not the calls made while it runs, so "calls that involve this skill" cannot reach those calls.
- **Filter and inspector together.** When the filter and the open inspector sheet name the same tool, is that redundant, and when they differ, does the sheet show the intersection?
- **Limits.** Limit windows are plan-wide usage, not per-session, so a tool filter may have no meaning there. Leave the page out, or show the filter as not applicable?

## Capabilities

All capabilities below are a tentative best guess; they will be confirmed once the open questions are settled.

### New Capabilities
- None expected. The filter extends the existing view filters rather than standing on its own.

### Modified Capabilities
- `usage-dashboard` (tentative): every metric reflects the tool filter as well as project and range, and the URL keeps it.
- `cost-dashboard` (tentative): every figure reflects the tool filter, with a stated rule for attributing cost to a tool; the URL keeps it.
- `dashboard-app` (tentative): the shared view filters (source, automated toggle, project and range carried between pages) gain the tool filter; Errors, whose behavior lives in this spec, reflects it.
- `tool-inspector` (tentative): the sheet's view includes the tool filter, with a rule for when the filter and the sheet name the same or different tools.

## Impact

- `metrics.py`: every view query takes the filter, likely through `view()`. `limits.py` if Limits joins.
- `app.py`: API endpoints accept the new parameter.
- `web/src/hash.ts`: a new shared key in `SHARED_KEYS`, kept apart from the `tool`, `mcp` and `skill` sheet keys, possibly with a list encoding.
- `web/src/api.ts` and every page's filter bar: pass and show the filter.
- Command palette: `#<tool>` becomes a filter action.
- Page-test fixtures in `web/src/__fixtures__/` regenerate for any payload change.
- No new dependency. A schema change or rebuild is not expected, but depends on the call-level answer.
