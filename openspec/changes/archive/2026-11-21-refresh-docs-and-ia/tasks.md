# Tasks

## 1. Pages

- [x] 1.1 Add `concepts/supported-agents.md`: the matrix of what Claude Code, Codex and Grok record, grounded in the parsers and the page docs (design D3).
- [x] 1.2 Add `everywhere/sheets.md` with the headings Session sheet, Project sheet, and Tool, MCP server and skill sheet (design D2).
- [x] 1.3 Add both pages to `web/src/docs.ts`, and rename `improve/compare-sources` to "Compare Claude Code, Codex and Grok". Verify with `docs.test.ts`.

## 2. Sidebar

- [x] 2.1 In `site/astro.config.mjs`, group the playbooks into Routines, Efficiency & limits, and Reliability & workflow; add Sheets to Everywhere and Supported agents to Concepts; name Grok in the description.
- [x] 2.2 Flatten nested groups for `starlight-llms-txt` with one recursive helper (design D1). Verify with `astro check` and `llms.txt` in the build.

## 3. Drift check

- [x] 3.1 Add `site/scripts/check-drift.mjs` (design D4) and run it from `npm run check`. Verify that it passes on the tree, and fails naming the token or file when a mirrored token or a shot's row is changed.

## 4. Spec

- [x] 4.1 Update `openspec/specs/documentation-site/spec.md` from this change's delta. Verify with `openspec validate --specs --strict`.

Done when: `cd site && npm run check` and `cd web && npm run check` pass.
