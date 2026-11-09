/** プレビューの公開ページ・公開読み取り API だけを許可する。 */
export function isPublicPreviewRequest(request: Request): boolean {
	if (request.method !== "GET" && request.method !== "HEAD") return false;

	const url = new URL(request.url);
	let path = url.pathname;
	// Astro が再デコードしてからルーティングするパスも、同じ保護対象として扱う。
	for (let iteration = 0; ; iteration++) {
		let decoded: string;
		try {
			decoded = decodeURIComponent(path);
		} catch {
			if (iteration === 0) return false;
			// 一度デコードされたリテラルの % は、Astro と同様ここで止める。
			break;
		}
		if (decoded === path) break;
		if (iteration >= 10) return false;
		path = decoded;
	}
	// URL の再解析でドットセグメント・バックスラッシュも正規化する。
	url.pathname = path.replaceAll("\\", "/");
	path = url.pathname.replace(/\/{2,}/g, "/");
	const internal = path === "/_emdash" || path.startsWith("/_emdash/");
	return !internal || path.startsWith("/_emdash/api/media/file/") || path === "/_emdash/api/search";
}
