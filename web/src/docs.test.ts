// The registry against the docs site's content: a page renamed, a heading reworded or a title changed fails here, in the
// web check, whichever project the pull request touches. The repository holds both projects; the tests run from web/.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import GithubSlugger from "github-slugger";
import { describe, expect, it } from "vitest";
import { DOCS, DOCS_BASE, docsForRoute, docsUrl, type DocsEntry, type DocsKey } from "./docs";

const CONTENT = join(__dirname, "../../site/src/content/docs");
const entries = Object.entries(DOCS) as [DocsKey, DocsEntry][];

/** The content file a page path names, as Starlight resolves it, or undefined. */
const contentFile = (path: string): string | undefined => {
  const p = path.replace(/\/$/, "");
  const tries = p === "" ? ["index.md", "index.mdx"] : [`${p}.md`, `${p}.mdx`, `${p}/index.md`, `${p}/index.mdx`];
  return tries.map(t => join(CONTENT, t)).find(f => existsSync(f));
};

const frontmatter = (src: string): string => /^---\r?\n([\s\S]*?)\r?\n---/.exec(src)?.[1] ?? "";
const titleOf = (src: string): string | undefined => {
  const m = /^title:\s*(.*)$/m.exec(frontmatter(src));
  return m?.[1]?.trim().replace(/^(["'])(.*)\1$/, "$2");
};

/** The ids of a Markdown file's headings, in order, slugged as the site slugs them: the heading's text through one
 *  github-slugger per page, so a repeated heading gets "-1", "-2". Fenced code and the frontmatter hold no heading. */
function headingSlugs(src: string): string[] {
  const slugger = new GithubSlugger(), out: string[] = [];
  let fence: string | null = null;
  for (const line of src.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").split(/\r?\n/)) {
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (f && (fence === null || (f[0] === fence[0] && f.length >= fence.length))) { fence = fence === null ? f : null; continue; }
    if (fence !== null) continue;
    const h = /^\s{0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/.exec(line)?.[1];
    if (h === undefined) continue;
    // The heading's rendered text: a link's or an image's label, code without its backticks, no HTML tag nor emphasis mark.
    const text = h.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/`([^`]*)`/g, "$1").replace(/<[^>]+>/g, "")
      .replace(/(\*\*|__|\*|_)(\S(?:.*?\S)?)\1/g, "$2");
    out.push(slugger.slug(text));
  }
  return out;
}

/** Every file under web/src but the tests (which may spell out an address to check it) and the registry itself. */
const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.test\.tsx?$/.test(f) || p === join(__dirname, "docs.ts") ? [] : [p];
  });

describe("docs registry", () => {
  it("maps each route to its page", () => {
    expect(docsUrl(docsForRoute("/cost", ""))).toBe("https://nwidart.github.io/ai-ledger/pages/cost/");
    expect(docsUrl(docsForRoute("/usage", "?view=judgments"))).toBe("https://nwidart.github.io/ai-ledger/pages/insights/");
    expect(docsForRoute("/usage", { view: "judgments", project: "x" })).toBe("pages/insights");
    expect(docsForRoute("/usage", "?range=7")).toBe("pages/activity");
    expect(docsForRoute("/project", "?project=ai-ledger")).toBe("pages/project");
    expect(docsUrl(docsForRoute("/project", { project: "ai-ledger" }))).toBe("https://nwidart.github.io/ai-ledger/pages/project/");
    // The page the route shows: Codex has no judgments, so Overview shows; Project with no project redirects to Activity.
    expect(docsForRoute("/usage", "?view=judgments&source=codex")).toBe("pages/activity");
    expect(docsForRoute("/usage", "?view=judgments&source=grok")).toBe("pages/activity");
    expect(docsForRoute("/usage", "?view=judgments&source=gemini")).toBe("pages/insights");  // an unknown source shows All
    expect(docsForRoute("/usage", { view: "judgments", source: "claude" })).toBe("pages/insights");
    expect(docsForRoute("/project", "")).toBe("pages/activity");
    for (const [path, key] of [["/live", "pages/live"], ["/limits", "pages/limits"], ["/context", "pages/context"], ["/errors", "pages/errors"]] as const)
      expect(docsForRoute(path)).toBe(key);
    // view=judgments belongs to Activity only; an unknown path, the root and the old /insights open the docs home.
    expect(docsForRoute("/cost", "?view=judgments")).toBe("pages/cost");
    for (const path of ["/nope", "/", "/insights", "/constructor"]) expect(docsForRoute(path, "")).toBe("home");
    expect(docsUrl("home")).toBe("https://nwidart.github.io/ai-ledger/");
  });

  it("builds a URL with the anchor after the page path", () => {
    expect(docsUrl("concepts/windows#the-context-window")).toBe("https://nwidart.github.io/ai-ledger/concepts/windows/#the-context-window");
    expect(docsUrl("reference/glossary#cost")).toBe("https://nwidart.github.io/ai-ledger/reference/glossary/#cost");
  });

  it("names every page path with a trailing slash, as the site serves them", () => {
    expect(entries.filter(([, e]) => e.path !== "" && !e.path.endsWith("/")).map(([k]) => k)).toEqual([]);
  });

  it("slugs headings as the site does: one counter per page, code and fences skipped", () => {
    const src = "---\ntitle: T\n---\n## Cost\n```md\n## Not a heading\n```\n### `prices.json`\n## Cost\n## [Linked](/x/) *words* ##\n";
    expect(headingSlugs(src)).toEqual(["cost", "pricesjson", "cost-1", "linked-words"]);
  });
});

describe("docs registry matches the docs site", () => {
  it("finds the content, with a content file for each path", () => {
    expect(existsSync(CONTENT)).toBe(true);
    const missing = entries.filter(([, e]) => !contentFile(e.path)).map(([k, e]) => `${k}: no content file for "${e.path}"`);
    expect(missing).toEqual([]);
  });

  it("has an entry for each content page", () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap(f => statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]);
    const named = new Set(entries.map(([, e]) => contentFile(e.path)));
    // changelog.md is generated from CHANGELOG.md by the site's sync step and ignored by git: present only after a site build.
    const generated = new Set(["changelog.md"]);
    expect(files(CONTENT).filter(f => /\.mdx?$/.test(f) && !named.has(f)).map(f => f.slice(CONTENT.length + 1)).filter(f => !generated.has(f))).toEqual([]);
  });

  it("holds each page's title", () => {
    const wrong = entries.flatMap(([k, e]) => {
      const f = contentFile(e.path), title = f && titleOf(readFileSync(f, "utf8"));
      return f && title !== e.title ? [`${k}: title "${e.title}", the page's is "${title}"`] : [];
    });
    expect(wrong).toEqual([]);
  });

  it("names a heading of its page in each anchor", () => {
    const wrong = entries.flatMap(([k, e]) => {
      const f = contentFile(e.path);
      return f && e.anchor && !headingSlugs(readFileSync(f, "utf8")).includes(e.anchor) ? [`${k}: no heading "#${e.anchor}" in ${e.path}`] : [];
    });
    expect(wrong).toEqual([]);
  });

  it("is the only module that holds the docs host", () => {
    const host = new URL(DOCS_BASE).host;
    const holders = sourceFiles(__dirname).filter(f => readFileSync(f, "utf8").includes(host)).map(f => f.slice(__dirname.length + 1));
    expect(holders).toEqual([]);
  });
});
