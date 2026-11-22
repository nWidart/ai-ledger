// Checks the charts drawn by ECharts in a real browser: what the jsdom tests, mostly on a fake runtime, cannot see. It seeds
// its own demo store in a temporary directory, serves it on a free port of 127.0.0.1, runs each page's checks in Chromium
// and stops the server when it ends, also on a failure. Each check prints a line; it exits 1 naming what fails.
//   chartfit/harness.mjs   the store, the server, the browser, the lines, what the pages reported
//   chartfit/readers.mjs   the in-page readers of a chart's drawing, for the chart under a root selector
//   chartfit/checks.mjs    the checks every chart runs, from its page's descriptor:
//     - each legend key's color is drawn, in light and after the theme toggle sets dark; with the theme on System, an
//       emulated OS dark flip changes the drawn colors with no reload; the zoom slider's two handles stand out from the
//       panel, 3:1 at least;
//     - under emulated forced colors the axis text is the resolved CanvasText, the band is the Highlight and the bars keep
//       an edge;
//     - at a 32px root font size no axis label leaves the box or overlaps another;
//     - a pointer move over a point, and the presses of Right to it, put the band over the point the tooltip and the
//       readout name, the tooltip beside it and left of it on the last point; after a zoom the band is over that point's
//       place in the points shown; the pointer is a hand over a point and not over the axis labels;
//     - plus and minus zoom, Ctrl+plus is left to the browser; dragging a slider handle changes the points drawn, not the
//       page's fixed texts, the URL or the requests made; the live region says the points shown once, on release, also
//       when the release comes right after the last move; "Show all" resets and returns focus to the chart;
//     - zooming leaves the chart's accessible name alone; newer figures for the same view, after a window focus, are drawn
//       and keep the points shown, "Show all" and the focus on it, with nothing said; after the root font size doubles
//       with the chart mounted, the next such redraw draws the labels at twice their size;
//     - with motion on, a zoom out draws the points that come back at full height;
//     - in a narrow box, the pointer on the first and the last bar, over its right third, and Home and End read that point
//       with the band centred on its bar within 1px; no label is cut by the box or overlaps another, and in a chart of
//       several tracks the newest point's label ends inside the plot;
//     - newer figures keep the point read with the keys, and say nothing; Escape with the focus on another control closes
//       a tooltip the pointer opened; with motion on the bars grow on the first drawing and on no later one; under
//       reduced motion they never grow;
//     - the pages log no CSP violation, no console error and no page error.
//   chartfit/<page>.mjs    a page's descriptor, the order of its checks and its own checks: cost (Cost's daily chart),
//                          activity (Activity's work chart, its two tracks, selection, zoom and weeks), judgments (the
//                          Judgments view's outcome trend), errors (Errors' rate chart, its two tracks, its marks across
//                          them, selection, zoom, weeks and message)
// It runs locally, not in CI. It needs the build and the pinned Playwright:
//   uv sync;  cd web && npm ci && npm run build;  cd tools/demo && npm ci
//   node chartfit.mjs [cost] [activity] [judgments] [errors]   the pages named, every page when none is; SHOTS=<dir> also saves screenshots of the charts
//                              there; CHROMIUM=<path> uses that Chromium
import { run } from "./chartfit/harness.mjs";
import { activity } from "./chartfit/activity.mjs";
import { cost } from "./chartfit/cost.mjs";
import { errors } from "./chartfit/errors.mjs";
import { judgments } from "./chartfit/judgments.mjs";

const PAGES = { cost, activity, judgments, errors };
const named = process.argv.slice(2);
const unknown = named.filter(n => !(n in PAGES));
if (unknown.length) {
  console.log(`chartfit: no page ${unknown.join(", ")}; the pages are ${Object.keys(PAGES).join(", ")}`);
  process.exit(2);
}
await run((named.length ? named : Object.keys(PAGES)).map(n => PAGES[n]));
