if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
  document.body.innerHTML = '<div style="color:#fff;padding:2rem;font-family:sans-serif"><h2>設定ファイルがありません</h2><p>js/config.example.js を js/config.js にコピーして、Supabaseの情報を入力してください。</p></div>';
  throw new Error('config.js が見つかりません');
}

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
