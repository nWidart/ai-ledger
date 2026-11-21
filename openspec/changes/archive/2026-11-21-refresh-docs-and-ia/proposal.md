# Proposal

## Why

The docs site has grown with the app, and its structure has not kept up:

- **Grok is half-documented.** The app reads Grok CLI transcripts, but what each agent records is spread over a dozen pages. A reader who wants to know why a Grok session has no tool time, or why Codex never reads **ended** on Live, has to find the one sentence that says so.
- **The sheets have no page of their own.** The session, project, tool, MCP server and skill sheets open over every page, but the docs describe them inside Activity, and other pages link there.
- **Eleven playbooks in one flat list.** Improve your workflow reads as one long list, with no hint of which playbook fits which goal.
- **Drift goes unnoticed.** `custom.css` copies the app's color tokens by hand, and `src/assets/shots/README.md` lists the screenshots by hand. Nothing fails when either falls behind.

## What Changes

- **Supported agents.** A new Concepts page, `concepts/supported-agents`, holds one matrix of what Claude Code, Codex and Grok record and how each shows across the app: transcripts and options, cost and plan limits, context and cache, session figures, titles, Live and resume.
- **Sheets.** A new Everywhere page, `everywhere/sheets`, describes the shared sheets once: their URL keys, Back, Escape, Wide, and stacking over Errors' type detail, with the anchors `#session-sheet`, `#project-sheet` and `#tool-mcp-server-and-skill-sheet`.
- **Grouped playbooks.** Improve your workflow holds three groups: Routines, Efficiency & limits, and Reliability & workflow. Every playbook keeps its slug. Compare Claude Code and Codex becomes Compare Claude Code, Codex and Grok.
- **Description.** The site's description names Claude Code, Codex and Grok.
- **Drift guards.** `site/scripts/check-drift.mjs`, run by `npm run check`, fails when a mirrored color token differs from the app's, when a screenshot lacks its other theme variant, or when the screenshots README and the PNG files disagree.

## Non-goals

- Changing the app's behavior, payloads or stored data.
- Moving or renaming any page address the app links to.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `documentation-site`: the grouped playbooks and the renamed comparison playbook, Sheets under Everywhere, Supported agents under Concepts, and the drift check.

## Impact

- `site/astro.config.mjs` (sidebar groups, description, flattening nested groups for `llms.txt`), `site/package.json`, `site/scripts/check-drift.mjs` (new).
- `site/src/content/docs/concepts/supported-agents.md` and `site/src/content/docs/everywhere/sheets.md` (new).
- `web/src/docs.ts`: the two new pages and the comparison playbook's new title.
- `openspec/specs/documentation-site/spec.md`.
