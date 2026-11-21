## ADDED Requirements

### Requirement: Keep a thin work chart segment visible
In every metric and bucket, a segment of the work chart's stacked bars with a value above zero SHALL be drawn at least 1px tall, with the 2px gap below it kept. A bar SHALL be its total's scaled height, the other segments shrinking to make room, as on Cost's chart; only a bar too short to hold every segment's minimum MAY draw slightly taller than its scaled height, so each nonzero segment stays visible.

#### Scenario: One commit beside a thousand
- **WHEN** a day has 1,000 commits in project `a` and 1 in project `c`, both with a color of their own
- **THEN** `c`'s segment shows at least 1px tall over `a`'s, and the bar is as tall as a bar of 1,001 commits of one project

#### Scenario: A tiny split bar
- **WHEN** a day has 1 commit in `a` and 1 in `c`, in a view whose busiest day has 200
- **THEN** both segments show, and the bar may be a few pixels taller than 2 commits drawn to scale
