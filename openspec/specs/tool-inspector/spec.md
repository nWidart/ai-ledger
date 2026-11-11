# tool-inspector Specification

## Purpose

The inspector sheet for one tool, MCP server or skill: how much it is used, where, on what inputs, how it fails and whether the agent recovers, so a single flaky or costly tool can be understood without reading transcripts.

## Requirements

### Requirement: Inspect a tool, MCP server or skill
The app SHALL show a sheet for one tool, one MCP server or one skill. Every figure on the sheet SHALL reflect the page's view: project, time range, source and the automated toggle.

#### Scenario: Open a tool in a filtered view
- **WHEN** the user views project `foo` for the last 7 days and opens the inspector for `Bash`
- **THEN** the sheet shows only `Bash` calls from `foo` sessions in the last 7 days

#### Scenario: Tool with no calls in the view
- **WHEN** the user opens the inspector for a tool that has no calls in the current view
- **THEN** the sheet says there are no calls in this view and shows no empty charts

### Requirement: Lead with calls, failures and latency
The sheet SHALL open with the call count, the failure rate and the p50 and p95 latency from tool use to tool result. For a range other than all time, it SHALL show the change in calls and failure rate against the previous period of the same length.

#### Scenario: Failure rate rose
- **WHEN** `Bash` failed 5% of calls in the previous 30 days and 12% in the last 30 days
- **THEN** the sheet shows 12% and marks the rise against the previous period

#### Scenario: All-time view
- **WHEN** the range is all time
- **THEN** the sheet shows the figures without a previous-period change

### Requirement: Show calls per day
The sheet SHALL show the subject's calls per day in the view, split into succeeded and failed calls.

#### Scenario: Failures start on one day
- **WHEN** `WebFetch` has no failures until 2026-11-03 and fails often after that
- **THEN** the chart shows failed calls only from 2026-11-03

### Requirement: Show where the subject is used
The sheet SHALL show the subject's calls and failure rate per project, per source, and for the main thread against subagents.

#### Scenario: Used mostly by subagents
- **WHEN** 90 of 100 `WebFetch` calls come from subagents
- **THEN** the sheet shows a 90% subagent share

### Requirement: Group calls by input pattern
The sheet SHALL group calls by an input pattern and show each group's calls and failure rate, largest group first. Shell commands SHALL group by their first word, file paths by extension, searches by pattern, and URLs by domain. Calls whose input fits no rule SHALL group under one "other" row.

#### Scenario: Shell commands
- **WHEN** `Bash` ran `npm test` 10 times with 4 failures and `git status` 20 times with no failure
- **THEN** the sheet shows `git` with 20 calls and 0% failed, and `npm` with 10 calls and 40% failed

#### Scenario: File edits
- **WHEN** `Edit` changed `a.py`, `b.py` and `c.tsx`
- **THEN** the sheet shows `.py` with 2 calls and `.tsx` with 1 call

#### Scenario: Web fetches
- **WHEN** `WebFetch` fetched three pages on `docs.python.org`
- **THEN** the sheet shows `docs.python.org` with 3 calls

### Requirement: Show failures by category
The sheet SHALL show the subject's failed calls per error category, with the category's explanation and suggested fix, and a link to that category on the Errors page in the same view.

#### Scenario: Open a category in Errors
- **WHEN** the user follows the link of a category on the `Bash` sheet
- **THEN** the Errors page opens on that category with the same project, range and source

### Requirement: Show recovery after failures
The sheet SHALL show how the subject's failure incidents ended: the agent's next call of the same tool, started after the incident's last failure ended, succeeded, failed again, or never came. It SHALL use the same incidents and outcomes as the Errors page.

#### Scenario: Agent gives up
- **WHEN** 3 of 10 `Grep` incidents end with no later `Grep` call by their agent
- **THEN** the sheet shows 3 incidents as given up

### Requirement: Show error loops of the subject
The sheet SHALL list the subject's error loops in the view, each with its session and a link to its first failure in Errors.

#### Scenario: Loop in a session
- **WHEN** `Bash` failed four times in a row in session `abc`
- **THEN** the sheet lists that loop with 4 failures and a link to its first failure

### Requirement: Show tests and commits of shell tools
For a shell tool, the sheet SHALL show its test runs, the share that passed, and its commits.

#### Scenario: Shell tool
- **WHEN** the user opens the inspector for `Bash`
- **THEN** the sheet shows the test runs, the test pass rate and the commits made through `Bash`

#### Scenario: Other tool
- **WHEN** the user opens the inspector for `Read`
- **THEN** the sheet shows no test or commit section

### Requirement: List recent calls
The sheet SHALL list the subject's most recent calls in the view with their time, project and input. A call SHALL link to its session sheet, and a failed call SHALL also link to that failure in Errors.

#### Scenario: Open a failed call
- **WHEN** the user follows the Errors link of a failed call
- **THEN** the Errors page opens with that example focused

### Requirement: Show the tools of an MCP server
For an MCP server, the sheet SHALL list the tools it served with their calls and failure rate, and each tool SHALL open its own inspector.

#### Scenario: MCP server tools
- **WHEN** the user opens the inspector for MCP server `github`
- **THEN** the sheet lists each `mcp__github__*` tool with its calls and failure rate

### Requirement: Inspect a skill by its invocations
For a skill, the sheet SHALL cover the calls that invoked that skill. It SHALL NOT group by input pattern, because a skill's input is its name.

#### Scenario: Skill sheet
- **WHEN** the user opens the inspector for skill `ship`
- **THEN** the sheet shows how often `ship` was invoked, where, how often the invocation failed, and its recent invocations, with no input pattern section

### Requirement: Open the inspector from tool rows and names
The inspector SHALL open from tool rows in the Activity tools drawer, from MCP server and skill rows in the Activity extensions drawer, from tool rows in the session sheet, and from tool names on the Errors page.

#### Scenario: From the tools drawer
- **WHEN** the user clicks the `Bash` row in the Activity tools drawer
- **THEN** the inspector opens for `Bash`

#### Scenario: From the session sheet
- **WHEN** the user clicks a tool row in a session sheet
- **THEN** the inspector opens for that tool in place of the session sheet, and browser Back returns to the session

#### Scenario: From the Errors page
- **WHEN** the user clicks the tool name of an error example
- **THEN** the inspector opens for that tool in the Errors page's view

### Requirement: Keep the inspector in the URL
The open inspector SHALL be kept in the page URL, so reload and a copied link reopen it, and browser Back closes it. A session opened from the inspector SHALL offer ← Back to the inspector. Closing a sheet the page opened SHALL return to the history entry it opened from, so it adds no entry that Back would reopen.

#### Scenario: Reload with the inspector open
- **WHEN** the user reloads Activity with the inspector open for `Grep`
- **THEN** the inspector for `Grep` opens again

#### Scenario: Back from a session
- **WHEN** the user opens a session from the `Bash` inspector and presses ← Back
- **THEN** the `Bash` inspector shows again

#### Scenario: Back after closing
- **WHEN** the user opens the `Bash` inspector from the tools drawer, closes it, then presses browser Back
- **THEN** the browser leaves the page's current view, without reopening the inspector

### Requirement: Read only what the store already holds
The inspector SHALL use only data the store already records for each call. Opening it SHALL NOT require a store rebuild or read transcript files.

#### Scenario: Existing store
- **WHEN** the user opens the inspector on a store built before this change
- **THEN** every section shows data without a rebuild
