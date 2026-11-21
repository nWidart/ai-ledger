---
title: Babysit agents less
description: Spend less time waiting on sessions that need you, with Live and Activity's needs-attention list.
---

## Goal

Fewer sessions stop to wait for you, and you interrupt or reject fewer prompts, so **Prompts interrupted** goes down.

## Signs you need it

This playbook applies when one of these holds:

- [Live](/ai-ledger/pages/live/): a session sits under **approval?** and you did not know. The app puts a session there when a shell call has had no result for more than 30 seconds.
- Live: the rail's footer reads "N waiting for you" most times you look, or the tab title carries a count, as in `(2) Live · AI Ledger`. The count adds the sessions under **approval?** and **your turn**.
- [Activity](/ai-ledger/pages/activity/), the line under the heading: **prompts interrupted** reads "up from". The app marks it when the share goes up against the previous period of equal length.
- Rule of thumb: **Prompts interrupted** is above 5% at **30d**.
- Rule of thumb: on [Errors](/ai-ledger/pages/errors/), the type **User rejected the action** or **Permission / safety check denied** is among the five types with the most errors.

Two lines of Activity's **Needs attention** also mean that you step in, but they belong to other playbooks:

- "N error loops: a tool failed 3+ times in a row." and "N tools fail over 10% of calls": open [Kill repeated tool failures](/ai-ledger/improve/tool-failures/).
- "N sessions reached 80%+ of the context window.": open [Keep context lean](/ai-ledger/improve/lean-context/).

## Diagnose

Find out why the sessions need you. Steps 1 and 2 are on Live, while you work. Steps 3 to 5 read the past.

1. Keep Live open in a tab for one working day. When a session moves under **approval?**, select it. The agent panel's **Doing now** names the call, such as "Bash pending 45s: likely waiting for your approval" (an example). The last tool row of the stream shows its command. Write the command down. The state is inferred: transcripts record no permission prompt. A shell call that the agent started with a timeout above 120 seconds never reads **approval?**, however long it runs.
2. When a session moves under **your turn**, read the agent's last reply in your terminal. Note what it did: asked a question, asked to go on, reported the task done, or stopped part way. After 5 minutes with no new line, the session reads **idle** instead, so a session you leave waiting long drops out of **your turn**.
3. On Activity, set the range to **30d**. Write down the line under the heading: "N% of prompts interrupted; N turns and N tool calls per prompt".
4. On Errors, set the range to **30d** and leave **Hide noise and muted** off: on, it hides user rejections. Open the types **User rejected the action** and **Permission / safety check denied** in turn. In each type's detail, select **By message** and read the examples: they name the calls you rejected, or the calls a permission check blocked.
5. In the Sessions tab on Activity, open the session sheet of a session you remember stopping. Its line of figures counts its interrupted prompts. In Claude Code, a tool call you reject counts as an interrupted prompt too.

