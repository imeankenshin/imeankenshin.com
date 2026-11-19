/** EmDash's public media endpoint. OG images and post images are served from here. */
export const PUBLIC_MEDIA_PATH = "/_emdash/api/media/file/";

const DEFAULT_HEAD = "User-agent: *\nAllow: /\n\n# Disallow admin and API routes\nDisallow: /_emdash/\n\n";
const DEFAULT_AI_TRAINING_RULES =
	"# Disallow AI training\nUser-agent: \\*\nContent-Signal: [^\\r\\n]*\nDisallow:\n(?:\nUser-agent: [^\\r\\n*]+\nDisallow: /\n)+\n";
const DEFAULT_ROBOTS_RE = new RegExp(
	`^${DEFAULT_HEAD.replace(/[*/]/g, "\\$&")}(?:${DEFAULT_AI_TRAINING_RULES})?Sitemap: [^\\r\\n]+\\n$`,
);

/**
 * EmDash's default robots.txt has `Disallow: /_emdash/`, which also blocks the media files.
 * X (Twitterbot) follows robots.txt for og:image too, so it drops the card image.
 * Add `Allow` for the public media path to the `*` group. Twitterbot uses the most specific
 * (longest) matching rule (RFC 9309), so this wins over `Disallow: /_emdash/`.
 *
 * Only EmDash's generated default is changed. When the admin SEO settings have a custom
 * robots.txt (`hasCustomRobots`), it is returned as is, even when it is a copy of the default,
 * so the rewrite never overrides rules an admin wrote. As a second guard, text that does not
 * have the default's exact shape is returned unchanged.
 */
export function allowPublicMediaInRobots(robots: string, hasCustomRobots: boolean): string {
	if (hasCustomRobots || !DEFAULT_ROBOTS_RE.test(robots)) return robots;
	return robots.replace("\nDisallow: /_emdash/\n", `\nAllow: ${PUBLIC_MEDIA_PATH}\nDisallow: /_emdash/\n`);
}
