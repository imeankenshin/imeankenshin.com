import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";
import { posthogConfig } from "./utils/analytics";
import { getPostHogProxyTarget, proxyPostHogRequest } from "./utils/posthog-proxy";
import { isPublicPreviewRequest } from "./utils/preview";

export { PluginBridge };

export default {
	...handler,
	async fetch(request, env, context) {
		if (!handler.fetch) throw new Error("EmDash fetch handler is missing");
		if ((env as { SITE_PREVIEW?: string }).SITE_PREVIEW !== "true") {
			// PostHog の通信はページの描画（DB の準備を含む）を通さずに転送する。
			// プレビューは読み取り専用なので転送しない（下の isPublicPreviewRequest で POST は 404）。
			// 開発中は SDK が PostHog に直接送る（posthog.astro）ので、プロキシは本番ビルドだけで動かす。
			const posthogTarget =
				import.meta.env.PROD && posthogConfig && getPostHogProxyTarget(new URL(request.url), posthogConfig.apiHost);
			if (posthogTarget) return proxyPostHogRequest(request, posthogTarget);
			return handler.fetch(request, env, context);
		}

		// プレビューは公開ページの確認用。管理画面・認証・更新 API を公開しない。
		if (!isPublicPreviewRequest(request)) {
			return new Response("Not found", { status: 404 });
		}
		const original = await handler.fetch(request, env, context);
		const response = new Response(original.body, original);
		response.headers.set("X-Robots-Tag", "noindex, nofollow");
		return response;
	},
	scheduled: createScheduledHandler(),
} satisfies ExportedHandler;
