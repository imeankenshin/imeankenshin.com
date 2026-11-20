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
	if (pathname !== POSTHOG_PROXY_PATH && !pathname.startsWith(`${POSTHOG_PROXY_PATH}/`))
		return null;

	let target: URL;
	try {
		target = new URL(apiHost);
	} catch {
		return null;
	}
	const path = pathname.slice(POSTHOG_PROXY_PATH.length) || "/";
	if (path.startsWith("/static/") || path.startsWith("/array/")) {
		target.hostname = target.hostname.replace(
			/^(us|eu)\.i\.posthog\.com$/,
			"$1-assets.i.posthog.com",
		);
	}
	// 文字列の連結で URL 全体を作らない（"//evil.example" のようなパスでホストが変わらないように）。
	// PUBLIC_POSTHOG_HOST にパスがある（自前のプロキシなど）ときは、その下に付ける。
	target.pathname = target.pathname.replace(/\/+$/, "") + path;
	target.search = url.search;
	return target;
}

/**
 * PostHog に渡すリクエストヘッダー。SDK の通信に要るものだけを送り、Cookie・Authorization・
 * Cloudflare Access のトークンなど、このサイト向けの認証情報は渡さない。
 */
const FORWARDED_HEADERS = [
	"accept",
	"accept-language",
	"content-encoding",
	"content-type",
	"if-modified-since",
	"if-none-match",
	// Referer は送らない。同じドメインへのリクエストなのでページのパスとクエリまで入っており、
	// PostHog のドメインから直接読み込んでいたとき（オリジンだけ）より多くを渡してしまう。
	"origin",
	// Cookie を使わない計測は IP アドレスと User-Agent から閲覧者を区別する
	"user-agent",
];

/**
 * リクエストを PostHog に転送する。閲覧者の IP アドレスは X-Forwarded-For で伝える。
 * 返ってきた Set-Cookie は捨てる。同じドメインで返すので、そのままだとこのサイトの Cookie として保存され、
 * Cookie を拒否した閲覧者にも付いてしまう（/privacy の説明と食い違う）。
 */
export async function proxyPostHogRequest(request: Request, target: URL): Promise<Response> {
	const headers = new Headers();
	for (const name of FORWARDED_HEADERS) {
		const value = request.headers.get(name);
		if (value !== null) headers.set(name, value);
	}
	// PostHog は地域の推定と Cookie を使わない計測の識別に IP アドレスを使う。無いとプロキシの IP になる。
	// クライアントが送る X-Forwarded-For は偽装できるので使わない。
	const ip = request.headers.get("CF-Connecting-IP");
	if (ip) headers.set("X-Forwarded-For", ip);
	// 本文は読み切らずにストリームのまま送る（大きな送信で Worker のメモリを使い切らないように）。
	// duplex は Node（テスト）で必要。workers の型には無いので、リテラルではなく変数で渡す。
	const init: RequestInit & { duplex?: "half" } = {
		method: request.method,
		headers,
		body: request.body,
		redirect: "manual",
	};
	if (request.body) init.duplex = "half";
	const upstream = await fetch(target, init);
	if (!upstream.headers.has("set-cookie")) return upstream;
	// fetch のレスポンスのヘッダーは変更できないことがあるので、作り直してから消す
	const response = new Response(upstream.body, upstream);
	response.headers.delete("set-cookie");
	return response;
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
