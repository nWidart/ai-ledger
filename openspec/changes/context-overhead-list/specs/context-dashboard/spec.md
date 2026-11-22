## MODIFIED Requirements

### Requirement: Draw each project's window as a grid
On Overhead and pressure, the page SHALL draw the Project page's window grid as a small grid for each of the six projects with the most sessions that have a measured start, a known window and a peak. Each grid SHALL draw, and state as shares, the median start, median peak and free space of those same sessions, with its project and window. With a project selected, the page SHALL draw that project's one full grid with its legend instead and, when the project has a context snapshot, the Project page's list of what loads before the first prompt.

#### Scenario: Several projects
- **WHEN** eight projects have such sessions, and `p0`, with the most, starts at a median 10% of a 200k window and peaks at 40%
- **THEN** six grids are drawn, `p0` first, filling 20 cells as start, 60 as added by the peak and 120 free, and the page says it shows 6 of 8 projects

#### Scenario: Ranked by the sessions drawn
- **WHEN** `bar` has 100 measured starts but one session with a known window and a peak, and `foo` has 30 such sessions
- **THEN** `foo`'s grid comes before `bar`'s, and `bar`'s grid draws and states its one session's start and peak

#### Scenario: Figures match the cells
- **WHEN** a grid's median start is 60% of the window and its median peak is no higher
- **THEN** it fills 120 cells as start, none as added and 80 free, and states Start 60%, Peak 60% and Free 40%

#### Scenario: One project
- **WHEN** the user selects project `foo`, which has sessions with a measured start, a known window and a peak
- **THEN** the page draws `foo`'s full grid, with its legend, and no small grids

#### Scenario: One project with a snapshot
- **WHEN** the user selects project `foo`, which has a context snapshot
- **THEN** `foo`'s full grid carries the closed list "What loads before your first prompt", as on the Project page, and no small grid has one
