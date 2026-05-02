(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) window.location.href = 'feed.html';
})();

// タブ切り替え
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('login-form').classList.toggle('hidden', target !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', target !== 'register');
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
  });
});

// ログイン
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = '...';

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    errEl.textContent = 'メールアドレスかパスワードが違います';
    btn.disabled = false;
    btn.textContent = 'ログイン';
  } else {
    window.location.href = 'feed.html';
  }
});

// 新規登録
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const errEl = document.getElementById('register-error');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = '...';

  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;

  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    errEl.textContent = error.message.includes('already') ? 'このメールアドレスはすでに登録されています' : error.message;
    btn.disabled = false;
    btn.textContent = 'アカウント作成';
  } else {
    window.location.href = 'feed.html';
  }
});
