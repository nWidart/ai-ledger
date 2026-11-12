import { describe, expect, it } from "vitest";
import { parseHash } from "../../hash";
import { prefill, resolve } from "./resolve";
import type { Chip } from "./suggest";

const at = (href: string) => { const [path, hash = ""] = href.split("#"); return { path: path!, hash: parseHash(hash) }; };
const c = {
  errors: { kind: "page", value: "/errors", label: "Errors" },
  cost: { kind: "page", value: "/cost", label: "Cost" },
  my: { kind: "project", value: "myproject", label: "myproject" },
  alpha: { kind: "project", value: "alpha", label: "alpha" },
  beta: { kind: "project", value: "beta", label: "beta" },
  codex: { kind: "source", value: "codex", label: "Codex" },
  claude: { kind: "source", value: "claude", label: "Claude Code" },
  d7: { kind: "range", value: "7", label: "7d" },
  d90: { kind: "range", value: "90", label: "90d" },
  auto: { kind: "automated", value: "1", label: "automated" },
  bash: { kind: "tool", value: "Bash", label: "Bash" },
  read: { kind: "tool", value: "Read", label: "Read" },
  timeout: { kind: "category", value: "timeout", label: "Command timed out" },
  copy: { kind: "command", value: "copy", label: "Copy link" },
  refresh: { kind: "command", value: "refresh", label: "Refresh" },
} satisfies Record<string, Chip>;
/** The chips the palette opens with on here, then the picked ones. */
const commit = (here: string, ...picked: Chip[]) => { const h = at(here); return resolve([...prefill(h.hash), ...picked], h); };

describe("prefill", () => {
  it("makes a chip per shared filter the hash sets", () => {
    expect(prefill(parseHash("#project=myproject&source=codex&session=s1")).map(x => x.label)).toEqual(["myproject", "Codex"]);
    expect(prefill(parseHash("#range=7&auto=1")).map(x => [x.kind, x.value])).toEqual([["range", "7"], ["automated", "1"]]);
    expect(prefill(parseHash("")).length).toBe(0);
    expect(prefill(parseHash("#range=12")).length).toBe(0); // an unknown range reads as the default; no chip
  });
});

