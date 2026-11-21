# Spec Delta

## MODIFIED Requirements

### Requirement: Derive each session's state
The app SHALL give each active session one state, checked in this order:
- *ended*: the transcript shows the session closed, and no timed line of the main thread follows the close.
- *idle*: no line for 5 minutes.
- *running a tool*: a tool call has no result. The state names the tool and when it started.
- *thinking*: the newest main-thread line is a human prompt or a tool result, or, for Codex and Grok, the newest main-thread turn has started and not completed. A Grok turn starts at its prompt line (`user_message_chunk`) and ends at its `turn_completed` line; a `turn_completed` with stop reason `cancelled` is an interrupt, and ends the turn too.
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

### Requirement: Group subagent work
Each event of a subagent SHALL name that subagent, so the page can group them with the subagent's start time, end time when it has ended, and number of tool calls. The tool call that started a subagent SHALL name it: for Claude Code from the call's result when the subagent ends, and while it runs from `agent-<id>.meta.json`; for Codex from the `SubAgentActivity` start item in the parent's transcript. A Grok subagent is the child session a `spawn_subagent` call starts: its events SHALL show as a subagent of the parent session, not as a session of their own, and that call SHALL name it.

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
- its cost, requests, tool calls, failed calls and cache-read share;
- its working directory, when known;
- its pulse of the 10 minutes up to now: each main-thread request's context, from the last one before, and each tool call that ended;
- the newest plan-limit use for its source.

Grok writes its usage once per turn, so a Grok session's token figures, cost and context SHALL change when a turn ends, not during it.

#### Scenario: Known context window
- **WHEN** the newest request used 55,000 tokens of context on a model with a 1,000,000-token window
- **THEN** the app reports 55,000 of 1,000,000

#### Scenario: Unknown context window
- **WHEN** the model's context window is not known
- **THEN** the app reports the context in tokens with no window

#### Scenario: Pulse
- **WHEN** a session made a main-thread request at 40,000 tokens 12 minutes ago and one at 62,000 tokens 2 minutes ago, and a subagent's call failed a minute ago
- **THEN** the pulse holds both contexts, the older one as the starting level, and one failed call

#### Scenario: Subagent request
- **WHEN** a subagent made a request in the last 10 minutes
- **THEN** the pulse's context leaves it out

#### Scenario: Line stamped after now
- **WHEN** the app reports a pulse ending at 08:10 and the store holds a request stamped 08:11
- **THEN** the pulse leaves that request out

#### Scenario: Window on a catch-up
- **WHEN** a Codex session on a model with no price states a 272,000-token window at a turn's start, more than a minute before a catch-up's cursor
- **THEN** the catch-up, the first load and the active list all report the 272,000-token window

#### Scenario: Grok figures at a turn's end
- **WHEN** a Grok session's turn is in progress after a turn that ended at 60,000 tokens of context, and the turn then writes its `turn_completed` line with its usage
- **THEN** the app reports 60,000 tokens while the turn runs, and the new turn's context and cost once it has ended

### Requirement: Report a closed session as ended
The app SHALL take as evidence of a close the `cost-state` line Claude Code writes as it exits, and the `session_end` hook line Grok writes as it exits, when it comes after the last timed line of the session's main transcript file. A subagent's lines SHALL NOT reopen a closed session, nor a line with no time. Codex writes no close line: a Codex session SHALL never be *ended*. An *ended* state SHALL carry the time of the newest timed line, as the close line has none.

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

### Requirement: Mark no shell call that cannot be read for certain
The app SHALL mark a shell call as read-only only when it reads its whole line for certain. It SHALL read words, quotes, `;`, `&&`, `||`, `|`, a newline, and a redirection to `/dev/null`, descriptor 1 or 2. It SHALL NOT mark a line with more: a lone `&`, another redirection, a heredoc, parentheses, a `\`, a backtick, a `$`, an unpaired quote, or an unquoted `*`, `?`, `[`, `{`, `^` or `#` on `rg`, `sort`, `find` or `sed`; nor Codex's `exec`, nor a call cut short or with no command line (`cmd` for Codex's `exec_command`, `command` for Grok's `run_terminal_command`).

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
