# Spec Delta

## ADDED Requirements

### Requirement: Order the page
When the view has analysed sessions, the Insights page SHALL show, in this order: the coverage note, the lede and its sub line, the vitals, one row holding Outcomes and Friction categories, Satisfaction and helpfulness, the analysed sessions, then Goals and Session types. Goals and Session types SHALL each be a drawer, closed by default.

#### Scenario: Order with figures
- **WHEN** the view holds analysed sessions
- **THEN** the sections read in the order Outcomes, Friction categories, Satisfaction and helpfulness, Analysed sessions, Goals, Session types, and Goals and Session types are closed

### Requirement: Index the page's sections
When the view has analysed sessions, the Insights page SHALL show a section index after the sub line, listing Overview, Outcomes, Friction, Satisfaction and Sessions, then the drawers Goals and Session types. Choosing a drawer SHALL open it and scroll to it. The index SHALL NOT be shown when the page shows no figures (source Codex, or no analysed sessions).

#### Scenario: Jump to a drawer
- **WHEN** the user chooses Goals in the section index
- **THEN** the Goals drawer opens and scrolls into view

#### Scenario: No figures
- **WHEN** the source is Codex
- **THEN** no section index is shown

## MODIFIED Requirements

### Requirement: Show goal categories and session types
The page SHALL list goal categories by total count over the view's facets, and the number of sessions per session type, each in a drawer that is closed by default. A list of free-form categories (goals, friction, satisfaction signals) SHALL show its first 12 rows, with a control to show them all.

#### Scenario: Goals and types
- **WHEN** the view holds 109 `multi_task` and 16 `single_task` sessions, and goals `implement_feature` 40 and `fix_bug` 22
- **THEN** the page lists session types multi task 109 and single task 16, and goals implement feature 40 and fix bug 22, once their drawers are open

#### Scenario: Many goals
- **WHEN** the view holds 222 goal categories
- **THEN** the Goals list shows the 12 most counted and a "Show all 222 goals" control
