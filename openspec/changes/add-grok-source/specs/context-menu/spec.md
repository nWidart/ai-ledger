# Spec Delta

## MODIFIED Requirements

### Requirement: Copy the command that resumes a session
Copy resume command SHALL copy the command that resumes the session in its agent: `claude --resume <id>` for a Claude Code session, `codex resume <id>` for a Codex session and `grok --resume <id>` for a Grok session. When the store has the session's working directory, the command SHALL first change to it, `cd '<cwd>' && `, with the directory quoted for a POSIX shell.

#### Scenario: Claude Code session with a directory
- **WHEN** the user picks Copy resume command for Claude Code session `abc` with working directory `/Users/me/my app`
- **THEN** the clipboard holds `cd '/Users/me/my app' && claude --resume abc`

#### Scenario: Codex session
- **WHEN** the user picks Copy resume command for Codex session `def` with no working directory
- **THEN** the clipboard holds `codex resume def`

#### Scenario: Grok session
- **WHEN** the user picks Copy resume command for Grok session `ghi` with working directory `/Users/me/app`
- **THEN** the clipboard holds `cd '/Users/me/app' && grok --resume ghi`

#### Scenario: Directory with a single quote
- **WHEN** the working directory is `/tmp/it's`
- **THEN** the command starts with `cd '/tmp/it'\''s' && `
