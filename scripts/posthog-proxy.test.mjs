import assert from "node:assert/strict";
import test from "node:test";
import { getPostHogProxyTarget, getPostHogUiHost, proxyPostHogRequest } from "../src/utils/posthog-proxy.ts";

const target = (path, apiHost = "https://us.i.posthog.com") =>
	getPostHogProxyTarget(new URL(`https://imeankenshin.com${path}`), apiHost)?.href ?? null;

test("forwards only the proxy path", () => {
	for (const path of ["/", "/posts", "/_relayx/e/", "/relay/e/", "/posts/_relay/e/"]) assert.equal(target(path), null, path);
});

test("sends events to the API host and the SDK files to the assets host", () => {
	assert.equal(target("/_relay/e/?ip=0&_=1"), "https://us.i.posthog.com/e/?ip=0&_=1");
	assert.equal(target("/_relay/flags/?v=2"), "https://us.i.posthog.com/flags/?v=2");
	assert.equal(target("/_relay/static/array.js"), "https://us-assets.i.posthog.com/static/array.js");
	assert.equal(target("/_relay/array/phc_x/config.js"), "https://us-assets.i.posthog.com/array/phc_x/config.js");
	assert.equal(target("/_relay/static/array.js", "https://eu.i.posthog.com"), "https://eu-assets.i.posthog.com/static/array.js");
	assert.equal(target("/_relay/static/array.js", "https://ph.example.com"), "https://ph.example.com/static/array.js");
});

test("never changes the upstream host", () => {
	for (const path of ["/_relay//evil.example/e/", "/_relay/%2F%2Fevil.example/", "/_relay/..//evil.example", "/_relay/%2e%2e//evil.example", "/_relay/@evil.example"]) {
		const href = target(path);
		// null（転送しない）か、転送先が PostHog のまま
		if (href !== null) assert.equal(new URL(href).host, "us.i.posthog.com", path);
	}
});

test("drops site cookies and passes the visitor IP", async (t) => {
	let sent;
	t.mock.method(globalThis, "fetch", async (input, init) => {
		sent = new Request(input, init);
		return new Response("ok");
	});
	const request = new Request("https://imeankenshin.com/_relay/e/", {
		method: "POST",
		body: "data",
		headers: { cookie: "session=secret", "CF-Connecting-IP": "203.0.113.7", "X-Forwarded-For": "198.51.100.1" },
	});
	await proxyPostHogRequest(request, new URL("https://us.i.posthog.com/e/"));
	assert.equal(sent.url, "https://us.i.posthog.com/e/");
	assert.equal(sent.method, "POST");
	assert.equal(await sent.text(), "data");
	assert.equal(sent.headers.get("cookie"), null);
	assert.equal(sent.headers.get("X-Forwarded-For"), "203.0.113.7");
});

test("derives the PostHog app host", () => {
	assert.equal(getPostHogUiHost("https://us.i.posthog.com"), "https://us.posthog.com");
	assert.equal(getPostHogUiHost("https://eu.i.posthog.com/"), "https://eu.posthog.com");
	assert.equal(getPostHogUiHost("https://ph.example.com"), null);
	assert.equal(getPostHogUiHost("not a url"), null);
});
