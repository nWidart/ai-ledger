# Design

## Context

The payload carries every error with its text (`e`, cut by ingest at 700 characters). A type can hold tens of thousands. The page already lists them as incidents (server groups) or one by one. The new list groups on the client, from `e.e` alone: no payload change, no full-text fetch.

## Decisions

- **`Mode` gains `"msg"`.** `loadMode` accepts `"msg"` besides `"flat"`; anything else is `"inc"`. The mode stays in `claude-errors-mode`, not in the hash.
- **`messageOf(e)` is memoized per error object** (a `WeakMap` keyed by the model's `Err`). Grouping is one pass over the listed errors, and the groups are memoized on what the list depends on (bucket, tool, type, filters), so a keystroke in the search box never re-runs the regexes or the grouping.
- **A group is `{ key, label, errs, n, share, last, projects, tools }`.** `errs` is newest first, `last` the newest time, `tools` the tools by count then name. `msgGroups(base)` sorts groups by count, then `last`, both descending.
- **`msgList(groups, q, focused, scope)`** mirrors `exList`: keeps the groups with an example matching `exHit(q)`, puts the linked example's group first, and words the count ("12 messages in range, most errors first", "3 of 12 match").
- **A group's open state is `openMsg`, a set of keys** beside `openInc`. The page opens the linked example's group where it opens its incident, so the example is in the DOM when the page scrolls to it. Inside a group, the linked example is first in the list.
- **Paging.** Rows: 20 a page, as incidents. Examples inside a group: 30 a page, as the flat list, with their own "Show more examples" button that resets with the list.
- **The row is a header button and a sibling copy button** (a button cannot hold a button). It reuses the incident row's grid and the open body's styles.

## Normalization

The function works on the first non-empty line of the text, trimmed. If that line is a bare wrapper (`Error:`, `Exit code N`, `<tool_use_error>`, alone on the line) and another non-empty line follows, the next line joins it with a space: the wrapper says nothing, the next line does. Only one line is added. Then, in order:

1. A quoted string (`"`, `'` or backtick) longer than 40 characters becomes `"<…>"`. A quote inside a word (`don't`) is not a quote. Short ones stay: they often name the command or flag.
2. Absolute, `~/`, `./` and `../` paths become `<path>`. A URL is left alone.
3. A relative path with two or more slashes, or ending in an extension (`a/b/c.ext`, `src/x.ts`), becomes `<path>`. `and/or` stays.
4. UUIDs become `<id>`.
5. `toolu_`, `call_`, `msg_` and `req_` ids become `<id>`.
6. Hex runs of 7 or more characters holding a digit and a letter (git hashes, `0x` addresses) become `<id>`. A plain number stays a number.
7. Numbers (also `10:01:02`, `1.5`, `0x1f`, and the digits before a unit: `30s`) become `<n>`. Digits inside a word (`utf8`, `E2BIG`) stay.
8. Whitespace collapses to single spaces.

The key is the result; the label is the key cut at 120 characters with `…`. The row shows the label with the key in its `title`; the copy button copies the key. An empty text has the key and label "(no error text)".

## Risks

- Normalization hides real differences (two paths that matter). Accepted: the group opens to its examples, and the copied key is what the user pastes into a rule.
- The regexes cost O(length) per error and the text is at most 700 characters, so tens of thousands of errors normalize once in well under a second.
