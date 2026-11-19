/** Resolved media reference from getSiteSettings() */
export interface MediaReference {
	mediaId: string;
	alt?: string;
	url?: string;
}

export interface StarterSiteIdentitySettings {
	title?: string;
	tagline?: string;
	logo?: MediaReference;
	favicon?: MediaReference;
}

const DEFAULT_SITE_TITLE = "Kenshin";
const DEFAULT_SITE_TAGLINE = "ソフトウェアをつくっています。";

export function resolveStarterSiteIdentity(settings?: StarterSiteIdentitySettings) {
	return {
		siteTitle: settings?.title ?? DEFAULT_SITE_TITLE,
		siteTagline: settings?.tagline ?? DEFAULT_SITE_TAGLINE,
		siteLogo: settings?.logo?.url ? settings.logo : null,
		// 管理画面で favicon を設定したときは EmDashHead がそれを出すので、既定のロゴ（public/favicon.svg）は出さない
		useDefaultFavicon: !settings?.favicon?.url,
	};
}
