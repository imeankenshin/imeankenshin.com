# imeankenshin.com

Kenshin の個人サイト＋ブログ。[EmDash](https://docs.emdashcms.com/)（Astro ベースの CMS）製で、トップの自己紹介・リンク集・ブログ記事・About を管理画面から編集できる。

## 構成

| | 本番 | ローカル開発 |
|---|---|---|
| ランタイム | Cloudflare Workers（`@astrojs/cloudflare`） | 同じ Worker ランタイム（`astro dev`） |
| DB | PostgreSQL（任意のプロバイダ）← Hyperdrive 経由 | Docker の PostgreSQL 17（`compose.yaml`） |
| メディア | R2（`MEDIA` バインディング） | ローカル R2 シミュレーション |
| 予約公開など | Cron Trigger（毎分）→ `src/worker.ts` | dev サーバーのタイマー |

## ローカル開発

前提: Node.js 22.23.4+、pnpm 11（`packageManager` で固定）、Docker。

```bash
pnpm install
pnpm dev          # Postgres コンテナを起動してから astro dev
```

- サイト: http://localhost:4321/
- 管理画面: http://localhost:4321/_emdash/admin/ （初回はセットアップ画面。「Include sample content」を残すと初期コンテンツが入る）
- DB を止める: `pnpm db:down`（データは Docker ボリュームに残る）

## デプロイ（Cloudflare）

ビルドとデプロイは **Wrangler**、アカウント・リソース操作は **Cloudflare CLI（`cf`）** を使う。
`cf` は beta 中 Astro 6 以降のビルドに対応していない（`cf build` は Astro のビルド後に
`.cloudflare/output/v0/config.json` が無いため失敗する）。対応したら `cf migrate` で
`cloudflare.config.ts` へ移行できる。

### 作成済みのリソース

| リソース | 名前 / ID | 作成方法 |
|---|---|---|
| Neon プロジェクト | `imeankenshin.com`（`young-scene-04976765`, aws-ap-southeast-1, PG 18） | 既存 |
| Neon ロール / DB | `emdash` / `emdash`（ブランチ `production`、DB 所有者 = `emdash`） | `neon roles create` / `neon databases create` |
| Hyperdrive | `imeankenshin-com-db`（`e3208792…`、キャッシュ無効、Neon の直接接続） | `pnpm cf:hyperdrive:create`（`cf`） |
| R2 バケット | `imeankenshin-media`（APAC） | `pnpm cf:r2:create`（`cf`） |
| KV（Astro セッション） | `imeankenshin-com-session` | `cf kv namespaces create` |
| Worker 配置 | `placement.region = aws:ap-southeast-1`（Neon の近く） | `wrangler.jsonc` |

Hyperdrive を作り直すときは、Neon の直接接続（pooled ではない）URL を渡す:

```bash
DATABASE_URL="$(neon connection-string production --project-id young-scene-04976765 \
  --role-name emdash --database-name emdash)" pnpm cf:hyperdrive:create
```

### 初回デプロイ（1回だけ、続けて行う）

デプロイ直後の管理画面は「最初に開いた人が管理者になれる」セットアップ画面なので、
1〜4 は間を空けずに行う。

1. `pnpm deploy` — 出力される `https://imeankenshin-com.<サブドメイン>.workers.dev` を控える
2. 暗号鍵を生成して控え（パスワードマネージャー）、`cf` で登録
   ```bash
   npx emdash secrets generate
   EMDASH_ENCRYPTION_KEY='生成した値' pnpm cf:secrets
   ```
3. `https://…workers.dev/_emdash/admin/` でセットアップ（パスキー登録）
4. 管理画面で編集 → 公開し、公開ページに反映されることを確認

パスキーはセットアップしたドメインに紐づく。独自ドメインを先に使いたい場合は、
ドメインを Cloudflare に追加し `wrangler.jsonc` の `routes` を設定してから 1 を行う。

### 2 回目以降

```bash
pnpm deploy
```

スキーマ（コレクションやフィールド）を変えるときは [Evolving a Deployed Site](https://docs.emdashcms.com/deployment/schema-evolution/) を参照。

## 代替: Vercel

同じ Postgres と R2 のデータをそのまま使える。変更点:

- アダプタを `@astrojs/vercel` に変更
- `database: postgres({ connectionString: process.env.DATABASE_URL })`（`emdash/db`）
- `storage: s3()` で R2 の S3 API を使う（`S3_*` 環境変数、`@aws-sdk/client-s3` と `@aws-sdk/s3-request-presigner` が必要）
- 予約公開用の Cron は別途用意する必要がある
