// ConnecFriend shared UI helpers: navbar, avatars, time formatting, rating icons, toasts
// and a wrapper that turns thrown errors into friendly messages.

const UI = (() => {
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const param = (name) => new URLSearchParams(location.search).get(name);

  function timeAgo(ts) {
    const secs = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (secs < 45) return 'just now';
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Online = logged in during the last 15 minutes
  const isOnline = (user) => Date.now() - user.lastLogin < 15 * 60 * 1000;

  const formatDate = (ts) => new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Profile picture: the uploaded photo, or a generated SVG with the member's initials
  function photoUrl(user) {
    if (user.photo) return user.photo;
    const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
      <rect width="120" height="120" fill="${user.color}"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Segoe UI, Arial" font-size="46" font-weight="700" fill="#fff">${initials}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function avatar(user, size = 40, withStatus = false) {
    const dot = withStatus && isOnline(user)
      ? '<span class="position-absolute bottom-0 end-0 p-1 bg-success border border-2 border-white rounded-circle"><span class="visually-hidden">online</span></span>'
      : '';
    return `<span class="position-relative d-inline-block flex-shrink-0">
      <img src="${photoUrl(user)}" width="${size}" height="${size}" class="rounded-circle object-fit-cover" alt="${esc(user.name)}">${dot}</span>`;
  }

  function ratingBadge(value) {
    const r = Store.RATINGS[value];
    if (!r) return '<span class="small text-muted">Not rated</span>';
    return `<span class="badge text-bg-${r.color} bg-opacity-75"><i class="bi ${r.icon}"></i> ${r.label}</span>`;
  }

  // three icon buttons (Stupid / Cool / Trustworthy) used on the profile and home pages
  function ratingControl(username) {
    const current = Store.ratingOf(username);
    return `<div class="btn-group btn-group-sm" role="group" aria-label="Rate friend">
      ${[1, 2, 3].map((v) => {
        const r = Store.RATINGS[v];
        return `<button type="button" class="btn ${current === v ? 'btn-' + r.color : 'btn-outline-' + r.color}"
                  data-rate="${esc(username)}" data-value="${v}" data-bs-toggle="tooltip" data-bs-title="${r.label}" aria-label="${r.label}">
                  <i class="bi ${r.icon}"></i></button>`;
      }).join('')}
    </div>`;
  }

  function toast(message, type = 'success') {
    let box = document.getElementById('toastBox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'toastBox';
      box.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = `toast align-items-center text-bg-${type} border-0`;
    el.setAttribute('role', type === 'danger' ? 'alert' : 'status');
    el.innerHTML = `<div class="d-flex"><div class="toast-body">${esc(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
    box.appendChild(el);
    el.addEventListener('hidden.bs.toast', () => el.remove());
    bootstrap.Toast.getOrCreateInstance(el, { delay: 3500 }).show();
  }

  // run an action; known errors become a red toast, unknown ones are logged too
  function attempt(fn, successMessage) {
    try {
      const result = fn();
      if (successMessage) toast(successMessage, 'success');
      return result;
    } catch (err) {
      if (!(err instanceof AppError)) console.error(err);
      toast(err instanceof AppError ? err.message : 'Something went wrong. Please try again.', 'danger');
      return undefined;
    }
  }

  function initTooltips(root = document) {
    root.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      bootstrap.Tooltip.getInstance(el)?.dispose();
      new bootstrap.Tooltip(el);
    });
  }

  // redirect to the login page when nobody is signed in
  function requireLogin() {
    const user = Store.me();
    if (!user) {
      location.replace('index.html');
      throw new Error('Not logged in');
    }
    return user;
  }

  function renderNavbar(active) {
    const user = Store.me();
    const invites = Store.pendingFor(user.username).length;
    const unread = Store.unreadCount();
    const item = (href, key, icon, label, count = 0) => `
      <li class="nav-item">
        <a class="nav-link px-lg-3 d-flex align-items-center gap-2 ${active === key ? 'active fw-semibold text-success' : ''}" href="${href}">
          <i class="bi ${icon} fs-5"></i><span>${label}</span>${count ? `<span class="badge rounded-pill text-bg-danger">${count}</span>` : ''}
        </a>
      </li>`;

    document.getElementById('navbar').innerHTML = `
      <nav class="navbar navbar-expand-lg bg-white shadow-sm sticky-top">
        <div class="container">
          <a class="navbar-brand fw-bold d-flex align-items-center gap-2 text-success" href="home.html">
            <img src="img/logo.svg" width="32" height="32" alt="">ConnecFriend
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#cfNav" aria-controls="cfNav" aria-expanded="false" aria-label="Toggle navigation">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="cfNav">
            <form class="d-flex my-2 my-lg-0 ms-lg-3" role="search" action="people.html">
              <input class="form-control form-control-sm bg-body-tertiary border-0" type="search" name="q" placeholder="Search people" aria-label="Search people">
            </form>
            <ul class="navbar-nav mx-auto">
              ${item('home.html', 'home', 'bi-house', 'Home')}
              ${item('people.html', 'people', 'bi-people', 'Friends', invites)}
              ${item('messages.html', 'messages', 'bi-chat-left-text', 'Messages', unread)}
            </ul>
            <div class="dropdown">
              <a href="#" class="nav-link d-flex align-items-center gap-2 dropdown-toggle ${active === 'profile' ? 'text-success fw-semibold' : ''}" data-bs-toggle="dropdown" aria-expanded="false">
                ${avatar(user, 32)} <span>${esc(user.name.split(' ')[0])}</span>
              </a>
              <ul class="dropdown-menu dropdown-menu-end shadow-sm">
                <li><a class="dropdown-item" href="profile.html"><i class="bi bi-person me-2"></i>My profile</a></li>
                <li><a class="dropdown-item" href="people.html#ignored"><i class="bi bi-eye-slash me-2"></i>Ignore list</a></li>
                <li><hr class="dropdown-divider"></li>
                <li><button class="dropdown-item text-danger" id="logoutBtn"><i class="bi bi-box-arrow-right me-2"></i>Log out</button></li>
              </ul>
            </div>
          </div>
        </div>
      </nav>`;

    document.getElementById('logoutBtn').addEventListener('click', () => {
      Store.logout();
      location.href = 'index.html';
    });
  }

  return { esc, param, timeAgo, isOnline, formatDate, photoUrl, avatar, ratingBadge, ratingControl, toast, attempt, initTooltips, requireLogin, renderNavbar };
})();
