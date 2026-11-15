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
