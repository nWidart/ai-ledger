import { useRef, type ReactNode } from "react";
import { sessionUrl, usageUrl, type SessionDetail, type UsagePayload } from "../../api";
import { useHashState } from "../../hash";
import { useApi } from "../../useApi";
import { ProjectDot } from "../ProjectDot";
import { Sheet } from "../Sheet";
import { ProjectSheet, type BackTo } from "./ProjectSheet";
import { knownTitle, openSessionSheet, sessName, shortId } from "./session";
import { SessionSheet } from "./SessionSheet";
import "./sheets.css";

// The page's control for item v, so focus can return to a re-rendered row: a row or ledger item (data-v), or a session button.
const twin = (v: string) => {
  const e = CSS.escape(v);
  return document.querySelector<HTMLElement>(`.wrap :is([data-v="${e}"] button, button[data-session="${e}"])`)
    ?? document.querySelector<HTMLElement>(".wrap .lede");
};

/**
 * The project and session sheets of Activity and Cost. What they show lives in the hash (inspect: a project, session: a
 * session), so Back, reload and shared links agree with them: a session opened from a project sheet gets ← Back to it.
 * data: the page's payload, for its project filter and the session titles it already knows.
 */
export function UsageSheets({ data }: { data: UsagePayload | undefined }) {
  const [h, set] = useHashState();
  const { session, inspect } = h, open = !!(session || inspect);
  const shown = useRef(""), backTo = useRef<BackTo | null>(null);
  if (open) shown.current = session || inspect;
  if (data) for (const s of [...data.top_sessions, ...data.sessions]) sessName(s);
  const proj = useApi<UsagePayload>(inspect && !session ? usageUrl({ project: inspect, range: h.range, automated: h.auto }) : null);
  const sess = useApi<SessionDetail>(session ? sessionUrl(session) : null);
  const pageProject = data?.project ?? h.project;
  const close = () => { backTo.current = null; set({ inspect: null, session: null }); };
  const toSession = (id: string, el: HTMLElement) => {
    const dlg = el.closest("dialog");
    backTo.current = { scroll: dlg?.scrollTop ?? 0, v: id };
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
  }
  return (
    <Sheet open={open} kind={kind} title={title} contentKey={key} onClose={close} busy={!!session && sess.loading}
      onBack={session && inspect ? () => set({ session: null }) : undefined} returnFocus={() => shown.current ? twin(shown.current) : null}>
      {body}
    </Sheet>
  );
}
