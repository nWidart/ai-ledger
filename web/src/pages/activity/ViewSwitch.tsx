import { useEffect, useId } from "react";
import { Judged } from "../../components/facets";
import { setSearch } from "../../url";
import { NO_JUDGMENTS_KEYS, NO_OVERVIEW_KEYS } from "./search";

export type ActivityView = "overview" | "judgments";
const VIEWS: { k: ActivityView; label: string }[] = [{ k: "overview", label: "Overview" }, { k: "judgments", label: "Judgments" }];
/** Why Judgments cannot be picked for a Codex-only view. */
export const NO_FACETS = "Codex writes no facets: /insights judges Claude Code sessions only.";

// A switch replaces the page's content, this control included: the click arms it, and the new control takes the focus back.
let armed = false;

/** Activity's views, Overview and Judgments, as one segmented control over the page heading. The view is in the URL
 *  (view=judgments; Overview has no key), and a switch is one history entry that drops the other view's own keys.
 *  codex: the source filter is Codex only, which has no judgments. Judgments then stays focusable and says why, and does nothing. */
export function ViewSwitch({ view, codex }: { view: ActivityView; codex: boolean }) {
  const why = useId();
  useEffect(() => {
    if (!armed) return;
    armed = false;
    document.getElementById("view-" + view)?.focus();
  }, [view]);
  const pick = (to: ActivityView) => {
    if (to === view || (to === "judgments" && codex)) return;
    armed = true;
    setSearch(to === "judgments" ? { view: "judgments", ...NO_OVERVIEW_KEYS } : { view: null, ...NO_JUDGMENTS_KEYS });
  };
  return <div className="views">
    <div className="seg" role="group" aria-label="Activity view">
      {VIEWS.map(v => {
        const off = v.k === "judgments" && codex;
        return <button key={v.k} id={"view-" + v.k} type="button" aria-pressed={v.k === view} aria-disabled={off || undefined}
          aria-describedby={off ? why : undefined} onClick={() => pick(v.k)}>{v.label}</button>;
      })}
    </div>
    {codex && <span className="views-why" id={why}>{NO_FACETS}</span>}
    {/* Beside the switch, outside the heading: the lede is a live region, and the tag's toggletip would read into it. */}
    {view === "judgments" && <Judged />}
  </div>;
}
