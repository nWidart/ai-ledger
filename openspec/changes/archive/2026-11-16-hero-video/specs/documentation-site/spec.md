## ADDED Requirements

### Requirement: Play the Home page tour as a video
The Home page SHALL play the tour as a muted, looping MP4 video made from the same frames as the tour GIF, in the variant the current theme shows. Only the visible variant SHALL load and play, and only while it is on screen. A button on the video SHALL pause and resume it.

#### Scenario: Tour plays in the current theme
- **WHEN** a visitor opens the Home page in the light theme
- **THEN** `tour-light.mp4` plays and `tour.mp4` is not downloaded

#### Scenario: Theme switch
- **WHEN** the visitor switches the site to dark while the tour plays
- **THEN** the light video pauses and the dark video plays

#### Scenario: Pause
- **WHEN** the visitor activates the tour's pause button by mouse or keyboard
- **THEN** the video stops, and the button now offers to play it

## MODIFIED Requirements

### Requirement: Build and deploy the site
The repository SHALL hold a documentation site in `site/`, an npm project separate from `web/` with exact dependency versions and a committed lock file. One command, `npm run check` in `site/`, SHALL check and build it. A workflow SHALL build the site on every pull request that changes `site/`, `docs/*.gif`, `docs/*.mp4`, `CHANGELOG.md` or the workflow itself, and SHALL deploy it from `main` to GitHub Pages at `https://nwidart.github.io/ai-ledger/`. A pull request SHALL NOT deploy.

#### Scenario: Pull request touching the site
- **WHEN** a pull request changes a file under `site/`
- **THEN** the docs workflow runs `npm run check` in `site/`, fails the pull request if it fails, and deploys nothing

#### Scenario: Merge to main
- **WHEN** a commit that changes `site/` lands on `main`
- **THEN** the workflow builds the site and `https://nwidart.github.io/ai-ledger/` serves the new build

#### Scenario: App-only change
- **WHEN** a pull request changes only files under `src/` or `web/`
- **THEN** the docs workflow does not run

### Requirement: Work in light and dark, by keyboard and screen reader
The site SHALL offer light and dark themes that follow the system setting until the reader picks one, and every page, image included, SHALL be readable in both. Every control SHALL work by keyboard with a visible focus. Every image and video SHALL have alternative text, and one shown in two theme variants SHALL be announced once. With reduced motion requested, the site SHALL show a still image in place of each animated GIF and SHALL not play any video.

#### Scenario: Switch theme
- **WHEN** the reader switches the site to light on a page with a screenshot
- **THEN** the page and the screenshot show their light variants

#### Scenario: Keyboard only
- **WHEN** the reader uses only the keyboard on any page
- **THEN** they can reach the sidebar, search, theme picker and every link, and see where focus is

#### Scenario: Reduced motion
- **WHEN** the reader's system asks for reduced motion and they open the Home page
- **THEN** a still screenshot shows in place of the tour, and no video plays

### Requirement: Keep the docs in step with the app
Reference pages SHALL describe what the app does, and each SHALL name the specs it was written from. The Changelog page SHALL be built from `CHANGELOG.md` at build time, with no copy of it kept in git. The GIFs in `docs/*.gif` and the videos in `docs/*.mp4` SHALL stay at their paths, and the site SHALL use them from there, with no second copy in git.

#### Scenario: Changelog edit
- **WHEN** a commit adds an entry to `CHANGELOG.md` on `main`
- **THEN** the deployed Changelog page shows the entry, and no other file in git changed to make it so

#### Scenario: Published README links
- **WHEN** a reader opens a README on PyPI that links to `https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/tour.gif`
- **THEN** the GIF still loads after the site ships
