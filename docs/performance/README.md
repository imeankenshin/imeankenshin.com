# 公開サイトの速度調査（2026-11-09）

## 結論

公開HTMLのキャッシュが未設定で、毎回 Singapore の Worker と CMS を経由していた。
Workers Cache を有効化し、匿名の公開ページは Worker の手前で配信するように変更した。
Cloudflare + Hyperdrive + PostgreSQL + R2 は維持。DBや記事の移行はしていない。

**キャッシュが空の初回アクセスは引き続き遅い。** デプロイ直後・公開直後の削除・
未訪問の配信拠点・キャッシュの退避などでは SSR が必要になる。
クエリ文字列もキャッシュキーに含まれるため、`utm_*`、`fbclid`、`gclid`などの追跡パラメータが
クリックごとに変わるSNS経由の訪問でもMISSになる。今回のHIT統計は追跡パラメータ付きURLを計測していない。
現状はキーの正規化を行っていない。導入する場合も、ページ送りの`cursor`、`_preview`、`_edit`は保持する必要がある。
「どの初回アクセスも必ず高速」という要件なら、下記の静的公開への分離を推奨する。

## 計測方法と根拠

同じマシンから `curl` でトップを10回 GET。クエリでキャッシュ回避はせず、
毎回別の接続で TTFB（HTMLの最初のバイトが届くまで）を測定した。
これはブラウザの LCP やページ全体の読み込み時間の計測ではない。
接続先の `cf-ray` は NRT、`cf-placement` は `remote-SIN`。
10サンプルの p95 は最大値と同じで、長期の性能保証ではない。

- 変更前: [before.jsonl](before.jsonl)。中央値309ms、p95 1,268ms。全てHTMLキャッシュのHIT表示なし。
- 最初のデプロイ後: [after-cold.jsonl](after-cold.jsonl)。最初はMISSで1,288ms、次のリクエストはHITで73ms。
- 最終デプロイ後のHIT 10回: [after.jsonl](after.jsonl)。中央値68ms、p95 97ms、全てHIT。
- 最終デプロイ後の初回MISS: [first-request.jsonl](first-request.jsonl)。1,225ms。この1回は上記のHIT統計に含めていない。

変更前と比べてHITの中央値は約78%、p95は約92%短縮した。
ただし初回MISSまで含めた最初の11回では、p95は1,225msとなる。
初回の改善まで達成したとは扱わない。
`/posts`、`/posts/hello-world`、`/about` も本番で200応答を確認しキャッシュを埋めたが、
初回MISSでは約1.12〜1.96秒かかった。

適用したWorkerバージョン: `a68741e1-6570-47ff-884f-f5c9c4953326`。

通常の応答例ではページ描画15〜25ms、DB時間合計32〜89ms。
遅い応答では `setup`、`rt` が現れ、CMS初期化で約188〜233ms、
初期化内のDB関連処理に約163〜191msを使っていた。
さらにネットワーク・Worker起動等の待ち時間がある。
Server-TimingのDB合計は並列クエリも含み、各時間を単純に足すことはできない。
キャッシュHITには保存時のServer-Timingが残るので、HIT時にDB処理が再実行されたとは解釈しない。

Neonの休止復帰、Workerコードの読み込み、配信経路それぞれの寄与率はこの計測だけでは断定できない。
「Neonだけが原因」「DBを変えれば解決」とする根拠は得られていない。

## 実装

- Astro標準の `cacheCloudflare()` を登録。生成されたWrangler設定の `cache.enabled = true` を確認。
- 公開6ルートに `maxAge: 300, swr: 86400`。5分後は既存HTMLを返しながら再生成でき、訪問の間隔が空いても最大1日はstaleを使える。
- コレクションと既存のクエリヒントで、記事・ページ・設定・メニュー・タクソノミーの更新時にキャッシュを削除。タグ一覧・記事詳細が表示するターム名にもタグを付与。
- サイトマップには専用ルールを設定し、posts/pages/設定の変更でキャッシュを削除する。robots.txtはDB障害時にも200で縮退応答するため保存しない。
- `toolbar: "client"` でキャッシュ済みページでも編集導線を表示。
- 描画完了後のミドルウェアで `_preview` / `_edit` と400以上の応答をキャッシュ対象外にする。ヘッダー変更前に応答を複製する。
- 管理用URLはEmDashの標準処理に任せ、メディアのブラウザキャッシュを保持する。`/_image` にはページ用のキャッシュ設定を適用しない。
- ブラウザへ長期間HTMLを固定する `Cache-Control: max-age` は追加しない。

無効な `_preview` トークンの応答は、標準処理だけでは `Cloudflare-CDN-Cache-Control: public` に戻るケースをローカルで再現した。
追加のミドルウェアにより `no-store` に固定し、本番で繰り返しても `BYPASS` になることを確認した。

