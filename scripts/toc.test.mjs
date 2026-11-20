import assert from "node:assert/strict";
import test from "node:test";
import {
	getHeadingAnchor,
	getTocHeadings,
	provideHeadingAnchors,
	slugifyHeading,
} from "../src/utils/toc.ts";

const block = (key, style, ...texts) => ({
	_type: "block",
	_key: key,
	style,
	children: texts.map((text, i) => ({ _type: "span", _key: `${key}${i}`, text })),
});

test("slugs keep Japanese text and join words with hyphens", () => {
	assert.equal(slugifyHeading("My skill set"), "my-skill-set");
	assert.equal(slugifyHeading("1年目〜3年目"), "1年目-3年目");
	assert.equal(slugifyHeading("５年目以降"), "5年目以降");
	assert.equal(slugifyHeading("Q&A: なぜ？"), "qa-なぜ");
	assert.equal(slugifyHeading("!!!"), "section");
});

test("collects h2-h4 with depth relative to the top level and unique ids", () => {
	const headings = getTocHeadings([
		block("a", "normal", "本文"),
		block("b", "h3", "Future"),
		block("c", "h4", "達成のための", "目標設定"),
		block("d", "h3", "Future"),
		block("e", "h3", "   "),
		block("f", "h1", "見出し1"),
		{ _type: "image", _key: "g" },
	]);
	assert.deepEqual(
		headings.map(({ key, id, text, depth }) => ({ key, id, text, depth })),
		[
			{ key: "b", id: "future", text: "Future", depth: 0 },
			{ key: "c", id: "達成のための目標設定", text: "達成のための目標設定", depth: 1 },
			{ key: "d", id: "future-2", text: "Future", depth: 0 },
		],
	);
	assert.deepEqual(getTocHeadings(null), []);
	assert.deepEqual(getTocHeadings([block("a", "normal", "本文")]), []);
});

test("anchors are looked up per request", () => {
	const request = new Request("https://example.com/about");
	provideHeadingAnchors(request, getTocHeadings([block("k", "h2", "Links")]));
	assert.equal(getHeadingAnchor(request, "k"), "links");
	assert.equal(getHeadingAnchor(request, "x"), undefined);
	assert.equal(getHeadingAnchor(new Request("https://example.com/"), "k"), undefined);
});
