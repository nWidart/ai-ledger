# Spec Delta

## ADDED Requirements

### Requirement: Show sessions and their agents as a tree
The page SHALL offer a Tree view, next to Stream and Wall, with one root per active session and that session's agents under it. The roots SHALL be grouped by state in the rail's order, with the same headings, each group under an `h2` heading. Inside a group, sessions SHALL be ordered by session start, oldest first. With no active session, the Tree SHALL say so as the Wall does.

#### Scenario: Open the Tree
- **WHEN** the user selects Tree while a working session with two subagents and a session in your turn with none are active
- **THEN** the Tree shows a your turn group with one session, then a working group with one session and its two subagents under it

#### Scenario: Session changes state
- **WHEN** a session in the working group finishes its turn
- **THEN** it moves, with its agents, to the your turn group, and no other session changes place

#### Scenario: Empty Tree
- **WHEN** no session is active
- **THEN** the Tree says no session is active, and shows when the newest session last wrote

### Requirement: Nest each agent under its parent
An agent SHALL stand under the agent the list names as its parent, and under its session when it has none. Nesting SHALL have no fixed depth. Under one parent, agents SHALL be ordered by start, oldest first, subagents and delegations together. An agent whose parents do not lead to its session SHALL stand under its session.

#### Scenario: Subagent of a subagent
- **WHEN** a session's main thread started subagent A, and A started subagent B
- **THEN** A stands under the session and B under A, one level deeper

#### Scenario: Order under a parent
- **WHEN** a session started a subagent at 10:00, a delegation at 10:02 and a subagent at 10:05, all still running
- **THEN** they stand under the session in that order

#### Scenario: Parent not in the list
- **WHEN** an agent names a parent the list does not hold
- **THEN** it stands under its session

### Requirement: Show a session's figures on its node
A session node SHALL show its state, with its time as the rail shows it, its title, else its project, the project under a title, its tool calls, the time since it started, its cost, its model without its `claude-` prefix, and its error count when above zero. A figure the app does not give SHALL be left out.

#### Scenario: Session node
- **WHEN** a session titled "Add the Tree" in project `ai-ledger`, started 12 minutes ago, has run `Bash` for 12 seconds, with 40 tool calls, 2 failed, $1.20 on `claude-opus-5-5`
- **THEN** its node shows `Bash 12s`, "Add the Tree", `ai-ledger`, 40 tools, 12m 00s, $1.20, `opus-5-5` and `✕2`

#### Scenario: Codex session with no cost
- **WHEN** a Codex session runs on a model with no known price
- **THEN** its node shows its model and no cost

### Requirement: Show a subagent's figures on its node
A subagent node SHALL show whether it is running or done, its name, its description, its tool calls, its duration, its cost and its model when the app gives them, and its error count when above zero. A running subagent's duration SHALL count up each second; a done one's SHALL stop at its last call or request.

#### Scenario: Running subagent
- **WHEN** a subagent named `Agent`, described "Map the parsers", started 90 seconds ago and made 8 tool calls, 2 failed, on `claude-haiku-5-5` for $0.05
- **THEN** its node shows running, `Agent`, "Map the parsers", 8 tools, `✕2`, 1m 30s counting up, $0.05 and `haiku-5-5`

#### Scenario: Subagent with no cost
- **WHEN** the app gives no cost and no model for a subagent
- **THEN** its node shows neither, and still shows its tool calls and duration

### Requirement: Show a delegation call as a node
A delegation SHALL be a node of its own kind, marked as a delegated task, with its description, its target provider and model when the app gives them, when it started, and its status in words: "sending" for `pending`, "started" for `started`, "done" and "failed". It SHALL show no tool calls, cost or errors. It SHALL have no link to another session.

#### Scenario: Started delegation
- **WHEN** a session delegated "Write the tests" to `gpt-6.1-sol` 20 minutes ago and the call returned
- **THEN** its node shows a delegated task, "Write the tests", `gpt-6.1-sol` and "started", with no tool calls and no cost

#### Scenario: Why started says no more
- **WHEN** the user reads a delegation node that says "started"
- **THEN** its hover text and its accessible name say that the transcript does not tell when the delegated task ends

#### Scenario: No target
- **WHEN** a delegation call names no provider and no model
- **THEN** its node shows its description and its status alone

### Requirement: Fold finished agents
Under each parent, the agents that are over SHALL be folded into one row placed after the others, which says how many it holds, such as "4 finished subagents". A subagent is over when it is done and no agent under it shows. A delegation is over when it is done or failed, or when its call returned more than 10 minutes ago. Selecting the row SHALL show them, and selecting it again SHALL fold them.

