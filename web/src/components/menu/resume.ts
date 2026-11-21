// The shell command that resumes a session in its agent, shared by the context menu and the session sheet.
import type { Source } from "../../api";

/** A POSIX single-quoted word: each ' inside becomes '\''. */
const quote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

/** Each agent's resume command for a session id. */
const RESUME: Record<Source, (id: string) => string> = {
  claude: id => `claude --resume ${id}`, codex: id => `codex resume ${id}`, grok: id => `grok --resume ${id}`,
};

/** The agent's resume command (RESUME), after `cd '<cwd>' && ` when the directory is known. */
export function resumeCommand({ source, session_id, cwd }: { source: Source; session_id: string; cwd?: string | null }): string {
  const cmd = RESUME[source](session_id);
  return cwd ? `cd ${quote(cwd)} && ${cmd}` : cmd;
}
