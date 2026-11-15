# Proposal

## Why

The docs site uses Starlight's default theme: system font, blue accent, cool greys. The app it documents uses IBM Plex Sans, warm greys and one clay accent. A reader who moves from a screenshot to the page around it, or from the app to its docs, lands somewhere that looks like another product. Its screenshots, on warm surfaces, sit in a page that does not match them.

## What Changes

- **The site takes the app's look.** The app's color tokens (`web/src/theme.css`) are mapped onto Starlight's CSS custom properties in `site/src/styles/custom.css`, in light and dark: the page and surface colors, borders, text greys, the clay accent for links, focus and the current page, and the app's status colors for asides. A small CSS layer gives the title bar, sidebar, search, code frames, asides, cards and the phone menu button the app's surfaces, borders and radii. No Starlight component is overridden.
- **Same typeface.** IBM Plex Sans (400, 400 italic, 500, 600), self-hosted from `@fontsource/ibm-plex-sans`, pinned. The site asks no third party for a font.
- **Same mark.** The app's logo shows in the title bar and as the favicon (which was missing).
- **AA contrast in both themes** is now a requirement: text, links and control states at WCAG AA, focus visible.
- Nothing else changes: search, `llms.txt`, the link check, the playbook check, `ThemedImage` and its reduced-motion stills, the sidebar order.

## Capabilities

### Modified Capabilities

- `documentation-site`: the light and dark themes follow the app's typeface and colors, pass WCAG AA contrast, and load no font from a third party.

## Impact

- `site/src/styles/custom.css`, `site/astro.config.mjs`, `site/src/assets/mark.svg`, `site/public/favicon.svg`.
- `site/package.json` and `site/package-lock.json`: `@fontsource/ibm-plex-sans` 5.3.0 (OFL-1.1).
- `site/README.md`, `CHANGELOG.md`.
- No change to the app, its payloads or the Python package.
