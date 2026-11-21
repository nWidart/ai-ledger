---
title: Filters
description: The project picker, the range, the source and Include automated sessions, shared by every page.
spec: [dashboard-app, command-palette]
---

Four filters narrow what a page shows: the project, the time range, the source and whether automated sessions count. Every figure, chart and table on a page follows them. The filters live in the page's URL, so a reload or a copied link shows the same view, and the navigation carries them to the next page you open.

A page shows a filter only when it changes what the page shows. A filter a page does not show keeps its value in the URL, for the pages you open next.

## Scope bar

The filters sit in the scope bar, directly under the navigation. The bar is in the same place on every page, and shows the filters in the order project, range, source, **Include automated sessions**. It stays at the top with the navigation as you scroll. No other bar sticks there.

A control that changes one part of a page sits in that part, not in the bar: Limits' range in **Past windows**, Errors' Day / Week in its rate chart, and Cost's plan gauge beside its heading.

With the keyboard, Tab goes through the navigation, then the bar, then the page. Changing a filter keeps focus on the control you changed.

On a narrow window (about 900px and below, or zoomed in), the bar is one **Filters** button. A badge on it counts the filters set away from their default, and its name says the count, for example "Filters, 2 filters set". Select it to open the page's filters over the page. They stay open while you change them; Escape closes them and puts focus back on the button. With a project set, the project and its **Brief** link show beside the button.

## Controls

| Control | Choices | Default | URL key |
| --- | --- | --- | --- |
| Project | A project, or "All projects" | All projects | `project` |
| Time range | 7d, 14d, 30d, 90d, All | 30d | `range` (`0` is All) |
| Source | All, Claude Code, Codex, Grok | All | `source` (`claude`, `codex`, `grok`) |
| Include automated sessions | On or off | Off | `auto=1` |

The same filters are available in the [command palette](/ai-ledger/everywhere/command-palette/) as `#` terms.

### Which pages show which control

| Page | Project | Range | Source | Include automated sessions |
| --- | --- | --- | --- | --- |
| Live | yes | no | yes | yes |
| Limits | no | in Past windows | yes | no |
| Activity, Overview | yes | yes | yes | yes |
| Activity, Judgments | yes | yes | no | yes |
| Cost | yes | yes | yes | yes |
| Context | yes | yes | yes | yes |
| Errors | yes | yes | yes | no |
| Project | yes | yes | yes | yes |

- Live shows what runs now, so it has no range.
- Limits are per account, so Limits has no project filter. Its range sits in the **Past windows** header, the part of the page it changes.
- Activity's Judgments view shows how `/insights` judged your sessions, and `/insights` judges Claude Code sessions only. A source filter would change nothing there, so the view has none.
- Errors always counts automated sessions and has no control for them.

## Project picker

The picker is one filterable dropdown. Its field shows the selected project, or "All projects".

- Typing replaces the name in the field and lists the projects whose names contain the text, ignoring case. "All projects" stays listed after the matches. When nothing matches, the popup says "No project matches".
- Enter selects the first match.
- Escape closes the popup without a selection and puts the selected project back in the field.
- Emptying the field lists every project.

When a project is set, a ✕ button named "Clear project filter" sits next to the picker and removes the filter. Clearing the filter on the Project page opens Activity.

When a project is set, the scope bar also ends with a **Brief →** link, named "Brief, <project> project page". It opens the project's [Project page](/ai-ledger/pages/project/) with the same range, source and **Include automated sessions**. The Project page itself has no Brief link, and neither does Limits, which has no project picker.

## Source

The source filter has the choices All, Claude Code, Codex and Grok. A value in the URL that is not one of these reads as All, and the URL drops it. For what each agent records, see [Supported agents](/ai-ledger/concepts/supported-agents/).

Activity's [Judgments view](/ai-ledger/pages/insights/) covers Claude Code sessions only, because Claude Code's `/insights` analyses only those. With Codex or Grok selected, Activity shows Overview: the **Judgments** button of its view switch cannot be picked, and the text beside it says why, such as "Grok writes no facets: /insights judges Claude Code sessions only."

## Include automated

Pages leave out automated sessions from every figure, chart and table. **Include automated sessions** brings them back.

The app treats a session as automated when:

- it belongs to a known automated project: `observer-sessions` (claude-mem's), and every project listed in [`automated.json`](/ai-ledger/reference/configuration/#automated-projects);
- it has no user prompt;
- it ran in a temporary folder (project `(temp)`) with at most one user prompt. A session in a temporary folder with more than one prompt is not automated: it counts under `(temp)`.

A project filter that names an automated project includes that project's sessions, with the control off, except its sessions with no user prompt, which stay out. Naming `(temp)` does not include its automated sessions.

With the control off, the project picker leaves out automated projects.

If `automated.json` cannot be used, a banner under the navigation names the file's path and the reason, on every page, and only the built-in detection applies.

## Days

A page groups activity into the calendar days of the machine's time zone, daylight saving included, and ends every range on that zone's today. An active day is a day with a prompt.

For ways to use these filters, see the playbook [Separate automated sessions from yours](/ai-ledger/improve/automated-sessions/).
