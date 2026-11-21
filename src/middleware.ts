import { defineMiddleware } from "astro:middleware";
import { canonicalizeHomeInSitemap } from "./utils/sitemap";

// Route rules also match failed renders. Run after the page and layout have
// contributed hints so a later layout cannot accidentally re-enable caching.
export const onRequest = defineMiddleware(async (context, next) => {
	const response = await next();
	// Image transforms own their browser cache policy; /[slug] must not add a
	// page TTL or page invalidation tags to the injected endpoint.
	if (context.url.pathname === "/_image") context.cache?.set(false);
	const isPreview =
		context.url.searchParams.has("_preview") || context.url.searchParams.has("_edit");
	// robots.txt can return a permissive fallback with status 200 on DB failure.
	if (response.status >= 400 || isPreview || context.url.pathname === "/robots.txt") {
		context.cache?.set(false);
		// Redirects and fetched responses may have immutable headers in workerd.
		const uncached = new Response(response.body, response);
		uncached.headers.set("Cache-Control", isPreview ? "private, no-store" : "no-store");
		return uncached;
	}
	// EmDash's generated sitemap uses the CMS slug, which redirects on this site.
	if (
		response.ok &&
		response.body &&
		/^\/sitemap-pages(?:-\d+)?\.xml$/.test(context.url.pathname)
	) {
		const xml = await response.text();
		const canonicalXml = canonicalizeHomeInSitemap(xml);
		const sitemap = new Response(canonicalXml, response);
		if (canonicalXml !== xml) {
			sitemap.headers.delete("Content-Length");
			sitemap.headers.delete("ETag");
		}
		return sitemap;
	}
	return response;
});
