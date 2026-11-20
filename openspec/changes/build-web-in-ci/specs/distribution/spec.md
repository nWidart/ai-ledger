## ADDED Requirements

### Requirement: Build the frontend in CI
The repository SHALL NOT track the frontend build in `src/ai_ledger/web/`. CI SHALL build it from `web/` at the checked commit on every run, and the Python tests and the package SHALL use that build. A source checkout with no build SHALL answer each page with status 503 and a message that names the build command.

#### Scenario: Pull request that changes the frontend
- **WHEN** a pull request changes `web/src`
- **THEN** its diff holds no file under `src/ai_ledger/web/`, and CI builds the frontend from the changed sources before the Python tests and the package build

#### Scenario: Package from the checked commit
- **WHEN** CI builds the package
- **THEN** the wheel holds the frontend built from `web/` at that commit, and the check fails when the wheel holds no `index.html` or no script under `assets/`

#### Scenario: Checkout without a build
- **WHEN** a user runs `uv run ai-ledger` in a fresh clone without running `npm run build` in `web/`
- **THEN** each page answers 503 with a message that names `npm run build` in `web/`

## MODIFIED Requirements

### Requirement: Check every change
Every push to `main` and every pull request SHALL run the web checks, the Python tests and a package build, and SHALL report failure when any of them fails.

#### Scenario: Pull request with a stale build
- **WHEN** a pull request changes `web/src` and a contributor's local build is older than the sources
- **THEN** CI ignores that local build: it builds the frontend from the pull request's sources, so the tests and the package never see a stale build

#### Scenario: Pull request that breaks the build
- **WHEN** a pull request changes `web/src` so that `npm run build` fails
- **THEN** the check fails and no package is built
