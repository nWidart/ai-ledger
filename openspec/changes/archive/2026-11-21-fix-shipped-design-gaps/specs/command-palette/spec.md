## MODIFIED Requirements

### Requirement: A sheet without a page stays where it can
A `>` sheet without a page SHALL open on the current page when that page hosts the sheet, and otherwise on Activity. Activity, Cost, Context, Errors, Insights, Live and the Project page host the tool, MCP server, skill and session sheets. Limits hosts none. On Live, the session sheet SHALL be named under `sheet`, and opening any sheet SHALL keep `session`, the session the stream follows, even when the same commit changes the project or source. A commit that changes the project or source and opens no sheet SHALL drop `session`.

#### Scenario: On a hosting page
- **WHEN** the user on Errors commits `>bash`
- **THEN** the `Bash` inspector opens over Errors

#### Scenario: On Context
- **WHEN** the user on Context commits `>bash`
- **THEN** the `Bash` inspector opens over Context

#### Scenario: On the Project page
- **WHEN** the user on the Project page of `foo` commits `>bash`
- **THEN** the `Bash` inspector opens over the Project page

#### Scenario: On Live
- **WHEN** the user on `/live?session=s1` commits a session chip for `abc`
- **THEN** the URL is `/live?session=s1&sheet=abc`, the session sheet opens over Live and the stream keeps following `s1`

#### Scenario: On Live, with a new project
- **WHEN** the user on `/live?project=foo&session=s1` changes the project chip to `bar` and commits a session chip for `abc`
- **THEN** the URL is `/live?project=bar&session=s1&sheet=abc`, and the stream keeps following `s1`; changing the project alone starts the stream over

#### Scenario: On Limits
- **WHEN** the user on Limits commits `>bash`
- **THEN** Activity opens with the `Bash` inspector, and the footer said so before Enter
