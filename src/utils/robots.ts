/** EmDash's public media endpoint. OG images and post images are served from here. */
export const PUBLIC_MEDIA_PATH = "/_emdash/api/media/file/";

const DEFAULT_HEAD = "User-agent: *\nAllow: /\n\n# Disallow admin and API routes\nDisallow: /_emdash/\n\n";
const DEFAULT_AI_TRAINING_RULES =
	"# Disallow AI training\nUser-agent: \\*\nContent-Signal: [^\\n]*\nDisallow:\n(?:\nUser-agent: [^\\n*]+\nDisallow: /\n)+\n";
const DEFAULT_ROBOTS_RE = new RegExp(
	`^${DEFAULT_HEAD.replace(/[*/]/g, "\\$&")}(?:${DEFAULT_AI_TRAINING_RULES})?Sitemap: [^\\n]+\\n$`,
);

/**
 * EmDash's default robots.txt has `Disallow: /_emdash/`, which also blocks the media files.
 * X (Twitterbot) follows robots.txt for og:image too, so it drops the card image.
 * Add `Allow` for the public media path to the `*` group. Twitterbot uses the most specific
 * (longest) matching rule (RFC 9309), so this wins over `Disallow: /_emdash/`.
 *
 * Only EmDash's generated default is changed. A custom robots.txt from the admin SEO settings
 * is returned as is, so the rewrite never overrides rules an admin wrote; add the `Allow`
 * line there by hand.
 */
export function allowPublicMediaInRobots(robots: string): string {
	if (!DEFAULT_ROBOTS_RE.test(robots)) return robots;
	return robots.replace("\nDisallow: /_emdash/\n", `\nAllow: ${PUBLIC_MEDIA_PATH}\nDisallow: /_emdash/\n`);
}
