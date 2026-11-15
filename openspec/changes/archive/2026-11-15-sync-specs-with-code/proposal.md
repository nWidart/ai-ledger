## Why

Writing the documentation site showed places where `openspec/specs/` describes the app differently from what the code does. The docs follow the code. This change brings the specs in line with the code so the two stop disagreeing. It changes no code and no behavior.

## What Changes

Each item is a correction to existing requirement or scenario text. The code is the truth for all of them.

- **live-dashboard**: how long a session has been in its state shows for idle too, and a running tool shows its name and time. An untitled rail entry has the project as its main line and the state, source and branch on its second line.
- **project-page**: Measure now shows when the view has Claude Code sessions or the project already has a context snapshot.
- **cost-dashboard**: token usage by kind is shown per day; per project only a single total appears, in Cost by project.
- **usage-dashboard**: the switch to a weekly chart is measured from the first session to today, not to the end of the range.
- **limits-dashboard**: the lead's fallback is the highest forecast percent at reset, else the current percent, worded "Fullest: …". "Commits a point, by project" folds the rest into "smaller projects" only without a project filter. The status strip's chips use the warning tone while the navigation dot uses the critical one.
- **insights-dashboard**: the page order includes the Trend panel and the Session figures, Coverage and How this works drawers.
- **context-dashboard**: a Window pressure segment lists at most 20 sessions, only those on the session map, and says so when it shows fewer. The cache-breaks drawer lists at most 25 sessions. The cache-break tip has a third advice for breaks caused by `other`. The near-limit tip no longer says it uses the window Activity uses: Activity uses the price table's window; Context and Live use the session's stated window first.
- **errors-dashboard**: Where to start lists at most 4 per list and does not exclude always-noise types.
- **dashboard-app**: the Include automated sessions control is on Activity, Cost, Context, Insights, Live and Project, and not on Errors or Limits.
- **command-palette**: the Project page hosts the tool, MCP server, skill and session sheets.
- **context-menu**: the copy status reads "Copied to clipboard." or "Could not copy to clipboard.".
- **plan-limits**: without a macOS Keychain the Claude Code poll runs and fails, and Claude Code windows come only from polls already in the store. Claude Code writes no limits into transcripts. Codex windows come from Codex transcripts on every platform.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `live-dashboard`: rail entry and wall tile requirements.
- `project-page`: the Measure now requirement.
- `cost-dashboard`: the token usage by kind requirement.
- `usage-dashboard`: the weekly chart requirement and its table scenario.
- `limits-dashboard`: the lead, value per 1% and status strip requirements.
- `insights-dashboard`: the page order requirement.
- `context-dashboard`: peak-fill drill, cache breaks and the near-limit and cache-break tips.
- `errors-dashboard`: the time lost ranking that feeds Where to start.
- `dashboard-app`: the automated sessions requirement.
- `command-palette`: the sheet-hosting requirement.
- `context-menu`: the copy status requirement.
- `plan-limits`: the credential requirement.

## Impact

Only `openspec/specs/` changes, through this change's archive. No code, web build, docs site, README or changelog changes: nothing user-visible changes.
