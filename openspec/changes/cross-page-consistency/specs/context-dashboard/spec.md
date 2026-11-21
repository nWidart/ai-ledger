## ADDED Requirements

### Requirement: Keep the cache chart's stacks in their tracks
On the cache chart's bars and breaks strip, a part above zero SHALL be drawn at least 2px tall with 1px of surface between parts. A stack SHALL be its total's scaled height, the other parts shrinking to make room, so no stack rises past its track; only a stack too short to hold every part's minimum MAY draw slightly taller than its scaled height, so each nonzero part stays visible.

#### Scenario: A tall bar with thin parts
- **WHEN** a day's bar is almost all uncached input, with a few tokens of cache write and, with cache reads on, of cache read
- **THEN** each thin part shows at least 2px tall and the bar is as tall as its total drawn to scale

#### Scenario: The busiest day's breaks
- **WHEN** the busiest day has 998 breaks from a model switch, 1 expired and 1 other
- **THEN** its stack fills the 48px strip exactly, and each cause shows at least 2px tall
