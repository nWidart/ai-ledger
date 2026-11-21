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

type Sheet = { name: string; css: string };
type Decl = { name: string; prop: string; value: string };
/** Every declaration in a rule body, with its file; `!important` is left off the value. */
const declsOf = (sheets: Sheet[]): Decl[] => sheets.flatMap(({ name, css }) => [...css.matchAll(/\{([^{}]*)\}/g)].flatMap(([, body = ""]) => body.split(";").flatMap((d) => {
  const i = d.indexOf(":");
  return i < 0 ? [] : [{ name, prop: d.slice(0, i).trim(), value: d.slice(i + 1).replace(/!\s*important\s*$/i, "").trim() }];
})));
const decls = declsOf(files);
const themeRoot = /(?:^|\n):root \{([^}]*)\}/.exec(files.find((f) => f.name === "theme.css")?.css ?? "")?.[1] ?? "";
/** One scale's tokens in theme.css, smallest first: [name, value]. */
const scale = (prefix: string) => [...themeRoot.matchAll(new RegExp(`(--${prefix}-[\\w-]+)\\s*:\\s*([^;]+);`, "g"))].map(([, n = "", v = ""]) => [n, v.trim()] as const);
const hint = (prefix: string, value: string) => {
  const same = scale(prefix).find(([, v]) => v === value), neg = scale(prefix).find(([, v]) => `-${v}` === value);
  return same ? `use var(${same[0]})` : neg ? `use calc(var(${neg[0]}) * -1)`
    : `use a token from theme.css: ${scale(prefix).map(([n, v]) => `${n} (${v})`).join(", ")}`;
};
/** A scale token, or a calc() of scale tokens and plain numbers: "calc(var(--space-2) * -1)". */
const fromTokens = (prefix: string, value: string) => {
  const names = new Set(scale(prefix).map(([n]) => n));
  if (names.has(/^var\((--[\w-]+)\)$/.exec(value)?.[1] ?? "")) return true;
  const inner = /^calc\((.*)\)$/.exec(value)?.[1];
  if (inner === undefined) return false;
  let tokens = 0;
  const rest = inner.replace(/var\((--[\w-]+)\)/g, (_, n: string) => names.has(n) ? (tokens++, "") : "?");
  return tokens > 0 && /^[\d.\s*/+\-()]*$/.test(rest);
};
const CSS_WIDE = ["inherit", "initial", "unset", "revert", "revert-layer"];
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
const KEYWORDS = new Set(["0", "auto", ...CSS_WIDE]);
/** What may come before the size in a font shorthand: style, variant, weight and stretch. */
const FONT_LEAD = new Set(["normal", "italic", "oblique", "small-caps", "bold", "bolder", "lighter", "ultra-condensed", "extra-condensed",
  "condensed", "semi-condensed", "semi-expanded", "expanded", "extra-expanded", "ultra-expanded"]);
/** A font shorthand's size: the first word that is not a style keyword or a unitless weight, before any "/line-height".
    A single word (inherit, a system font) names no size. */
