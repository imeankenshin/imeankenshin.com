import { getRequestContext } from "emdash";

/**
 * 編集者向けの描画（下書きのプレビュー、ビジュアル編集）かどうか。下書きの内容が出る可能性がある。
 * - `_preview` / `_edit`: src/middleware.ts と同じ判定。無効なプレビュートークンでも true
 * - `editMode`: emdash-edit-mode Cookie で編集モードに入った編集者。URL にクエリが付かない
 * どれも EmDash がルートキャッシュの対象から外す（private, no-store）ので、
 * この判定で HTML を変えても、一般の閲覧者に返るキャッシュには影響しない。
 */
export function isEditorView(url: URL): boolean {
	if (url.searchParams.has("_preview") || url.searchParams.has("_edit")) return true;
	const context = getRequestContext();
	return Boolean(context?.editMode || context?.preview);
}
