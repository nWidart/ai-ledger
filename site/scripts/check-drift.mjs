// Fails when the site drifts from what it mirrors:
// - a color token in src/styles/custom.css differs from the app's token it copies in web/src/theme.css;
// - a screenshot in src/assets/shots/ lacks its other theme variant, or is not listed in that folder's README.md,
//   or the README lists a shot whose files are missing.
// Names the token or the file.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appTheme = fileURLToPath(new URL("../../web/src/theme.css", import.meta.url));
const siteTheme = fileURLToPath(new URL("../src/styles/custom.css", import.meta.url));
const shots = fileURLToPath(new URL("../src/assets/shots/", import.meta.url));

// The site's token for each app token it copies (custom.css: "Keep the values equal to the app's").
const mirrored = {
  "--bg": "--ai-bg",
  "--surface-1": "--ai-surface-1",
  "--surface-2": "--ai-surface-2",
  "--border": "--ai-border",
  "--control-border": "--ai-control-border",
  "--text-primary": "--ai-text-primary",
  "--text-secondary": "--ai-text-secondary",
  "--text-muted": "--ai-text-muted",
  "--accent": "--ai-accent",
  "--accent-ink": "--ai-accent-ink",
  "--on-accent": "--ai-on-accent",
  "--series-1": "--sl-color-blue",
  "--good": "--sl-color-green",
  "--good-text": "--sl-color-green-high",
  "--warning": "--sl-color-orange",
  "--warning-text": "--sl-color-orange-high",
  "--critical": "--sl-color-red",
  "--critical-text": "--sl-color-red-high",
  "--proj-4": "--sl-color-purple",
};

const problems = [];

/** The custom properties of a stylesheet's first `:root { … }` block, values with whitespace removed. */
function rootTokens(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const block = text.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "";
  const tokens = new Map();
  for (const [, name, value] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens.set(name, value.replace(/\s+/g, ""));
  return tokens;
}

const app = rootTokens(await readFile(appTheme, "utf8"));
const site = rootTokens(await readFile(siteTheme, "utf8"));
for (const [appName, siteName] of Object.entries(mirrored)) {
  const a = app.get(appName), s = site.get(siteName);
  if (a === undefined) problems.push(`web/src/theme.css has no ${appName} in :root`);
  else if (s === undefined) problems.push(`src/styles/custom.css has no ${siteName} in :root`);
  else if (a !== s) problems.push(`${siteName} is ${s} in src/styles/custom.css; the app's ${appName} is ${a}`);
}

// Every shot is <name>.png (dark) and <name>-light.png (light), and has a row in the README's table.
const pngs = new Set((await readdir(shots)).filter((f) => f.endsWith(".png")));
const names = new Set([...pngs].map((f) => f.replace(/(-light)?\.png$/, "")));
for (const name of [...names].sort()) {
  for (const file of [`${name}.png`, `${name}-light.png`])
    if (!pngs.has(file)) problems.push(`src/assets/shots/${file} is missing: each shot needs a dark and a light file`);
}
const readme = await readFile(shots + "README.md", "utf8");
const listed = new Set([...readme.matchAll(/^\|\s*`([\w-]+)`\s*\|/gm)].map((m) => m[1]));
for (const name of [...names].sort())
  if (!listed.has(name)) problems.push(`src/assets/shots/${name}.png has no row in src/assets/shots/README.md`);
for (const name of [...listed].sort())
  if (!names.has(name)) problems.push(`src/assets/shots/README.md lists ${name}, which has no PNG files`);

if (problems.length) {
  for (const problem of problems) console.error(`check-drift: ${problem}`);
  process.exit(1);
}
console.log(`check-drift: ${Object.keys(mirrored).length} theme tokens match the app; ${names.size} shots are paired and listed`);
