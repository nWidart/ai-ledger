# Proposal

## Why

The Release PR workflow asks the maintainer to pick `patch`, `minor` or `major`. The answer is already in the repository: the `[Unreleased]` section says whether something was added or removed, and the Conventional Commits say whether a change is a feature or breaking.

## What Changes

- **`auto` bump, the new default.** `scripts/release.sh` and the Release PR workflow accept `auto`. It reads `[Unreleased]` and the commit messages since the last tag, and takes the larger of the two readings:
  - major: a `### Removed` section or a `BREAKING` note in the changelog, a `type!:` subject, or a `BREAKING CHANGE:` footer;
  - minor: an `### Added` or `### Deprecated` section, or a `feat:` subject;
  - patch: anything else.
- **Before 1.0.0, a breaking change bumps minor,** so `auto` never releases 1.0.0 by itself.
- `patch`, `minor` and `major` stay as overrides.

## Capabilities

### Modified Capabilities
- `distribution`: the release PR picks its bump unless the maintainer names one.

## Impact

`scripts/release.sh`, `.github/workflows/release-pr.yml`, `AGENTS.md`.
