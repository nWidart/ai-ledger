# live-sessions Specification

## Purpose

Follow running Claude Code and Codex sessions within seconds of their transcript lines being written: which sessions are active, what each is doing, and the events of one session as they arrive, with transcript text sent only on request.

## Requirements

### Requirement: List active sessions
The app SHALL list as active every session whose newest stored line is less than 10 minutes old, newest first. Each entry SHALL give the session's project, source, git branch, model, cost so far, state and the time the session started. The list SHALL honour the project, source and automated filters.

#### Scenario: Two running sessions and an old one
- **WHEN** session A wrote a line 20 seconds ago, session B 4 minutes ago and session C 2 hours ago
- **THEN** the list holds A then B, and not C

#### Scenario: Filtered to one source
- **WHEN** a Claude Code and a Codex session are active and the source filter is Codex
- **THEN** the list holds only the Codex session

#### Scenario: Automated session
- **WHEN** an automated session is active and the automated toggle is off
- **THEN** the list does not hold it

#### Scenario: Session start
- **WHEN** a session whose first line is stamped 09:00 wrote a line a minute ago
- **THEN** its entry carries 09:00 as its start, whatever its newest line says

### Requirement: Derive each session's state
The app SHALL give each active session one state, checked in this order:
- *ended*: the transcript shows the session closed, and no timed line of the main thread follows the close.
- *idle*: no line for 5 minutes.
- *running a tool*: a tool call has no result. The state names the tool and when it started.
- *thinking*: the newest line is a human prompt or a tool result, or, for Codex, the newest turn has started and not completed.
- *your turn*: otherwise.

#### Scenario: Tool running
- **WHEN** the newest line of a session is a `Read` tool use with no result yet
- **THEN** the state is running a tool, naming `Read` and its start time

#### Scenario: Turn ended
- **WHEN** the newest line is an assistant reply with text and no pending tool call
- **THEN** the state is your turn

#### Scenario: Prompt sent
- **WHEN** the newest line is the user's prompt
- **THEN** the state is thinking

#### Scenario: Quiet session
- **WHEN** a session's newest line is 7 minutes old, even with a pending tool call
- **THEN** the state is idle

#### Scenario: Codex turn started in a thread file
- **WHEN** a Codex session's newest turn started in a `<session>_<thread>` rollout file and has not completed, with no pending tool call
- **THEN** the state is thinking

### Requirement: Give each state its start time
Each state SHALL carry the time it began.

#### Scenario: Start of a running tool
- **WHEN** a `Read` call started at 10:02:00 and has no result yet
- **THEN** the state is running a tool and carries 10:02:00 as the time it began

### Requirement: Report ended only on evidence of a close
The app SHALL report *ended* only when the transcript gives evidence of the close. With no such evidence, a closed session keeps the state the other rules give it.

#### Scenario: No evidence of a close
- **WHEN** a session's last line is an assistant reply and nothing in the transcript shows the session closed
- **THEN** the state is your turn, and idle after 5 minutes

### Requirement: Flag a likely approval wait
When a shell tool call (Claude Code `Bash`, Codex `exec` or `exec_command`) has had no result for more than 30 seconds, the app SHALL report the state as *likely waiting for approval*, with how long the call has been pending. A newer pending call, in the main thread or a subagent, SHALL NOT hide it; with several such calls, the oldest SHALL be reported.

#### Scenario: Slow shell call
- **WHEN** a `Bash` call started 45 seconds ago and has no result
- **THEN** the state is likely waiting for approval, pending 45 seconds

#### Scenario: Newer call in a subagent
- **WHEN** a `Bash` call started 45 seconds ago and has no result, and a subagent started a `Read` call 2 seconds ago
- **THEN** the state is likely waiting for approval, naming `Bash`, pending 45 seconds

#### Scenario: Slow non-shell call
- **WHEN** a `WebFetch` call started 45 seconds ago and has no result
- **THEN** the state is running a tool

### Requirement: Leave long calls out of the approval wait
A shell call that carries an explicit timeout above 120 seconds is a long call and SHALL NOT count: it reads as *running a tool* however long it has been pending. Each tool event and each running-a-tool state SHALL say whether its call is a long call, so the page applies the same rule as the app.

