# Spec Delta

## ADDED Requirements

### Requirement: List a type's errors by message
The open type's detail SHALL offer a third list, "By message", beside Incidents and Every error, saved like them. It SHALL hold the errors they hold (the type's errors in the view, narrowed by the selected bucket and tool), one row per normalized message: count, message, share of the type's errors in the view, project count, top two tools with "+N", newest time. The share SHALL not change with the search. Rows SHALL be ordered most errors first, the most recent first on a tie.

#### Scenario: Group by message
- **WHEN** a type holds 35 errors with one message that differs only by a number, and 8 others
- **THEN** By message lists "35×" first with its share, and the other messages after it

#### Scenario: Switch and restore
- **WHEN** the user picks By message and reloads the page
- **THEN** By message is pressed again, and focus stayed on its button when it was picked

#### Scenario: Bucket and tool
- **WHEN** a bucket or tool is selected
- **THEN** only that bucket's and tool's errors are grouped, and the shares count them

#### Scenario: Share and search
- **WHEN** the user searches
- **THEN** each listed group keeps the share it had without the search

### Requirement: Search and count messages
In By message the search box SHALL keep the groups that have an example matching it. The count line SHALL read "N messages in range, most errors first" (the bucket's granularity in place of "range" when one is selected), and "N of M match" while searching. Each search change SHALL be announced like the other lists.

#### Scenario: Search
- **WHEN** the user types a word that one group's example holds
- **THEN** only that group is listed, and the count reads "1 of 5 match"

### Requirement: Open a message group
A message row SHALL be a button with `aria-expanded` that opens the group's examples, newest first, thirty at a time with a "Show more examples" button that moves focus to the first new example. A linked example SHALL open its group, listed first and first within it. A copy button on each row SHALL copy the normalized message and say whether it worked, to sight and to screen readers.

#### Scenario: Open and page
- **WHEN** the user opens a group of 35 errors
- **THEN** 30 examples show, newest first, and Show more examples adds the other 5

#### Scenario: Linked example
- **WHEN** a link names an example in a small group of a type with a larger one
- **THEN** its group is listed first and open, and the example is first, focused and in view

#### Scenario: Copy
- **WHEN** the user presses a row's copy button
- **THEN** the normalized message is on the clipboard and the button reads "Copied ✓"; a refused write reads "Copy failed"

### Requirement: Normalize an error message
The page SHALL group errors by a normalized form of the error text: its first non-empty line, plus the next when the first is only a wrapper (`Error:`, `Exit code N`); paths (quoted or not, POSIX or Windows) by `<path>`; UUIDs, prefixed ids (`sess_…`) and hex runs of 7 or more by `<id>`; dates, times and numbers by `<n>`; other quoted strings over 40 characters by `<…>`; whitespace collapsed. An empty text SHALL group as "(no error text)". Each error SHALL be normalized once.

#### Scenario: Incidental detail
- **WHEN** two errors differ only by a path, a number or an id
- **THEN** they are one group

#### Scenario: Quoted paths and timestamps
- **WHEN** two errors differ only by a quoted path (any length, with spaces) or by an ISO timestamp
- **THEN** they are one group

#### Scenario: Different messages
- **WHEN** two errors differ in their words, or in a short quoted command name
- **THEN** they are two groups
