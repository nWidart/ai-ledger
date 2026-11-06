import { useRef, type ReactNode } from "react";
import { sessionUrl, toolUrl, usageUrl, viewOf, type SessionDetail, type ToolKind, type ToolPayload, type UsagePayload } from "../../api";
import { useHashState } from "../../hash";
import { useApi } from "../../useApi";
import { ProjectDot } from "../ProjectDot";
import { Sheet } from "../Sheet";
import { ProjectSheet, type BackTo } from "./ProjectSheet";
import { knownTitle, openSessionSheet, sessName, shortId } from "./session";
import { SessionSheet } from "./SessionSheet";
import { TOOL_KINDS, ToolSheet } from "./ToolSheet";
import "./sheets.css";

// The page's control for item v, so focus can return to a re-rendered row: a row or ledger item (data-v), or a session button.
const twin = (v: string) => {
  const e = CSS.escape(v);
  return document.querySelector<HTMLElement>(`.wrap :is([data-v="${e}"] button, button[data-session="${e}"])`)
    ?? document.querySelector<HTMLElement>(".wrap .lede");
};

/**
 * The project, tool and session sheets of Activity, Cost and Errors. What they show lives in the hash (inspect: a project;
 * tool, mcp or skill: a tool, MCP server or skill; session: a session), so Back, reload and shared links agree with them:
 * a session opened from a project or tool sheet gets ← Back to it.
 * data: the page's payload, for its project filter and the session titles it already knows.
 * automated: the page shows automated sessions whatever the hash says (Errors), so its sheets do too.
 */
export function UsageSheets({ data, automated }: { data: UsagePayload | undefined; automated?: boolean }) {
  const [h, set] = useHashState();
  const view = { ...viewOf(h), automated: automated || h.auto };
  const { session, inspect } = h;
  const [tk, tn]: [ToolKind, string] = h.tool ? ["tool", h.tool] : h.mcp ? ["mcp", h.mcp] : ["skill", h.skill];
  const under = inspect || tn, open = !!(session || under);
  const shown = useRef(""), backTo = useRef<BackTo | null>(null);
  if (open) shown.current = session || under;
  if (data) for (const s of [...data.top_sessions, ...data.sessions]) sessName(s);
  const proj = useApi<UsagePayload>(inspect && !session ? usageUrl({ ...view, project: inspect }) : null);
  const tool = useApi<ToolPayload>(tn && !inspect && !session ? toolUrl(tk, tn, view) : null);
  const sess = useApi<SessionDetail>(session ? sessionUrl(session) : null);
  const pageProject = data?.project ?? h.project;
  const close = () => { backTo.current = null; set({ inspect: null, tool: null, mcp: null, skill: null, session: null }); };
  const toSession = (id: string, el: HTMLElement) => {
    const dlg = el.closest("dialog");
    backTo.current = { scroll: dlg?.scrollTop ?? 0, v: el.closest<HTMLElement>("[data-v]")?.dataset.v ?? id };
    openSessionSheet(id);
  };

  let kind = "", title: ReactNode = "", key = "", body: ReactNode = null;
  if (session) {
    const name = sess.data?.title || knownTitle(session);
    kind = "Session"; key = "session|" + session;
    title = name ? <>{name} <span className="sheet-sub">{shortId(session)}</span></> : shortId(session);
    body = <SessionSheet key={session} id={session} s={sess.data} error={sess.error} retry={sess.retry} range={h.range} pageProject={pageProject} />;
  } else if (inspect) {
    kind = "Project"; key = "project|" + inspect;
    title = <><ProjectDot project={inspect} />{inspect}</>;
    body = <ProjectSheet key={inspect} name={inspect} d={proj.data} error={proj.error} retry={proj.retry} range={h.range}
      pageProject={pageProject} onSession={toSession} backTo={backTo} />;
  } else if (tn) {
    kind = TOOL_KINDS[tk]; key = tk + "|" + tn; title = tn;
    body = <ToolSheet key={key} kind={tk} name={tn} d={tool.data} error={tool.error} retry={tool.retry} onSession={toSession} backTo={backTo} />;
  }
  return (
    <Sheet open={open} kind={kind} title={title} contentKey={key} onClose={close} busy={!!session && sess.loading}
      onBack={session && under ? () => set({ session: null }) : undefined} returnFocus={() => shown.current ? twin(shown.current) : null}>
      {body}
    </Sheet>
  );
}
