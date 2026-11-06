import type { MouseEvent } from "react";
import { setHash } from "../../hash";

/** Filters the page to the project (or clears the filter when the page already shows it), closing the sheet and landing
 *  on the page's heading, which then answers for the new view. */
export function FilterButton({ project, pageProject }: { project: string | null; pageProject: string }) {
  const go = (e: MouseEvent<HTMLButtonElement>, p: string) => {
    // The sheet returns focus to its opener once the dialog's close event fires; the heading is the better place, so it goes after.
    const lede = () => document.querySelector<HTMLElement>(".wrap .lede")?.focus();
    const dlg = e.currentTarget.closest("dialog");
    if (dlg) dlg.addEventListener("close", lede, { once: true }); else setTimeout(lede);
    setHash({ project: p, inspect: null, session: null });
  };
  return project && pageProject !== project
    ? <button type="button" className="btn primary" onClick={e => go(e, project)}>Filter dashboard to {project}</button>
    : <button type="button" className="btn" onClick={e => go(e, "")}>Show all projects</button>;
}
