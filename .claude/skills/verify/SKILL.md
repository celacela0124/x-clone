---
name: verify
description: この静的サイト(X clone)の変更をheadless Chromiumで実際に動作確認する。コンソールエラー・ネットワーク失敗・window.supabase未定義を検出する。コード変更を「完了」と報告する前、特にHTML/スクリプト読み込み順・CDN・auth/feed周りを触った後は必ず実行する。
---

# 動作確認(verify)

このプロジェクトにはテストがない。**実ブラウザでページを開いて確認するのが唯一の検証手段。**
過去に「CDNパスが間違っていて `window.supabase` が未定義 → ページ全体が動かない」状態のまま完了報告してしまった事故があるため、以下を必ず実施する。

## 手順

1. ローカルサーバーを起動する(`file://` 直開きは CORS で挙動が変わるため不可):

```bash
cd "$CLAUDE_PROJECT_DIR" && python3 -m http.server 8080 &
```

2. headless Chromium で両ページを開き、エラーを収集する。Playwright が使える環境なら以下のスクリプトを実行
   (リモート実行環境では `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` が設定済み。`playwright install` は不要):

```js
// scratchpad に verify.mjs として保存して: node verify.mjs
const { chromium } = require('playwright'); // or import
const pages = ['index.html', 'feed.html'];
(async () => {
  const browser = await chromium.launch();
  let failed = false;
  for (const p of pages) {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', r => errors.push(`requestfailed: ${r.url()} (${r.failure()?.errorText})`));
    await page.goto(`http://localhost:8080/${p}`, { waitUntil: 'networkidle' });
    const supabaseOk = await page.evaluate(() => typeof window.supabase !== 'undefined');
    if (!supabaseOk) errors.push('window.supabase が未定義(CDN読み込み失敗の疑い)');
    console.log(`--- ${p}: ${errors.length === 0 ? 'OK' : 'NG'}`);
    errors.forEach(e => console.log('  ' + e));
    if (errors.length) failed = true;
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
```

Playwright がなければ `npx -y playwright@latest` は使わず、素の Chromium で代替する:

```bash
chromium --headless --disable-gpu --dump-dom --virtual-time-budget=5000 \
  http://localhost:8080/index.html 2>&1 | grep -iE "error|failed" || echo OK
```

## 合格基準

- 両ページとも: コンソールエラー 0 件、ネットワーク失敗 0 件(Supabase API への 4xx は未ログイン状態のリダイレクトを考慮して個別判断)。
- `window.supabase` が定義されている。
- `feed.html` は未ログイン時に `index.html` へリダイレクトされる(これは正常挙動)。

## 注意

- 未ログイン状態では feed のリダイレクトが走るため、`feed.html` 側は「リダイレクトが正しく起きること」を確認すればよい。
- 確認せずに「動くはず」で完了報告しない。確認できなかった場合は、その旨と理由を正直に報告する。
