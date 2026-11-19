import assert from "node:assert/strict";
import test from "node:test";
import { allowPublicMediaInRobots } from "../src/utils/robots.ts";

// Same shape as EmDash's default robots.txt (node_modules/emdash/src/astro/routes/robots.txt.ts).
const HEAD = ["User-agent: *", "Allow: /", "", "# Disallow admin and API routes", "Disallow: /_emdash/", ""];
const AI_TRAINING_RULES = [
	"# Disallow AI training",
	"User-agent: *",
	"Content-Signal: search=yes, ai-train=no",
	"Disallow:",
	...["Amazonbot", "GPTBot", "meta-externalagent"].flatMap((agent) => ["", `User-agent: ${agent}`, "Disallow: /"]),
].join("\n");
const SITEMAP = "Sitemap: https://imeankenshin.com/sitemap.xml";
const withAllow = (robots) =>
	robots.replace("Disallow: /_emdash/", "Allow: /_emdash/api/media/file/\nDisallow: /_emdash/");

test("allows the public media path in EmDash's default robots.txt", () => {
	const robots = [...HEAD, SITEMAP, ""].join("\n");
	assert.equal(allowPublicMediaInRobots(robots, false), withAllow(robots));
});

test("allows the public media path when AI training is disallowed", () => {
	const robots = [...HEAD, AI_TRAINING_RULES, "", SITEMAP, ""].join("\n");
	const result = allowPublicMediaInRobots(robots, false);
	assert.equal(result, withAllow(robots));
	assert.match(result, /User-agent: GPTBot\nDisallow: \/\n/);
});

test("does not add the rule twice", () => {
	const robots = withAllow([...HEAD, SITEMAP, ""].join("\n"));
	assert.equal(allowPublicMediaInRobots(robots, false), robots);
});

test("leaves custom robots.txt unchanged, so admin rules are never overridden", () => {
	const customs = [
		// Repeated groups for one crawler merge; an injected Allow would beat `Disallow: /`.
		"User-agent: GPTBot\nDisallow: /\n\nUser-agent: GPTBot\nDisallow: /_emdash/\n\nSitemap: https://imeankenshin.com/sitemap.xml\n",
		[...HEAD, "User-agent: *", "Disallow: /", "", SITEMAP, ""].join("\n"),
		"User-agent: *\r\nAllow: /\r\nDisallow: /_emdash/ # admin\r\n",
		"User-agent: *\nDisallow : /_EMDASH/\n",
		"User-agent: *\nAllow: /\n",
		// CR-only line breaks hide more rules on the "Sitemap" line.
		[...HEAD, `${SITEMAP}\rUser-agent: *\rDisallow: /`, ""].join("\n"),
		[...HEAD, AI_TRAINING_RULES.replace("GPTBot", "GPTBot\rUser-agent: *"), "", SITEMAP, ""].join("\n"),
	];
	for (const robots of customs) assert.equal(allowPublicMediaInRobots(robots, false), robots);
});

test("leaves a custom robots.txt that is a byte-for-byte copy of the default unchanged", () => {
	for (const robots of [[...HEAD, SITEMAP, ""].join("\n"), [...HEAD, AI_TRAINING_RULES, "", SITEMAP, ""].join("\n")]) {
		assert.equal(allowPublicMediaInRobots(robots, true), robots);
	}
});