describe("resolve", () => {
  it("drops the Activity day with a project, range or source chip, and keeps it otherwise", () => {
    const here = "/usage#range=30&day=2026-10-20";
    expect(commit(here, c.d7).href).toBe("/usage#range=7");
    expect(commit(here, c.my).href).toBe("/usage#project=myproject&range=30");
    expect(commit(here, c.codex).href).toBe("/usage#range=30&source=codex");
    expect(commit(here, c.auto).href).toBe("/usage#range=30&auto=1&day=2026-10-20");
    expect(commit(here, c.bash).href).toBe("/usage#range=30&day=2026-10-20&tool=Bash");
  });
  it(">errors keeps the filters", () => {
    expect(commit("/usage#project=myproject&range=14", c.errors).href).toBe("/errors#project=myproject&range=14");
  });
  it(">errors #myproject opens /errors#project=myproject, in either order", () => {
    const a = commit("/usage", c.errors, c.my), b = commit("/usage", c.my, c.errors);
    expect(a.href).toBe("/errors#project=myproject");
    expect(b.href).toBe(a.href);
    expect(a.footer).toBe("Enter: open Errors · myproject · 30d");
  });
  it("#myproject >bash on Cost opens the inspector over Cost", () => {
    const r = commit("/cost#range=30&session=s1", c.my, c.bash);
    expect(r.href).toBe("/cost#project=myproject&range=30&tool=Bash");
    expect(r.footer).toBe("Enter: open Bash inspector · myproject · 30d");
  });
  it("names the filters in the footer", () => {
    expect(commit("/usage#range=30", c.my, c.claude, c.bash).footer).toBe("Enter: open Bash inspector · myproject · Claude Code · 30d");
  });
  it("#myproject #codex #7d >cost", () => {
    expect(commit("/usage#range=30", c.my, c.codex, c.d7, c.cost).href).toBe("/cost#project=myproject&range=7&source=codex");
  });
  it(">errors >bash opens Errors with the inspector", () => {
    expect(commit("/usage", c.errors, c.bash).href).toBe("/errors#range=30&tool=Bash");
  });
  it("lets the later of two pages win and marks the earlier replaced", () => {
    const r = commit("/usage", c.errors, c.cost);
    expect(r.path).toBe("/cost");
    expect(r.status).toEqual([{ state: "replaced", by: "Cost" }, { state: "applied" }]);
  });
  it("lets the later range and project win", () => {
    const r = commit("/usage", c.d7, c.d90, c.alpha, c.beta);
    expect(r.href).toBe("/usage#project=beta&range=90");
    expect(r.status.map(s => s.state)).toEqual(["replaced", "applied", "replaced", "applied"]);
  });
  it("keeps one sheet: the later inspector", () => {
    const r = commit("/usage", c.bash, c.read);
    expect(r.href).toBe("/usage#tool=Read");
    expect(r.status[0]).toEqual({ state: "replaced", by: "Read" });
  });
  it(">timeout from Activity opens Errors on the category, and says so", () => {
    const r = commit("/usage#range=7&ex=t1", c.timeout);
    expect(r.href).toBe("/errors#range=7&cat=timeout");
    expect(r.footer).toBe("Enter: open Errors on Command timed out · 7d");
  });
  it(">timeout >cost drops the category", () => {
    const r = commit("/usage", c.timeout, c.cost);
    expect(r.href).toBe("/cost");
    expect(r.status[0]).toEqual({ state: "dropped" });
    expect(r.footer).toBe("Enter: open Cost · 30d · Command timed out not applied on Cost");
  });
  it(">bash stays on Errors and goes from Limits to Activity", () => {
    expect(commit("/errors#range=30&cat=x", c.bash).href).toBe("/errors#range=30&tool=Bash&cat=x");
    const r = commit("/limits#range=7", c.bash);
    expect(r.href).toBe("/usage#range=7&tool=Bash");
    expect(r.footer).toBe("Enter: open Bash inspector on Activity · 7d");
  });
  it("clears session and inspect on a project change, and keeps tool", () => {
    expect(commit("/usage#range=30&inspect=foo&tool=Bash&session=s1", c.my).href).toBe("/usage#project=myproject&range=30&tool=Bash");
  });
  it(">errors from an empty hash writes range, so the saved Errors view is not used", () => {
    expect(commit("/usage", c.errors).href).toBe("/errors#range=30");
  });
  it("keeps Errors' sub, noise, gran and cat when staying on Errors", () => {
    expect(commit("/errors#range=30&sub=0&noise=0&gran=week&cat=x", c.my).href).toBe("/errors#project=myproject&range=30&sub=0&noise=0&gran=week&cat=x");
  });
  it("clears the key of a removed pre-filled chip", () => {
    const h = at("/usage#project=myproject&source=codex&range=30");
    const r = resolve(prefill(h.hash).filter(x => x.kind !== "source"), h);
    expect(r.href).toBe("/usage#project=myproject&range=30");
    expect(r.footer).toBe("Enter: update Activity · myproject · 30d");
  });
  it("changes nothing when the chips are unchanged", () => {
    const r = commit("/usage#project=myproject&range=30&tool=Bash");
    expect([r.moved, r.changed, r.footer]).toEqual([false, false, "Enter: close, nothing changed"]);
  });
  it("notes that Errors always includes automated sessions", () => {
    const r = commit("/errors#range=30", c.auto);
    expect(r.href).toBe("/errors#range=30&auto=1");
    expect(r.footer).toBe("Enter: update Errors · 30d · Errors always includes automated sessions");
    expect(commit("/usage#range=0", c.auto).footer).toBe("Enter: update Activity · all time · automated sessions");
  });
  it("runs a command without taking the page", () => {
    const r = commit("/usage", c.my, c.errors, c.copy);
    expect([r.href, r.command, r.changed]).toEqual(["/errors#project=myproject", "copy", true]);
    expect(r.footer).toBe("Enter: open Errors, then copy its link · myproject · 30d");
    const f = commit("/usage", c.refresh);
    expect([f.moved, f.changed, f.footer]).toEqual([false, true, "Enter: refresh data"]);
  });
  it("describes the view the filters choose", () => {
    expect(commit("/errors#range=30", c.my, c.codex, c.auto).view).toEqual({ project: "myproject", range: 30, automated: true, source: "codex" });
  });
});
