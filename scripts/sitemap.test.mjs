import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeHomeInSitemap } from "../src/utils/sitemap.ts";

test("uses the root URL for the home page and its language alternates", () => {
	const xml = `<urlset>
  <url>
    <loc>https://imeankenshin.com/home</loc>
    <xhtml:link rel="alternate" hreflang="ja" href="https://imeankenshin.com/home/" />
  </url>
</urlset>`;
	assert.equal(
		canonicalizeHomeInSitemap(xml),
		xml.replace("/home</loc>", "/</loc>").replace('/home/"', '/"'),
	);
});

test("leaves other page URLs and image URLs alone", () => {
	const xml = `<urlset>
  <url>
    <loc>https://imeankenshin.com/about</loc>
    <image:loc>https://images.example/home</image:loc>
  </url>
  <url><loc>https://imeankenshin.com/archive/home</loc></url>
</urlset>`;
	assert.equal(canonicalizeHomeInSitemap(xml), xml);
});
