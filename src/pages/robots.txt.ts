import type { APIRoute } from "astro";
import { getSiteSettings } from "emdash";
import { buildRobotsTxt } from "../utils/robots";

export const prerender = false;

const TEXT_PLAIN = { "Content-Type": "text/plain; charset=utf-8" };
const PERMISSIVE_FALLBACK = "User-agent: *\nAllow: /\n";

/**
 * Replaces EmDash's /robots.txt route (EmDash skips its own when this file exists).
 * See buildRobotsTxt for what differs. Like EmDash, a permissive file is returned when
 * the CMS is not initialized or settings cannot be read. The middleware sets no-store.
 */
export const GET: APIRoute = async ({ locals, url }) => {
	const { emdash } = locals;
	if (!emdash?.db) return new Response(PERMISSIVE_FALLBACK, { headers: TEXT_PLAIN });

	try {
		const settings = await getSiteSettings();
		const origin = emdash.config?.siteUrl || url.origin;
		return new Response(buildRobotsTxt(settings, origin), { headers: TEXT_PLAIN });
	} catch {
		return new Response(PERMISSIVE_FALLBACK, { headers: TEXT_PLAIN });
	}
};
