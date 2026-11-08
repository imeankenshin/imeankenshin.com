import cloudflare from "@astrojs/cloudflare";
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
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
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
