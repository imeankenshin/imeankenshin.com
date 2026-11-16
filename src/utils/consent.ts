/** posthog.get_explicit_consent_status() の戻り値 */
export type ConsentStatus = "granted" | "denied" | "pending";
export type ConsentChoice = Exclude<ConsentStatus, "pending">;

/** プライバシーポリシーの「現在の設定」に出す文言 */
export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
	granted: "同意済み（Cookie を使った計測とセッションリプレイが有効）",
	denied: "拒否（Cookie を使わない計測のみ）",
	pending: "未選択（Cookie を使わない計測のみ）",
};

/** ボタンの data-consent-choice を検証する。想定外の値は null */
export function parseConsentChoice(value: string | null | undefined): ConsentChoice | null {
	return value === "granted" || value === "denied" ? value : null;
}
