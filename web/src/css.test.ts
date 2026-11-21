import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = __dirname;
const cssFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? cssFiles(p) : p.endsWith(".css") ? [p] : [];
  });

const FONT = /(?<![\w-])(font-size|font)\s*:\s*([^;}]*)/g;
const files = cssFiles(SRC).map((f) => ({ name: f.slice(SRC.length + 1), css: readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "") }));

describe("stylesheets respect the browser text size", () => {
  it("find stylesheets", () => expect(files.length).toBeGreaterThan(0));

  it("declare no px font size", () => {
    const bad: string[] = [];
    for (const { name, css } of files)
      for (const m of css.matchAll(FONT)) if (/\d(?:\.\d+)?px\b/.test(m[2] ?? "")) bad.push(`${name}: ${m[1]}: ${m[2]?.trim()}`);
    expect(bad).toEqual([]);
  });

  it("declare no px width in a media query", () => {
    const bad: string[] = [];
    for (const { name, css } of files)
      for (const m of css.matchAll(/@media[^{]*/g)) if (/(?:min|max)-width\s*:\s*[\d.]+px/.test(m[0])) bad.push(`${name}: ${m[0].trim()}`);
    expect(bad).toEqual([]);
  });

  it("set no font size on html or :root", () => {
    const bad: string[] = [];
    for (const { name, css } of files)
      for (const [, sel = "", body = ""] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selectors = sel.split(",").map((s) => s.trim().split(/\s+/).pop() ?? "");
        if (!selectors.some((s) => /^(html|:root)(?![\w-])/.test(s))) continue;
        for (const m of body.matchAll(FONT)) bad.push(`${name}: ${sel.trim()} { ${m[1]}: ${m[2]?.trim()} }`);
      }
    expect(bad).toEqual([]);
  });
});

/** The components' source, tests and fixtures left out: where a class a stylesheet names must still be set. */
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "__fixtures__" ? [] : sourceFiles(p);
    return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
const source = sourceFiles(SRC).map((f) => readFileSync(f, "utf8")).join("\n");
/** The rules inside each `@media (forced-colors: active)` block, with their file. */
const forcedRules = files.flatMap(({ name, css }) => {
  const out: { name: string; sel: string }[] = [];
  for (const m of css.matchAll(/@media\s*\(forced-colors:\s*active\)\s*\{/g)) {
    let depth = 1, i = m.index + m[0].length;
    const from = i;
    for (; depth && i < css.length; i++) depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0;
    for (const [, sel = ""] of css.slice(from, i - 1).matchAll(/([^{}]+)\{/g)) out.push({ name, sel: sel.trim() });
  }
  return out;
});

describe("forced-colors rules", () => {
  it("find forced-colors rules", () => expect(forcedRules.length).toBeGreaterThan(10));

  // A class renamed in a component leaves its forced-colors rule matching nothing. A class built from a prefix ("st-" + kind)
  // counts when the prefix is in the source.
  it("name only classes the components set", () => {
    const set = (cls: string) => new RegExp(`(?<![\\w-])${cls}(?![\\w-])`).test(source)
      || [...cls.matchAll(/-/g)].some((d) => source.includes(`"${cls.slice(0, d.index + 1)}`) || source.includes(`\`${cls.slice(0, d.index + 1)}`));
    const bad = forcedRules.flatMap(({ name, sel }) => [...sel.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((m) => m[1]!)
      .filter((cls) => !set(cls)).map((cls) => `${name}: .${cls} in ${sel}`));
    expect(bad).toEqual([]);
  });

  // An attribute selector on class (rect[class^="seg-"]) breaks when the element gains a class in front; use .seg-input.
  it("match classes by class selector, not by the class attribute", () => {
    expect(forcedRules.filter(({ sel }) => /\[class[\^*$|~]?=/.test(sel)).map(({ name, sel }) => `${name}: ${sel}`)).toEqual([]);
  });

  // The controls whose state a forced-colors mode would otherwise hide. Each must keep a rule of its own: a selector list
  // read with each :is() spelled out, so ":is(.pg-context, .pg-activity) .tablist …" covers both pages.
  it("cover each control that needs a system-color state", () => {
    const splitTop = (s: string) => {
      const out: string[] = [];
      let depth = 0, from = 0;
      [...s].forEach((ch, i) => {
        if (ch === "(") depth++; else if (ch === ")") depth--; else if (ch === "," && !depth) { out.push(s.slice(from, i)); from = i + 1; }
      });
      return [...out, s.slice(from)].map((x) => x.trim()).filter(Boolean);
    };
    const expand = (sel: string): string[] => {
      const i = sel.indexOf(":is(");
      if (i < 0) return [sel.replace(/\s+/g, " ")];
      let depth = 0, j = i + 3;
      for (; j < sel.length; j++) if (sel[j] === "(") depth++; else if (sel[j] === ")" && !--depth) break;
      return splitTop(sel.slice(i + 4, j)).flatMap((p) => expand(sel.slice(0, i) + p + sel.slice(j + 1)));
    };
    const covered = forcedRules.flatMap(({ sel }) => splitTop(sel).flatMap(expand));
    const has = (want: string) => covered.some((s) => s === want || s.startsWith(want + ":"));
    const required = [
      ".pg-live .strip .fig[aria-pressed=true]",
      ".pg-activity .tablist [role=tab][aria-selected=true]",
      ".pg-context .tablist [role=tab][aria-selected=true]",
      '.pg-limits .lim-toggle[aria-pressed="true"]',
      ".pg-context .cache-chart svg .seg",
    ];
    expect(required.filter((r) => !has(r))).toEqual([]);
  });
});
