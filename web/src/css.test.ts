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

// The raw values in use before the scales in theme.css existed. Values may be removed as the roll-out to the tokens proceeds,
// never added: new CSS takes a --fs-*, --radius-* or --space-* token. A value no stylesheet uses any more must leave its list.
const FONT_SIZES = [
  ".45em", ".5625rem", ".625rem", ".62em", ".65625rem", ".6875rem", ".71875rem", ".75rem", ".78125rem", ".8125rem", ".84375rem",
  ".875rem", ".8em", ".90625rem", ".9375rem", "1.0625rem", "1.125rem", "1.1875rem", "1.25rem", "1.3125rem", "1.375rem", "1.5rem",
  "1.75rem", "1.875rem", "1rem", "2.125rem", "clamp(1.5rem, 2.6vw, 2.25rem)", "clamp(1.5rem, 3.6vw, 2.375rem)",
  "clamp(1.5rem, 4vw, 2.5rem)", "clamp(1.625rem, 4.2vw, 2.375rem)", "clamp(1.625rem, 4.2vw, 2.625rem)",
];
const RADII = ["10px", "12px", "14px", "1px", "2px", "3px", "4px", "50%", "5px", "6px", "7px", "8px", "999px", "9px"];
const SPACING = [
  "-.1875rem", "-12px", "-16px", "-1px", "-20px", "-4px", "-6px", "-8px", ".05em", ".18em", ".3em", ".75rem", "1.5px", "10px", "11px",
  "12px", "12vh", "14px", "16px", "18px", "1px", "20px", "22px", "24px", "26px", "28px", "2px", "32px", "3px", "40px", "4px", "5px",
  "6px", "72px", "7px", "8px", "9px", "calc(var(--vpad) * -1)", "var(--vpad)",
];
/** Raw colors outside theme.css, as "file: value". The same rule: entries may be removed, never added. */
const RAW_COLORS = ["pages/context/CacheChart.css: #000"];
/** Page-list gates (`:is(.pg-a, .pg-b, …)`) per file today. A file may lose gates, never gain one: a rule several pages
    share belongs on the component's own class. */
const PAGE_GATES: Record<string, number> = {
  "components/chart.css": 14, "components/facets.css": 3, "components/sheets/sheets.css": 21, "components/tone.css": 11,
  "pages/activity/activity.css": 4, "theme.css": 7,
};

