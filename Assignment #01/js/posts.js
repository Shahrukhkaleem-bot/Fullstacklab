// News post card shared by the home and profile pages.
// Shows the author's name, picture and time since their last login, the news text,
// who it was shared with, and like / dislike buttons with counts.

const Posts = (() => {
  const nameList = (usernames) => usernames.map((u) => Store.getUser(u)?.name).filter(Boolean);
  const text = (t) => UI.esc(t).replace(/\n/g, '<br>');

  function audienceLabel(post) {
    if (post.audience === 'all') return 'All friends';
    const names = nameList(post.sharedWith);
    return `<span data-bs-toggle="tooltip" data-bs-title="${UI.esc(names.join(', '))}">${names.length} friend${names.length === 1 ? '' : 's'}</span>`;
  }

  function quoted(post) {
    let original;
    try { original = Store.getPost(post.sharedFrom); } catch { original = null; }
    if (!original) return '<div class="border rounded-3 p-3 mt-2 small text-muted">The original post was deleted.</div>';
    const author = Store.getUser(original.author);
    return `
      <div class="border rounded-3 p-3 mt-2">
        <div class="d-flex align-items-center gap-2 small mb-1">${UI.avatar(author, 24)}
          <a href="profile.html?u=${UI.esc(author.username)}" class="link-dark text-decoration-none fw-semibold">${UI.esc(author.name)}</a>
          <span class="text-muted">· ${UI.timeAgo(original.at)}</span></div>
        <div>${text(original.text)}</div>
      </div>`;
  }

  function reactionTitle(usernames, verb) {
    const names = nameList(usernames);
    if (!names.length) return `No one ${verb} this yet`;
    return names.length > 6 ? `${names.slice(0, 6).join(', ')} and ${names.length - 6} more` : names.join(', ');
  }

  function render(post) {
    const me = Store.me().username;
    const author = Store.getUser(post.author);
    if (!author) return '';
    const mine = post.author === me;
    const liked = post.likes.includes(me);
    const disliked = post.dislikes.includes(me);
    const lastLogin = UI.isOnline(author) ? '<span class="text-success">Online now</span>' : 'Last login ' + UI.timeAgo(author.lastLogin);

    return `
      <div class="card border-0 shadow-sm rounded-3 mb-3" data-post="${UI.esc(post.id)}">
        <div class="card-body pb-2">
          <div class="d-flex gap-2 mb-2">
            <a href="profile.html?u=${UI.esc(author.username)}">${UI.avatar(author, 44, true)}</a>
            <div class="flex-grow-1 lh-sm">
              <a href="profile.html?u=${UI.esc(author.username)}" class="fw-semibold link-dark text-decoration-none">${UI.esc(author.name)}</a>
              ${post.sharedFrom ? '<span class="text-muted small">shared a post</span>' : ''}
              <div class="small text-muted mt-1">${lastLogin}</div>
            </div>
            <div class="text-end small text-muted text-nowrap">
              ${UI.timeAgo(post.at)}
              <div title="Visible to">${post.audience === 'all' ? '<i class="bi bi-people"></i>' : '<i class="bi bi-person-check"></i>'} ${audienceLabel(post)}</div>
            </div>
          </div>

          ${post.text ? `<p class="mb-2">${text(post.text)}</p>` : ''}
          ${post.sharedFrom ? quoted(post) : ''}

          <div class="d-flex align-items-center gap-1 border-top pt-2 mt-3">
            <button class="btn btn-sm ${liked ? 'btn-success' : 'btn-light'}" data-react="like" data-id="${UI.esc(post.id)}"
                    data-bs-toggle="tooltip" data-bs-title="${UI.esc(reactionTitle(post.likes, 'liked'))}" aria-pressed="${liked}">
              <i class="bi bi-hand-thumbs-up${liked ? '-fill' : ''}"></i> <span class="count">${post.likes.length}</span>
            </button>
            <button class="btn btn-sm ${disliked ? 'btn-danger' : 'btn-light'}" data-react="dislike" data-id="${UI.esc(post.id)}"
                    data-bs-toggle="tooltip" data-bs-title="${UI.esc(reactionTitle(post.dislikes, 'disliked'))}" aria-pressed="${disliked}">
              <i class="bi bi-hand-thumbs-down${disliked ? '-fill' : ''}"></i> <span class="count">${post.dislikes.length}</span>
            </button>
            <button class="btn btn-sm btn-light ms-auto" data-share="${UI.esc(post.sharedFrom || post.id)}"><i class="bi bi-share"></i> Share</button>
            ${mine ? `<button class="btn btn-sm btn-light text-danger" data-delete="${UI.esc(post.id)}" title="Delete post" aria-label="Delete post"><i class="bi bi-trash"></i></button>` : ''}
          </div>
        </div>
      </div>`;
  }

  // one listener per container handles like / dislike / delete / share clicks
  function bind(container, { onChange, onShare }) {
    container.addEventListener('click', (e) => {
      const react = e.target.closest('[data-react]');
      const del = e.target.closest('[data-delete]');
      const share = e.target.closest('[data-share]');
      if (react) {
        bootstrap.Tooltip.getInstance(react)?.dispose();
        UI.attempt(() => Store.react(react.dataset.id, react.dataset.react));
        onChange();
      } else if (del) {
        if (!confirm('Delete this post?')) return;
        UI.attempt(() => Store.deletePost(del.dataset.delete), 'Post deleted.');
        onChange();
      } else if (share && onShare) {
        onShare(share.dataset.share);
      }
    });
  }

  return { render, bind };
})();
