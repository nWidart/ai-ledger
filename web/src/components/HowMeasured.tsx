import type { ReactNode } from "react";
import type { DocsKey } from "../docs";
import { Toggletip } from "./Toggletip";

/** The method behind a section's one-line hint: a toggletip labelled "How measured" at the end of the hint, so the hint stays one
 *  line and the method text costs no height until asked for. what: the figures it explains, for the name "How measured: {what}".
 *  docs: the concept the method rests on, linked as "Learn more" at the end of the text (see Toggletip). */
export function HowMeasured({ what, docs, children }: { what: string; docs?: DocsKey; children: ReactNode }) {
  return <>{" "}<Toggletip label="How measured" name={`How measured: ${what}`} className="how" docs={docs}>{children}</Toggletip></>;
}
