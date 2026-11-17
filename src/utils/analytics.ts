/**
 * PostHog の公開設定。PUBLIC_* はビルド時に埋め込まれる。
 * どちらかが無いビルド（PR プレビューなど）は計測も同意バナーも出さない。
 */
const apiKey = import.meta.env.PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = import.meta.env.PUBLIC_POSTHOG_HOST;

export const posthogConfig: { apiKey: string; apiHost: string } | null =
	apiKey && apiHost ? { apiKey, apiHost } : null;
