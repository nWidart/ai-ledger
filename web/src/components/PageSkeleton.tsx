import "./PageSkeleton.css";

const ROWS = [92, 78, 85, 64, 71];

/**
 * What a page shows while it has nothing yet (its code or its first data loading): gray blocks in the outline of a page, hidden
 * from assistive technology. title is the page's "Loading …" heading, kept in the document but visually hidden: focus lands on
 * it after a page switch and a screen reader reads it. A page whose heading stays on screen (Live) passes none.
 */
export function PageSkeleton({ title }: { title?: string }) {
  return <>
    {title && <h1 className="sr" id="lede" tabIndex={-1}>{title}</h1>}
    <div className="skel" aria-hidden="true">
      <div className="skel-b skel-title" />
      <div className="skel-sums">{[0, 1, 2, 3].map(i => <div key={i} className="skel-b skel-sum" />)}</div>
      <div className="skel-b skel-panel" />
      <div className="skel-rows">{ROWS.map((w, i) => <div key={i} className="skel-b skel-row" style={{ width: `${w}%` }} />)}</div>
    </div>
  </>;
}
