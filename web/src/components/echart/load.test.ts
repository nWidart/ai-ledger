import { beforeEach, describe, expect, it, vi } from "vitest";

// test-setup mocks this module with the fake runtime for every other test; here the real one runs, over a stand-in for
// the ECharts chunk that counts its loads and fails as many of them as a test asks.
vi.unmock("./load");
const chunk = { loads: 0, failures: 0 };

// Each test gets a load.ts with no promise kept yet, and an ECharts chunk not yet loaded.
const fresh = async () => {
  vi.resetModules();
  vi.doMock("./echarts", () => {
    chunk.loads++;
    if (chunk.failures > 0) { chunk.failures--; throw new Error("chunk failed to load"); }
    return { init: () => { throw new Error("no chart in this test"); } };
  });
  return import("./load");
};
beforeEach(() => { chunk.loads = 0; chunk.failures = 0; });

describe("loadECharts", () => {
  it("gives one promise for every call, and loads the chunk once", async () => {
    const { loadECharts } = await fresh();
    const first = loadECharts();
    expect(loadECharts()).toBe(first);
    const runtime = await first;
    expect(typeof runtime.init).toBe("function");
    expect(loadECharts()).toBe(first);
    expect(chunk.loads).toBe(1);
  });

  it("rejects when the chunk fails, and the next call loads it again", async () => {
    const { loadECharts } = await fresh();
    chunk.failures = 1;
    const failed = loadECharts();
    await expect(failed).rejects.toThrow("error when mocking a module"); // vitest's words around the factory's error
    const retried = loadECharts();
    expect(retried).not.toBe(failed);
    await expect(retried).resolves.toHaveProperty("init");
    expect(chunk.loads).toBe(2);
  });
});

describe("preloadECharts", () => {
  it("starts the load that a later loadECharts call shares", async () => {
    const { loadECharts, preloadECharts } = await fresh();
    preloadECharts();
    await loadECharts();
    expect(chunk.loads).toBe(1);
  });

  it("swallows a failure, so the page logs no unhandled rejection, and the chart's own call tries again", async () => {
    const { loadECharts, preloadECharts } = await fresh();
    chunk.failures = 1;
    preloadECharts();
    await vi.waitFor(() => expect(chunk.loads).toBe(1));
    await new Promise(settled => setTimeout(settled)); // the failed load lets go of its promise
    await expect(loadECharts()).resolves.toHaveProperty("init");
    expect(chunk.loads).toBe(2);
  });
});