#### Scenario: Four finished, two running
- **WHEN** a session has four done subagents and two running ones
- **THEN** the two running nodes show, then a row that reads "4 finished subagents"

#### Scenario: Unfold
- **WHEN** the user selects the row "4 finished subagents"
- **THEN** the four nodes show under it, each marked done

#### Scenario: Finished parent of a running subagent
- **WHEN** subagent A is done and subagent B, under A, is running
- **THEN** A shows, with B under it

#### Scenario: Old delegation
- **WHEN** a parent has one done subagent and one delegation that returned 30 minutes ago with the status `running`
- **THEN** the fold row reads "1 finished subagent, 1 earlier delegation", and the delegation, when shown, still says "started"

#### Scenario: Nothing over
- **WHEN** every agent of a parent is running
- **THEN** the parent has no fold row

### Requirement: Keep the folds the user chose
A fold row the user opened SHALL stay open, and a node the user collapsed SHALL stay collapsed, while the page is open, in both layouts and across updates. On every page load the fold rows SHALL be folded and every other node open.

#### Scenario: Subagent finishes under an open fold
- **WHEN** the user opened a session's fold row and a running subagent of that session finishes
- **THEN** the subagent moves into the open fold and still shows

#### Scenario: Switch layout
- **WHEN** the user opens a fold row in the Outline and switches to the Org chart
- **THEN** that fold is open in the Org chart

#### Scenario: Reload
- **WHEN** the user reloads the page after opening a fold row
- **THEN** the fold row is folded

### Requirement: Offer two layouts of the Tree
The Tree SHALL offer a toggle between two layouts of the same nodes, folds and order: Outline, which is the default, and Org chart. The toggle SHALL say which is on. Switching SHALL move no focus away from the toggle.

#### Scenario: Switch to the Org chart
- **WHEN** the user selects Org chart in the Tree
- **THEN** the same sessions and agents show as cards, the toggle reads Org chart as pressed, and the focus is on the toggle

#### Scenario: Default layout
- **WHEN** the user opens `/live?view=tree`
- **THEN** the Tree shows the Outline

### Requirement: Draw the Outline as an indented tree
The Outline SHALL draw each node as one row, indented one step per level under its parent, with a control that collapses and expands a node that has children. A row SHALL show its figures in columns that line up across rows. A description SHALL be cut with an ellipsis when it does not fit, with the full description on hover.

#### Scenario: Three levels
- **WHEN** a session has subagent A, and A has subagent B
- **THEN** A's row is indented one step under the session's, and B's one step under A's

#### Scenario: Collapse a session
- **WHEN** the user collapses a session with three agents showing
- **THEN** its three agents and its fold row are hidden, and the session's row stays

#### Scenario: Long description
- **WHEN** a subagent's description is 300 characters long in a 1440x900 window
- **THEN** its row keeps one line, the description ends with an ellipsis, and hovering it shows all of it

### Requirement: Read the Outline by keyboard
Each state group of the Outline SHALL be a tree (`role="tree"`) named by its heading, with one tab stop. Up and Down SHALL move between the rows that show; Right SHALL expand a collapsed row, else move to its first child; Left SHALL collapse an expanded row, else move to its parent; Home and End SHALL go to the first and the last row; Enter and Space SHALL select the row. Each row SHALL state its level, its place among its siblings, and whether it is expanded.

#### Scenario: Walk into a session
- **WHEN** the focus is on an expanded session row with two agents and the user presses Right, then Down
- **THEN** the focus is on its first agent, then on its second

#### Scenario: Left on an agent
- **WHEN** the focus is on a subagent with no children and the user presses Left
- **THEN** the focus is on its parent's row

#### Scenario: Open a fold row by keyboard
- **WHEN** the focus is on a fold row and the user presses Right
- **THEN** the finished agents show, and the row reads as expanded

#### Scenario: A screen reader on a row
- **WHEN** a screen reader reaches a running subagent row, the second of three under its session
- **THEN** it reads the node's name, description, state and figures in words, level 2, 2 of 3

### Requirement: Draw the Org chart as cards
The Org chart SHALL draw one diagram per session, top-down: the session's card on top, its agents' cards in a row under it, and each agent's own agents under that agent, with a connector from each parent to each of its children. A card SHALL show what the node's Outline row shows. A fold SHALL be one card that says how many it holds.

#### Scenario: Session with three running subagents
- **WHEN** a session has three running subagents in a 1440x900 window
- **THEN** its chart shows the session's card, three cards in a row under it, and a connector from the session to each

#### Scenario: Fold card
- **WHEN** the same session also has four done subagents
- **THEN** a fourth card, after the three, reads "4 finished subagents", and selecting it shows the four as cards

