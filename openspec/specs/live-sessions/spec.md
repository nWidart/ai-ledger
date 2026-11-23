# live-sessions Specification

## Purpose

Follow running Claude Code, Codex and Grok sessions within seconds of their transcript lines being written: which sessions are active, what each is doing, and the events of one session as they arrive, with transcript text sent only on request.

## Requirements

### Requirement: List active sessions
The app SHALL list as active every session whose newest stored line is less than 10 minutes old, newest first. Each entry SHALL give the session's project, source, git branch, model, cost so far, state and the time the session started. An entry SHALL NOT carry the session's newest call (`latest`): the stream reports calls. The list SHALL honour the project, source and automated filters.

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

#### Scenario: No newest call
- **WHEN** an active session's newest event is a tool call
- **THEN** its entry in `/api/live` holds no `latest` field

### Requirement: Derive each session's state
The app SHALL give each active session one state, checked in this order:
- *ended*: the transcript shows the session closed, and no timed line of the main thread follows the close.
- *idle*: no line for 5 minutes.
- *running a tool*: a tool call has no result. The state names the tool and when it started.
- *thinking*: the newest main-thread line is a human prompt or a tool result, or, for Codex and Grok, the newest main-thread turn has started and not completed.
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
- **WHEN** a Codex session's newest turn started in a `<session>_<thread>` rollout file that continues the main thread (its `session_meta` has the same `session_id` and `id`) and has not completed, with no pending tool call
- **THEN** the state is thinking

#### Scenario: Child thread's turn completes
- **WHEN** a Codex session's main-thread turn has started and not completed, and a subagent thread's turn completes, with no pending tool call
- **THEN** the state stays thinking

#### Scenario: Grok turn in progress
- **WHEN** a Grok session's newest main-thread turn has a `user_message_chunk` prompt line and no `turn_completed` line yet, and no pending tool call
- **THEN** the state is thinking

#### Scenario: Grok turn cancelled
- **WHEN** a Grok session's newest main-thread turn ends with a `turn_completed` line whose stop reason is `cancelled`
- **THEN** the turn counts as interrupted, and the state is your turn

#### Scenario: Cancelled turn with a call still open
- **WHEN** a Grok or Codex turn is cancelled while one of its tool calls has no result, and an earlier poll showed that call running
- **THEN** the state is your turn, and the next poll sends the call ended at the interruption, failed as interrupted

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
When a shell tool call (Claude Code `Bash`, Codex `exec` or `exec_command`, Grok `run_terminal_command`) has had no result for more than 30 seconds, the app SHALL report the state as *likely waiting for approval*, with how long the call has been pending. A newer pending call, in the main thread or a subagent, SHALL NOT hide it; with several such calls, the oldest SHALL be reported.

#### Scenario: Slow shell call
- **WHEN** a `Bash` call started 45 seconds ago and has no result
- **THEN** the state is likely waiting for approval, pending 45 seconds

#### Scenario: Newer call in a subagent
- **WHEN** a `Bash` call started 45 seconds ago and has no result, and a subagent started a `Read` call 2 seconds ago
- **THEN** the state is likely waiting for approval, naming `Bash`, pending 45 seconds

#### Scenario: Slow non-shell call
- **WHEN** a `WebFetch` call started 45 seconds ago and has no result
- **THEN** the state is running a tool

#### Scenario: Slow Grok shell call
- **WHEN** a Grok `run_terminal_command` call started 45 seconds ago and has no result
- **THEN** the state is likely waiting for approval, naming `run_terminal_command`, pending 45 seconds

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
Every payload that carries a state SHALL say whether it is inferred. *likely waiting for approval* is always inferred: no transcript records a permission prompt. *thinking* is inferred for Claude Code, which records no request in flight, and wherever a subagent's work gives it. It is not inferred for the own turns of Codex and Grok, which they record. *running a tool*, *your turn*, *idle* and *ended* are not inferred.

