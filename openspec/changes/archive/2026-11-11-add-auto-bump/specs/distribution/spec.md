# Spec Delta

## MODIFIED Requirements

### Requirement: Open a release pull request
Starting the Release PR workflow on `main` SHALL open a pull request from `release/v<version>` that sets the next version in `pyproject.toml` and `uv.lock` and renames `[Unreleased]` in `CHANGELOG.md` to that version and date. The bump SHALL be `patch`, `minor` or `major` as named, or with `auto`, the default, the larger of what `[Unreleased]` and the Conventional Commits since the last tag call for. The PR body SHALL show that section, and CI SHALL run on it.

#### Scenario: Minor release
- **WHEN** the version is `0.1.3`, `[Unreleased]` has entries, and the maintainer starts the workflow with `minor`
- **THEN** a pull request from `release/v0.2.0` sets version `0.2.0`, moves the entries under `## [0.2.0] - <today>`, leaves an empty `[Unreleased]`, and adds the `[0.2.0]` link

#### Scenario: Nothing to release
- **WHEN** `[Unreleased]` has no entries
- **THEN** the workflow fails and opens no pull request

#### Scenario: Auto picks minor for an added feature
- **WHEN** `[Unreleased]` has an `### Added` section and every commit since the last tag is a `fix:`
- **THEN** `auto` bumps minor

#### Scenario: Auto picks patch for fixes
- **WHEN** `[Unreleased]` has only `### Changed` and `### Fixed` sections and no commit since the last tag is a `feat:` or breaking
- **THEN** `auto` bumps patch

#### Scenario: Auto picks major for a breaking change
- **WHEN** the version is `1.2.3` and a commit since the last tag has a `BREAKING CHANGE:` footer
- **THEN** `auto` bumps to `2.0.0`

#### Scenario: Breaking change before 1.0.0
- **WHEN** the version is `0.4.1` and a commit since the last tag is `feat!: drop the old store path`
- **THEN** `auto` bumps to `0.5.0`