const shorthandSize = (value: string) => {
  const words = splitTop(value.replace(/\s*\/\s*/g, "/"));
  if (words.length < 2) return [];
  const size = words.map((w) => splitTop(w, /\//)[0]!).find((w) => !/^[\d.]+$/.test(w) && !FONT_LEAD.has(w));
  return size ? [size] : [];
};
const SCALED = [
  { what: "font size", prefix: "fs", list: "FONT_SIZES", allowed: FONT_SIZES,
    // A font shorthand's size counts too: "600 .75rem/1.4 var(--font-mono)".
    values: (prop: string, value: string) => prop === "font-size" ? splitTop(value) : prop === "font" ? shorthandSize(value) : [] },
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

/** The CSS named colors. transparent, currentColor and the system colors (Canvas, Highlight, …) are not among them. */
const NAMED_COLORS = `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue
  chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki
  darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise
  darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod
  gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue
  lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
  lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple
  mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite
  navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink
  plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
  slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow
  yellowgreen`.split(/\s+/);
const NAMED = new RegExp(`(?<![\\w-])(?:${NAMED_COLORS.join("|")})(?![\\w-])`, "gi");
/** The properties a named color can sit in; elsewhere ("grid-area: tan", an animation name) the word is not a color. */
const COLOR_PROP = /^(--|color$|background|border|outline|box-shadow|text-shadow|text-decoration|fill|stroke|caret-color|accent-color|column-rule|scrollbar-color|stop-color|flood-color|lighting-color)/;
/** Each raw color outside theme.css, as "file: value": a hex, a whole color function, or a named color. Strings are skipped. */
const rawColors = (sheets: Sheet[]) => declsOf(sheets).flatMap(({ name, prop, value }) => {
  if (name === "theme.css") return [];
  const v = value.replace(/"[^"]*"|'[^']*'/g, "");
  const found = [...v.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0]);
  for (const m of v.matchAll(/(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/gi)) {
    let depth = 1, i = m.index + m[0].length;
    for (; depth && i < v.length; i++) depth += v[i] === "(" ? 1 : v[i] === ")" ? -1 : 0;
    found.push(v.slice(m.index, i));
  }
  if (COLOR_PROP.test(prop)) found.push(...[...v.matchAll(NAMED)].map((m) => m[0]));
  return found.map((c) => ({ at: `${name}: ${c}`, name, prop, value }));
});
/** Raw colors past their allowance: each RAW_COLORS entry admits one occurrence. */
const colorGuard = (sheets: Sheet[], allowed = RAW_COLORS) => {
  const left = [...allowed];
  return rawColors(sheets).filter(({ at }) => {
    const i = left.indexOf(at);
    return i < 0 || !left.splice(i, 1);
  }).map(({ name, prop, value }) => `${name}: ${prop}: ${value}: add the color to theme.css as a light-dark(light, dark) token and use var(--…) here`);
};
const zGuard = (sheets: Sheet[]) => declsOf(sheets).filter(({ prop, value }) => prop === "z-index" && !["auto", "0", "-1", ...CSS_WIDE].includes(value) && !fromTokens("z", value))
  .map(({ name, value }) => `${name}: z-index: ${value}: ${hint("z", value)}; auto, 0 and -1 may stay raw`);
const monoEaseGuard = (sheets: Sheet[]) => declsOf(sheets).flatMap(({ name, prop, value }) => {
  // theme.css's tokens define the stack and the curves; a new --ease-* token goes there.
  if (name === "theme.css" && prop.startsWith("--")) return [];
  const bad = /monospace|Menlo|SF Mono/.test(value) ? [`${name}: ${prop}: ${value}: use var(--font-mono) for the family`] : [];
  for (const [curve] of value.matchAll(/cubic-bezier\([^)]*\)/g)) {
    const same = scale("ease").find(([, v]) => v.replace(/\s/g, "") === curve.replace(/\s/g, ""));
    bad.push(`${name}: ${prop}: ${value}: ${same ? `use var(${same[0]})` : "add a named --ease-* token to theme.css"}`);
  }
  return bad;
});
const scaleGuard = ({ prefix, allowed, values }: (typeof SCALED)[number], sheets: Sheet[]) => declsOf(sheets).flatMap(({ name, prop, value }) =>
  values(prop, value).filter((v) => !KEYWORDS.has(v) && !fromTokens(prefix, v) && !allowed.includes(v)).map((v) => `${name}: ${prop}: ${value}: ${v}: ${hint(prefix, v)}`));
const gateGuard = (sheets: Sheet[]) => sheets.filter(({ name, css }) => pageGates(css) > (PAGE_GATES[name] ?? 0))
  .map(({ name, css }) => `${name}: ${pageGates(css)} :is(.pg-…, .pg-…) gates, ${PAGE_GATES[name] ?? 0} allowed: style the component's own class instead`);
const [FS, RADIUS, SPACE] = SCALED as [(typeof SCALED)[number], (typeof SCALED)[number], (typeof SCALED)[number]];

describe("stylesheets stay on the theme's tokens and scales", () => {
  it("write colors only in theme.css", () => expect(colorGuard(files)).toEqual([]));
  it("stack with the --z-* tokens", () => expect(zGuard(files)).toEqual([]));
  it("write the monospace stack and the easing curves once, as tokens", () => expect(monoEaseGuard(files)).toEqual([]));
  for (const kind of SCALED)
    it(`take each ${kind.what} from the --${kind.prefix}-* scale or ${kind.list}`, () => expect(scaleGuard(kind, files)).toEqual([]));
  it("add no page-list gate", () => expect(gateGuard(files)).toEqual([]));

  it("keep the allow-lists sorted, unique and in use", () => {
    for (const { list, allowed, values } of SCALED) {
      expect({ [list]: allowed }).toEqual({ [list]: [...new Set(allowed)].sort() });
      const used = new Set(decls.flatMap(({ prop, value }) => values(prop, value)));
      expect(allowed.filter((v) => !used.has(v)).map((v) => `remove ${v} from ${list}: no stylesheet uses it`)).toEqual([]);
    }
    expect({ RAW_COLORS }).toEqual({ RAW_COLORS: [...RAW_COLORS].sort() });
    const used = rawColors(files).map(({ at }) => at);
    expect(RAW_COLORS.filter((c) => !used.includes(c)).map((c) => `remove ${c} from RAW_COLORS: no stylesheet uses it`)).toEqual([]);
  });
});

// The guards on made-up stylesheets: what each must catch, and what it must let through.
describe("the stylesheet guards", () => {
  const sheet = (css: string, name = "pages/x/x.css"): Sheet[] => [{ name, css }];

  it("catch named colors and color(), not keywords or system colors", () => {
    expect(colorGuard(sheet(".a { color: white; background: red; box-shadow: 0 1px 2px black; border-color: silver; fill: color(srgb 1 0 0); }"))).toHaveLength(5);
    expect(colorGuard(sheet(`.a { color: currentColor; background: transparent; border-color: inherit; outline: 1px solid Highlight; fill: Canvas;
      stroke: CanvasText; color: GrayText; animation: red-glow 1s; grid-area: tan; content: "black"; } .tan { color: var(--white); }`))).toEqual([]);
  });

  it("count each allowed raw color, and match a color function whole", () => {
    expect(colorGuard(sheet(".a { --x: color-mix(in srgb, var(--a) 50%, #000); --y: color-mix(in srgb, var(--a) 50%, #000); }", "a.css"), ["a.css: #000"])).toHaveLength(1);
    expect(colorGuard(sheet(".a { color: rgb(0 0 0); background: rgb(1 1 1); }", "a.css"), ["a.css: rgb(0 0 0)"])).toHaveLength(1);
    expect(rawColors(sheet(".a { color: rgb(0 0 0); }", "a.css")).map(({ at }) => at)).toEqual(["a.css: rgb(0 0 0)"]);
  });

  it("let theme.css define a new --ease-* token, and send every curve elsewhere to the tokens", () => {
    expect(monoEaseGuard(sheet(":root { --ease-in-out: cubic-bezier(.4, 0, .2, 1); }", "theme.css"))).toEqual([]);
    expect(monoEaseGuard(sheet(".a { transition: opacity .2s cubic-bezier(.2,.7,.2,1); }"))).toEqual([
      "pages/x/x.css: transition: opacity .2s cubic-bezier(.2,.7,.2,1): use var(--ease-grow)",
    ]);
  });

  it("take a negative token through calc(), CSS-wide keywords and !important", () => {
    expect(scaleGuard(SPACE, sheet(".a { margin: calc(var(--space-2) * -1) unset; padding: var(--space-2) !important; gap: revert; row-gap: initial; }"))).toEqual([]);
    expect(scaleGuard(SPACE, sheet(".a { margin: calc(var(--space-2) + 1px); padding: calc(var(--nope) * 2); }"))).toHaveLength(2);
    expect(scaleGuard(SPACE, sheet(".a { margin: -10px; }"))[0]).toContain("use calc(var(--space-5) * -1)");
    expect(scaleGuard(RADIUS, sheet(".a { border-radius: var(--radius-sm) !important; }"))).toEqual([]);
  });

  it("allow z-index auto, 0 and -1, and nothing else raw", () => {
    expect(zGuard(sheet(".a { z-index: auto; } .b { z-index: 0; } .c { z-index: -1; } .d { z-index: var(--z-nav) !important; }"))).toEqual([]);
    expect(zGuard(sheet(".a { z-index: -2; } .b { z-index: 3; }"))).toHaveLength(2);
  });

  it("read a font shorthand's size after its style and weight", () => {
    expect(scaleGuard(FS, sheet(".a { font: 600 var(--fs-xs)/1.4 var(--font-mono); } .b { font: italic bold var(--fs-sm) sans-serif; } .c { font: inherit; }"))).toEqual([]);
    expect(scaleGuard(FS, sheet(".a { font: clamp(1rem, 3vw, 2rem)/1.2 sans-serif; } .b { font: 600 calc(1rem + 1px) serif; } .c { font: 700 .7rem / 1 serif; }"))).toHaveLength(3);
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
