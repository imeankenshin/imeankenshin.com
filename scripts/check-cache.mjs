import assert from "node:assert/strict";

// Run against a production build served by Wrangler, not `astro dev`.
const origin = process.argv[2];
if (!origin) throw new Error("Usage: node scripts/check-cache.mjs http://localhost:4381");
const cases = [
	["/", 200, true],
	["/posts", 200, true],
	["/?_preview=invalid", 200, false],
	["/posts?_preview=invalid", 200, false],
	["/?_edit", 302, false],
	["/_emdash/admin/", undefined, false],
	["/cache-check-nonexistent-page", 404, false],
	["/404", 404, false],
];
for (const [route, status, cacheable] of cases) {
	const response = await fetch(new URL(route, origin), { redirect: "manual" });
	await response.arrayBuffer();
	if (status !== undefined) assert.equal(response.status, status, route);
	const policy = response.headers.get("cloudflare-cdn-cache-control") ?? "";
	if (cacheable) {
		assert.match(policy, /max-age=300/, route);
		assert.match(policy, /stale-while-revalidate=86400/, route);
		assert.ok(response.headers.get("cache-tag")?.includes("posts"), route);
	} else {
		assert.match(policy, /no-store/, `${route}: ${policy}`);
	}
	console.log(`PASS ${route} (${response.status}, ${policy})`);
}
