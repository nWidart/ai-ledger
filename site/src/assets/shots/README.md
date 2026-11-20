# Screenshots

Recorded from the synthetic demo store by `node tools/demo/record.mjs shots` (see `site/README.md`). Never edit or add a PNG by hand, and never take one from your own store. The recorder palette-quantizes every PNG (`sharp`), so the set stays near 2 MB; `node tools/demo/record.mjs quantize` re-encodes the files already here.

Every row is two files: `<name>.png` (dark) and `<name>-light.png` (light). Pass both to `ThemedImage` (`dark` and `light`). Each shot is 1280px wide at device scale 1 and cropped to one panel; a panel taller than 1200px is cropped from its top. The "drawer" panels are folded on the page; the shot shows them open.

Only the shots a page shows are kept: a shot no page references is deleted, and its entry leaves the recorder's list (`SHOT_PAGES` in `tools/demo/record.mjs`) in the same change. To show another panel, add it to that list, record it, and add its row here.

`tour-overview` has no page of its own: it is the reduced-motion still of the home page's `tour` GIF, the first screen of Activity (1280×800): `ThemedImage gif="tour" dark={tourStill} light={tourStillLight}`.

| Name | What it shows | Page |
| --- | --- | --- |
| `tour-overview` | The first screen of Activity: header, filters, what needs attention, the vitals row. Still for the `tour` GIF. | Home (tour GIF) |
| `activity-attention` | "Needs attention": the short list of things to look at (error loops, sessions near the window, failing tools, failed tests). | Activity, First tour |
| `activity-vitals` | The work-health row of figures. | Activity |
| `activity-work` | "Work per day": commits per day by project with errors per 100 calls on the right axis. | Activity |
| `activity-hours` | "Prompts by hour": when the work happens. | Activity |
| `cost-overview` | The heading, the filters and the plan gauge. | Cost |
| `cost-spend` | "Estimated cost per day", stacked by project. | Cost |
| `cost-projects` | "Project spend and change": trend, spend, change, cost per commit and cache hit per project. | Cost |
| `cost-highlights` | "What stands out": the insight cards. | Cost |
| `cost-models` | "Models and effort": spend by model and effort level. | Cost, Spend less |
| `cost-tokens` | "Tokens and cache" drawer, open: each kind's share of tokens beside its share of cost. | Cost |
| `context-tips` | "Tips": the cards that say what to change. | Context, First tour |
| `context-starting` | "Starting context": what a session begins with, per project. | Context, Keep context lean |
| `context-growth` | "Growth": context size as a session goes on. | Context |
| `context-pressure` | "Window pressure": how close sessions get to the window. | Context |
| `context-fills` | "What fills context": by tool, MCP server and skill. | Context |
| `context-cost` | "Cost": what context costs. | Context |
| `errors-summary` | The summary figures at the top. | Errors |
| `errors-chart` | "Errors by type": failed tool calls over time. | Errors |
| `errors-types` | "Error types": the table of types, counts and change. | Errors |
| `errors-detail` | "Where to start": error types with a ready-made fix, and the fastest rising. | Errors, First tour, Kill repeated tool failures |
| `limits-windows` | The four open plan windows: Claude Code and Codex, weekly and 5-hour, each with its pace cone chart and its headroom, pace and top project footer. | Limits, First tour, Stop hitting plan limits |
| `limits-history` | "Past windows": a strip of bars per limit, with its average left unused and its hits. | Limits |
| `insights-vitals` | The outcomes-at-a-glance row. | Insights |
| `insights-outcomes` | "Outcomes", model-judged. | Insights, First tour |
| `insights-friction` | "Friction categories", model-judged. | Insights |
| `insights-log` | "Analysed sessions": the log, first 1200px. | Insights |
| `project-layout` | The whole page in two columns, cropped to its first 1500px. | Project, First tour |
| `project-activity` | "Activity": eight figures of the project's activity. | Project |
| `project-cost` | "Cost": change, models, and token share beside cost share. | Project |
| `project-sessions` | "Sessions". | Project |
| `project-errors` | "Errors". | Project |
| `project-context` | "Context". | Project |
| `project-insights` | "Session judgments". | Project |
| `project-limits` | "Plan limits". | Project |
| `live-rail` | The "Active · last 10 min" session list. | Live, First tour |
| `live-stream` | One session's stream: prompt, reply, tool calls, a subagent lane and a failed `npm test`. | Live |
| `live-status` | The "Doing now" side panel: context window, session figures, tokens per minute, plan limits. | Live |
| `live-wall` | Wall view: one tile per session. | Live |
| `everywhere-palette` | The command palette, searching `atlas`: a project, its page and its sessions. | Command palette |
| `everywhere-context-menu` | The right-click menu on a project row in Activity's Project metrics drawer. | Context menu |

All project names are the demo store's (`atlas-api`, `pixel-studio`, `ledger-web`, `infra-scripts`, `docs-site`), from `tools/demo/seed.py`.
