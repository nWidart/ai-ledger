# Spec Delta

## ADDED Requirements

### Requirement: Start every drawer closed
Every drawer SHALL be closed when its page loads, on every page and after every reload. The app SHALL NOT keep which drawers were open in the browser. A drawer SHALL open on load only when a link asks for it, such as a tip in the Context page's URL.

#### Scenario: Reload after opening a drawer
- **WHEN** the user opens the Sessions drawer on Activity and reloads the page
- **THEN** every drawer on the page is closed

### Requirement: Open one drawer at a time
A page SHALL show at most one open drawer. Opening a drawer, by its toggle, the section index or an action that opens it, SHALL close the page's other open drawer. Closing a drawer SHALL open no other.

#### Scenario: Open a second drawer
- **WHEN** the Tools drawer on Activity is open and the user opens the Sessions drawer
- **THEN** the Sessions drawer is open and the Tools drawer is closed

#### Scenario: An action opens its drawer
- **WHEN** the Sessions drawer is open and the user selects "See loops" in the attention summary
- **THEN** the Error loops drawer opens and scrolls into view, and the Sessions drawer closes

### Requirement: Put method text behind How measured
A section's hint SHALL be one short line. Text that says how a figure is measured, beyond that line, SHALL sit behind a "How measured" toggletip at the end of the hint, which follows the toggletip rules. This SHALL apply to the Activity, Context, Errors and Insights pages.

#### Scenario: Starting context
- **WHEN** the user opens Context
- **THEN** the Starting context hint is one line, and its method text shows only when the user activates, or rests the pointer on, its How measured toggletip

### Requirement: Keep a lede to two figures
The lede of the Activity, Context, Errors and Insights pages SHALL state at most two figures. A vital SHALL NOT repeat a figure the lede states.

#### Scenario: Errors lede
- **WHEN** the user opens Errors for a view with failed tool calls
- **THEN** the lede states the failed calls and the error rate, and no vital repeats the error rate

### Requirement: Show the main chart in the first screen
On a 1440×900 window with every drawer closed, the main chart of the Activity, Context, Errors and Insights pages SHALL start inside the first 900 pixels of the page.

#### Scenario: Activity
- **WHEN** the user opens Activity at 1440×900
- **THEN** the work chart starts within the first 900 pixels
