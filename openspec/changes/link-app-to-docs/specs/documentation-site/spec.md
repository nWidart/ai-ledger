## ADDED Requirements

### Requirement: Keep the addresses the app links to
A docs page or heading that a released version of the app links to SHALL keep its address when it is renamed or removed, either by keeping its path or by a redirect from the old address to the page that replaced it. `site/README.md` SHALL say that the app links to the docs through `web/src/docs.ts`, and that a rename there needs a redirect.

#### Scenario: A renamed page
- **WHEN** `concepts/windows` is renamed and an installed, older app links to `https://nwidart.github.io/ai-ledger/concepts/windows/`
- **THEN** that address opens the renamed page

#### Scenario: A removed page
- **WHEN** a docs page the app linked to is removed
- **THEN** its address redirects to the page that now holds its content, or to the docs home
