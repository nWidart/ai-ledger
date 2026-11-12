# Tasks

## 1. Model

- [x] 1.1 Add `normalize` and `messageOf` (the ordered rules, memoized per error), with a test for each rule, the wrapper-line rule, the empty text, the label cap, and the group/apart cases.
- [x] 1.2 Add `msgGroups` (one pass, order, share, projects, tools) and `msgList` (search, linked group first, count line), with tests.
- [x] 1.3 Add `"msg"` to `Mode` and `loadMode`; add `openMsg` to the page state and open the linked example's group where its incident opens.

## 2. Page

- [x] 2.1 Add the By message button, the memoized groups, the rows (`MsgRow`) with the copy button, and paging inside a group.
- [x] 2.2 Add the styles.

## 3. Verify

- [x] 3.1 Add page tests: the mode switch (saved, restored), a group expanding, paging inside a group and of rows, the count line, search, a linked example, the copy button, the bucket and the tool filter. Update README, CHANGELOG and PARITY. Run `uv run ruff check && uv run python -m unittest discover -s tests && (cd web && npm run check) && openspec validate --specs --strict`.
