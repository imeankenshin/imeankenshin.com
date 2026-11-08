#!/usr/bin/env node
// 本番 Worker に EMDASH_ENCRYPTION_KEY を Cloudflare CLI (cf) で登録する。
//
//   EMDASH_ENCRYPTION_KEY='...' pnpm cf:secrets
//
// 鍵は `npx emdash secrets generate` で生成し、パスワードマネージャー等に必ず控えること。
// 失うとプラグインの保存済みシークレットを復号できなくなる。
// Worker が存在している必要があるため、初回 `pnpm deploy` の後に実行する。
// 鍵は引数ではなく一時ファイル経由で cf に渡す（scripts/lib/cf.mjs）。
import { cfWithBody, exitWithError } from "./lib/cf.mjs";

const WORKER = process.env.WORKER_NAME ?? "imeankenshin-com";
const NAME = "EMDASH_ENCRYPTION_KEY";

try {
	const key = process.env[NAME];
	if (!key) throw new Error(`${NAME} を指定してください（npx emdash secrets generate で生成）`);

	const dryRun = process.argv.includes("--dry-run");
	const out = cfWithBody(
		["workers", "secrets", "update", NAME, "--worker", WORKER, ...(dryRun ? ["--dry-run"] : [])],
		{ name: NAME, type: "secret_text", text: key },
	);
	console.log(dryRun ? out : `Worker "${WORKER}" に ${NAME} を登録しました。`);
} catch (error) {
	exitWithError(error);
}
