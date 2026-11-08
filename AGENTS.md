This is an EmDash site -- a CMS built on Astro with a full admin UI.

## Commands

```bash
pnpm dev              # Start local Postgres (docker compose) + the Astro dev server
pnpm deploy           # astro build && wrangler deploy (cf cannot build Astro 7 yet)
npx emdash types      # Regenerate TypeScript types from a running site
```

The admin UI is at `http://localhost:4321/_emdash/admin`.

## Key Files

| File                     | Purpose                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `astro.config.mjs`       | Astro config: Cloudflare adapter, Hyperdrive (PostgreSQL) database, R2 storage     |
| `wrangler.jsonc`         | Worker bindings (HYPERDRIVE, MEDIA), cron trigger, local Postgres connection       |
| `src/worker.ts`          | Worker entry: Astro handler + scheduled handler (scheduled publishing)             |
| `compose.yaml`           | Local PostgreSQL for development (`pnpm dev` starts it)                            |
| `scripts/cf-*.mjs`       | Cloudflare CLI (`cf`) helpers for Hyperdrive creation and Worker secrets           |
| `src/live.config.ts`     | EmDash loader registration (boilerplate -- don't modify)                           |
| `seed/seed.json`         | Schema definition + demo content (collections, fields, taxonomies, menus, widgets) |
| `emdash-env.d.ts`        | Generated types for collections (auto-regenerated on dev server start)             |
| `src/layouts/Base.astro` | Base layout with EmDash wiring (menus, search, page contributions)                 |
| `src/pages/`             | Astro pages -- all server-rendered                                                 |

## Skills

Agent skills are in `.agents/skills/`. Load them when working on specific tasks:

- **building-emdash-site** -- Querying content, rendering Portable Text, schema design, seed files, site features (menus, widgets, search, SEO, comments, bylines). Start here.
- **creating-plugins** -- Building EmDash plugins with hooks, storage, admin UI, API routes, and Portable Text block types.
- **emdash-cli** -- CLI commands for content management, seeding, type generation, and visual editing flow.

## Documentation

The EmDash docs are available as an MCP server at `https://docs.emdashcms.com/mcp`. When you need to verify an API, hook, config option, field type, or pattern, call `search_docs` against the live documentation rather than relying on training-data recall. The docs reflect current behaviour; assumptions may not.

This template ships with `.mcp.json`, `.cursor/mcp.json`, and `.vscode/mcp.json` so Claude Code, Cursor, and VS Code auto-discover the docs server. Other tools (OpenCode, Windsurf, etc.) need a manual one-time setup -- see [docs.emdashcms.com/docs-mcp](https://docs.emdashcms.com/docs-mcp).

## Deployment

Cloudflare Workers + Hyperdrive (PostgreSQL) + R2. See README.md. Use Wrangler for build/deploy and the Cloudflare CLI (`cf`) for account/resource commands. Do not run `cf init`, `cf dev`, `cf build`, or `cf deploy` here: the project uses `wrangler.jsonc`, and `cf` does not build Astro 6+ during its beta.

## Rules

- All content pages must be server-rendered (`output: "server"`). No `getStaticPaths()` for CMS content.
- Image fields are objects (`{ src, alt }`), not strings. Use `<Image image={...} />` from `"emdash/ui"`.
- `entry.id` is the slug (for URLs). `entry.data.id` is the database ULID (for API calls like `getEntryTerms`).
- When Astro's cache is enabled, pass content-query hints to `Astro.cache.set(cacheHint)`. Use the `WithCacheHint` variants for site settings, menus, taxonomies, and widget areas rendered by cached routes.
- Taxonomy names in queries must match the seed's `"name"` field exactly (e.g., `"category"` not `"categories"`).

## This Site

Kenshin's personal site + blog, built from the EmDash Starter template and customized: Japanese UI, a minimal
single-column design (`src/styles/theme.css`), an editable home page (`home` page entry + `links` menu), and
Cloudflare Workers deployment. Extend the existing design tokens instead of introducing a second theme.

## Pages

| Page        | Path               | What it shows                                                        |
| ----------- | ------------------ | -------------------------------------------------------------------- |
| Home        | `/`                | Intro from the `home` page entry, `links` menu, 5 latest posts       |
| All posts   | `/posts`           | Post list with tags (cursor pagination)                              |
| Post detail | `/posts/[slug]`    | Post content (`pageType="article"`)                                  |
| Page        | `/[slug]`          | Static page content (e.g. `/about`); `/home` redirects to `/`        |
| Category    | `/category/[slug]` | Posts filtered by category (hierarchical; lookup walks the tree)     |
| Tag         | `/tag/[slug]`      | Posts filtered by tag                                                |

## Schema

- `posts` collection: `title`, `featured_image`, `content` (Portable Text), `excerpt` (text).
- `pages` collection: `title`, `content` (Portable Text). The `home` entry is the home page intro.
- Taxonomies: `category` (hierarchical), `tag`.
- Menus: `primary` (header nav) and `links` (home page link list).

Site settings have `title` and `tagline`.

## Design

Japanese UI (`lang="ja"`). Dates use `formatDate()` in `src/utils/date.ts` (ja-JP, Asia/Tokyo — Workers run in UTC).
Design tokens live in `src/styles/theme.css` (imported by `Base.astro`), with light/dark via `prefers-color-scheme`.
Page-specific styles go in each page's `<style>` block and reference the CSS variables.
Don't add component libraries without a reason; the site is small on purpose.
