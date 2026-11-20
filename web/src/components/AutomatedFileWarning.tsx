import { useLastStatus } from "./refresh";

/** The warning that the automated projects file was ignored, once for the app. The server reads the file on every request and
 *  it is the same for every page, so the app shell shows the warning above whichever page is open, from the status poll: no
 *  page wires it. Nothing when the file is fine or absent, or when the app is older than the status field. */
export function AutomatedFileWarning() {
  const f = useLastStatus()?.automated_file;
  if (!f?.error) return null;
  return <section className="wrap app-warning" aria-label="Automated projects file">
    <div className="banner" role="alert"><b>Automated projects file ignored:</b> <code>{f.path}</code> could not be used
      ({f.error}). The file is ignored until it is fixed; only the built-in detection applies.</div>
  </section>;
}
