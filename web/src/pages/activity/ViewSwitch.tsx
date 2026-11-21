import { useId, useLayoutEffect } from "react";
import { Judged } from "../../components/facets";
import { setSearch } from "../../url";
import { NO_JUDGMENTS_KEYS, NO_OVERVIEW_KEYS } from "./search";

export type ActivityView = "overview" | "judgments";
const VIEWS: { k: ActivityView; label: string }[] = [{ k: "overview", label: "Overview" }, { k: "judgments", label: "Judgments" }];

// A switch replaces the page's content, this control included: the click arms it, and the new control takes the focus back in
// the commit that draws it, before the browser paints or handles another key. Each view draws the switch in every state, its
// first-load placeholder included, so the focus is back before the view's request settles.
let armed = false;

/** Activity's views, Overview and Judgments, as one segmented control over the page heading. The view is in the URL
 *  (view=judgments; Overview has no key), and a switch is one history entry that drops the other view's own keys.
 *  unjudged: why the view has no judgments (noFacets), when the source filter is one agent other than Claude Code. Judgments
 *  then stays focusable and says why, and does nothing. */
export function ViewSwitch({ view, unjudged }: { view: ActivityView; unjudged?: string }) {
  const why = useId();
  useLayoutEffect(() => {
    if (!armed) return;
    armed = false;
    document.getElementById("view-" + view)?.focus();
  }, [view]);
  const pick = (to: ActivityView) => {
    if (to === view || (to === "judgments" && unjudged)) return;
    armed = true;
    setSearch(to === "judgments" ? { view: "judgments", ...NO_OVERVIEW_KEYS } : { view: null, ...NO_JUDGMENTS_KEYS });
  };
  return <div className="views">
    <div className="seg" role="group" aria-label="Activity view">
      {VIEWS.map(v => {
        const off = v.k === "judgments" && !!unjudged;
        return <button key={v.k} id={"view-" + v.k} type="button" aria-pressed={v.k === view} aria-disabled={off || undefined}
          aria-describedby={off ? why : undefined} onClick={() => pick(v.k)}>{v.label}</button>;
      })}
    </div>
    {unjudged && <span className="views-why" id={why}>{unjudged}</span>}
    {/* Beside the switch, outside the heading: the lede is a live region, and the tag's toggletip would read into it. */}
    {view === "judgments" && <Judged />}
  </div>;
}