### Requirement: Fit the Org chart to many children and narrow screens
A parent with more than 5 children that show SHALL stack them in a column under it, each joined to one line that runs down from the parent. Below 721 pixels wide, every parent SHALL stack its children that way. A chart wider than the page SHALL scroll sideways inside itself, and the page SHALL NOT scroll sideways.

#### Scenario: Eight children
- **WHEN** a session shows 8 running subagents in a 1440x900 window
- **THEN** the eight cards stand in one column under the session's card, each joined to the line that runs down from it

#### Scenario: Phone
- **WHEN** the user opens the Org chart on a 390x844 screen with a session of three subagents
- **THEN** the three cards stand in a column under the session's card, and the page has no sideways scroll

#### Scenario: Deep chart
- **WHEN** a chart of four subagents that each have four of their own is wider than a 1280x800 window
- **THEN** the chart scrolls sideways inside its own box, and the page does not

### Requirement: Read the Org chart with assistive technology
Each chart SHALL be a list of nested lists, one item per node, in the order parent then children, under its group's `h2` heading. Each card SHALL be a button whose accessible name gives what the card shows, in words. A fold card SHALL say whether it is expanded. The connectors SHALL be hidden from assistive technology. Tab SHALL reach every card in that order.

#### Scenario: A screen reader on a chart
- **WHEN** a screen reader user moves through the chart of a session with two subagents, one of which has a subagent
- **THEN** it reads the session, then a list of 2 items, and inside the first a list of 1 item, and reads no connector

#### Scenario: Card name
- **WHEN** a screen reader reaches the card of a running subagent with 8 tool calls of which 2 failed
- **THEN** it reads its name, its description, "running", "8 tool calls" and "2 errors"

### Requirement: Open a node in the Stream
Selecting a session node SHALL open that session in the Stream view. Selecting a subagent node SHALL open its session in the Stream view with that subagent's lane unfolded and in view. Selecting a delegation node SHALL open its session in the Stream view with the delegation call's row in view, and its lane unfolded when a subagent made it. The focus SHALL go to the lane's header or the call's row, else to the stream's heading. Back SHALL return to the Tree.

#### Scenario: Select a session
- **WHEN** the user selects the node of session `graft`
- **THEN** the Stream view opens on `graft`, Follow is on, and the focus is on the stream's heading

#### Scenario: Select a finished subagent
- **WHEN** the user selects a done subagent's node, whose lane the stream would fold
- **THEN** the Stream view opens on its session, that lane is unfolded and in view, the focus is on its header, and Follow is off

#### Scenario: Lane not among the events held
- **WHEN** the user selects a subagent whose calls are older than the events the stream loads
- **THEN** the Stream view opens on its session as for a session node

#### Scenario: Select a delegation
- **WHEN** the user selects a delegation node whose call the stream holds
- **THEN** the Stream view opens on its session with that call's row in view and focused, and Follow is off

#### Scenario: Back
- **WHEN** the user selects a node and then goes back
- **THEN** the Tree shows, in the layout it had

### Requirement: Turn the Stream's filters off for an agent's node
Selecting a subagent or delegation node SHALL turn the Stream's filters off (Failed calls only, Main thread only, Hide read-only), as each can hide the lane or the call it opens. Selecting a session node SHALL leave them as they are.

#### Scenario: Filters on
- **WHEN** Main thread only is on and the user selects a subagent's node
- **THEN** the Stream's filters are off and the subagent's lane is in view

### Requirement: Mark the selected session in the Tree
The node of the session the URL names SHALL be marked as the current one, and SHALL be the row or the card the keyboard reaches first in its group. A node that moves, to another group or into a fold, while it holds the keyboard focus SHALL keep the focus where it lands; one that goes into a closed fold SHALL give the focus to the fold row.

#### Scenario: Return from the Stream
- **WHEN** the user opens `graft` from the Tree and goes back
- **THEN** `graft`'s node is marked current

#### Scenario: Focused subagent finishes
- **WHEN** the focus is on a running subagent's row and the subagent finishes, with its parent's fold closed
- **THEN** the focus is on the fold row, which now counts one more

### Requirement: Keep the Tree current
The Tree SHALL update when the active list does: after each change notice and on the page's recheck, under the page's one update connection, and it SHALL follow Pause and a hidden tab as the rest of the page. It SHALL ask for the agents only while it shows. An update SHALL keep the folds, the scroll position and the keyboard focus.

#### Scenario: New subagent
- **WHEN** a session in the Tree starts a subagent
- **THEN** its node appears under the session within 3 seconds of its first line being written, and no fold changes

