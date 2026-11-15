import { describe, expect, it } from "vitest";
import context from "../../__fixtures__/context";
import { bytes, causesText, codeParts, rebuildFacts, windowLabel, FILL_LABELS, TIP_KICKERS } from "./context";

describe("context figures", () => {
  it("writes sizes in decimal units with one decimal under ten", () => {
    expect(bytes(0)).toBe("0 B");
    expect(bytes(812)).toBe("812 B");
    expect(bytes(1003)).toBe("1.0 KB");
    expect(bytes(250_000)).toBe("250 KB");
    expect(bytes(1_400_000)).toBe("1.4 MB");
    expect(bytes(5_000_000)).toBe("5.0 MB");
    expect(bytes(900_000_000)).toBe("900 MB");
    expect(bytes(2_500_000_000)).toBe("2.5 GB");
    expect(bytes(null)).toBe("–");
  });

  it("labels a window without a trailing .0", () => {
    expect(windowLabel(200_000)).toBe("200k");
    expect(windowLabel(258_400)).toBe("258.4k");
    expect(windowLabel(1_000_000)).toBe("1M");
    expect(windowLabel(2_000_000)).toBe("2M");
  });

  it("names the five fill bins", () => {
    expect(FILL_LABELS).toEqual(["<25%", "25–50%", "50–80%", "80–90%", "≥90%"]);
  });

  it("splits advice at its backticks", () => {
    expect(codeParts("Use `Read` with `offset`.")).toEqual([
      { code: false, text: "Use " }, { code: true, text: "Read" }, { code: false, text: " with " }, { code: true, text: "offset" }, { code: false, text: "." }]);
    expect(codeParts("plain")).toEqual([{ code: false, text: "plain" }]);
  });

  it("lists the causes of a session's breaks, leaving out the ones with none", () => {
    expect(causesText({ model_switch: 2, expired: 1, other: 0 })).toBe("2 model switches, 1 expired");
    expect(causesText({ model_switch: 1, expired: 0, other: 3 })).toBe("1 model switch, 3 other");
    expect(causesText({ model_switch: 0, expired: 0, other: 0 })).toBe("–");
  });

  it("asks for a rebuild only when the payload does", () => {
    expect(rebuildFacts(context.coverage)).toBeNull();
    expect(rebuildFacts({ ...context.coverage, rebuild_needed: true, calls: 4000, with_bytes: 1000 })).toEqual({ calls: 4000, withBytes: 1000, compacted: 2, withFirst: 2 });
  });

  it("has a kicker for every tip the fixture holds", () => {
    for (const t of context.tips) expect(TIP_KICKERS[t.id]).toBeTruthy();
  });
});
