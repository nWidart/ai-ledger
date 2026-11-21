import type { JSX } from "react";

/** One part of a stacked bar: how many sessions, its color, and the hover text that names it. */
export interface MixPart { key: string; n: number; color: string; title: string }

/** One stacked bar of the analysed sessions, in plain HTML and CSS. Each part's `flex-grow` is its count and `min-width` keeps a
 *  thin part visible, so the browser shares the width with no measuring. A spacer for the sessions with no value shows as empty
 *  track at the end. The bar is hidden from the accessibility tree: the rows beside it carry the same figures as text. */
export function MixBar({ parts, total }: { parts: MixPart[]; total: number }): JSX.Element {
  const shown = parts.filter((p) => p.n > 0);
  const rest = total - shown.reduce((s, p) => s + p.n, 0);
  return (
    <div className="mixbar" aria-hidden="true">
      {shown.map((p) => <i key={p.key} title={p.title} style={{ flexGrow: p.n, background: p.color }} />)}
      {rest > 0 && <i className="rest" style={{ flexGrow: rest }} />}
    </div>
  );
}
