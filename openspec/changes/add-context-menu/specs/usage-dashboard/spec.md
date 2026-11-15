# Spec Delta

## ADDED Requirements

### Requirement: Show how to resume a session in its sheet
A session sheet SHALL show, at its foot next to the session id, the session's working directory when the store has it, and the command that resumes the session in its agent, the same text the session's context menu copies, each with a Copy button. A copy SHALL say "Copied" or that the text could not be copied, as a polite status.

#### Scenario: Claude Code session with a directory
- **WHEN** the user opens the sheet of Claude Code session `abc` with working directory `/Users/me/app`
- **THEN** the sheet shows `/Users/me/app` and `cd '/Users/me/app' && claude --resume abc`, each with a Copy button

#### Scenario: Session without a directory
- **WHEN** the user opens the sheet of Codex session `def` the store holds no working directory for
- **THEN** the sheet shows `codex resume def` with a Copy button and no working directory
