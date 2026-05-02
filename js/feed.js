let currentUser = null;

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' });
}

function renderPost(post) {
  const name = post.profiles?.display_name || post.profiles?.username || '?';
  const username = post.profiles?.username || '?';
  const initial = name.charAt(0).toUpperCase();

  const card = document.createElement('div');
  card.className = 'post-card';
  card.dataset.id = post.id;
  card.innerHTML = `
    <div class="avatar">${initial}</div>
    <div class="post-body">
      <div class="post-meta">
        <span class="post-name">${escapeHtml(name)}</span>
        <span class="post-username">@${escapeHtml(username)}</span>
        <span class="post-time">· ${formatTime(post.created_at)}</span>
      </div>
      <div class="post-content">${escapeHtml(post.content)}</div>
    </div>
  `;
  return card;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadFeed() {
  const timeline = document.getElementById('timeline');

  const { data: posts, error } = await supabase
    .from('posts')
    .select('*, profiles(username, display_name)')
    .order('created_at', { ascending: false })
    .limit(50);

  timeline.innerHTML = '';

  if (error) {
    timeline.innerHTML = '<div class="empty">読み込みに失敗しました</div>';
    return;
  }

  if (!posts || posts.length === 0) {
    timeline.innerHTML = '<div class="empty">まだ投稿がありません。最初のつぶやきをどうぞ!</div>';
    return;
  }

  posts.forEach(post => timeline.appendChild(renderPost(post)));
}

function prependPost(post) {
  const timeline = document.getElementById('timeline');
  const empty = timeline.querySelector('.empty');
  if (empty) empty.remove();
  timeline.insertBefore(renderPost(post), timeline.firstChild);
}

// ===== 初期化 =====

(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    return;
  }
  currentUser = session.user;

  // プロフィール取得してヘッダーに表示
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('id', currentUser.id)
    .single();

  const displayName = profile?.display_name || profile?.username || currentUser.email;
  document.getElementById('header-username').textContent = `@${profile?.username || ''}`;

  // ログアウト
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
  });

  // 文字カウンター
  const textarea = document.getElementById('post-content');
  const counter = document.getElementById('char-counter');
  const postBtn = document.getElementById('post-btn');

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    counter.textContent = `${len} / 280`;
    counter.className = 'char-counter' + (len > 260 ? (len > 280 ? ' over' : ' warn') : '');
    postBtn.disabled = len === 0 || len > 280;
  });

  // 投稿
  postBtn.addEventListener('click', async () => {
    const errEl = document.getElementById('post-error');
    errEl.textContent = '';
    postBtn.disabled = true;
    postBtn.textContent = '...';

    const { data, error } = await createPost(textarea.value, currentUser.id);

    postBtn.textContent = '投稿';

    if (error) {
      errEl.textContent = error.message || error;
      postBtn.disabled = false;
      return;
    }

    textarea.value = '';
    counter.textContent = '0 / 280';
    counter.className = 'char-counter';
    postBtn.disabled = true;
    prependPost(data);
  });

  await loadFeed();
})();
