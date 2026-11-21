# documentation-site Specification

## Purpose

Publishes AI Ledger's documentation at https://nwidart.github.io/ai-ledger/: how to install it, what each page shows, and goal-first playbooks that turn what the pages show into concrete changes to a user's coding-agent workflow.

## Requirements

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

### Requirement: Order the sidebar by what the reader came for
The sidebar SHALL list, in this order: Home; Get started; Improve your workflow; Pages; Everywhere; Concepts; Reference; Changelog. Each group SHALL hold its pages in the order the requirements below give them.

#### Scenario: Sidebar order
- **WHEN** the reader opens any page of the built site
- **THEN** the sidebar groups appear in the order above, with each group's pages in the order the requirements below give

### Requirement: Hold the tutorials and playbooks
Get started SHALL hold Install and first run, 15-minute first tour, and Upgrade and rebuild. Improve your workflow SHALL hold eleven playbooks: Weekly 15-minute review, Spend less for the same output, Stop hitting plan limits, Keep context lean, Kill repeated tool failures, Babysit agents less, Get sessions to finish, Retro on one project, Compare Claude Code and Codex, Separate automated sessions from yours, and Share your screen safely.

#### Scenario: Playbooks listed
- **WHEN** the reader expands Improve your workflow
- **THEN** it lists the eleven playbooks, Weekly 15-minute review first and Share your screen safely last

### Requirement: Hold the reference and explanation pages
Pages SHALL hold, in the app's order: Live, Limits, Activity, Judgments, Cost, Context, Errors, Project. Everywhere SHALL hold the command palette, the context menu, filters, keyboard and screen reader use, and data tables. Concepts SHALL hold How AI Ledger works, How cost is estimated, Context windows and plan limit windows, and Privacy and security model. Reference SHALL hold CLI and options, Configuration, Metric glossary, Data files and storage locations, and Troubleshooting and FAQ.

#### Scenario: One page per dashboard
- **WHEN** the reader expands Pages
- **THEN** it lists Live, Limits, Activity, Judgments, Cost, Context, Errors and Project, in that order

#### Scenario: Home page
- **WHEN** the reader opens `https://nwidart.github.io/ai-ledger/`
- **THEN** the page says what AI Ledger does, shows the tour GIF, the install command, the questions each dashboard answers, the privacy model and a short FAQ, and offers three cards: Start, Improve and Look up, each linking into its section

### Requirement: Write every playbook to one template
Every playbook SHALL have these sections, in this order and no others at the same level: Goal (one sentence), Signs you need it (which page and figure to check), Diagnose (how to find the cause in the data), Act (a concrete change: a CLAUDE.md or AGENTS.md snippet, a setting or a habit), Verify (which figure should move, and over how many days), and Related (links to Pages and Concepts pages). Every figure a playbook names SHALL be one the app shows.

#### Scenario: Playbook shape
- **WHEN** the reader opens Keep context lean
- **THEN** it has Goal, Signs you need it, Diagnose, Act, Verify and Related, in that order

### Requirement: Check the playbook template
The site's check SHALL fail when a playbook lacks a template section, adds one at the same level, or orders them otherwise.

#### Scenario: Missing section
- **WHEN** an author removes the Verify section from a playbook and runs `npm run check`
- **THEN** the check fails and names the playbook and the missing section

### Requirement: Search the docs offline
The built site SHALL include a full-text search index that runs in the browser, with no hosted search service. Search SHALL cover every page, the changelog included.

#### Scenario: Search a built copy
- **WHEN** the reader serves `site/dist/` locally with no network access and searches for `cache hit`
- **THEN** the results list the pages that mention it

### Requirement: Publish the docs for coding agents
The built site SHALL publish `llms.txt`, an index of the site with a short description of AI Ledger, and `llms-full.txt`, the text of every page, at the site root. Both SHALL be generated from the pages at build time.

#### Scenario: Agent fetches the docs
- **WHEN** a coding agent fetches `https://nwidart.github.io/ai-ledger/llms.txt`
- **THEN** it receives plain text that links to every section, and `llms-full.txt` holds the playbooks' text

### Requirement: Fail the build on a broken internal link
The site's build SHALL fail when a page links to a page or heading anchor of the site that does not exist.

#### Scenario: Link to a missing page
- **WHEN** an author links to `/ai-ledger/pages/costs/` and runs `npm run check`
- **THEN** the build fails and names the page with the broken link

#### Scenario: Link to a missing anchor
- **WHEN** an author links to `/ai-ledger/reference/configuration/#nope`
- **THEN** the build fails

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

### Requirement: Look like the app
Both themes SHALL use the app's typeface and colors, and SHALL meet WCAG 2.2 AA contrast for text, links and control states. The site SHALL serve its font itself and SHALL ask no third party for it.

