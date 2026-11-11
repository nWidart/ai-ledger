# Spec Delta

## MODIFIED Requirements

### Requirement: Show recovery after failures
The sheet SHALL show how the subject's failure incidents ended: the agent's next call of the same tool, started after the incident's last failure ended, succeeded, failed again, or never came. It SHALL use the same incidents and outcomes as the Errors page.

#### Scenario: Agent gives up
- **WHEN** 3 of 10 `Grep` incidents end with no later `Grep` call by their agent
- **THEN** the sheet shows 3 incidents as given up
