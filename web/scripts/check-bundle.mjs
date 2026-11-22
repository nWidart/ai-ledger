// Bundle budget (design decision 11). Run after `vite build`: it reads the build in src/ai_ledger/web/assets,
// prints each guarded chunk's gzip -9 size and exits 1 when one is over its limit.
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const assets = fileURLToPath(new URL("../../src/ai_ledger/web/assets/", import.meta.url));

// Limits in kB (1 kB = 1000 bytes) of gzip -9.
const LIMITS = {
  index: 130, // catches a static import of ECharts into the entry (110.1 kB with Errors' rate chart on ECharts, the activity calendar and the session sheet's lazy mount)
  CostPage: 20,
  ActivityPage: 31, // 28.3 kB with the activity calendar's section (its loading and failure states), plus 2.7 kB of room
  ErrorsPage: 26,
  ContextPage: 26,
  SessionSpans: 9, // 6.5 kB: the session sheet's tool-call chart (layout, option, reading and table), loaded when a sheet opens
  ProjectPage: 11, // 9.3 kB: the page, its blocks and the session quadrant (model, fit, reading, option); catches a static import of ECharts
  // The `<EChart>` wrapper (6.3 kB), which Cost, Activity, Errors and Project load. Project draws a chart but does not zoom,
  // so the build moved the wrapper out of `zoomReset` into its own shared chunk.
  EChart: 8,
  // The chart code the charts of Cost, Activity and Errors share. Vite names a shared chunk after its first module, so
  // the name (`zoomReset`) can change when modules move: the check then fails on "found 0" rather than skipping the chunk.
  zoomReset: 3, // 1.2 kB since the wrapper moved into `EChart`: what is left is the zoom-reset control and its helpers
  echarts: 195, // the lazy ECharts chunk, which the charts of Cost, Activity, Errors, Context and Project load
};
// The page chunks and the two shared chart chunks, each of which must match exactly one file.
const SINGLE = ["index", "CostPage", "ActivityPage", "ErrorsPage", "ContextPage", "ProjectPage", "SessionSpans", "EChart", "zoomReset"];
// How many `echarts-*.js` chunks the build must hold: one, which the charts of Cost, Activity, Errors, Context and Project load.
const ECHARTS_CHUNKS = 1;

const files = readdirSync(assets).filter((f) => f.endsWith(".js"));
const chunks = (name) => files.filter((f) => new RegExp(`^${name}-[\\w-]+\\.js$`).test(f));
const kb = (file) => gzipSync(readFileSync(assets + file), { level: 9 }).length / 1000;

const failures = [];
const report = (file, limit) => {
  const size = kb(file);
  const over = size > limit;
  console.log(`${over ? "FAIL" : "ok  "} ${file}  ${size.toFixed(1)} kB gzip  (limit ${limit} kB)`);
  if (over) failures.push(`${file} is ${size.toFixed(1)} kB gzip, over its ${limit} kB limit`);
};

for (const name of SINGLE) {
  const found = chunks(name);
  if (found.length !== 1) failures.push(`expected exactly one ${name}-*.js chunk, found ${found.length}${found.length ? "" : " (renamed? the shared chart chunk is named after its first module)"}`);
  for (const file of found) report(file, LIMITS[name]);
}

const echarts = chunks("echarts");
if (echarts.length !== ECHARTS_CHUNKS) failures.push(`expected ${ECHARTS_CHUNKS} echarts-*.js chunk(s), found ${echarts.length}`);
for (const file of echarts) report(file, LIMITS.echarts);

if (failures.length) {
  for (const f of failures) console.error(`bundle budget: ${f}`);
  process.exit(1);
}
