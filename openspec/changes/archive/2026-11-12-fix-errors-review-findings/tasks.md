# Tasks

## 1. Store and server

- [x] 1.1 `error_marks.fix_decided`: set by `set_error_fix`, untouched by `set_error_muted`; `import_error_fixes` takes a type with no row or an undecided one, in one statement. Backfill once, when `open_store` adds the column. Tests in `tests/test_store.py` and `tests/test_app.py`.
- [x] 1.2 `do_POST` answers 500 `{"error": "internal error"}` and logs the exception's type and message to stderr when a marks handler raises. Test with a patched store function.

## 2. Page

- [x] 2.1 Filters: Clear filters resets the agent; `pick` and the palette clear a bucket that has none of the type's errors; Back to types falls back to `tableFocus()`.
- [x] 2.2 Table: Share a plain header, `c-on` removed; time lost and Change (`Delta.pts`) sort as decided.
- [x] 2.3 Numbers and copy: the summary's open-fix count, the table hint, the no-calls chart point, open message groups per type.
- [x] 2.4 The chart box is `role="application"`.

## 3. Tests and docs

- [x] 3.1 Normalizer cost test with equal samples; `PARITY.md`; `README.md`; `CHANGELOG.md`.
- [x] 3.2 Run `uv run ruff check`, `uv run python -m unittest discover -s tests`, `uv run python -m unittest tests.test_web_fixtures`, `cd web && npm run check`, `openspec validate --specs --strict`; commit the build.
