import assert from "node:assert/strict";
import test from "node:test";
import { allowPublicMediaInRobots } from "../src/utils/robots.ts";

test("allows the public media path before EmDash's /_emdash/ disallow", () => {
	const robots = [
		"User-agent: *",
		"Allow: /",
		"",
		"# Disallow admin and API routes",
		"Disallow: /_emdash/",
		"",
		"Sitemap: https://imeankenshin.com/sitemap.xml",
		"",
	].join("\n");
	assert.equal(
		allowPublicMediaInRobots(robots),
		robots.replace("Disallow: /_emdash/", "Allow: /_emdash/api/media/file/\nDisallow: /_emdash/"),
	);
});

test("handles each group and leaves other rules alone", () => {
	const robots = "User-agent: *\nDisallow: /_emdash\n\nUser-agent: GPTBot\nDisallow: /\n";
	assert.equal(
		allowPublicMediaInRobots(robots),
		"User-agent: *\nAllow: /_emdash/api/media/file/\nDisallow: /_emdash\n\nUser-agent: GPTBot\nDisallow: /\n",
	);
});

test("does not add the rule twice", () => {
	const robots = "User-agent: *\nAllow: /_emdash/api/media/file/\nDisallow: /_emdash/\n";
	assert.equal(allowPublicMediaInRobots(robots), robots);
});

test("leaves robots.txt without the /_emdash/ disallow unchanged", () => {
	const robots = "User-agent: *\nAllow: /\n";
	assert.equal(allowPublicMediaInRobots(robots), robots);
});