#### Scenario: Long explicit timeout
- **WHEN** a `Bash` call with a timeout of 300 seconds started 45 seconds ago and has no result
- **THEN** the state is running a tool, naming `Bash`, and the call is marked as a long call

#### Scenario: Short explicit timeout
- **WHEN** a `Bash` call with a timeout of 60 seconds, or of exactly 120 seconds, started 45 seconds ago and has no result
- **THEN** the state is likely waiting for approval

#### Scenario: Long call hides no wait
- **WHEN** a `Bash` call with a timeout of 600 seconds started 50 seconds ago, and another `Bash` call with no timeout started 45 seconds ago and has no result
- **THEN** the state is likely waiting for approval, naming the second call, pending 45 seconds

### Requirement: Count background and Codex calls as not long
A background call (`run_in_background`) SHALL NOT be a long call: it returns within seconds, so one still pending after 30 seconds reads as *likely waiting for approval*. Codex's shell tools carry no timeout, so a Codex call SHALL NOT be a long call.

#### Scenario: Background shell call
- **WHEN** a `Bash` call with `run_in_background` started 45 seconds ago and has no result
- **THEN** the state is likely waiting for approval, naming `Bash`, and the call is not marked as a long call

#### Scenario: Codex shell call
- **WHEN** a Codex `exec` call started 45 seconds ago and has no result
- **THEN** the state is likely waiting for approval, and the call is not marked as a long call

### Requirement: Mark inferred states
Every payload that carries a state SHALL say whether it is inferred. *likely waiting for approval* is always inferred: no transcript records a permission prompt. *thinking* is inferred for Claude Code, which records no request in flight. It is not inferred for Codex, which records when a turn starts and completes. *running a tool*, *your turn*, *idle* and *ended* are not inferred.

#### Scenario: Thinking is inferred
- **WHEN** a session's state is thinking
- **THEN** the payload marks the state as inferred

#### Scenario: Codex turn in progress
- **WHEN** a Codex session's newest turn has started, has not completed, and has no pending tool call
- **THEN** the state is thinking and is not marked as inferred

#### Scenario: Running a tool is not inferred
- **WHEN** a session's state is running a tool
- **THEN** the payload does not mark the state as inferred

#### Scenario: Ended is not inferred
- **WHEN** a session's state is ended
- **THEN** the payload does not mark the state as inferred

### Requirement: Stream one session's events
For one session, the app SHALL return its events in transcript order: prompts, assistant replies, tool calls and compactions. A request for events after a given point SHALL return the later events and SHALL read again the minute before that point, as transcript lines can be written seconds after their timestamp; each event keeps one key, so the page holds one copy of it.

#### Scenario: First load
- **WHEN** the page asks for a session's events with no starting point
- **THEN** the app returns the session's newest 500 events and says whether older ones were left out

#### Scenario: Catch up
- **WHEN** the page asks for events after the last one it holds, and two tool calls were written since
- **THEN** the app returns those two tool calls, the events of the minute before the point asked for, and nothing earlier

#### Scenario: Line written late
- **WHEN** a tool result stamped 10 seconds before the last line the page holds is written after the page caught up
- **THEN** the next catch-up returns the call with its result

#### Scenario: Tool call finishes
- **WHEN** a tool call the page received without a result later gets a failing result
- **THEN** the next response for that session carries the call again, with its end time and error

#### Scenario: Both sources
- **WHEN** the session is a Codex session
- **THEN** the events have the same kinds and fields as for a Claude Code session

### Requirement: Describe each tool call
Each tool call SHALL carry its tool, input summary, the description the agent gave a shell call when it gave one, start time, end time or none, and failure with its error. Each tool call SHALL also say whether it is a long call (an explicit timeout above 120 seconds) and whether it only reads.

#### Scenario: Shell call with a description
- **WHEN** a `Bash` call carries the description "Run the Python tests"
- **THEN** its event carries that description beside its command

