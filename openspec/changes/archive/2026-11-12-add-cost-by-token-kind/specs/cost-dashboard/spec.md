# Spec Delta

## ADDED Requirements

### Requirement: Show estimated cost by token kind
The dashboard SHALL show, for the view, the estimated cost of each billed kind (input, output, cache read, 5-minute cache write, 1-hour cache write) with its share of the estimated cost, next to the kind's token count and token share, ordered by cost, biggest first. Each request's kind costs SHALL use the same prices and tier as the request's cost and add up to it. Thinking tokens are billed as output: the dashboard SHALL show Output and thinking as one kind with one cost. When no request is priced, the cost of each kind SHALL show as unknown, not as zero.

#### Scenario: Cache reads dominate tokens, not cost
- **WHEN** cache reads are 66% of tokens and 5% of the estimated cost
- **THEN** the drawer shows the cache read row with 5% of cost and 66% of tokens, below the kinds that cost more

#### Scenario: Unpriced view
- **WHEN** every request in the view used a model with no price
- **THEN** each kind's cost shows as a dash
