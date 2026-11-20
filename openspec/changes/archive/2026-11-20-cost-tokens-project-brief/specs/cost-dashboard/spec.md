## ADDED Requirements

### Requirement: Show the share of tokens per day
In the tokens metric the chart SHALL offer a "Scale" switch with Volume and Share, Volume by default, kept in the browser and not shown in the cost metric. Share SHALL draw each day as a bar that fills the plot, each shown token kind sized by its share of that day's tokens, on an axis from 0% to 100%. Hiding a kind SHALL remove it from the day's total. A day with no tokens SHALL have no bar. Share SHALL NOT draw or name the 7-day average or the peak.

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

### Requirement: Keep a thin segment visible
In every metric and scale, a stacked segment with a value above zero SHALL be drawn at least 1px tall, however thin its value, even where the gap between segments is wider than the segment.

#### Scenario: Thin share
- **WHEN** a day's tokens are 98% input, 1% output and 1% cache read, in Share
- **THEN** the output and cache read segments are drawn with a height above zero

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
The Tokens and cache drawer SHALL compare, for the view, each billed kind's share of tokens with its share of the estimated cost, as paired bars either side of the kind's name: the share of tokens to the left and the share of the estimated cost to the right, each on its own 0 to 100% scale, with both shares also as text to one decimal. A share of zero SHALL have an empty bar. The kinds SHALL be Input, Output (thinking is billed as output and counted in it), Cache write (the 5-minute and 1-hour lifetimes together) and Cache read, ordered by estimated cost, biggest first, and by tokens when no request is priced or the priced requests cost nothing. Where the chart is too narrow for three columns of name and bars, each kind's name SHALL go above its two bars, so that no bar is drawn zero wide; the layout SHALL follow the chart's own width, not the screen's.

A sentence above the chart SHALL name the kind whose share of tokens and share of estimated cost differ most, however small that difference, with both shares; on a tie it SHALL name the costlier kind. When no request is priced, the sentence SHALL say so instead. When the priced requests cost nothing (models priced at zero rates), the sentence SHALL say so instead.

The drawer SHALL also give an accessible table with each kind's tokens as a full count, its share of tokens, its estimated cost in dollars to the cent and its share of estimated cost, and under Output the thinking tokens, and under Cache write each lifetime's tokens and estimated cost. A cost is unknown only when no request of the view is priced (the usage payload's costs are null): each kind's cost and cost share SHALL then show as a dash, not as zero, and the bars of cost SHALL be left out. A known cost of zero SHALL show as $0.00 with a share of 0.0%.

#### Scenario: Cache reads dominate tokens, not cost
- **WHEN** the view's tokens are 16.7% input, 8.3% output, 8.3% cache write and 66.7% cache read, and its estimated cost is 12.7% input, 63.3% output, 19.0% cache write and 5.1% cache read
- **THEN** the Cache read pair shows a long bar of 66.7% to the left and a short bar of 5.1% to the right, below the three kinds that cost more, and the sentence reads "Cache read is 66.7% of tokens and 5.1% of estimated cost." (its 61.6 points are the widest gap; Output's are 55.0)

#### Scenario: Close shares
- **WHEN** the view's tokens are 16.7% input, 8.3% output, 8.3% cache write and 66.7% cache read, and its estimated cost is 19% input, 10% output, 5% cache write and 66% cache read
- **THEN** the sentence reads "Cache write is 8.3% of tokens and 5.0% of estimated cost.", the widest gap at 3.3 points

#### Scenario: Exact numbers
- **WHEN** the view has 2,000,100 input, 1,000,100 output (500,000 of them thinking), 500,000 5-minute and 500,000 1-hour cache write and 8,000,000 cache read tokens, estimated at $2.00, $10.00, $1.00, $2.00 and $0.80, and the user shows the drawer's data table
- **THEN** the rows read Input 2,000,100, 16.7%, $2.00, 12.7%; Output + thinking 1,000,100, 8.3%, $10.00, 63.3%; Cache write 1,000,000, 8.3%, $3.00, 19.0%; Cache read 8,000,000, 66.7%, $0.80, 5.1%; and under them Thinking 500,000, the 5-minute cache write 500,000 and $1.00, and the 1-hour cache write 500,000 and $2.00

#### Scenario: Cache write lifetimes
- **WHEN** a view has 5-minute and 1-hour cache writes
- **THEN** the chart has one Cache write pair, and the table gives the tokens and cost of each lifetime

#### Scenario: Unpriced view
- **WHEN** every request in the view used a model with no price
- **THEN** each kind's cost shows as a dash, unknown and not zero, the pairs have no cost bar, and the sentence says no request is priced

#### Scenario: Priced at zero
- **WHEN** every request in the view used a model priced at zero rates
- **THEN** each kind's cost reads $0.00 with a share of 0.0% and an empty cost bar, and the sentence says the priced requests cost $0.00, not that no request is priced

### Requirement: Mark today as a partial day
The cost and tokens charts SHALL draw the bar for today (the last day of the view) hatched over each segment's own color, and SHALL show a "Today so far" key in the legend, in every metric and scale. The day's tooltip and screen-reader text SHALL say "so far". In the modes that draw a peak label and a 7-day average (the cost metric, and the tokens metric in Volume), the peak label when today is the peak SHALL say "so far", the 7-day average at a day SHALL be the mean of the 7 complete days ending at that day, today SHALL have no average point, and the chart's hint SHALL say the average covers complete days. In Share, which draws neither, the hint SHALL NOT mention the average.

#### Scenario: Hovering today
- **WHEN** the user hovers today's bar
- **THEN** the tooltip reads "so far" and shows no 7-day average

#### Scenario: Average at yesterday
- **WHEN** today costs far more than the days before it
- **THEN** the average at yesterday does not include today, and the line ends at yesterday

#### Scenario: Today in Share
- **WHEN** the user shows the token share per day over 30 days ending today
- **THEN** today's bar is hatched and its tooltip says "so far", and the hint says nothing of a 7-day average