#### Scenario: Long call
- **WHEN** a session makes a `Bash` call with a timeout of 300 seconds, one with a timeout of 5 seconds and one with `run_in_background`
- **THEN** only the first event is marked as a long call

### Requirement: Group subagent work
Each event of a subagent SHALL name that subagent, so the page can group them with the subagent's start time, end time when it has ended, and number of tool calls. The tool call that started a subagent SHALL name it: from the call's result when the subagent ends, and while it runs from the start record Claude Code writes beside its transcript (`agent-<id>.meta.json`).

#### Scenario: Subagent with three tool calls
- **WHEN** a Claude Code session starts an Explore subagent that makes three tool calls
- **THEN** the three calls are returned marked as that subagent's, not as the main thread's

#### Scenario: Subagent still running
- **WHEN** a Claude Code session started a subagent with an `Agent` call that has no result yet
- **THEN** that call names the subagent

### Requirement: Give each subagent's cost and model
The session payload SHALL give, for each subagent that has made a request, the cost of its priced requests and the model of its newest one. A request SHALL count once, for the subagent whose transcript holds it.

#### Scenario: Subagent cost and model
- **WHEN** a subagent made two requests on `claude-haiku-5-5` that cost $0.02 and $0.03
- **THEN** the session payload gives that subagent a cost of $0.05 and the model `claude-haiku-5-5`

#### Scenario: Subagent with no request yet
- **WHEN** a subagent has made no request yet
- **THEN** the payload holds no cost and no model for it

#### Scenario: Subagent on a model with no price
- **WHEN** a subagent's only request is on a model the price list does not hold
- **THEN** the payload gives it that model and no cost

#### Scenario: Requests of two subagents at the same time
- **WHEN** two subagents of one session each make a request stamped with the same time
- **THEN** each request counts in the cost of the subagent that made it, and in no other

#### Scenario: Codex subagent thread
- **WHEN** a Codex session's subagent thread makes a request that costs $2.00
- **THEN** the payload gives that thread a cost of $2.00 and the model of the request's turn

### Requirement: Send transcript text only on request
By default, prompts and replies SHALL be returned as word counts and tool results as character counts, without their text. A session title made from the first prompt is prompt text, and SHALL be left out by default. Only a request that asks for text SHALL receive the prompt and reply text, whole tool inputs, up to 4 KB of each tool result, and first-prompt titles.

#### Scenario: Default request
- **WHEN** the page asks for events without asking for text
- **THEN** no prompt, reply or tool-result text is in the response, no first-prompt title, no subagent prompt and no tool input longer than 300 characters

#### Scenario: Text requested
- **WHEN** the page asks for events with text
- **THEN** prompts and replies come as written and each tool result is cut to 4 KB

### Requirement: Cut tool inputs by default
A tool call's input SHALL be cut to 300 characters by default, and a subagent call (Claude Code `Agent`, Codex `spawn_agent`) SHALL carry its description instead of its prompt. A description SHALL be cut to 300 characters as an input is: a subagent call's, and the one the agent gave a shell call.

#### Scenario: Long tool input
- **WHEN** the page asks for events without asking for text, and a `Bash` call has an input of 800 characters
- **THEN** the call's input in the response is cut to 300 characters

#### Scenario: Subagent call
- **WHEN** the page asks for events without asking for text, and the session made an `Agent` call
- **THEN** the call carries its description and not its prompt

#### Scenario: Long description
- **WHEN** the page asks for events without asking for text, and an `Agent` call has a description of 2,000 characters
- **THEN** the call's description in the response is cut to 300 characters, and whole when the page asks for text

### Requirement: Report the agent's figures
For one session, the app SHALL report:
- the context of its newest main-thread request, and the model's context window when it is known;
- its compactions, with the context before each;
- its cost, requests, tool calls, failed tool calls and cache-read share;
- tokens per minute over the last minute;
- the newest plan-limit use for the session's source.

#### Scenario: Known context window
- **WHEN** the newest request used 55,000 tokens of context on a model with a 1,000,000-token window
- **THEN** the app reports 55,000 of 1,000,000

