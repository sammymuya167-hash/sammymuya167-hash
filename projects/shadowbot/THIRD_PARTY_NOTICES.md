# Attribution and third-party notices

ShadowBot's UI, application server, authentication, retrieval, tests and product handbook are original SHADOWNET work. The idea “Chatbot Platform” is catalogue #86 from the user's _Full Stack Projects_ PDF; this is attribution to an idea, not to copied implementation code.

| Component                            | Source                                                                    | Role / license                                                            |
| ------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Sites/Vinext starter                 | Supplied Sites plugin starter                                             | Retained framework, build and connector helpers; preserve bundled notices |
| Sites Vite adapter                   | `build/sites-vite-plugin.ts` header and `build/sites-vite-plugin.LICENSE` | Vendored `@openai/sites-vite-plugin` 0.2.0, MIT                           |
| Vinext                               | https://github.com/cloudflare/vinext                                      | Next.js-style Worker runtime, MIT                                         |
| React                                | https://github.com/facebook/react                                         | UI/runtime, MIT                                                           |
| TypeScript                           | https://github.com/microsoft/TypeScript                                   | Types/compiler, Apache-2.0                                                |
| Vite                                 | https://github.com/vitejs/vite                                            | Build tool, MIT                                                           |
| Drizzle ORM/Kit                      | https://github.com/drizzle-team/drizzle-orm                               | Schema and generated migration tooling, Apache-2.0                        |
| Tailwind CSS                         | https://github.com/tailwindlabs/tailwindcss                               | CSS build, MIT                                                            |
| Lucide                               | https://github.com/lucide-icons/lucide                                    | Icons, ISC                                                                |
| Wrangler / Miniflare / Workers types | https://github.com/cloudflare/workers-sdk                                 | Cloudflare tools and test runtime, Apache-2.0 / MIT by package            |
| Prettier                             | https://github.com/prettier/prettier                                      | Source formatting, MIT                                                    |
| Meta Llama 3.1                       | https://www.llama.com/llama3_1/license/                                   | External model hosted by Cloudflare; model-specific terms apply           |

The retained starter includes additional UI dependencies and reusable components listed in `package.json`, the lockfile, and their distributed license files. ShadowBot does not imply authorship of those packages. No third-party photos, scraped content, or proprietary chatbot code are included. Brand artwork is CSS and original SVG, with Lucide interface icons.

Primary technical references consulted:

- https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
- https://developers.cloudflare.com/d1/
- https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fast/

The retrieval algorithm is a small custom keyword scorer inspired by term frequency/document frequency and BM25; it is not an implementation copied from a library and does not claim semantic RAG.
