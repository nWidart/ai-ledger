## ADDED Requirements

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