| What you see | Cause | Fix |
| --- | --- | --- |
| The commands from step 1 are safe, and they come back day after day. | Safe commands wait for your approval. | [Allow the commands you always approve](#allow-the-commands-you-always-approve) |
| **Permission / safety check denied** lists commands you would have allowed. | A permission rule blocks them. | [Allow the commands you always approve](#allow-the-commands-you-always-approve) |
| In step 2 the agent asks to go on, or stops part way. | The agent stops to check in. | [Tell the agent to finish without checking in](#tell-the-agent-to-finish-without-checking-in) |
| **User rejected the action** lists the same kind of call again and again. | The agent misses a preference of yours. | [Write down the preference the agent keeps missing](#write-down-the-preference-the-agent-keeps-missing) |
| **Prompts interrupted** is high, with few rejections: you stop the agent mid-work. | The agent heads off the wrong way. | [Agree on a plan before the work](#agree-on-a-plan-before-the-work) |
| Sessions reach **idle** before you answer them. | You do not see that a session waits. | [Get told when a session waits](#get-told-when-a-session-waits) |

## Act

### Allow the commands you always approve

In Claude Code, add each safe command from step 1 to `permissions.allow` in the project's `.claude/settings.json`. A rule `Bash(<prefix>:*)` allows every command that starts with that prefix:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run test:*)",
      "Bash(npm run lint)",
      "Bash(git status)",
      "Bash(git diff:*)"
    ]
  }
}
```

The commands above are examples: use the ones you wrote down.

- `.claude/settings.json` is shared in git with everyone who uses the repository. For rules of your own, put them in `.claude/settings.local.json` in the same folder instead.
- Allow only commands that read, build or test. Keep `git push`, deploys, and commands that delete files out of the list: those are the waits that protect you.
- If a rule in `permissions.deny` blocks a command that **Permission / safety check denied** lists, remove the rule or narrow it.

In Codex, set the approval policy and the sandbox in `~/.codex/config.toml`:

```toml
approval_policy = "on-request"
sandbox_mode = "workspace-write"
```

With these, Codex runs commands that stay inside the workspace without asking, and asks for the rest.

### Tell the agent to finish without checking in

Paste this into the project's `CLAUDE.md`, or `AGENTS.md` for Codex:

```md
## Working on your own
- Ask your questions, and agree on a plan when I ask for one, before you start. Once the work starts, do not stop to ask whether to go on.
- Do every reversible step yourself: edit, build, run the tests, fix what fails.
- Stop and ask only before a step that is hard to undo: pushing, deploying, deleting data, or changing a public API.
- Report the task done only when its tests pass. Then report in five lines or fewer.
```

If your project's tests run with a command the agent does not know, add a line that names it, such as "Run the tests with `npm test`" (an example).

### Write down the preference the agent keeps missing

1. On Errors, open **User rejected the action** and select **By message**. Find the call you reject most.
2. Write the rule that would have saved the rejection. Paste it into the project's `CLAUDE.md`, or `AGENTS.md` for Codex, such as:

   ```md
   - Never push or open a pull request without asking first.
   ```

3. In the type's detail, select **Mark fix applied** with today's date.

A preference that holds in all your projects goes in your own `~/.claude/CLAUDE.md` instead. In Codex, it goes in `~/.codex/AGENTS.md`.

### Agree on a plan before the work

Make it a habit: when a task changes more than one file, or you cannot say in one sentence what done looks like, ask for a plan first.

- In Claude Code, press Shift+Tab until the mode reads plan mode, then give the task. The agent reads and plans, and changes nothing until you accept the plan.
- In Codex, start the prompt with: "Before any change, list the files you will touch and the steps, then wait for my go."

When the plan is wrong, correct the plan, not the code.

### Get told when a session waits

These are habits. Each has a trigger.

- Keep Live open in a pinned tab while sessions run. When its tab title shows a count, such as `(2) Live · AI Ledger`, switch to it and answer the session under **approval?** first: it holds a running call.
- When you start a long task, give it a single prompt with all of the task, and work on something else until the tab title shows a count.

## Verify

Before you act, note the figures of steps 3 and 4 of Diagnose. The app has no custom date range, so you need them to compare with.

The same day, for an allowed command: the next time a session runs that command, Live shows it as a running call, such as `Bash 4.2s` (an example), and the session does not move under **approval?**.

After 7 days of work, read:

| Figure | Where | Expected |
| --- | --- | --- |
| **Prompts interrupted** | Activity, the line under the heading, at **7d** | It reads "down from": the app compares the 7 days since your change with the 7 days before. |
| **User rejected the action** | Errors, the type's detail, **Before and after the fix** | **Rate lower**. Before enough calls, it reads **Not enough calls yet**: wait. |
| **Change** of **Permission / safety check denied** | Errors, **Error types**, at **7d** | A fall. |
| "N tool calls per prompt" | Activity, the line under the heading, at **7d** | Higher than your note: the agent does more per prompt. Read it with **Errors per 100 calls**: if errors rose too, the agent works more but not better. |
| "N waiting for you" | Live, the rail's footer | Shows less often while you work. |

If a figure did not move:

- A change to `CLAUDE.md`, `AGENTS.md` or the settings applies to new sessions only. Start a new session.
- If commands still move under **approval?**, select the session and compare the call in **Doing now** with your rule. A rule that names a command must match the command as the agent writes it.
- If **Prompts interrupted** stays high with few rejections, read the session sheets of step 5 again: when the session also has error loops, the agent is stuck, not wrong. Open [Kill repeated tool failures](/ai-ledger/improve/tool-failures/).

## Related

- [Live](/ai-ledger/pages/live/#session-states): the session states and how the app infers them.
- [Activity](/ai-ledger/pages/activity/): the prompts interrupted line and **Needs attention**.
- [Errors](/ai-ledger/pages/errors/#type-detail): the type detail, **By message** and **Mark fix applied**.
- [Metric glossary](/ai-ledger/reference/glossary/#live): the definition of each state and figure.
- [Kill repeated tool failures](/ai-ledger/improve/tool-failures/): when the agent is stuck, not waiting.
- [Get sessions to finish](/ai-ledger/improve/finish-sessions/): when sessions end without reaching their goal.
- [Weekly 15-minute review](/ai-ledger/improve/weekly-review/): where this check sits in a routine.
