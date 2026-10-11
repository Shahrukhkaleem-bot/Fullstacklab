// Home page: friends ordered by latest login, posting news and the news feed

(() => {
  const me = UI.requireLogin();
  UI.renderNavbar('home');

  const feedEl = document.getElementById('feed');
  const filterEl = document.getElementById('feedFilter');

  // my summary card on the left
  function renderMe() {
    const el = document.getElementById('meCard');
    if (!el) return;
    const posts = Store.postsBy(me.username).length;
    const requests = Store.pendingFor(me.username).length;
    el.innerHTML = `
      <div class="card-body">
        <a href="profile.html">${UI.avatar(me, 72)}</a>
        <h2 class="h6 mt-2 mb-0">${UI.esc(me.name)}</h2>
        <div class="small text-muted">@${UI.esc(me.username)}</div>
        <p class="small text-muted mt-2 mb-0">${UI.esc(me.bio)}</p>
      </div>
      <div class="d-flex border-top text-center small">
        <a href="profile.html" class="flex-fill py-2 link-dark text-decoration-none border-end"><b class="d-block">${me.friends.length}</b><span class="text-muted">Friends</span></a>
        <a href="profile.html" class="flex-fill py-2 link-dark text-decoration-none border-end"><b class="d-block">${posts}</b><span class="text-muted">Posts</span></a>
        <a href="people.html#requests" class="flex-fill py-2 link-dark text-decoration-none"><b class="d-block">${requests}</b><span class="text-muted">Requests</span></a>
      </div>`;
  }

  // friends list, most recent login at the top
  function renderFriends() {
    const friends = Store.friendsOf(me.username);
    document.getElementById('friendCount').textContent = friends.length;
    document.getElementById('friendList').innerHTML = friends.length ? friends.map((f) => `
      <li class="list-group-item border-0 py-2">
        <div class="d-flex align-items-center gap-2">
          <a href="profile.html?u=${UI.esc(f.username)}">${UI.avatar(f, 38, true)}</a>
          <div class="flex-grow-1 lh-sm">
            <a href="profile.html?u=${UI.esc(f.username)}" class="link-dark text-decoration-none small fw-semibold">${UI.esc(f.name)}</a>
            <div class="small ${UI.isOnline(f) ? 'text-success' : 'text-muted'}">${UI.isOnline(f) ? 'Online now' : UI.timeAgo(f.lastLogin)}</div>
          </div>
          <a href="messages.html?to=${UI.esc(f.username)}" class="btn btn-sm btn-light rounded-circle" aria-label="Message ${UI.esc(f.name)}"><i class="bi bi-chat-left-text"></i></a>
        </div>
        <div class="mt-1 ms-5">${UI.ratingControl(f.username)}</div>
      </li>`).join('')
      : '<li class="list-group-item border-0 text-muted small">No friends yet. <a href="people.html">Find people</a></li>';
    UI.initTooltips(document.getElementById('friendList'));
  }

  document.getElementById('friendList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rate]');
    if (!btn) return;
    bootstrap.Tooltip.getInstance(btn)?.dispose();
    const friend = Store.getUser(btn.dataset.rate);
    const label = Store.RATINGS[btn.dataset.value].label;
    UI.attempt(() => Store.rateFriend(btn.dataset.rate, btn.dataset.value), `${friend.name} rated as ${label}.`);
    renderFriends();
  });

  // posting news
  document.getElementById('composerAvatar').innerHTML = UI.avatar(me, 40);
  const newsText = document.getElementById('newsText');
  const composerError = document.getElementById('composerError');
  const composerAudience = AudiencePicker(document.getElementById('composerAudience'), 'compose');

  newsText.addEventListener('input', () => {
    document.getElementById('charCount').textContent = `${newsText.value.length} / ${Store.MAX_POST}`;
    newsText.classList.remove('is-invalid');
    composerError.classList.add('d-none');
  });

  document.getElementById('composer').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const { audience, sharedWith } = composerAudience.value();
      Store.sharePost({ text: newsText.value, audience, sharedWith });
      newsText.value = '';
      newsText.dispatchEvent(new Event('input'));
      composerAudience.reset();
      UI.toast(audience === 'all' ? 'Posted to all friends.' : `Posted to ${sharedWith.length} friend${sharedWith.length === 1 ? '' : 's'}.`);
      filterEl.value = 'all';
      renderFeed();
      renderMe();
    } catch (err) {
      if (!(err instanceof AppError)) console.error(err);
      composerError.textContent = err instanceof AppError ? err.message : 'Could not post your news.';
      composerError.classList.remove('d-none');
      newsText.classList.add('is-invalid');
    }
  });

  // feed
  function renderFilter() {
    const friends = Store.friendsOf(me.username);
    const current = filterEl.value || 'all';
    filterEl.innerHTML = `<option value="all">Everyone</option><option value="${UI.esc(me.username)}">My posts</option>` +
      friends.map((f) => `<option value="${UI.esc(f.username)}">${UI.esc(f.name)}</option>`).join('');
    filterEl.value = [...filterEl.options].some((o) => o.value === current) ? current : 'all';
  }

  function renderFeed() {
    const filter = filterEl.value;
    const posts = Store.feed().filter((p) => filter === 'all' || p.author === filter);
    feedEl.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => bootstrap.Tooltip.getInstance(el)?.dispose());
    feedEl.innerHTML = posts.length ? posts.map(Posts.render).join('') : '<div class="card border-0 shadow-sm rounded-3"><div class="card-body text-muted small">No posts yet.</div></div>';
    UI.initTooltips(feedEl);
  }
  filterEl.addEventListener('change', renderFeed);

  // sharing someone's post
  const shareModal = new bootstrap.Modal('#shareModal');
  const shareAudience = AudiencePicker(document.getElementById('shareAudience'), 'share');
  const shareError = document.getElementById('shareError');
  let sharing = null;

  function openShare(postId) {
    const post = UI.attempt(() => Store.getPost(postId));
    if (!post) return;
    sharing = post.id;
    const author = Store.getUser(post.author);
    document.getElementById('shareText').value = '';
    document.getElementById('sharePreview').innerHTML = `
      <div class="border rounded-3 p-2 bg-body-tertiary small">
        <b>${UI.esc(author.name)}</b> <span class="text-muted">· ${UI.timeAgo(post.at)}</span>
        <div>${UI.esc(post.text)}</div>
      </div>`;
    shareAudience.reset();
    shareError.classList.add('d-none');
    shareModal.show();
  }

  document.getElementById('shareForm').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const { audience, sharedWith } = shareAudience.value();
      Store.sharePost({ text: document.getElementById('shareText').value, audience, sharedWith, sharedFrom: sharing });
      shareModal.hide();
      UI.toast('Post shared.');
      renderFeed();
    } catch (err) {
      if (!(err instanceof AppError)) console.error(err);
      shareError.textContent = err instanceof AppError ? err.message : 'Could not share this post.';
      shareError.classList.remove('d-none');
    }
  });

  Posts.bind(feedEl, { onChange: () => { renderFeed(); renderMe(); }, onShare: openShare });

  renderMe();
  renderFriends();
  renderFilter();
  renderFeed();

  // keep the "x mins ago" text up to date
  setInterval(() => { renderFriends(); renderFeed(); }, 60 * 1000);
})();
