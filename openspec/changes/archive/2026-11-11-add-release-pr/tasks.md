# Tasks

## 1. Release PR

- [x] 1.1 Add `scripts/release.sh patch|minor|major`: stop on a dirty tree, an existing tag or an empty `[Unreleased]`; otherwise rename `[Unreleased]` to the new version and date, add its link, set the version with `uv version`, and commit `chore: release X.Y.Z` on `release/vX.Y.Z`. Verify on a scratch clone, with and without `[Unreleased]` entries.
- [x] 1.2 Add `.github/workflows/release-pr.yml`: on `main` only, run the script, refuse an existing tag or branch on origin, push with `RELEASE_TOKEN` and open the PR with the changelog section as its body.

## 2. Release on merge

- [x] 2.1 Add a `ref` input to `ci.yml` and pass it to every checkout.
- [x] 2.2 Make `release.yml` run on a merged `release/vX.Y.Z` PR into `main` from this repository, or by hand with a tag on `main`; read the tag and commit, check the changelog section, call `ci.yml` with both, smoke-test, tag, publish to PyPI and create the GitHub release; delete the release branch.
- [x] 2.3 Verify with `actionlint`.

## 3. Docs

- [x] 3.1 Update the release rule in `AGENTS.md`.
