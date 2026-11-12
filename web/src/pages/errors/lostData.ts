// Test data for time lost: the errors fixture's categories with hand-made incidents. Used only by tests.
import fixture from "../../__fixtures__/errors";
import type { ErrorRow, ErrorsPayload, Incident } from "../../api";

const at = (hms: string, day = "2026-11-04") => `${day}T${hms}.000Z`;
const inc = (c: string, first: string, last: string): Incident =>
  ({ s: "s1", t: "Bash", c, p: "foo", sub: 0, first, last, ok: 0, outcome: "gave_up", rid: null, ri: "", rts: null });
/** One failure of incident n, starting at ts. */
const err = (id: string, c: string, n: number, ts: string): ErrorRow =>
  ({ id, ts, d: ts.slice(0, 10), p: "foo", s: "s1", t: "Bash", c, i: "", e: "", r: "", sub: 0, src: "claude", n });

/** worktree: 4 errors, one 60 s incident. git: 3 errors, two incidents of 10 min each (one across midnight). sleep_poll: 1 error,
 *  no span. tests: 1 error, one 60 s incident, as long as worktree's; listed first, so only the count tie-break puts worktree above it. */
export const lostPayload: ErrorsPayload = {
  ...fixture,
  incidents: [
    inc("worktree", at("10:00:00"), at("10:01:00")),
    inc("git", at("11:00:00"), at("11:10:00")),
    inc("git", at("23:55:00", "2026-10-29"), at("00:05:00", "2026-10-30")),
    inc("sleep_poll", at("12:00:00"), at("12:00:00")),
    inc("tests", at("13:00:00"), at("13:01:00")),
  ],
  errors: [
    err("t1", "tests", 4, at("13:00:00")), err("w1", "worktree", 0, at("10:00:00")), err("w2", "worktree", 0, at("10:00:30")), err("w3", "worktree", 0, at("10:00:50")), err("w4", "worktree", 0, at("10:00:55")),
    err("g1", "git", 1, at("11:00:00")), err("g2", "git", 2, at("23:55:00", "2026-10-29")), err("g3", "git", 2, at("00:04:00", "2026-10-30")),
    err("s1", "sleep_poll", 3, at("12:00:00")),
  ],
  calls: [["2026-10-29", "foo", 10, 0, "claude"], ["2026-11-04", "foo", 10, 0, "claude"], ["2026-11-05", "foo", 10, 0, "claude"]],
  error_days: [],
};