通常の公開・編集ではEmDashがキャッシュを削除する。ただしpurgeにはレート制限があり、
失敗した場合は即時反映を保証できない。5分後のアクセスで再検証されるが、
再生成も失敗し続ける場合は最大24時間5分まで古いHTMLが残り得る。
削除の厳密な即時反映が必要なサイトでは、staleの期間を短くするか配信方式を見直す。

## 検証

```bash
pnpm build
pnpm perf
SAMPLES=20 MAX_P95_MS=500 pnpm perf https://imeankenshin.com/posts
# 別ターミナルでビルド済みサイトを wrangler dev で起動してから:
pnpm cache:check http://localhost:8787
```

ビルド成功。独立した一時PostgreSQLと `wrangler dev` で、公開6ルートの200応答・
TTL・タグを確認した。`check-cache.mjs` が自動検証する公開ページは `/` と `/posts` で、
記事詳細・固定ページ・カテゴリ・タグの各代表URLは初回調査時に手動で確認した。
スクリプトではサイトマップ類の必要タグの包含と、プレビュー・編集・管理画面・404の `no-store` も確認する。
ローカル専用の登録済みOAuthクライアント（redirect URI: `http://localhost/callback`）とR2メディアを用意した場合は、
`CACHE_CHECK_OAUTH_CLIENT_ID` と `CACHE_CHECK_MEDIA_KEY` を指定するとOAuthの302応答とメディアのキャッシュ方針・ETagによる304も検証する。
レビュー修正時にはこれらの一時データを用いて実際に検証した。メディアのブラウザキャッシュは保持される。
`CACHE_CHECK_IMAGE_SRC` にローカルR2上の画像URLを指定すると、`/_image` の200応答にページ用TTLと`pages`タグが付かず、画像自身のブラウザキャッシュ方針は保持されることも検証する。
画像の除外処理をビルド済みコードから一時的に外すとこの検証が失敗し、復元すると成功することも確認した。
`check-cache.mjs` はプレビューがキャッシュ可能になる不具合に対して失敗することも確認した。
ローカルではCDN自体のHITを証明できないため、HIT/BYPASSは本番でも確認した。
レビュー修正では、空コレクションのサイトマップが404で保存されないことと、公開記事・ページを入れたサイトマップに必要なタグが付くことも確認した。
管理画面から実際に記事を変更する検証は行っていない。公開時のpurgeはEmDash標準実装に依存する。

初回調査時の `pnpm typecheck` は既存の依存関係で `@astrojs/astro2tsx` のロードに失敗
（`@emnapi/core` 1.11.3 と `@emnapi/runtime` 2.0.0-beta.2 の組み合わせで
`this.bridge.setLastError is not a function`）。今回の変更では依存関係・lockfileは変更していない。
型チェック成功とは扱わない。

その後、mainのデプロイ自動化（#3）を取り込んだ際に、main側のWASMランタイムのoverrideと依存関係修正も統合した。
統合後の `pnpm typecheck` は18ファイルでエラー・警告ともに0件、`pnpm test` は4件成功した。

## 構成を見直す場合

| 案 | 期待できること | 制約・判断 |
| --- | --- | --- |
| 現構成 + HTMLキャッシュ（今回） | HITでCMS・DB・Singaporeへの処理往復を省略 | 変更が小さく、管理画面と即時公開を維持。まず実測を継続 |
| 公開面を静的HTMLとしてCMSから分離 | MISSでもCMS/DBの起動を待たず配信できる | 初回速度まで重視する場合の次候補。公開時の生成、削除、予約公開、プレビュー、検索を別途設計する必要がある |
| EmDash + D1へ移行 | Hyperdrive・外部PostgreSQLの構成を減らせる可能性 | データ移行と互換性の検証が必要。CMS起動コストは残るため、速度改善量は未検証 |
| 常時起動のNode + 同居DB | Workerの起動と外部DB接続のばらつきを減らせる可能性 | サーバー運用・バックアップが必要。公開HTMLのCDN配信は併用したい |

上の速度面の期待は構成からの推論で、移行先のベンチマークではない。
厳密な初回速度が必要なら、EmDash側の `output: "server"` は維持し、別の公開用プロジェクトへ静的スナップショットを生成する。
CMSルートをそのまま `prerender` にする変更はしない。

## 参照した公式資料

- [Astro Route caching](https://docs.astro.build/en/guides/caching/)
- [EmDash Route Caching](https://docs.emdashcms.com/deployment/route-caching/)
- [EmDash Cloudflare](https://docs.emdashcms.com/deployment/cloudflare/)
- [Cloudflare Workers Cache](https://developers.cloudflare.com/workers/cache/)
