// Profile page: personal information, profile picture and the list of all friends.
// profile.html shows your own profile; profile.html?u=<username> shows another member.

(() => {
  const me = UI.requireLogin();
  UI.renderNavbar(UI.param('u') && UI.param('u') !== me.username ? '' : 'profile');

  const requested = (UI.param('u') || me.username).toLowerCase();
  const user = Store.getUser(requested);
  if (!user) {
    document.getElementById('profileContent').classList.add('d-none');
    const box = document.getElementById('notFound');
    box.innerHTML = `User <b>@${UI.esc(requested)}</b> not found. <a href="people.html" class="alert-link">Go back</a>`;
    box.classList.remove('d-none');
    return;
  }
  const own = user.username === me.username;
  document.title = `ConnecFriend · ${user.name}`;

  // picture and details
  function renderInfo() {
    document.getElementById('photo').innerHTML = UI.avatar(user, 120, true);
    document.getElementById('name').textContent = user.name;
    document.getElementById('username').textContent = '@' + user.username;
    document.getElementById('bio').textContent = user.bio || 'No bio yet.';

    const row = (label, value) => value ? `<tr><td class="text-muted ps-3">${label}</td><td class="pe-3 text-end">${UI.esc(value)}</td></tr>` : '';
    // contact details are only shown to friends (and to the owner)
    const showContact = own || Store.isFriend(me.username, user.username);
    const age = Math.floor((Date.now() - new Date(user.dob)) / (365.25 * 24 * 3600 * 1000));
    document.getElementById('details').innerHTML =
      row('City', user.city) +
      row('University', user.university) +
      row('Gender', user.gender) +
      row('Birthday', `${UI.formatDate(new Date(user.dob).getTime())} (${age})`) +
      (showContact ? row('Email', user.email) + row('Phone', user.phone) : '') +
      row('Joined', UI.formatDate(user.joined)) +
      row('Last login', UI.timeAgo(user.lastLogin)) +
      (!showContact ? '<tr><td colspan="2" class="text-muted px-3"><i class="bi bi-lock"></i> Email and phone are only visible to friends.</td></tr>' : '');

    const fact = (icon, value) => value ? `<span><i class="bi ${icon}"></i> ${UI.esc(value)}</span>` : '';
    document.getElementById('quickFacts').innerHTML =
      fact('bi-geo-alt', user.city) + fact('bi-mortarboard', user.university) +
      fact('bi-people', `${user.friends.length} friends`) +
      `<span class="${UI.isOnline(user) ? 'text-success' : ''}"><i class="bi bi-clock"></i> ${UI.isOnline(user) ? 'Online now' : 'Last login ' + UI.timeAgo(user.lastLogin)}</span>`;

    document.getElementById('photoActions').innerHTML = own ? `
      <label class="btn btn-sm btn-light" for="photoInput"><i class="bi bi-camera"></i> Change photo</label>
      <input type="file" id="photoInput" accept="image/png, image/jpeg, image/webp" class="d-none">
      ${user.photo ? '<button class="btn btn-sm btn-link link-danger" id="removePhoto">Remove</button>' : ''}` : '';
    renderActions();
  }

  // buttons depend on the relationship with this member
  function renderActions() {
    const el = document.getElementById('relationActions');
    if (own) {
      el.innerHTML = '<button class="btn btn-success" data-bs-toggle="modal" data-bs-target="#editModal"><i class="bi bi-pencil"></i> Edit profile</button>';
      return;
    }
    const rel = Store.relation(user.username);
    const message = `<a href="messages.html?to=${UI.esc(user.username)}" class="btn btn-light"><i class="bi bi-chat-left-text"></i> Message</a>`;
    const ignore = `<button class="btn btn-link btn-sm link-secondary" data-action="ignore">Ignore this person</button>`;
    const map = {
      friend: `<div class="d-flex justify-content-center align-items-center gap-2"><span class="small text-muted">Your rating:</span>${UI.ratingControl(user.username)}</div>
               ${message}<button class="btn btn-sm btn-link link-danger" data-action="unfriend">Unfriend</button>`,
      sent: `<button class="btn btn-secondary" disabled>Request sent</button>${message}`,
      received: `<div class="btn-group"><button class="btn btn-success" data-action="accept">Accept request</button>
                 <button class="btn btn-outline-secondary" data-action="decline">Decline</button></div>${message}`,
      ignoring: `<div class="small text-muted">You have ignored this person.</div>
                 <button class="btn btn-outline-secondary" data-action="unignore">Remove from ignore list</button>${message}`,
      none: `<button class="btn btn-success" data-action="invite"><i class="bi bi-person-plus"></i> Add friend</button>${message}${ignore}`
    };
    el.innerHTML = map[rel] || message;
    UI.initTooltips(el);
  }

  document.getElementById('relationActions').addEventListener('click', (e) => {
    const rate = e.target.closest('[data-rate]');
    const btn = e.target.closest('[data-action]');
    if (rate) {
      bootstrap.Tooltip.getInstance(rate)?.dispose();
      UI.attempt(() => Store.rateFriend(user.username, rate.dataset.value), `${user.name} rated as ${Store.RATINGS[rate.dataset.value].label}.`);
    } else if (btn) {
      const action = btn.dataset.action;
      const invite = () => Store.pendingFor(me.username).find((i) => i.from === user.username);
      const actions = {
        invite: () => UI.attempt(() => Store.sendInvite(user.username), `Friend request sent to ${user.name}.`),
        accept: () => UI.attempt(() => Store.respondInvite(invite().id, 'accept'), `You and ${user.name} are now friends.`),
        decline: () => UI.attempt(() => Store.respondInvite(invite().id, 'decline'), 'Request declined.'),
        unfriend: () => confirm(`Remove ${user.name} from your friends?`) && UI.attempt(() => Store.unfriend(user.username), `${user.name} was removed from your friends.`),
        ignore: () => confirm(`Ignore ${user.name}? They won't be able to send you friend requests.`) && UI.attempt(() => Store.ignoreUser(user.username), `${user.name} added to your ignore list.`),
        unignore: () => UI.attempt(() => Store.unignoreUser(user.username), `${user.name} removed from your ignore list.`)
      };
      actions[action]?.();
    }
    renderInfo();
    renderFriends();
    UI.renderNavbar(own ? 'profile' : '');
  });

  // profile picture upload
  document.getElementById('photoActions').addEventListener('change', (e) => {
    if (e.target.id !== 'photoInput') return;
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return UI.toast('Please choose a PNG, JPG or WEBP image.', 'danger');
    if (file.size > 2 * 1024 * 1024) return UI.toast('Picture must be smaller than 2 MB.', 'danger');

    // shrink the picture to 300 px so it fits in browser storage
    const reader = new FileReader();
    reader.onerror = () => UI.toast('Could not read that file.', 'danger');
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => UI.toast('That file is not a valid image.', 'danger');
      img.onload = () => {
        const size = 300;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        canvas.getContext('2d').drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        if (UI.attempt(() => { Store.setPhoto(canvas.toDataURL('image/jpeg', 0.85)); return true; }, 'Photo updated.')) {
          renderInfo();
          UI.renderNavbar('profile');
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('photoActions').addEventListener('click', (e) => {
    if (e.target.id !== 'removePhoto') return;
    UI.attempt(() => Store.setPhoto(null), 'Photo removed.');
    renderInfo();
    UI.renderNavbar('profile');
  });

  // friends list
  function renderFriends() {
    const q = document.getElementById('friendSearch').value.trim().toLowerCase();
    const all = Store.friendsOf(user.username);
    const friends = all.filter((f) => !q || f.name.toLowerCase().includes(q) || f.username.includes(q));
    document.getElementById('friendsCount').textContent = all.length;
    const grid = document.getElementById('friendsGrid');
    grid.innerHTML = friends.length ? friends.map((f) => `
      <div class="col">
        <div class="border rounded-3 p-2 h-100 d-flex gap-2 align-items-center">
          <a href="profile.html?u=${UI.esc(f.username)}">${UI.avatar(f, 48, true)}</a>
          <div class="flex-grow-1">
            <a href="profile.html?u=${UI.esc(f.username)}" class="link-dark text-decoration-none fw-semibold small">${UI.esc(f.name)}</a>
            <div class="small text-muted">${UI.esc(f.city)} · last login ${UI.timeAgo(f.lastLogin)}</div>
          </div>
          ${own ? UI.ratingControl(f.username) : (f.username === me.username ? '<span class="badge text-bg-secondary">You</span>' : '')}
        </div>
      </div>`).join('')
      : `<div class="col-12 text-muted small">${q ? 'No friends match your search.' : 'No friends yet.'}</div>`;
    UI.initTooltips(grid);
  }
  document.getElementById('friendSearch').addEventListener('input', renderFriends);
  document.getElementById('friendsGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rate]');
    if (!btn) return;
    bootstrap.Tooltip.getInstance(btn)?.dispose();
    const friend = Store.getUser(btn.dataset.rate);
    UI.attempt(() => Store.rateFriend(btn.dataset.rate, btn.dataset.value), `${friend.name} rated as ${Store.RATINGS[btn.dataset.value].label}.`);
    renderFriends();
  });

  // news by this member
  const newsList = document.getElementById('newsList');
  function renderNews() {
    const posts = Store.postsBy(user.username);
    document.getElementById('newsCount').textContent = posts.length;
    newsList.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => bootstrap.Tooltip.getInstance(el)?.dispose());
    newsList.innerHTML = posts.length ? posts.map(Posts.render).join('')
      : `<p class="text-muted small mb-0">${own || Store.isFriend(me.username, user.username) ? 'No posts yet.' : 'Only friends can see these posts.'}</p>`;
    UI.initTooltips(newsList);
  }
  Posts.bind(newsList, { onChange: renderNews, onShare: () => (location.href = 'home.html') });

  // edit personal information
  const editModal = document.getElementById('editModal');
  editModal.addEventListener('show.bs.modal', () => {
    document.getElementById('eName').value = user.name;
    document.getElementById('eBio').value = user.bio;
    document.getElementById('eCity').value = user.city;
    document.getElementById('eUni').value = user.university;
    document.getElementById('eEmail').value = user.email;
    document.getElementById('ePhone').value = user.phone;
    document.getElementById('editError').classList.add('d-none');
  });
  document.getElementById('editForm').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      Store.updateProfile({
        name: document.getElementById('eName').value,
        bio: document.getElementById('eBio').value,
        city: document.getElementById('eCity').value,
        university: document.getElementById('eUni').value,
        email: document.getElementById('eEmail').value,
        phone: document.getElementById('ePhone').value
      });
      bootstrap.Modal.getInstance(editModal).hide();
      UI.toast('Profile updated.');
      renderInfo();
      UI.renderNavbar('profile');
    } catch (err) {
      if (!(err instanceof AppError)) console.error(err);
      const box = document.getElementById('editError');
      box.textContent = err instanceof AppError ? err.message : 'Could not save your changes.';
      box.classList.remove('d-none');
    }
  });

  renderInfo();
  renderFriends();
  renderNews();
})();
