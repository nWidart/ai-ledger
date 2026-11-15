// Prepares the files the site takes from the repo (design D9). Its outputs are git-ignored:
// - src/content/docs/changelog.md, from ../CHANGELOG.md with repo-relative links made absolute;
// - public/media/*.gif, the GIFs the pages use, copied from ../docs/*.gif, which stay the only copy in git.
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const site = fileURLToPath(new URL("..", import.meta.url));
const repo = fileURLToPath(new URL("../..", import.meta.url));
const blob = "https://github.com/nWidart/ai-ledger/blob/main/";

// A link target is repo-relative unless it has a scheme, is an anchor or is site-absolute.
const isRelative = (target) => !/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(target);
const absolute = (target) => (isRelative(target) ? blob + target : target);

async function syncChangelog() {
  const source = await readFile(`${repo}CHANGELOG.md`, "utf8");
  const body = source
    .replace(/^# Changelog\s*\n/, "")
    .replace(/\]\(([^)\s]+)\)/g, (_, target) => `](${absolute(target)})`)
    .replace(/^(\[[^\]]+\]:\s*)(\S+)/gm, (_, label, target) => label + absolute(target));
  const frontMatter = [
    "---",
    "title: Changelog",
    "description: What changed in each AI Ledger release.",
    `editUrl: ${blob.replace("/blob/", "/edit/")}CHANGELOG.md`,
    "---",
    "",
  ].join("\n");
  await writeFile(`${site}src/content/docs/changelog.md`, frontMatter + body);
}

// Only the GIFs a page names (`gif="tour"` on a ThemedImage), with their light variants: the rest stay out of the build.
async function usedGifs() {
  const docs = `${site}src/content/docs/`;
  const files = (await readdir(docs, { recursive: true })).filter((name) => /\.mdx?$/.test(name));
  const names = new Set();
  for (const name of files) {
    for (const [, gif] of (await readFile(docs + name, "utf8")).matchAll(/\bgif="([\w-]+)"/g)) names.add(gif);
  }
  return [...names].flatMap((gif) => [`${gif}.gif`, `${gif}-light.gif`]);
}

async function syncGifs() {
  const media = `${site}public/media/`;
  await rm(media, { recursive: true, force: true });
  await mkdir(media, { recursive: true });
  const gifs = await usedGifs();
  await Promise.all(gifs.map((name) => copyFile(`${repo}docs/${name}`, media + name)));
}

await Promise.all([syncChangelog(), syncGifs()]);
