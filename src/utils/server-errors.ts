// Worker の SSR で起きた例外（src/middleware.ts が受け取る）を PostHog の Error tracking に送る。
// ブラウザ側の例外は posthog.astro の capture_exceptions が拾う。
// posthog-node は workerd 向けの edge ビルドが選ばれる（package.json の exports）。
import { PostHog } from "posthog-node";
import { posthogConfig } from "./analytics";

const MISSING_CONFIG_WARNING =
	"PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once PUBLIC_POSTHOG_PROJECT_TOKEN is configured";

let client: PostHog | undefined;
let warnedMissingConfig = false;

function getClient(): PostHog | undefined {
	if (!posthogConfig) {
		// 本番（PR プレビューを含む）は計測しない設定なので何もしない。開発中だけ知らせる
		if (import.meta.env.DEV && !warnedMissingConfig) {
			warnedMissingConfig = true;
			console.warn(MISSING_CONFIG_WARNING);
		}
		return undefined;
	}
	// リクエストをまたいで使い回す。Worker は処理が終わると止まるので、溜めずにすぐ送る
	client ??= new PostHog(posthogConfig.apiKey, {
		host: posthogConfig.apiHost,
		flushAt: 1,
		flushInterval: 0,
	});
	return client;
}

interface CaptureOptions {
	/** リクエストの URL。クエリ（プレビューのトークンなど）は送らない */
	url?: URL;
	/** レスポンスを返したあとも送信を続けるための ExecutionContext.waitUntil */
	waitUntil?: (promise: Promise<unknown>) => void;
}

/**
 * 例外を送る。送信の失敗や遅れで本来の処理（500 ページの表示など）を止めないよう、
 * 送信は waitUntil に任せ、エラーは握りつぶす。
 * 閲覧者は識別しない（distinct_id を渡さないので、人物プロフィールも作られない）。
 */
export function captureServerException(error: unknown, { url, waitUntil }: CaptureOptions): void {
	const posthog = getClient();
	if (!posthog) return;
	const sending = posthog
		.captureExceptionImmediate(error, undefined, {
			source: "ssr",
			$current_url: url ? `${url.origin}${url.pathname}` : undefined,
			environment: import.meta.env.DEV ? "development" : "production",
		})
		.catch(() => {});
	waitUntil?.(sending);
}
