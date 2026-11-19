import assert from "node:assert/strict";
import test from "node:test";
import { buildRobotsTxt } from "../src/utils/robots.ts";

const ORIGIN = "https://imeankenshin.com";
const DEFAULT = [
	"User-agent: *",
	"Allow: /",
	"",
	"# Disallow admin and API routes",
	"Allow: /_emdash/api/media/file/",
	"Disallow: /_emdash/",
	"",
	"Sitemap: https://imeankenshin.com/sitemap.xml",
	"",
].join("\n");

test("default robots.txt allows public media under the /_emdash/ disallow", () => {
	assert.equal(buildRobotsTxt({}, ORIGIN), DEFAULT);
});

test("default robots.txt with AI training disallowed keeps the media rule in the * group only", () => {
	const robots = buildRobotsTxt({ seo: { disallowAiTraining: true } }, ORIGIN);
	const groups = robots.split("\n\n");
	assert.match(groups[1], /^# Disallow admin and API routes\nAllow: \/_emdash\/api\/media\/file\/\nDisallow: \/_emdash\/$/);
	assert.match(robots, /\nUser-agent: GPTBot\nDisallow: \/\n/);
	assert.equal(robots.match(/Allow: \/_emdash\/api\/media\/file\//g).length, 1);
	assert.ok(robots.endsWith("\nSitemap: https://imeankenshin.com/sitemap.xml\n"));
});

test("uses the site URL from settings for the sitemap", () => {
	assert.match(buildRobotsTxt({ url: "https://example.com/" }, ORIGIN), /\nSitemap: https:\/\/example\.com\/sitemap\.xml\n$/);
});

test("custom robots.txt is served as written, even a copy of EmDash's default", () => {
	const emdashDefault = DEFAULT.replace("Allow: /_emdash/api/media/file/\n", "");
	assert.equal(buildRobotsTxt({ seo: { robotsTxt: emdashDefault } }, ORIGIN), emdashDefault);
	const merged = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: GPTBot\nDisallow: /_emdash/\n\nSitemap: https://x.test/s.xml\n";
	assert.equal(buildRobotsTxt({ seo: { robotsTxt: merged } }, ORIGIN), merged);
});

test("custom robots.txt gets EmDash's AI rules and sitemap appended, without the media rule", () => {
	const robots = buildRobotsTxt({ seo: { robotsTxt: "User-agent: *\nDisallow: /private/\n", disallowAiTraining: true } }, ORIGIN);
	assert.ok(robots.startsWith("User-agent: *\nDisallow: /private/\n\n# Disallow AI training\n"));
	assert.ok(robots.endsWith("\n\nSitemap: https://imeankenshin.com/sitemap.xml\n"));
	assert.doesNotMatch(robots, /media/);
});
