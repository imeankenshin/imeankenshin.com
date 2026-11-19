import type { SiteSettings } from "emdash";

/** EmDash's public media endpoint. OG images and post images are served from here. */
export const PUBLIC_MEDIA_PATH = "/_emdash/api/media/file/";

/** Same as EmDash's robots.txt route (node_modules/emdash/src/astro/routes/robots.txt.ts). */
const AI_TRAINING_CRAWLERS = [
	"Amazonbot",
	"Applebot-Extended",
	"Bytespider",
	"CCBot",
	"ClaudeBot",
	"Google-Extended",
	"GPTBot",
	"meta-externalagent",
];

const AI_TRAINING_RULES = [
	"# Disallow AI training",
	"User-agent: *",
	"Content-Signal: search=yes, ai-train=no",
	"Disallow:",
	...AI_TRAINING_CRAWLERS.flatMap((agent) => ["", `User-agent: ${agent}`, "Disallow: /"]),
].join("\n");

type RobotsSettings = Pick<Partial<SiteSettings>, "url" | "seo">;

/**
 * Builds robots.txt the way EmDash does, with one change to the generated default:
 * `Allow` for the public media path in the `*` group. EmDash's default has
 * `Disallow: /_emdash/`, which also blocks media files, and X (Twitterbot) follows
 * robots.txt for og:image too, so it dropped the card image. Twitterbot uses the most
 * specific (longest) matching rule (RFC 9309), so the `Allow` wins.
 *
 * A custom robots.txt from the admin SEO settings is used as written, even when it is a
 * copy of the default, so this never overrides rules an admin wrote. One settings value
 * decides which file to serve and renders it, so the two cannot disagree.
 */
export function buildRobotsTxt(settings: RobotsSettings, origin: string): string {
	const sitemapUrl = `${(settings.url || origin).replace(/\/$/, "")}/sitemap.xml`;
	const disallowAiTraining = settings.seo?.disallowAiTraining === true;

	if (settings.seo?.robotsTxt) {
		let content = settings.seo.robotsTxt;
		if (disallowAiTraining) content = `${content.trimEnd()}\n\n${AI_TRAINING_RULES}\n`;
		if (!content.toLowerCase().includes("sitemap:")) {
			content = `${content.trimEnd()}\n\nSitemap: ${sitemapUrl}\n`;
		}
		return content;
	}

	return [
		"User-agent: *",
		"Allow: /",
		"",
		"# Disallow admin and API routes",
		`Allow: ${PUBLIC_MEDIA_PATH}`,
		"Disallow: /_emdash/",
		"",
		...(disallowAiTraining ? [AI_TRAINING_RULES, ""] : []),
		`Sitemap: ${sitemapUrl}`,
		"",
	].join("\n");
}
