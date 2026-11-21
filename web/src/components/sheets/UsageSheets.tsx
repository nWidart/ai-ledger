import { useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { viewOf, type ToolKind } from "../../api";
import { closeSheets, parseView, setSearch, sheetKey, usePathname, useSearchOf } from "../../url";
import { queries } from "../../queries";
import { useApi } from "../../useApi";
import { ProjectDot } from "../ProjectDot";
import { Sheet } from "../Sheet";
import { ProjectSheet, type BackTo } from "./ProjectSheet";
import { knownTitle, openSessionSheet, sessName, shortId } from "./session";
import { SessionSheet } from "./SessionSheet";
import { TOOL_KINDS, ToolSheet } from "./ToolSheet";
import "./sheets.css";

// The page's control for item v, so focus can return to a re-rendered row: a row or ledger item (data-v), or a session button or link.
// Else the page's heading: every page gives it id="lede" (focusLede), not every page the lede class (Live's is a plain h1).
const twin = (v: string) => {
  const e = CSS.escape(v);
  return document.querySelector<HTMLElement>(`.wrap :is([data-v="${e}"] button, [data-session="${e}"])`)
    ?? document.querySelector<HTMLElement>(".wrap #lede");
};

/** The pages that show automated sessions whatever the URL says, so their sheets do too. */
const ALWAYS_AUTOMATED = ["/errors"];

/**
 * The project, tool and session sheets of every page, mounted once in the app's shell (App.tsx), so any page opens them in
 * place: Limits, which has no session list of its own, included. What they show lives in the URL (inspect: a project; tool,
 * mcp or skill: a tool, MCP server or skill; session, or sheet on Live: a session), so Back, reload and shared links agree
 * with them: a session opened from a project or tool sheet gets ← Back to it. Session and tool sheets offer the Wide toggle;
 * project sheets do not. Focus returns to the control that opened a sheet, or to its twin on the page when that was re-rendered.
 */
export function UsageSheets() {
  const h = useSearchOf(parseView), set = setSearch, path = usePathname();
  const view = { ...viewOf(h), automated: ALWAYS_AUTOMATED.includes(path) || h.auto };
  const sk = sheetKey(path), session = h[sk], { inspect } = h;
  const [tk, tn]: [ToolKind, string] = h.tool ? ["tool", h.tool] : h.mcp ? ["mcp", h.mcp] : ["skill", h.skill];
  const under = inspect || tn, open = !!(session || under);
  const shown = useRef(""), backTo = useRef<BackTo | null>(null);
  if (open) shown.current = session || under;
  // The session titles the page's usage payload already knows, so a sheet names its session before its details arrive. Read
  // from the cache as the sheet opens, with no observer: the shell must not keep a page's answer alive, or fetch it. A page
  // without that payload has none, and the sheet shows the short id.
  const client = useQueryClient(), known = open ? client.getQueryData(queries.usage(viewOf(h)).queryKey) : undefined;
  if (known) for (const s of [...known.top_sessions, ...known.sessions]) sessName(s);
  const proj = useApi(inspect && !session ? queries.usage({ ...view, project: inspect }) : null);
  const tool = useApi(tn && !inspect && !session ? queries.tool(tk, tn, view) : null);
  const sess = useApi(session ? queries.session(session) : null);
  const pageProject = h.project;
  const close = () => { backTo.current = null; closeSheets({ inspect: null, tool: null, mcp: null, skill: null, [sk]: null }); };
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
    body = <SessionSheet key={session} id={session} s={sess.data} error={sess.error} retry={sess.retry} range={h.range} pageProject={pageProject} view={view} />;
  } else if (inspect) {
    kind = "Project"; key = "project|" + inspect;
    title = <><ProjectDot project={inspect} />{inspect}</>;
    body = <ProjectSheet key={inspect} name={inspect} d={proj.data} error={proj.error} retry={proj.retry} range={h.range}
      source={view.source} pageProject={pageProject} automated={view.automated} onSession={toSession} backTo={backTo} />;
  } else if (tn) {
    kind = TOOL_KINDS[tk]; key = tk + "|" + tn; title = tn;
    body = <ToolSheet key={key} kind={tk} name={tn} d={tool.data} error={tool.error} retry={tool.retry} onSession={toSession} backTo={backTo} />;
  }
  return (
    <Sheet open={open} kind={kind} title={title} contentKey={key} onClose={close} busy={!!session && sess.loading} widen={!!session || (!inspect && !!tn)}
      onBack={session && under ? () => set({ [sk]: null }) : undefined} returnFocus={() => shown.current ? twin(shown.current) : null}>
      {body}
    </Sheet>
  );
}
