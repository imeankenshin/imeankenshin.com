import type { APIRoute } from "astro";
import type { SeoSettings } from "emdash";
import { getPublicOrigin, OptionsRepository } from "emdash/api/route-utils";
import { buildRobotsTxt } from "../utils/robots";

export const prerender = false;

const TEXT_PLAIN = { "Content-Type": "text/plain; charset=utf-8" };
const PERMISSIVE_FALLBACK = "User-agent: *\nAllow: /\n";

/**
 * Replaces EmDash's /robots.txt route (EmDash skips its own when this file exists).
 * See buildRobotsTxt for what differs. Like EmDash's route, it reads the settings
 * straight from the database (not the cached site settings) in one query, and returns
 * a permissive file when the CMS is not initialized or the read fails. The middleware
 * sets no-store.
 */
export const GET: APIRoute = async ({ locals, url }) => {
	const { emdash } = locals;
	if (!emdash?.db) return new Response(PERMISSIVE_FALLBACK, { headers: TEXT_PLAIN });

	try {
		const options = await new OptionsRepository(emdash.db).getMany(["site:url", "site:seo"]);
		const settings = {
			url: options.get("site:url") as string | undefined,
			seo: options.get("site:seo") as SeoSettings | undefined,
		};
		const origin = getPublicOrigin(url, emdash.config);
		return new Response(buildRobotsTxt(settings, origin), { headers: TEXT_PLAIN });
	} catch {
		return new Response(PERMISSIVE_FALLBACK, { headers: TEXT_PLAIN });
	}
};
