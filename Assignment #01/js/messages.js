// Messages page: private conversations with friends and any other member.
// There is no server, so replies from the other member are simulated after a short delay.

(() => {
  const me = UI.requireLogin();
  UI.renderNavbar('messages');

  const convList = document.getElementById('convList');
  const thread = document.getElementById('thread');
  const header = document.getElementById('threadHeader');
  const form = document.getElementById('sendForm');
  const input = document.getElementById('msgInput');
  const sendError = document.getElementById('sendError');
  const newModal = new bootstrap.Modal('#newModal');

  let active = null; // username of the open conversation

  const REPLIES = [
    'haha nice', 'ok sure', 'acha theek hai', 'let me check and tell you',
    'yes', 'hmm ok', 'ok see you then', 'agreed', 'thanks yaar'
  ];

  function renderList() {
    const q = document.getElementById('convSearch').value.trim().toLowerCase();
    let convs = Store.conversations();
    // a brand-new chat (no messages yet) still appears at the top
    if (active && !convs.some((c) => c.user.username === active)) convs = [{ user: Store.getUser(active), last: null, unread: 0 }, ...convs];
    convs = convs.filter((c) => !q || c.user.name.toLowerCase().includes(q));

    convList.innerHTML = convs.length ? convs.map((c) => {
      const preview = c.last ? (c.last.from === me.username ? 'You: ' : '') + c.last.text : 'New conversation';
      return `
        <button type="button" class="list-group-item list-group-item-action d-flex gap-2 align-items-center ${c.user.username === active ? 'list-group-item-success' : ''}" data-open="${UI.esc(c.user.username)}">
          ${UI.avatar(c.user, 40, true)}
          <div class="flex-grow-1 text-start overflow-hidden">
            <div class="d-flex justify-content-between gap-2">
              <span class="text-truncate">${UI.esc(c.user.name)}</span>
              <small class="text-nowrap ${c.user.username === active ? '' : 'text-muted'}">${c.last ? UI.timeAgo(c.last.at) : ''}</small>
            </div>
            <div class="d-flex justify-content-between gap-2">
              <small class="text-truncate ${c.unread ? 'fw-bold' : (c.user.username === active ? '' : 'text-muted')}">${UI.esc(preview)}</small>
              ${c.unread ? `<span class="badge text-bg-danger">${c.unread}</span>` : ''}
            </div>
          </div>
        </button>`;
    }).join('') : `<div class="text-muted p-3 small">${q ? 'Nothing found.' : 'No messages yet.'}</div>`;
  }

  convList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-open]');
    if (btn) open(btn.dataset.open);
  });
  document.getElementById('convSearch').addEventListener('input', renderList);

  function renderThread() {
    if (!active) {
      header.innerHTML = '<span class="text-muted">No conversation selected</span>';
      thread.innerHTML = '<p class="text-muted small">Select a conversation on the left.</p>';
      form.classList.add('d-none');
      return;
    }
    const other = Store.getUser(active);
    const friend = Store.isFriend(me.username, other.username);
    header.innerHTML = `
      <a href="profile.html?u=${UI.esc(other.username)}">${UI.avatar(other, 40, true)}</a>
      <div class="flex-grow-1">
        <a href="profile.html?u=${UI.esc(other.username)}" class="link-dark text-decoration-none fw-semibold">${UI.esc(other.name)}</a>
        <div class="small text-muted">${UI.isOnline(other) ? 'Online' : 'Last login ' + UI.timeAgo(other.lastLogin)}</div>
      </div>
      <small class="text-muted">${friend ? 'Friend' : 'Not a friend'}</small>`;

    const msgs = Store.conversation(active);
    let lastDay = '';
    thread.innerHTML = msgs.length ? msgs.map((m) => {
      const mine = m.from === me.username;
      const day = new Date(m.at).toDateString();
      const divider = day !== lastDay ? `<div class="text-center text-muted small my-2">${UI.formatDate(m.at)}</div>` : '';
      lastDay = day;
      return `${divider}
        <div class="d-flex mb-2 ${mine ? 'justify-content-end' : 'justify-content-start'}">
          <div class="px-3 py-2 rounded-3 shadow-sm col-9 col-lg-7 ${mine ? 'bg-success text-white' : 'bg-white'}">
            <div class="text-break">${UI.esc(m.text).replace(/\n/g, '<br>')}</div>
            <div class="small text-end ${mine ? 'text-white-50' : 'text-muted'}">
              ${new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              ${mine ? `${m.read ? 'Seen' : 'Sent'}` : ''}
            </div>
          </div>
        </div>`;
    }).join('') : `<p class="text-muted small">No messages with ${UI.esc(other.name)} yet.${friend ? '' : ' You are not friends, but you can still send a message.'}</p>`;
    form.classList.remove('d-none');
    thread.scrollTop = thread.scrollHeight;
  }

  function open(username) {
    const user = Store.getUser(username);
    if (!user || user.username === me.username) {
      UI.toast(user ? 'You cannot message yourself.' : 'That member does not exist.', 'danger');
      return;
    }
    active = user.username;
    Store.markRead(active);
    history.replaceState(null, '', '?to=' + encodeURIComponent(active));
    sendError.classList.add('d-none');
    renderList();
    renderThread();
    UI.renderNavbar('messages');
    input.focus();
  }

  input.addEventListener('input', () => {
    document.getElementById('msgCount').textContent = `${input.value.length} / ${Store.MAX_MESSAGE}`;
    sendError.classList.add('d-none');
    input.classList.remove('is-invalid');
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      Store.sendMessage(active, input.value);
      input.value = '';
      input.dispatchEvent(new Event('input'));
      renderThread();
      renderList();
      simulateReply(active);
    } catch (err) {
      if (!(err instanceof AppError)) console.error(err);
      sendError.textContent = err instanceof AppError ? err.message : 'Message could not be sent.';
      sendError.classList.remove('d-none');
      input.classList.add('is-invalid');
    }
  });

  // pretend the other member reads and answers (no real server)
  function simulateReply(username) {
    const typingId = 'typing-' + username;
    setTimeout(() => {
      if (active !== username) return;
      thread.insertAdjacentHTML('beforeend', `<div id="${typingId}" class="small text-muted fst-italic mb-2">${UI.esc(Store.getUser(username).name)} is typing...</div>`);
      thread.scrollTop = thread.scrollHeight;
    }, 700);
    setTimeout(() => {
      Store.conversation(username).forEach((m) => { if (m.from === me.username) m.read = true; });
      Store.receiveMessage(username, REPLIES[Math.floor(Math.random() * REPLIES.length)]);
      if (active === username) Store.markRead(username);
      else UI.toast(`New message from ${Store.getUser(username).name}`, 'info');
      renderThread();
      renderList();
      UI.renderNavbar('messages');
    }, 2200);
  }

  function renderMembers() {
    const q = document.getElementById('memberSearch').value.trim().toLowerCase();
    const members = Store.allUsers()
      .filter((u) => u.username !== me.username)
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.username.includes(q))
      .sort((a, b) => Number(Store.isFriend(me.username, b.username)) - Number(Store.isFriend(me.username, a.username)) || a.name.localeCompare(b.name));
    document.getElementById('memberList').innerHTML = members.length ? members.map((u) => `
      <button type="button" class="list-group-item list-group-item-action d-flex align-items-center gap-3" data-member="${UI.esc(u.username)}">
        ${UI.avatar(u, 40, true)}
        <div class="flex-grow-1 text-start">${UI.esc(u.name)}<div class="small text-muted">@${UI.esc(u.username)} · ${UI.esc(u.city)}</div></div>
        <small class="text-muted">${Store.isFriend(me.username, u.username) ? 'Friend' : ''}</small>
      </button>`).join('') : '<p class="text-muted small">No one found.</p>';
  }
  document.getElementById('memberSearch').addEventListener('input', renderMembers);
  document.getElementById('newModal').addEventListener('show.bs.modal', () => { document.getElementById('memberSearch').value = ''; renderMembers(); });
  document.getElementById('memberList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-member]');
    if (!btn) return;
    newModal.hide();
    open(btn.dataset.member);
  });

  // open ?to=username (from profile / home links) or the most recent conversation
  const to = UI.param('to');
  if (to) open(to);
  else {
    const first = Store.conversations()[0];
    if (first && window.matchMedia('(min-width: 768px)').matches) open(first.user.username);
    else { renderList(); renderThread(); }
  }
})();
