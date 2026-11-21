---
title: Share your screen safely
description: What the pages reveal, and what to filter, mute or close before you share your screen.
---

## Goal

Share, record or screenshot AI Ledger with no transcript text, secret, private project name or home folder path on screen.

## Signs you need it

This playbook applies before every screen share, recording, screenshot or demo of the app. Run it each time: the app keeps no "presentation" setting, and every page shows text taken from your transcripts.

Act at once when one of these holds:

- [Live](/ai-ledger/pages/live/) shows the banner "**Full text on.** Prompts, replies and tool output show as written, secrets included." This is the app's own warning.
- The project picker, or the **Search** button in the navigation, which shows the project's name while a project filter is set, names a project you cannot show, such as a client's.
- A sheet is open beside the page: the URL holds `session=`, `inspect=`, `tool=`, `mcp=` or `skill=` (on any page but Live).
- [Errors](/ai-ledger/pages/errors/) has a type open with its list or examples in view.

Rule of thumb: if you are not sure a panel is safe to show, it is not. Each session can hold any secret that the agent read or printed.

## Diagnose

Find what the screen will show. Do these steps in the browser window you will share, before you share it.

1. On [Live](/ai-ledger/pages/live/), look for the **Full text** banner. **Full text** is off on every page load and is not kept in the URL, but it stays on while the page stays open.
2. Read the project picker's field, without opening its list. Every page follows it, but some panels name other projects (see the table below).
3. Read the URL. It holds the project name, and a session id when a sheet or a Live session is open.
4. Look for an open sheet beside the page: a session, project, tool, MCP server or skill sheet.
5. On the page you will show, find each panel of the table below that is on screen.

The table lists what each page can show with **Full text** off. Each row is about text that comes from your transcripts or your disk.