#### Scenario: Thinking is inferred
- **WHEN** a session's state is thinking
- **THEN** the payload marks the state as inferred

#### Scenario: Codex turn in progress
- **WHEN** a Codex session's newest main-thread turn has started, has not completed, and has no pending tool call
- **THEN** the state is thinking and is not marked as inferred

#### Scenario: Grok turn in progress
- **WHEN** a Grok session's newest main-thread turn has started, has not completed, and has no pending tool call
- **THEN** the state is thinking and is not marked as inferred

#### Scenario: Thinking from a subagent
- **WHEN** a Codex session's state is thinking because a subagent is at work
- **THEN** the payload marks the state as inferred

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
Each event of a subagent SHALL name that subagent, so the page can group them with the subagent's start time, end time when it has ended, and number of tool calls. The tool call that started a subagent SHALL name it: for Claude Code from the call's result when the subagent ends, and while it runs from `agent-<id>.meta.json`; for Codex from the `SubAgentActivity` start item in the parent's transcript; for Grok from the `spawn_subagent` call's result.

#### Scenario: Subagent with three tool calls
- **WHEN** a Claude Code session starts an Explore subagent that makes three tool calls
- **THEN** the three calls are returned marked as that subagent's, not as the main thread's

#### Scenario: Subagent still running
- **WHEN** a Claude Code session started a subagent with an `Agent` call that has no result yet
- **THEN** that call names the subagent

#### Scenario: Codex subagent
- **WHEN** a Codex subagent thread writes `rollout-<time>-<thread>.jsonl` with its own `session_meta` naming the parent session, and makes two tool calls
- **THEN** the parent session's events hold the two calls marked as that thread's

#### Scenario: Codex spawn call
- **WHEN** a Codex `spawn_agent` call's id equals the `id` of a `SubAgentActivity` item of kind `started` for thread `<thread>`
- **THEN** that call names `<thread>`, and its end time stays unset until its result arrives

#### Scenario: Codex CLI without a start item
- **WHEN** a subagent of a Codex CLI that writes no `SubAgentActivity` start item runs
- **THEN** its lane is named by no call, and the page tells it done by its last turn mark

#### Scenario: Grok subagent
- **WHEN** a Grok session's `spawn_subagent` call starts a child session that makes two tool calls
- **THEN** the parent session's events hold the two calls marked as that subagent's, the call names it, and the active list holds no entry for the child

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
A tool call's input SHALL be cut to 300 characters by default, and a subagent call (Claude Code `Agent`, Codex `spawn_agent`, Grok `spawn_subagent`) SHALL carry its description instead of its prompt. A description SHALL be cut to 300 characters as an input is: a subagent call's, and the one the agent gave a shell call.

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
- its newest main-thread request's context, and its window when known, alike on a first load, a catch-up and the list;
- its compactions, with the context before each;
- its cost, requests, tool calls, failed calls and cache-read share.

#### Scenario: Known context window
- **WHEN** the newest request used 55,000 tokens of context on a model with a 1,000,000-token window
- **THEN** the app reports 55,000 of 1,000,000

#### Scenario: Unknown context window
- **WHEN** the model's context window is not known
- **THEN** the app reports the context in tokens with no window

#### Scenario: Window on a catch-up
- **WHEN** a Codex session on a model with no price states a 272,000-token window at a turn's start, more than a minute before a catch-up's cursor
- **THEN** the catch-up, the first load and the active list all report the 272,000-token window

### Requirement: Report the session's pulse
For one session, the app SHALL report its pulse of the 10 minutes up to now: each main-thread request's context, from the last one before, and each tool call that ended.

#### Scenario: Pulse
- **WHEN** a session made a main-thread request at 40,000 tokens 12 minutes ago and one at 62,000 tokens 2 minutes ago, and a subagent's call failed a minute ago
- **THEN** the pulse holds both contexts, the older one as the starting level, and one failed call

#### Scenario: Subagent request
- **WHEN** a subagent made a request in the last 10 minutes
- **THEN** the pulse's context leaves it out

