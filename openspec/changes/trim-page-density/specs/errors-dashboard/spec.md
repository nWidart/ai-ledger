# Spec Delta

## ADDED Requirements

### Requirement: Lead with the failed calls and their rate
The Errors lede SHALL state the view's failed tool calls and their error rate, and nothing more. The summary vitals SHALL show the change in the error rate, the incidents, the top type with its share of the errors, and the fixes applied. They SHALL NOT repeat the error rate.

#### Scenario: Errors in the view
- **WHEN** the view has 120 failed tool calls of 4,000, 40% of them of type File not found, and the rate fell 12% against the period before
- **THEN** the lede reads 120 failed tool calls (3.0%), and the vitals show a change of −12%, the incidents, File not found at 40% of errors and the fixes applied

#### Scenario: No errors
- **WHEN** the view has tool calls and none failed
- **THEN** the lede says no tool call failed out of how many, and the Top type vital shows "–"
