import type { ReactNode } from "react";
import { Toggletip } from "./Toggletip";

/** The method behind a section's one-line hint: a toggletip labelled "How measured" at the end of the hint, so the hint stays one
 *  line and the method text costs no height until asked for. what: the figures it explains, for the name "How measured: {what}". */
export function HowMeasured({ what, children }: { what: string; children: ReactNode }) {
  return <>{" "}<Toggletip label="How measured" name={`How measured: ${what}`} className="how">{children}</Toggletip></>;
}
