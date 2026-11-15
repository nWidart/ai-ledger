# Proposal

## Why

The app shows four kinds of subjects everywhere: projects, sessions, tools (with MCP servers and skills) and error types. A click does one fixed thing with each: a project row opens the project sheet, a session row opens the session sheet. The other things a user does with a subject sit elsewhere. To open a project's page or see its errors, the user opens the sheet first or goes through the palette. To resume a session, the user copies its id from the sheet and types the agent's resume command by hand. A right-click menu on the subject puts those actions where the user is looking.

## What Changes

- A right-click on a project, a session, a tool, MCP server or skill, or an error type opens a menu of that subject's actions in place of the browser's menu:
  - **Project:** open the project page, open the project sheet, filter the dashboard to the project (or show all projects when the page already shows it), show the project on Cost, Errors, Context or Live, copy the project name.
  - **Session:** open the session sheet, open the session's project page, copy the command that resumes the session in its agent, copy the session id, copy the working directory.
  - **Tool, MCP server or skill:** open its inspector, copy its name.
  - **Error type:** open the type on Errors, mute or unmute it (on Errors, where muting already lives), copy its name.
- The menu covers the places these subjects already show as rows, names and cards: the dashboard tables and drawers, the project, session and tool sheets, the Live rail and wall, and project names with their dot.
- The browser's menu still shows for selected text, for Shift+right-click, and outside a subject.
- The menu opens from the keyboard (Shift+F10 or the context-menu key on a focused subject) and by long-press on touch.
- Every action in the menu stays reachable without it. The menu is a shortcut, never the only way. For that, the session sheet gains the working directory and the resume command, each with a Copy button.
- No payload, route or URL key change. Menu actions write the same URLs the palette and the existing links write.

## Out of scope

- Opening a project's folder on disk or in an editor, and any other action that needs the server to start a process.
- Opening a subject in a new tab and copying a link from the menu.
- Chart buckets (days, hours) as subjects.

## Capabilities

### New Capabilities
- `context-menu`: the right-click menu on projects, sessions, tools and error types, what each offers, where it shows, when the browser's menu shows instead, and how it works from the keyboard, by touch and with assistive technology.

### Modified Capabilities
- `usage-dashboard`: the session sheet shows the session's working directory and resume command, each with a Copy button, so the menu is not the only way to them.

## Impact

- `web/src`: a new menu component mounted once at the app root; subject markers on the shared row helper, the project name component, the error type rows and the Live session buttons; a pure module that lists each subject's actions, reusing the palette's view resolver for actions that change page.
- Uses `@base-ui/react`'s context menu, already a dependency. No new dependency.
- Rebuilt `src/ai_ledger/web/`, `README.md` and the `[Unreleased]` section of `CHANGELOG.md`.
- No server, store or payload change.
