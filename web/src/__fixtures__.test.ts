// The fixtures are TypeScript modules whose payloads `satisfies` the api.ts types, so tsc fails on drift; this checks
// the runtime shape the pages lean on.
import { describe, expect, it } from "vitest";
import errors from "./__fixtures__/errors";
import session from "./__fixtures__/session";
import sessions from "./__fixtures__/sessions";
import usageAll from "./__fixtures__/usage-all";
import usage from "./__fixtures__/usage";
import type { ErrorsPayload, SessionDetail, SessionsPage, UsagePayload } from "./api";

describe("fixtures", () => {
  it("match the payload types", () => {
    const u: UsagePayload = usage, all: UsagePayload = usageAll, s: SessionDetail = session, l: SessionsPage = sessions, e: ErrorsPayload = errors;
    expect(u.daily_work.length).toBeGreaterThan(0);
    expect(u.previous).not.toBeNull();
    expect(all.previous).toBeNull();
    expect(all.session?.info.session_id).toBe("s1");
    expect(s.info.session_id).toBe("s1");
    expect(l.total).toBe(l.sessions.length);
    expect(e.errors.length).toBeGreaterThan(0);
  });
});
