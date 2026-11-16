// Cookie の同意 UI（CookieConsent.astro のバナーと /privacy の設定欄）を PostHog の同意状態とつなぐ。
// 公開 HTML はエッジでキャッシュされるので、表示の切り替えはすべてクライアントで行う。
import { CONSENT_STATUS_LABELS, parseConsentChoice, type ConsentStatus } from "../utils/consent";

interface PostHogConsentApi {
	get_explicit_consent_status(): ConsentStatus;
	opt_in_capturing(): void;
	opt_out_capturing(): void;
}

declare global {
	interface Window {
		/**
		 * posthog.astro の loaded コールバックが入れる SDK 本体。
		 * loaded の時点では window.posthog がまだスタブのことがあるので、こちらを使う
		 */
		__posthogInstance?: PostHogConsentApi;
	}
}

// スニペットのスタブには get_explicit_consent_status が無いので、SDK 本体の読み込みを待つ。
// 広告ブロッカーなどで読み込まれなければ、計測もされないのでバナーも出さない。
function onPostHogLoaded(callback: (posthog: PostHogConsentApi) => void) {
	const run = () => {
		if (window.__posthogInstance) callback(window.__posthogInstance);
	};
	if (window.__posthogInstance) run();
	else window.addEventListener("posthog:loaded", run, { once: true });
}

onPostHogLoaded((posthog) => {
	const render = () => {
		const status = posthog.get_explicit_consent_status();
		for (const banner of document.querySelectorAll<HTMLElement>("[data-consent-banner]")) {
			banner.hidden = status !== "pending";
		}
		for (const loading of document.querySelectorAll<HTMLElement>("[data-consent-loading]")) {
			loading.hidden = true;
		}
		for (const settings of document.querySelectorAll<HTMLElement>("[data-consent-settings]")) {
			settings.hidden = false;
			for (const label of settings.querySelectorAll<HTMLElement>("[data-consent-status]")) {
				label.textContent = CONSENT_STATUS_LABELS[status];
			}
			for (const button of settings.querySelectorAll<HTMLButtonElement>("[data-consent-choice]")) {
				button.setAttribute("aria-pressed", String(button.dataset.consentChoice === status));
			}
		}
	};

	document.addEventListener("click", (event) => {
		const button =
			event.target instanceof Element
				? event.target.closest<HTMLButtonElement>("button[data-consent-choice]")
				: null;
		const choice = parseConsentChoice(button?.dataset.consentChoice);
		if (!choice) return;
		if (choice === "granted") posthog.opt_in_capturing();
		else posthog.opt_out_capturing();
		render();
	});
	// 別タブでの選択（同意状態は localStorage に保存される）にも表示を合わせる
	window.addEventListener("storage", render);
	render();
});
