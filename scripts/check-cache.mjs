import assert from "node:assert/strict";

// Run against a production build served by Wrangler, not `astro dev`.
const origin = process.argv[2];
if (!origin) throw new Error("Usage: node scripts/check-cache.mjs http://localhost:4381");
const cases = [
	["/", 200, true],
	["/posts", 200, true],
	["/sitemap.xml", 200, true, ["posts", "pages", "emdash:settings"]],
	// EmDash returns 404 when a collection has no published entries.
	["/sitemap-posts.xml", [200, 404], true, ["posts", "pages", "emdash:settings"]],
	["/sitemap-pages.xml", [200, 404], true, ["posts", "pages", "emdash:settings"]],
	["/robots.txt", 200, false],
	["/?_preview=invalid", 200, false],
	["/posts?_preview=invalid", 200, false],
	["/?_edit", 302, false],
	["/_emdash/admin/", undefined, false],
	["/_image", [400, 403, 404], false],
	["/cache-check-nonexistent-page", 404, false],
	["/404", 404, false],
];
for (const [route, status, cacheable, requiredTags = ["posts"]] of cases) {
	const response = await fetch(new URL(route, origin), { redirect: "manual" });
	await response.arrayBuffer();
	if (status !== undefined) {
		assert.ok([status].flat().includes(response.status), `${route}: unexpected status ${response.status}`);
	}
	const policy = response.headers.get("cloudflare-cdn-cache-control") ?? "";
	if (cacheable && response.status === 200) {
		assert.match(policy, /max-age=300/, route);
		assert.match(policy, /stale-while-revalidate=86400/, route);
		const tags = new Set(response.headers.get("cache-tag")?.split(","));
		for (const tag of requiredTags) assert.ok(tags.has(tag), `${route}: missing tag ${tag}`);
	} else {
		assert.match(policy, /no-store/, `${route}: ${policy}`);
	}
	console.log(`PASS ${route} (${response.status}, ${policy})`);
}

// Optional local fixtures exercise real OAuth redirects and media responses.
if (process.env.CACHE_CHECK_OAUTH_CLIENT_ID) {
	const url = new URL("/_emdash/oauth/authorize", origin);
	url.search = new URLSearchParams({
		client_id: process.env.CACHE_CHECK_OAUTH_CLIENT_ID,
		redirect_uri: "http://localhost/callback",
		response_type: "code",
		code_challenge: "cache-check",
		code_challenge_method: "S256",
	}).toString();
	const response = await fetch(url, { redirect: "manual" });
	await response.arrayBuffer();
	assert.equal(response.status, 302, "OAuth authorize must redirect without immutable-header errors");
	assert.equal(new URL(response.headers.get("location"), origin).pathname, "/_emdash/admin/login");
	console.log("PASS OAuth authorize redirect");
	url.searchParams.set("_preview", "invalid");
	const privateRedirect = await fetch(url, { redirect: "manual" });
	await privateRedirect.arrayBuffer();
	assert.equal(privateRedirect.status, 302, "Immutable redirect headers must be cloned before modification");
	assert.match(privateRedirect.headers.get("cache-control") ?? "", /private, no-store/);
	console.log("PASS immutable redirect with preview opt-out");
}
if (process.env.CACHE_CHECK_MEDIA_KEY) {
	const url = new URL(`/_emdash/api/media/file/${encodeURIComponent(process.env.CACHE_CHECK_MEDIA_KEY)}`, origin);
	const response = await fetch(url);
	await response.arrayBuffer();
	assert.equal(response.status, 200, "Media fixture must exist");
	assert.match(response.headers.get("cache-control") ?? "", /max-age=/);
	assert.doesNotMatch(response.headers.get("cache-control") ?? "", /no-store/);
	const etag = response.headers.get("etag");
	assert.ok(etag, "Media must keep its validator");
	const conditional = await fetch(url, { headers: { "If-None-Match": etag } });
	await conditional.arrayBuffer();
	assert.equal(conditional.status, 304, "Media must remain conditionally cacheable");
	console.log("PASS media cache policy and conditional 304");
}
if (process.env.CACHE_CHECK_IMAGE_SRC) {
	const url = new URL("/_image", origin);
	url.search = new URLSearchParams({ href: process.env.CACHE_CHECK_IMAGE_SRC, w: "1", f: "png" }).toString();
	const response = await fetch(url);
	await response.arrayBuffer();
	assert.equal(response.status, 200, "Image transform fixture must succeed");
	assert.match(response.headers.get("content-type") ?? "", /^image\//);
	const policy = response.headers.get("cloudflare-cdn-cache-control") ?? "";
	assert.doesNotMatch(policy, /max-age=300(?:\D|$)/, "Images must not inherit the page TTL");
	const tags = new Set(response.headers.get("cache-tag")?.split(","));
	assert.equal(tags.has("pages"), false, "Images must not inherit the pages tag");
	assert.match(response.headers.get("cache-control") ?? "", /max-age=/, "Keep the image browser cache policy");
	console.log("PASS successful image transform excludes page cache policy");
}
