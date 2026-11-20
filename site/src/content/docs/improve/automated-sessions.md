---
title: Separate automated sessions from yours
description: Keep scripted and scheduled sessions out of your figures with Include automated and automated projects.
---

## Goal

Your figures count only the sessions you ran yourself: scripted, scheduled and helper sessions drop out of them, and still show when you turn on **Include automated sessions**.

## Signs you need it

The app already leaves out the sessions it detects as automated: a session of `observer-sessions` (claude-mem's project) or of a project in `automated.json`, a session with no prompt, and a session in a temporary folder with at most one prompt (see [Filters](/ai-ledger/everywhere/filters/#include-automated)). This playbook applies when it misses some, or when it hides one of yours:

- Every page shows the banner "**Automated projects file ignored:**" under the navigation, with the file's path and the reason. This is the app's own sign: your `automated.json` does not apply, and only the built-in detection does.
- On [Activity](/ai-ledger/pages/activity/), the **Project metrics** drawer lists a project that a script, a scheduled job or a tool works in, not you.
- Rule of thumb: in Activity's **Sessions** drawer, sorted by **Prompts**, many sessions have 1 prompt and the same title. A script that runs `claude -p "…"` or `codex exec "…"` in a project folder makes such sessions, and the app counts them as yours.
- Rule of thumb: Activity's **Prompts by hour** drawer shows prompts at hours when you do not work, such as every night at 3:00.
- A session you ran yourself is missing from your figures, and it ran in a temporary folder with one prompt.

Errors and Limits have no **Include automated sessions** control: Errors counts automated sessions in every figure, and the plan limit windows on Limits count all use of the account. This playbook does not change them.

## Diagnose

Use [Activity](/ai-ledger/pages/activity/) with the range at **30d**, the project at **All projects** and the source at **All**.

1. Read the session count in the **Sessions** tile, such as "41" (an example). Turn on **Include automated sessions** and read it again. The difference is the sessions the app already detects. Turn the control off again.
2. Open **Project metrics**. For each project you do not work in by hand, write down its name and its **Sessions** count.
3. Open **Sessions** and select the **Prompts** header to sort by it. Find the sessions with 1 prompt. Read their **Session** column (the title) and **Project** column. A title that repeats across many sessions is a script's prompt.
4. Select one such session to open its sheet. Read the **Directory** line: the folder the script ran in.
5. If a session of yours is missing, turn on **Include automated sessions** and pick the project `(temp)` in the project picker. A session there with one prompt is automated by the built-in rule.

| What you see | Cause | Fix |
| --- | --- | --- |
| A project where only a script, a job or a tool works | The app does not know the project is automated. | [List the project in automated.json](#list-the-project-in-automatedjson) |
| One-prompt sessions with a script's title, in a project you also work in by hand | A script runs the agent in your project's folder. | [Run scripts in a folder of their own](#run-scripts-in-a-folder-of-their-own) |
| The banner "Automated projects file ignored:" | `automated.json` cannot be used. | [Fix automated.json](#fix-automatedjson) |
| Your own one-prompt session in `(temp)` is missing | The built-in rule counts it as a helper. | [Work outside temporary folders](#work-outside-temporary-folders) |

## Act

### List the project in automated.json

1. Find the file's path: hover or select the **?** beside **Include automated sessions**. Its hint ends "Add more projects in" and the path. The file sits in the folder that holds the store: `~/Library/Application Support/ai-ledger/` on macOS, `~/.local/share/ai-ledger/` on Linux, unless you set `XDG_DATA_HOME` or `--db`. See [Configuration](/ai-ledger/reference/configuration/#automated-projects).
2. Create the file, or edit it, with each project name exactly as the project picker shows it:

   ```json
   {"projects": ["nightly-triage", "release-bot"]}
   ```

   The names are examples. The app knows `observer-sessions` (claude-mem's) already: do not list it.
3. Reload the page. The app reads the file on every page load, with no restart and no `rebuild`.

To see the project's sessions again, turn on **Include automated sessions**. Or put the project in the address, as in `http://127.0.0.1:8765/usage?project=nightly-triage`: a project filter that names a listed project shows its sessions with the control off, except those with no prompt. The picker itself no longer lists the project while the control is off.

### Run scripts in a folder of their own

The app gives each session the project of its folder, and it cannot tell a script's session from yours in the same project. Give the script a project of its own:

1. Clone the repository a second time, into a folder with its own name. A `git worktree` is not enough: the app names a worktree after its repository, so its sessions keep your project's name.

   ```bash
   git clone <repository-url> ~/code/myapp-bot
   ```

2. In the script, change to that folder before it runs the agent:

   ```bash
   cd ~/code/myapp-bot && claude -p "Triage the new issues"
   ```

   For Codex, run `codex exec "…"` from the same folder. The folder, the prompt and the project name `myapp-bot` are examples.
3. Add the new project name to `automated.json`, as in [List the project in automated.json](#list-the-project-in-automatedjson).

If the job does not need the repository, run it from a new temporary folder instead, such as `cd "$(mktemp -d)"`. The app counts a session in a temporary folder with at most one prompt as automated, with no file to edit.

A session keeps the project it had when it was read. The change applies to the script's new sessions only.

### Fix automated.json

The banner gives the reason. The app ignores the whole file when:

- it is not valid JSON;
- it has no `projects` list;
- an entry of `projects` is not text.

Correct the file so that it matches the example above, then reload the page. The banner goes away.

### Work outside temporary folders

When you start a session in a temporary folder, such as `/tmp/`, and send at most one prompt, the app counts it as automated. To keep a quick experiment in your figures, start it in a folder outside `/tmp/`, `/private/tmp/`, `/var/folders/` and `/private/var/folders/`, such as `~/scratch` (an example). To see such sessions without moving them, turn on **Include automated sessions**.

## Verify

Before you act, note the **Sessions** tile's count on Activity at **30d** with **Include automated sessions** off, and the **Sessions** count of each project you found in step 2 of Diagnose.

Right after you edit `automated.json`, reload the page and read these with **Include automated sessions** off. There is nothing to wait for:

| Figure | Where | Expected |
| --- | --- | --- |
| The listed project | The project picker and **Project metrics** | Gone from both. |
| Session count | Activity's **Sessions** tile | Lower than your note, by the listed projects' sessions. |
| The listed project, with **Include automated sessions** on | **Project metrics** | Back in the list. |

For a script you moved to its own folder, wait until it has run again, then set the range to **7d** and read **Sessions**, sorted by **Prompts**. Expected: no new one-prompt session with the script's title in your project. Older sessions keep their project until they leave the range.

If a figure did not move:

- Check that the name in `automated.json` matches the picker's spelling exactly, case included.
- Check for the banner "Automated projects file ignored:".
- A one-prompt session in your project that is not a script's is yours: leave it.

## Related

- [Filters](/ai-ledger/everywhere/filters/#include-automated): the rules that make a session automated.
- [Configuration](/ai-ledger/reference/configuration/#automated-projects): the `automated.json` file.
- [Activity](/ai-ledger/pages/activity/): the **Sessions** tile, **Project metrics** and the **Sessions** drawer.
- [Metric glossary](/ai-ledger/reference/glossary/): the automated session and the other terms.
- [How AI Ledger works](/ai-ledger/concepts/how-it-works/): how the app reads sessions and projects.
- [Weekly 15-minute review](/ai-ledger/improve/weekly-review/): a routine on figures without automated sessions.
