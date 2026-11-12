// Tests only: a notice stream the test drives instead of the app's /api/live/events.
import { act } from "@testing-library/react";
import { setNoticeSource, type NoticeSource } from "./useLive";

export class FakeSource implements NoticeSource {
  static last: FakeSource | undefined;
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  closed = false;
  readyState = 0; // EventSource's: 0 connecting, 1 open, 2 closed
  private changed: ((ev: MessageEvent<string>) => void)[] = [];
  constructor(public url: string) { FakeSource.last = this; }
  addEventListener(_type: "changed", f: (ev: MessageEvent<string>) => void) { this.changed.push(f); }
  close() { this.closed = true; this.readyState = 2; }
  /** The app's changed notice; null sessions: refetch everything. */
  notify(sessions: string[] | null) {
    act(() => { for (const f of this.changed) f(new MessageEvent("changed", { data: JSON.stringify({ sessions }) })); });
  }
  open() { this.readyState = 1; act(() => this.onopen?.(new Event("open"))); }
  /** A network drop: the browser reconnects by itself. */
  drop() { this.readyState = 0; act(() => this.onerror?.(new Event("error"))); }
  /** An HTTP error answer: the browser closes the stream for good. */
  fail() { this.readyState = 2; act(() => this.onerror?.(new Event("error"))); }
}

export function useFakeSource() {
  setNoticeSource(url => new FakeSource(url));
}
