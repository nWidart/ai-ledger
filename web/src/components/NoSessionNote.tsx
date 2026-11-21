import { DocsLink } from "./DocsLink";
import { useLastStatus } from "./refresh";

/** The note that the store holds no session yet, once for the app, above whichever page is open: from the status poll, as the
 *  automated file's warning is. It shows once an ingest has finished (last_ingest is set) and the store counts no session, so
 *  not while the first ingest runs, and goes once a session is stored. The page still draws its zero figures under it.
 *  Nothing for an older app whose status counts no sessions. */
export function NoSessionNote() {
  const s = useLastStatus();
  if (!s?.last_ingest || s.counts.sessions !== 0) return null;
  return <section className="wrap app-warning" aria-label="No session yet">
    <div className="banner"><b>No session yet.</b> The store holds no Claude Code or Codex session.{" "}
      <DocsLink docs="start/install">Install and first run</DocsLink> says where the agents' transcripts must be.</div>
  </section>;
}
