# X Clone

シンプルなTwitter風SNS。Supabase + GitHub Pages で動く静的サイト。

## セットアップ

### 1. Supabaseプロジェクトを作成

1. https://supabase.com でサインインしてプロジェクトを新規作成
2. **Project URL** と **anon key** を控えておく（Settings > API で確認できる）

### 2. データベースのセットアップ

Supabase ダッシュボードの **SQL Editor** で以下を実行：

```sql
-- プロフィールテーブル
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 投稿テーブル
CREATE TABLE posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) <= 280),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX posts_created_at_idx ON posts (created_at DESC);

-- サインアップ時にプロフィールを自動作成するトリガー
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, SPLIT_PART(NEW.email, '@', 1), SPLIT_PART(NEW.email, '@', 1));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- RLS（行レベルセキュリティ）有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts    ENABLE ROW LEVEL SECURITY;

-- ポリシー設定
CREATE POLICY "Profiles are publicly readable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile"   ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Posts are publicly readable"          ON posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts"           ON posts FOR DELETE USING (auth.uid() = user_id);
```

### 3. Auth設定

Supabase ダッシュボード > **Authentication > Providers > Email**
- Enable Email Provider: ON
- Confirm email: OFF（開発中はOFFにすると楽）

### 4. config.js を作成

```bash
cp js/config.example.js js/config.js
```

`js/config.js` を開いて、Supabaseの情報を入力：

```js
const SUPABASE_URL = 'https://xxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...';
```

> `js/config.js` は**リポジトリにコミットされている**(GitHub Pages で配信するため)。anon key は RLS で保護される公開前提の値なのでコミットして問題ない。**`service_role` キーは絶対にコミットしないこと**(RLS をバイパスするため)。

### 5. 動作確認

ローカルサーバー経由で確認する（`file://` 直開きは CORS で動かない場合がある）：

```bash
python3 -m http.server 8080
# → http://localhost:8080/index.html
```

---

## GitHub Pages へのデプロイ

```bash
git init
git add .
git commit -m "initial commit"
gh repo create x-clone --public --source=. --remote=origin --push
```

GitHubリポジトリの **Settings > Pages** で：
- Source: `Deploy from a branch`
- Branch: `main` / `/ (root)`

しばらくするとURLが発行される（`https://<username>.github.io/x-clone/`）。

> `js/config.js` はリポジトリにコミット済みなので、push するだけでそのまま GitHub Pages で動く。GitHub Pages にはビルドステップがないため、Secrets/Actions によるシークレット注入は使えない(この制約が config.js をコミットする理由)。

## ファイル構成

```
x-clone/
├── index.html              # ログイン/登録ページ
├── feed.html               # タイムライン
├── css/styles.css          # スタイル
├── js/
│   ├── config.example.js   # 設定テンプレート
│   ├── config.js           # 実際の設定（コミット済み。anon keyのみ）
│   ├── supabase-client.js  # Supabaseクライアント
│   ├── auth.js             # 認証ロジック
│   ├── feed.js             # タイムライン
│   └── posts.js            # 投稿作成
└── .gitignore
```
