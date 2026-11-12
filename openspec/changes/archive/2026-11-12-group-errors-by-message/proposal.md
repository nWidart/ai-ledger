# Proposal

## Why

GitHub issue #4 (Errors page UX review), one item: group examples by normalized error message inside a type ("586× same message"). A type such as Other or Other non-zero exit holds hundreds of errors. Incidents and "Every error, newest first" do not show that most of them are one message, so mislabelled types stay hidden and Other is not a to-do list.

## What Changes

- **A third list mode, "By message".** The open type's detail gets a third button beside Incidents and Every error, saved the same way (`claude-errors-mode`). It lists one row per normalized message: count, message, share of the listed errors, projects, top two tools, newest time. Most errors first, the most recent first on a tie.
- **Open a group.** A row is a button (`aria-expanded`) that opens that message's examples, newest first, thirty at a time. A copy button on the row copies the normalized message.
- **Same errors, same controls.** The list holds what the other lists hold: the type's errors in the view, narrowed by the selected bucket and tool. The search box keeps the groups with a matching example. A linked example opens its group, listed first. The count line and screen-reader status read like the other modes.
- **Normalization.** A pure function turns an error's text into a group key and a label: the first line (plus the next when the first is a bare wrapper), paths, ids and numbers replaced, long quoted strings shortened, whitespace collapsed. Each error is normalized once.

Out of scope: changing error types or rules, server-side grouping, muting a message, sorting the type table.

## Capabilities

### Modified Capabilities
- `errors-dashboard`: new requirements "List a type's errors by message", "Open a message group" and "Normalize an error message".

## Impact

- `web/src/pages/errors/` (`model.ts`, `view.ts`, `context.ts`, `ErrorsPage.tsx`, `Detail.tsx`, `Examples.tsx`, `errors.css`, tests, `PARITY.md`), README, CHANGELOG. No payload, backend or categorization change.
