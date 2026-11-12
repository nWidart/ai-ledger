# Design

## Context

Labels are free-form text a model wrote. No fixed vocabulary exists to group by, and the store keeps only the raw `facet_counts` rows.

## Decisions

- **Computed, not stored.** Families come from pure functions over the payload's raw rows (`families.group`). A rule change takes effect on the next request, with no rebuild and no migration, and the store keeps what `/insights` wrote.
- **Rule format.** `families.RULES` maps a kind to an ordered list of `(family key, patterns)`, one line per rule, so adding a rule is adding a line. A pattern is a string; one with spaces is a token sequence (`"pull request"`, `"clean up"`).
- **Matching.** A name is lower-cased and split into tokens on `_`, `-`, spaces and `/`. A pattern matches when its tokens appear consecutively in the name's tokens. Whole tokens only: `express` does not match `pr`, `address` does not match `add`, and `prs` is its own pattern.
- **Rule order.** The first rule with a matching pattern wins, so order resolves overlap, most specific intent first. Goals: pull request, release, git cleanup, fix bug, tests, docs, review, refactor, configure, research, implement feature. `implement_feature` is last because `add`, `build`, `create` and `write` occur in many other labels (`create_pull_request`, `write_docs`, `write_tests`). `fix bug` comes before `tests`, so `fix_failing_test` and `debug_flaky_test` go to `fix_bug`, while `add_tests` and `improve_test_coverage` go to `tests`. Friction: misunderstood request, wrong approach, tooling, buggy code, excessive changes, rejected action, slow. `tooling` comes before `buggy_code`, so `tool_error` and `tool_failure` go to `tooling`.
- **No "Other" bucket.** A name no rule matches is a family of its own, keyed by the raw name, with one member. An "Other" bucket would grow into the largest row and say nothing; a single-member family shows the label as written and filters by it, so no label is lost or hidden behind a vague name. The unmatched labels stay in the ranking at their real count.
- **Family key.** The key is the family's name; the page shows it with underscores as spaces. A raw label equal to a key belongs to that family.
- **Counts.** `n` sums the members' counts. `sessions` counts distinct sessions in the view that carry any member: one query of distinct (name, session) pairs per kind, grouped in Python. Summing the members' sessions would count a session twice when it carries two members.
- **Raw rows stay.** `goals` and `friction` are unchanged: the lede, the session cards and the filters by raw name read them.
- **Filters.** A family row of two or more labels filters by `goalf=` or `frf=`; the client matches the family's member names from the payload and never re-implements the rules. A family of one label uses `goal=` or `fr=`. A family key the view lacks matches no session, so the list shows its existing empty state.
- **Controls.** The row's filter button and the expander are siblings, never nested: a button inside a button is invalid and breaks keyboard and screen reader use. `LedgerRow` takes children that render after its button.

## Risks

- A keyword can mislead: a bare `merge_*` goal lands in git cleanup, and `wrong_test_failure` in wrong approach, as the first matching rule wins. The raw names on expand show what was grouped, and a rule is one line to change.