#### Scenario: Same type and colors
- **WHEN** the reader opens any page in either theme
- **THEN** the page uses the app's typeface, its page and surface colors and its accent color

#### Scenario: AA contrast
- **WHEN** the reader opens any page, or the search dialog with results, in either theme
- **THEN** every text element meets WCAG AA contrast on its background, and the focus ring meets 3:1

#### Scenario: No third-party font request
- **WHEN** the reader's browser loads any page
- **THEN** it fetches the font from the site itself and makes no request to a font service

### Requirement: Keep the docs in step with the app
Reference pages SHALL describe what the app does, and each SHALL name the specs it was written from. The Changelog page SHALL be built from `CHANGELOG.md` at build time, with no copy of it kept in git. The GIFs in `docs/*.gif` and the videos in `docs/*.mp4` SHALL stay at their paths, and the site SHALL use them from there, with no second copy in git.

#### Scenario: Changelog edit
- **WHEN** a commit adds an entry to `CHANGELOG.md` on `main`
- **THEN** the deployed Changelog page shows the entry, and no other file in git changed to make it so

#### Scenario: Published README links
- **WHEN** a reader opens a README on PyPI that links to `https://raw.githubusercontent.com/nWidart/ai-ledger/main/docs/tour.gif`
- **THEN** the GIF still loads after the site ships

### Requirement: Take screenshots only from the synthetic store
Every screenshot on the site SHALL come from the synthetic demo store in `tools/demo/`. The screenshot script SHALL start the demo server itself and SHALL refuse to take any shot when port 8799 is already in use, so a real store cannot be on the other end.

#### Scenario: Record screenshots
- **WHEN** an author seeds the demo store and runs the screenshot mode of `tools/demo/record.mjs`
- **THEN** it writes each page's panel screenshots, dark and light, into the site from the demo store

#### Scenario: Port already in use
- **WHEN** another server answers on 127.0.0.1:8799 and the author runs the screenshot mode
- **THEN** the script exits with an error and writes no screenshot

### Requirement: Replace the user guide with the site
`docs/guide.md` SHALL become a short stub that links to the site and keeps its old headings, each linking to the site page that replaced it.

#### Scenario: Old guide link
- **WHEN** a reader follows a published link to `docs/guide.md#configuration`
- **THEN** the stub's Configuration heading links to the site's Configuration page

### Requirement: Link to the docs from the package and the README
`pyproject.toml` SHALL list `https://nwidart.github.io/ai-ledger/` as the `Documentation` URL, and `README.md` SHALL link to the site.

#### Scenario: PyPI page
- **WHEN** the next release is published to PyPI
- **THEN** its project links include Documentation, pointing to the site

#### Scenario: README
- **WHEN** a reader opens `README.md`
- **THEN** it links to the site for the full documentation

### Requirement: Lead the Home page to an install
The Home page SHALL name Claude Code, Codex and Grok in its heading, SHALL offer a hero install action that leads to the `uvx ai-ledger` command with its prerequisites, and SHALL repeat that command at the end of the page.

#### Scenario: Install from the hero
- **WHEN** a visitor opens `https://nwidart.github.io/ai-ledger/` and selects the hero's install action
- **THEN** the page shows the `uvx ai-ledger` command with a copy button, the need for uv, and macOS and Linux as supported systems

#### Scenario: Heading names the agents
- **WHEN** a visitor opens the Home page
- **THEN** its heading names Claude Code, Codex and Grok

### Requirement: Answer the privacy objection on the Home page
The Home page SHALL say in plain terms where transcripts are stored, what the app sends over the network, and that it is free and open source. It SHALL make only claims the app's code and docs support, and SHALL show no invented testimonial or count.

#### Scenario: Privacy answered
- **WHEN** a visitor reads the Home page
- **THEN** it says the store stays on their machine, the server listens on 127.0.0.1 only, and the one outbound call the app makes with their credentials

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

### Requirement: Document the Judgments view on its own page
The docs SHALL describe Activity's Judgments view on a page of its own, named Judgments, listed after Activity. The page SHALL keep the address it had as the Insights page, so links to it still open.

#### Scenario: An old link to the Insights page
- **WHEN** the reader opens the address the Insights page had
- **THEN** the Judgments page opens

### Requirement: Keep the addresses the app links to
A docs page or heading that a released version of the app links to SHALL keep its address when it is renamed or removed, either by keeping its path or by a redirect from the old address to the page that replaced it. `site/README.md` SHALL say that the app links to the docs through `web/src/docs.ts`, and that a rename there needs a redirect.

#### Scenario: A renamed page
- **WHEN** `concepts/windows` is renamed and an installed, older app links to `https://nwidart.github.io/ai-ledger/concepts/windows/`
- **THEN** that address opens the renamed page

#### Scenario: A removed page
- **WHEN** a docs page the app linked to is removed
- **THEN** its address redirects to the page that now holds its content, or to the docs home
