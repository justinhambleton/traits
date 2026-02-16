import { defineConfig } from "vitepress";

const docsBase =
  process.env.DOCS_BASE ??
  (process.env.NODE_ENV === "production" ? "/traits/" : "/");

export default defineConfig({
  base: docsBase,
  cleanUrls: true,
  title: "traits.dev",
  description:
    "Schema-driven voice and behavioral policy for production AI agents.",
  srcDir: "site",
  lastUpdated: true,

  async transformPageData(pageData, { siteConfig }) {
    if (pageData.relativePath === "index.md") return;
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const filePath = path.resolve(siteConfig.srcDir, pageData.relativePath);
      const raw = fs.readFileSync(filePath, "utf-8");
      return { rawMarkdownB64: Buffer.from(raw).toString("base64") };
    } catch {
      return { rawMarkdownB64: "" };
    }
  },

  themeConfig: {
    nav: [
      { text: "Quickstart", link: "/quickstart" },
      { text: "Playground", link: "/playground/" },
      { text: "Guides", link: "/guides/first-profile" },
      { text: "Reference", link: "/reference/cli" },
      { text: "API", link: "/api/core" }
    ],
    sidebar: {
      "/": [
        {
          text: "Getting Started",
          items: [
            { text: "Overview", link: "/overview" },
            { text: "Quickstart", link: "/quickstart" },
            { text: "Core Concepts", link: "/concepts" },
            { text: "Playground", link: "/playground/" },
            { text: "Showcase", link: "/showcase/" }
          ]
        },
        {
          text: "Guides",
          items: [
            { text: "Write Your First Profile", link: "/guides/first-profile" },
            { text: "Extend Profiles Safely", link: "/guides/extending-profiles" },
            { text: "Composition Patterns", link: "/guides/composition-patterns" },
            { text: "Integration Recipes", link: "/guides/integrations" },
            { text: "Running Evaluations", link: "/guides/running-evaluations" },
            { text: "CI/CD Pipeline Setup", link: "/guides/ci-cd" }
          ]
        },
        {
          text: "Reference",
          items: [
            { text: "CLI", link: "/reference/cli" },
            { text: "Eval Scoring", link: "/reference/eval-scoring" },
            { text: "Safety & Validation Codes", link: "/reference/safety-codes" },
            { text: "Schema", link: "/schema-reference" },
            { text: "API (@traits-dev/core)", link: "/api/core" }
          ]
        }
      ]
    },
    socialLinks: [{ icon: "github", link: "https://github.com/justinhambleton/traits" }]
  }
});
