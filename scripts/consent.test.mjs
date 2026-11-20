import assert from "node:assert/strict";
import test from "node:test";
import { CONSENT_STATUS_LABELS, parseConsentChoice } from "../src/utils/consent.ts";

test("accepts only the two consent choices", () => {
	assert.equal(parseConsentChoice("granted"), "granted");
	assert.equal(parseConsentChoice("denied"), "denied");
	assert.equal(parseConsentChoice("pending"), null);
	assert.equal(parseConsentChoice(""), null);
	assert.equal(parseConsentChoice(undefined), null);
	assert.equal(parseConsentChoice(null), null);
});

test("has a label for every consent status", () => {
	assert.deepEqual(Object.keys(CONSENT_STATUS_LABELS).toSorted(), ["denied", "granted", "pending"]);
});

test("derives the PostHog Cloud region from the API host", async () => {
	const { getPostHogRegion } = await import("../src/utils/posthog-region.ts");
	assert.equal(getPostHogRegion("https://us.i.posthog.com"), "米国");
	assert.equal(getPostHogRegion("https://eu.i.posthog.com/"), "EU");
	assert.equal(getPostHogRegion("https://ph.example.com"), null);
	assert.equal(getPostHogRegion("not a url"), null);
});
