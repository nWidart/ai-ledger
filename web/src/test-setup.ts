// Vitest setup: jsdom lacks the dialog methods, matchMedia and ResizeObserver the components use.
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { clearApiCache } from "./useApi";
import { useFakeSource } from "./pages/live/testing";

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
useFakeSource(); // jsdom has no EventSource; Live tests drive FakeSource.last

afterEach(() => {
  cleanup();
  clearApiCache();
  history.replaceState(null, "", "/");
  try { localStorage.clear(); } catch { /* storage off */ }
});
window.scrollTo = () => {}; // jsdom logs "not implemented"
