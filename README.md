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

### 初回だけ

1. **Postgres を用意する**（Neon / Supabase / PlanetScale Postgres など）。EmDash 用ロールに
   `CONNECT`、スキーマへの `USAGE, CREATE` を付ける（[要件](https://docs.emdashcms.com/deployment/database/#database-role-requirements)）。
   有効期限付きロールは使わない（テーブル所有者が変わると移行が失敗する）。
2. **R2 を有効化する**: Cloudflare ダッシュボードで R2 を一度有効にする（API からは有効化できない）。
3. **リソース作成（`cf`）**
   ```bash
   pnpm cf:whoami
   pnpm cf:r2:create
   DATABASE_URL='postgres://USER:PASSWORD@HOST:5432/DB' pnpm cf:hyperdrive:create
   ```
   Hyperdrive はクエリキャッシュ無効で作成され、ID が `wrangler.jsonc` に書き込まれる。
4. **DB の近くで Worker を動かす**: `wrangler.jsonc` の `placement.region` を DB のリージョン（例 `aws:ap-northeast-1`）に合わせて有効化する。
5. **デプロイ**
   ```bash
   pnpm wrangler login   # Wrangler 用の認証（cf のログインとは別）
   pnpm deploy
   ```
6. **暗号鍵を登録（`cf`）**: 本番用に新しく生成して、必ずパスワードマネージャーに控える。
   ```bash
   npx emdash secrets generate
   EMDASH_ENCRYPTION_KEY='生成した値' pnpm cf:secrets
   ```
7. **本番のドメインで**管理画面のセットアップを行う。パスキーはセットアップしたドメインに紐づくため、独自ドメインを使うなら先に `wrangler.jsonc` の `routes` を設定して再デプロイしてから行う。

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
