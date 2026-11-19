import type { APIRoute } from "astro";
import { getSiteSettings } from "emdash";
import { GET as getEmDashRobots } from "emdash/internal/routes/robots.txt";
import { allowPublicMediaInRobots } from "../utils/robots";

export const prerender = false;

/**
 * Replaces EmDash's /robots.txt route (EmDash skips its own when this file exists) and
 * reuses its output. A custom robots.txt from the admin SEO settings is returned as is.
 * Only the generated default gets the Allow rule for public media (see utils/robots.ts).
 */
export const GET: APIRoute = async (context) => {
	const response = await getEmDashRobots(context);
	if (!response.ok) return response;
	let hasCustomRobots: boolean;
	try {
		hasCustomRobots = Boolean((await getSiteSettings()).seo?.robotsTxt);
	} catch {
		return response;
	}
	if (hasCustomRobots) return response;

	const robots = await response.text();
	const rewritten = new Response(allowPublicMediaInRobots(robots, false), response);
	rewritten.headers.delete("Content-Length");
	rewritten.headers.delete("ETag");
	return rewritten;
};
