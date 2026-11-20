## ADDED Requirements

### Requirement: Show the share of tokens per day
In the tokens metric the chart SHALL offer a "Scale" switch with Volume and Share, Volume by default, kept in the browser and not shown in the cost metric. Share SHALL draw each day as a bar that fills the plot, each shown token kind sized by its share of that day's tokens, on an axis from 0% to 100%. Hiding a kind SHALL remove it from the day's total. A day with no tokens SHALL have no bar. Share SHALL NOT draw the 7-day average or the peak label.

#### Scenario: Switch to Share
- **WHEN** the user shows tokens per day and selects Share
- **THEN** every day with tokens is a bar that fills the plot, the axis reads 0% to 100%, and the 7-day average is not drawn

#### Scenario: Hidden kind
- **WHEN** the user hides Cache read in Share
- **THEN** the remaining kinds' shares are of the day's remaining tokens, and the bars still fill the plot

#### Scenario: Scale is remembered
- **WHEN** the user selects Share and reopens the page
- **THEN** the tokens chart is in Share

#### Scenario: Cost metric
- **WHEN** the user shows the cost metric
- **THEN** the "Scale" switch is not shown

### Requirement: Read the share of tokens by tooltip, keyboard and table
In Share, a day's tooltip, screen-reader text and data table row SHALL give each kind's share of the day's tokens and the day's total tokens, and the chart's title and accessible name SHALL say it shows share. Keyboard reading (arrow keys, Home, End, Enter, Escape) SHALL work as in Volume.

#### Scenario: Reading a day
- **WHEN** a day's tokens are 60 input, 20 output and 120 cache read, and the user reads that day by keyboard in Share
- **THEN** the tooltip and the screen-reader text give input 30%, output 10% and cache read 60%, and a total of 200 tokens

#### Scenario: Share table
- **WHEN** the user shows the data table in Share
- **THEN** each day's row lists each kind's share and the day's total tokens, and the table is named for the share chart

## MODIFIED Requirements

### Requirement: Show estimated cost by token kind
The Tokens and cache drawer SHALL compare, for the view, each billed kind's share of tokens with its share of the estimated cost, as paired bars either side of the kind's name: the share of tokens to the left and the share of the estimated cost to the right, each on its own 0 to 100% scale, with both shares also as text. The kinds SHALL be Input, Output (thinking is billed as output and counted in it), Cache write (the 5-minute and 1-hour lifetimes together) and Cache read, ordered by estimated cost, biggest first, and by tokens when no request is priced. A sentence SHALL name the kind whose two shares differ most. The drawer SHALL also give an accessible table with each kind's tokens, share of tokens, estimated cost and share of estimated cost, and the two cache write lifetimes' tokens and costs. When no request is priced, the cost and cost share of each kind SHALL show as unknown, not as zero, and the bars of cost SHALL be left out.

#### Scenario: Cache reads dominate tokens, not cost
- **WHEN** cache reads are 66% of tokens and 5% of the estimated cost
- **THEN** the Cache read pair shows a long bar of 66% to the left and a short bar of 5% to the right, below the kinds that cost more, and the sentence names Cache read

#### Scenario: Exact numbers
- **WHEN** the user shows the drawer's data table
- **THEN** each kind has its tokens, 66.7% of tokens, $0.80 and 5.1% of the estimated cost, as exact figures

#### Scenario: Cache write lifetimes
- **WHEN** a view has 5-minute and 1-hour cache writes
- **THEN** the chart has one Cache write pair, and the table gives the tokens and cost of each lifetime

#### Scenario: Unpriced view
- **WHEN** every request in the view used a model with no price
- **THEN** each kind's cost shows as a dash, unknown and not zero, and the pairs have no cost bar
