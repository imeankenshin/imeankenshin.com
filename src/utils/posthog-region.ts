/**
 * PostHog Cloud の API ホストから、データの保存先の地域を返す。
 * リバースプロキシなどで判別できないときは null。
 */
export function getPostHogRegion(apiHost: string): "米国" | "EU" | null {
	let hostname: string;
	try {
		hostname = new URL(apiHost).hostname;
	} catch {
		return null;
	}
	if (/^(us|us-assets)\.i\.posthog\.com$/.test(hostname) || hostname === "app.posthog.com")
		return "米国";
	if (/^(eu|eu-assets)\.i\.posthog\.com$/.test(hostname)) return "EU";
	return null;
}
