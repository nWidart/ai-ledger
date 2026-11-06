import { describe, expect, it } from "vitest";
import palette from "../../__fixtures__/palette";
import { suggest } from "./suggest";
import { autoChip, termAt, terms } from "./terms";

const data = { palette };
const strip = (input: string) => terms(input).map(t => [t.sigil, t.text]);

describe("terms", () => {
  it("splits at a sigil that starts the text or follows a space", () => {
    expect(strip(">errors #myproject")).toEqual([[">", "errors"], ["#", "myproject"]]);
    expect(strip(">copy link")).toEqual([[">", "copy link"]]);
    expect(strip("a#b")).toEqual([["", "a#b"]]);
    expect(strip("bash")).toEqual([["", "bash"]]);
    expect(strip("myp >bas")).toEqual([["", "myp"], [">", "bas"]]);
    expect(strip("#")).toEqual([["#", ""]]);
    expect(strip("")).toEqual([]);
  });
  it("finds the term under the caret", () => {
    const ts = terms(">errors #my");
    expect(termAt(ts, 3).text).toBe("errors");
    expect(termAt(ts, 11).text).toBe("my");
    expect(termAt([], 0)).toEqual({ sigil: "", text: "", start: 0, end: 0 });
  });
});

describe("autoChip", () => {
  const rowsFor = (d = data) => (t: ReturnType<typeof terms>[number]) => suggest(t, d);
  it("turns a unique exact match into a chip once the next sigil is typed", () => {
    const got = autoChip(">errors #fo", 11, rowsFor());
    expect(got.picked.map(r => [r.kind, r.value])).toEqual([["page", "/errors"]]);
    expect([got.input, got.caret]).toEqual(["#fo", 3]);
    expect(autoChip(">errors", 7, rowsFor()).picked).toEqual([]);
  });
  it("leaves a term with no exact match, or several, as text", () => {
    expect(autoChip(">err #fo", 8, rowsFor()).input).toBe(">err #fo");
    const codex = { palette: { ...palette, projects: [{ name: "codex", sessions: 1 }] } };
    const got = autoChip("#codex >", 8, rowsFor(codex));
    expect([got.picked, got.input]).toEqual([[], "#codex >"]);
    expect(autoChip("#7d #foo >", 10, rowsFor()).picked.map(r => [r.kind, r.value])).toEqual([["range", "7"], ["project", "foo"]]);
  });
});
