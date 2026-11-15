// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLinksValidator from "starlight-links-validator";
import starlightLlmsTxt from "starlight-llms-txt";

const description =
  "AI Ledger reads your Claude Code and Codex transcripts into a local DuckDB store and serves them as dashboards: " +
  "what your coding agents did, what it cost, how full their context got, where they failed, how much of your plan " +
  "limits they used, and which sessions need you now. Everything runs on your machine.";

// Written out item by item (design D7): a new file never joins the sidebar by accident.
/** @type {Array<{ label: string, slug: string } | { label: string, items: string[] }>} */
const sidebar = [
  { label: "Home", slug: "index" },
  { label: "Get started", items: ["start/install", "start/first-tour", "start/upgrade"] },
  {
    label: "Improve your workflow",
    items: [
      "improve/weekly-review",
      "improve/spend-less",
      "improve/plan-limits",
      "improve/lean-context",
      "improve/tool-failures",
      "improve/babysit-less",
      "improve/finish-sessions",
      "improve/project-retro",
      "improve/compare-sources",
      "improve/automated-sessions",
      "improve/share-screen",
    ],
  },
  {
    label: "Pages",
    items: [
      "pages/activity",
      "pages/cost",
      "pages/context",
      "pages/errors",
      "pages/limits",
      "pages/insights",
      "pages/live",
      "pages/project",
    ],
  },
  {
    label: "Everywhere",
    items: [
      "everywhere/command-palette",
      "everywhere/context-menu",
      "everywhere/filters",
      "everywhere/keyboard-screen-reader",
      "everywhere/data-tables",
    ],
  },
  {
    label: "Concepts",
    items: ["concepts/how-it-works", "concepts/cost-estimates", "concepts/windows", "concepts/privacy-security"],
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
const sidebarOrder = sidebar.flatMap((entry) => ("items" in entry ? entry.items : [entry.slug]));
// llms.txt links one file per sidebar group, so an agent can fetch only the section it needs.
const sidebarGroups = sidebar.flatMap((entry) => ("items" in entry ? [{ label: entry.label, paths: entry.items }] : []));

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
      customCss: ["./src/styles/custom.css"],
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
