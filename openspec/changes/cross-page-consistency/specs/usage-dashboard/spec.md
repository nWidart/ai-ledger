## ADDED Requirements

### Requirement: Keep a thin work chart segment visible
In every metric and bucket, a segment of the work chart's stacked bars with a value above zero SHALL be drawn at least 1px tall, with the 2px gap below it kept, and the bar SHALL stay its height: the other segments shrink to make room, as on Cost's chart.

#### Scenario: One commit beside a thousand
- **WHEN** a day has 1,000 commits in project `a` and 1 in project `c`, both with a color of their own
- **THEN** `c`'s segment shows at least 1px tall over `a`'s, and the bar is no taller than 1,001 commits
