/** EmDash's public media endpoint. OG images and post images are served from here. */
export const PUBLIC_MEDIA_PATH = "/_emdash/api/media/file/";

const DISALLOW_EMDASH_RE = /^([ \t]*)Disallow:[ \t]*\/_emdash\/?[ \t]*(#.*)?$/i;

/**
 * EmDash's robots.txt has `Disallow: /_emdash/`, which also blocks the media files.
 * X (Twitterbot) follows robots.txt for og:image too, so it drops the card image.
 * Put an `Allow` for the public media path before each such `Disallow`. It wins in
 * longest-match parsers (RFC 9309) and in first-match parsers.
 */
export function allowPublicMediaInRobots(robots: string): string {
	const lines = robots.split("\n");
	const out: string[] = [];
	for (const [index, line] of lines.entries()) {
		const match = DISALLOW_EMDASH_RE.exec(line.replace(/\r$/, ""));
		const allowLine = `${match?.[1] ?? ""}Allow: ${PUBLIC_MEDIA_PATH}`;
		if (match && lines[index - 1]?.trim() !== allowLine.trim()) out.push(allowLine);
		out.push(line);
	}
	return out.join("\n");
}
