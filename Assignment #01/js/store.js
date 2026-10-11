// ConnecFriend data layer.
// Wraps localStorage and holds every rule of the app (login, invitations, ratings, sharing,
// likes and messaging). Pages never touch localStorage directly; they call Store.* functions.
// Invalid actions throw an AppError whose message is safe to show to the user.

class AppError extends Error {}

const Store = (() => {
  const DB_KEY = 'cf_db';
  const SESSION_KEY = 'cf_session';
  const ATTEMPTS_KEY = 'cf_login_attempts';
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 30 * 1000;
  const MAX_POST = 500;
  const MAX_MESSAGE = 1000;
  const RATINGS = {
    1: { label: 'Stupid', icon: 'bi-emoji-dizzy-fill', color: 'danger' },
    2: { label: 'Cool', icon: 'bi-emoji-sunglasses-fill', color: 'info' },
    3: { label: 'Trustworthy', icon: 'bi-shield-fill-check', color: 'success' }
  };

  let db = null;

  // persistence
  function load() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      db = parsed && parsed.version === SEED_VERSION ? parsed : buildSeed();
      if (!parsed || parsed.version !== SEED_VERSION) save();
    } catch (err) {
      console.error('Could not read saved data, starting fresh.', err);
      db = buildSeed();
    }
    return db;
  }

  function save() {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (err) {
      // e.g. storage full after uploading a large profile picture
      throw new AppError('Could not save your changes because browser storage is full. Try a smaller picture.');
    }
  }

  function resetDemo() {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ATTEMPTS_KEY);
    load();
  }

  const uid = (prefix) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // users
  const allUsers = () => db.users;
  function getUser(username) {
    return db.users.find((u) => u.username === String(username || '').toLowerCase()) || null;
  }
  function requireUser(username) {
    const u = getUser(username);
    if (!u) throw new AppError(`No member found with the username "${username}".`);
    return u;
  }

  // session / login
  function attempts() {
    try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY)) || { count: 0, lockedUntil: 0 }; }
    catch { return { count: 0, lockedUntil: 0 }; }
  }

  function login(username, password) {
    username = (username || '').trim().toLowerCase();
    if (!username || !password) throw new AppError('Please enter both your username and password.');

    const state = attempts();
    if (state.lockedUntil > Date.now()) {
      const secs = Math.ceil((state.lockedUntil - Date.now()) / 1000);
      throw new AppError(`Too many failed attempts. Please wait ${secs} seconds and try again.`);
    }

    const user = getUser(username);
    if (!user || user.password !== password) {
      state.count += 1;
      if (state.count >= MAX_ATTEMPTS) {
        state.lockedUntil = Date.now() + LOCK_MS;
        state.count = 0;
      }
      localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(state));
      const left = MAX_ATTEMPTS - state.count;
      throw new AppError(state.lockedUntil > Date.now()
        ? 'Too many failed attempts. Login is locked for 30 seconds.'
        : `Incorrect username or password. ${left} attempt${left === 1 ? '' : 's'} left.`);
    }

    localStorage.removeItem(ATTEMPTS_KEY);
    user.lastLogin = Date.now(); // drives the "latest login first" order of the friends list
    save();
    localStorage.setItem(SESSION_KEY, user.username);
    return user;
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  function me() {
    return getUser(localStorage.getItem(SESSION_KEY));
  }

  // profile
  function updateProfile(changes) {
    const user = me();
    const name = (changes.name || '').trim();
    if (name.length < 3) throw new AppError('Name must be at least 3 characters.');
    if (changes.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) throw new AppError('Please enter a valid email address.');
    if (changes.phone && !/^03\d{2}-?\d{7}$/.test(changes.phone)) throw new AppError('Phone must look like 0312-3456789.');
    if ((changes.bio || '').length > 160) throw new AppError('Bio can be at most 160 characters.');
    Object.assign(user, {
      name,
      bio: (changes.bio || '').trim(),
      city: (changes.city || '').trim(),
      university: (changes.university || '').trim(),
      email: (changes.email || '').trim(),
      phone: (changes.phone || '').trim()
    });
    save();
    return user;
  }

  function setPhoto(dataUrl) {
    const user = me();
    const previous = user.photo;
    user.photo = dataUrl;
    try { save(); } catch (err) { user.photo = previous; throw err; }
  }

  // friends
  const isFriend = (a, b) => !!getUser(a)?.friends.includes(b);

  // friends sorted by last login, most recent first
  function friendsOf(username) {
    const user = requireUser(username);
    return user.friends.map(getUser).filter(Boolean).sort((a, b) => b.lastLogin - a.lastLogin);
  }

  function unfriend(username) {
    const user = me();
    const other = requireUser(username);
    user.friends = user.friends.filter((f) => f !== other.username);
    other.friends = other.friends.filter((f) => f !== user.username);
    delete user.ratings[other.username];
    save();
  }

  // rating (1 = Stupid, 2 = Cool, 3 = Trustworthy)
  function rateFriend(username, value) {
    const user = me();
    value = Number(value);
    if (!isFriend(user.username, username)) throw new AppError('You can only rate people in your friends list.');
    if (![1, 2, 3].includes(value)) throw new AppError('Rating must be 1 (Stupid), 2 (Cool) or 3 (Trustworthy).');
    user.ratings[username] = value;
    save();
  }
  const ratingOf = (username) => me()?.ratings[username] || 0;

  // invitations
  function relation(username) {
    const user = me();
    if (username === user.username) return 'self';
    if (isFriend(user.username, username)) return 'friend';
    if (db.invites.some((i) => i.status === 'pending' && i.from === user.username && i.to === username)) return 'sent';
    if (db.invites.some((i) => i.status === 'pending' && i.from === username && i.to === user.username)) return 'received';
    if (user.ignored.includes(username)) return 'ignoring';
    return 'none';
  }

  function sendInvite(username) {
    const user = me();
    const target = requireUser(username);
    const rel = relation(target.username);
    if (rel === 'self') throw new AppError('You cannot send a friend request to yourself.');
    if (rel === 'friend') throw new AppError(`${target.name} is already your friend.`);
    if (rel === 'sent') throw new AppError(`You already sent a request to ${target.name}.`);
    if (rel === 'received') throw new AppError(`${target.name} already invited you. Accept their request instead.`);
    // the rule from the assignment: blocked if the receiver has ignored the sender
    if (target.ignored.includes(user.username)) {
      throw new AppError(`Friend request cannot be sent. ${target.name} is not accepting requests from you.`);
    }
    if (user.ignored.includes(target.username)) {
      user.ignored = user.ignored.filter((u) => u !== target.username); // inviting someone un-ignores them
    }
    db.invites.push({ id: uid('i'), from: user.username, to: target.username, status: 'pending', at: Date.now() });
    save();
  }

  const pendingFor = (username) => db.invites.filter((i) => i.status === 'pending' && i.to === username);
  const sentBy = (username) => db.invites.filter((i) => i.status === 'pending' && i.from === username);

  function findInvite(id) {
    const invite = db.invites.find((i) => i.id === id && i.status === 'pending');
    if (!invite) throw new AppError('This invitation is no longer available.');
    return invite;
  }

  function respondInvite(id, action) {
    const user = me();
    const invite = findInvite(id);
    if (invite.to !== user.username) throw new AppError('You can only respond to invitations sent to you.');
    const sender = requireUser(invite.from);
    if (action === 'accept') {
      invite.status = 'accepted';
      if (!user.friends.includes(sender.username)) user.friends.push(sender.username);
      if (!sender.friends.includes(user.username)) sender.friends.push(user.username);
    } else if (action === 'decline') {
      invite.status = 'declined';
    } else if (action === 'ignore') {
      invite.status = 'declined';
      if (!user.ignored.includes(sender.username)) user.ignored.push(sender.username);
    } else {
      throw new AppError('Unknown action.');
    }
    save();
    return sender;
  }

  function cancelInvite(id) {
    const invite = findInvite(id);
    if (invite.from !== me().username) throw new AppError('You can only cancel your own requests.');
    invite.status = 'cancelled';
    save();
  }

  function ignoreUser(username) {
    const user = me();
    const target = requireUser(username);
    if (target.username === user.username) throw new AppError('You cannot ignore yourself.');
    if (!user.ignored.includes(target.username)) user.ignored.push(target.username);
    // ignoring also drops any pending request between the two
    db.invites.forEach((i) => {
      if (i.status === 'pending' && ((i.from === target.username && i.to === user.username) || (i.from === user.username && i.to === target.username))) {
        i.status = 'declined';
      }
    });
    save();
  }

  function unignoreUser(username) {
    const user = me();
    user.ignored = user.ignored.filter((u) => u !== username);
    save();
  }

  // news feed
  function canSee(post, viewer) {
    if (post.author === viewer) return true;
    if (!isFriend(viewer, post.author)) return false;
    return post.audience === 'all' || post.sharedWith.includes(viewer);
  }

  function feed(viewer = me().username) {
    return db.posts.filter((p) => canSee(p, viewer)).sort((a, b) => b.at - a.at);
  }

  function postsBy(username) {
    const viewer = me().username;
    return db.posts.filter((p) => p.author === username && canSee(p, viewer)).sort((a, b) => b.at - a.at);
  }

  function sharePost({ text, audience, sharedWith = [], sharedFrom = null }) {
    const user = me();
    text = (text || '').trim();
    if (!text && !sharedFrom) throw new AppError('Please write something before sharing.');
    if (text.length > MAX_POST) throw new AppError(`News can be at most ${MAX_POST} characters.`);
    if (user.friends.length === 0) throw new AppError('Add some friends first so you have someone to share with.');
    if (!['all', 'some'].includes(audience)) throw new AppError('Choose who can see this news.');
    if (audience === 'some') {
      sharedWith = sharedWith.filter((f) => user.friends.includes(f));
      if (sharedWith.length === 0) throw new AppError('Select at least one friend to share with.');
    }
    if (sharedFrom && !db.posts.some((p) => p.id === sharedFrom)) throw new AppError('The original post no longer exists.');
    const post = { id: uid('p'), author: user.username, text, at: Date.now(), likes: [], dislikes: [], audience, sharedWith: audience === 'some' ? sharedWith : [], sharedFrom };
    db.posts.push(post);
    save();
    return post;
  }

  function deletePost(id) {
    const post = getPost(id);
    if (post.author !== me().username) throw new AppError('You can only delete your own news.');
    db.posts = db.posts.filter((p) => p.id !== id);
    save();
  }

  function getPost(id) {
    const post = db.posts.find((p) => p.id === id);
    if (!post) throw new AppError('This post was removed.');
    return post;
  }

  // like / dislike are mutually exclusive; clicking the same button again removes the vote
  function react(id, type) {
    const user = me().username;
    const post = getPost(id);
    if (!canSee(post, user)) throw new AppError('You cannot react to this post.');
    const [mine, other] = type === 'like' ? ['likes', 'dislikes'] : ['dislikes', 'likes'];
    post[other] = post[other].filter((u) => u !== user);
    post[mine] = post[mine].includes(user) ? post[mine].filter((u) => u !== user) : [...post[mine], user];
    save();
    return post;
  }

  // private messages
  function sendMessage(to, text) {
    const user = me();
    const target = requireUser(to);
    text = (text || '').trim();
    if (target.username === user.username) throw new AppError('You cannot message yourself.');
    if (!text) throw new AppError('Type a message first.');
    if (text.length > MAX_MESSAGE) throw new AppError(`Messages can be at most ${MAX_MESSAGE} characters.`);
    const msg = { id: uid('m'), from: user.username, to: target.username, text, at: Date.now(), read: false };
    db.messages.push(msg);
    save();
    return msg;
  }

  // used to simulate the other member answering (no server in this assignment)
  function receiveMessage(from, text) {
    const msg = { id: uid('m'), from, to: me().username, text, at: Date.now(), read: false };
    db.messages.push(msg);
    save();
    return msg;
  }

  function conversation(other) {
    const user = me().username;
    return db.messages
      .filter((m) => (m.from === user && m.to === other) || (m.from === other && m.to === user))
      .sort((a, b) => a.at - b.at);
  }

  // one entry per person I have talked with, newest conversation first
  function conversations() {
    const user = me().username;
    const map = new Map();
    db.messages
      .filter((m) => m.from === user || m.to === user)
      .sort((a, b) => b.at - a.at)
      .forEach((m) => {
        const other = m.from === user ? m.to : m.from;
        if (!map.has(other)) map.set(other, { user: getUser(other), last: m, unread: 0 });
        if (m.to === user && !m.read) map.get(other).unread += 1;
      });
    return [...map.values()].filter((c) => c.user);
  }

  function markRead(other) {
    const user = me().username;
    let changed = false;
    db.messages.forEach((m) => { if (m.from === other && m.to === user && !m.read) { m.read = true; changed = true; } });
    if (changed) save();
  }

  const unreadCount = () => db.messages.filter((m) => m.to === me()?.username && !m.read).length;

  load();

  return {
    RATINGS, MAX_POST, MAX_MESSAGE,
    load, resetDemo, allUsers, getUser, requireUser,
    login, logout, me, updateProfile, setPhoto,
    isFriend, friendsOf, unfriend, rateFriend, ratingOf,
    relation, sendInvite, pendingFor, sentBy, respondInvite, cancelInvite, ignoreUser, unignoreUser,
    feed, postsBy, sharePost, deletePost, getPost, react,
    sendMessage, receiveMessage, conversation, conversations, markRead, unreadCount
  };
})();
