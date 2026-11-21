// Vitest setup: jsdom lacks the dialog methods, matchMedia and ResizeObserver the components use.
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { fakeECharts } from "./components/echart/testing";
import { useFakeSource } from "./pages/live/testing";
import { closeRouters } from "./testing";

// Charts draw on the fake ECharts runtime, which records what they ask of it; a test of real drawing unmocks the module.
vi.mock("./components/echart/load", async () => (await import("./components/echart/testing")).fakeLoad);
// jsdom has no canvas and logs "not implemented" when asked for one. ECharts' SVG renderer asks only to measure text, and
// with no context it estimates the widths itself.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
window.matchMedia ??= (q: string) => ({
  matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false,
});
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
// A browser stamps animation frames on the performance.now() clock; jsdom counts from when it built the window, which is
// later. A count-up timed from performance.now() (useCountUp) then starts late by however long the worker took to get
// there, up to a second on a busy CI runner, and a test waiting for its final figure times out.
const raf = window.requestAnimationFrame.bind(window);
window.requestAnimationFrame = cb => raf(() => cb(performance.now()));
useFakeSource(); // jsdom has no EventSource; Live tests drive FakeSource.last

afterEach(() => {
  cleanup();
  closeRouters();
  fakeECharts.reset();
  history.replaceState(null, "", "/");
  try { localStorage.clear(); } catch { /* storage off */ }
});
window.scrollTo = () => {}; // jsdom logs "not implemented"
