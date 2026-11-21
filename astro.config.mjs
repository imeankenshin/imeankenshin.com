import cloudflare from "@astrojs/cloudflare";
import { cacheCloudflare } from "@astrojs/cloudflare/cache";
import react from "@astrojs/react";
import { hyperdrive, r2 } from "@emdash-cms/cloudflare";
import { defineConfig, fontProviders } from "astro/config";
import emdash from "emdash/astro";
import { viteDevtoolsAstroBuild } from "./scripts/vite-devtools-astro-build.mjs";

const publicCache = { maxAge: 300, swr: 86_400 };

// 本番: Cloudflare Workers + Hyperdrive(PostgreSQL) + R2
// ローカル: 同じ Worker ランタイムで、Hyperdrive は wrangler.jsonc の
// localConnectionString（docker compose の Postgres）に接続する
export default defineConfig({
	i18n: {
		locales: ["ja"],
		defaultLocale: "ja",
	},
	output: "server",
	adapter: cloudflare(),
	// Cache public HTML before the Worker runs. EmDash purges these tags on writes.
	// Refresh after 5 min; retain stale HTML for sparse visits while revalidating.
	cache: { provider: cacheCloudflare() },
	routeRules: {
		"/": { ...publicCache, tags: ["posts", "pages"] },
		// Term names are rendered by the list/detail pages without taxonomy hints.
		"/posts": { ...publicCache, tags: ["posts", "emdash:taxonomy:tag"] },
		"/posts/[slug]": {
			...publicCache,
			tags: ["posts", "emdash:taxonomy:tag", "emdash:taxonomy:category"],
		},
		"/[slug]": { ...publicCache, tags: ["pages"] },
		"/category/[slug]": { ...publicCache, tags: ["posts"] },
		"/tag/[slug]": { ...publicCache, tags: ["posts"] },
		// Static text in code; the layout adds its own settings/menu hints.
		"/privacy": publicCache,
		// These injected endpoints also match /[slug]; give them their own dependencies.
		"/sitemap.xml": { ...publicCache, tags: ["posts", "pages", "emdash:settings"] },
		"/sitemap-[collection].xml": { ...publicCache, tags: ["posts", "pages", "emdash:settings"] },
	},
	// Google Fonts のフォントをビルド時にダウンロードして、このサイトから配信する（/_astro/fonts/）。
	// ブラウザは Google に接続しない。CSS 変数は src/styles/theme.css の --font-* から参照する。
	// <Font /> は @font-face をページごとにインラインで出すので、ウェイトは個別に並べず可変フォントの
	// 範囲で指定する（Google は個別指定でも同じ可変フォントのファイルを返す。CSS だけが重複する）
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Inter",
			cssVariable: "--font-inter",
			weights: ["400 700"],
			styles: ["normal"],
			// 和文は後ろの Noto Sans JP に任せる。ここで sans-serif を入れると和文がシステムフォントになる
			fallbacks: [],
		},
		{
			provider: fontProviders.google(),
			name: "Noto Sans JP",
			cssVariable: "--font-noto-sans-jp",
			weights: ["400 700"],
			styles: ["normal"],
			// 和文のグリフは Google の CSS でサブセット名のない unicode-range の分割ファイルになっていて、
			// 既定の subsets（latin）でも全部取り込まれる。ブラウザは使う文字の分だけ読み込む
			fallbacks: ["Hiragino Sans", "system-ui", "sans-serif"],
		},
		{
			provider: fontProviders.google(),
			name: "JetBrains Mono",
			cssVariable: "--font-jetbrains-mono",
			weights: [400],
			styles: ["normal"],
			fallbacks: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
		},
	],
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
		environments: {
			ssr: { optimizeDeps: { include: ["pg"] } },
		},
		// Vite DevTools（https://devtools.vite.dev）。開発サーバーでのみ有効にし、本番ビルドには含めない
		devtools: { apply: "serve" },
		// DevTools の Rolldown パネルの「Run build」で vite build ではなく astro build を実行する
		plugins: [viteDevtoolsAstroBuild()],
	},
});
