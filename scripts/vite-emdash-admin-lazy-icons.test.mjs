import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	rewriteAdminIconImport,
	viteEmdashAdminLazyIcons,
} from "./vite-emdash-admin-lazy-icons.mjs";

test("the dynamic Phosphor import points at the virtual module", () => {
	const code = 'const c = (await import("@phosphor-icons/react"))[name];';
	const rewritten = rewriteAdminIconImport(code);
	assert.equal(rewritten, 'const c = (await import("virtual:phosphor-lazy"))[name];');
	// transform は map: null を返すので、列がずれないよう長さを変えない
	assert.equal(rewritten.length, code.length);
});

test("static Phosphor imports stay as they are", () => {
	assert.equal(rewriteAdminIconImport('import { Plus } from "@phosphor-icons/react";'), null);
});

test("the plugin transforms the installed @emdash-cms/admin entry", () => {
	// pnpm は @emdash-cms/admin を emdash の依存としてだけ置くので、emdash の位置から解決する
	const emdash = realpathSync(fileURLToPath(new URL("../node_modules/emdash", import.meta.url)));
	const admin = createRequire(`${emdash}/package.json`).resolve("@emdash-cms/admin");
	const stale =
		"EmDash の更新で回避策が効かなくなった可能性があります。scripts/vite-emdash-admin-lazy-icons.mjs を見直してください";
	// Vite のモジュール ID は実パスを / 区切りにしたもの
	const id = realpathSync(admin).replaceAll("\\", "/");
	assert.match(id, viteEmdashAdminLazyIcons().transform.filter.id, stale);
	assert.notEqual(rewriteAdminIconImport(readFileSync(admin, "utf8")), null, stale);
});
