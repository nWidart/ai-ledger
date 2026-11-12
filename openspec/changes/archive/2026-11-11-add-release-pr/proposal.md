# Proposal

## Why

A release today is five manual steps on `main`: set the version, run `uv lock`, date the changelog section, commit, push the tag. A missed step fails only after the tag is pushed, and nobody reviews the release notes before they go out. az-dashboard and jobdesk already release through a pull request; AI Ledger should work the same way.

## What Changes

- **Release PR workflow.** `.github/workflows/release-pr.yml`, started by hand on `main` with a `patch`, `minor` or `major` bump, runs `scripts/release.sh`. The script sets the next version in `pyproject.toml` and `uv.lock`, renames the `[Unreleased]` section of `CHANGELOG.md` to that version and date, adds its link, and commits on `release/vX.Y.Z`. The workflow pushes the branch and opens a PR whose body is the changelog section. The changelog stays hand-written; nothing is generated from commits.
- **Release on merge.** `.github/workflows/release.yml` runs when a `release/vX.Y.Z` PR merges into `main`, instead of on a tag push. It checks and smoke-tests the merge commit, then tags it, publishes to PyPI and creates the GitHub release. A failed check leaves no tag. It can also be run by hand with a tag, to release `main` after a fix.
- **`ci.yml` takes a `ref`,** so the release checks the merge commit, not the PR's merge ref.

Out of scope: generating changelog entries from commits, and picking the bump from the changelog.

## Capabilities

### Modified Capabilities
- `distribution`: releases start from a release PR and publish when it merges, not when a tag is pushed.

## Impact

- **New files:** `scripts/release.sh`, `.github/workflows/release-pr.yml`.
- **Changed files:** `.github/workflows/release.yml`, `.github/workflows/ci.yml`, `AGENTS.md`.
- **Outside the repo:** a `RELEASE_TOKEN` secret, a fine-grained personal access token with Contents and Pull requests read/write on this repository. A PR opened with `GITHUB_TOKEN` would start no CI. PyPI's trusted publisher keeps working because the publishing file is still `release.yml`.
