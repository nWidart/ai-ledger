## MODIFIED Requirements

### Requirement: Link to a project or session
The usage dashboard SHALL keep the selected project, time range, inspected project, inspected tool, MCP server or skill, and open session in the page URL, so a view can be reopened or shared into an agent prompt, and browser Back SHALL retrace filter and sheet changes.

#### Scenario: Open a copied URL
- **WHEN** the user opens a copied usage dashboard URL
- **THEN** the same project, range and session are selected

#### Scenario: Open a copied URL with a tool inspected
- **WHEN** the user opens a copied usage dashboard URL that was taken with the inspector open for `Bash`
- **THEN** the inspector for `Bash` opens in the same view
