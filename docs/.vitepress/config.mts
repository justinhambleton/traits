import { defineConfig } from "vitepress";

const docsBase =
  process.env.DOCS_BASE ??
  (process.env.NODE_ENV === "production" ? "/traits/" : "/");

export default defineConfig({
  base: docsBase,
  title: "traits.dev",
  description:
    "Schema-driven AI personality profiles with compile-time safety checks and model-aware compilation.",
  srcDir: "site",
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "Overview", link: "/" },
      { text: "Showcase", link: "/showcase" },
      { text: "Schema Reference", link: "/schema-reference" },
      { text: "Guides", link: "/guides/first-profile" },
      { text: "API", link: "/api/core" }
    ],
    sidebar: {
      "/": [
        {
          text: "Getting Started",
          items: [
            { text: "Overview", link: "/" },
            { text: "Showcase", link: "/showcase" },
            { text: "Schema Reference", link: "/schema-reference" }
          ]
        }
      ],
      "/guides/": [
        {
          text: "Guides",
          items: [
            { text: "Write Your First Profile", link: "/guides/first-profile" },
            { text: "Extend Profiles Safely", link: "/guides/extending-profiles" },
            { text: "Run Evaluations", link: "/guides/running-evaluations" }
          ]
        }
      ],
      "/api/": [
        {
          text: "API",
          items: [{ text: "@traits-dev/core", link: "/api/core" }]
        }
      ]
    },
    socialLinks: [{ icon: "github", link: "https://github.com/justinhambleton/traits" }]
  }
});
