## ADDED Requirements

### Requirement: Keep the cache chart's stacks in their tracks
On the cache chart's bars and breaks strip, a part above zero SHALL be drawn at least 2px tall with 1px of surface between parts, and a stack SHALL stay its own height, so no stack rises past its track's top: the other parts shrink to make room.

#### Scenario: A full bar with thin parts
- **WHEN** the tallest bar is almost all uncached input, with a few tokens of cache write and, with cache reads on, of cache read
- **THEN** each thin part shows at least 2px tall and the bar's top stays at the top of its track
