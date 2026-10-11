// Login page

(() => {
  if (Store.me()) { location.replace('home.html'); return; }

  const form = document.getElementById('loginForm');
  const username = document.getElementById('username');
  const password = document.getElementById('password');
  const remember = document.getElementById('remember');
  const errorBox = document.getElementById('loginError');

  const saved = localStorage.getItem('cf_remember');
  if (saved) { username.value = saved; remember.checked = true; }

  document.getElementById('togglePassword').addEventListener('click', (e) => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'Hide' : 'Show';
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    errorBox.classList.add('d-none');
    form.classList.add('was-validated');
    if (!form.checkValidity()) return;

    try {
      Store.login(username.value, password.value);
      if (remember.checked) localStorage.setItem('cf_remember', username.value.trim().toLowerCase());
      else localStorage.removeItem('cf_remember');
      location.href = 'home.html';
    } catch (err) {
      if (!(err instanceof AppError)) console.error(err);
      document.getElementById('loginErrorText').textContent = err instanceof AppError ? err.message : 'Something went wrong while signing in.';
      errorBox.classList.remove('d-none');
      password.value = '';
      form.classList.remove('was-validated');
      password.focus();
    }
  });

  document.getElementById('resetDemo').addEventListener('click', (e) => {
    e.preventDefault();
    if (!confirm('Reset all data (posts, friends, messages) back to the start?')) return;
    Store.resetDemo();
    UI.toast('Data has been reset.', 'info');
  });
})();