#### Scenario: Line stamped after now
- **WHEN** the app reports a pulse ending at 08:10 and the store holds a request stamped 08:11
- **THEN** the pulse leaves that request out

### Requirement: Leave plan limits and directory out of the session report
`/api/live/session` SHALL NOT report plan-limit use (`limits`) or the working directory (`cwd`): the Limits page and the session detail report them.

#### Scenario: No plan limits or directory
- **WHEN** the session's source has open plan-limit windows and the store holds the session's working directory
- **THEN** `/api/live/session` holds neither a `limits` nor a `cwd` field

### Requirement: Report Grok's figures when a turn ends
Grok writes its usage once per turn, so a Grok session's token figures, cost and context SHALL change when a turn ends, not during it.

#### Scenario: Grok figures at a turn's end
- **WHEN** a Grok session's turn is in progress after a turn that ended at 60,000 tokens of context, and the turn then writes its `turn_completed` line with its usage
- **THEN** the app reports 60,000 tokens while the turn runs, and the new turn's context and cost once it has ended

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
The untimed `cost-state` line Claude Code writes as it exits SHALL close a session when it follows the last timed line of the session's main transcript file. The timed `session_end` hook line Grok writes as it exits SHALL close a session when no line of the main file has a newer time. A subagent's lines SHALL NOT reopen a closed session, nor a line with no time. Codex writes no close line: a Codex session SHALL never be *ended*. An *ended* state SHALL carry the time of the newest timed line.

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

#### Scenario: Grok session closed
- **WHEN** a Grok session's main transcript ends with a `session_end` hook line
- **THEN** the state is ended, with the time of the session's newest timed line

#### Scenario: Resumed session before its first timed line
- **WHEN** a resumed Claude Code session has written only lines with no time, such as `mode` or `tools-used`, after its `cost-state` line
- **THEN** the state is ended until its first timed line, a known limit: Claude Code writes such lines at exit as well, so none marks a resume

### Requirement: Mark tool calls that only read
The app SHALL mark a tool call as read-only when its tool is `Read`, `Grep` or `Glob`, or Grok's `read_file`, `grep` or `list_dir`, or when it is a shell call (Claude Code `Bash`, Codex `exec_command`, Grok `run_terminal_command` by its `command`) whose every command, named without a path, is `grep`, `cat`, `ls`, `head`, `tail`, `wc`, `nl`, `cd`, `pwd` or `echo`, or is `rg`, `sort` or `find` with only flags the app lists as reading, or is `sed -n` with a script that only prints lines by number.

#### Scenario: Read-only call
- **WHEN** a session makes a `Grep` call and a `Bash` call that runs `git commit`
- **THEN** the `Grep` event is marked as read-only and the `Bash` event is not

#### Scenario: Codex read-only call
- **WHEN** a Codex `exec_command` runs `rg TODO src` and another runs `rg TODO src && rm notes.md`
- **THEN** the first is marked as read-only and the second is not

#### Scenario: Grok read-only call
- **WHEN** a Grok `run_terminal_command` call's `command` is `rg TODO src` and another's is `rg TODO src && rm notes.md`
- **THEN** the first is marked as read-only and the second is not