/** Every declaration in a rule body, with its file. */
const decls = files.flatMap(({ name, css }) => [...css.matchAll(/\{([^{}]*)\}/g)].flatMap(([, body = ""]) => body.split(";").flatMap((d) => {
  const i = d.indexOf(":");
  return i < 0 ? [] : [{ name, prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() }];
})));
const themeRoot = /(?:^|\n):root \{([^}]*)\}/.exec(files.find((f) => f.name === "theme.css")?.css ?? "")?.[1] ?? "";
/** One scale's tokens in theme.css, smallest first: [name, value]. */
const scale = (prefix: string) => [...themeRoot.matchAll(new RegExp(`(--${prefix}-[\\w-]+)\\s*:\\s*([^;]+);`, "g"))].map(([, n = "", v = ""]) => [n, v.trim()] as const);
const hint = (prefix: string, value: string) => {
  const same = scale(prefix).find(([, v]) => v === value);
  return same ? `use var(${same[0]})` : `use a token from theme.css: ${scale(prefix).map(([n, v]) => `${n} (${v})`).join(", ")}`;
};
const isToken = (prefix: string, value: string) => scale(prefix).some(([n]) => value === `var(${n})`);
/** Splits on top-level whitespace (or the separator given), so calc(), clamp() and var() stay whole. */
const splitTop = (s: string, sep = /\s/) => {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++; else if (ch === ")") depth--;
    if (!depth && sep.test(ch)) { if (cur.trim()) out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  return cur.trim() ? [...out, cur.trim()] : out;
};
/** Keywords, not scale steps. */
const KEYWORDS = new Set(["0", "auto", "inherit"]);
const SCALED = [
  { what: "font size", prefix: "fs", list: "FONT_SIZES", allowed: FONT_SIZES,
    // A font shorthand's size counts too: ".75rem/1.4 var(--font-mono)".
    values: (prop: string, value: string) => prop === "font-size" ? splitTop(value) : prop === "font" ? splitTop(value).filter((w) => /^[\d.]/.test(w)).map((w) => w.split("/")[0]!) : [] },
  { what: "radius", prefix: "radius", list: "RADII", allowed: RADII,
    values: (prop: string, value: string) => /^border(-(top|bottom|start|end)-(left|right|start|end))?-radius$/.test(prop) ? splitTop(value) : [] },
  { what: "spacing", prefix: "space", list: "SPACING", allowed: SPACING,
    values: (prop: string, value: string) => /^(padding|margin)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$|^(row-|column-)?gap$/.test(prop) ? splitTop(value) : [] },
];
/** The number of :is() lists that name two page classes or more as items of their own (".pg-cost", not ".pg-cost .tip"). */
const pageGates = (css: string) => [...css.matchAll(/:is\(/g)].filter((m) => {
  let depth = 1, i = m.index + m[0].length;
  const from = i;
  for (; depth && i < css.length; i++) depth += css[i] === "(" ? 1 : css[i] === ")" ? -1 : 0;
  return splitTop(css.slice(from, i - 1), /,/).filter((s) => /^\.pg-[\w-]+$/.test(s)).length >= 2;
}).length;

describe("stylesheets stay on the theme's tokens and scales", () => {
  it("write colors only in theme.css", () => {
    const bad: string[] = [];
    for (const { name, prop, value } of decls) {
      if (name === "theme.css") continue;
      for (const m of value.matchAll(/#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/gi))
        if (!RAW_COLORS.includes(`${name}: ${m[0]}`))
          bad.push(`${name}: ${prop}: ${value}: add the color to theme.css as a light-dark(light, dark) token and use var(--…) here`);
    }
    expect(bad).toEqual([]);
  });

  it("stack with the --z-* tokens", () => {
    expect(decls.filter((d) => d.prop === "z-index" && !isToken("z", d.value))
      .map(({ name, value }) => `${name}: z-index: ${value}: ${hint("z", value)}`)).toEqual([]);
  });

  it("write the monospace stack and the grow-in curve once, as tokens", () => {
    const bad: string[] = [];
    for (const { name, prop, value } of decls) {
      if (name === "theme.css" && (prop === "--font-mono" || prop === "--ease-out")) continue;
      if (/monospace|Menlo|SF Mono/.test(value)) bad.push(`${name}: ${prop}: ${value}: use var(--font-mono) for the family`);
      for (const [curve] of value.matchAll(/cubic-bezier\([^)]*\)/g)) {
        const same = curve.replace(/\s/g, "") === scale("ease")[0]?.[1].replace(/\s/g, "");
        bad.push(`${name}: ${prop}: ${value}: ${same ? "use var(--ease-out)" : "add a named --ease-* token to theme.css"}`);
      }
    }
    expect(bad).toEqual([]);
  });

  for (const { what, prefix, list, allowed, values } of SCALED)
    it(`take each ${what} from the --${prefix}-* scale or ${list}`, () => {
      const bad: string[] = [];
      for (const { name, prop, value } of decls)
        for (const v of values(prop, value))
          if (!KEYWORDS.has(v) && !isToken(prefix, v) && !allowed.includes(v)) bad.push(`${name}: ${prop}: ${value}: ${v}: ${hint(prefix, v)}`);
      expect(bad).toEqual([]);
    });

  it("keep the allow-lists sorted, unique and in use", () => {
    for (const { list, allowed, values } of SCALED) {
      expect({ [list]: allowed }).toEqual({ [list]: [...new Set(allowed)].sort() });
      const used = new Set(decls.flatMap(({ prop, value }) => values(prop, value)));
      expect(allowed.filter((v) => !used.has(v)).map((v) => `remove ${v} from ${list}: no stylesheet uses it`)).toEqual([]);
    }
    expect({ RAW_COLORS }).toEqual({ RAW_COLORS: [...new Set(RAW_COLORS)].sort() });
    const colors = new Set(decls.flatMap(({ name, value }) => [...value.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => `${name}: ${m[0]}`)));
    expect(RAW_COLORS.filter((c) => !colors.has(c)).map((c) => `remove ${c} from RAW_COLORS: no stylesheet uses it`)).toEqual([]);
  });

  it("add no page-list gate", () => {
    expect(files.filter(({ name, css }) => pageGates(css) > (PAGE_GATES[name] ?? 0))
      .map(({ name, css }) => `${name}: ${pageGates(css)} :is(.pg-…, .pg-…) gates, ${PAGE_GATES[name] ?? 0} allowed: style the component's own class instead`)).toEqual([]);
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
