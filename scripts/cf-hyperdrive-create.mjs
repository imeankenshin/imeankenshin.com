#!/usr/bin/env node
// Cloudflare CLI (cf) で Hyperdrive 設定を作成し、wrangler.jsonc に ID を書き込む。
//
//   DATABASE_URL='postgres://user:pass@host:5432/db' pnpm cf:hyperdrive:create
//   （--dry-run を付けると送信内容を確認するだけ。パスワードは伏せて表示される）
//
// - EmDash は read-after-write 整合性に依存するため、クエリキャッシュは無効で作成する
//   （https://docs.emdashcms.com/deployment/database/#hyperdrive）
// - Neon では pooled ではない直接接続の URL を渡す（プールは Hyperdrive が担う）
// - 接続情報は引数ではなく一時ファイル経由で cf に渡す（scripts/lib/cf.mjs）
import { readFileSync, writeFileSync } from "node:fs";
import { cfWithBody, exitWithError } from "./lib/cf.mjs";

const NAME = process.env.HYPERDRIVE_NAME ?? "imeankenshin-com-db";
const PLACEHOLDER = "REPLACE_WITH_HYPERDRIVE_ID";

try {
	const raw = process.env.DATABASE_URL;
	if (!raw) throw new Error("DATABASE_URL を指定してください（postgres://user:pass@host:5432/db）");

	let url;
	try {
		url = new URL(raw);
	} catch {
		throw new Error("DATABASE_URL を URL として解釈できませんでした");
	}
	if (!/^postgres(ql)?:$/.test(url.protocol)) {
		throw new Error(`postgres:// の URL を指定してください（受け取ったスキーム: ${url.protocol}）`);
	}

	const body = {
		name: NAME,
		origin: {
			scheme: "postgres",
			host: url.hostname,
			port: Number(url.port || 5432),
			database: decodeURIComponent(url.pathname.slice(1)) || "postgres",
			user: decodeURIComponent(url.username),
			password: decodeURIComponent(url.password),
		},
		caching: { disabled: true },
	};

	const dryRun = process.argv.includes("--dry-run");
	const out = cfWithBody(["hyperdrive", "create", ...(dryRun ? ["--dry-run"] : [])], body);
	if (dryRun) {
		console.log(out);
		process.exit(0);
	}

	const id = out.match(/"id"\s*:\s*"([0-9a-f]{32})"/)?.[1];
	if (!id) throw new Error("cf の出力から Hyperdrive ID を読み取れませんでした");

	const path = new URL("../wrangler.jsonc", import.meta.url);
	const config = readFileSync(path, "utf8");
	if (config.includes(PLACEHOLDER)) {
		writeFileSync(path, config.replace(PLACEHOLDER, id));
		console.log(`Hyperdrive "${NAME}" を作成し、wrangler.jsonc に ID ${id} を書き込みました。`);
	} else {
		console.log(
			`Hyperdrive "${NAME}" を作成しました（ID: ${id}）。\n` +
				"wrangler.jsonc には別の ID が設定済みのため変更していません。使う場合は hyperdrive[0].id を書き換えてください。",
		);
	}
} catch (error) {
	exitWithError(error);
}
