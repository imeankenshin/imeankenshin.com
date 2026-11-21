/**
 * Cloudflare Web Analytics のサイトトークン（公開値）。PUBLIC_* はビルド時に埋め込まれる。
 * 無いビルド（PR プレビュー）と開発サーバーは計測しない（開発中の閲覧を本番のデータに混ぜない）。
 */
const token = import.meta.env.PUBLIC_CF_WEB_ANALYTICS_TOKEN;

export const webAnalyticsToken: string | null = import.meta.env.PROD && token ? token : null;
