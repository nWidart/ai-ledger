// The one place that knows the documentation site's addresses. Every link from the app to the docs takes its URL from
// here, through a key: when a docs page moves, its entry's path changes and no call site does. docs.test.ts checks each
// entry against site/src/content/docs/ (the file exists, the title is the file's, the anchor is one of its headings) and
// fails when any other module of web/src holds the docs host.

/** The docs site's root. The site sets trailingSlash: "always", so every page path ends with "/". */
export const DOCS_BASE = "https://nwidart.github.io/ai-ledger/";

export interface DocsEntry {
  /** The page's path under DOCS_BASE: "" for the home, else ending with "/". */
  readonly path: string;
  /** The page's frontmatter title, as the docs site shows it. */
  readonly title: string;
  /** The id of one of the page's headings, as the site slugs it. */
  readonly anchor?: string;
}

// One entry per content page (the Changelog, built from CHANGELOG.md, has no content file and is left out), then the
// anchored entries the toggletips link to. A page entry's key is its path without the trailing slash; an anchored entry's
// key adds "#" and the anchor.
export const DOCS = {
  home: { path: "", title: "Dashboards for Claude Code and Codex" },

  "start/install": { path: "start/install/", title: "Install and first run" },
  "start/first-tour": { path: "start/first-tour/", title: "15-minute first tour" },
  "start/upgrade": { path: "start/upgrade/", title: "Upgrade and rebuild" },

  "pages/live": { path: "pages/live/", title: "Live" },
  "pages/limits": { path: "pages/limits/", title: "Limits" },
  "pages/activity": { path: "pages/activity/", title: "Activity" },
  // Activity's Judgments view: the page kept the address it had when Insights was a page of its own.
  "pages/insights": { path: "pages/insights/", title: "Judgments" },
  "pages/cost": { path: "pages/cost/", title: "Cost" },
  "pages/context": { path: "pages/context/", title: "Context" },
  "pages/errors": { path: "pages/errors/", title: "Errors" },
  "pages/project": { path: "pages/project/", title: "Project" },

  "everywhere/filters": { path: "everywhere/filters/", title: "Filters" },
  "everywhere/command-palette": { path: "everywhere/command-palette/", title: "Command palette" },
  "everywhere/context-menu": { path: "everywhere/context-menu/", title: "Context menu" },
  "everywhere/data-tables": { path: "everywhere/data-tables/", title: "Data tables" },
  "everywhere/keyboard-screen-reader": { path: "everywhere/keyboard-screen-reader/", title: "Keyboard and screen reader" },

  "concepts/how-it-works": { path: "concepts/how-it-works/", title: "How AI Ledger works" },
  "concepts/cost-estimates": { path: "concepts/cost-estimates/", title: "How cost is estimated" },
  "concepts/windows": { path: "concepts/windows/", title: "Context windows and plan limit windows" },
  "concepts/privacy-security": { path: "concepts/privacy-security/", title: "Privacy and security model" },

  "improve/weekly-review": { path: "improve/weekly-review/", title: "Weekly 15-minute review" },
  "improve/spend-less": { path: "improve/spend-less/", title: "Spend less for the same output" },
  "improve/plan-limits": { path: "improve/plan-limits/", title: "Stop hitting plan limits" },
  "improve/lean-context": { path: "improve/lean-context/", title: "Keep context lean" },
  "improve/tool-failures": { path: "improve/tool-failures/", title: "Kill repeated tool failures" },
  "improve/finish-sessions": { path: "improve/finish-sessions/", title: "Get sessions to finish" },
  "improve/babysit-less": { path: "improve/babysit-less/", title: "Babysit agents less" },
  "improve/automated-sessions": { path: "improve/automated-sessions/", title: "Separate automated sessions from yours" },
  "improve/compare-sources": { path: "improve/compare-sources/", title: "Compare Claude Code and Codex" },
  "improve/project-retro": { path: "improve/project-retro/", title: "Retro on one project" },
  "improve/share-screen": { path: "improve/share-screen/", title: "Share your screen safely" },

  "reference/glossary": { path: "reference/glossary/", title: "Metric glossary" },
  "reference/cli": { path: "reference/cli/", title: "CLI and options" },
  "reference/configuration": { path: "reference/configuration/", title: "Configuration" },
  "reference/storage": { path: "reference/storage/", title: "Data files and storage locations" },
  "reference/troubleshooting": { path: "reference/troubleshooting/", title: "Troubleshooting and FAQ" },

  "concepts/windows#the-context-window": { path: "concepts/windows/", anchor: "the-context-window", title: "Context windows and plan limit windows" },
  "concepts/windows#the-plan-limit-window": { path: "concepts/windows/", anchor: "the-plan-limit-window", title: "Context windows and plan limit windows" },
  "everywhere/filters#include-automated": { path: "everywhere/filters/", anchor: "include-automated", title: "Filters" },
  "reference/glossary#activity": { path: "reference/glossary/", anchor: "activity", title: "Metric glossary" },
  "reference/glossary#cost": { path: "reference/glossary/", anchor: "cost", title: "Metric glossary" },
  "reference/glossary#context": { path: "reference/glossary/", anchor: "context", title: "Metric glossary" },
  "reference/glossary#errors": { path: "reference/glossary/", anchor: "errors", title: "Metric glossary" },
  "reference/glossary#limits": { path: "reference/glossary/", anchor: "limits", title: "Metric glossary" },
  "reference/glossary#judgments": { path: "reference/glossary/", anchor: "judgments", title: "Metric glossary" },
  "reference/glossary#live": { path: "reference/glossary/", anchor: "live", title: "Metric glossary" },
  "reference/glossary#project": { path: "reference/glossary/", anchor: "project", title: "Metric glossary" },
} as const satisfies Record<string, DocsEntry>;

export type DocsKey = keyof typeof DOCS;

/** The full address of a docs entry, with its heading anchor when it has one. */
export const docsUrl = (key: DocsKey): string => {
  const e: DocsEntry = DOCS[key];
  return DOCS_BASE + e.path + (e.anchor ? "#" + e.anchor : "");
};

const PAGE_DOCS: Readonly<Record<string, DocsKey>> = {
  "/live": "pages/live", "/limits": "pages/limits", "/usage": "pages/activity", "/cost": "pages/cost",
  "/context": "pages/context", "/errors": "pages/errors", "/project": "pages/project",
};

/** The docs page for a route: each page's own, Activity's Judgments view (view=judgments) the Judgments page, anything
 *  else the docs home. `search` is the query string ("?view=judgments", with or without "?") or the parsed keys. */
export function docsForRoute(path: string, search: string | Readonly<Record<string, unknown>> = ""): DocsKey {
  const view = typeof search === "string" ? new URLSearchParams(search).get("view") : search.view;
  if (path === "/usage" && view === "judgments") return "pages/insights";
  return Object.hasOwn(PAGE_DOCS, path) ? PAGE_DOCS[path]! : "home";
}