#### Scenario: Unknown context window
- **WHEN** the model's context window is not known
- **THEN** the app reports the context in tokens with no window

### Requirement: Notify open pages of changes
While a Live page is connected, the app SHALL push a notice after each ingest that stored new lines, naming the sessions that gained lines. It SHALL send a keep-alive at least every 15 seconds. A notice SHALL never carry transcript content.

#### Scenario: Session gains lines
- **WHEN** an ingest stores new lines for sessions A and B
- **THEN** each connected Live page gets one notice naming A and B

#### Scenario: Nothing new
- **WHEN** an ingest stores no new lines
- **THEN** no notice is sent

#### Scenario: Connection drops
- **WHEN** a Live page closes or loses its connection
- **THEN** the app stops writing to that connection and counts one fewer connected page

### Requirement: Title each live session
Each active-session entry and each session payload SHALL carry the session's title and say whether it came from the agent (a custom title, an AI title or a Codex thread name) or from the first prompt. A title from the agent SHALL always be sent. A title from the first prompt SHALL be sent only to a request that asks for text.

#### Scenario: Agent title
- **WHEN** an active session has the AI title "Add session titles" and the page asks for the list without text
- **THEN** the entry carries "Add session titles", marked as from the agent

#### Scenario: Prompt title without text
- **WHEN** an active session has no agent title and the page asks for the list without text
- **THEN** the entry carries no title

#### Scenario: Prompt title with text
- **WHEN** the same session is asked for with text
- **THEN** the entry carries the title made from its first prompt, marked as from the prompt

#### Scenario: Title arrives during the session
- **WHEN** a session's `ai-title` line is stored after the page first listed it
- **THEN** the next list after the change notice carries the new title

### Requirement: Report a closed session as ended
The app SHALL take as evidence of a close the `cost-state` line Claude Code writes as it exits, when it comes after the last timed line of the session's main transcript file. A subagent's lines SHALL NOT reopen a closed session. Codex writes no line that marks a close, so a Codex session SHALL never be reported as *ended*. An *ended* state SHALL carry the time of the session's newest timed line, as the close line carries no time.

#### Scenario: Closed session
- **WHEN** a Claude Code session's main transcript ends with a `cost-state` line
- **THEN** the state is ended, with the time of the session's newest timed line, and not your turn or idle

#### Scenario: Closed session resumed
- **WHEN** a timed line follows the `cost-state` line in the session's main transcript
- **THEN** the state comes from the other rules, as for any session

#### Scenario: Subagent writes after the close
- **WHEN** a subagent's transcript gains a line after the session's `cost-state` line
- **THEN** the state stays ended

#### Scenario: Codex session
- **WHEN** a Codex session's last turn has completed and its rollout is not written to again
- **THEN** the state is your turn, then idle after 5 minutes, and never ended

### Requirement: Mark tool calls that only read
The app SHALL mark a tool call as read-only when its tool is `Read`, `Grep` or `Glob`, or when it is a shell call (Claude Code `Bash`, Codex `exec_command`) whose every command, named without a path, is `grep`, `cat`, `ls`, `head`, `tail`, `wc`, `nl`, `cd`, `pwd` or `echo`, or is `rg`, `sort` or `find` with only flags the app lists as reading, or is `sed -n` with a script that only prints lines by number.

#### Scenario: Read-only call
- **WHEN** a session makes a `Grep` call and a `Bash` call that runs `git commit`
- **THEN** the `Grep` event is marked as read-only and the `Bash` event is not

#### Scenario: Codex read-only call
- **WHEN** a Codex `exec_command` runs `rg TODO src` and another runs `rg TODO src && rm notes.md`
- **THEN** the first is marked as read-only and the second is not

#### Scenario: Read-only shell call of several commands
- **WHEN** a `Bash` call runs `cd web && rg -n 'a|b' src | head -5`
- **THEN** its event is marked as read-only

#### Scenario: Flag that writes
- **WHEN** `Bash` calls run `sed -i s/a/b/ x.py`, `find . -name '*.pyc' -delete` and `sort -o x x`
- **THEN** none is marked as read-only

