# Design

## Context

`Nav.tsx` renders the project chip: a `Link` around the bold name, then the Clear button. `Nav.css` puts the chip on its own row at 520px and below, with Clear's label kept. In the palette, one suggestion row becomes one chip (`addChip`), and the footer, Tab, Enter, click and touch all go through that. `suggest()` sorts by rank, then kind; `exactRow()` auto-chips a typed term only when exactly one row matches it exactly.

## Decisions

### D1. One link over the name and "Page →"
A second link beside the name would add a tab stop to the same URL and keep the hidden link. A plain-text name would break the habit of clicking it. One `Link` keeps both, shows the destination, and its name reads "jobdesk project page" (a visually hidden "project" between them; the arrow is `aria-hidden`). The `title` goes: the label says it. It stays a link, not a button: it navigates, so it keeps its href, middle-click and preload.

On `/project` the link carries `aria-current="page"` and no arrow, since no tab is current there. The tabs' current rule (`.appnav a[aria-current=page]`) outranks `.appnav-filter a`, so the chip takes the current-tab tint with no rule of its own.

Rejected: a contextual Project tab (the tab row moves when the filter changes, and the spec keeps the page out of the tabs); an underline and arrow on the name alone (still a filter value posing as a link).

### D2. Keep the label on narrow screens
The chip has a row of its own at 520px and below, and Clear keeps its label there. A bare arrow would be the least discoverable form on touch, where no hover title explains it. The chip's link and Clear get a 32px minimum height there.

### D3. A project-page row that adds two chips
The row is a `page` row for `/project` that also carries the project. Every path that turns a row into chips (footer preview, Tab, Enter, click, touch) adds both `#project` and `>Project`, and the change is announced once ("jobdesk and Project page added"). Touch keeps staging rows until Apply, as for every row.

Text "jobdesk · open project page": the name first, so the matched span marks it, and the same shape as "Bash · open inspector (>)". The detail is the project's session count.

### D4. When the row shows, and how it ranks
- Bare text or `>`, at least one character typed; never under `#` (filters only) or for empty text (it would push the pages out of the Page group). At most three rows, the busiest first among equal matches.
- The best three are chosen by their own match, so an exact name is never crowded out by busier projects that start with it.
- Bare text: rank at least PREFIX, so it is never exact and auto-chipping picks the project row. The Page group then follows the Project group.
- `>`: the match's own rank, so `>jobdesk` matches exactly and auto-chips, unless a page matches exactly: `>errors` stays Errors when a project is named `errors`.
- At equal rank the pages come before project pages, whose session counts would otherwise win the tie, and project pages do not count toward the Page group's cap.
- Already picked: the row stays when only `#jobdesk` is set (the palette opens with it on a filtered page). It is left out when `>Project` is already a chip with that project, or when the palette is open on that project's page with no other page chip, where it would change nothing. The generic "Project" row is left out when a project-page row for the same project is listed.
