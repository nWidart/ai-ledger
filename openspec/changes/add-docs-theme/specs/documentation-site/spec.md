## MODIFIED Requirements

### Requirement: Work in light and dark, by keyboard and screen reader
The site SHALL offer light and dark themes that follow the system setting until the reader picks one, and every page, image included, SHALL be readable in both. Both themes SHALL use the app's typeface and colors, and SHALL meet WCAG 2.2 AA contrast for text, links and control states. The site SHALL serve its font itself and SHALL ask no third party for it. Every control SHALL work by keyboard with a visible focus. Every image SHALL have alternative text, and an image shown in two theme variants SHALL be announced once. With reduced motion requested, the site SHALL show a still image in place of each animated GIF.

#### Scenario: Switch theme
- **WHEN** the reader switches the site to light on a page with a screenshot
- **THEN** the page and the screenshot show their light variants

#### Scenario: Look like the app
- **WHEN** the reader opens any page in either theme
- **THEN** the page uses the app's typeface, its page and surface colors and its accent color, and every text element meets WCAG AA contrast on its background

#### Scenario: No third-party font request
- **WHEN** the reader's browser loads any page
- **THEN** it fetches the font from the site itself and makes no request to a font service

#### Scenario: Keyboard only
- **WHEN** the reader uses only the keyboard on any page
- **THEN** they can reach the sidebar, search, theme picker and every link, and see where focus is

#### Scenario: Reduced motion
- **WHEN** the reader's system asks for reduced motion and they open the Home page
- **THEN** a still screenshot shows in place of the tour GIF
