# Design

## Context

`release.yml` runs on a `v*` tag push: it calls `ci.yml` with the tag (whose `package` job fails unless the tag is `v<package version>` and uploads `dist`), smoke-tests the wheel on macOS and Linux, publishes to PyPI through the `pypi` environment with trusted publishing, then creates the GitHub release from the version's `CHANGELOG.md` section. `CHANGELOG.md` follows Keep a Changelog and keeps a hand-written `[Unreleased]` section.

## Decisions

### Same shape as az-dashboard and jobdesk
A dispatch workflow opens a `release/vX.Y.Z` PR; merging it runs the release, which tags only after the build passes. The tag, the commit and the version all come from the branch name and the merge commit, not from the PR title, so editing the squash subject changes nothing.

### Keep the hand-written changelog
The sibling projects generate their changelog with git-cliff. Here the `[Unreleased]` section is curated prose, richer than squash subjects, so the script only renames it. An empty `[Unreleased]` stops the script. The bump is an input (default `patch`), because the changelog does not say how big a change is.

### Keep the file name `release.yml`
PyPI's trusted publisher names the workflow file. The PR opener gets a new file, `release-pr.yml`, and the publisher stays `release.yml`, so PyPI needs no change.

### Order: check, smoke, tag, publish, release
The tag is pushed only after the checks and the smoke test pass. It is pushed with `GITHUB_TOKEN`, which starts no other workflow, and `release.yml` no longer listens for tags anyway. Each later job tolerates a re-run: the tag job keeps a tag already on the same commit, and the release job uploads to an existing release.

### `ci.yml` checks out `inputs.ref`
On a `pull_request` `closed` event the default checkout is the PR's merge ref, which is not the merged commit. `ci.yml` gains a `ref` input; an empty value keeps today's behaviour for pushes and PRs.

## Risks

- A PyPI publish that fails after the tag leaves a tag without a package. Re-running the failed jobs finishes the release.
- A rebase merge with several commits releases the last one, which holds the whole PR; a release PR has one commit.
