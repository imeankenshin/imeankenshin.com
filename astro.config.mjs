import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import react from "@astrojs/react";
import { hyperdrive, r2 } from "@emdash-cms/cloudflare";
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";

// 本番: Cloudflare Workers + Hyperdrive(PostgreSQL) + R2
// ローカル: 同じ Worker ランタイムで、Hyperdrive は wrangler.jsonc の
// localConnectionString（docker compose の Postgres）に接続する
export default defineConfig({
	output: "server",
	adapter: cloudflare(),
	// Cache public HTML before the Worker runs. EmDash purges these tags on writes.
	// Refresh after 5 min; retain stale HTML for sparse visits while revalidating.
	cache: { provider: cacheCloudflare() },
	routeRules: {
		"/": { maxAge: 300, swr: 86_400, tags: ["posts", "pages"] },
		// Term names are rendered by the list/detail pages without taxonomy hints.
		"/posts": { maxAge: 300, swr: 86_400, tags: ["posts", "emdash:taxonomy:tag"] },
		"/posts/[slug]": { maxAge: 300, swr: 86_400, tags: ["posts", "emdash:taxonomy:tag", "emdash:taxonomy:category"] },
		"/[slug]": { maxAge: 300, swr: 86_400, tags: ["pages"] },
		"/category/[slug]": { maxAge: 300, swr: 86_400, tags: ["posts"] },
		"/tag/[slug]": { maxAge: 300, swr: 86_400, tags: ["posts"] },
	},
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			toolbar: "client",
			database: hyperdrive({ binding: "HYPERDRIVE" }),
			storage: r2({ binding: "MEDIA" }),
		}),
	],
	devToolbar: { enabled: false },
	vite: {
		// pg は CommonJS のため、開発時の Worker ランタイムでは事前バンドルが必要
		// （ないと "require is not defined" で 500 になる）
		environments: { ssr: { optimizeDeps: { include: ["pg"] } } },
	},
});
