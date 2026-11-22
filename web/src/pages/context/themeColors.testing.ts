// The Context charts' tests share this reader of theme.css. A chart hands env.color only tokens that theme.css declares as
// colors zrender's parser reads: a token that is not one resolves to the inherited text color, with no error (foundation,
// decision 4). As in rateTracks.test.ts.
import { readFileSync } from "node:fs";

const PLAIN = String.raw`(?:#[0-9a-fA-F]{3,8}|rgba?\([^()]*\))`;
const COLOR = new RegExp(String.raw`^(?:${PLAIN}|light-dark\(\s*${PLAIN}\s*,\s*${PLAIN}\s*\))$`);

/** Each token the :root blocks of theme.css declare as hex, rgb() or a light-dark() of them, as `var(--name)`. */
export function themeColors(): Set<string> {
  const css = readFileSync("src/theme.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, ""); // vitest runs from web/
  const out = new Set<string>();
  for (const block of css.matchAll(/(?:^|\n):root \{([^}]*)\}/g))
    for (const m of block[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) if (COLOR.test(m[2]!.trim())) out.add(`var(${m[1]})`);
  return out;
}
