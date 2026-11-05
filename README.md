# Claude errors dashboard

Scans Claude Code transcripts (`~/.claude/projects`) for failed tool calls, groups them into error types with suggested fixes, and builds an interactive HTML dashboard to track the error rate over time.

## Usage

```bash
python3 build_dashboard.py
open claude-errors.html
```

Options: `--projects <dir>` (transcript root), `--out <file>` (output HTML).

Each example has a permalink (`#ex=<tool_use_id>`, the "Copy URL" button) and each error type has one (`#cat=<type>`), so you can paste a specific error into an agent prompt. The tool_use_id also lets an agent find the call in the transcripts with `grep -r <id> ~/.claude/projects`.

Re-run any time to refresh. Fixes you mark as applied are stored in the browser's localStorage, so the chart shows a marker on that date and the before/after error rate.

## Files

- `build_dashboard.py` — extractor and categorizer. Add a rule to `RULES` when a new error pattern shows up in "Other".
- `dashboard_template.html` — dashboard page; the script injects the data at `/*__DATA__*/null`.
- `claude-errors.html` — generated output, git-ignored because it contains transcript content.
