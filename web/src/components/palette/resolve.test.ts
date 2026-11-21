import { describe, expect, it } from "vitest";
import { parseSearch } from "../../url";
import { prefill, resolve } from "./resolve";
import { JUDGMENTS_PAGE, type Chip } from "./suggest";

const at = (href: string) => { const [path, search = ""] = href.split("?"); return { path: path!, search: parseSearch(search) }; };
const c = {
  errors: { kind: "page", value: "/errors", label: "Errors" },
  cost: { kind: "page", value: "/cost", label: "Cost" },
  project: { kind: "page", value: "/project", label: "Project" },
  limits: { kind: "page", value: "/limits", label: "Limits" },
  activity: { kind: "page", value: "/usage", label: "Activity" },
  judgments: { kind: "page", value: JUDGMENTS_PAGE, label: "Judgments" },
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
  docs: { kind: "command", value: "docs", label: "Docs: this page" },
  windows: { kind: "command", value: "docs:concepts/windows", label: "Docs: Context windows and plan limit windows" },
} satisfies Record<string, Chip>;
/** The chips the palette opens with on here, then the picked ones. */
const commit = (here: string, ...picked: Chip[]) => { const h = at(here); return resolve([...prefill(h.search), ...picked], h); };

describe("prefill", () => {
  it("makes a chip per shared filter the hash sets", () => {
    expect(prefill(parseSearch("?project=myproject&source=codex&session=s1")).map(x => x.label)).toEqual(["myproject", "Codex"]);
    expect(prefill(parseSearch("?range=7&auto=1")).map(x => [x.kind, x.value])).toEqual([["range", "7"], ["automated", "1"]]);
    expect(prefill(parseSearch("")).length).toBe(0);
    expect(prefill(parseSearch("?range=12")).length).toBe(0); // an unknown range reads as the default; no chip
  });
});

