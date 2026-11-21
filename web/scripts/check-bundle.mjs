// Bundle budget (design decision 11). Run after `vite build`: it reads the build in src/ai_ledger/web/assets,
// prints each guarded chunk's gzip -9 size and exits 1 when one is over its limit.
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const assets = fileURLToPath(new URL("../../src/ai_ledger/web/assets/", import.meta.url));

// Limits in kB (1 kB = 1000 bytes) of gzip -9.
const LIMITS = {
  index: 120, // catches a static import of ECharts into the entry
  CostPage: 20,
  echarts: 195, // the lazy ECharts chunk
};
// How many `echarts-*.js` chunks the build must hold. No page loads ECharts yet; step 3.2 sets this to 1.
const ECHARTS_CHUNKS = 0;

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

for (const name of ["index", "CostPage"]) {
  const found = chunks(name);
  if (found.length !== 1) failures.push(`expected exactly one ${name}-*.js chunk, found ${found.length}`);
  for (const file of found) report(file, LIMITS[name]);
}

const echarts = chunks("echarts");
if (echarts.length !== ECHARTS_CHUNKS) failures.push(`expected ${ECHARTS_CHUNKS} echarts-*.js chunk(s), found ${echarts.length}`);
for (const file of echarts) report(file, LIMITS.echarts);
if (!echarts.length) console.log(`ok   no echarts-*.js chunk (expected ${ECHARTS_CHUNKS})`);

if (failures.length) {
  for (const f of failures) console.error(`bundle budget: ${f}`);
  process.exit(1);
}
