# Proposal

## Why

The Project page is hard to find. With a project filter set, the navigation shows a chip `Project ● jobdesk ✕`, and the only way to the page is to click the project's name in it: a filter value that is secretly a link. Nothing on screen says a page exists. The command palette lists projects only as `#` filters; its `>project` row shows only after a project chip is set, so typing `jobdesk` offers no way to the page.

## What Changes

- **Navigation chip.** The project chip shows a visible "Page →" control next to the name. The name and the control are one link (one tab stop, a larger target), named "jobdesk project page" for assistive technology, with the arrow hidden from it. The label stays on narrow screens, where the chip already has its own row, and the chip's controls get touch-sized targets there. On the Project page the link is marked as the current page and drops the arrow.
- **Palette.** A typed project name now also offers that project's page: a row "jobdesk · open project page" in the Page group. Picking it adds the `#jobdesk` filter and the `>Project` destination together, as one step. It shows for typed text with no sigil or with `>`, never for `#` and never for empty text; at most three rows. It never ranks as an exact match of bare text, so `jobdesk >errors` still turns `jobdesk` into a project chip. With `>`, an exact name does match exactly, so `>jobdesk #7d` chips the destination.
- No payload, route or URL change.

## Out of scope

- The project sheet's "Open project page" link while the sheet loads or fails.
- A Project tab, and project names in tables, which keep opening the project sheet.

## Capabilities

### Modified Capabilities
- `project-page`: the navigation's project chip offers a visible Page control.
- `command-palette`: a project match also offers that project's page.