describe("resolve", () => {
  it("drops the Activity day with a project, range or source chip, and keeps it otherwise", () => {
    const here = "/usage?range=30&day=2026-10-20";
    expect(commit(here, c.d7).href).toBe("/usage?range=7");
    expect(commit(here, c.my).href).toBe("/usage?project=myproject&range=30");
    expect(commit(here, c.codex).href).toBe("/usage?range=30&source=codex");
    expect(commit(here, c.auto).href).toBe("/usage?range=30&auto=1&day=2026-10-20");
    expect(commit(here, c.bash).href).toBe("/usage?range=30&day=2026-10-20&tool=Bash");
  });
  it(">project #myproject opens the project's page with the other filters", () => {
    const r = commit("/cost?range=7", c.project, c.my);
    expect(r.href).toBe("/project?project=myproject&range=7");
    expect(r.footer).toBe("Enter: open Project · myproject · 7d");
  });
  it(">project opens the page of the view's project, and keeps a sheet it hosts", () => {
    expect(commit("/usage?project=myproject&range=30&inspect=foo", c.project).href).toBe("/project?project=myproject&range=30");
    expect(commit("/usage?project=myproject&range=30", c.project, c.bash).href).toBe("/project?project=myproject&range=30&tool=Bash");
    expect(commit("/project?project=myproject&range=30", c.bash).href).toBe("/project?project=myproject&range=30&tool=Bash");
  });
  it("lets the later page win over >project, and a page-bound sheet imply its page", () => {
    const r = commit("/usage?project=myproject&range=30", c.project, c.cost);
    expect(r.href).toBe("/cost?project=myproject&range=30");
    expect(r.status.at(-2)).toEqual({ state: "replaced", by: "Cost" });
    expect(commit("/usage?project=myproject&range=30", c.project, c.timeout).href).toBe("/errors?project=myproject&range=30&cat=timeout");
    expect(commit("/usage?project=myproject&range=30", c.timeout, c.project).status.at(-2)).toEqual({ state: "dropped" });
  });
  it(">errors #myproject opens /errors?project=myproject, in either order", () => {
    const a = commit("/usage", c.errors, c.my), b = commit("/usage", c.my, c.errors);
    expect(a.href).toBe("/errors?project=myproject");
    expect(b.href).toBe(a.href);
    expect(a.footer).toBe("Enter: open Errors · myproject · 30d");
  });
  it("#myproject >bash on Cost opens the inspector over Cost", () => {
    const r = commit("/cost?range=30&session=s1", c.my, c.bash);
    expect(r.href).toBe("/cost?project=myproject&range=30&tool=Bash");
    expect(r.footer).toBe("Enter: open Bash inspector · myproject · 30d");
  });
  it("names the filters in the footer", () => {
    expect(commit("/usage?range=30", c.my, c.claude, c.bash).footer).toBe("Enter: open Bash inspector · myproject · Claude Code · 30d");
  });
  it("opens a sheet over the Judgments view and Live, on Live under sheet with the followed session kept", () => {
    const s1: Chip = { kind: "session", value: "abc", label: "#abc" };
    const judged = commit("/usage?range=7&view=judgments&outcome=not_achieved", s1);
    expect(judged.href).toBe("/usage?range=7&view=judgments&outcome=not_achieved&session=abc");
    expect(judged.footer).toBe("Enter: open session #abc · 7d");
    const live = commit("/live?session=s1", s1);
    expect(live.href).toBe("/live?session=s1&sheet=abc");
    expect(live.footer).toBe("Enter: open session #abc · 30d");
    expect(commit("/live?session=s1&sheet=x", c.bash).href).toBe("/live?tool=Bash&session=s1");
  });
  it("keeps Live's followed session when one commit changes the project and opens a session sheet", () => {
    const s1: Chip = { kind: "session", value: "abc", label: "#abc" };
    expect(commit("/live?project=foo&session=s1", c.my, s1).href).toBe("/live?project=myproject&session=s1&sheet=abc");
    // A new project alone still starts the stream over: the followed session was the old project's.
    expect(commit("/live?project=foo&session=s1&sheet=x", c.my).href).toBe("/live?project=myproject");
  });
  it("lets the later range and project win", () => {
    const r = commit("/usage", c.d7, c.d90, c.alpha, c.beta);
    expect(r.href).toBe("/usage?project=beta&range=90");
    expect(r.status.map(s => s.state)).toEqual(["replaced", "applied", "replaced", "applied"]);
  });
  it("keeps one sheet: the later inspector", () => {
    const r = commit("/usage", c.bash, c.read);
    expect(r.href).toBe("/usage?tool=Read");
    expect(r.status[0]).toEqual({ state: "replaced", by: "Read" });
  });
  it(">timeout from Activity opens Errors on the category, and says so", () => {
    const r = commit("/usage?range=7&ex=t1", c.timeout);
    expect(r.href).toBe("/errors?range=7&cat=timeout");
    expect(r.footer).toBe("Enter: open Errors on Command timed out · 7d");
  });
  it(">timeout on Errors drops the previous type's tool filter and the selected chart bucket, and keeps the rest", () => {
    expect(commit("/errors?range=30&gran=week&at=2026-11-02&cat=x&etool=Edit", c.timeout).href).toBe("/errors?range=30&gran=week&cat=timeout");
  });
  it(">timeout >cost drops the category", () => {
    const r = commit("/usage", c.timeout, c.cost);
    expect(r.href).toBe("/cost");
    expect(r.status[0]).toEqual({ state: "dropped" });
    expect(r.footer).toBe("Enter: open Cost · 30d · Command timed out not applied on Cost");
  });
  it(">bash stays on Errors, and on Limits: every page hosts the sheets", () => {
    expect(commit("/errors?range=30&cat=x", c.bash).href).toBe("/errors?range=30&tool=Bash&cat=x");
    const r = commit("/limits?range=7", c.bash);
    expect(r.href).toBe("/limits?range=7&tool=Bash");
    expect(r.footer).toBe("Enter: open Bash inspector · 7d");
    const s = commit("/limits?range=7&source=codex", { kind: "session", value: "abc", label: "#abc" });
    expect(s.href).toBe("/limits?range=7&source=codex&session=abc");
    expect(s.status.every(x => x.state === "applied")).toBe(true);
    expect(commit("/usage", c.limits, c.bash).href).toBe("/limits?tool=Bash"); // a page chip for Limits drops no sheet
  });
  it(">judgments opens Activity's Judgments view with the filters, and leaves Overview's own keys behind", () => {
    const r = commit("/usage?project=myproject&range=7&q=fix&day=2026-10-20", c.judgments);
    expect(r.href).toBe("/usage?project=myproject&range=7&view=judgments");
    expect(r.path).toBe("/usage");
    expect(r.footer).toBe("Enter: open Judgments · myproject · 7d");
    expect(commit("/cost?range=14&source=claude", c.judgments).href).toBe("/usage?range=14&source=claude&view=judgments");
  });
  it(">activity from the Judgments view opens Overview, and leaves the judgment filters behind", () => {
    const r = commit("/usage?range=7&view=judgments&outcome=not_achieved&frf=tooling", c.activity);
    expect(r.href).toBe("/usage?range=7");
    expect(r.footer).toBe("Enter: open Activity · 7d");
  });
  it("stays on the Judgments view for a filter or a sheet, keeping its own keys", () => {
    const here = "/usage?range=30&view=judgments&outcome=not_achieved";
    expect(commit(here, c.my).href).toBe("/usage?project=myproject&range=30&view=judgments&outcome=not_achieved");
    expect(commit(here, c.my).footer).toBe("Enter: update Judgments · myproject · 30d");
    expect(commit(here, c.judgments).changed).toBe(false);
    expect(commit(here, c.bash).href).toBe("/usage?range=30&view=judgments&outcome=not_achieved&tool=Bash");
  });
  it("says Overview opens when >judgments is asked of Codex alone", () => {
    const r = commit("/usage?range=30", c.codex, c.judgments);
    expect(r.href).toBe("/usage?range=30&source=codex&view=judgments");
    expect(r.footer).toBe("Enter: open Judgments · Codex · 30d · Codex has no judgments: Overview opens");
  });
  it("clears session and inspect on a project change, and keeps tool", () => {
    expect(commit("/usage?range=30&inspect=foo&tool=Bash&session=s1", c.my).href).toBe("/usage?project=myproject&range=30&tool=Bash");
  });
  it(">errors from an empty hash writes range, so the saved Errors view is not used", () => {
    expect(commit("/usage", c.errors).href).toBe("/errors?range=30");
  });
  it("keeps Errors' sub, noise, gran and cat when staying on Errors", () => {
    expect(commit("/errors?range=30&sub=0&noise=0&gran=week&cat=x", c.my).href).toBe("/errors?project=myproject&range=30&sub=0&noise=0&gran=week&cat=x");
  });
  it("clears the key of a removed pre-filled chip", () => {
    const h = at("/usage?project=myproject&source=codex&range=30");
    const r = resolve(prefill(h.search).filter(x => x.kind !== "source"), h);
    expect(r.href).toBe("/usage?project=myproject&range=30");
    expect(r.footer).toBe("Enter: update Activity · myproject · 30d");
  });
  it("changes nothing when the chips are unchanged", () => {
    const r = commit("/usage?project=myproject&range=30&tool=Bash");
    expect([r.moved, r.changed, r.footer]).toEqual([false, false, "Enter: close, nothing changed"]);
  });
  it("notes that Errors always includes automated sessions", () => {
    const r = commit("/errors?range=30", c.auto);
    expect(r.href).toBe("/errors?range=30&auto=1");
    expect(r.footer).toBe("Enter: update Errors · 30d · Errors always includes automated sessions");
    expect(commit("/usage?range=0", c.auto).footer).toBe("Enter: update Activity · all time · automated sessions");
  });
  it("runs a command without taking the page", () => {
    const r = commit("/usage", c.my, c.errors, c.copy);
    expect([r.href, r.command, r.changed]).toEqual(["/errors?project=myproject", "copy", true]);
    expect(r.footer).toBe("Enter: open Errors, then copy its link · myproject · 30d");
    const f = commit("/usage", c.refresh);
    expect([f.moved, f.changed, f.footer]).toEqual([false, true, "Enter: refresh data"]);
  });
  it("opens this page's docs without moving the view", () => {
    const r = commit("/cost?range=30", c.docs);
    expect([r.href, r.moved, r.changed, r.command, r.docs]).toEqual(["/cost?range=30", false, true, "docs", "https://nwidart.github.io/ai-ledger/pages/cost/"]);
    expect(r.footer).toBe("Enter: open the Cost docs in a new tab");
    expect(commit("/errors?range=30", c.docs).footer).toBe("Enter: open the Errors docs in a new tab");
    expect(commit("/usage?range=30&view=judgments", c.docs).docs).toBe("https://nwidart.github.io/ai-ledger/pages/insights/");
    expect(commit("/project?project=myproject", c.docs).docs).toBe("https://nwidart.github.io/ai-ledger/pages/project/");
    expect(commit("/usage", c.docs).docs).toBe("https://nwidart.github.io/ai-ledger/pages/activity/");
  });
  it("opens a docs page by key, and names the docs home", () => {
    const r = commit("/usage", c.windows);
    expect([r.docs, r.footer]).toEqual(["https://nwidart.github.io/ai-ledger/concepts/windows/",
      "Enter: open the Context windows and plan limit windows docs in a new tab"]);
    expect(commit("/usage", { kind: "command", value: "docs:home", label: "Docs: home" }).footer).toBe("Enter: open the docs home in a new tab");
    expect(commit("/usage", c.refresh).docs).toBeNull();
  });
  it("takes the command slot for a docs command, and applies the other chips", () => {
    const r = commit("/errors?range=30", c.my, c.docs);
    expect([r.href, r.command, r.docs]).toEqual(["/errors?project=myproject&range=30", "docs", "https://nwidart.github.io/ai-ledger/pages/errors/"]);
    expect(r.footer).toBe("Enter: update Errors, then open the Errors docs in a new tab · myproject · 30d");
    const later = commit("/usage", c.copy, c.docs);
    expect([later.command, later.status[0]]).toEqual(["docs", { state: "replaced", by: "Docs: this page" }]);
    const earlier = commit("/usage", c.docs, c.refresh);
    expect([earlier.command, earlier.docs, earlier.status[0]]).toEqual(["refresh", null, { state: "replaced", by: "Refresh" }]);
    // This page is the page the commit shows.
    const moved = commit("/usage", c.cost, c.docs);
    expect([moved.href, moved.docs, moved.footer]).toEqual(["/cost", "https://nwidart.github.io/ai-ledger/pages/cost/",
      "Enter: open Cost, then open the Cost docs in a new tab · 30d"]);
  });
  it("describes the view the filters choose", () => {
    expect(commit("/errors?range=30", c.my, c.codex, c.auto).view).toEqual({ project: "myproject", range: 30, automated: true, source: "codex" });
  });
});
