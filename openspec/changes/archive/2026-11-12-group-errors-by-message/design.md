# Design

## Context

The payload carries every error with its text (`e`, cut by ingest at 700 characters). A type can hold tens of thousands. The page already lists them as incidents (server groups) or one by one. The new list groups on the client, from `e.e` alone: no payload change, no full-text fetch.

## Decisions

- **`Mode` gains `"msg"`.** `loadMode` accepts `"msg"` besides `"flat"`; anything else is `"inc"`. The mode stays in `claude-errors-mode`, not in the hash.
- **`messageOf(e)` is memoized per error object** (a `WeakMap` keyed by the model's `Err`). Grouping is one pass over the listed errors, and the groups are memoized on what the list depends on (bucket, tool, type, filters), so a keystroke in the search box never re-runs the regexes or the grouping.
- **A group is `{ key, label, errs, n, share, last, projects, tools }`.** `errs` is newest first, `last` the newest time, `tools` the tools by count then name, `share` the group's part of the type's errors in the view (bucket and tool applied). The search does not change it, as it does not change a By project share: a number that moves while the reader types is worse than one that stays. `msgGroups(base)` sorts groups by count, then `last`, both descending.
- **`msgList(groups, q, focused, scope)`** mirrors `exList`: keeps the groups with an example matching `exHit(q)`, puts the linked example's group first, and words the count ("12 messages in range, most errors first", "3 of 12 match").
- **A group's open state is `openMsg`, a set of keys** beside `openInc`. The page opens the linked example's group where it opens its incident, so the example is in the DOM when the page scrolls to it. Inside a group, the linked example is first in the list.
- **Paging.** Rows: 20 a page, as incidents. Examples inside a group: 30 a page, as the flat list, with their own "Show more examples" button that resets with the list.
- **The row is a header button and a sibling copy button** (a button cannot hold a button). It reuses the incident row's grid and the open body's styles.

## Normalization

The function works on the first non-empty line of the text, trimmed. If that line is a bare wrapper (`Error:`, `Exit code N`, `<tool_use_error>`, alone on the line) and another non-empty line follows, the next line joins it with a space: the wrapper says nothing, the next line does. Only one line is added. Then, in order:

1. A quoted string (`"`, `'` or backtick) that starts like a path (`/`, `~/`, `./`, `../`, `C:\`, `C:/`) becomes the quote around `<path>`, whatever its length and contents (spaces, Unicode, backslashes). A lone `'/'` is no path.
2. Any other quoted string longer than 40 characters becomes `"<…>"`. A quote inside a word (`don't`) is not a quote. Short ones stay: they often name the command or flag.
3. Unquoted Windows paths (a drive letter, then `\` or `/`, up to a space or quote) become `<path>`. A scheme (`s://`) is no drive letter.
4. Absolute, `~/`, `./` and `../` paths become `<path>`, with Unicode letters and digits in the segments. A URL is left alone. An unquoted path with spaces cannot be told from prose: its first part is replaced and the rest stays.
5. A relative path with two or more slashes, or ending in an extension (`a/b/c.ext`, `src/x.ts`), becomes `<path>`. `and/or` stays.
6. UUIDs become `<id>`.
7. A lower-case word, `_` or `-`, then 8 or more letters and digits holding both a letter and a digit, becomes `<id>` (`toolu_…`, `call_…`, `msg_…`, `req_…`, `sess_…`, `chatcmpl-…`). `old_string`, `no_such_file` and `utf_8` stay.
8. Hex runs of 7 or more characters holding a digit and a letter (git hashes, `0x` addresses) become `<id>`. A plain number stays a number.
9. An ISO 8601 date or date-time (`T` or space, with or without seconds, fraction and zone) becomes one `<n>`, so the hour does not split a group. It needs a real shape (month 01-12, day 01-31, time in range) and no letter, digit or `-` after it: `2026-99-99` and `2026-11-04beta` fall to the number rule.
10. Numbers (also `10:01:02`, `1.5`, `0x1f`, and the digits before a unit: `30s`) become `<n>`. Digits inside a word (`utf8`, `E2BIG`) stay.
11. Whitespace collapses to single spaces.

The text is cut at 700 characters (the ingest cap) before the rules run, so the cost is bounded whatever a payload holds. Trailing dots are trimmed with a loop, never an end-anchored regex, which rescans the dots at each start. Every rule is linear in the line's length: the segments of a path are told apart by a character the segment cannot hold, and a test compares the per-call cost of adversarial lines at 700 and 5,600 characters (best of several runs; under 20x for 8x the length). 50,000 errors normalize in about 0.4 to 0.7 seconds, once.

The key is the result; the label is the key cut at 120 characters with `…`. The row shows the label with the key in its `title`; the copy button copies the key. An empty text has the key and label "(no error text)".

## Known limits

Normalization is a heuristic, and inside one error type it can over-merge. Accepted, because the group still opens to its examples and its copied key is what the user pastes:

- A quoted expression that starts with `/` is a path: `Invalid regex '/foo bar/'` and `Invalid regex '/foo baz/'` are one group, `Invalid regex '<path>'`.
- A prefix-id-shaped name is an id: `Cannot load lodash-4x17x21abc` and `Cannot load express-5x00x00abc` are one group, as are `Env foo_HTTP2SETTINGS is missing` and `Env foo_HTTP3SETTINGS is missing`.

## Risks

- Normalization hides real differences (two paths that matter). Accepted: the group opens to its examples, and the copied key is what the user pastes into a rule.
- The regexes cost O(length) per error and the text is at most 700 characters, so tens of thousands of errors normalize once in well under a second.