#### Scenario: Grok read tool
- **WHEN** a Grok session makes a `read_file` call and a `search_replace` call
- **THEN** the `read_file` event is marked as read-only and the `search_replace` event is not

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
The app SHALL mark a shell call as read-only only when it reads its whole line for certain. It SHALL read words, quotes, `;`, `&&`, `||`, `|`, a newline, and a redirection to `/dev/null`, descriptor 1 or 2. It SHALL NOT mark a line with more: a lone `&`, another redirection, a heredoc, parentheses, a `\`, a backtick, a `$`, an unpaired quote, or an unquoted `*`, `?`, `[`, `{`, `^` or `#` on `rg`, `sort`, `find` or `sed`; nor Codex's `exec`, nor a call cut short or with no command line.

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

### Requirement: Keep a session working while a subagent works
When the main thread reads *your turn* and a subagent's newest line is newer than the main thread's and shows it at work, the state SHALL be *thinking*, inferred, since that line. A Codex or Grok subagent is at work when its newest turn mark is a turn start; a Claude Code one when its newest event is a finished tool call. A subagent's pending call still reads *running a tool*.

#### Scenario: Codex subagent mid-turn
- **WHEN** the main thread's last turn completed at 10:00:09 and a subagent started a turn at 10:00:12 that has not completed
- **THEN** the state is thinking since 10:00:12, marked as inferred

#### Scenario: Claude Code subagent between calls
- **WHEN** the main thread's newest event is a reply, after a background `Agent` call returned, and a subagent's newest event is a finished tool call, newer than it
- **THEN** the state is thinking, inferred

#### Scenario: Subagent done
- **WHEN** a Codex subagent's newest turn mark is a turn end
- **THEN** the state is your turn

#### Scenario: Subagent older than the main thread
- **WHEN** the main thread's turn completed after a subagent's last turn start
- **THEN** the state is your turn

### Requirement: Keep the main thread in the state window
The newest lines read for a session's state SHALL be taken apart for the main thread and for its subagents, so subagent traffic never pushes main-thread lines out. For Codex and Grok, the newest turn mark of the main thread and of each subagent file SHALL be read whatever its age.

#### Scenario: Busy subagent
- **WHEN** a subagent wrote more than 200 lines after the main thread's last line
- **THEN** the main thread's newest lines are still read for the state

#### Scenario: Long turn
- **WHEN** a Codex main-thread turn started more than 200 lines ago and has not completed
- **THEN** the state is thinking

### Requirement: Show a failed call made inside a Codex script
A failed Codex item that no tool call of the session has the id of, such as a command an `exec` script ran, SHALL be one finished, failed tool event on its file's lane, with its tool, input summary and error text, starting and ending at its line's time. It SHALL NOT change the state. A failed item with a matching call marks that call failed; a successful inner call shows nothing, except a delegation (see the next requirement).

#### Scenario: Failed command inside a script
- **WHEN** an `exec` call's script runs a command that fails and the line has an id no call has
- **THEN** the stream holds a failed `exec_command` event with the command and its error text

#### Scenario: Matching call
- **WHEN** a failed item has the id of a tool call
- **THEN** that call is marked failed and no second event is shown

### Requirement: Show a delegation made inside a Codex script
A completed delegation item SHALL end the call with its id, or, when no call has that id, be one finished tool event of its own, so the Tree's node for it opens a row.

#### Scenario: Delegation inside a script
- **WHEN** an `exec` call's script delegates a task and the completed delegation item has an id no call has
- **THEN** the stream holds one finished, not failed, delegation event with that id

### Requirement: Skip a forked subagent's copied history
A forked Codex subagent's transcript names, in `subagent_history_start_ordinal`, the first line of its own: the lines before it copy the parent's history. Those lines SHALL produce no event and no state evidence.

#### Scenario: Copied turn start
- **WHEN** a forked subagent's file copies a parent turn start below its start ordinal
- **THEN** the session's events and state do not hold that turn start

### Requirement: Read only new lines on a repeated Live request
The app SHALL keep what it derived from each stored line between Live requests, and SHALL read and parse a line's stored text again only after it dropped what it kept for that line. A Live answer SHALL be the same as an answer computed with nothing kept. What the app keeps SHALL be bounded, so a long run does not grow it without limit.

#### Scenario: Active list after new lines
- **WHEN** the active list was answered once, then one active session gains 3 lines, then the list is asked for again
- **THEN** the second answer reads and parses the stored text of those 3 lines only, and equals an answer computed with nothing kept

#### Scenario: Session state after new lines
- **WHEN** a session's payload was answered once, then the session gains a line, then its payload is asked for again
- **THEN** its state and window are read without parsing again the lines read for the first answer

#### Scenario: Line stored late
- **WHEN** a line stamped before lines already read is stored after them, inside the newest lines of its session
- **THEN** the next answer holds it, as an answer with nothing kept does

#### Scenario: Line moved to another session
- **WHEN** an ingest moves stored lines to another session or marks them as a subagent's
- **THEN** the next answer places them as an answer with nothing kept does

#### Scenario: Kept lines over the bound
- **WHEN** the lines kept reach the bound
- **THEN** the app drops kept lines, and a later answer that needs a dropped line reads it again and is unchanged

### Requirement: Give each active session's agents on request
A request for the active list that asks for agents (`agents=1`) SHALL receive, for each session, its agents as one flat list: its subagents and its delegation calls, each with an id, a kind, and the id of its parent agent, or none for the main thread. A request that does not ask SHALL receive no agents, and the rest of its answer SHALL be the same either way.

#### Scenario: List with agents
- **WHEN** an active session has two subagents and one delegation call, and the page asks for `/api/live?agents=1`
- **THEN** the session's entry holds three agents, two of kind agent and one of kind delegation

#### Scenario: List without agents
- **WHEN** the page asks for `/api/live` for the same session
- **THEN** the entry holds no `agents` field, and its other fields equal those of the answer with agents

#### Scenario: Session with no agent
- **WHEN** a session that made no subagent and no delegation call is listed with `agents=1`
- **THEN** its entry holds an empty list of agents

#### Scenario: Subagents of all three sources
- **WHEN** a Claude Code, a Codex and a Grok session each run one subagent
- **THEN** each session's agent has the same fields

### Requirement: Name each subagent's parent
A subagent's parent SHALL be the thread that made the call that started it: none when the main thread made it, else that subagent's id. The starting call SHALL be the one the session's events name for that subagent. A subagent with no known starting call SHALL have no parent. A parent that the list does not hold SHALL read as none.

#### Scenario: Subagent of the main thread
- **WHEN** a session's main thread started subagent `a1` with an `Agent` call
- **THEN** agent `a1` has no parent

#### Scenario: Subagent of a subagent
- **WHEN** subagent `a1` started subagent `b2` with an `Agent` call written in `agent-a1.jsonl`
- **THEN** agent `b2` has the parent `a1`

#### Scenario: Running Claude Code subagent
- **WHEN** subagent `a1`'s `Agent` call for `b2` has no result yet, and `agent-b2.meta.json` names that call
- **THEN** agent `b2` has the parent `a1`

#### Scenario: Codex thread spawned by a thread
- **WHEN** a Codex subagent thread `t1` holds the `SubAgentActivity` start item for thread `t2`
- **THEN** agent `t2` has the parent `t1`

#### Scenario: Starting call not known
- **WHEN** no call and no `meta.json` names subagent `c3`
- **THEN** agent `c3` has no parent, the name "Subagent" and no description

### Requirement: Give each subagent's figures
Each agent of kind agent SHALL carry its name (the tool of its starting call), its description, the times of its first and its last call or request, its tool calls, its failed calls, the cost of its priced requests and the model of its newest request. A figure the app does not know SHALL be none. The cost and the model SHALL equal those `/api/live/session` gives the same subagent's lane.

#### Scenario: Subagent figures
- **WHEN** subagent `a1`, started by an `Agent` call described "Map the parsers", made 8 tool calls of which 2 failed, on `claude-haiku-5-5` for $0.05
- **THEN** its agent carries the name `Agent`, the description "Map the parsers", 8 tool calls, 2 errors, $0.05 and `claude-haiku-5-5`

#### Scenario: Grok subagent
- **WHEN** a Grok subagent made three tool calls, and Grok's usage counts in its parent's turn
- **THEN** its agent carries 3 tool calls, no cost and no model

#### Scenario: Subagent with no call yet
- **WHEN** a Claude Code subagent made one request and no tool call
- **THEN** its agent carries 0 tool calls and the time of that request as its start

### Requirement: Tell whether a subagent is finished
Each agent of kind agent SHALL carry a status, `running` or `done`, by the rule that tells a lane finished: a subagent whose own lines hold a turn start or end is done when its newest turn has ended; any other is done when the call that started it has ended. A subagent with neither SHALL be done once none of its calls is pending and its newest call or request is more than 5 minutes old.

#### Scenario: Codex thread whose turn ended
- **WHEN** a Codex subagent thread's newest turn mark is a turn end
- **THEN** its agent's status is `done`

#### Scenario: Agent call still open
- **WHEN** the `Agent` call that started a Claude Code subagent has no result
- **THEN** its agent's status is `running`

#### Scenario: Agent call ended
- **WHEN** that `Agent` call has a result
- **THEN** its agent's status is `done`

#### Scenario: Unknown starting call
- **WHEN** a subagent with no known starting call and no turn mark made its last call 7 minutes ago, and none is pending
- **THEN** its agent's status is `done`, and it was `running` 3 minutes after that call

### Requirement: Report delegation calls as agents
Each `mcp__t3-code__delegate_task` call of a session SHALL be an agent of kind delegation: its id the call's id, its parent the thread that made the call, its description the call's `title`, its start and end the call's, and the provider and the model the store holds for it. It SHALL carry no tool calls, errors or cost. The app SHALL NOT name, link or look for the session the call started.

#### Scenario: Delegation by the main thread
- **WHEN** a session's main thread made a delegation call titled "Write the tests" for the model `gpt-6.1-sol`
- **THEN** the session has an agent of kind delegation with that description and that model, and no parent

#### Scenario: Delegation by a subagent
- **WHEN** subagent `a1` made a delegation call
- **THEN** the delegation's parent is `a1`

#### Scenario: Child session is active too
- **WHEN** the session a delegation call started is itself active
- **THEN** the list holds it as a session of its own, and the delegation carries no session id

### Requirement: Say what a delegation's status tells
A delegation's status SHALL be `pending` while its call has no result, `failed` when the call failed, `done` when its result states the status `completed`, and `started` otherwise. `started` SHALL mean only that the call returned: the transcript does not say when the delegated task ends, and the app SHALL NOT infer it.

#### Scenario: Call returned at once
- **WHEN** a delegation call returned with the status `running` two hours ago
- **THEN** its status is `started`

#### Scenario: Call that waited
- **WHEN** a delegation call made with `mode: "wait"` returned with the status `completed`
- **THEN** its status is `done`

#### Scenario: Call with no result
- **WHEN** a delegation call has no result yet
- **THEN** its status is `pending`

#### Scenario: Call refused
- **WHEN** a delegation call's result is an error
- **THEN** its status is `failed`

### Requirement: Cap the agents of one session
A session's entry SHALL hold at most 200 agents: first those not finished, then the finished ones, newest start first. A subagent is finished when `done`, a delegation when `done` or `failed` or when its call returned more than 10 minutes ago, as the Tree folds it; the delegation's `status` stays as it is. The entry SHALL say how many agents it left out (`agents_more`), 0 when none.

#### Scenario: Session with 260 agents
- **WHEN** a session has 10 running subagents and 250 finished ones
- **THEN** its entry holds the 10 running and the 190 finished that started last, and says it left 60 out

#### Scenario: Under the cap
- **WHEN** a session has 12 agents
- **THEN** its entry holds all 12 and says it left 0 out

### Requirement: Keep prompt text out of the agents
An agent SHALL carry no prompt, reply, task or tool-result text. Its description SHALL be cut to 300 characters, whether the request asks for text or not.

#### Scenario: Long description
- **WHEN** an `Agent` call has a description of 2,000 characters and the page asks for `/api/live?agents=1&text=1`
- **THEN** the agent's description holds 300 characters

#### Scenario: Delegated task text
- **WHEN** a delegation call's `task` holds 2,000 characters
- **THEN** the answer holds none of it
