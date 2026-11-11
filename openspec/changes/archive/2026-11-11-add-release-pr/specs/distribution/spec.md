# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Release from a version tag`
- TO: `### Requirement: Release when a release pull request merges`

## MODIFIED Requirements

### Requirement: Release when a release pull request merges
Merging a pull request from `release/v<version>` into `main` SHALL tag the merge commit `v<version>` and publish it only after the checks pass on that commit and the built package runs on macOS and Linux. The release SHALL publish to PyPI without a stored token and SHALL create a GitHub release whose notes are that version's `CHANGELOG.md` section. The maintainer SHALL be able to start the same release by hand on `main` with a tag.

#### Scenario: Successful release
- **WHEN** the maintainer merges the PR from `release/v0.2.0`, every check passes and the package version is `0.2.0`
- **THEN** the merge commit is tagged `v0.2.0`, `ai-ledger` 0.2.0 is on PyPI, and the GitHub release `v0.2.0` carries the wheel, the source archive and the 0.2.0 changelog notes

#### Scenario: Failing check
- **WHEN** a test fails on the merge commit
- **THEN** no tag is pushed, nothing is published to PyPI and no GitHub release is created

#### Scenario: Tag and version differ
- **WHEN** the branch is `release/v0.2.0` and the package version is `0.1.0`
- **THEN** the release stops before tagging and reports the mismatch

#### Scenario: Other pull requests
- **WHEN** a PR from any branch not named `release/v<version>` merges, or a release PR closes without merging
- **THEN** no release runs

#### Scenario: Smoke test of the built package
- **WHEN** the release has built the wheel
- **THEN** on macOS and on Linux, running the wheel with `uvx` prints the version and serves the Activity page from a temporary store, before anything is tagged or published

## ADDED Requirements

### Requirement: Open a release pull request
Starting the Release PR workflow on `main` with a `patch`, `minor` or `major` bump SHALL open a pull request from `release/v<version>` that sets the next version in `pyproject.toml` and `uv.lock` and renames the `[Unreleased]` section of `CHANGELOG.md` to that version and date. The pull request body SHALL show that changelog section, and CI SHALL run on it.

#### Scenario: Minor release
- **WHEN** the version is `0.1.3`, `[Unreleased]` has entries, and the maintainer starts the workflow with `minor`
- **THEN** a pull request from `release/v0.2.0` sets version `0.2.0`, moves the entries under `## [0.2.0] - <today>`, leaves an empty `[Unreleased]`, and adds the `[0.2.0]` link

#### Scenario: Nothing to release
- **WHEN** `[Unreleased]` has no entries
- **THEN** the workflow fails and opens no pull request
