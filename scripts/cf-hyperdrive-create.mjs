#!/usr/bin/env node
// Cloudflare CLI (cf) で Hyperdrive 設定を作成し、wrangler.jsonc に ID を書き込む。
//
//   DATABASE_URL='postgres://user:pass@host:5432/db' pnpm cf:hyperdrive:create
//
// - EmDash は read-after-write 整合性に依存するため、クエリキャッシュは無効で作成する
//   （https://docs.emdashcms.com/deployment/database/#hyperdrive）
// - 接続文字列はログに出さない。cf の出力でもパスワードは伏せられる
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const NAME = process.env.HYPERDRIVE_NAME ?? "imeankenshin-com-db";
const raw = process.env.DATABASE_URL;
if (!raw) {
	console.error("DATABASE_URL を指定してください（postgres://user:pass@host:5432/db）");
	process.exit(1);
}

const url = new URL(raw);
if (!/^postgres(ql)?:$/.test(url.protocol)) {
	console.error(`postgres:// の URL を指定してください（受け取ったスキーム: ${url.protocol}）`);
	process.exit(1);
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
const args = ["hyperdrive", "create", "--body", JSON.stringify(body)];
if (dryRun) args.push("--dry-run");

const out = execFileSync("cf", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
if (dryRun) {
	console.log(out);
	process.exit(0);
}

const id = out.match(/"id"\s*:\s*"([0-9a-f]{32})"/)?.[1];
if (!id) {
	console.error("cf の出力から Hyperdrive ID を読み取れませんでした:\n" + out);
	process.exit(1);
}

const path = new URL("../wrangler.jsonc", import.meta.url);
const config = readFileSync(path, "utf8");
if (!config.includes("REPLACE_WITH_HYPERDRIVE_ID")) {
	console.log(`作成した Hyperdrive ID: ${id}\nwrangler.jsonc は既に ID 設定済みのため変更していません。`);
} else {
	writeFileSync(path, config.replace("REPLACE_WITH_HYPERDRIVE_ID", id));
	console.log(`Hyperdrive "${NAME}" を作成し、wrangler.jsonc に ID ${id} を書き込みました。`);
}
