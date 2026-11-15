# Design

## Context

`add-docs-site` (design D10) kept Starlight's default colors. The site is Astro 7.4.12 with Starlight 0.43.1. The app's look lives in `web/src/theme.css` (tokens, each `light-dark(light, dark)`), `web/src/components/Nav.css` (the bar and its active tab) and `web/src/components/InsightCard.css` (cards with a severity bar). The reader asked for a theme close to the app, and pointed at `starlight-theme-obsidian` for its layout and feel.

## Decisions

### D1. Own theme on Starlight's custom properties, not `starlight-theme-obsidian`

`starlight-theme-obsidian` 0.4.1 (last release August 2025) declares `@astrojs/starlight >=0.33.0` and `astro >=5.5.0`, so npm accepts it, but nobody has tested it with Starlight 0.43 or Astro 7. It overrides five Starlight components (`PageFrame`, `Sidebar`, `ThemeSelect`, `Pagination`, `PageSidebar`) and adds `starlight-site-graph`, a WebGL graph with its own peer dependency. Each override copies Starlight internals that change between minor versions, and the graph is a feature the site does not need. Re-skinning it would mean fighting its own colors as well.

What makes it look as it does is CSS: one background for the bar, sidebar and page; no rule under the title or beside the table of contents; rounded asides and code frames. The theme takes those ideas in CSS and the app's tokens on top.

So `site/src/styles/custom.css` holds the app's tokens under an `--ai-` prefix and maps them onto Starlight's `--sl-color-*` ramp, then styles a few elements. It is unlayered, so it wins over Starlight's layered styles without `!important`. The one exception is the focus ring, set in `@layer starlight.base` so that components that draw their ring inside (sidebar, tabs, table of contents) keep their offset.

Rejected: overriding Starlight components for the app's wordmark ("AI" light, "Ledger" bold) or its insight-card marks. CSS cannot split the title, and the gain is small. The asides keep Starlight's icons, colored by status.

### D2. Token mapping

Starlight's ramp runs from the strongest text (`white`) to the page (`black`) in both themes. Starlight sets `color-scheme` from `data-theme`, so each token is one `light-dark()` pair and follows the theme picker.

| Starlight | App token | Light | Dark |
| --- | --- | --- | --- |
| `white` (headings) | `--text-primary` | `#0b0b0b` | `#f0efec` |
| `gray-2`, `text` (body) | between primary and secondary | `#2e2d2a` | `#d6d5cc` |
| `gray-3` (muted: table of contents, descriptions) | `--text-muted` | `#66655f` | `#9d9c94` |
| `gray-4` | `--control-border` | `#8e8c85` | `#75746d` |
| `gray-5`, hairlines | `--border` | `#e2e0da` | `#33332f` |
| `gray-6` | `--surface-2` / `--surface-1` | `#f0efec` | `#1a1a19` |
| `gray-7`, nav bar, code | `--surface-1` | `#fcfcfb` | `#1a1a19` |
| `black`, page, sidebar | `--bg` | `#f6f5f2` | `#121211` |
| `accent` (focus, borders) | `--accent` | `#b4502a` | `#e8895f` |
| `text-accent`, `accent-high` (links) | `--accent-ink` | `#8f3d1e` | `#f0a582` |
| `accent-low` (current page) | `--accent-soft`, opaque | 11% clay on bg | 16% clay on bg |
| asides: note, tip, caution, danger | series blue, good, warning, critical | | |

Starlight's purple (badges only) takes the app's project violet. Code blocks keep Starlight's Expressive Code themes on the panel surface; `astro.config.mjs` sets their radius to the app's 8px and drops the frame shadow.

### D3. Element styles

- Title bar: `--surface-1` with a bottom border, like the app's nav. The app's mark is the logo and the favicon.
- Sidebar: flat on the page. The current page takes the app's active tab (`--accent-soft` fill, `--accent-ink` text); other links get the tab hover (`--surface-2`).
- Asides: the app's insight card. A `--surface-1` panel with a border, a 12px radius and a 4px status bar on the left; the title is small and colored by status. Tip is the app's Good, caution its Watch, danger its Act, a note is information in the series blue.
- Link cards and the previous/next links: panels with a 12px radius, the border turning clay on hover.
- Search and the phone menu button: the app's controls, 8px radius.
- Links in prose stay underlined (color is not the only cue), with a softer underline until hover.
- Focus: the app's ring, `2px solid` accent, offset 2px.

### D4. Font: self-hosted from `@fontsource/ibm-plex-sans`

The app loads IBM Plex Sans from Google Fonts, and the README's Privacy section says so. The app runs on the user's own machine; the docs are a public site. Self-hosting means a reader's browser asks no third party, nothing breaks under a strict network, and the version is pinned in `package-lock.json` like every other dependency. The site imports the `latin` subsets only (400, 400 italic, 500, 600): the docs are in English, and a character outside the subset falls back to the system font. The README's Privacy section is about the app and stays as it is.

### D5. A spec delta, not only a design note

The look is visual, but two parts of it are commitments a later change must keep: WCAG AA contrast for text, links and control states in both themes, and no font request to a third party. They go into the `Work in light and dark, by keyboard and screen reader` requirement. Matching the app's typeface and colors goes in too, so a later restyle of either knows to follow the other.

## Contrast

Measured on the built site in Chromium: every visible text element of all 38 pages and the search dialog with results, in both themes (19,126 elements), with its background blended from its ancestors. None is under 4.5:1 (3:1 for large text). The lowest:

| Pair | Light | Dark |
| --- | --- | --- |
| Muted text on the page (table of contents, "Edit page") | 5.36 | 6.7 |
| Muted text on `--surface-2` | 5.08 | 5.64 |
| Link (`--accent-ink`) on the page | 6.75 | 9.29 |
| Current page in the sidebar (`--accent-ink` on `--accent-soft`) | 5.85 | 7.2 |
| Watch aside title or link (`--warning-text` on `--surface-1`) | 5.77 | 8.7 |
| Body text on the page | 12.63 | 12.72 |

Non-text (WCAG 1.4.11, 3:1): the focus ring is 4.67 on the page and 4.96 on the bar in light, 7.30 and 6.78 in dark, and 4.05 on the current sidebar item in light. Control borders keep the app's `--control-border`, 3.28 (light) and 3.71 (dark) on `--surface-1`.

## Risks

- **Token drift.** The tokens are copied, not shared: `web/` and `site/` share no build. A comment at the top of `custom.css` names the source. When the app's palette changes, its change updates the site too.
- **Starlight class names.** The element styles use Starlight's classes (`.sidebar-content`, `.starlight-aside`, `.sl-menu-button`, `site-search`). A Starlight upgrade may rename one; the style then falls back to Starlight's own, which still works and still passes contrast through the tokens.
