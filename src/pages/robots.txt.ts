import type { APIRoute } from "astro";
import { getPublicOrigin, OptionsRepository } from "emdash/api/route-utils";
import { renderRobotsTxt } from "@/utils/robots";

export const prerender = false;

/**
 * Replaces EmDash's /robots.txt route (EmDash skips its own when this file exists).
 * See buildRobotsTxt and renderRobotsTxt in utils/robots.ts. The middleware sets no-store.
 */
export const GET: APIRoute = async ({ locals, url }) => {
	const { emdash } = locals;
	const options = emdash?.db ? new OptionsRepository(emdash.db) : null;
	const body = await renderRobotsTxt(
		options && ((names) => options.getMany(names)),
		getPublicOrigin(url, emdash?.config),
	);
	return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
