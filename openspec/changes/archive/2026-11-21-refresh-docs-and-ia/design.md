# Design

## D1. Nested sidebar groups, flat llms.txt

Starlight accepts a group inside a group's `items`. Improve your workflow holds three such groups; the slugs inside them do not change, so every address the app and older links use still opens.

`starlight-llms-txt` takes flat slug lists: `promote` for the order of `llms-full.txt`, and `customSets` for one file per section. One helper, `slugs(group)`, flattens a group's items recursively, in sidebar order. `sidebarOrder` and `sidebarGroups` both use it, so `llms.txt` keeps one set per top-level group (Improve your workflow is one set, not three).

## D2. One page per shared surface

The sheets open over every page, so they get a page under Everywhere, beside the command palette and the context menu that also open them. Other pages link to its anchors, which come from the headings Session sheet, Project sheet, and Tool, MCP server and skill sheet. The docs registry (`web/src/docs.ts`) lists the page, and `docs.test.ts` checks its title.

## D3. One matrix for the agents

What each agent records is a fact of the parsers (`store.py`, `codex.py`, `grok.py`), not of a page. Supported agents holds it in one place, as tables by topic, one column per agent. Page docs keep their own sentences where a reader needs them in context, and link here for the whole picture.

## D4. Drift check

`check-drift.mjs` is plain Node, with no dependency, like `check-playbooks.mjs`.

- **Theme tokens.** It reads the first `:root { … }` block of `web/src/theme.css` and of `site/src/styles/custom.css`, drops comments, and compares each mirrored pair with whitespace removed: `--bg` with `--ai-bg`, the surfaces, border, control border, text, accent and on-accent tokens with their `--ai-` copies, and `--series-1`, `--good`, `--good-text`, `--warning`, `--warning-text`, `--critical`, `--critical-text` and `--proj-4` with the Starlight hues that copy them. `--ai-text-body` has no app token and is not checked.
- **Screenshots.** Every `<name>.png` needs `<name>-light.png`, and the reverse. Every shot name needs a row in `src/assets/shots/README.md` (a table row whose first cell is the name in backticks), and every row needs its files.

It names each mismatch and exits non-zero. `npm run check` runs it after `check-playbooks.mjs`.
