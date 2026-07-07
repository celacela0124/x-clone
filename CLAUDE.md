# X Clone — プロジェクトガイド

シンプルなTwitter風SNS。**ビルドステップなしの純粋な静的サイト**(vanilla JS)+ Supabase(認証・DB)+ GitHub Pages でホスティング。

## アーキテクチャの要点

- npm / バンドラー / フレームワークは**使わない**。`<script>` タグの読み込み順でグローバル変数を共有する設計。
- スクリプトの読み込み順序は**厳守**(順序を変えると壊れる):
  1. Supabase CDN (UMD版) → `window.supabase` を定義
  2. `js/config.js` → `SUPABASE_URL` / `SUPABASE_ANON_KEY` を定義
  3. `js/supabase-client.js` → グローバル `supabase` クライアントを作成
  4. ページ固有スクリプト(`auth.js` / `posts.js` + `feed.js`)
- ページ: `index.html`(ログイン/登録)、`feed.html`(タイムライン)
- DBスキーマとRLSポリシーは README.md の SQL が正。変更したら README も更新すること。

## 確定済みの意思決定(蒸し返さない)

| 決定 | 理由 |
|---|---|
| `js/config.js` は**リポジトリにコミットする** | GitHub Pages はビルド時のシークレット注入ができない静的ホスティング。anon key は RLS で保護される公開前提の値なのでコミットして問題ない |
| Supabase CDN は**明示的な UMD パス**を使う: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js` | 短縮パス(`@supabase/supabase-js@2` のみ)だと ESM が返り `window.supabase` が未定義になりページ全体が壊れた実績あり |
| ビルドツール・フレームワークは導入しない | このプロジェクトの規模では複雑さに見合わない |

## セキュリティの境界

- **anon key は公開してよい**(RLS がセキュリティ境界)。
- **`service_role` キーは絶対にコミット・コードに書かない。** フロントエンドから使うことも禁止。(`.claude/hooks/check-secrets.py` がコミット時に自動検査する)
- ユーザー入力を `innerHTML` に入れる際は必ず `escapeHtml()`(feed.js)を通す。
- 投稿の280文字制限はクライアント側(posts.js)と DB の CHECK 制約の両方にある。片方だけ変えないこと。

## 過去に起きた問題と再発防止ルール

1. **ブラウザで動かないコードを「完成」として納品した**(CDNパス問題・エラーハンドリング欠如)。
   → 変更を完了と報告する前に、必ず実ブラウザで動作確認する。`/verify` スキル(`.claude/skills/verify/`)の手順に従うか、`browser-check` サブエージェントを使う。テストがない=目視確認が唯一の検証手段。
2. **デプロイ先の制約を確認せずに設計した**(config.js を gitignore する設計が GitHub Pages と矛盾し、直後に方針転換)。
   → 新しい仕組みを設計する前に「GitHub Pages(静的・ビルドなし・public リポジトリ)で成立するか」を確認する。
3. **コードの方針転換後にドキュメントを直し忘れた**(README に「config.js はコミットされない」という記述が残り続けた)。
   → 挙動・方針を変えたら、同じコミットで README.md・コード内コメント・この CLAUDE.md を必ず同期する。

## 動作確認の方法

```bash
# ローカルサーバー起動(file:// では CORS で動かない場合がある)
python3 -m http.server 8080
# → http://localhost:8080/index.html
```

自動確認は `/verify` スキル参照(headless Chromium でコンソールエラー・ネットワーク失敗を検出)。

## コーディング規約

- vanilla JS(ES2017+、async/await 可)。モジュール化しない(グローバル共有設計のため)。
- UI 文言・エラーメッセージは日本語。
- 非同期の Supabase 呼び出しは try-catch または `{ data, error }` の error チェックを必ず行い、失敗時はユーザーに見える形で表示する(console.error だけで握りつぶさない)。