#### Scenario: Paused
- **WHEN** the user pauses the page and a subagent finishes
- **THEN** the Tree does not change until Resume

#### Scenario: Stream view
- **WHEN** the user is in the Stream view or on the Wall
- **THEN** the page's requests for the active list do not ask for agents

### Requirement: Say when a session's agents are left out
When the list left agents of a session out, the session's node SHALL say how many, after its agents, with a link to the session's sheet.

#### Scenario: Agents left out
- **WHEN** the list holds 200 agents of a session and says it left 60 out
- **THEN** the session's last row reads "60 older agents not shown", with a link that opens the session's sheet over Live

### Requirement: Fit the Outline to a narrow screen
Below 721 pixels wide, an Outline row SHALL take two lines: its state, name and error count, then its figures; its description SHALL show under them, cut with an ellipsis. The indent per level SHALL shrink so that a third-level row keeps at least half the screen's width. The page SHALL NOT scroll sideways.

#### Scenario: Phone
- **WHEN** the user opens the Outline on a 390x844 screen with a session, a subagent and that subagent's subagent
- **THEN** each row shows on two lines and its description, the third-level row is at least 195 pixels wide, and the page has no sideways scroll

## MODIFIED Requirements

### Requirement: Keep Full text to the Stream view
The Full text toggle and its warning SHALL show only in the Stream view. On the Wall and in the Tree, the page's requests SHALL NOT ask for full text, whatever the toggle says, and the toggle SHALL keep its setting for the return to the Stream view.

#### Scenario: Wall view
- **WHEN** the user turns on Full text in the Stream view and opens the Wall
- **THEN** the Wall shows no Full text toggle and no warning, its requests ask for no full text, and back in the Stream view Full text is on

#### Scenario: Tree view
- **WHEN** the user turns on Full text in the Stream view and opens the Tree, where a session has only a title made from its first prompt
- **THEN** the Tree shows no Full text toggle and no warning, its requests ask for no full text, and that session's node shows its project in place of a title

### Requirement: Keep the selection in the URL
The page SHALL keep the selected session, the view (Stream, Wall or Tree), the Tree's layout and the Wall's pins, oldest first, in the URL, with the shared project, source and automated filters. Pinning, unpinning and switching the Tree's layout SHALL replace the history entry, not add one. Of the pins the URL names, the page SHALL keep the well-formed ids, each once at its first place, and of more than two the last two.

#### Scenario: Reload on a session
- **WHEN** the user reloads `/live` while following session A
- **THEN** the page opens on session A in the same view

#### Scenario: Reload with pins
- **WHEN** the user reloads `/live?view=wall&pin=a,b`
- **THEN** the Wall shows with a and b pinned, a the oldest

#### Scenario: More pins than two
- **WHEN** the user opens `/live?view=wall&pin=a,b,a,c,bad%20id`
- **THEN** the Wall pins b and c, b the oldest

#### Scenario: Reload on the Org chart
- **WHEN** the user reloads `/live?view=tree&layout=org`
- **THEN** the Tree shows with the Org chart

#### Scenario: Layout outside the Tree
- **WHEN** the user opens `/live?layout=org` or `/live?view=tree&layout=cards`
- **THEN** the first shows the Stream view and the second the Tree's Outline, and the page drops the `layout` key from the URL it writes next

#### Scenario: Session that fails to load
- **WHEN** the selected session answers with an HTTP error and the page holds nothing of it
- **THEN** the stream's panel says it could not load the session, once, with no loading message

#### Scenario: Selected session no longer active
- **WHEN** the URL names a session that is no longer active
- **THEN** the stream still shows that session's newest events, marked idle

#### Scenario: Unknown session
- **WHEN** the URL names a session the store does not hold
- **THEN** the stream says the session was not found and offers a link back to the active sessions

### Requirement: Keep one update connection
The page SHALL keep one update connection while it shows: pinning, unpinning, switching between Stream, Wall and Tree, switching the Tree's layout, and opening or closing a sheet SHALL NOT open another. A notice that names a pinned session SHALL refetch it.

#### Scenario: Pin, unpin and a sheet
- **WHEN** the user pins two sessions, unpins one, and opens and closes a session sheet
- **THEN** the page opened one connection, and it is still open

#### Scenario: Sheet over pins
- **WHEN** the user opens a pinned stream's session sheet from its head, and closes it
- **THEN** both pinned streams stay mounted under it, and the page opened no other connection

#### Scenario: Tree and back
- **WHEN** the user opens the Tree, switches to the Org chart, selects a node and goes back
- **THEN** the page opened one connection, and it is still open
