# Design

## Context

See proposal.md for the motivation and specs/ for the behavior. What shapes the approach:

- Subjects already reach the DOM through a few shared paths. `pickRow(v, pick)` in `components/sheets/session.ts` builds the props of every clickable subject row (19 call sites: projects, sessions, tools, MCP servers, skills) and already sets `data-v`. `ProjectName` in `components/ProjectDot.tsx` renders project names with their dot (20 call sites). Two kinds of subject do not go through either: the Errors type rows (`pages/errors/TypeTable.tsx`, own `onClick`, `data-c`) and the Live rail and wall buttons (`data-session`).
- The palette's `resolve(chips, here)` (`components/palette/resolve.ts`) already turns "this subject, that page, these filters" into the one URL a commit writes, with the sheet-hosting and filter-carrying rules. It is pure.
- The sheet openers (`openProjectSheet`, `openSessionSheet`, `openToolSheet`), `setSearch` and `go` write the URL; `copy()` in `components/export.ts` writes the clipboard and reports failure.
- `@base-ui/react` 1.9.0 ships `ContextMenu`. Its trigger handles `contextmenu` and a 500 ms long-press, positions the popup at the pointer, and its positioner takes an `anchor`. Base UI's merged handlers let a consumer handler call `event.preventBaseUIHandler()` to skip the library's.
- Rows carry only the subject's key. A session row knows its id, not its source or working directory; those come from `/api/session` (`queries.session(id)`, already cached by the sheet).

## Goals / Non-Goals

**Goals:**
- One menu instance for the whole app, so the open state, focus return and status live in one place.
- Menu contents as pure data, testable without the DOM.
- Cross-page items that behave exactly like the palette, by sharing its resolver.

**Non-Goals:**
- A general command or action registry shared with the palette. The palette keeps its own suggestion model; only the URL resolution is shared.
- Per-page custom menus. A page adds a subject by marking it, not by adding menu code.

## Decisions

### 1. Mark subjects in the DOM and delegate from the root

Each subject element gets `data-subject="<kind>:<value>"`, with kind one of `project`, `session`, `tool`, `mcp`, `skill`, `category` (`components/menu/subject.ts`). It is its own attribute: `data-v` already serves the sheets to find a row again for focus, and some rows' `data-v` is not the subject (a tool sheet's recent-call rows key on the call, their subject is the session). `pickRow` takes the subject as a new argument; `ProjectName`, the Errors type rows and the Live buttons set the attributes directly. One `<SubjectMenu>` mounted in the app root finds the subject with `target.closest("[data-subject]")`.

The nearest marked ancestor wins, which gives the spec's "session row inside a project sheet opens the session menu" for free. A project name (`ProjectName`) is an inline mark (`data-subject-inline`): inside a marked row or tile it yields to that row, so a right-click on the project shown in a session row opens the session's menu. A row that stands for no single subject ("Other", long tail) is simply not marked.

*Alternative:* a `<ContextMenu.Trigger>` per row. Rejected: dozens of menu roots per table, and each call site would need menu code.

### 2. Base UI `ContextMenu`, one root, one trigger around the app

`<SubjectMenu>` renders a controlled `ContextMenu.Root` whose `Trigger` wraps the routed content. The trigger's own `onContextMenu` and `onTouchStart` run before Base UI's. When there is no subject under the event, text is selected or Shift is held, they call `event.preventBaseUIHandler()` and `event.stopPropagation()` and return. Both are needed: the trigger also listens for `contextmenu` on `document` and calls `preventDefault` for any target inside it (spike, task 1.1), so the event must not reach it. No app code listens for `contextmenu`, so nothing else loses the event. The browser's menu then shows. Otherwise they record the subject and let the library open at the pointer, or on long-press for touch.

Keyboard: a `keydown` listener on the same wrapper opens the menu for Shift+F10 and the `ContextMenu` key on a focused subject. It sets `open` with the positioner's `anchor` set to the subject element instead of the pointer. macOS Safari sends no `contextmenu` event for Shift+F10, so a native-event-only path would miss it. When the menu closes, `Popup`'s `finalFocus` sends focus back to the subject element when the menu was opened from the keyboard and the element is still in the document.

