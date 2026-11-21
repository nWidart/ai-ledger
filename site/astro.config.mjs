// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";
import starlightLlmsTxt from "starlight-llms-txt";

const description =
  "AI Ledger reads your Claude Code, Codex and Grok transcripts into a local DuckDB store and serves them as dashboards: " +
  "what your coding agents did, what it cost, how full their context got, where they failed, how much of your plan " +
  "limits they used, and which sessions need you now. Everything runs on your machine.";

// Written out item by item (design D7): a new file never joins the sidebar by accident.
/** @typedef {{ label: string, items: Array<string | Group> }} Group */
/** @type {Array<{ label: string, slug: string } | Group>} */
const sidebar = [
  { label: "Home", slug: "index" },
  { label: "Get started", items: ["start/install", "start/first-tour", "start/upgrade"] },
  {
    label: "Improve your workflow",
    // The playbooks in three groups; their slugs are the addresses the app and older links use.
    items: [
      { label: "Routines", items: ["improve/weekly-review", "improve/project-retro"] },
      {
        label: "Efficiency & limits",
        items: ["improve/spend-less", "improve/plan-limits", "improve/lean-context", "improve/compare-sources"],
      },
      {
        label: "Reliability & workflow",
        items: [
          "improve/tool-failures",
          "improve/babysit-less",
          "improve/finish-sessions",
          "improve/automated-sessions",
          "improve/share-screen",
        ],
      },
    ],
  },
  {
    label: "Pages",
    // In the app's navigation order: Now (Live, Limits), then Review. pages/insights is Activity's Judgments view: it keeps
    // the address it had as the Insights page, so links to it still open.
    items: [
      "pages/live",
      "pages/limits",
      "pages/activity",
      "pages/insights",
      "pages/cost",
      "pages/context",
      "pages/errors",
      "pages/project",
    ],
  },
  {
    label: "Everywhere",
    items: [
      "everywhere/command-palette",
      "everywhere/context-menu",
      "everywhere/sheets",
      "everywhere/filters",
      "everywhere/keyboard-screen-reader",
      "everywhere/data-tables",
    ],
  },
  {
    label: "Concepts",
    items: [
      "concepts/how-it-works",
      "concepts/supported-agents",
      "concepts/cost-estimates",
      "concepts/windows",
      "concepts/privacy-security",
    ],
  },
  {
    label: "Reference",
    items: [
      "reference/cli",
      "reference/configuration",
      "reference/glossary",
      "reference/storage",
      "reference/troubleshooting",
    ],
  },
  { label: "Changelog", slug: "changelog" },
];

// llms-full.txt follows the sidebar order, so the playbooks come before the reference (design D5).
/** A group's slugs, its nested groups' included, in sidebar order. @param {Group} group @returns {string[]} */
const slugs = (group) => group.items.flatMap((item) => (typeof item === "string" ? [item] : slugs(item)));
const sidebarOrder = sidebar.flatMap((entry) => ("items" in entry ? slugs(entry) : [entry.slug]));
// llms.txt links one file per top-level sidebar group, so an agent can fetch only the section it needs.
const sidebarGroups = sidebar.flatMap((entry) => ("items" in entry ? [{ label: entry.label, paths: slugs(entry) }] : []));

export default defineConfig({
  site: "https://nwidart.github.io",
  base: "/ai-ledger",
  trailingSlash: "always",
  integrations: [
    starlight({
      title: "AI Ledger",
      description,
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/nWidart/ai-ledger" }],
      editLink: { baseUrl: "https://github.com/nWidart/ai-ledger/edit/main/site/" },
      // The app's mark (web/index.html) and its typeface, self-hosted so a reader's browser asks no third party.
      logo: { src: "./src/assets/mark.svg" },
      favicon: "/favicon.svg",
      customCss: [
        "@fontsource/ibm-plex-sans/latin-400.css",
        "@fontsource/ibm-plex-sans/latin-400-italic.css",
        "@fontsource/ibm-plex-sans/latin-500.css",
        "@fontsource/ibm-plex-sans/latin-600.css",
        "./src/styles/custom.css",
      ],
      // Code frames take the app's 8px control radius and no drop shadow.
      expressiveCode: { styleOverrides: { borderRadius: "0.5rem", frames: { frameBoxShadowCssValue: "none" } } },
      sidebar,
      plugins: [
        starlightLinksValidator(),
        starlightLlmsTxt({
          projectName: "AI Ledger",
          description,
          promote: sidebarOrder,
          customSets: sidebarGroups,
        }),
      ],
    }),
  ],
});
