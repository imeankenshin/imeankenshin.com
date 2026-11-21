// EmDash の管理画面（@emdash-cms/admin、1.4.0〜1.5.0 で確認）の resolveNavIcon() は、コレクションや
// プラグインが指定したアイコン名を `(await import("@phosphor-icons/react"))[name]` で解決する。
// 珍しいアイコンを別チャンクに分けるつもりのコードだが、同じパッケージを静的にも import しているので
// 分割されず、Phosphor の全アイコン（CSR 版と SSR 版の約 3,000 コンポーネント、minify 後で約 4.8 MB）が
// 管理画面とインライン編集が最初に読み込む共通チャンクに入る（ビルド時の「500 kB を超えるチャンク」警告の主因）。
// 動的 import の先を `export *` だけの仮想モジュールに差し替えると、静的に使うアイコン以外は遅延チャンクに移る。
// 名前で解決するときの挙動は変わらない。

const ADMIN_ENTRY = /\/@emdash-cms\/admin\/dist\/index\.js$/;
const DYNAMIC_IMPORT = 'import("@phosphor-icons/react")';
// 置き換え元の "@phosphor-icons/react" と同じ文字数にする。置き換えても列がずれないので、
// transform が map: null を返しても元のソースマップのまま正しく対応する
const VIRTUAL_ID = "virtual:phosphor-lazy";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

/**
 * 管理画面のコードにある Phosphor の動的 import を仮想モジュールへの import に置き換える。
 * 対象がなければ null（EmDash の更新で不要になった可能性がある）。
 * @param {string} code
 * @returns {string | null}
 */
export function rewriteAdminIconImport(code) {
	if (!code.includes(DYNAMIC_IMPORT)) return null;
	return code.replaceAll(DYNAMIC_IMPORT, `import(${JSON.stringify(VIRTUAL_ID)})`);
}

/** @returns {import("vite").Plugin} */
export function viteEmdashAdminLazyIcons() {
	/** pnpm は Phosphor を管理画面のパッケージからしか解決できない場所に置くので、その位置から解決する */
	let adminId;

	return {
		name: "imeankenshin:emdash-admin-lazy-icons",
		// 開発サーバーは依存関係を事前バンドルするので対象外。チャンク分割はビルドだけの問題
		apply: "build",
		resolveId: {
			filter: { id: new RegExp(`^${VIRTUAL_ID}$`) },
			handler: () => RESOLVED_VIRTUAL_ID,
		},
		load: {
			filter: { id: new RegExp(`^\0${VIRTUAL_ID}$`) },
			async handler() {
				const resolved = await this.resolve("@phosphor-icons/react", adminId);
				if (!resolved) this.error("@phosphor-icons/react を @emdash-cms/admin から解決できません");
				return `export * from ${JSON.stringify(resolved.id)};`;
			},
		},
		transform: {
			filter: { id: ADMIN_ENTRY },
			handler(code, id) {
				adminId = id;
				const rewritten = rewriteAdminIconImport(code);
				if (rewritten === null) {
					this.warn(
						`${DYNAMIC_IMPORT} が見つかりません。EmDash の更新で不要になった可能性があるので、` +
							"scripts/vite-emdash-admin-lazy-icons.mjs を見直してください",
					);
					return;
				}
				return { code: rewritten, map: null };
			},
		},
	};
}
