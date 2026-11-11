# Spec Delta

## Purpose

How AI Ledger reaches its users: its license, the package and command they install and run, its version, and the release that publishes each version.

## ADDED Requirements

### Requirement: License the project under MIT
The repository SHALL contain an MIT license at `LICENSE`, and the published package SHALL declare the MIT license in its metadata and include the license file.

#### Scenario: License in the repository
- **WHEN** a user opens the repository
- **THEN** `LICENSE` holds the MIT license text with the copyright holder and year

#### Scenario: License in the package
- **WHEN** a user inspects the published package's metadata
- **THEN** it names the license as MIT and the package contains the license file

### Requirement: Run the app as one command
The project SHALL publish a package named `ai-ledger` that provides an `ai-ledger` command. The command SHALL accept the same subcommands and options the app has, and `serve` SHALL stay the default subcommand.

#### Scenario: Run without installing
- **WHEN** a user with uv runs `uvx ai-ledger`
- **THEN** the app ingests transcripts and serves on `http://127.0.0.1:8765/`, with no clone and no Node

#### Scenario: Subcommands and options
- **WHEN** the user runs `ai-ledger rebuild --db <file>`
- **THEN** the app rebuilds the derived tables of that store and exits, as the source checkout's command does

#### Scenario: Module entry point
- **WHEN** the user runs `python -m ai_ledger` in an environment with the package installed
- **THEN** the app behaves as `ai-ledger` does

### Requirement: Ship the pages and prices with the package
The package SHALL contain the built frontend and the price table, so an installed app serves every page and prices every request with no file from the repository.

#### Scenario: Installed app serves every page
- **WHEN** the app runs from an installed package on a machine with no checkout and no Node
- **THEN** Activity, Cost, Errors, Limits, Insights and Live all load and work

#### Scenario: Installed app prices requests
- **WHEN** the app runs from an installed package
- **THEN** the Cost page prices requests with the price table from that package's version

### Requirement: Choose the port
The `serve` command SHALL accept `--port <number>`, default `8765`, and SHALL listen on `127.0.0.1` at that port and answer requests addressed to that port only. When the port is in use, the app SHALL exit with a message naming the port and the `--port` option.

#### Scenario: Second instance beside a running app
- **WHEN** the app serves on 8765 and the user runs `ai-ledger --db <copy> --port 8766`
- **THEN** the second app serves the copy at `http://127.0.0.1:8766/`

#### Scenario: Port in use
- **WHEN** another process holds port 8765 and the user runs `ai-ledger`
- **THEN** the app exits with status 1 and a message that names port 8765 and suggests `--port`

### Requirement: Report the version
The `ai-ledger --version` command SHALL print the installed package version and exit without opening the store.

#### Scenario: Version while the app runs
- **WHEN** the app is serving and the user runs `ai-ledger --version` in another terminal
- **THEN** the command prints the version, for example `ai-ledger 0.1.0`, and exits with status 0

### Requirement: Release from a version tag
Pushing a tag `v<version>` SHALL publish that version only after the web checks and the Python tests pass and the built package runs on macOS and Linux. The release SHALL publish the package to PyPI without a stored token and SHALL create a GitHub release whose notes are that version's `CHANGELOG.md` section.

#### Scenario: Successful release
- **WHEN** the maintainer pushes tag `v0.1.0` on a commit where every check passes and the package version is `0.1.0`
- **THEN** `ai-ledger` 0.1.0 is on PyPI, and the GitHub release `v0.1.0` carries the wheel, the source archive and the 0.1.0 changelog notes

#### Scenario: Failing check
- **WHEN** a test fails on the tagged commit
- **THEN** nothing is published to PyPI and no GitHub release is created

#### Scenario: Tag and version differ
- **WHEN** the tag is `v0.2.0` and the package version is `0.1.0`
- **THEN** the release stops before publishing and reports the mismatch

#### Scenario: Smoke test of the built package
- **WHEN** the release has built the wheel
- **THEN** on macOS and on Linux, running the wheel with `uvx` prints the version and serves the Activity page from a temporary store, before anything is published

### Requirement: Check every change
Every push to `main` and every pull request SHALL run the web checks, the Python tests and a package build, and SHALL report failure when any of them fails.

#### Scenario: Pull request with a stale build
- **WHEN** a pull request changes `web/src` without the matching committed build
- **THEN** the check fails
