// Cloudflare CLI (cf) を、秘密情報をコマンドライン引数に載せずに呼び出すためのヘルパー。
//
// リクエスト本文は所有者のみ読める一時ファイルに書き、`--body @<path>` で渡す。
// 引数に秘密情報が含まれないため、ps などのプロセス一覧にも、execFileSync が
// 失敗時に投げるエラーメッセージ（実行コマンドを含む）にも漏れない。
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * @param {string[]} args `cf` に渡す引数（秘密情報を含めないこと）
 * @param {unknown} body JSON にして `--body @file` で渡すリクエスト本文
 * @returns {string} cf の標準出力
 */
export function cfWithBody(args, body) {
	const dir = mkdtempSync(join(tmpdir(), "cf-body-"));
	const file = join(dir, "body.json");
	try {
		writeFileSync(file, JSON.stringify(body), { mode: 0o600 });
		return execFileSync("cf", [...args, "--body", `@${file}`], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "inherit"],
		});
	} catch (error) {
		// error.message には実行コマンドが入るが、秘密情報は一時ファイル側にしかない
		const status = /** @type {{ status?: number }} */ (error).status;
		throw new Error(`cf ${args.slice(0, 3).join(" ")} が失敗しました（終了コード ${status ?? "不明"}）`);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

/** エラーを短く表示して終了する（スタックトレースや引数を出さない） */
export function exitWithError(error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
