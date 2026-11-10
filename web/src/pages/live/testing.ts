// Tests only: a notice stream the test drives instead of the app's /api/live/events.
import { act } from "@testing-library/react";
import { setNoticeSource, type NoticeSource } from "./useLive";

export class FakeSource implements NoticeSource {
  static last: FakeSource | undefined;
  onopen: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  closed = false;
  private changed: ((ev: MessageEvent<string>) => void)[] = [];
  constructor(public url: string) { FakeSource.last = this; }
  addEventListener(_type: "changed", f: (ev: MessageEvent<string>) => void) { this.changed.push(f); }
  close() { this.closed = true; }
  /** The app's changed notice; null sessions: refetch everything. */
  notify(sessions: string[] | null) {
    act(() => { for (const f of this.changed) f(new MessageEvent("changed", { data: JSON.stringify({ sessions }) })); });
  }
  open() { act(() => this.onopen?.(new Event("open"))); }
  drop() { act(() => this.onerror?.(new Event("error"))); }
}

export function useFakeSource() {
  setNoticeSource(url => new FakeSource(url));
}
