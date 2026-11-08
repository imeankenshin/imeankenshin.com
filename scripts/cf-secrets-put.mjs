#!/usr/bin/env node
// 本番 Worker に EMDASH_ENCRYPTION_KEY を Cloudflare CLI (cf) で登録する。
//
//   EMDASH_ENCRYPTION_KEY='...' pnpm cf:secrets
//
// 鍵は `npx emdash secrets generate` で生成し、パスワードマネージャー等に必ず控えること。
// 失うとプラグインの保存済みシークレットを復号できなくなる。
// Worker が存在している必要があるため、初回 `pnpm deploy` の後に実行する。
import { execFileSync } from "node:child_process";

const WORKER = process.env.WORKER_NAME ?? "imeankenshin-com";
const key = process.env.EMDASH_ENCRYPTION_KEY;
if (!key) {
	console.error("EMDASH_ENCRYPTION_KEY を指定してください（npx emdash secrets generate で生成）");
	process.exit(1);
}

execFileSync(
	"cf",
	["workers", "secrets", "update", "EMDASH_ENCRYPTION_KEY", "--worker", WORKER, "--type", "secret_text", "--text", key],
	{ stdio: ["ignore", "ignore", "inherit"] },
);
console.log(`Worker "${WORKER}" に EMDASH_ENCRYPTION_KEY を登録しました。`);
