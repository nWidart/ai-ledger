# Screenshots

Recorded from the synthetic demo store by `node tools/demo/record.mjs shots` (see `site/README.md`). Never edit or add a PNG by hand, and never take one from your own store.

Every row is two files: `<name>.png` (dark) and `<name>-light.png` (light). Pass both to `ThemedImage` (`dark` and `light`). Each shot is 1280px wide at device scale 1 and cropped to one panel; a panel taller than 1200px is cropped from its top. The "drawer" panels are folded on the page; the shot shows them open.

An `-overview` shot is the whole page, top to bottom, and doubles as the reduced-motion still of the page's GIF: `ThemedImage gif="cost" dark={costOverview} light={costOverviewLight}`. The tour GIF has no page of its own: its still is `tour-overview`, the first screen of Activity (1280×800).

| Name | What it shows | Page |
| --- | --- | --- |
| `tour-overview` | The first screen of Activity: header, filters, what needs attention, the vitals row. Still for the `tour` GIF. | Home (tour GIF) |
| `activity-overview` | The whole Activity page, 30 days. Still for the `activity` GIF. | Activity |
| `activity-attention` | "Needs attention": the short list of things to look at (error loops, sessions near the window, failing tools, failed tests). | Activity |
| `activity-vitals` | The work-health row of figures. | Activity |
| `activity-work` | "Work per day": commits per day by project with errors per 100 calls on the right axis. | Activity |
| `activity-hours` | "Prompts by hour": when the work happens. | Activity |
| `activity-sessions` | Sessions drawer, open: the sessions table. | Activity |
| `activity-projects` | Project metrics drawer, open: sessions, subagents, commits, errors and error loops per project, compared with the median project. | Activity |
| `activity-tools` | Tools drawer, open: calls, failure rate and latency per tool. | Activity |
| `activity-extensions` | MCP servers, skills and hooks drawer, open. | Activity |
| `activity-error-loops` | Error loops drawer, open: a tool that failed three or more times in a row. | Activity |
| `activity-failed-tests` | Failed test runs drawer, open. | Activity |
| `cost-overview` | The whole Cost page, 30 days. Still for the `cost` GIF. | Cost |
| `cost-changed` | "What changed vs the previous 30 days": spend deltas. | Cost |
| `cost-highlights` | "What stands out": the insight cards. | Cost |
| `cost-spend` | "Estimated cost per day" by model. | Cost |
| `cost-where` | "Where the spend went": by project. | Cost |
| `cost-models` | "Models and effort": spend by model and effort level. | Cost |
| `cost-tokens` | Tokens and cache drawer, open. | Cost |
| `cost-by-project` | Cost by project drawer, open. | Cost |
| `cost-top-sessions` | Most expensive sessions drawer, open. | Cost |
| `context-overview` | The whole Context page, 30 days (very tall). Still for the `context` GIF. | Context |
| `context-tips` | "Tips": the cards that say what to change. | Context |
| `context-starting` | "Starting context": what a session begins with, per project. | Context |
| `context-growth` | "Growth": context size as a session goes on. | Context |
| `context-pressure` | "Window pressure": how close sessions get to the window. | Context |
| `context-fills` | "What fills context": by tool, MCP server and skill. | Context |
| `context-cost` | "Cost": what context costs. | Context |
| `context-largest-results` | Largest tool results drawer, open. | Context |
| `context-cache-breaks` | Sessions where caching broke drawer, open. | Context |
| `errors-overview` | The whole Errors page, 30 days. Still for the `errors` GIF. | Errors |
| `errors-summary` | The summary figures at the top. | Errors |
| `errors-chart` | "Errors by type": failed tool calls over time. | Errors |
| `errors-types` | "Error types": the table of types, counts and change. | Errors |
| `errors-detail` | "Where to start": error types with a ready-made fix, and the fastest rising. | Errors |
| `limits-overview` | The whole Limits page. Still for the `limits` GIF. | Limits |
| `limits-windows` | The four open plan windows: Claude Code and Codex, weekly and 5-hour, with pace and forecast. | Limits |
| `limits-unused` | "Left unused": plan left over at reset. | Limits |
| `limits-history` | Past windows drawer, open. | Limits |
| `limits-value` | "What a point buys" drawer, open. | Limits |
| `insights-overview` | The whole Insights page, 30 days (very tall). Still for the `insights` GIF. | Insights |
| `insights-vitals` | The outcomes-at-a-glance row. | Insights |
| `insights-outcomes` | "Outcomes", model-judged. | Insights |
| `insights-friction` | "Friction categories", model-judged. | Insights |
| `insights-trend` | "Outcome trend", model-judged. | Insights |
| `insights-satisfaction` | "Satisfaction and helpfulness", model-judged. | Insights |
| `insights-log` | "Analysed sessions": the log, first 1200px. | Insights |
| `insights-goals` | Goals drawer, open. | Insights |
| `insights-session-types` | Session types drawer, open. | Insights |
| `insights-session-figures` | Session figures drawer, open. | Insights |
| `project-overview` | The whole project page for `atlas-api`. Still for the `project` GIF. | Project |
| `project-summary` | "Summary". | Project |
| `project-cost` | "Cost". | Project |
| `project-sessions` | "Sessions". | Project |
| `project-errors` | "Errors". | Project |
| `project-context` | "Context". | Project |
| `project-insights` | "Session judgments". | Project |
| `project-limits` | "Plan limits". | Project |
| `live-overview` | The whole Live page in Stream view, two sessions working. Still for the `live` GIF. | Live |
| `live-rail` | The "Active · last 10 min" session list. | Live |
| `live-stream` | One session's stream: prompt, reply, tool calls, a subagent lane and a failed `npm test`. | Live |
| `live-status` | The "Doing now" side panel: context window, session figures, tokens per minute, plan limits. | Live |
| `live-wall` | Wall view: one tile per session. | Live |
| `everywhere-palette` | The command palette, searching `atlas`: a project, its page and its sessions. | Everywhere |
| `everywhere-context-menu` | The right-click menu on a project row in Activity's Project metrics drawer. | Everywhere |

All project names are the demo store's (`atlas-api`, `pixel-studio`, `ledger-web`, `infra-scripts`, `docs-site`), from `tools/demo/seed.py`.
