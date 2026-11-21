// Loads the ECharts chunk (echarts.ts) on demand, once (design decision 3). The chart wrapper calls loadECharts() when it
// mounts; a page with a chart calls preloadECharts() at module load, so the chunk is requested with the page's own chunk
// rather than after its first render. Tests get the fake runtime from testing.ts in place of this module (test-setup).

/** What the chunk gives: `init`, with ECharts' types beside it. */
export type Runtime = typeof import("./echarts");

let pending: Promise<Runtime> | undefined;

/** The runtime. Every call shares one promise; after a failed load the promise is dropped, so the next call tries again. */
export function loadECharts(): Promise<Runtime> {
  pending ??= import("./echarts").catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}

/** Starts the load early. A failure is left for the chart's own call to meet, and retry, in place of an unhandled rejection. */
export function preloadECharts(): void {
  loadECharts().catch(() => {});
}
