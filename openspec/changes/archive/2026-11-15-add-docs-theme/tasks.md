# Tasks

## 1. Theme

- [x] 1.1 Add `@fontsource/ibm-plex-sans` 5.3.0, pinned, and import its latin 400, 400 italic, 500 and 600 faces in `astro.config.mjs`.
- [x] 1.2 Map the app's tokens onto Starlight's custom properties in `site/src/styles/custom.css`, light and dark (D2).
- [x] 1.3 Style the title bar, sidebar, search, asides, cards, previous/next links, phone menu button, links and focus ring (D3); set the code frames' radius and shadow in `astro.config.mjs`.
- [x] 1.4 Add the app's mark as the logo (`src/assets/mark.svg`) and the favicon (`public/favicon.svg`).

## 2. Verify

- [x] 2.1 Screenshot the site before and after, light and dark, at 1280 and 390 px, next to the app on the demo store; no page scrolls sideways at 390 px.
- [x] 2.2 Measure contrast on every built page and the search dialog, both themes; no text element under AA. Record the lowest pairs in the design.
- [x] 2.3 Check keyboard focus is visible on the bar, sidebar and content links, and that `ThemedImage` still switches with the theme.
- [x] 2.4 Check the built pages make no request to a font service.

## 3. Docs and checks

- [x] 3.1 Update `site/README.md` (what `custom.css` holds and its rules).
- [x] 3.2 Fold the theme into the docs site's `[Unreleased]` entry in `CHANGELOG.md`.
- [x] 3.3 Run `cd site && npm ci && npm run check`, `openspec validate add-docs-theme --strict` and `openspec validate --specs --strict`.
