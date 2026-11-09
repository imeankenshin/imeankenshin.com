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

### 公開先

- サイト: https://imeankenshin.com （`wrangler.jsonc` の `routes` で Worker の独自ドメインに設定）
- 管理画面: https://imeankenshin.com/_emdash/admin/
- 本番の `workers_dev` とバージョン URL は無効。PR は独立した Worker として
  `https://imeankenshin-com-pr-<番号>.omurakenshin.workers.dev` に公開する。
- PR プレビューでは管理画面・認証・更新 API を遮断し、`X-Robots-Tag: noindex, nofollow` を付ける。

### 初回デプロイ（実施済み。作り直すときの手順）

デプロイ直後の管理画面は「最初に開いた人が管理者になれる」セットアップ画面なので、
1〜4 は間を空けずに行う。

1. `pnpm deploy`
2. 暗号鍵を生成して控え（パスワードマネージャー）、`cf` で登録
   ```bash
   npx emdash secrets generate
   EMDASH_ENCRYPTION_KEY='生成した値' pnpm cf:secrets
   ```
3. https://imeankenshin.com/_emdash/admin/ でセットアップ（パスキー登録）
4. 管理画面で編集 → 公開し、公開ページに反映されることを確認

### 2 回目以降

```bash
pnpm deploy
```

公開HTMLは Workers Cache で配信する（5分後からバックグラウンドで再生成、
stale 応答は最大1日）。記事・設定・メニュー・タクソノミーの変更時は EmDash が
タグでキャッシュを削除する。プレビュー・編集URL・管理画面・エラー応答は保存しない。
デプロイごとにキャッシュは新しくなるため、最初のアクセスは SSR になる。
追跡パラメータ（`utm_*`、`fbclid`、`gclid`など）付きURLは、通常URLとキャッシュを共有しない。
これらが訪問ごとに異なる場合も MISS になるため、パラメータなしURLのHIT計測値は当てはまらない。

```bash
pnpm perf                            # 公開トップを10回計測、p95 <= 500ms を判定
pnpm perf https://imeankenshin.com/posts
# ビルドを wrangler dev で起動した後（astro dev ではキャッシュされない）
pnpm cache:check http://localhost:8787
```

計測結果・残る初回応答の制約・構成の選択肢は [速度調査](docs/performance/README.md) を参照。

スキーマ（コレクションやフィールド）を変えるときは [Evolving a Deployed Site](https://docs.emdashcms.com/deployment/schema-evolution/) を参照。

### GitHub Actions による自動デプロイ

| イベント | 動作 |
|---|---|
| 同じリポジトリの PR 作成・更新・再オープン | 型チェック・ビルド後、`imeankenshin-com-pr-<番号>` Worker を作成・更新し、PR コメントに URL を掲載 |
| PR クローズ（マージを含む） | 該当 PR の Worker を削除 |
| `main` への push（PR マージを含む） | 型チェック・ビルド後、`https://imeankenshin.com` に本番デプロイ |
| Actions の `Deploy production` → Run workflow（`main`） | 本番へ手動再デプロイ |

ワークフローは `.github/workflows/preview.yml` と `deploy.yml`。
本番・PR ごとの実行を直列化し、デプロイ途中のキャンセルや公開と削除の競合を避ける。
fork と Dependabot の PR は Secrets を利用できないため、プレビューの対象外。
`pull_request_target` で PR のコードを実行しない。

#### 認証設定（初回のみ）

GitHub リポジトリの **Settings → Secrets and variables → Actions** に以下を登録する。

| 種類 | 名前 | 値 |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare のデプロイ用 API Token（登録済み） |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | `20bd7cf00ed4b81a10356ab97c27b6e0`（登録済み） |

Token は対象アカウントと `imeankenshin.com` ゾーンに限定する。
Cloudflare の **Edit Cloudflare Workers** テンプレートを基に、Workers Scripts・
Workers Routes・KV・R2 の権限と Account Settings / Zone の読み取りを含める。
ローカルの Wrangler OAuth Token は期限があるため、CI に転用しない。
本番の `EMDASH_ENCRYPTION_KEY` は既存 Worker の Secret として維持され、GitHub にコピーする必要はない。

ワークフローを `main` に反映した後、新しい PR または既存 PR の更新で自動実行される。
GitHub Environments の `production` / `preview` に必須承認を設定すると、その承認までジョブは待機する。
ただし現在は本番・プレビューでリポジトリ Secret の同じ API Token を共有している。
同じリポジトリに PR ブランチを push できる人は、PR 内のコードや設定を変更して本番デプロイ権限も使えるため、
信頼できる管理者に限定する。`production` の必須承認だけでは、この権限を分離できない。
権限の分離が必要になったら、Environment ごとに Token を分け、プレビュー用の Cloudflare アカウントも分離する。

Astro の Cloudflare アダプタはビルド時に環境を選択するため、プレビューは
`CLOUDFLARE_ENV=preview pnpm build` で作成する。その後の Wrangler は生成された
`dist/server/wrangler.json` を使う。`--env preview` をデプロイ時だけに指定しない。
PR ごとの Worker 名は `wrangler deploy --name imeankenshin-com-pr-<番号>` で指定する。

#### プレビューのデータ

- Neon ブランチ `preview`（`br-lingering-wind-a1tcw2eo`）は本番から作成した独立したコピー。
  Hyperdrive `imeankenshin-com-preview-db` はこのブランチを参照する。
- R2 は `imeankenshin-media-preview`、KV は `imeankenshin-com-preview-session` を使う。
- 各 PR のコードと URL は独立する。DB・R2・KV はプレビュー間で共有し、本番からは分離する。
  プレビュー削除時もこれらの共有リソースは残す。
- DB は作成時点のコピーで、本番の編集や新しいメディアは自動同期しない。
  本番の R2 メディアも自動コピーしない。
- プレビューでは本番の Cron Trigger は実行されない。
- URL は公開される。閲覧者を限定する場合は、プレビュー Worker に
  [Cloudflare Access](https://developers.cloudflare.com/workers/configuration/access/) を設定する。

仕組みは [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)
と [GitHub Actions からのデプロイ](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) を参照。

## 代替: Vercel

同じ Postgres と R2 のデータをそのまま使える。変更点:

- アダプタを `@astrojs/vercel` に変更
- `database: postgres({ connectionString: process.env.DATABASE_URL })`（`emdash/db`）
- `storage: s3()` で R2 の S3 API を使う（`S3_*` 環境変数、`@aws-sdk/client-s3` と `@aws-sdk/s3-request-presigner` が必要）
- 予約公開用の Cron は別途用意する必要がある
