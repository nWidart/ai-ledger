# Spec Delta

## MODIFIED Requirements

### Requirement: Run without a frontend toolchain
The app SHALL serve every dashboard page from the built files that ship with it, in the repository and in the installed package, so running it needs only Python and its Python dependencies. A frontend toolchain SHALL be needed only to change the pages.

#### Scenario: Fresh clone without Node
- **WHEN** the user clones the repository on a machine without Node and runs the app
- **THEN** Activity, Cost and Errors all load and work

#### Scenario: Installed package without Node
- **WHEN** the user runs the installed package on a machine without Node
- **THEN** Activity, Cost and Errors all load and work
