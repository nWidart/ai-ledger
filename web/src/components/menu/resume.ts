// The shell command that resumes a session in its agent, shared by the context menu and the session sheet.
import type { Source } from "../../api";

/** A POSIX single-quoted word: each ' inside becomes '\''. */
const quote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

/** `claude --resume <id>` or `codex resume <id>`, after `cd '<cwd>' && ` when the directory is known. */
export function resumeCommand({ source, session_id, cwd }: { source: Source; session_id: string; cwd?: string | null }): string {
  const cmd = source === "codex" ? `codex resume ${session_id}` : `claude --resume ${session_id}`;
  return cwd ? `cd ${quote(cwd)} && ${cmd}` : cmd;
}
