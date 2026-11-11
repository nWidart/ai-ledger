# Tasks

## 1. Store queries

- [x] 1.1 Add `HELPER_SESSIONS` (no prompt, or at most one prompt in `(temp)`, over the whole session) and leave those sessions out in `scope()` unless automated. Verify with a `test_metrics.py` case: a one-prompt `(temp)` session and a prompt-less one are out by default and in with automated; a two-prompt `(temp)` session stays.
- [x] 1.2 Count active days from prompt days in `usage()` and `previous_period()`. Verify with a case where a day has a request and no prompt.
- [x] 1.3 Give every session in the existing test fixtures a prompt, so they stay out of the new rule.

## 2. Docs

- [x] 2.1 Say in `README.md` which sessions are automated and that **Include automated** shows them.
