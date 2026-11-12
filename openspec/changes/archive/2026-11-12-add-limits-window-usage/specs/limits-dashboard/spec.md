# Spec Delta

## ADDED Requirements

### Requirement: Show what used each open window
Each open-window card with counted use since its start SHALL show a drawer, closed by default, headed "What used this window", after the cap-money line. Closed, its heading SHALL end with the window's top project and its share of the window's counted use ("ai-ledger 54%"), when the use has a project. Opened, it SHALL list the top three projects and the top three models by estimated cost, each with its share as a percent and, when the window is calibrated, its points ("≈ 12.3 points"), and give its cost at API list prices as the row's title. It SHALL say that only counted local agent use at list prices is in it and that use elsewhere is not. The use is that from the window's start to now, for the provider's agent and the models the limit covers; it SHALL NOT follow the page's project and range filters. Each project SHALL link to Cost filtered to that project, the window's provider as the source and the smallest range preset (7, 14, 30 or 90 days, else all time) that covers the window's start, and a link "Open in Cost" SHALL do the same with no project. A link SHALL name its range as the nearest preset, since Cost has no custom ranges. A card with no counted use since its start SHALL have no drawer.

#### Scenario: A window that runs hot
- **WHEN** a weekly window that started 5 days ago has counted use, 54% of it in the project ai-ledger
- **THEN** its card has a closed drawer reading "What used this window · ai-ledger 54%", and opened it lists the top projects and models with their shares and points

#### Scenario: Linking to Cost
- **WHEN** the reader follows the project link of ai-ledger in a Claude Code window that started 5 days ago
- **THEN** the page goes to Cost with the project ai-ledger, the source claude and the range 7 days, without a page reload

#### Scenario: A window older than the longest preset
- **WHEN** a window started more than 90 days ago
- **THEN** its "Open in Cost" link reads "Open in Cost · all time" and opens Cost over all time

#### Scenario: Not calibrated
- **WHEN** a window is not calibrated yet
- **THEN** its drawer lists shares and costs and no points

#### Scenario: Nothing counted
- **WHEN** no use was counted since the window started
- **THEN** its card has no drawer