#### Scenario: Flags listed as reading
- **WHEN** `Bash` calls run `rg -l --hidden TODO`, `sort a.txt`, `find src -type f` and `find . -name '*.py'`
- **THEN** each is marked as read-only

#### Scenario: Flag that is not listed
- **WHEN** `Bash` calls run `rg --pre ./x.sh TODO`, `sort --compress-program=./x.sh a` and `sort --outp=x x`, a shortened `--output`
- **THEN** none is marked as read-only

#### Scenario: sed script
- **WHEN** `Bash` calls run `sed -n '1,50p' a.py`, `sed -n '10p;20p' a.py`, `sed -n 'w out.txt' a.py` and `sed 1e a.py`
- **THEN** the first two are marked as read-only and the last two are not

### Requirement: Read a shell wrapper by its script
A shell call that is one `bash`, `sh` or `zsh` command with `-c` or `-lc` and one script word SHALL be read as its script. The app SHALL NOT mark a wrapper of any other shape as read-only, nor one whose script word holds an unquoted `*`, `?`, `[`, `{`, `^` or `#`: the outer shell expands it against file names, and a file name can hold a command.

#### Scenario: Wrapped read-only line
- **WHEN** `Bash` calls run `bash -lc 'grep -rn "x > y" src'`, `sh -c 'ls'` and `zsh -c 'ls'`
- **THEN** each is marked as read-only

#### Scenario: Wrapper of another shape
- **WHEN** `Bash` calls run `bash -ic 'ls'`, `bash -lc 'ls' x` and `bash -c -c 'rm -rf build'`
- **THEN** none is marked as read-only

#### Scenario: Glob outside the script's quotes
- **WHEN** a `Bash` call runs `bash -c 'cat '*`, where a file can be named `cat a;rm -rf build`
- **THEN** its event is not marked as read-only

### Requirement: Mark no shell call that cannot be read for certain
The app SHALL mark a shell call as read-only only when it reads its whole line for certain. It SHALL read words, quotes, `;`, `&&`, `||`, `|`, a newline, and a redirection to `/dev/null`, descriptor 1 or 2. It SHALL NOT mark a line with more: a lone `&`, another redirection, a heredoc, parentheses, a `\`, a backtick, a `$`, an unpaired quote, or an unquoted `*`, `?`, `[`, `{`, `^` or `#` on `rg`, `sort`, `find` or `sed`; nor Codex's `exec`, nor a call cut short or with no `cmd`.

#### Scenario: Redirection into a file
- **WHEN** `Bash` calls run `cat a > b`, `ls >> log` and `cat a 2>err.log`
- **THEN** none is marked as read-only

#### Scenario: Redirection that writes no file
- **WHEN** a `Bash` call runs `ls -la 2>/dev/null`
- **THEN** its event is marked as read-only

#### Scenario: Background command
- **WHEN** a `Bash` call runs `cat notes.txt & rm -rf build`
- **THEN** its event is not marked as read-only

#### Scenario: Quotes that hide a command
- **WHEN** a `Bash` call runs `echo "Don't touch $HOME"; rm -rf dist; echo "that's all"`
- **THEN** its event is not marked as read-only

#### Scenario: Harmless line with a construct that is not read
- **WHEN** `Bash` calls run `cat "$(make list)"`, `(cat a.py)` and `rg 'foo\.bar' src`
- **THEN** none is marked as read-only

#### Scenario: Word the shell may expand into a flag
- **WHEN** `Bash` calls run `sort *`, `rg TODO [a-c]*`, `sort ^a` and `sort a#-o x`, where a file can be named `-o`
- **THEN** none is marked as read-only

#### Scenario: Quoted separator
- **WHEN** a `Bash` call runs `rg ';' src`
- **THEN** its event is marked as read-only

#### Scenario: Codex script
- **WHEN** a Codex `exec` call runs a script whose text is `rg TODO src`
- **THEN** its event is not marked as read-only

#### Scenario: Codex call with no cmd
- **WHEN** a Codex `exec_command` call's arguments hold `rg TODO src` under `command`, with no `cmd`
- **THEN** its event is not marked as read-only
