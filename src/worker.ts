import handler, { createScheduledHandler, PluginBridge } from "@emdash-cms/cloudflare/worker";
import { isPublicPreviewRequest } from "./utils/preview";

export { PluginBridge };

export default {
	...handler,
	async fetch(request, env, context) {
		if (!handler.fetch) throw new Error("EmDash fetch handler is missing");
		if ((env as { SITE_PREVIEW?: string }).SITE_PREVIEW !== "true") {
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
