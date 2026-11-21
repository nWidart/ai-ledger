---
title: Sheets
description: The session, project, tool, MCP server and skill sheets that open over every page.
spec: [dashboard-app, usage-dashboard, tool-inspector]
---

A sheet shows one session, project, tool, MCP server or skill beside the page, from the right. It opens from a row, a link, the [command palette](/ai-ledger/everywhere/command-palette/) or a [context menu](/ai-ledger/everywhere/context-menu/). The same sheets open over every page, Limits included, and they do not change the page's filters.

## How sheets behave

- **In the URL.** The open sheet is in the page URL, so Back, reload and shared links agree with it. The key names the subject:

  | Key | Sheet |
  | --- | --- |
  | `session` | Session sheet. On Live, `sheet`, because `session` names the session the stream follows: `/live?session=abc&sheet=abc`. |
  | `inspect` | Project sheet |
  | `tool`, `mcp`, `skill` | Tool, MCP server or skill sheet |

  `/limits?session=…` shows Limits with that session's sheet open.
- **One at a time.** A session opened from a project, tool, MCP server or skill sheet replaces it and shows **← Back**, which returns to that sheet at the row you left.
- **Closing.** **✕**, Escape and a click beside the sheet close it. Focus returns to the control that opened it; when the page redrew that control, to the same item's control, and when there is none, to the page's heading.
- **Wide.** Session, tool, MCP server and skill sheets offer **Wide**, which widens the sheet. The choice is kept in the browser's local storage, one for every sheet that offers it, and does not change the URL. The project sheet has no Wide.
- **Over Errors' type detail.** On a narrow screen (900 px or less), Errors opens a type as a sheet. A session or tool sheet opened from it stacks over it with **← Back**: Back, Close, Escape or a click beside it returns to the type. See [Errors](/ai-ledger/pages/errors/).
- **Filters.** A sheet changes the project filter only through its **Filter dashboard to *project*** button. Changing the project or source on Live closes an open session sheet, as on the other pages.

## Session sheet

Shows the whole session, whatever the range filter says.

- A line names the project (it opens the project sheet), the git branch, and the first and last time.
- **Filter dashboard to *project*** or **Show all projects**.
- **Source**: the first prompt as recorded. A long prompt is cut; **Show the whole prompt** loads all of it.
- A line of figures: estimated cost (a "+" marks a subtotal when some model has no price; "Unknown" when none has), tokens, prompts and interrupted prompts, peak context with its share of the window, compactions, commits, active time. When the session records them, the line adds model time, tool time, output speed, and lines added and removed, as `+120 / −30`; a tooltip says where they come from. A Grok session records model time and output speed only. See [Supported agents](/ai-ledger/concepts/supported-agents/#session-figures).
- **/insights judgment**, tagged model-judged, when the session has an `/insights` analysis: outcome, a "dissatisfied" marker when satisfaction includes it, helpfulness and session type, goal and friction categories, a brief summary and the friction detail, and **Open in Judgments**, which opens the Judgments view with the page's filters. Only Claude Code sessions are analysed; a Codex or Grok session never shows it. See [Judgments](/ai-ledger/pages/insights/).
- **Timeline** of the session. Shift+Left and Shift+Right move ten requests.
- **Error loops** in the session, each with "Open in Errors".
- **Commits**, **Models** (requests, tokens, estimated cost) and **Tools** (calls, failed, p50), each folded. A row of Tools opens the tool sheet.
- The session id, the working directory when the store has it, and the command that resumes the session, each with **Copy**. The resume command is `claude --resume <id>`, `codex resume <id>` or `grok --resume <id>`, after `cd '<directory>' && ` when the directory is known. A copy says "Copied", or "Copy failed".

## Project sheet

Shows the project over the page's range and source, estimated at API list prices.

- **Filter dashboard to *project***, **Open project page** (left out on the Project page of that same project) and **Open its errors**. They show while the figures load or fail.
- Eight figures: estimated cost, sessions, tokens, cache hit, tokens from subagents, cost per commit, errors per 100 calls, error loops.
- **Change vs the previous N days**: the previous and current cost, the change (marked **new** when the project had no usage before) and a daily sparkline of both periods. Left out over all time.
- **Models and effort**.
- **Most expensive sessions**: up to 8, with branch, active time and estimated cost. A row opens the session sheet.

See [Project](/ai-ledger/pages/project/) for the full page.

## Tool, MCP server and skill sheet

Shows one tool, MCP server or skill over the page's view: calls with their change against the previous period, failure rate, p50 and p95 latency, share from subagents, calls per day, where it ran (source, main thread or subagents, projects), the tools or input patterns behind it, tests and commits for a shell tool, failures by type with a fix, what happened after a failure (incidents, recovered, failed again, gave up), error loops, and recent calls. A skill's count is the calls that invoked the skill, not the calls made while it ran.

A row of recent calls or error loops opens its session sheet, with **← Back** to this one.

## Related

- [Activity](/ai-ledger/pages/activity/): the tables whose rows open these sheets.
- [Command palette](/ai-ledger/everywhere/command-palette/) and [Context menu](/ai-ledger/everywhere/context-menu/): open a sheet from anywhere.
- [Keyboard and screen reader](/ai-ledger/everywhere/keyboard-screen-reader/): a sheet is a dialog named by its title.