The popup portals into the topmost open `<dialog>` when a sheet is open, else `document.body`, as the palette's toast does: content outside an open modal dialog is inert and drawn below it. Base UI's Escape handling calls `preventDefault` and `stopPropagation` on the keydown, so Escape closes only the menu. Base UI does not suppress the click that follows a long-press; a capture-phase click guard on the trigger drops a click that comes right after a touch-opened menu, so the row's sheet does not open.

*Alternative:* plain `Menu` with a hand-written long-press. Rejected while `ContextMenu` covers pointer and touch. The spike (task 1.1) confirmed this: a passed `anchor` wins over the pointer position (`MenuPositioner`), so the pointer path resets it to `undefined`. The fallback, `Menu` with a virtual anchor and our own long-press, was not needed.

### 3. Menu contents from a pure function

`menuItems(subject, ctx)` in `components/menu/items.ts` returns the ordered groups of items for a subject, given the current path and search, the session details when known, and the Errors marks when on Errors. Each item is one of:

- `nav`: an href, written with `go(href)` as one push;
- `copy`: the text to copy;
- `action`: a callback, used only for mute and unmute;

An item may also carry a disabled reason ("Loading…", "Not available"). The spec's rules about which items to leave out live here, and unit tests cover them: no Open project page on that project's page, no sheet where the page hosts none, no working directory without one, no mute for `infra` and `user_denied`.

Navigation hrefs come from `resolve()` with synthetic chips, for example `[{kind: "project", value}, {kind: "page", value: "/cost"}]`. The menu therefore carries filters, picks the host page for a sheet and drops a sheet the target page cannot host exactly as the palette does. The filter toggle writes `{project, inspect: null, session: null}`, the same patch as the sheet's `FilterButton`.

### 4. Resume command in one helper, shared with the sheet

`resumeCommand({source, session_id, cwd})` returns:

- `claude --resume <id>` for a Claude Code session;
- `codex resume <id>` for a Codex session;
- either command prefixed with `cd '<cwd>' && ` when `cwd` is set. The directory is single-quoted, and each `'` inside it becomes `'\''`.

Codex's stored `session_id` is the main thread's UUID (`codex.py`, `thread_class`), which `codex resume <SESSION_ID>` takes. The session sheet's new footer uses the same helper, so the menu and the sheet never disagree.

### 5. Session details on demand

When a session menu opens, `SubjectMenu` calls `useQuery(queries.session(id))`. The sheet's cache answers at once for a session already opened. Until the query settles, items that need the details carry the "Loading…" reason. On error they carry "Not available". Open session and Copy session ID need only the id and are always enabled. React Query re-renders the open menu when the data arrives, so the menu does not close.

*Alternative:* add `source` and `cwd` to every row payload. Rejected: it changes many payloads and fixtures for a value most rows never need.

### 6. Mute through the existing queue

The Errors page owns the write queue for marks. The menu is mounted at the app root, above the page, so a React context the page provides would not reach it. Instead the page lends its mute toggle through a small registry (`components/menu/mute.ts`: `useLendMute(fn)` while mounted, `muteFor(cat)` for the menu). On other pages nothing is lent, so the mute item is absent. This keeps one queue and one "Saving…" feedback, as the spec requires.

### 7. One polite status for copies

`SubjectMenu` renders a `role="status"` region at mount and sets "Copied" or "Couldn't copy to clipboard." after a copy, cleared after a few seconds. The text matches `ExportButtons`.

## Risks / Trade-offs

- [The trigger wrapping the app takes `contextmenu` everywhere] → Handlers bail out first and call `preventBaseUIHandler` outside subjects. A test asserts that `defaultPrevented` stays false for a right-click on a heading.
- [Long-press on a row could also fire the row's click on touch end] → Base UI suppresses the click that follows a long-press. A test asserts that the sheet does not open after a long-press.
- [Charts and canvases that handle their own `contextmenu`] → No current chart does. Unmarked elements keep the browser's menu.
- [Menu inside an open `<dialog>` sheet] → The popup must portal into the top layer above the modal sheet. The spike checks that the menu shows above a sheet and that Escape closes only the menu.
- [Menu is hidden by nature] → The spec forbids menu-only actions. The session sheet gains the resume command and working directory for that reason.

## Migration Plan

Frontend only. No URL, payload or store change, so rollback is a revert.
