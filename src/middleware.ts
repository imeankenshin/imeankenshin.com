import { defineMiddleware } from "astro:middleware";

// Route rules also match failed renders. Run after the page and layout have
// contributed hints so a later layout cannot accidentally re-enable caching.
export const onRequest = defineMiddleware(async (context, next) => {
	const response = await next();
	const isPreview = context.url.searchParams.has("_preview") || context.url.searchParams.has("_edit");
	if (response.status >= 400 || isPreview || context.url.pathname.startsWith("/_emdash")) {
		context.cache?.set(false);
		response.headers.set("Cache-Control", isPreview ? "private, no-store" : "no-store");
	}
	return response;
});
