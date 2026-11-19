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
	assert.equal(target("/_relay/static/array.js", "https://ph.example.com/ingest"), "https://ph.example.com/ingest/static/array.js");
	assert.equal(target("/_relay/e/?v=1", "https://ph.example.com/ingest/"), "https://ph.example.com/ingest/e/?v=1");
	assert.equal(target("/_relay/e/", "https://us.i.posthog.com/"), "https://us.i.posthog.com/e/");
});

test("never changes the upstream host", () => {
	const paths = ["/_relay//evil.example/e/", "/_relay/%2F%2Fevil.example/", "/_relay/..//evil.example", "/_relay/%2e%2e//evil.example", "/_relay/@evil.example"];
	for (const apiHost of ["https://us.i.posthog.com", "https://us.i.posthog.com/ingest"]) {
		for (const path of paths) {
			const href = target(path, apiHost);
			// null（転送しない）か、転送先が PostHog のまま
			if (href !== null) assert.equal(new URL(href).host, "us.i.posthog.com", `${apiHost} ${path}`);
		}
	}
});

test("forwards the SDK request without site credentials", async (t) => {
	let sent;
	let init;
	t.mock.method(globalThis, "fetch", async (input, requestInit) => {
		init = requestInit;
		sent = new Request(input, requestInit);
		return new Response("ok");
	});
	const request = new Request("https://imeankenshin.com/_relay/e/?compression=gzip-js", {
		method: "POST",
		body: "data",
		headers: {
			cookie: "session=secret",
			authorization: "Bearer secret",
			"cf-access-jwt-assertion": "secret",
			"content-type": "text/plain",
			"user-agent": "Firefox",
			referer: "https://imeankenshin.com/posts/draft?_preview=token",
			"CF-Connecting-IP": "203.0.113.7",
			"X-Forwarded-For": "198.51.100.1",
		},
	});
	await proxyPostHogRequest(request, new URL("https://us.i.posthog.com/e/?compression=gzip-js"));
	assert.equal(sent.url, "https://us.i.posthog.com/e/?compression=gzip-js");
	assert.equal(sent.method, "POST");
	assert.equal(sent.redirect, "manual");
	// 本文は読み切らずにストリームのまま渡す
	assert.equal(init.body, request.body);
	assert.equal(await sent.text(), "data");
	assert.equal(sent.headers.get("cookie"), null);
	assert.equal(sent.headers.get("authorization"), null);
	assert.equal(sent.headers.get("cf-access-jwt-assertion"), null);
	assert.equal(sent.headers.get("content-type"), "text/plain");
	assert.equal(sent.headers.get("user-agent"), "Firefox");
	// ページのパスやクエリ（プレビューのトークンなど）を PostHog に渡さない
	assert.equal(sent.headers.get("referer"), null);
	// クライアントが付けた X-Forwarded-For ではなく、Cloudflare が見た IP を渡す
	assert.equal(sent.headers.get("X-Forwarded-For"), "203.0.113.7");
});

test("does not trust a client X-Forwarded-For without the Cloudflare IP", async (t) => {
	let sent;
	t.mock.method(globalThis, "fetch", async (input, requestInit) => {
		sent = new Request(input, requestInit);
		return new Response("ok");
	});
	const request = new Request("https://imeankenshin.com/_relay/static/array.js", { headers: { "X-Forwarded-For": "198.51.100.1" } });
	await proxyPostHogRequest(request, new URL("https://us-assets.i.posthog.com/static/array.js"));
	assert.equal(sent.method, "GET");
	assert.equal(sent.headers.get("X-Forwarded-For"), null);
});

test("does not let PostHog set cookies on this site", async (t) => {
	const upstreamHeaders = new Headers({ "content-type": "application/json", "cache-control": "no-cache" });
	upstreamHeaders.append("set-cookie", "AWSALB=abc; Path=/");
	upstreamHeaders.append("set-cookie", "other=1; Path=/");
	t.mock.method(globalThis, "fetch", async () => new Response('{"status":1}', { status: 200, headers: upstreamHeaders }));
	const response = await proxyPostHogRequest(
		new Request("https://imeankenshin.com/_relay/e/", { method: "POST", body: "data" }),
		new URL("https://us.i.posthog.com/e/"),
	);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("set-cookie"), null);
	assert.equal(response.headers.get("content-type"), "application/json");
	assert.equal(response.headers.get("cache-control"), "no-cache");
	assert.equal(await response.text(), '{"status":1}');
});

test("derives the PostHog app host", () => {
	assert.equal(getPostHogUiHost("https://us.i.posthog.com"), "https://us.posthog.com");
	assert.equal(getPostHogUiHost("https://eu.i.posthog.com/"), "https://eu.posthog.com");
	assert.equal(getPostHogUiHost("https://ph.example.com"), null);
	assert.equal(getPostHogUiHost("not a url"), null);
});
