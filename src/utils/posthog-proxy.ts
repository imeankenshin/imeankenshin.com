/**
 * PostHog へのリバースプロキシ（src/worker.ts から呼ぶ）。
 * ブラウザの SDK は us.i.posthog.com ではなくこのサイトの POSTHOG_PROXY_PATH に送るので、
 * 他社ドメインへの通信を止める追跡防止機能（Firefox の強化型トラッキング防止、広告ブロッカー）でも計測が止まらない。
 * パス名は "analytics" "posthog" など、ブロックリストに載りやすい語を避けている。
 */
export const POSTHOG_PROXY_PATH = "/_relay";

/**
 * プロキシのパスへのリクエストなら転送先の URL を返す。それ以外は null。
 * SDK のスクリプトと設定（/static/, /array/）はアセット用のホストから取る。
 */
export function getPostHogProxyTarget(url: URL, apiHost: string): URL | null {
	const { pathname } = url;
	if (pathname !== POSTHOG_PROXY_PATH && !pathname.startsWith(`${POSTHOG_PROXY_PATH}/`)) return null;

	let target: URL;
	try {
		target = new URL(apiHost);
	} catch {
		return null;
	}
	const path = pathname.slice(POSTHOG_PROXY_PATH.length) || "/";
	if (path.startsWith("/static/") || path.startsWith("/array/")) {
		target.hostname = target.hostname.replace(/^(us|eu)\.i\.posthog\.com$/, "$1-assets.i.posthog.com");
	}
	// 文字列の連結で URL を作らない（"//evil.example" のようなパスでホストが変わらないように）。
	target.pathname = path;
	target.search = url.search;
	return target;
}

/** リクエストを PostHog に転送する。サイトの Cookie は送らず、閲覧者の IP アドレスを伝える。 */
export async function proxyPostHogRequest(request: Request, target: URL): Promise<Response> {
	const headers = new Headers(request.headers);
	headers.delete("cookie");
	headers.delete("host");
	// PostHog は地域の推定と Cookie を使わない計測の識別に IP アドレスを使う。無いとプロキシの IP になる。
	const ip = request.headers.get("CF-Connecting-IP");
	if (ip) headers.set("X-Forwarded-For", ip);
	else headers.delete("X-Forwarded-For");
	const hasBody = request.method !== "GET" && request.method !== "HEAD";
	return fetch(target, {
		method: request.method,
		headers,
		// イベントは小さいので読み切って送る（ストリームのまま送るより実行環境の差が出ない）
		body: hasBody ? await request.arrayBuffer() : null,
		redirect: "manual",
	});
}

/** API ホストから PostHog の管理画面のホストを返す（ツールバーなどのリンク用）。Cloud 以外は null。 */
export function getPostHogUiHost(apiHost: string): string | null {
	try {
		const { hostname } = new URL(apiHost);
		const region = /^(us|eu)(?:-assets)?\.i\.posthog\.com$/.exec(hostname)?.[1];
		return region ? `https://${region}.posthog.com` : null;
	} catch {
		return null;
	}
}
