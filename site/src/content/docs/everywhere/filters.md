---
title: Filters
description: The project picker, the range, the source and Include automated, shared by every page.
spec: [dashboard-app, command-palette]
---

Four filters narrow what a page shows: the project, the time range, the source and whether automated sessions count. Every figure, chart and table on a page follows them. The filters live in the page's URL, so a reload or a copied link shows the same view, and the navigation carries them to the next page you open.

## Controls

| Control | Choices | Default | URL key |
| --- | --- | --- | --- |
| Project | A project, or "All projects" | All projects | `project` |
| Time range | 7d, 14d, 30d, 90d, All | 30d | `range` (`0` is All) |
| Source | All, Claude Code, Codex | All | `source` (`claude`, `codex`) |
| Include automated | On or off | Off | `auto=1` |

The same filters are available in the [command palette](/ai-ledger/everywhere/command-palette/) as `#` terms.

### Which pages show which control

| Page | Project | Range | Source | Include automated |
| --- | --- | --- | --- | --- |
| Activity | yes | yes | yes | yes |
| Cost | yes | yes | yes | yes |
| Context | yes | yes | yes | yes |
| Errors | yes | yes | yes | no |
| Limits | yes | yes | yes | no |
| Insights | yes | yes | yes | yes |
| Live | yes | no | yes | yes |
| Project | yes | yes | yes | yes |

Live has no range, but it keeps the range in the URL for the pages you open next. Errors always counts automated sessions and has no control for them.

## Project picker

The picker is one filterable dropdown. Its field shows the selected project, or "All projects".

- Typing replaces the name in the field and lists the projects whose names contain the text, ignoring case. "All projects" stays listed after the matches. When nothing matches, the popup says "No project matches".
- Enter selects the first match.
- Escape closes the popup without a selection and puts the selected project back in the field.
- Emptying the field lists every project.

When a project is set, the filter row shows a **Project page →** link next to the picker, and a ✕ button named "Clear project filter" that removes the filter. The link goes to the project's Project page and is not on the Project page itself. Clearing the filter on the Project page opens Activity.

## Source

The source filter has the choices All, Claude Code and Codex. A value in the URL that is not one of these reads as All, and the URL drops it.

Insights covers Claude Code sessions only, because Claude Code's `/insights` analyses only those. With Codex selected, Insights says so.

## Include automated

Pages leave out automated sessions from every figure, chart and table. **Include automated** brings them back.

The app treats a session as automated when:

- it belongs to a known automated project: `observer-sessions` (claude-mem's), and every project listed in [`automated.json`](/ai-ledger/reference/configuration/#automated-projects);
- it has no user prompt;
- it ran in a temporary folder (project `(temp)`) with at most one user prompt. A session in a temporary folder with more than one prompt is not automated: it counts under `(temp)`.

A project filter that names an automated project includes that project's sessions, with the control off, except its sessions with no user prompt, which stay out. Naming `(temp)` does not include its automated sessions.

With the control off, the project picker leaves out automated projects. The Limits picker lists every project, automated ones included.

If `automated.json` cannot be used, Activity shows a banner with the file's path and the reason, and only the built-in detection applies.

## Days

A page groups activity into the calendar days of the machine's time zone, daylight saving included, and ends every range on that zone's today. An active day is a day with a prompt.

For ways to use these filters, see the playbook [Separate automated sessions from yours](/ai-ledger/improve/automated-sessions/).
