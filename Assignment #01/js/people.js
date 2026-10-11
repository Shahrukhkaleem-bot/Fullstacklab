// People page: find members, send friend invitations, answer requests and manage the ignore list

(() => {
  const me = UI.requireLogin();
  UI.renderNavbar('people');

  const blockedModal = new bootstrap.Modal('#blockedModal');

  function statusButton(u) {
    const rel = Store.relation(u.username);
    const btn = {
      friend: '<span class="text-success small">Friends</span>',
      sent: '<span class="text-muted small">Request sent</span>',
      received: `<button class="btn btn-sm btn-success" data-accept-from="${UI.esc(u.username)}">Accept</button>`,
      ignoring: '<span class="text-muted small">Ignored</span>',
      none: `<button class="btn btn-sm btn-success" data-invite="${UI.esc(u.username)}">Add friend</button>`
    };
    return btn[rel] || '';
  }

  function renderPeople() {
    const q = document.getElementById('peopleSearch').value.trim().toLowerCase();
    const showAll = document.getElementById('peopleFilter').value === 'all';
    const people = Store.allUsers()
      .filter((u) => u.username !== me.username)
      .filter((u) => showAll || !Store.isFriend(me.username, u.username))
      .filter((u) => !q || [u.name, u.username, u.city].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));

    const mutual = (u) => u.friends.filter((f) => me.friends.includes(f)).length;
    document.getElementById('peopleGrid').innerHTML = people.length ? people.map((u) => `
      <div class="list-group-item d-flex flex-wrap align-items-center gap-3">
        <a href="profile.html?u=${UI.esc(u.username)}">${UI.avatar(u, 48, true)}</a>
        <div class="flex-grow-1">
          <a href="profile.html?u=${UI.esc(u.username)}" class="link-dark text-decoration-none fw-semibold">${UI.esc(u.name)}</a>
          <div class="small text-muted">@${UI.esc(u.username)} · ${UI.esc(u.city)} · ${mutual(u)} mutual friend${mutual(u) === 1 ? '' : 's'}</div>
        </div>
        ${statusButton(u)}
        <a href="messages.html?to=${UI.esc(u.username)}" class="btn btn-sm btn-outline-secondary">Message</a>
        ${Store.relation(u.username) === 'none' ? `<button class="btn btn-sm btn-link link-secondary" data-ignore="${UI.esc(u.username)}">Ignore</button>` : ''}
      </div>`).join('')
      : '<div class="text-muted small">No one found.</div>';
  }

  document.getElementById('peopleSearch').addEventListener('input', renderPeople);
  document.getElementById('peopleFilter').addEventListener('change', renderPeople);

  document.getElementById('peopleGrid').addEventListener('click', (e) => {
    const invite = e.target.closest('[data-invite]');
    const accept = e.target.closest('[data-accept-from]');
    const ignore = e.target.closest('[data-ignore]');
    if (invite) {
      const target = Store.getUser(invite.dataset.invite);
      try {
        Store.sendInvite(target.username);
        UI.toast(`Friend request sent to ${target.name}.`);
      } catch (err) {
        if (!(err instanceof AppError)) { console.error(err); UI.toast('Could not send the request.', 'danger'); }
        else {
          // explain blocked requests clearly (the target has ignored the sender)
          document.getElementById('blockedText').textContent = err.message;
          blockedModal.show();
        }
      }
    } else if (accept) {
      const request = Store.pendingFor(me.username).find((i) => i.from === accept.dataset.acceptFrom);
      const sender = UI.attempt(() => Store.respondInvite(request.id, 'accept'));
      if (sender) UI.toast(`You and ${sender.name} are now friends.`);
    } else if (ignore) {
      const target = Store.getUser(ignore.dataset.ignore);
      if (confirm(`Ignore ${target.name}? They won't be able to send you friend requests.`)) {
        UI.attempt(() => Store.ignoreUser(target.username), `${target.name} added to your ignore list.`);
      }
    }
    renderAll();
  });

  // requests sent to me
  function renderRequests() {
    const requests = Store.pendingFor(me.username).sort((a, b) => b.at - a.at);
    document.getElementById('reqCount').textContent = requests.length;
    document.getElementById('requestList').innerHTML = requests.length ? requests.map((r) => {
      const u = Store.getUser(r.from);
      return `
        <div class="list-group-item d-flex flex-wrap align-items-center gap-3">
          <a href="profile.html?u=${UI.esc(u.username)}">${UI.avatar(u, 48, true)}</a>
          <div class="flex-grow-1">
            <a href="profile.html?u=${UI.esc(u.username)}" class="link-dark text-decoration-none fw-semibold">${UI.esc(u.name)}</a>
            <div class="small text-muted">sent you a friend request ${UI.timeAgo(r.at)}</div>
          </div>
          <button class="btn btn-sm btn-success" data-respond="accept" data-id="${UI.esc(r.id)}">Accept</button>
          <button class="btn btn-sm btn-outline-secondary" data-respond="decline" data-id="${UI.esc(r.id)}">Decline</button>
          <button class="btn btn-sm btn-link link-secondary" data-respond="ignore" data-id="${UI.esc(r.id)}" title="Decline and add to ignore list">Ignore</button>
        </div>`;
    }).join('') : '<div class="text-muted small">No friend requests.</div>';
  }

  document.getElementById('requestList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-respond]');
    if (!btn) return;
    const action = btn.dataset.respond;
    const sender = UI.attempt(() => Store.respondInvite(btn.dataset.id, action));
    if (sender) {
      const messages = { accept: `You and ${sender.name} are now friends.`, decline: `Request from ${sender.name} declined.`, ignore: `${sender.name} added to your ignore list.` };
      UI.toast(messages[action], action === 'accept' ? 'success' : 'info');
    }
    renderAll();
  });

  // requests I sent
  function renderSent() {
    const sent = Store.sentBy(me.username).sort((a, b) => b.at - a.at);
    document.getElementById('sentCount').textContent = sent.length;
    document.getElementById('sentList').innerHTML = sent.length ? sent.map((r) => {
      const u = Store.getUser(r.to);
      return `
        <div class="list-group-item d-flex align-items-center gap-3">
          ${UI.avatar(u, 40)}
          <div class="flex-grow-1">${UI.esc(u.name)}<div class="small text-muted">sent ${UI.timeAgo(r.at)}</div></div>
          <button class="btn btn-sm btn-outline-danger" data-cancel="${UI.esc(r.id)}">Cancel</button>
        </div>`;
    }).join('') : '<div class="text-muted small">No pending requests.</div>';
  }
  document.getElementById('sentList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cancel]');
    if (!btn) return;
    UI.attempt(() => Store.cancelInvite(btn.dataset.cancel), 'Friend request cancelled.');
    renderAll();
  });

  // ignore list
  function renderIgnored() {
    const list = me.ignored.map(Store.getUser).filter(Boolean);
    document.getElementById('ignCount').textContent = list.length;
    document.getElementById('ignoreList').innerHTML = list.length ? list.map((u) => `
      <div class="list-group-item d-flex align-items-center gap-3">
        ${UI.avatar(u, 40)}
        <div class="flex-grow-1">${UI.esc(u.name)}<div class="small text-muted">@${UI.esc(u.username)}</div></div>
        <button class="btn btn-sm btn-outline-secondary" data-unignore="${UI.esc(u.username)}">Remove</button>
      </div>`).join('') : '<div class="text-muted small">Your ignore list is empty.</div>';
  }
  document.getElementById('ignoreList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-unignore]');
    if (!btn) return;
    const u = Store.getUser(btn.dataset.unignore);
    UI.attempt(() => Store.unignoreUser(u.username), `${u.name} removed from your ignore list.`);
    renderAll();
  });

  function renderAll() {
    renderPeople();
    renderRequests();
    renderSent();
    renderIgnored();
    UI.renderNavbar('people');
  }

  // open the tab named in the URL hash (e.g. people.html#requests)
  function openTabFromHash() {
    const tab = document.querySelector(`[data-hash="${location.hash.slice(1)}"]`);
    if (tab) bootstrap.Tab.getOrCreateInstance(tab).show();
  }
  document.querySelectorAll('[data-hash]').forEach((t) => t.addEventListener('shown.bs.tab', () => history.replaceState(null, '', '#' + t.dataset.hash)));
  window.addEventListener('hashchange', openTabFromHash);

  // search coming from the navbar (people.html?q=...)
  const q = UI.param('q');
  if (q) {
    document.getElementById('peopleSearch').value = q;
    document.getElementById('peopleFilter').value = 'all';
  }

  renderAll();
  openTabFromHash();
})();