| Page | What can show | Why it matters | Fix |
| --- | --- | --- | --- |
| Every page | Project names in the picker list, the [command palette](/ai-ledger/everywhere/command-palette/), tables, chart keys and the **Search** button; the URL | A project name can name a client or private work. | [Narrow every page to one project](#narrow-every-page-to-one-project) |
| Cost, Activity, and the filters of Activity, Context, Project and Live | The path of the app's data folder: Cost's **Unpriced models** and **Prices file ignored** banners, Activity's **Automated projects file ignored** banner, and the "Add more projects in …" line of the **Include automated sessions** help | The path holds your user name, such as `/Users/<name>/Library/Application Support/ai-ledger/`. The **Unpriced models** banner shows, unfolded, whenever a model has no price, such as a new model. | [Hide paths to your data folder](#hide-paths-to-your-data-folder) |
| Activity (both views), Cost, Context, Project | Session titles. When the agent wrote no title, the title is made from the session's first prompt. | A first prompt can quote a secret, a person or a client. | [Narrow every page to one project](#narrow-every-page-to-one-project) |
| Activity | **Failed test runs**: the **Command** column. The Tool, MCP server and skill sheets: the input patterns and the recent calls. | A command can hold a token or a path. | [Close sheets and keep drawers folded](#close-sheets-and-keep-drawers-folded) |
| Any page, session sheet | **Source** (the first prompt, folded), **Commits** (the commit commands, folded), the **Directory** and the **Resume** command (not folded), and the model's summary when the session has an `/insights` judgment | The directory and the resume command show your home folder path, which holds your user name. | [Close sheets and keep drawers folded](#close-sheets-and-keep-drawers-folded) |
| Cost | **Most expensive sessions** and **Project spend and change**; the plan gauge, which names your plan and its price | Session titles and project names. The CSV and copy buttons put the same names on the clipboard. | [Narrow every page to one project](#narrow-every-page-to-one-project) |
| Context | **Largest tool results**: the **Input** column, a summary of the file, command or query of each result | A file path or a command can be private. | [Close sheets and keep drawers folded](#close-sheets-and-keep-drawers-folded) |
| Project | **Largest overhead items**: MCP servers, memory files and skills by name, with each memory file's path on hover | Paths and server names. | [Close sheets and keep drawers folded](#close-sheets-and-keep-drawers-folded) |
| Errors | Each example: the tool input, the error text and the tool's result. Incidents and **By message** rows. | An error example can quote a secret from a command or its output. No toggle hides it. | [Keep Errors at the type table](#keep-errors-at-the-type-table) |
| Limits | **What used this window**: the top three projects of each window | It ignores the project filter, so it can name other projects. | [Narrow every page to one project](#narrow-every-page-to-one-project) |
| Activity, Judgments view | Session cards: the model's brief summary, and the **Friction detail** (folded) | The model's words can repeat what you asked. | [Close sheets and keep drawers folded](#close-sheets-and-keep-drawers-folded) |
| Live, **Full text** off | Tool inputs up to 300 characters, so a short command shows whole; the error text of a failed call; subagent descriptions; git branches; titles that the agent or `/rename` wrote | A short command can hold a token. | [Turn off Full text on Live](#turn-off-full-text-on-live) |
| Live, **Full text** on | Prompts, replies and tool results as written, and titles made from first prompts | Everything, secrets included. | [Turn off Full text on Live](#turn-off-full-text-on-live) |

## Act

Do these steps in order before you share. Each one removes rows of the table above.

### Turn off Full text on Live

1. On [Live](/ai-ledger/pages/live/), clear the **Full text** checkbox, or reload the page: each load turns it off.
2. Check that the banner "Full text on." is gone, and that a prompt reads as a word count, such as "42 words · turn on Full text to read it" (an example).
3. If a session's commands are not safe to show even cut to 300 characters, do not show Live. With **Full text** off, a short tool input, a failed call's error text and a git branch still show as written.

### Narrow every page to one project

Pick one project that you can show in full. Set the filter before you share, with the address, so that you never open the picker list on screen:

```text
http://127.0.0.1:8765/usage?project=<name>&range=7
```

Replace `<name>` with the project's name as the picker shows it. `/usage` is Activity, and `range=7` is the last 7 days. The navigation carries the filter to each page you open next.

- Before you share, read that project's session titles in Activity's **Sessions** tab, and its session cards in Activity's Judgments view. If one is not safe to show, do not show the pages that list session titles: Activity, Cost, Context and Project.
- Leave **Include automated sessions** off.
- Do not show Cost if your plan's name and price are private: the plan gauge names them.
- Do not open the project picker or the command palette while you share: both list your other projects.
- Do not show Limits with the **What used this window** drawer open: it names the top projects of each window, whatever the filter.
- If no project is safe to show, do not share the app. Use the screenshots on this site instead.

### Close sheets and keep drawers folded

1. Close every sheet with its **✕**, or press Escape. Check that the URL has no `session=`, `inspect=`, `tool=`, `mcp=` or `skill=`. On Live, `session=` names the session in the stream, not a sheet.
2. Keep these folded: Activity's **Failed test runs**, Context's **Largest tool results**, the Project page's **Largest overhead items**, and the **Friction detail** of a card in the Judgments view.
3. If you must open a session sheet, keep **Source** and **Commits** folded, and scroll so that **Directory** and **Resume** stay off screen.

### Hide paths to your data folder

1. Open Cost and Activity before you share. If a banner names `prices.json` or `automated.json` with a path, fix the file or price the model as [Configuration](/ai-ledger/reference/configuration/) says, then reload: the banner goes away.
2. If you cannot clear an **Unpriced models** banner, do not show Cost.
3. Do not open the help of **Include automated sessions** on screen, and keep the pointer off its **?** button: the help opens on hover, and it shows the path of `automated.json`.

### Keep Errors at the type table

1. Open [Errors](/ai-ledger/pages/errors/) with no type in the URL: the page then shows the type table and **Where to start**, which hold type names, counts and fix text.
2. Do not open a type's list, an incident or an example. An example shows the tool input, the error text and the result, with or without **Full text**, which exists on Live only.
3. Do not open an error permalink (a link with `ex=` in it) on screen: it opens on its example.

### Share one browser tab

Share the browser tab that shows the app, not the whole screen or the whole window. A whole screen also shows your other tabs, their titles and your notifications.

## Verify

Before each share, check these on the tab you will share. Each must hold; there is nothing to wait for.

| Check | Where | Expected |
| --- | --- | --- |
| The **Full text** banner | Live, under the filters | Absent. Prompts and replies read as word counts. |
| The project filter | The URL and the **Search** button | The one project you chose. |
| Open sheets | The URL, on every page but Live, where `session=` names the session in the stream | No `session=`, `inspect=`, `tool=`, `mcp=` or `skill=`. |
| Errors | The URL of Errors | No `cat=` and no `ex=`: no type and no example open. |
| **What used this window** | Limits | Folded, or Limits not shown. |
| Data folder path | Cost and Activity banners | No banner names `prices.json` or `automated.json`, or the page is not shown. |
| The shared area | Your sharing tool | One tab, not a screen. |

If a secret was on screen, treat it as leaked: revoke it and make a new one with its provider. The store keeps every transcript line, so the secret stays in it; see [Privacy and security](/ai-ledger/concepts/privacy-security/).

## Related

- [Privacy and security model](/ai-ledger/concepts/privacy-security/): what the store holds and why the pages show transcript text.
- [Live](/ai-ledger/pages/live/): **Full text** and what it shows when off.
- [Errors](/ai-ledger/pages/errors/): the examples of an error type.
- [Filters](/ai-ledger/everywhere/filters/): the project filter and the URL keys.
- [Activity](/ai-ledger/pages/activity/): the session sheet.
- [Metric glossary](/ai-ledger/reference/glossary/): the terms used here.
