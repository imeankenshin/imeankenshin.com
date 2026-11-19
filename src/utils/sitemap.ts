/** EmDash lists the CMS entry at /home, but the public home page lives at /. */
export function canonicalizeHomeInSitemap(xml: string): string {
	return xml
		.replace(/(<loc>https?:\/\/[^/<>\s]+\/)home\/?(<\/loc>)/g, "$1$2")
		.replace(/(<xhtml:link\b[^>]*\bhref="https?:\/\/[^/"<>\s]+\/)home\/?(")/g, "$1$2");
}
